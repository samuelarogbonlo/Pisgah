"use client";

import { Fragment, useState } from "react";
import { TimelinePanel } from "./timeline-panel";

type OrderRow = {
  id: string;
  patientName: string;
  testType: string;
  doctorName: string;
  statusLabel: string;
  dateLabel: string;
};

function statusBadgeClass(statusLabel: string) {
  if (statusLabel === "Doctor Review") {
    return "inline-flex rounded-full border border-[#d69e2e] bg-[#fefcbf] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a6a00]";
  }
  if (statusLabel === "Completed") {
    return "inline-flex rounded-full border border-[#d8d8d2] bg-[#f7f7f5] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#8a8a84]";
  }
  return "inline-flex rounded-full border border-[#d8d8d2] bg-white px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#7a7a74]";
}

export function OrderTable({ rows }: { rows: OrderRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="border-b border-[#d8d8d2] pb-4 pr-4 text-left text-[11px] font-medium uppercase tracking-[0.2em] text-[#777771]">
              Patient
            </th>
            <th className="border-b border-[#d8d8d2] pb-4 pr-4 text-left text-[11px] font-medium uppercase tracking-[0.2em] text-[#777771]">
              Test Type
            </th>
            <th className="border-b border-[#d8d8d2] pb-4 pr-4 text-left text-[11px] font-medium uppercase tracking-[0.2em] text-[#777771]">
              Doctor
            </th>
            <th className="border-b border-[#d8d8d2] pb-4 pr-4 text-left text-[11px] font-medium uppercase tracking-[0.2em] text-[#777771]">
              Status
            </th>
            <th className="border-b border-[#d8d8d2] pb-4 text-left text-[11px] font-medium uppercase tracking-[0.2em] text-[#777771]">
              Date
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Fragment key={row.id}>
              <tr
                onClick={() =>
                  setExpandedId((prev) => (prev === row.id ? null : row.id))
                }
                className="cursor-pointer transition-colors hover:bg-black/[0.02]"
              >
                <td className="border-b border-[#d8d8d2] py-6 pr-4 text-[15px] text-[#111]">
                  <strong>{row.patientName}</strong>
                </td>
                <td className="border-b border-[#d8d8d2] py-6 pr-4 text-[15px] text-[#111]">
                  {row.testType}
                </td>
                <td className="border-b border-[#d8d8d2] py-6 pr-4 text-[15px] text-[#111]">
                  {row.doctorName}
                </td>
                <td className="border-b border-[#d8d8d2] py-6 pr-4 text-[15px]">
                  <span className={statusBadgeClass(row.statusLabel)}>
                    {row.statusLabel}
                    {row.statusLabel === "Completed" ? " ✓" : ""}
                  </span>
                </td>
                <td className="border-b border-[#d8d8d2] py-6 text-[15px] text-[#111] whitespace-nowrap">
                  {row.dateLabel}
                </td>
              </tr>
              {expandedId === row.id && (
                <tr>
                  <td
                    colSpan={5}
                    className="border-b border-[#d8d8d2] bg-gray-50/60 px-6 py-4"
                  >
                    <p className="text-[10px] tracking-[0.16em] uppercase text-gray-500 mb-2">
                      Audit Trail
                    </p>
                    <TimelinePanel orderId={row.id} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

