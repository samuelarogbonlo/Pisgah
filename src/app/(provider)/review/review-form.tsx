"use client";

import { useState, useTransition } from "react";
import { approveActionPlan } from "@/app/actions";
import {
  parseAgentDraftEnvelope,
  type AgentDraftProvenance,
} from "@/lib/agent";

interface ReviewFormProps {
  orderId: string;
  aiDraft: string | null;
  provenance: AgentDraftProvenance | null;
  pharmacyName: string;
  pharmacyEns: string | null;
}

export function ReviewForm({
  orderId,
  aiDraft,
  provenance,
  pharmacyName,
  pharmacyEns,
}: ReviewFormProps) {
  const [isPending, startTransition] = useTransition();
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseAgentDraftEnvelope(aiDraft);
  const draft = parsed.draft;

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      setError(null);
      const result = await approveActionPlan(orderId, formData);
      if (!result.success) {
        setError(result.error ?? "Unable to approve action plan");
        return;
      }

      setApproved(true);
    });
  }

  if (approved) {
    return (
      <div className="rounded-md border border-gray-200 bg-gray-50/80 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-green-700 bg-green-50 p-3.5">
          <span className="text-sm font-semibold text-green-700">
            Action plan approved. Patient and pharmacy notified.
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-400 bg-white px-3 py-2 text-[11px] tracking-wide text-gray-500">
            <span className="inline-block h-2 w-2 rounded-full bg-green-700" />
            Verified workflow
          </span>
        </div>
      </div>
    );
  }

  return (
    <form
      action={handleSubmit}
      className="rounded-md border border-gray-200 bg-gray-50/80 p-3.5"
    >
      <h4 className="mb-3 text-xs uppercase tracking-[0.16em] text-gray-500">
        Doctor&apos;s Action Plan
      </h4>

      {!aiDraft && (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
          <strong className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-amber-800">
            Manual review
          </strong>
          No verified assistant draft is attached to this case. Complete the
          action plan directly.
        </div>
      )}

      <div className="mb-3">
        <label className="mb-2 block text-[11px] uppercase tracking-[0.14em] text-gray-500">
          Summary
        </label>
        <textarea
          name="summary"
          defaultValue={draft.summary ?? ""}
          required
          className="min-h-[100px] w-full resize-y rounded-md border border-gray-200 bg-white px-3 py-2 text-sm leading-relaxed outline-none transition-colors focus:border-gray-700"
        />
      </div>

      <div className="mb-3">
        <label className="mb-2 block text-[11px] uppercase tracking-[0.14em] text-gray-500">
          Recommendations
        </label>
        <textarea
          name="recommendations"
          defaultValue={draft.recommendations ?? ""}
          required
          placeholder={"1. Start medication...\n2. Dietary changes...\n3. Follow-up..."}
          className="min-h-[80px] w-full resize-y rounded-md border border-gray-200 bg-white px-3 py-2 text-sm leading-relaxed outline-none transition-colors focus:border-gray-700"
        />
      </div>

      <div className="mt-1 border-t border-gray-200 pt-4">
        <h4 className="mb-3.5 text-xs uppercase tracking-[0.16em] text-gray-500">
          Prescription
        </h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 max-sm:grid-cols-1">
          <div>
            <label className="mb-2 block text-[11px] uppercase tracking-[0.14em] text-gray-500">
              Drug Name
            </label>
            <input
              type="text"
              name="drugName"
              defaultValue={draft.suggestedMedication?.drugName ?? ""}
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-gray-700"
            />
          </div>
          <div>
            <label className="mb-2 block text-[11px] uppercase tracking-[0.14em] text-gray-500">
              Dosage
            </label>
            <input
              type="text"
              name="dosage"
              defaultValue={draft.suggestedMedication?.dosage ?? ""}
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-gray-700"
            />
          </div>
          <div>
            <label className="mb-2 block text-[11px] uppercase tracking-[0.14em] text-gray-500">
              Quantity
            </label>
            <input
              type="text"
              name="quantity"
              defaultValue={draft.suggestedMedication?.quantity ?? ""}
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-gray-700"
            />
          </div>
          <div>
            <label className="mb-2 block text-[11px] uppercase tracking-[0.14em] text-gray-500">
              Instructions
            </label>
            <input
              type="text"
              name="instructions"
              defaultValue={draft.suggestedMedication?.instructions ?? ""}
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-gray-700"
            />
          </div>
        </div>

        <div className="mt-3">
          <label className="mb-2 block text-[11px] uppercase tracking-[0.14em] text-gray-500">
            Pharmacy
          </label>
          <input
            className="w-full cursor-default rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-500"
            value={pharmacyName}
            readOnly
          />
          <span className="mt-1.5 block font-mono text-xs text-gray-400">
            {pharmacyEns ?? "ENS pending"}
          </span>
        </div>
      </div>

      {provenance?.verified && (
        <div className="mt-4 rounded-md border border-gray-200 bg-white px-3 py-2.5 text-xs leading-relaxed text-gray-600">
          <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-gray-500">
            Draft Provenance
          </p>
          <p className="font-mono text-[11px] break-all text-gray-700">
            {provenance.agentEnsName ?? "ENS name unavailable"}
          </p>
          <p className="mt-1 font-mono text-[11px] break-all text-gray-500">
            {provenance.agentAddress}
          </p>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="mt-4 inline-flex items-center rounded-md border border-black bg-black px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-white transition-colors hover:bg-gray-800 disabled:opacity-40"
      >
        {isPending ? "Approving..." : "Approve Action Plan"}
      </button>
    </form>
  );
}
