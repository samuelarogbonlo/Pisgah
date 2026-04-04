import { db } from "@/lib/db";
import { patients, diagnosticOrders } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { PatientSearch } from "./patient-search";
import { RegisterToggle } from "./register-toggle";
import { requireProviderSession } from "@/lib/auth/session";

export default async function PatientsPage() {
  const session = await requireProviderSession(["doctor", "admin"]);
  const patientRows = await db
    .select({
      id: patients.id,
      name: patients.name,
      phone: patients.phone,
      createdAt: patients.createdAt,
      orderCount: sql<number>`cast(count(${diagnosticOrders.id}) as int)`,
    })
    .from(patients)
    .leftJoin(diagnosticOrders, eq(patients.id, diagnosticOrders.patientId))
    .where(eq(patients.facilityId, session.facilityId))
    .groupBy(patients.id, patients.name, patients.phone, patients.createdAt)
    .orderBy(sql`${patients.createdAt} desc`);

  const serialized = patientRows.map((p) => ({
    id: p.id,
    name: p.name,
    phone: p.phone,
    createdAt: p.createdAt?.toISOString() ?? null,
    orderCount: p.orderCount,
  }));

  return (
    <div>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-[10px] tracking-[0.22em] uppercase text-gray-500 flex items-center gap-2">
            <span className="inline-block w-5 h-px bg-black" />
            Patient Registry
          </p>
          <h2 className="text-3xl tracking-tight leading-none mt-3">
            Patients
          </h2>
        </div>
        <div className="mt-3">
          <RegisterToggle />
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg bg-white/90 p-4">
        <PatientSearch patients={serialized} />
      </div>
    </div>
  );
}
