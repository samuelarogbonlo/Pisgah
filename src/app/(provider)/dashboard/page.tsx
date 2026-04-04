import { db } from "@/lib/db";
import {
  billingRecords,
  diagnosticOrders,
  facilityUsers,
  facilities,
  patients,
  prescriptions,
} from "@/lib/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { OrderTable } from "./order-table";
import { requireProviderSession } from "@/lib/auth/session";

type OrderStatus = typeof diagnosticOrders.$inferSelect["status"];
type PrescriptionStatus = typeof prescriptions.$inferSelect["status"];

type DashboardRow = {
  id: string;
  patientName: string;
  testType: string;
  doctorName: string;
  statusLabel: string;
  dateLabel: string;
  orderStatus: OrderStatus;
  updatedAt: Date | null;
};

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

function isSameDay(date: Date | null, target: Date) {
  if (!date) return false;

  return (
    date.getFullYear() === target.getFullYear() &&
    date.getMonth() === target.getMonth() &&
    date.getDate() === target.getDate()
  );
}

function displayStatusLabel(
  orderStatus: OrderStatus,
  prescriptionStatus: PrescriptionStatus | null
) {
  if (prescriptionStatus === "ready_for_pickup") {
    return "Ready for Pickup";
  }

  if (prescriptionStatus === "redeemed") {
    return "Dispensed";
  }

  if (prescriptionStatus === "sent_to_pharmacy") {
    return "Sent to Pharmacy";
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
  const session = await requireProviderSession();
  const isAdmin = session.role === "admin";

  const [orders, billingRows] = await Promise.all([
    (() => {
      const query = db
        .select({
          id: diagnosticOrders.id,
          patientName: patients.name,
          testType: diagnosticOrders.testType,
          doctorName: facilityUsers.name,
          orderStatus: diagnosticOrders.status,
          createdAt: diagnosticOrders.createdAt,
          updatedAt: diagnosticOrders.updatedAt,
          prescriptionStatus: prescriptions.status,
        })
        .from(diagnosticOrders)
        .innerJoin(patients, eq(diagnosticOrders.patientId, patients.id))
        .innerJoin(facilityUsers, eq(diagnosticOrders.doctorId, facilityUsers.id))
        .innerJoin(facilities, eq(diagnosticOrders.facilityId, facilities.id))
        .leftJoin(prescriptions, eq(prescriptions.orderId, diagnosticOrders.id));

      if (isAdmin) {
        return query.where(eq(facilities.hospitalId, session.hospitalId));
      }
      if (session.role === "lab_tech") {
        return query.where(eq(diagnosticOrders.labId, session.facilityId));
      }
      if (session.role === "pharmacist") {
        return query.where(eq(prescriptions.pharmacyId, session.facilityId));
      }
      if (session.role === "doctor") {
        return query.where(eq(diagnosticOrders.doctorId, session.facilityUserId));
      }
      return query.where(eq(diagnosticOrders.facilityId, session.facilityId));
    })(),
    (() => {
      const query = db
        .select({
          amount: billingRecords.amount,
          createdAt: billingRecords.createdAt,
        })
        .from(billingRecords)
        .innerJoin(
          diagnosticOrders,
          eq(billingRecords.orderId, diagnosticOrders.id),
        )
        .innerJoin(facilities, eq(diagnosticOrders.facilityId, facilities.id));

      if (isAdmin) {
        return query.where(eq(facilities.hospitalId, session.hospitalId));
      }
      return query.where(eq(diagnosticOrders.facilityId, session.facilityId));
    })(),
  ]);

  const rows: DashboardRow[] = orders.map((order) => ({
    id: order.id,
    patientName: order.patientName,
    testType: order.testType,
    doctorName: order.doctorName,
    statusLabel: displayStatusLabel(
      order.orderStatus,
      order.prescriptionStatus ?? null
    ),
    dateLabel: formatDateLabel(order.createdAt),
    orderStatus: order.orderStatus,
    updatedAt: order.updatedAt,
  }));

  const today = new Date();

  const activeCount = rows.filter((row) =>
    ["Doctor Review", "In Lab", "Awaiting Payment"].includes(row.statusLabel)
  ).length;

  const reviewCount = rows.filter(
    (row) => row.statusLabel === "Doctor Review"
  ).length;

  const completedTodayCount = rows.filter(
    (row) => row.orderStatus === "COMPLETED" && isSameDay(row.updatedAt, today)
  ).length;

  const hospitalFacilityIds = db.select({ id: facilities.id }).from(facilities).where(eq(facilities.hospitalId, session.hospitalId));
  const [patientCountResult] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(patients)
    .where(
      isAdmin
        ? inArray(patients.facilityId, hospitalFacilityIds)
        : eq(patients.facilityId, session.facilityId)
    );
  const totalPatients = patientCountResult?.count ?? 0;

  return (
    <div>
      <div className="mb-4">
        <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[#6d6d6d]">
          <span className="inline-block h-px w-5 bg-black" />
          Operational Dashboard
        </div>
        <h2 className="mt-3 text-[4.1rem] leading-[0.96] tracking-[-0.06em] max-md:text-[3rem]">
          Today at {isAdmin ? session.hospitalName : session.facilityName}
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
            {totalPatients}
          </strong>
          <span className="mt-2 block text-[14px] text-[#5f5f5b]">
            Total Patients
          </span>
        </div>
      </div>

      <div className="rounded-[8px] border border-[#d8d8d2] bg-white px-8 py-7 shadow-[0_18px_46px_rgba(0,0,0,0.08)] max-md:px-5 max-md:py-5">
        <h3 className="mb-5 text-[2.1rem] leading-none tracking-[-0.05em]">
          All Orders
        </h3>

        {rows.length > 0 ? (
          <OrderTable rows={rows} />
        ) : (
          <p className="text-sm text-gray-400 py-8 text-center">No orders yet</p>
        )}
      </div>
    </div>
  );
}
