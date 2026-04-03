"use server";

import { eq, and, sql, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  diagnosticOrders,
  billingRecords,
  labResults,
  actionPlans,
  prescriptions,
  patients,
  aiDrafts,
} from "@/lib/db/schema";
import { generateDraft } from "@/lib/ai/generate-draft";
import { transitionOrder } from "@/lib/workflow/transition";
import { logWorkflowEvent } from "@/lib/workflow/events";

// Hardcoded demo actor IDs
const ACTORS = {
  doctor: "a1b2c3d4-0011-4000-8000-000000000011",
  accounts: "a1b2c3d4-0012-4000-8000-000000000012",
  labTech: "a1b2c3d4-0013-4000-8000-000000000013",
  pharmacist: "a1b2c3d4-0014-4000-8000-000000000014",
  stLukes: "a1b2c3d4-0001-4000-8000-000000000001",
  sunshineLab: "a1b2c3d4-0002-4000-8000-000000000002",
  greenLeaf: "a1b2c3d4-0003-4000-8000-000000000003",
} as const;

export async function createOrder(formData: FormData) {
  const patientId = formData.get("patientId") as string;
  const testType = formData.get("testType") as string;
  const clinicalNotes = formData.get("clinicalNotes") as string;
  const amount = formData.get("amount") as string;

  if (!patientId || !testType || !amount) {
    return { error: "Missing required fields" };
  }

  // Insert order as CREATED
  const [order] = await db
    .insert(diagnosticOrders)
    .values({
      patientId,
      facilityId: ACTORS.stLukes,
      doctorId: ACTORS.doctor,
      labId: ACTORS.sunshineLab,
      status: "CREATED",
      testType,
      clinicalNotes: clinicalNotes || null,
      totalAmount: amount,
    })
    .returning();

  // Create billing record
  await db.insert(billingRecords).values({
    orderId: order.id,
    amount,
    status: "unpaid",
  });

  // Log workflow event
  await logWorkflowEvent({
    orderId: order.id,
    eventType: "ORDER_CREATED",
    actorId: ACTORS.doctor,
    actorRole: "doctor",
  });

  // Transition to AWAITING_PAYMENT (system transition)
  await transitionOrder({
    orderId: order.id,
    nextStatus: "AWAITING_PAYMENT",
    actorId: ACTORS.doctor,
    actorRole: "system",
  });

  revalidatePath("/dashboard");
  revalidatePath("/doctor");
  revalidatePath("/accounts");

  return { success: true, orderId: order.id };
}

export async function confirmPayment(billingId: string) {
  // Fetch billing record to get orderId
  const [billing] = await db
    .select()
    .from(billingRecords)
    .where(eq(billingRecords.id, billingId))
    .limit(1);

  if (!billing) {
    return { error: "Billing record not found" };
  }

  // Update billing status
  await db
    .update(billingRecords)
    .set({
      status: "cash_confirmed",
      confirmedBy: ACTORS.accounts,
      confirmedAt: new Date(),
    })
    .where(eq(billingRecords.id, billingId));

  // Transition order: AWAITING_PAYMENT -> PAID
  const paidResult = await transitionOrder({
    orderId: billing.orderId,
    nextStatus: "PAID",
    actorId: ACTORS.accounts,
    actorRole: "accounts",
  });

  if (!paidResult.success) {
    return { error: paidResult.error };
  }

  // Auto-transition: PAID -> ROUTED_TO_LAB (system)
  await transitionOrder({
    orderId: billing.orderId,
    nextStatus: "ROUTED_TO_LAB",
    actorId: ACTORS.accounts,
    actorRole: "system",
  });

  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  revalidatePath("/lab");

  return { success: true };
}

export async function collectSample(orderId: string) {
  const result = await transitionOrder({
    orderId,
    nextStatus: "SAMPLE_COLLECTED",
    actorId: ACTORS.labTech,
    actorRole: "lab_tech",
  });

  if (!result.success) {
    return { error: result.error };
  }

  revalidatePath("/dashboard");
  revalidatePath("/lab");

  return { success: true };
}

export async function uploadResult(orderId: string, rawText: string) {
  if (!rawText.trim()) {
    return { error: "Result text is required" };
  }

  // Insert lab result
  const [labResult] = await db.insert(labResults).values({
    orderId,
    labUserId: ACTORS.labTech,
    rawText,
  }).returning();

  // Transition: SAMPLE_COLLECTED -> RESULT_UPLOADED
  const uploadTransition = await transitionOrder({
    orderId,
    nextStatus: "RESULT_UPLOADED",
    actorId: ACTORS.labTech,
    actorRole: "lab_tech",
  });

  if (!uploadTransition.success) {
    return { error: uploadTransition.error };
  }

  // Auto-transition: RESULT_UPLOADED -> DOCTOR_REVIEW (system)
  await transitionOrder({
    orderId,
    nextStatus: "DOCTOR_REVIEW",
    actorId: ACTORS.labTech,
    actorRole: "system",
  });

  // Generate AI draft (non-blocking — failure does not stop the workflow)
  try {
    const [order] = await db
      .select({
        testType: diagnosticOrders.testType,
        patientName: patients.name,
      })
      .from(diagnosticOrders)
      .innerJoin(patients, eq(diagnosticOrders.patientId, patients.id))
      .where(eq(diagnosticOrders.id, orderId))
      .limit(1);

    if (order) {
      const draft = await generateDraft({
        rawText,
        testType: order.testType,
        patientName: order.patientName,
      });

      await db.insert(aiDrafts).values({
        orderId,
        resultId: labResult.id,
        draftText: JSON.stringify(draft),
        agentVerified: false,
      });
    }
  } catch (err) {
    console.error("[AI Draft] Failed to generate draft for order", orderId, err);
  }

  revalidatePath("/dashboard");
  revalidatePath("/lab");
  revalidatePath("/review");

  return { success: true };
}

