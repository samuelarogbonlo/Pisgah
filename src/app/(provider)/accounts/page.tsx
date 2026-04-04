import { db } from "@/lib/db";
import {
  billingRecords,
  diagnosticOrders,
  facilities,
  patients,
} from "@/lib/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { AccountsActions } from "./accounts-actions";
import { requireProviderSession } from "@/lib/auth/session";

export default async function AccountsPage() {
  const session = await requireProviderSession(["accounts", "admin"]);
  const isAdmin = session.role === "admin";
  const hospitalFacilityIds = db.select({ id: facilities.id }).from(facilities).where(eq(facilities.hospitalId, session.hospitalId));
  const facilityFilter = isAdmin
    ? inArray(diagnosticOrders.facilityId, hospitalFacilityIds)
    : eq(diagnosticOrders.facilityId, session.facilityId);

  const pendingBills = await db
    .select({
      billingId: billingRecords.id,
      orderId: billingRecords.orderId,
      amount: billingRecords.amount,
      billingStatus: billingRecords.status,
      billingCreatedAt: billingRecords.createdAt,
      patientName: patients.name,
      testType: diagnosticOrders.testType,
    })
    .from(billingRecords)
    .innerJoin(
      diagnosticOrders,
      eq(billingRecords.orderId, diagnosticOrders.id)
    )
    .innerJoin(patients, eq(diagnosticOrders.patientId, patients.id))
    .where(
      and(
        eq(billingRecords.status, "unpaid"),
        facilityFilter,
      ),
    )
    .orderBy(sql`${billingRecords.createdAt} desc`);

  const allBills = await db
    .select({
      amount: billingRecords.amount,
      status: billingRecords.status,
    })
    .from(billingRecords)
    .innerJoin(
      diagnosticOrders,
      eq(billingRecords.orderId, diagnosticOrders.id),
    )
    .where(facilityFilter);

  const totalBilled = allBills.reduce(
    (sum, b) => sum + parseFloat(b.amount || "0"),
    0
  );
  const totalConfirmed = allBills
    .filter(
      (b) => b.status === "cash_confirmed" || b.status === "online_confirmed"
    )
    .reduce((sum, b) => sum + parseFloat(b.amount || "0"), 0);

  const serialized = pendingBills.map((b) => ({
    billingId: b.billingId,
    orderId: b.orderId,
    amount: b.amount,
    patientName: b.patientName,
    testType: b.testType,
    createdAt: b.billingCreatedAt?.toISOString() ?? null,
  }));

  return (
    <div>
      <div className="mb-4">
        <p className="text-[10px] tracking-[0.22em] uppercase text-gray-500 flex items-center gap-2">
          <span className="inline-block w-5 h-px bg-black" />
          Accounts Desk
        </p>
        <h2 className="text-3xl tracking-tight leading-none mt-3">
          {session.name}
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          {session.facilityName}
        </p>
      </div>

      <div className="border border-gray-200 rounded-md bg-white p-4">
        <h3 className="text-xl tracking-tight mb-3">
          Pending Payments
        </h3>
        <AccountsActions bills={serialized} />

        <div className="mt-4 p-3.5 rounded-md border border-gray-200 bg-gray-50/80">
          <div className="flex justify-between py-2 text-sm">
            <span>Total Billed</span>
            <strong>
              &#8358;{totalBilled.toLocaleString()}
            </strong>
          </div>
          <div className="flex justify-between py-2 text-sm border-t border-gray-200">
            <span>Confirmed</span>
            <strong className="text-green-700">
              &#8358;{totalConfirmed.toLocaleString()}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
}
