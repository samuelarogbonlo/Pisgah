import { db } from "@/lib/db";
import {
  diagnosticOrders,
  patients,
  actionPlans,
  prescriptions,
  workflowEvents,
  facilities,
} from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
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
ORDER_PIPELINE.forEach((s, i) => {
  STATUS_INDEX[s.status] = i;
});

export default async function PatientMiniPage() {
  // Fetch the demo patient's latest order
  const demoOrders = await db
    .select({
      id: diagnosticOrders.id,
      testType: diagnosticOrders.testType,
      status: diagnosticOrders.status,
      totalAmount: diagnosticOrders.totalAmount,
      patientName: patients.name,
    })
    .from(diagnosticOrders)
    .innerJoin(patients, eq(diagnosticOrders.patientId, patients.id))
    .orderBy(sql`${diagnosticOrders.createdAt} desc`)
    .limit(1);

  const order = demoOrders[0];

  if (!order) {
    return (
      <div className="flex justify-center pt-5">
        <div className="border border-gray-200 rounded-lg bg-white/90 p-3.5 inline-block">
          <p className="text-sm text-gray-400">No orders found.</p>
        </div>
      </div>
    );
  }

  // Get action plan if exists
  let plan: { summary: string; recommendations: string } | null = null;
  const plans = await db
    .select({
      summary: actionPlans.summary,
      recommendations: actionPlans.recommendations,
    })
    .from(actionPlans)
    .where(eq(actionPlans.orderId, order.id))
    .limit(1);
  if (plans.length > 0) {
    plan = plans[0];
  }

  // Get prescription if exists
  let rxData: {
    items: Array<{ drugName?: string; dosage?: string; quantity?: string; instructions?: string }>;
    pharmacyEns: string | null;
    redemptionCode: string | null;
    status: string;
  } | null = null;
  const rxRows = await db
    .select({
      items: prescriptions.items,
      pharmacyId: prescriptions.pharmacyId,
      redemptionCode: prescriptions.redemptionCode,
      status: prescriptions.status,
    })
    .from(prescriptions)
    .where(eq(prescriptions.orderId, order.id))
    .limit(1);

  if (rxRows.length > 0) {
    let pharmacyEns: string | null = null;
    if (rxRows[0].pharmacyId) {
      const pharm = await db
        .select({ ensName: facilities.ensName })
        .from(facilities)
        .where(eq(facilities.id, rxRows[0].pharmacyId))
        .limit(1);
      pharmacyEns = pharm[0]?.ensName ?? null;
    }
    rxData = {
      items: rxRows[0].items as typeof rxData extends null ? never : NonNullable<typeof rxData>["items"],
      pharmacyEns,
      redemptionCode: rxRows[0].redemptionCode ?? null,
      status: rxRows[0].status,
    };
  }

  // Build timeline
  const currentIdx = STATUS_INDEX[order.status] ?? 0;
  const timeline = ORDER_PIPELINE.map((step, i) => ({
    label: step.label,
    state:
      i < currentIdx ? ("done" as const) : i === currentIdx ? ("current" as const) : ("pending" as const),
  }));

  // Compute display status
  const currentStep = ORDER_PIPELINE[currentIdx];
  const displayStatus = currentStep?.label ?? order.status;

  return (
    <div className="flex justify-center pt-5">
      <div className="border border-gray-200 rounded-lg bg-white/90 p-3.5 inline-block">
        <div className="px-1.5 pb-4">
          <p className="text-[10px] tracking-[0.22em] uppercase text-gray-500 flex items-center gap-2">
            <span className="inline-block w-5 h-px bg-black" />
            Patient Mini App
          </p>
          <h3 className="text-xl tracking-tight mt-3">
            Verified release surface
          </h3>
        </div>

        <div className="max-w-[310px] p-3 rounded-[34px] border border-black/10 bg-gray-900 shadow-lg">
          <div className="w-[120px] h-[5px] mx-auto mt-0.5 mb-4 rounded-full bg-white/20" />
          <div
            className="px-4 pt-4 pb-6 min-h-[540px] rounded-3xl"
            style={{
              background:
                "radial-gradient(circle at top, rgba(0,0,0,0.06), transparent 26%), linear-gradient(180deg, #fff 0%, #f5f5f5 100%)",
            }}
          >
            {/* Phone Header */}
            <div className="text-center mb-5 pb-3.5 border-b border-gray-200">
              <strong className="block text-[15px] tracking-wide uppercase">
                Pisgah
              </strong>
              <span className="text-xs text-gray-500">
                {order.patientName}
              </span>
            </div>

            <PatientMiniClient
              order={{
                testType: order.testType,
                displayStatus,
                timeline,
              }}
              plan={plan}
              prescription={rxData}
              orderId={order.id}
              amount={order.totalAmount ?? null}
              redemptionCode={rxData?.redemptionCode ?? null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
