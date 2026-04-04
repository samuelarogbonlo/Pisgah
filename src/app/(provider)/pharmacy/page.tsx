import { db } from "@/lib/db";
import {
  prescriptions,
  diagnosticOrders,
  patients,
  facilities,
  facilityUsers,
} from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { PharmacyActions } from "./pharmacy-actions";
import { requireProviderSession } from "@/lib/auth/session";

export default async function PharmacyPage() {
  const session = await requireProviderSession(["pharmacist", "admin"]);
  const pendingRx = await db
    .select({
      prescriptionId: prescriptions.id,
      orderId: prescriptions.orderId,
      items: prescriptions.items,
      rxStatus: prescriptions.status,
      attestationUid: prescriptions.attestationUid,
      redemptionCode: prescriptions.redemptionCode,
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
    .where(eq(prescriptions.pharmacyId, session.facilityId))
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
      redemptionCode: rx.redemptionCode,
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
          {session.facilityName}
        </h2>
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
