"use client";

import { useTransition, useState } from "react";
import { confirmDelivery } from "@/app/actions";

interface Delivery {
  prescriptionId: string;
  patientName: string;
  medication: string;
  pharmacyName: string;
  status: string;
}

function ConfirmDeliveryButton({
  prescriptionId,
}: {
  prescriptionId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirmed, setConfirmed] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (confirmed) {
    return (
      <span className="text-green-700 font-semibold text-[13px]">
        Delivered &#10003;
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          setError(null);
        }}
        placeholder="Redemption code"
        className="px-2 py-1.5 border border-gray-200 rounded-md bg-gray-50/80 text-sm outline-none transition-colors focus:border-gray-700 w-36"
      />
      <button
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await confirmDelivery(prescriptionId, code);
            if (result.error) {
              setError(result.error);
            } else {
              setConfirmed(true);
            }
          });
        }}
        disabled={isPending || !code.trim()}
        className="inline-flex items-center px-3 py-1.5 rounded-md border border-black bg-black text-white text-[11px] tracking-widest uppercase font-medium hover:bg-gray-800 transition-colors disabled:opacity-40 whitespace-nowrap"
      >
        {isPending ? "Confirming..." : "Confirm Delivery"}
      </button>
      {error && (
        <span className="text-red-600 text-sm">{error}</span>
      )}
    </div>
  );
}

export function RiderActions({
  deliveries,
}: {
  deliveries: Delivery[];
}) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th className="text-left text-[11px] tracking-wider uppercase text-gray-400 font-medium pb-2.5 px-3 border-b border-gray-200">
            Patient
          </th>
          <th className="text-left text-[11px] tracking-wider uppercase text-gray-400 font-medium pb-2.5 px-3 border-b border-gray-200">
            Medication
          </th>
          <th className="text-left text-[11px] tracking-wider uppercase text-gray-400 font-medium pb-2.5 px-3 border-b border-gray-200">
            Pharmacy
          </th>
          <th className="text-left text-[11px] tracking-wider uppercase text-gray-400 font-medium pb-2.5 px-3 border-b border-gray-200">
            Status
          </th>
          <th className="text-right text-[11px] tracking-wider uppercase text-gray-400 font-medium pb-2.5 border-b border-gray-200">
            Action
          </th>
        </tr>
      </thead>
      <tbody>
        {deliveries.map((d) => (
          <tr key={d.prescriptionId}>
            <td className="py-2.5 px-3 border-b border-gray-200 text-sm">
              <strong>{d.patientName}</strong>
            </td>
            <td className="py-2.5 px-3 border-b border-gray-200 text-sm">
              {d.medication}
            </td>
            <td className="py-2.5 px-3 border-b border-gray-200 text-sm">
              <span className="font-mono text-xs text-gray-400">
                {d.pharmacyName}
              </span>
            </td>
            <td className="py-2.5 px-3 border-b border-gray-200 text-sm">
              {d.status === "dispatched" && (
                <span className="inline-block rounded-full px-2.5 py-1 text-[10px] tracking-widest uppercase font-semibold border border-amber-600 text-amber-700 bg-amber-50">
                  Dispatched
                </span>
              )}
              {d.status === "delivered" && (
                <span className="inline-block rounded-full px-2.5 py-1 text-[10px] tracking-widest uppercase font-semibold border border-green-700 text-green-700 bg-green-50">
                  Delivered
                </span>
              )}
            </td>
            <td className="py-2.5 border-b border-gray-200 text-right">
              {d.status === "dispatched" && (
                <ConfirmDeliveryButton prescriptionId={d.prescriptionId} />
              )}
              {d.status === "delivered" && (
                <span className="inline-flex items-center gap-1.5 text-[13px] text-green-700 font-semibold">
                  Delivered &#10003;
                </span>
              )}
            </td>
          </tr>
        ))}
        {deliveries.length === 0 && (
          <tr>
            <td
              colSpan={5}
              className="py-8 text-center text-sm text-gray-400"
            >
              No active deliveries.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
