"use server";

import { randomInt } from "node:crypto";
import { and, eq } from "drizzle-orm";
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
  facilities,
  staffInvites,
  facilityUsers,
} from "@/lib/db/schema";
import { canTransition, type OrderStatus } from "@/lib/workflow/machine";
import { transitionOrder } from "@/lib/workflow/transition";
import { logWorkflowEvent } from "@/lib/workflow/events";
import {
  requirePatientSession,
  requireProviderSession,
} from "@/lib/auth/session";
import { issuePatientClaim } from "@/lib/patients/claims";
import { attestLabResult } from "@/lib/attestations/eas";
import {
  buildAgentkitHeader,
  getAgentDraftEndpoint,
} from "@/lib/agent/signer";

function generateRedemptionCode() {
  return randomInt(100000, 1000000).toString();
}

async function getOrderStatus(orderId: string) {
  const [order] = await db
    .select({
      status: diagnosticOrders.status,
      patientId: diagnosticOrders.patientId,
      facilityId: diagnosticOrders.facilityId,
      labId: diagnosticOrders.labId,
      testType: diagnosticOrders.testType,
    })
    .from(diagnosticOrders)
    .where(eq(diagnosticOrders.id, orderId))
    .limit(1);

  return order;
}

async function getFacilityByType(type: "lab" | "pharmacy") {
  const [facility] = await db
    .select({
      id: facilities.id,
      name: facilities.name,
      ensName: facilities.ensName,
    })
    .from(facilities)
    .where(eq(facilities.type, type))
    .limit(1);

  return facility ?? null;
}

async function requestVerifiedDraft(params: {
  orderId: string;
  resultId: string;
  rawText: string;
  testType: string;
  patientName: string;
}) {
  try {
    const response = await fetch(getAgentDraftEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        agentkit: await buildAgentkitHeader(),
      },
      body: JSON.stringify(params),
      cache: "no-store",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      console.error("[agent/draft] failed", payload?.error ?? response.statusText);
      return { success: false as const };
    }

    return { success: true as const };
  } catch (error) {
    console.error("[agent/draft] failed", error);
    return { success: false as const };
  }
}

export async function createOrder(formData: FormData) {
  const actor = await requireProviderSession(["doctor", "admin"]);
  const patientId = formData.get("patientId") as string;
  const testType = formData.get("testType") as string;
  const clinicalNotes = formData.get("clinicalNotes") as string;
  const amount = formData.get("amount") as string;

  if (!patientId || !testType || !amount) {
    return { error: "Missing required fields" };
  }

  const lab = await getFacilityByType("lab");
  if (!lab) {
    return { error: "No lab facility has been configured yet" };
  }

  // Insert order as CREATED
  const [order] = await db
    .insert(diagnosticOrders)
    .values({
      patientId,
      facilityId: actor.facilityId,
      doctorId: actor.facilityUserId,
      labId: lab.id,
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
    actorId: actor.facilityUserId,
    actorRole: actor.role,
  });

  // Transition to AWAITING_PAYMENT (system transition)
  await transitionOrder({
    orderId: order.id,
    nextStatus: "AWAITING_PAYMENT",
    actorId: actor.facilityUserId,
    actorRole: "system",
  });

  const { claimLink } = await issuePatientClaim({
    patientId,
    orderId: order.id,
    issuedBy: actor.facilityUserId,
  });

  revalidatePath("/dashboard");
  revalidatePath("/doctor");
  revalidatePath("/accounts");

  return { success: true, orderId: order.id, claimLink };
}

export async function confirmPayment(billingId: string) {
  const actor = await requireProviderSession(["accounts", "admin"]);
  const [billing] = await db
    .select()
    .from(billingRecords)
    .where(eq(billingRecords.id, billingId))
    .limit(1);

  if (!billing) {
    return { error: "Billing record not found" };
  }

  if (billing.status !== "unpaid") {
    return { error: "Payment has already been confirmed" };
  }

  const order = await getOrderStatus(billing.orderId);
  if (!order) {
    return { error: "Order not found" };
  }

  if (
    !canTransition(order.status as OrderStatus, "PAID", "accounts") ||
    !canTransition("PAID", "ROUTED_TO_LAB", "system")
  ) {
    return { error: "Order is not ready for payment confirmation" };
  }

  await db
    .update(billingRecords)
    .set({
      status: "cash_confirmed",
      confirmedBy: actor.facilityUserId,
      confirmedAt: new Date(),
    })
    .where(eq(billingRecords.id, billingId));

  // Transition order: AWAITING_PAYMENT -> PAID
  const paidResult = await transitionOrder({
    orderId: billing.orderId,
    nextStatus: "PAID",
    actorId: actor.facilityUserId,
    actorRole: actor.role,
  });

  if (!paidResult.success) {
    return { error: paidResult.error };
  }

  // Auto-transition: PAID -> ROUTED_TO_LAB (system)
  await transitionOrder({
    orderId: billing.orderId,
    nextStatus: "ROUTED_TO_LAB",
    actorId: actor.facilityUserId,
    actorRole: "system",
  });

  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  revalidatePath("/lab");

  return { success: true };
}

