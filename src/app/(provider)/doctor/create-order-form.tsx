"use client";

import { useTransition, useState } from "react";
import { createOrder } from "@/app/actions";

interface Patient {
  id: string;
  name: string;
}

const TEST_TYPES = [
  "Complete Blood Count",
  "Malaria RDT",
  "Urinalysis",
  "Liver Function",
  "Renal Function",
] as const;

export function CreateOrderForm({ patients }: { patients: Patient[] }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await createOrder(formData);
      if (result.error) {
        setMessage(`Error: ${result.error}`);
      } else {
        setMessage("Order created successfully");
        setTimeout(() => setMessage(null), 3000);
      }
    });
  }

  return (
    <form action={handleSubmit}>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 max-sm:grid-cols-1">
        <div>
          <label className="block text-[11px] tracking-[0.14em] uppercase text-gray-500 mb-2">
            Patient
          </label>
          <select
            name="patientId"
            required
            className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50/80 text-sm outline-none transition-colors focus:border-gray-700"
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] tracking-[0.14em] uppercase text-gray-500 mb-2">
            Test Type
          </label>
          <select
            name="testType"
            required
            className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50/80 text-sm outline-none transition-colors focus:border-gray-700"
          >
            {TEST_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2 max-sm:col-span-1">
          <label className="block text-[11px] tracking-[0.14em] uppercase text-gray-500 mb-2">
            Clinical Notes
          </label>
          <textarea
            name="clinicalNotes"
            placeholder="Patient presents with..."
            className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50/80 text-sm outline-none transition-colors focus:border-gray-700 min-h-[80px] resize-y leading-relaxed"
          />
        </div>
        <div>
          <label className="block text-[11px] tracking-[0.14em] uppercase text-gray-500 mb-2">
            Assign Lab
          </label>
          <input
            className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-100 text-sm text-gray-500 cursor-default"
            value="Sunshine Diagnostics Lab"
            readOnly
          />
          <span className="block mt-1.5 font-mono text-xs text-gray-400">
            sunshinelab.pisgah.eth
          </span>
        </div>
        <div>
          <label className="block text-[11px] tracking-[0.14em] uppercase text-gray-500 mb-2">
            Amount
          </label>
          <div className="flex items-center border border-gray-200 rounded-md bg-gray-50/80 overflow-hidden">
            <span className="pl-3 pr-1 text-sm text-gray-500 shrink-0">
              &#8358;
            </span>
            <input
              type="number"
              name="amount"
              defaultValue={5000}
              required
              className="w-full px-2 py-2 border-none bg-transparent text-sm outline-none"
            />
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center px-4 py-2.5 rounded-md border border-black bg-black text-white text-xs tracking-widest uppercase font-medium hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-default"
        >
          {isPending ? "Creating..." : "Create Order"}
        </button>
        {message && (
          <span
            className={`text-sm ${message.startsWith("Error") ? "text-red-600" : "text-green-700"}`}
          >
            {message}
          </span>
        )}
      </div>
    </form>
  );
}
