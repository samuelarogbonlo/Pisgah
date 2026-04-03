import { db } from "@/lib/db";
import {
  diagnosticOrders,
  patients,
  facilities,
} from "@/lib/db/schema";
import { eq, sql, inArray } from "drizzle-orm";
import { LabActions } from "./lab-actions";

const SUNSHINE_LAB_ID = "a1b2c3d4-0002-4000-8000-000000000002";

export default async function LabPage() {
  const labStatuses = [
    "ROUTED_TO_LAB",
    "SAMPLE_COLLECTED",
  ] as const;

  const incomingOrders = await db
    .select({
      id: diagnosticOrders.id,
      testType: diagnosticOrders.testType,
      status: diagnosticOrders.status,
      patientName: patients.name,
      clinicEns: facilities.ensName,
    })
    .from(diagnosticOrders)
    .innerJoin(patients, eq(diagnosticOrders.patientId, patients.id))
    .innerJoin(facilities, eq(diagnosticOrders.facilityId, facilities.id))
    .where(eq(diagnosticOrders.labId, SUNSHINE_LAB_ID))
    .orderBy(sql`${diagnosticOrders.createdAt} desc`);

  // Filter to show relevant orders (routed, sample collected, and recently uploaded)
  const relevantOrders = incomingOrders.filter(
    (o) =>
      o.status === "ROUTED_TO_LAB" ||
      o.status === "SAMPLE_COLLECTED" ||
      o.status === "RESULT_UPLOADED" ||
      o.status === "DOCTOR_REVIEW"
  );

  const serialized = relevantOrders.map((o) => ({
    id: o.id,
    testType: o.testType,
    status: o.status,
    patientName: o.patientName,
    clinicEns: o.clinicEns,
  }));

  return (
    <div>
      <div className="mb-4">
        <p className="text-[10px] tracking-[0.22em] uppercase text-gray-500 flex items-center gap-2">
          <span className="inline-block w-5 h-px bg-black" />
          Lab Dashboard
        </p>
        <h2 className="text-3xl tracking-tight leading-none mt-3">
          Sunshine Diagnostics
        </h2>
        <p className="mt-1 font-mono text-xs text-gray-400">
          sunshinelab.pisgah.eth
        </p>
      </div>

      <div className="border border-gray-200 rounded-md bg-white p-4">
        <h3 className="text-xl tracking-tight mb-3">
          Incoming Orders
        </h3>
        <LabActions orders={serialized} />
      </div>
    </div>
  );
}