export async function collectSample(orderId: string) {
  const actor = await requireProviderSession(["lab_tech", "admin"]);
  const result = await transitionOrder({
    orderId,
    nextStatus: "SAMPLE_COLLECTED",
    actorId: actor.facilityUserId,
    actorRole: actor.role === "admin" ? "lab_tech" : actor.role,
  });

  if (!result.success) {
    return { error: result.error };
  }

  revalidatePath("/dashboard");
  revalidatePath("/lab");

  return { success: true };
}

export async function uploadResult(orderId: string, rawText: string) {
  const actor = await requireProviderSession(["lab_tech", "admin"]);
  if (!rawText.trim()) {
    return { error: "Result text is required" };
  }

  const order = await getOrderStatus(orderId);
  if (!order) {
    return { error: "Order not found" };
  }

  if (
    !canTransition(order.status as OrderStatus, "RESULT_UPLOADED", "lab_tech") ||
    !canTransition("RESULT_UPLOADED", "DOCTOR_REVIEW", "system")
  ) {
    return { error: "Order is not ready for result upload" };
  }

  const [existingResult] = await db
    .select({ id: labResults.id })
    .from(labResults)
    .where(eq(labResults.orderId, orderId))
    .limit(1);

  if (existingResult) {
    return { error: "A result already exists for this order" };
  }

  const [labResult] = await db
    .insert(labResults)
    .values({
      orderId,
      labUserId: actor.facilityUserId,
      rawText,
    })
    .returning();

  const [draftContext] = await db
    .select({
      patientName: patients.name,
      patientId: diagnosticOrders.patientId,
      testType: diagnosticOrders.testType,
      labEns: facilities.ensName,
      labWalletAddress: facilities.walletAddress,
    })
    .from(diagnosticOrders)
    .innerJoin(patients, eq(diagnosticOrders.patientId, patients.id))
    .leftJoin(facilities, eq(diagnosticOrders.labId, facilities.id))
    .where(eq(diagnosticOrders.id, orderId))
    .limit(1);

  if (!draftContext) {
    await db.delete(labResults).where(eq(labResults.id, labResult.id));
    return { error: "Unable to resolve result provenance context" };
  }

  try {
    const attestationUid = await attestLabResult({
      orderId,
      patientId: draftContext.patientId,
      rawText,
      labAddress: draftContext.labWalletAddress,
      labEns: draftContext.labEns,
    });

    await db
      .update(labResults)
      .set({ attestationUid })
      .where(eq(labResults.id, labResult.id));
    await db
      .update(diagnosticOrders)
      .set({ attestationUid })
      .where(eq(diagnosticOrders.id, orderId));
  } catch (error) {
    console.error("[uploadResult/attestation]", error);
    await db.delete(labResults).where(eq(labResults.id, labResult.id));
    return { error: "Result provenance attestation failed" };
  }

  const uploadTransition = await transitionOrder({
    orderId,
    nextStatus: "RESULT_UPLOADED",
    actorId: actor.facilityUserId,
    actorRole: actor.role === "admin" ? "lab_tech" : actor.role,
  });

  if (!uploadTransition.success) {
    await db.delete(labResults).where(eq(labResults.id, labResult.id));
    return { error: uploadTransition.error };
  }

  const reviewTransition = await transitionOrder({
    orderId,
    nextStatus: "DOCTOR_REVIEW",
    actorId: actor.facilityUserId,
    actorRole: "system",
  });

  if (!reviewTransition.success) {
    return { error: reviewTransition.error };
  }

  await db.delete(aiDrafts).where(eq(aiDrafts.orderId, orderId));
  await requestVerifiedDraft({
    orderId,
    resultId: labResult.id,
    rawText,
    testType: draftContext.testType,
    patientName: draftContext.patientName,
  });

  revalidatePath("/dashboard");
  revalidatePath("/lab");
  revalidatePath("/review");

  return { success: true };
}

