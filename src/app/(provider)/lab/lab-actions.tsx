"use client";

import { useTransition, useState } from "react";
import { collectSample, uploadResult, updateResult } from "@/app/actions";

interface LabOrder {
  id: string;
  testType: string;
  status: string;
  patientName: string;
  clinicEns: string | null;
  resultId: string | null;
  rawText: string | null;
}

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    ROUTED_TO_LAB: "Received",
    SAMPLE_COLLECTED: "Sample Collected",
    RESULT_UPLOADED: "Result Uploaded",
    DOCTOR_REVIEW: "In Review",
  };
  return map[status] ?? status.replace(/_/g, " ");
}

function statusBadgeClass(status: string): string {
  if (status === "RESULT_UPLOADED" || status === "DOCTOR_REVIEW") {
    return "inline-block rounded-full px-2.5 py-1 text-[10px] tracking-widest uppercase font-semibold border border-green-700 text-green-700 bg-green-50";
  }
  return "inline-block rounded-full px-2.5 py-1 text-[10px] tracking-widest uppercase border border-gray-200 text-gray-500 bg-white";
}

function CollectButton({ orderId }: { orderId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(async () => { await collectSample(orderId); })}
      disabled={isPending}
      className="inline-flex items-center px-3 py-1.5 rounded-md border border-black bg-black text-white text-[11px] tracking-widest uppercase font-medium hover:bg-gray-800 transition-colors disabled:opacity-40"
    >
      {isPending ? "Collecting..." : "Collect Sample"}
    </button>
  );
}

function UploadButton({
  orderId,
  patientName,
  testType,
}: {
  orderId: string;
  patientName: string;
  testType: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [rawText, setRawText] = useState("");
  const [success, setSuccess] = useState(false);

  function handleSubmit() {
    startTransition(async () => {
      const result = await uploadResult(orderId, rawText);
      if (result.success) {
        setSuccess(true);
        setShowForm(false);
      }
    });
  }

  if (success) {
    return (
      <div className="mt-3 p-3.5 rounded-md border border-green-700 bg-green-50 flex items-center justify-between gap-3 flex-wrap">
        <span className="text-green-700 text-sm font-semibold">
          Result uploaded. AI draft will be generated.
        </span>
        <span className="inline-flex items-center gap-1.5 border border-gray-400 rounded-full px-3 py-2 text-[11px] text-gray-500 bg-white tracking-wide">
          <span className="w-2 h-2 rounded-full bg-green-700 inline-block" />
          Verified on World Chain
        </span>
      </div>
    );
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="inline-flex items-center px-3 py-1.5 rounded-md border border-black bg-black text-white text-[11px] tracking-widest uppercase font-medium hover:bg-gray-800 transition-colors"
      >
        Upload Result
      </button>
    );
  }

  return (
    <div className="border border-gray-200 rounded-md bg-white p-4 mt-3">
      <h3 className="text-xl tracking-tight mb-3">
        Upload Result
      </h3>
      <div className="mb-3">
        <label className="block text-[11px] tracking-[0.14em] uppercase text-gray-500 mb-2">
          Patient: {patientName} / {testType}
        </label>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="Enter raw result text..."
          className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50/80 text-sm outline-none transition-colors focus:border-gray-700 min-h-[100px] resize-y leading-relaxed"
        />
      </div>
      <button
        onClick={handleSubmit}
        disabled={isPending || !rawText.trim()}
        className="inline-flex items-center px-4 py-2.5 rounded-md border border-black bg-black text-white text-xs tracking-widest uppercase font-medium hover:bg-gray-800 transition-colors disabled:opacity-40"
      >
        {isPending ? "Submitting..." : "Submit Result"}
      </button>
    </div>
  );
}

function EditResultButton({
  resultId,
  currentRawText,
}: {
  resultId: string;
  currentRawText: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [rawText, setRawText] = useState(currentRawText);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function handleSubmit() {
    startTransition(async () => {
      const result = await updateResult(resultId, rawText);
      if (result.success) {
        setShowForm(false);
        setSuccessMessage("Result updated. AI draft will be regenerated.");
        setTimeout(() => setSuccessMessage(null), 5000);
      }
    });
  }

  if (successMessage) {
    return (
      <span className="text-green-700 text-sm font-semibold">{successMessage}</span>
    );
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="inline-flex items-center px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 text-[11px] tracking-widest uppercase font-medium hover:bg-gray-50 transition-colors"
      >
        Edit Result
      </button>
    );
  }

  return (
    <div className="border border-gray-200 rounded-md bg-white p-4 mt-3">
      <h3 className="text-sm tracking-tight mb-3 font-semibold">Edit Result</h3>
      <textarea
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50/80 text-sm outline-none transition-colors focus:border-gray-700 min-h-[100px] resize-y leading-relaxed mb-3"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={handleSubmit}
          disabled={isPending || !rawText.trim()}
          className="inline-flex items-center px-4 py-2 rounded-md border border-black bg-black text-white text-xs tracking-widest uppercase font-medium hover:bg-gray-800 transition-colors disabled:opacity-40"
        >
          {isPending ? "Saving..." : "Save Changes"}
        </button>
        <button
          onClick={() => {
            setShowForm(false);
            setRawText(currentRawText);
          }}
          className="inline-flex items-center px-4 py-2 rounded-md border border-gray-200 bg-white text-gray-600 text-xs tracking-widest uppercase font-medium hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function LabActions({ orders }: { orders: LabOrder[] }) {
  return (
    <>
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
              Referring Clinic
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
          {orders.map((order) => (
            <tr key={order.id}>
              <td className="py-2.5 px-3 border-b border-gray-200 text-sm">
                <strong>{order.patientName}</strong>
              </td>
              <td className="py-2.5 px-3 border-b border-gray-200 text-sm">
                {order.testType}
              </td>
              <td className="py-2.5 px-3 border-b border-gray-200 text-sm">
                {order.clinicEns && (
                  <span className="font-mono text-xs text-gray-400">
                    {order.clinicEns}
                  </span>
                )}
              </td>
              <td className="py-2.5 px-3 border-b border-gray-200 text-sm">
                <span className={statusBadgeClass(order.status)}>
                  {formatStatus(order.status)}
                </span>
              </td>
              <td className="py-2.5 border-b border-gray-200 text-right">
                {order.status === "ROUTED_TO_LAB" && (
                  <CollectButton orderId={order.id} />
                )}
                {order.status === "SAMPLE_COLLECTED" && (
                  <UploadButton
                    orderId={order.id}
                    patientName={order.patientName}
                    testType={order.testType}
                  />
                )}
                {(order.status === "RESULT_UPLOADED" || order.status === "DOCTOR_REVIEW") &&
                  order.resultId &&
                  order.rawText && (
                    <EditResultButton
                      resultId={order.resultId}
                      currentRawText={order.rawText}
                    />
                  )}
              </td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="py-8 text-center text-sm text-gray-400"
              >
                No incoming orders.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
