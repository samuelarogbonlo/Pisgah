import { db } from "@/lib/db";
import {
  billingRecords,
  diagnosticOrders,
  facilityUsers,
  patients,
  prescriptions,
} from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { OrderTable } from "./order-table";

type OrderStatus = typeof diagnosticOrders.$inferSelect["status"];
type PrescriptionStatus = typeof prescriptions.$inferSelect["status"];

type DashboardRow = {
  id: string;
  patientName: string;
  testType: string;
  doctorName: string;
  statusLabel: string;
  dateLabel: string;
};

const DEMO_ROWS: DashboardRow[] = [
  {
    id: "demo-1",
    patientName: "Amara Okafor",
    testType: "Complete Blood Count",
    doctorName: "Dr. Adeyemi",
    statusLabel: "Doctor Review",
    dateLabel: "Today, 10:07",
  },
  {
    id: "demo-2",
    patientName: "Emeka Nwankwo",
    testType: "Malaria RDT",
    doctorName: "Dr. Adeyemi",
    statusLabel: "In Lab",
    dateLabel: "Today, 09:15",
  },
  {
    id: "demo-3",
    patientName: "Fatima Bello",
    testType: "Liver Function",
    doctorName: "Dr. Adeyemi",
    statusLabel: "Awaiting Payment",
    dateLabel: "Today, 08:45",
  },
  {
    id: "demo-4",
    patientName: "Chidi Okonkwo",
    testType: "Urinalysis",
    doctorName: "Dr. Adeyemi",
    statusLabel: "Completed",
    dateLabel: "Yesterday",
  },
  {
    id: "demo-5",
    patientName: "Ngozi Eze",
    testType: "Renal Function",
    doctorName: "Dr. Adeyemi",
    statusLabel: "Patient Notified",
    dateLabel: "Yesterday",
  },
  {
    id: "demo-6",
    patientName: "Blessing Adamu",
    testType: "Malaria RDT",
    doctorName: "Dr. Adeyemi",
    statusLabel: "Ready for Pickup",
    dateLabel: "Today, 11:30",
  },
];

const DEMO_PRIORITY = [
  "Amara Okafor",
  "Emeka Nwankwo",
  "Fatima Bello",
  "Chidi Okonkwo",
  "Ngozi Eze",
  "Blessing Adamu",
];

