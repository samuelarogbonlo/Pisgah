import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { facilities, testCatalog } from "@/lib/db/schema";

export const DEFAULT_FACILITY_IDS = {
  stLukes: "a1b2c3d4-0001-4000-8000-000000000001",
  sunshineLab: "a1b2c3d4-0002-4000-8000-000000000002",
  greenLeaf: "a1b2c3d4-0003-4000-8000-000000000003",
} as const;

const DEFAULT_TEST_CATALOG = [
  { facilityId: DEFAULT_FACILITY_IDS.stLukes, testName: "Complete Blood Count", price: "5000" },
  { facilityId: DEFAULT_FACILITY_IDS.stLukes, testName: "Malaria RDT", price: "3500" },
  { facilityId: DEFAULT_FACILITY_IDS.stLukes, testName: "Urinalysis", price: "6000" },
  { facilityId: DEFAULT_FACILITY_IDS.stLukes, testName: "Liver Function", price: "12000" },
  { facilityId: DEFAULT_FACILITY_IDS.stLukes, testName: "Renal Function", price: "14000" },
];

async function upsertFacility(
  id: string,
  values: Omit<typeof facilities.$inferInsert, "id">,
) {
  const [existing] = await db
    .select({ id: facilities.id })
    .from(facilities)
    .where(eq(facilities.id, id))
    .limit(1);

  if (existing) {
    await db.update(facilities).set(values).where(eq(facilities.id, id));
    return;
  }

  await db.insert(facilities).values({ id, ...values });
}

export async function ensureHospitalCompound() {
  await upsertFacility(DEFAULT_FACILITY_IDS.stLukes, {
    name: "St. Luke's Clinic",
    type: "clinic",
    ensName: "stlukes.pisgah.eth",
    walletAddress: "0x0000000000000000000000000000000000000001",
    verificationStatus: "verified",
    verifiedAt: new Date(),
    metadata: { compound: "Pisgah Hospital Compound" },
  });

  await upsertFacility(DEFAULT_FACILITY_IDS.sunshineLab, {
    name: "Sunshine Diagnostics Lab",
    type: "lab",
    ensName: "sunshinelab.pisgah.eth",
    walletAddress: "0x0000000000000000000000000000000000000002",
    verificationStatus: "verified",
    verifiedAt: new Date(),
    metadata: { compound: "Pisgah Hospital Compound" },
  });

  await upsertFacility(DEFAULT_FACILITY_IDS.greenLeaf, {
    name: "GreenLeaf Pharmacy",
    type: "pharmacy",
    ensName: "greenleaf.pisgah.eth",
    walletAddress: "0x0000000000000000000000000000000000000003",
    verificationStatus: "verified",
    verifiedAt: new Date(),
    metadata: { compound: "Pisgah Hospital Compound" },
  });

  await db.delete(testCatalog);
  await db.insert(testCatalog).values(DEFAULT_TEST_CATALOG);
}