export async function approveActionPlan(orderId: string, formData: FormData) {
  const actor = await requireProviderSession(["doctor", "admin"]);
  const summary = formData.get("summary") as string;
  const recommendations = formData.get("recommendations") as string;
  const drugName = formData.get("drugName") as string;
  const dosage = formData.get("dosage") as string;
  const quantity = formData.get("quantity") as string;
  const instructions = formData.get("instructions") as string;

  if (!summary || !recommendations) {
    return { error: "Summary and recommendations are required" };
  }

  const wantsPrescription = [drugName, dosage, quantity, instructions].some(
    (value) => Boolean(value?.trim()),
  );

  if (wantsPrescription && (!drugName?.trim() || !dosage?.trim())) {
    return { error: "Drug name and dosage are required to create a prescription" };
  }

  const [labResult] = await db
    .select()
    .from(labResults)
    .where(eq(labResults.orderId, orderId))
    .limit(1);

  if (!labResult) {
    return { error: "Lab result not found for this order" };
  }

  const order = await getOrderStatus(orderId);

  if (!order) {
    return { error: "Order not found" };
  }

  if (
    !canTransition(order.status as OrderStatus, "ACTION_PLAN_APPROVED", "doctor") ||
    !canTransition("ACTION_PLAN_APPROVED", "PATIENT_NOTIFIED", "system")
  ) {
    return { error: "Order is not ready for doctor approval" };
  }

  const [existingPlan] = await db
    .select({ id: actionPlans.id })
    .from(actionPlans)
    .where(eq(actionPlans.orderId, orderId))
    .limit(1);

  if (existingPlan) {
    return { error: "Action plan has already been approved for this order" };
  }

  const [createdPlan] = await db.insert(actionPlans).values({
    orderId,
    resultId: labResult.id,
    summary,
    recommendations,
    approvedBy: actor.facilityUserId,
    approvedAt: new Date(),
  }).returning();

  let createdPrescriptionId: string | null = null;

  if (wantsPrescription) {
    const pharmacy = await getFacilityByType("pharmacy");
    if (!pharmacy) {
      await db.delete(actionPlans).where(eq(actionPlans.id, createdPlan.id));
      return { error: "No pharmacy facility has been configured yet" };
    }

    const [prescription] = await db.insert(prescriptions).values({
      orderId,
      patientId: order.patientId,
      pharmacyId: pharmacy.id,
      items: [{ drugName, dosage, quantity, instructions }],
      status: "ready_for_pickup",
      redemptionCode: generateRedemptionCode(),
    }).returning({ id: prescriptions.id });
    createdPrescriptionId = prescription.id;
  }

  const approveResult = await transitionOrder({
    orderId,
    nextStatus: "ACTION_PLAN_APPROVED",
    actorId: actor.facilityUserId,
    actorRole: actor.role === "admin" ? "doctor" : actor.role,
  });

  if (!approveResult.success) {
    await db.delete(actionPlans).where(eq(actionPlans.id, createdPlan.id));
    if (createdPrescriptionId) {
      await db.delete(prescriptions).where(eq(prescriptions.id, createdPrescriptionId));
    }
    return { error: approveResult.error };
  }

  const notifyResult = await transitionOrder({
    orderId,
    nextStatus: "PATIENT_NOTIFIED",
    actorId: actor.facilityUserId,
    actorRole: "system",
  });

  if (!notifyResult.success) {
    return { error: notifyResult.error };
  }

  revalidatePath("/dashboard");
  revalidatePath("/review");
  revalidatePath("/pharmacy");
  revalidatePath("/mini");

  return { success: true };
}

export async function registerPatient(formData: FormData) {
  const actor = await requireProviderSession(["doctor", "admin"]);
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
      registeredBy: actor.facilityUserId,
      facilityId: actor.facilityId,
    })
    .returning();

  revalidatePath("/patients");
  return { success: true, patient };
}

export async function inviteStaff(formData: FormData) {
  const actor = await requireProviderSession(["admin"]);
  const name = (formData.get("name") as string | null)?.trim();
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const role = formData.get("role") as "doctor" | "accounts" | "lab_tech" | "pharmacist" | "admin" | null;
  const facilityId = (formData.get("facilityId") as string | null)?.trim();

  if (!name || !email || !role || !facilityId) {
    return { success: false, error: "Name, email, role, and facility are required" };
  }

  const [existingUser] = await db
    .select({ id: facilityUsers.id })
    .from(facilityUsers)
    .where(and(eq(facilityUsers.facilityId, facilityId), eq(facilityUsers.email, email)))
    .limit(1);

  if (existingUser) {
    return { success: false, error: "A provider with this email already exists for that facility" };
  }

  await db.insert(staffInvites).values({
    facilityId,
    email,
    role,
    name,
    invitedBy: actor.facilityUserId,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
  });

  revalidatePath("/admin/staff");

  return { success: true };
}

