"use client";

import { useRouter } from "next/navigation";

interface Bill {
  billingId: string;
  orderId: string;
  amount: string;
  status: string;
  confirmedAt: string | null;
  patientName: string;
  testType: string;
  createdAt: string | null;
  facilityName: string;
  latestProvider: string | null;
  latestReference: string | null;
  latestPaymentStatus: string | null;
  latestPaymentAt: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isToday) return "Today";

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();
  if (isYesterday) return "Yesterday";

  return d.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
  });
}

function statusLabel(status: string) {
  if (status === "cash_confirmed") {
    return {
      label: "Cash confirmed",
      className: "bg-green-50 text-green-700",
    };
  }

  if (status === "online_confirmed") {
    return {
      label: "Online confirmed",
      className: "bg-blue-50 text-blue-700",
    };
  }

  if (status === "failed") {
    return {
      label: "Payment failed",
      className: "bg-red-50 text-red-700",
    };
  }

  return {
    label: "Monitoring",
    className: "bg-amber-50 text-amber-700",
  };
}

function MonitoringPill({ status }: { status: string }) {
  const badge = statusLabel(status);

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] uppercase tracking-widest font-semibold ${badge.className}`}
    >
      {badge.label}
    </span>
  );
}

export function AccountsActions({ bills }: { bills: Bill[] }) {
  const router = useRouter();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          {bills.length} invoice{bills.length === 1 ? "" : "s"} currently tracked
        </p>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1.5 text-[11px] uppercase tracking-widest text-gray-600 hover:border-black hover:text-black transition-colors"
        >
          Refresh monitor
        </button>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left text-[11px] tracking-wider uppercase text-gray-400 font-medium pb-2.5 px-3 border-b border-gray-200">
              Patient
            </th>
            <th className="text-left text-[11px] tracking-wider uppercase text-gray-400 font-medium pb-2.5 px-3 border-b border-gray-200">
              Test
            </th>
            <th className="text-left text-[11px] tracking-wider uppercase text-gray-400 font-medium pb-2.5 px-3 border-b border-gray-200">
              Amount
            </th>
            <th className="text-left text-[11px] tracking-wider uppercase text-gray-400 font-medium pb-2.5 px-3 border-b border-gray-200">
              Attempt
            </th>
            <th className="text-left text-[11px] tracking-wider uppercase text-gray-400 font-medium pb-2.5 px-3 border-b border-gray-200">
              Age
            </th>
            <th className="text-right text-[11px] tracking-wider uppercase text-gray-400 font-medium pb-2.5 px-3 border-b border-gray-200">
              State
            </th>
          </tr>
        </thead>
        <tbody>
          {bills.map((bill) => (
            <tr key={bill.billingId}>
              <td className="py-2.5 px-3 border-b border-gray-200 text-sm">
                <strong>{bill.patientName}</strong>
                <div className="mt-0.5 text-[11px] text-gray-400">
                  {bill.facilityName}
                </div>
              </td>
              <td className="py-2.5 px-3 border-b border-gray-200 text-sm">
                {bill.testType}
              </td>
              <td className="py-2.5 px-3 border-b border-gray-200 text-sm">
                &#8358;{parseFloat(bill.amount).toLocaleString()}
              </td>
              <td className="py-2.5 px-3 border-b border-gray-200 text-sm">
                {bill.latestProvider ? (
                  <>
                    <div className="font-medium">
                      {bill.latestProvider === "opay" ? "OPay" : "World App"}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-gray-400">
                      {bill.latestReference}
                    </div>
                  </>
                ) : (
                  <span className="text-gray-400">No attempt yet</span>
                )}
              </td>
              <td className="py-2.5 px-3 border-b border-gray-200 text-sm">
                <div className="text-gray-700">{formatDate(bill.createdAt)}</div>
                {(bill.latestPaymentAt || bill.confirmedAt) && (
                  <div className="mt-0.5 text-[11px] text-gray-400">
                    Updated {formatDate(bill.latestPaymentAt ?? bill.confirmedAt)}
                  </div>
                )}
              </td>
              <td className="py-2.5 px-3 border-b border-gray-200 text-right">
                <div className="space-y-1">
                  <MonitoringPill status={bill.status} />
                  {bill.latestPaymentStatus && bill.status === "unpaid" && (
                    <div className="text-[10px] uppercase tracking-wider text-gray-400">
                      {bill.latestPaymentStatus.replace("_", " ")}
                    </div>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {bills.length === 0 && (
            <tr>
              <td colSpan={6} className="py-8 text-center text-sm text-gray-400">
                No bills are being tracked yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
