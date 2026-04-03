import { db } from "@/lib/db";
import {
  prescriptions,
  diagnosticOrders,
  patients,
  facilities,
  facilityUsers,
} from "@/lib/db/schema";
import { eq, sql, inArray } from "drizzle-orm";
import { PharmacyActions } from "./pharmacy-actions";

const GREENLEAF_ID = "a1b2c3d4-0003-4000-8000-000000000003";

export default async function PharmacyPage() {
  const pendingRx = await db
    .select({
      prescriptionId: prescriptions.id,
      orderId: prescriptions.orderId,
      items: prescriptions.items,
      rxStatus: prescriptions.status,
      attestationUid: prescriptions.attestationUid,
      patientName: patients.name,
      clinicEns: facilities.ensName,
      doctorName: facilityUsers.name,
    })
    .from(prescriptions)
    .innerJoin(patients, eq(prescriptions.patientId, patients.id))
    .innerJoin(
      diagnosticOrders,
      eq(prescriptions.orderId, diagnosticOrders.id)
    )
    .innerJoin(facilities, eq(diagnosticOrders.facilityId, facilities.id))
    .innerJoin(facilityUsers, eq(diagnosticOrders.doctorId, facilityUsers.id))
    .where(eq(prescriptions.pharmacyId, GREENLEAF_ID))
    .orderBy(sql`${prescriptions.createdAt} desc`);

  const serialized = pendingRx.map((rx) => {
    const items = rx.items as Array<{
      drugName?: string;
      dosage?: string;
      quantity?: string;
      instructions?: string;
    }>;
    const firstItem = items?.[0];
    return {
      prescriptionId: rx.prescriptionId,
      orderId: rx.orderId,
      status: rx.rxStatus,
      attestationUid: rx.attestationUid,
      patientName: rx.patientName,
      clinicEns: rx.clinicEns,
      doctorName: rx.doctorName,
      medication: firstItem?.drugName
        ? `${firstItem.drugName} ${firstItem.dosage ?? ""}`.trim()
        : "See prescription",
    };
  });

  return (
    <div>
      <div className="mb-4">
        <p className="text-[10px] tracking-[0.22em] uppercase text-gray-500 flex items-center gap-2">
          <span className="inline-block w-5 h-px bg-black" />
          Pharmacy Dashboard
        </p>
        <h2 className="text-3xl tracking-tight leading-none mt-3">
          GreenLeaf Pharmacy
        </h2>
        <p className="mt-1 font-mono text-xs text-gray-400">
          greenleaf.pisgah.eth
        </p>
      </div>

      <div className="border border-gray-200 rounded-md bg-white p-4">
        <h3 className="text-xl tracking-tight mb-3">
          Pending Prescriptions
        </h3>
        <PharmacyActions prescriptions={serialized} />
      </div>
    </div>
  );
}