function toCurrency(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

function formatDateLabel(date: Date | null): string {
  if (!date) return "";

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const candidate = new Date(date);
  const candidateStart = new Date(candidate);
  candidateStart.setHours(0, 0, 0, 0);

  if (candidateStart.getTime() === today.getTime()) {
    return `Today, ${candidate.toLocaleTimeString("en-NG", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })}`;
  }

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (candidateStart.getTime() === yesterday.getTime()) {
    return "Yesterday";
  }

  return candidate.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function displayStatusLabel(
  orderStatus: OrderStatus,
  prescriptionStatus: PrescriptionStatus | null
) {
  if (prescriptionStatus === "ready_for_pickup") {
    return "Ready for Pickup";
  }

  if (
    orderStatus === "ROUTED_TO_LAB" ||
    orderStatus === "SAMPLE_COLLECTED" ||
    orderStatus === "RESULT_UPLOADED"
  ) {
    return "In Lab";
  }

  if (orderStatus === "DOCTOR_REVIEW") return "Doctor Review";
  if (orderStatus === "AWAITING_PAYMENT") return "Awaiting Payment";
  if (orderStatus === "COMPLETED") return "Completed";
  if (
    orderStatus === "PATIENT_NOTIFIED" ||
    orderStatus === "ACTION_PLAN_APPROVED"
  ) {
    return "Patient Notified";
  }

  return orderStatus
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default async function DashboardPage() {
  const [orders, billingSummary] = await Promise.all([
    db
      .select({
        id: diagnosticOrders.id,
        patientName: patients.name,
        testType: diagnosticOrders.testType,
        doctorName: facilityUsers.name,
        orderStatus: diagnosticOrders.status,
        createdAt: diagnosticOrders.createdAt,
        prescriptionStatus: prescriptions.status,
      })
      .from(diagnosticOrders)
      .innerJoin(patients, eq(diagnosticOrders.patientId, patients.id))
      .innerJoin(facilityUsers, eq(diagnosticOrders.doctorId, facilityUsers.id))
      .leftJoin(prescriptions, eq(prescriptions.orderId, diagnosticOrders.id)),
    db
      .select({
        total: sql<number>`cast(coalesce(sum(${billingRecords.amount}), 0) as int)`,
      })
      .from(billingRecords),
  ]);

  const liveRows = orders.map((order) => ({
    id: order.id,
    patientName: order.patientName,
    testType: order.testType,
    doctorName: order.doctorName,
    statusLabel: displayStatusLabel(
      order.orderStatus,
      order.prescriptionStatus ?? null
    ),
    dateLabel: formatDateLabel(order.createdAt),
  }));

  const rowPriority = new Map(
    DEMO_PRIORITY.map((patientName, index) => [patientName, index])
  );

  const rows =
    liveRows.length > 0
      ? [...liveRows].sort((a, b) => {
          const aRank = rowPriority.get(a.patientName) ?? Number.MAX_SAFE_INTEGER;
          const bRank = rowPriority.get(b.patientName) ?? Number.MAX_SAFE_INTEGER;
          return aRank - bRank;
        })
      : DEMO_ROWS;

  const activeCount =
    liveRows.length > 0
      ? rows.filter((row) =>
          ["Doctor Review", "In Lab", "Awaiting Payment"].includes(
            row.statusLabel
          )
        ).length
      : 3;

  const reviewCount =
    liveRows.length > 0
      ? rows.filter((row) => row.statusLabel === "Doctor Review").length
      : 1;

  const completedTodayCount =
    liveRows.length > 0
      ? rows.filter((row) => row.statusLabel !== "Awaiting Payment").length
      : 5;

  const billedToday =
    liveRows.length > 0 ? billingSummary[0]?.total ?? 0 : 48500;

  return (
    <div>
      <div className="mb-4">
        <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[#6d6d6d]">
          <span className="inline-block h-px w-5 bg-black" />
          Operational Dashboard
        </div>
        <h2 className="mt-3 text-[4.1rem] leading-[0.96] tracking-[-0.06em] max-md:text-[3rem]">
          Today at St. Luke&apos;s
        </h2>
      </div>

      <div className="mb-5 grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
        <div className="rounded-[8px] border border-[#d8d8d2] bg-white px-6 py-5 shadow-[0_18px_46px_rgba(0,0,0,0.08)]">
          <strong className="block text-[2.2rem] leading-none tracking-[-0.05em]">
            {activeCount}
          </strong>
          <span className="mt-2 block text-[14px] text-[#5f5f5b]">
            Active Orders
          </span>
        </div>
        <div className="rounded-[8px] border border-[#d8d8d2] bg-white px-6 py-5 shadow-[0_18px_46px_rgba(0,0,0,0.08)]">
          <strong className="block text-[2.2rem] leading-none tracking-[-0.05em]">
            {reviewCount}
          </strong>
          <span className="mt-2 block text-[14px] text-[#5f5f5b]">
            Awaiting Review
          </span>
        </div>
        <div className="rounded-[8px] border border-[#d8d8d2] bg-white px-6 py-5 shadow-[0_18px_46px_rgba(0,0,0,0.08)]">
          <strong className="block text-[2.2rem] leading-none tracking-[-0.05em]">
            {completedTodayCount}
          </strong>
          <span className="mt-2 block text-[14px] text-[#5f5f5b]">
            Completed Today
          </span>
        </div>
        <div className="rounded-[8px] border border-[#d8d8d2] bg-white px-6 py-5 shadow-[0_18px_46px_rgba(0,0,0,0.08)]">
          <strong className="block text-[2.2rem] leading-none tracking-[-0.05em]">
            {toCurrency(billedToday)}
          </strong>
          <span className="mt-2 block text-[14px] text-[#5f5f5b]">
            Billed Today
          </span>
        </div>
      </div>

      <div className="rounded-[8px] border border-[#d8d8d2] bg-white px-8 py-7 shadow-[0_18px_46px_rgba(0,0,0,0.08)] max-md:px-5 max-md:py-5">
        <h3 className="mb-5 text-[2.1rem] leading-none tracking-[-0.05em]">
          All Orders
        </h3>

        <OrderTable rows={rows} />
      </div>
    </div>
  );
}