export async function approveActionPlan(orderId: string, formData: FormData) {
  const summary = formData.get("summary") as string;
  const recommendations = formData.get("recommendations") as string;
  const drugName = formData.get("drugName") as string;
  const dosage = formData.get("dosage") as string;
  const quantity = formData.get("quantity") as string;
  const instructions = formData.get("instructions") as string;

  if (!summary || !recommendations) {
    return { error: "Summary and recommendations are required" };
  }

  // Fetch lab result for this order
  const [labResult] = await db
    .select()
    .from(labResults)
    .where(eq(labResults.orderId, orderId))
    .limit(1);

  if (!labResult) {
    return { error: "Lab result not found for this order" };
  }

  // Fetch order for patientId
  const [order] = await db
    .select()
    .from(diagnosticOrders)
    .where(eq(diagnosticOrders.id, orderId))
    .limit(1);

  if (!order) {
    return { error: "Order not found" };
  }

  // Create action plan
  await db.insert(actionPlans).values({
    orderId,
    resultId: labResult.id,
    summary,
    recommendations,
    approvedBy: ACTORS.doctor,
    approvedAt: new Date(),
  });

  // Create prescription if drug info provided
  if (drugName && dosage) {
    const redemptionCode = Math.random().toString().slice(2, 8);
    await db.insert(prescriptions).values({
      orderId,
      patientId: order.patientId,
      pharmacyId: ACTORS.greenLeaf,
      items: [{ drugName, dosage, quantity, instructions }],
      status: "sent_to_pharmacy",
      redemptionCode,
    });
  }

  // Transition: DOCTOR_REVIEW -> ACTION_PLAN_APPROVED
  const approveResult = await transitionOrder({
    orderId,
    nextStatus: "ACTION_PLAN_APPROVED",
    actorId: ACTORS.doctor,
    actorRole: "doctor",
  });

  if (!approveResult.success) {
    return { error: approveResult.error };
  }

  // Auto-transition: ACTION_PLAN_APPROVED -> PATIENT_NOTIFIED (system)
  await transitionOrder({
    orderId,
    nextStatus: "PATIENT_NOTIFIED",
    actorId: ACTORS.doctor,
    actorRole: "system",
  });

  revalidatePath("/dashboard");
  revalidatePath("/review");
  revalidatePath("/pharmacy");
  revalidatePath("/mini");

  return { success: true };
}

export async function dispensePrescription(prescriptionId: string) {
  await db
    .update(prescriptions)
    .set({ status: "fulfilled" })
    .where(eq(prescriptions.id, prescriptionId));

  revalidatePath("/pharmacy");

  return { success: true };
}

export async function registerPatient(formData: FormData) {
  const name = formData.get("name") as string;
  const phone = (formData.get("phone") as string) || null;
  const dob = (formData.get("dob") as string) || null;

  if (!name?.trim()) return { success: false, error: "Name is required" };

  const [patient] = await db
    .insert(patients)
    .values({
      name: name.trim(),
      phone,
      dob,
      registeredBy: "a1b2c3d4-0011-4000-8000-000000000011", // Dr. Adeyemi (hardcoded until auth)
      facilityId: "a1b2c3d4-0001-4000-8000-000000000001", // St. Luke's
    })
    .returning();

  revalidatePath("/patients");
  return { success: true, patient };
}

