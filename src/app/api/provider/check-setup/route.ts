import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { facilityUsers } from "@/lib/db/schema";

export async function GET() {
  const [admin] = await db
    .select({ id: facilityUsers.id })
    .from(facilityUsers)
    .where(eq(facilityUsers.role, "admin"))
    .limit(1);

  return NextResponse.json({ setupComplete: !!admin });
}
