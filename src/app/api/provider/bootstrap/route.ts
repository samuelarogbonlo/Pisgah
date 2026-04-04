import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { facilityUsers, facilities } from "@/lib/db/schema";
import {
  extractBearerToken,
  getDynamicDisplayName,
  verifyDynamicToken,
} from "@/lib/auth/dynamic";
import { setProviderSession } from "@/lib/auth/session";
import {
  DEFAULT_FACILITY_IDS,
  ensureHospitalCompound,
} from "@/lib/bootstrap/hospital";

export async function POST(request: Request) {
  try {
    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
    }

    const payload = await verifyDynamicToken(token);
    const body = (await request.json()) as {
      code?: string;
      name?: string;
      email?: string;
      phone?: string;
    };

    if (!body.code || body.code !== process.env.PISGAH_BOOTSTRAP_CODE) {
      return NextResponse.json({ error: "Invalid bootstrap code" }, { status: 403 });
    }

    const [existingAdmin] = await db
      .select({ id: facilityUsers.id })
      .from(facilityUsers)
      .where(eq(facilityUsers.role, "admin"))
      .limit(1);

    if (existingAdmin) {
      return NextResponse.json(
        { error: "Bootstrap has already been completed" },
        { status: 409 },
      );
    }

    await ensureHospitalCompound();

    const [facility] = await db
      .select({ id: facilities.id, name: facilities.name })
      .from(facilities)
      .where(eq(facilities.id, DEFAULT_FACILITY_IDS.stLukes))
      .limit(1);

    if (!facility) {
      return NextResponse.json({ error: "Bootstrap facility missing" }, { status: 500 });
    }

    const [admin] = await db
      .insert(facilityUsers)
      .values({
        facilityId: facility.id,
        dynamicId: payload.sub,
        role: "admin",
        name: body.name ?? getDynamicDisplayName(payload, "Pisgah Admin"),
        email: body.email ?? payload.email ?? null,
        phone: body.phone ?? null,
      })
      .returning();

    const response = NextResponse.json({
      success: true,
      facilityId: facility.id,
      facilityName: facility.name,
      userId: admin.id,
    });

    await setProviderSession(response.cookies, {
      sub: admin.id,
      dynamicUserId: payload.sub,
      facilityUserId: admin.id,
      role: admin.role,
      facilityId: admin.facilityId,
      facilityName: facility.name,
      name: admin.name,
      email: admin.email,
    });

    return response;
  } catch (error) {
    console.error("[provider/bootstrap]", error);
    return NextResponse.json({ error: "Unable to bootstrap admin" }, { status: 500 });
  }
}
