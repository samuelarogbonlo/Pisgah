import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { facilityUsers, facilities } from "@/lib/db/schema";
import {
  extractBearerToken,
  getDynamicDisplayName,
  verifyDynamicToken,
} from "@/lib/auth/dynamic";
import { setProviderSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
    }

    const payload = await verifyDynamicToken(token);
    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      name?: string;
    };

    const [user] = await db
      .select({
        id: facilityUsers.id,
        dynamicId: facilityUsers.dynamicId,
        role: facilityUsers.role,
        facilityId: facilityUsers.facilityId,
        name: facilityUsers.name,
        email: facilityUsers.email,
        isActive: facilityUsers.isActive,
        facilityName: facilities.name,
      })
      .from(facilityUsers)
      .innerJoin(facilities, eq(facilityUsers.facilityId, facilities.id))
      .where(
        and(
          eq(facilityUsers.dynamicId, payload.sub),
          eq(facilityUsers.isActive, true),
        ),
      )
      .limit(1);

    if (!user) {
      return NextResponse.json(
        {
          error: "No facility access found for this Dynamic user",
          needsOnboarding: true,
          email: body.email ?? payload.email ?? null,
          name: body.name ?? getDynamicDisplayName(payload),
        },
        { status: 404 },
      );
    }

    const response = NextResponse.json({
      success: true,
      session: {
        userId: user.id,
        role: user.role,
        facilityId: user.facilityId,
        facilityName: user.facilityName,
        name: user.name,
      },
    });

    await setProviderSession(response.cookies, {
      sub: user.id,
      dynamicUserId: user.dynamicId,
      facilityUserId: user.id,
      role: user.role,
      facilityId: user.facilityId,
      facilityName: user.facilityName,
      name: user.name,
      email: user.email,
    });

    return response;
  } catch (error) {
    console.error("[provider/session]", error);
    return NextResponse.json({ error: "Unable to start provider session" }, { status: 500 });
  }
}
