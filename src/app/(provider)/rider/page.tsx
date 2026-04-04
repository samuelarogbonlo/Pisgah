import { db } from "@/lib/db";
import {
  prescriptions,
  diagnosticOrders,
  patients,
  facilities,
} from "@/lib/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { RiderActions } from "./rider-actions";
import { requireProviderSession } from "@/lib/auth/session";

export default async function RiderPage() {
  const session = await requireProviderSession(["rider", "admin"]);

  const deliveries = await db
    .select({
      prescriptionId: prescriptions.id,
      items: prescriptions.items,
      rxStatus: prescriptions.status,
      patientName: patients.name,
      pharmacyName: facilities.ensName,
    })
    .from(prescriptions)
    .innerJoin(patients, eq(prescriptions.patientId, patients.id))
    .innerJoin(
      diagnosticOrders,
      eq(prescriptions.orderId, diagnosticOrders.id),
    )
    .innerJoin(facilities, eq(prescriptions.pharmacyId, facilities.id))
    .where(
      and(
        inArray(
          prescriptions.pharmacyId,
          db
            .select({ id: facilities.id })
            .from(facilities)
            .where(eq(facilities.hospitalId, session.hospitalId)),
        ),
        inArray(prescriptions.status, ["dispatched", "delivered"]),
      ),
    )
    .orderBy(sql`${prescriptions.createdAt} desc`);

  const serialized = deliveries.map((rx) => {
    const items = rx.items as Array<{
      drugName?: string;
      dosage?: string;
      quantity?: string;
      instructions?: string;
    }>;
    const firstItem = items?.[0];
    return {
      prescriptionId: rx.prescriptionId,
      patientName: rx.patientName,
      medication: firstItem?.drugName
        ? `${firstItem.drugName} ${firstItem.dosage ?? ""}`.trim()
        : "See prescription",
      pharmacyName: rx.pharmacyName ?? "Unknown",
      status: rx.rxStatus,
    };
  });

  return (
    <div>
      <div className="mb-4">
        <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-gray-500">
          <span className="inline-block h-px w-5 bg-black" />
          Rider
        </p>
        <h2 className="mt-3 text-3xl leading-none tracking-tight">
          Deliveries
        </h2>
      </div>

      <div className="border border-gray-200 rounded-md bg-white p-4">
        <h3 className="text-xl tracking-tight mb-3">
          Active Deliveries
        </h3>
        <RiderActions deliveries={serialized} />
      </div>
    </div>
  );
}
