import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  actionPlans,
  diagnosticOrders,
  facilities,
  patientClaims,
  prescriptions,
  worldIdVerifications,
} from "@/lib/db/schema";
import { getPatientSession } from "@/lib/auth/session";
import { PatientMiniClient } from "./patient-mini-client";

const ORDER_PIPELINE = [
  { status: "CREATED", label: "Ordered" },
  { status: "AWAITING_PAYMENT", label: "Awaiting Payment" },
  { status: "PAID", label: "Paid" },
  { status: "ROUTED_TO_LAB", label: "In Lab" },
  { status: "SAMPLE_COLLECTED", label: "Sample Collected" },
  { status: "RESULT_UPLOADED", label: "Result Ready" },
  { status: "DOCTOR_REVIEW", label: "Doctor Review" },
  { status: "ACTION_PLAN_APPROVED", label: "Doctor Approved" },
  { status: "PATIENT_NOTIFIED", label: "Patient Notified" },
  { status: "COMPLETED", label: "Completed" },
] as const;

const STATUS_INDEX: Record<string, number> = {};
ORDER_PIPELINE.forEach((step, index) => {
  STATUS_INDEX[step.status] = index;
});

function MiniInstruction() {
  return (
    <div className="px-6 py-8">
      <p className="text-[10px] uppercase tracking-[0.24em] text-[#6d6d6d]">
        Pisgah Mini App
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#161616]">
        Open your claim link in World App
      </h1>
      <p className="mt-4 text-sm leading-7 text-[#6d6d6d]">
        Your clinic sends a secure Pisgah link after the doctor creates your
        case. Open that link on your phone in World App to continue.
      </p>
    </div>
  );
}

export default async function PatientMiniPage() {
  const patientSession = await getPatientSession();

  if (!patientSession) {
    return <MiniInstruction />;
  }

  const [claim] = await db
    .select({
      id: patientClaims.id,
      orderId: patientClaims.orderId,
      patientId: patientClaims.patientId,
    })
    .from(patientClaims)
    .where(
      and(
        eq(patientClaims.id, patientSession.claimId),
        eq(patientClaims.patientId, patientSession.patientId),
      ),
    )
    .limit(1);

  if (!claim?.orderId) {
    return <MiniInstruction />;
  }

  const [order] = await db
    .select({
      id: diagnosticOrders.id,
      status: diagnosticOrders.status,
      testType: diagnosticOrders.testType,
      totalAmount: diagnosticOrders.totalAmount,
    })
    .from(diagnosticOrders)
    .where(
      and(
        eq(diagnosticOrders.id, claim.orderId),
        eq(diagnosticOrders.patientId, patientSession.patientId),
      ),
    )
    .limit(1);

  if (!order) {
    return <MiniInstruction />;
  }

  const [plan] = await db
    .select({
      summary: actionPlans.summary,
      recommendations: actionPlans.recommendations,
    })
    .from(actionPlans)
    .where(eq(actionPlans.orderId, order.id))
    .limit(1);

  const [prescription] = await db
    .select({
      id: prescriptions.id,
      items: prescriptions.items,
      status: prescriptions.status,
      redemptionCode: prescriptions.redemptionCode,
      pharmacyName: facilities.name,
      pharmacyEns: facilities.ensName,
    })
    .from(prescriptions)
    .leftJoin(facilities, eq(prescriptions.pharmacyId, facilities.id))
    .where(eq(prescriptions.orderId, order.id))
    .limit(1);

  const [resultVerification] = await db
    .select({ id: worldIdVerifications.id })
    .from(worldIdVerifications)
    .where(
      and(
        eq(worldIdVerifications.patientId, patientSession.patientId),
        eq(worldIdVerifications.action, "view-result"),
        eq(worldIdVerifications.orderId, order.id),
      ),
    )
    .limit(1);

  const [prescriptionVerification] =
    prescription?.id
      ? await db
          .select({ id: worldIdVerifications.id })
          .from(worldIdVerifications)
          .where(
            and(
              eq(worldIdVerifications.patientId, patientSession.patientId),
              eq(worldIdVerifications.action, "redeem-prescription"),
              eq(worldIdVerifications.prescriptionId, prescription.id),
            ),
          )
          .limit(1)
      : [];

  const currentIdx = STATUS_INDEX[order.status] ?? 0;
  const timeline = ORDER_PIPELINE.map((step, index) => ({
    label: step.label,
    state:
      index < currentIdx
        ? ("done" as const)
        : index === currentIdx
          ? ("current" as const)
          : ("pending" as const),
  }));

  return (
    <PatientMiniClient
      order={{
        id: order.id,
        testType: order.testType,
        displayStatus: ORDER_PIPELINE[currentIdx]?.label ?? order.status,
        timeline,
        amount: order.totalAmount ?? null,
      }}
      plan={plan ?? null}
      prescription={
        prescription
          ? {
              id: prescription.id,
              items: prescription.items as Array<{
                drugName?: string;
                dosage?: string;
                quantity?: string;
                instructions?: string;
              }>,
              pharmacyName: prescription.pharmacyName ?? "Partner Pharmacy",
              pharmacyEns: prescription.pharmacyEns ?? null,
              redemptionCode: prescription.redemptionCode ?? null,
              status: prescription.status,
            }
          : null
      }
      resultVerified={Boolean(resultVerification)}
      prescriptionVerified={Boolean(prescriptionVerification)}
    />
  );
}
