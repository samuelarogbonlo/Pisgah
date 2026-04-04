import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL in .env.local");
  }

  const [{ neon }, { drizzle }, schema, bootstrap] = await Promise.all([
    import("@neondatabase/serverless"),
    import("drizzle-orm/neon-http"),
    import("../src/lib/db/schema"),
    import("../src/lib/bootstrap/hospital"),
  ]);

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql, { schema });

  console.log("Clearing operational runtime data...");

  await db.delete(schema.agentRequestLog);
  await db.delete(schema.worldIdVerifications);
  await db.delete(schema.workflowEvents);
  await db.delete(schema.prescriptions);
  await db.delete(schema.actionPlans);
  await db.delete(schema.aiDrafts);
  await db.delete(schema.labResults);
  await db.delete(schema.billingRecords);
  await db.delete(schema.patientClaims);
  await db.delete(schema.diagnosticOrders);
  await db.delete(schema.patients);
  await db.delete(schema.staffInvites);
  await db.delete(schema.facilityUsers);

  console.log("Bootstrapping hospital compound facilities...");
  await bootstrap.ensureHospitalCompound();

  console.log("Hospital compound ready.");
  console.log("Facilities: 3");
  console.log("Operational users: 0");
  console.log("Patients/orders: 0");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