export async function createOrderWithNewPatient(formData: FormData) {
  const actor = await requireProviderSession(["doctor", "admin"]);
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
    const lab = await getFacilityByType("lab");
    if (!lab) {
      return { success: false, error: "No lab facility has been configured yet" };
    }

    // Create patient first
    const [patient] = await db
      .insert(patients)
      .values({
        name: patientName.trim(),
        phone: patientPhone,
        dob: patientDob,
        registeredBy: actor.facilityUserId,
        facilityId: actor.facilityId,
      })
      .returning();

    // Create order with the new patient
    const [order] = await db
      .insert(diagnosticOrders)
      .values({
        patientId: patient.id,
        facilityId: actor.facilityId,
        doctorId: actor.facilityUserId,
        labId: lab.id,
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
      actorId: actor.facilityUserId,
      actorRole: actor.role,
    });

    // Transition to AWAITING_PAYMENT
    await transitionOrder({
      orderId: order.id,
      nextStatus: "AWAITING_PAYMENT",
      actorId: actor.facilityUserId,
      actorRole: "system",
    });

    const { claimLink } = await issuePatientClaim({
      patientId: patient.id,
      orderId: order.id,
      issuedBy: actor.facilityUserId,
    });

    revalidatePath("/doctor");
    revalidatePath("/patients");

    return { success: true, orderId: order.id, claimLink };
  } catch (err) {
    console.error("[createOrderWithNewPatient] Failed:", err);
    return { success: false, error: "Failed to create order" };
  }
}

export async function updateResult(resultId: string, rawText: string) {
  await requireProviderSession(["lab_tech", "admin"]);
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

  await db.delete(aiDrafts).where(eq(aiDrafts.orderId, updatedResult.orderId));

  const [draftContext] = await db
    .select({
      patientName: patients.name,
      patientId: diagnosticOrders.patientId,
      testType: diagnosticOrders.testType,
      labEns: facilities.ensName,
      labWalletAddress: facilities.walletAddress,
    })
    .from(diagnosticOrders)
    .innerJoin(patients, eq(diagnosticOrders.patientId, patients.id))
    .leftJoin(facilities, eq(diagnosticOrders.labId, facilities.id))
    .where(eq(diagnosticOrders.id, updatedResult.orderId))
    .limit(1);

  if (draftContext) {
    try {
      const attestationUid = await attestLabResult({
        orderId: updatedResult.orderId,
        patientId: draftContext.patientId,
        rawText,
        labAddress: draftContext.labWalletAddress,
        labEns: draftContext.labEns,
      });

      await db
        .update(labResults)
        .set({ attestationUid })
        .where(eq(labResults.id, updatedResult.id));
      await db
        .update(diagnosticOrders)
        .set({ attestationUid })
        .where(eq(diagnosticOrders.id, updatedResult.orderId));
    } catch (error) {
      console.error("[updateResult/attestation]", error);
    }

    await requestVerifiedDraft({
      orderId: updatedResult.orderId,
      resultId: updatedResult.id,
      rawText,
      testType: draftContext.testType,
      patientName: draftContext.patientName,
    });
  }

  revalidatePath("/lab");
  revalidatePath("/review");

  return { success: true };
}

export async function redeemPrescription(prescriptionId: string, code: string) {
  await requireProviderSession(["pharmacist", "admin"]);
  const [prescription] = await db
    .select()
    .from(prescriptions)
    .where(eq(prescriptions.id, prescriptionId))
    .limit(1);

  if (!prescription) {
    return { success: false, error: "Prescription not found" };
  }

  if (prescription.redemptionCode !== code.trim()) {
    return { success: false, error: "Invalid code" };
  }

  if (prescription.status === "redeemed") {
    return { success: false, error: "Already redeemed" };
  }

  if (prescription.status !== "ready_for_pickup") {
    return { success: false, error: "Prescription is not ready for pickup" };
  }

  await db
    .update(prescriptions)
    .set({ status: "redeemed", redeemedAt: new Date() })
    .where(eq(prescriptions.id, prescription.id));

  revalidatePath("/pharmacy");
  revalidatePath("/dashboard");
  revalidatePath("/mini");

  return { success: true };
}

export async function confirmReceipt(orderId: string) {
  const patientSession = await requirePatientSession();
  const order = await getOrderStatus(orderId);
  if (!order) {
    return { success: false, error: "Order not found" };
  }

  if (order.patientId !== patientSession.patientId) {
    return { success: false, error: "This order does not belong to the current patient" };
  }

  const [prescription] = await db
    .select({
      status: prescriptions.status,
    })
    .from(prescriptions)
    .where(eq(prescriptions.orderId, orderId))
    .limit(1);

  if (prescription && prescription.status !== "redeemed") {
    return { success: false, error: "Prescription must be redeemed first" };
  }

  const result = await transitionOrder({
    orderId,
    nextStatus: "COMPLETED",
    actorId: patientSession.patientId,
    actorRole: "system",
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath("/mini");
  revalidatePath("/dashboard");

  return { success: true };
}
