"use client";

import { useTransition } from "react";
import { confirmPayment } from "@/app/actions";
import { Spinner } from "@/components/ui/spinner";

interface Bill {
  billingId: string;
  orderId: string;
  amount: string;
  patientName: string;
  testType: string;
  createdAt: string | null;
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

function ConfirmButton({ billingId }: { billingId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await confirmPayment(billingId);
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-black bg-black text-white text-[11px] tracking-widest uppercase font-medium hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-default"
    >
      {isPending ? <><Spinner /> Confirming...</> : "Confirm Payment"}
    </button>
  );
}

export function AccountsActions({ bills }: { bills: Bill[] }) {
  return (
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
            Date
          </th>
          <th className="text-right text-[11px] tracking-wider uppercase text-gray-400 font-medium pb-2.5 border-b border-gray-200">
            Action
          </th>
        </tr>
      </thead>
      <tbody>
        {bills.map((bill) => (
          <tr key={bill.billingId}>
            <td className="py-2.5 px-3 border-b border-gray-200 text-sm">
              <strong>{bill.patientName}</strong>
            </td>
            <td className="py-2.5 px-3 border-b border-gray-200 text-sm">
              {bill.testType}
            </td>
            <td className="py-2.5 px-3 border-b border-gray-200 text-sm">
              &#8358;{parseFloat(bill.amount).toLocaleString()}
            </td>
            <td className="py-2.5 px-3 border-b border-gray-200 text-sm">
              {formatDate(bill.createdAt)}
            </td>
            <td className="py-2.5 border-b border-gray-200 text-right">
              <ConfirmButton billingId={bill.billingId} />
            </td>
          </tr>
        ))}
        {bills.length === 0 && (
          <tr>
            <td
              colSpan={5}
              className="py-8 text-center text-sm text-gray-400"
            >
              No pending bills.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
