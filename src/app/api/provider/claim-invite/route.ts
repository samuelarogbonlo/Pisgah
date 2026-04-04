import { NextResponse } from "next/server";
import { and, desc, eq, gte, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { staffInvites, facilityUsers, facilities } from "@/lib/db/schema";
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
    const body = (await request.json()) as {
      email?: string;
      name?: string;
      phone?: string;
      licenseNumber?: string;
    };

    const email = body.email?.trim().toLowerCase() ?? payload.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Invite email is required" }, { status: 400 });
    }

    const [existingUser] = await db
      .select({ id: facilityUsers.id })
      .from(facilityUsers)
      .where(eq(facilityUsers.dynamicId, payload.sub))
      .limit(1);

    if (existingUser) {
      return NextResponse.json(
        { error: "This Dynamic account is already linked to Pisgah" },
        { status: 409 },
      );
    }

    const now = new Date();
    const [invite] = await db
      .select()
      .from(staffInvites)
      .where(
        and(
          eq(staffInvites.email, email),
          isNull(staffInvites.claimedAt),
          or(isNull(staffInvites.expiresAt), gte(staffInvites.expiresAt, now)),
        ),
      )
      .orderBy(desc(staffInvites.createdAt))
      .limit(1);

    if (!invite) {
      return NextResponse.json(
        { error: "No invitation found for this email address" },
        { status: 404 },
      );
    }

    if (invite.expiresAt && invite.expiresAt < now) {
      return NextResponse.json({ error: "This invite has expired" }, { status: 410 });
    }

    const [user] = await db
      .insert(facilityUsers)
      .values({
        facilityId: invite.facilityId,
        dynamicId: payload.sub,
        role: invite.role,
        name: invite.name || body.name || getDynamicDisplayName(payload),
        email,
        phone: body.phone ?? null,
        licenseNumber: body.licenseNumber ?? null,
      })
      .returning();

    await db
      .update(staffInvites)
      .set({
        claimedBy: user.id,
        claimedAt: now,
      })
      .where(eq(staffInvites.id, invite.id));

    const [facility] = await db
      .select({ name: facilities.name })
      .from(facilities)
      .where(eq(facilities.id, user.facilityId))
      .limit(1);

    const response = NextResponse.json({
      success: true,
      userId: user.id,
      role: user.role,
      facilityId: user.facilityId,
      facilityName: facility?.name ?? "Pisgah Facility",
    });

    await setProviderSession(response.cookies, {
      sub: user.id,
      dynamicUserId: payload.sub,
      facilityUserId: user.id,
      role: user.role,
      facilityId: user.facilityId,
      facilityName: facility?.name ?? "Pisgah Facility",
      name: user.name,
      email: user.email,
    });

    return response;
  } catch (error) {
    console.error("[provider/claim-invite]", error);
    return NextResponse.json({ error: "Unable to claim invite" }, { status: 500 });
  }
}
