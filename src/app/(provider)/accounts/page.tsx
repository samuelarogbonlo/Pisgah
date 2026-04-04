import { db } from "@/lib/db";
import {
  billingRecords,
  diagnosticOrders,
  facilities,
  hospitalPaymentSettings,
  patients,
  paymentTransactions,
} from "@/lib/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { AccountsActions } from "./accounts-actions";
import { requireProviderSession } from "@/lib/auth/session";

export default async function AccountsPage() {
  const session = await requireProviderSession(["accounts", "admin"]);
  const allBills = await db
    .select({
      billingId: billingRecords.id,
      orderId: billingRecords.orderId,
      amount: billingRecords.amount,
      billingStatus: billingRecords.status,
      confirmedAt: billingRecords.confirmedAt,
      billingCreatedAt: billingRecords.createdAt,
      patientName: patients.name,
      testType: diagnosticOrders.testType,
      facilityName: facilities.name,
    })
    .from(billingRecords)
    .innerJoin(
      diagnosticOrders,
      eq(billingRecords.orderId, diagnosticOrders.id)
    )
    .innerJoin(patients, eq(diagnosticOrders.patientId, patients.id))
    .innerJoin(facilities, eq(diagnosticOrders.facilityId, facilities.id))
    .where(
      session.role === "admin"
        ? eq(facilities.hospitalId, session.hospitalId)
        : and(
            eq(facilities.hospitalId, session.hospitalId),
            eq(diagnosticOrders.facilityId, session.facilityId),
          ),
    )
    .orderBy(sql`${billingRecords.createdAt} desc`);

  const billingIds = allBills.map((bill) => bill.billingId);
  const latestTransactions = billingIds.length
    ? await db
        .select({
          billingId: paymentTransactions.billingRecordId,
          provider: paymentTransactions.provider,
          providerReference: paymentTransactions.providerReference,
          status: paymentTransactions.status,
          createdAt: paymentTransactions.createdAt,
          finalizedAt: paymentTransactions.finalizedAt,
        })
        .from(paymentTransactions)
        .where(inArray(paymentTransactions.billingRecordId, billingIds))
        .orderBy(desc(paymentTransactions.createdAt))
    : [];

  const latestTransactionByBill = new Map<
    string,
    {
      provider: string;
      providerReference: string;
      status: string;
      createdAt: Date | null;
      finalizedAt: Date | null;
    }
  >();

  for (const transaction of latestTransactions) {
    if (!latestTransactionByBill.has(transaction.billingId)) {
      latestTransactionByBill.set(transaction.billingId, {
        provider: transaction.provider,
        providerReference: transaction.providerReference,
        status: transaction.status,
        createdAt: transaction.createdAt,
        finalizedAt: transaction.finalizedAt,
      });
    }
  }

  const totalBilled = allBills.reduce(
    (sum, b) => sum + parseFloat(b.amount || "0"),
    0
  );
  const totalConfirmed = allBills
    .filter(
      (b) =>
        b.billingStatus === "cash_confirmed" ||
        b.billingStatus === "online_confirmed",
    )
    .reduce((sum, b) => sum + parseFloat(b.amount || "0"), 0);
  const openBills = allBills.filter((bill) => bill.billingStatus === "unpaid");
  const confirmedBills = allBills.filter(
    (bill) =>
      bill.billingStatus === "cash_confirmed" ||
      bill.billingStatus === "online_confirmed",
  );

  const [paymentSettings] = await db
    .select({
      opayEnabled: hospitalPaymentSettings.opayEnabled,
      opayMerchantId: hospitalPaymentSettings.opayMerchantId,
      worldPayEnabled: hospitalPaymentSettings.worldPayEnabled,
    })
    .from(hospitalPaymentSettings)
    .where(eq(hospitalPaymentSettings.hospitalId, session.hospitalId))
    .limit(1);

  const serialized = allBills.map((b) => ({
    billingId: b.billingId,
    orderId: b.orderId,
    amount: b.amount,
    status: b.billingStatus,
    confirmedAt: b.confirmedAt?.toISOString() ?? null,
    patientName: b.patientName,
    testType: b.testType,
    createdAt: b.billingCreatedAt?.toISOString() ?? null,
    facilityName: b.facilityName,
    latestProvider: latestTransactionByBill.get(b.billingId)?.provider ?? null,
    latestReference: latestTransactionByBill.get(b.billingId)?.providerReference ?? null,
    latestPaymentStatus: latestTransactionByBill.get(b.billingId)?.status ?? null,
    latestPaymentAt:
      latestTransactionByBill.get(b.billingId)?.finalizedAt?.toISOString() ??
      latestTransactionByBill.get(b.billingId)?.createdAt?.toISOString() ??
      null,
  }));

  const worldRecipientAddress =
    process.env.WORLD_PAYMENT_RECIPIENT_ADDRESS?.trim() || null;

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

      <div className="grid gap-4 md:grid-cols-3 mb-4">
        <div className="rounded-md border border-gray-200 bg-white p-4">
          <p className="text-[10px] tracking-[0.22em] uppercase text-gray-500">
            Open invoices
          </p>
          <p className="mt-2 text-2xl tracking-tight">
            {openBills.length}
          </p>
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-4">
          <p className="text-[10px] tracking-[0.22em] uppercase text-gray-500">
            Confirmed
          </p>
          <p className="mt-2 text-2xl tracking-tight">
            {confirmedBills.length}
          </p>
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-4">
          <p className="text-[10px] tracking-[0.22em] uppercase text-gray-500">
            Total tracked
          </p>
          <p className="mt-2 text-2xl tracking-tight">
            &#8358;{totalBilled.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="border border-gray-200 rounded-md bg-white p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-xl tracking-tight">
              Payment Monitoring
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Manual cash confirmation is disabled here. This desk now monitors
              invoice state changes and settlement records.
            </p>
          </div>
        </div>
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

      <div className="mt-4 border border-gray-200 rounded-md bg-white p-4">
        <h3 className="text-xl tracking-tight mb-3">
          Payment Configuration
        </h3>
        <p className="mb-4 text-sm text-gray-500">
          This surface monitors the hospital payment rails enabled in Settings.
          Patients only see methods that are enabled for this hospital.
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-gray-200 p-4">
            <p className="text-[10px] tracking-[0.22em] uppercase text-gray-500">
              OPay
            </p>
            <p className="mt-2 text-sm font-semibold">
              {paymentSettings?.opayEnabled ? "Enabled" : "Disabled"}
            </p>
            <p className="mt-1 break-all font-mono text-[11px] text-gray-500">
              {paymentSettings?.opayMerchantId ?? "No merchant ID saved"}
            </p>
          </div>
          <div className="rounded-md border border-gray-200 p-4">
            <p className="text-[10px] tracking-[0.22em] uppercase text-gray-500">
              World App Pay
            </p>
            <p className="mt-2 text-sm font-semibold">
              {paymentSettings?.worldPayEnabled ? "Enabled" : "Disabled"}
            </p>
            <p className="mt-1 text-[11px] text-gray-500">
              Uses the deployment settlement wallet configured on the server.
            </p>
          </div>
          <div className="rounded-md border border-gray-200 p-4">
            <p className="text-[10px] tracking-[0.22em] uppercase text-gray-500">
              Settlement wallet
            </p>
            <p className="mt-2 break-all font-mono text-[11px] text-gray-500">
              {worldRecipientAddress ?? "WORLD_PAYMENT_RECIPIENT_ADDRESS missing"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
