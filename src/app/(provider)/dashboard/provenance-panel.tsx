"use client";

import { useEffect, useState } from "react";
import { getOrderProvenance, type OrderProvenance } from "./provenance-action";

const EAS_BASE_URL =
  "https://worldchain-sepolia.easscan.org/attestation/view";

function truncateUid(uid: string): string {
  if (uid.length <= 12) return uid;
  return `${uid.slice(0, 6)}...${uid.slice(-5)}`;
}

function ProvenanceRow({
  label,
  uid,
}: {
  label: string;
  uid: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-xs text-gray-600">{label}</span>
      {uid ? (
        <a
          href={`${EAS_BASE_URL}/${uid}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-mono text-[11px] text-gray-700 underline underline-offset-2 hover:text-black"
        >
          {truncateUid(uid)}
          <span className="text-[10px] text-gray-400">View on World Chain</span>
        </a>
      ) : (
        <span className="text-[11px] text-gray-400">Pending</span>
      )}
    </div>
  );
}

export function ProvenancePanel({ orderId }: { orderId: string }) {
  const [provenance, setProvenance] = useState<OrderProvenance | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getOrderProvenance(orderId).then(
      (data) => {
        if (!cancelled) setProvenance(data);
      },
      () => {
        if (!cancelled) setError(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (error) {
    return (
      <p className="text-xs text-red-500">Failed to load provenance data.</p>
    );
  }

  if (!provenance) {
    return <p className="text-xs text-gray-400">Loading provenance...</p>;
  }

  return (
    <div>
      <p className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-gray-500">
        Provenance
      </p>
      <div className="divide-y divide-gray-200">
        <ProvenanceRow label="Lab Result" uid={provenance.labResultUid} />
        <ProvenanceRow label="Prescription" uid={provenance.prescriptionUid} />
        <ProvenanceRow label="Delivery" uid={provenance.deliveryUid} />
      </div>
    </div>
  );
}
