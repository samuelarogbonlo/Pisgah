"use client";

import { useState, useTransition } from "react";
import { addTest, removeTest } from "@/app/actions";

export function TestCatalogManager({
  tests,
  facilities,
}: {
  tests: Array<{ id: string; testName: string; price: string; facilityName: string }>;
  facilities: Array<{ id: string; name: string }>;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleAdd(formData: FormData) {
    startTransition(async () => {
      setError(null);
      setSuccess(null);
      const result = await addTest(formData);
      if (!result.success) {
        setError(result.error ?? "Failed to add test");
      } else {
        setSuccess("Test added");
        setTimeout(() => setSuccess(null), 2000);
      }
    });
  }

  function handleRemove(testId: string) {
    startTransition(async () => {
      setError(null);
      const result = await removeTest(testId);
      if (!result.success) {
        setError(result.error ?? "Failed to remove test");
      }
    });
  }

  return (
    <div className="mt-4 space-y-4">
      {/* Add test form */}
      <form action={handleAdd} className="flex flex-wrap items-end gap-2 rounded-md border border-[#d8d8d2] p-3">
        <label className="block flex-1 min-w-[140px]">
          <span className="mb-1 block text-[10px] uppercase tracking-widest text-[#6d6d6d]">Test Name</span>
          <input
            name="testName"
            required
            placeholder="e.g. Complete Blood Count"
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black"
          />
        </label>
        <label className="block w-[120px]">
          <span className="mb-1 block text-[10px] uppercase tracking-widest text-[#6d6d6d]">Price (₦)</span>
          <input
            name="price"
            type="number"
            required
            min="0"
            placeholder="5000"
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black"
          />
        </label>
        <label className="block w-[180px]">
          <span className="mb-1 block text-[10px] uppercase tracking-widest text-[#6d6d6d]">Facility</span>
          <select
            name="facilityId"
            required
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black"
            defaultValue=""
          >
            <option value="" disabled>Select</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-black px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-white disabled:opacity-50"
        >
          {isPending ? "Adding..." : "Add Test"}
        </button>
      </form>

      {success && <p className="text-xs text-green-700">{success}</p>}
      {error && <p className="text-xs text-red-700">{error}</p>}

      {/* Test list */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#d8d8d2] text-left text-xs uppercase tracking-[0.1em] text-[#6d6d6d]">
            <th className="pb-2 font-medium">Test</th>
            <th className="pb-2 font-medium">Facility</th>
            <th className="pb-2 text-right font-medium">Price (₦)</th>
            <th className="pb-2 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {tests.map((t) => (
            <tr key={t.id} className="border-b border-[#d8d8d2]/50">
              <td className="py-2.5">{t.testName}</td>
              <td className="py-2.5 text-[#6d6d6d]">{t.facilityName}</td>
              <td className="py-2.5 text-right font-mono">₦{Number(t.price).toLocaleString()}</td>
              <td className="py-2.5 text-right">
                <button
                  onClick={() => handleRemove(t.id)}
                  disabled={isPending}
                  className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
          {tests.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-center text-[#6d6d6d]">
                No tests configured. Add your first test above.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
