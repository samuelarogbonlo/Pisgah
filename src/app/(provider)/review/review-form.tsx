"use client";

import { useTransition, useState } from "react";
import { approveActionPlan } from "@/app/actions";

interface AiDraftShape {
  summary?: string;
  recommendations?: string;
  suggestedMedication?: {
    drugName?: string;
    dosage?: string;
    quantity?: string;
    instructions?: string;
  } | null;
}

interface ReviewFormProps {
  orderId: string;
  aiDraft: string;
}

function parseAiDraft(raw: string): AiDraftShape {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed as AiDraftShape;
  } catch {
    // Backward compat: treat raw text as summary only
    return { summary: raw };
  }
}

export function ReviewForm({ orderId, aiDraft }: ReviewFormProps) {
  const [isPending, startTransition] = useTransition();
  const [approved, setApproved] = useState(false);

  const draft = parseAiDraft(aiDraft);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await approveActionPlan(orderId, formData);
      if (result.success) {
        setApproved(true);
      }
    });
  }

  if (approved) {
    return (
      <div className="p-3.5 rounded-md border border-gray-200 bg-gray-50/80">
        <div className="p-3.5 rounded-md border border-green-700 bg-green-50 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-green-700 text-sm font-semibold">
            Action plan approved. Patient and pharmacy notified.
          </span>
          <span className="inline-flex items-center gap-1.5 border border-gray-400 rounded-full px-3 py-2 text-[11px] text-gray-500 bg-white tracking-wide">
            <span className="w-2 h-2 rounded-full bg-green-700 inline-block" />
            Verified on World Chain
          </span>
        </div>
      </div>
    );
  }

  return (
    <form
      action={handleSubmit}
      className="p-3.5 rounded-md border border-gray-200 bg-gray-50/80"
    >
      <h4 className="text-xs tracking-[0.16em] uppercase text-gray-500 mb-3">
        Doctor&apos;s Action Plan
      </h4>

      <div className="mb-3">
        <label className="block text-[11px] tracking-[0.14em] uppercase text-gray-500 mb-2">
          Summary
        </label>
        <textarea
          name="summary"
          defaultValue={draft.summary ?? ""}
          required
          className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white text-sm outline-none transition-colors focus:border-gray-700 min-h-[100px] resize-y leading-relaxed"
        />
      </div>

      <div className="mb-3">
        <label className="block text-[11px] tracking-[0.14em] uppercase text-gray-500 mb-2">
          Recommendations
        </label>
        <textarea
          name="recommendations"
          defaultValue={draft.recommendations ?? ""}
          required
          placeholder="1. Start medication...&#10;2. Dietary changes...&#10;3. Follow-up..."
          className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white text-sm outline-none transition-colors focus:border-gray-700 min-h-[80px] resize-y leading-relaxed"
        />
      </div>

      <div className="border-t border-gray-200 pt-4 mt-1">
        <h4 className="text-xs tracking-[0.16em] uppercase text-gray-500 mb-3.5">
          Prescription
        </h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 max-sm:grid-cols-1">
          <div>
            <label className="block text-[11px] tracking-[0.14em] uppercase text-gray-500 mb-2">
              Drug Name
            </label>
            <input
              type="text"
              name="drugName"
              defaultValue={draft.suggestedMedication?.drugName ?? ""}
              className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white text-sm outline-none transition-colors focus:border-gray-700"
            />
          </div>
          <div>
            <label className="block text-[11px] tracking-[0.14em] uppercase text-gray-500 mb-2">
              Dosage
            </label>
            <input
              type="text"
              name="dosage"
              defaultValue={draft.suggestedMedication?.dosage ?? ""}
              className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white text-sm outline-none transition-colors focus:border-gray-700"
            />
          </div>
          <div>
            <label className="block text-[11px] tracking-[0.14em] uppercase text-gray-500 mb-2">
              Quantity
            </label>
            <input
              type="text"
              name="quantity"
              defaultValue={draft.suggestedMedication?.quantity ?? ""}
              className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white text-sm outline-none transition-colors focus:border-gray-700"
            />
          </div>
          <div>
            <label className="block text-[11px] tracking-[0.14em] uppercase text-gray-500 mb-2">
              Instructions
            </label>
            <input
              type="text"
              name="instructions"
              defaultValue={draft.suggestedMedication?.instructions ?? ""}
              className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white text-sm outline-none transition-colors focus:border-gray-700"
            />
          </div>
        </div>
        <div className="mt-3">
          <label className="block text-[11px] tracking-[0.14em] uppercase text-gray-500 mb-2">
            Pharmacy
          </label>
          <input
            className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-100 text-sm text-gray-500 cursor-default"
            value="GreenLeaf Pharmacy"
            readOnly
          />
          <span className="block mt-1.5 font-mono text-xs text-gray-400">
            greenleaf.pisgah.eth
          </span>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-4 inline-flex items-center px-4 py-2.5 rounded-md border border-black bg-black text-white text-xs tracking-widest uppercase font-medium hover:bg-gray-800 transition-colors disabled:opacity-40"
      >
        {isPending ? "Approving..." : "Approve Action Plan"}
      </button>
    </form>
  );
}
