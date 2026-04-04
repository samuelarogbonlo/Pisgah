import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { facilities, facilityUsers } from "@/lib/db/schema";

export function slugifyHospitalName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export async function findFacilityInHospital(hospitalId: string, facilityId: string) {
  const [facility] = await db
    .select({
      id: facilities.id,
      hospitalId: facilities.hospitalId,
      name: facilities.name,
      type: facilities.type,
      ensName: facilities.ensName,
      walletAddress: facilities.walletAddress,
      verificationStatus: facilities.verificationStatus,
      metadata: facilities.metadata,
    })
    .from(facilities)
    .where(and(eq(facilities.hospitalId, hospitalId), eq(facilities.id, facilityId)))
    .limit(1);

  return facility ?? null;
}

export async function findFacilityUserInHospital(hospitalId: string, userId: string) {
  const [user] = await db
    .select({
      id: facilityUsers.id,
      facilityId: facilityUsers.facilityId,
      role: facilityUsers.role,
      name: facilityUsers.name,
      email: facilityUsers.email,
    })
    .from(facilityUsers)
    .innerJoin(facilities, eq(facilityUsers.facilityId, facilities.id))
    .where(and(eq(facilityUsers.id, userId), eq(facilities.hospitalId, hospitalId)))
    .limit(1);

  return user ?? null;
}

export async function findHospitalFacilityByType(
  hospitalId: string,
  type: "clinic" | "lab" | "pharmacy",
) {
  const [facility] = await db
    .select({
      id: facilities.id,
      name: facilities.name,
      ensName: facilities.ensName,
      walletAddress: facilities.walletAddress,
      verificationStatus: facilities.verificationStatus,
    })
    .from(facilities)
    .where(and(eq(facilities.hospitalId, hospitalId), eq(facilities.type, type)))
    .limit(1);

  return facility ?? null;
}
