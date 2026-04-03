"use client";

import { useTransition, useState } from "react";
import { redeemPrescription } from "@/app/actions";

interface Prescription {
  prescriptionId: string;
  orderId: string;
  status: string;
  attestationUid: string | null;
  redemptionCode: string | null;
  patientName: string;
  clinicEns: string | null;
  doctorName: string;
  medication: string;
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    issued: "Issued",
    sent_to_pharmacy: "Sent to Pharmacy",
    ready_for_pickup: "Ready for Pickup",
    fulfilled: "Dispensed",
    redeemed: "Redeemed",
  };
  return map[status] ?? status;
}

function statusBadgeClass(status: string): string {
  if (status === "fulfilled" || status === "redeemed") {
    return "inline-block rounded-full px-2.5 py-1 text-[10px] tracking-widest uppercase font-semibold border border-green-700 text-green-700 bg-green-50";
  }
  return "inline-block rounded-full px-2.5 py-1 text-[10px] tracking-widest uppercase border border-gray-200 text-gray-500 bg-white";
}

function RedeemButton({
  prescriptionId,
}: {
  prescriptionId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [dispensed, setDispensed] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (dispensed) {
    return (
      <span className="text-green-700 font-semibold text-[13px]">
        Dispensed &#10003;
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
            const result = await redeemPrescription(code);
            if (result.error) {
              setError(result.error);
            } else {
              setDispensed(true);
            }
          });
        }}
        disabled={isPending || !code.trim()}
        className="inline-flex items-center px-3 py-1.5 rounded-md border border-black bg-black text-white text-[11px] tracking-widest uppercase font-medium hover:bg-gray-800 transition-colors disabled:opacity-40 whitespace-nowrap"
      >
        {isPending ? "Verifying..." : "Verify & Dispense"}
      </button>
      {error && (
        <span className="text-red-600 text-sm">{error}</span>
      )}
    </div>
  );
}

export function PharmacyActions({
  prescriptions,
}: {
  prescriptions: Prescription[];
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
            Doctor
          </th>
          <th className="text-left text-[11px] tracking-wider uppercase text-gray-400 font-medium pb-2.5 px-3 border-b border-gray-200">
            Facility
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
        {prescriptions.map((rx) => (
          <tr key={rx.prescriptionId}>
            <td className="py-2.5 px-3 border-b border-gray-200 text-sm">
              <strong>{rx.patientName}</strong>
            </td>
            <td className="py-2.5 px-3 border-b border-gray-200 text-sm">
              {rx.medication}
            </td>
            <td className="py-2.5 px-3 border-b border-gray-200 text-sm">
              {rx.doctorName}
            </td>
            <td className="py-2.5 px-3 border-b border-gray-200 text-sm">
              {rx.clinicEns && (
                <span className="font-mono text-xs text-gray-400">
                  {rx.clinicEns}
                </span>
              )}
            </td>
            <td className="py-2.5 px-3 border-b border-gray-200 text-sm">
              <span className={statusBadgeClass(rx.status)}>
                {statusLabel(rx.status)}
                {rx.status === "fulfilled" && " \u2713"}
              </span>
              {rx.attestationUid && (
                <span className="ml-2 inline-flex items-center gap-1.5 text-[11px] text-gray-500">
                  <span className="w-2 h-2 rounded-full bg-green-700 inline-block" />
                  World Chain
                </span>
              )}
            </td>
            <td className="py-2.5 border-b border-gray-200 text-right">
              {rx.status !== "fulfilled" && rx.status !== "redeemed" && (
                <RedeemButton prescriptionId={rx.prescriptionId} />
              )}
              {(rx.status === "fulfilled" || rx.status === "redeemed") && (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
                  <span className="w-2 h-2 rounded-full bg-green-700 inline-block" />
                  Verified on World Chain
                </span>
              )}
            </td>
          </tr>
        ))}
        {prescriptions.length === 0 && (
          <tr>
            <td
              colSpan={6}
              className="py-8 text-center text-sm text-gray-400"
            >
              No pending prescriptions.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
