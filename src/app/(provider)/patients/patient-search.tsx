"use client";

import { useState } from "react";

interface Patient {
  id: string;
  name: string;
  phone: string | null;
  createdAt: string | null;
  orderCount: number;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function PatientSearch({ patients }: { patients: Patient[] }) {
  const [query, setQuery] = useState("");

  const filtered = patients.filter((p) => {
    const q = query.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.phone && p.phone.toLowerCase().includes(q))
    );
  });

  return (
    <>
      <input
        type="text"
        placeholder="Search patients by name or phone..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50/80 text-sm outline-none transition-colors focus:border-gray-700 mb-3.5"
      />
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left text-[11px] tracking-wider uppercase text-gray-400 font-medium pb-2.5 px-3 border-b border-gray-200">
              Name
            </th>
            <th className="text-left text-[11px] tracking-wider uppercase text-gray-400 font-medium pb-2.5 px-3 border-b border-gray-200">
              Phone
            </th>
            <th className="text-left text-[11px] tracking-wider uppercase text-gray-400 font-medium pb-2.5 px-3 border-b border-gray-200">
              Registered
            </th>
            <th className="text-left text-[11px] tracking-wider uppercase text-gray-400 font-medium pb-2.5 px-3 border-b border-gray-200">
              Orders
            </th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((p) => (
            <tr
              key={p.id}
              className="cursor-pointer transition-colors hover:bg-black/[0.02]"
            >
              <td className="py-2.5 px-3 border-b border-gray-200 text-sm">
                <strong>{p.name}</strong>
              </td>
              <td className="py-2.5 px-3 border-b border-gray-200 text-sm">
                {p.phone ?? "-"}
              </td>
              <td className="py-2.5 px-3 border-b border-gray-200 text-sm">
                {formatDate(p.createdAt)}
              </td>
              <td className="py-2.5 px-3 border-b border-gray-200 text-sm">
                {p.orderCount}
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td
                colSpan={4}
                className="py-8 text-center text-sm text-gray-400"
              >
                No patients found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