export async function createOrderWithNewPatient(formData: FormData) {
  const patientName = formData.get("patientName") as string;
  const patientPhone = (formData.get("patientPhone") as string) || null;
  const patientDob = (formData.get("patientDob") as string) || null;
  const testType = formData.get("testType") as string;
  const clinicalNotes = formData.get("clinicalNotes") as string;
  const amount = formData.get("amount") as string;

  if (!patientName?.trim() || !testType || !amount) {
    return { success: false, error: "Missing required fields" };
  }

  try {
    // Create patient first
    const [patient] = await db
      .insert(patients)
      .values({
        name: patientName.trim(),
        phone: patientPhone,
        dob: patientDob,
        registeredBy: ACTORS.doctor,
        facilityId: ACTORS.stLukes,
      })
      .returning();

    // Create order with the new patient
    const [order] = await db
      .insert(diagnosticOrders)
      .values({
        patientId: patient.id,
        facilityId: ACTORS.stLukes,
        doctorId: ACTORS.doctor,
        labId: ACTORS.sunshineLab,
        status: "CREATED",
        testType,
        clinicalNotes: clinicalNotes || null,
        totalAmount: amount,
      })
      .returning();

    // Create billing record
    await db.insert(billingRecords).values({
      orderId: order.id,
      amount,
      status: "unpaid",
    });

    // Log workflow event
    await logWorkflowEvent({
      orderId: order.id,
      eventType: "ORDER_CREATED",
      actorId: ACTORS.doctor,
      actorRole: "doctor",
    });

    // Transition to AWAITING_PAYMENT
    await transitionOrder({
      orderId: order.id,
      nextStatus: "AWAITING_PAYMENT",
      actorId: ACTORS.doctor,
      actorRole: "system",
    });

    revalidatePath("/doctor");
    revalidatePath("/patients");

    return { success: true, orderId: order.id };
  } catch (err) {
    console.error("[createOrderWithNewPatient] Failed:", err);
    return { success: false, error: "Failed to create order" };
  }
}

export async function simulateOnlinePayment(orderId: string) {
  // Find the billing record for this order
  const [billing] = await db
    .select()
    .from(billingRecords)
    .where(eq(billingRecords.orderId, orderId))
    .limit(1);

  if (!billing) {
    return { success: false, error: "Billing record not found" };
  }

  // Update billing status to online_confirmed
  await db
    .update(billingRecords)
    .set({
      status: "online_confirmed",
      confirmedAt: new Date(),
    })
    .where(eq(billingRecords.id, billing.id));

  // Transition: AWAITING_PAYMENT -> PAID
  const paidResult = await transitionOrder({
    orderId,
    nextStatus: "PAID",
    actorId: ACTORS.accounts,
    actorRole: "accounts",
  });

  if (!paidResult.success) {
    return { success: false, error: paidResult.error };
  }

  // Auto-transition: PAID -> ROUTED_TO_LAB
  await transitionOrder({
    orderId,
    nextStatus: "ROUTED_TO_LAB",
    actorId: ACTORS.accounts,
    actorRole: "system",
  });

  revalidatePath("/mini");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");

  return { success: true };
}

export async function updateResult(resultId: string, rawText: string) {
  if (!rawText.trim()) {
    return { success: false, error: "Result text is required" };
  }

  // Update the lab result raw text
  const [updatedResult] = await db
    .update(labResults)
    .set({ rawText })
    .where(eq(labResults.id, resultId))
    .returning();

  if (!updatedResult) {
    return { success: false, error: "Lab result not found" };
  }

  // Fetch order info for AI draft regeneration
  const [order] = await db
    .select({
      id: diagnosticOrders.id,
      testType: diagnosticOrders.testType,
      patientName: patients.name,
    })
    .from(diagnosticOrders)
    .innerJoin(patients, eq(diagnosticOrders.patientId, patients.id))
    .where(eq(diagnosticOrders.id, updatedResult.orderId))
    .limit(1);

  if (order) {
    try {
      const draft = await generateDraft({
        rawText,
        testType: order.testType,
        patientName: order.patientName,
      });

      // Delete old draft for this order, insert new one
      await db
        .delete(aiDrafts)
        .where(eq(aiDrafts.orderId, order.id));

      await db.insert(aiDrafts).values({
        orderId: order.id,
        resultId: updatedResult.id,
        draftText: JSON.stringify(draft),
        agentVerified: false,
      });
    } catch (err) {
      console.error("[updateResult] Failed to regenerate AI draft:", err);
    }
  }

  revalidatePath("/lab");
  revalidatePath("/review");

  return { success: true };
}

export async function redeemPrescription(code: string) {
  // Find prescription by redemption code
  const [prescription] = await db
    .select()
    .from(prescriptions)
    .where(eq(prescriptions.redemptionCode, code))
    .limit(1);

  if (!prescription) {
    return { success: false, error: "Invalid code" };
  }

  if (prescription.status === "fulfilled" || prescription.status === "redeemed") {
    return { success: false, error: "Already redeemed" };
  }

  // Update prescription status
  await db
    .update(prescriptions)
    .set({ status: "fulfilled", redeemedAt: new Date() })
    .where(eq(prescriptions.id, prescription.id));

  // Transition the associated order: PATIENT_NOTIFIED -> COMPLETED
  await transitionOrder({
    orderId: prescription.orderId,
    nextStatus: "COMPLETED",
    actorId: ACTORS.pharmacist,
    actorRole: "system",
  });

  revalidatePath("/pharmacy");
  revalidatePath("/dashboard");
  revalidatePath("/mini");

  return { success: true };
}

export async function confirmReceipt(orderId: string) {
  const PATIENT_ACTOR_ID = "00000000-0000-4000-8000-000000000000";

  const result = await transitionOrder({
    orderId,
    nextStatus: "COMPLETED",
    actorId: PATIENT_ACTOR_ID,
    actorRole: "system",
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath("/mini");
  revalidatePath("/dashboard");

  return { success: true };
}
