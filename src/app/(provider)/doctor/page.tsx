import { db } from "@/lib/db";
import { diagnosticOrders, patients, facilities } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { CreateOrderForm } from "./create-order-form";

function formatStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusBadgeClass(status: string): string {
  if (status === "DOCTOR_REVIEW") {
    return "inline-block rounded-full px-2.5 py-1 text-[10px] tracking-widest uppercase font-semibold border border-amber-500 text-amber-800 bg-amber-50";
  }
  if (status === "COMPLETED" || status === "CANCELLED") {
    return "inline-block rounded-full px-2.5 py-1 text-[10px] tracking-widest uppercase border border-gray-200 text-gray-500 bg-gray-100";
  }
  return "inline-block rounded-full px-2.5 py-1 text-[10px] tracking-widest uppercase border border-gray-200 text-gray-500 bg-white";
}

export default async function DoctorPage() {
  const allPatients = await db
    .select({ id: patients.id, name: patients.name })
    .from(patients)
    .orderBy(patients.name);

  const doctorId = "a1b2c3d4-0011-4000-8000-000000000011";
  const activeOrders = await db
    .select({
      id: diagnosticOrders.id,
      testType: diagnosticOrders.testType,
      status: diagnosticOrders.status,
      patientName: patients.name,
      labEns: facilities.ensName,
    })
    .from(diagnosticOrders)
    .innerJoin(patients, eq(diagnosticOrders.patientId, patients.id))
    .leftJoin(facilities, eq(diagnosticOrders.labId, facilities.id))
    .where(eq(diagnosticOrders.doctorId, doctorId))
    .orderBy(sql`${diagnosticOrders.createdAt} desc`);

  return (
    <div>
      <div className="mb-4">
        <p className="text-[10px] tracking-[0.22em] uppercase text-gray-500 flex items-center gap-2">
          <span className="inline-block w-5 h-px bg-black" />
          Doctor Workspace
        </p>
        <h2 className="text-3xl tracking-tight leading-none mt-3">
          Dr. Adeyemi
        </h2>
      </div>

      <div className="border border-gray-200 rounded-md bg-white p-4 mb-4">
        <h3 className="text-xl tracking-tight mb-3">
          Create Order
        </h3>
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-gray-50 border border-gray-200 mb-3 text-[13px] text-gray-500">
          Creating as <strong className="text-black">&nbsp;Dr. Adeyemi&nbsp;</strong>
          &middot; St. Luke&apos;s Clinic
        </div>
        <CreateOrderForm patients={allPatients} />
      </div>

      <div className="border border-gray-200 rounded-md bg-white p-4">
        <h3 className="text-xl tracking-tight mb-3">
          Active Orders
        </h3>
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
                Status
              </th>
              <th className="text-left text-[11px] tracking-wider uppercase text-gray-400 font-medium pb-2.5 px-3 border-b border-gray-200">
                Lab
              </th>
            </tr>
          </thead>
          <tbody>
            {activeOrders.map((order) => (
              <tr key={order.id}>
                <td className="py-2.5 px-3 border-b border-gray-200 text-sm">
                  {order.patientName}
                </td>
                <td className="py-2.5 px-3 border-b border-gray-200 text-sm">
                  {order.testType}
                </td>
                <td className="py-2.5 px-3 border-b border-gray-200 text-sm">
                  <span className={statusBadgeClass(order.status)}>
                    {formatStatus(order.status)}
                  </span>
                </td>
                <td className="py-2.5 px-3 border-b border-gray-200 text-sm">
                  {order.labEns && (
                    <span className="font-mono text-xs text-gray-400">
                      {order.labEns}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {activeOrders.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="py-8 text-center text-sm text-gray-400"
                >
                  No active orders.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
