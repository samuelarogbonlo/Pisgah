import { NextResponse } from "next/server";
import { and, desc, eq, gte, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { staffInvites, facilityUsers, facilities, hospitals } from "@/lib/db/schema";
import {
  extractBearerToken,
  getDynamicDisplayName,
  verifyDynamicToken,
} from "@/lib/auth/dynamic";
import { revalidatePath } from "next/cache";
import { setProviderSession } from "@/lib/auth/session";

type ClaimInviteBody = {
  email?: string;
  name?: string;
  phone?: string;
  licenseNumber?: string;
  token?: string;
};

export async function POST(request: Request) {
  try {
    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
    }

    const payload = await verifyDynamicToken(token);
    const body = (await request.json()) as ClaimInviteBody;
    const email = body.email?.trim().toLowerCase() ?? payload.email?.trim().toLowerCase();
    const inviteToken = body.token?.trim() || null;

    if (!inviteToken && !email) {
      return NextResponse.json(
        { error: "An invite token or email address is required to claim access" },
        { status: 400 },
      );
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
    const inviteQuery = db
      .select({
        id: staffInvites.id,
        token: staffInvites.token,
        facilityId: staffInvites.facilityId,
        role: staffInvites.role,
        name: staffInvites.name,
        email: staffInvites.email,
        claimedAt: staffInvites.claimedAt,
        expiresAt: staffInvites.expiresAt,
        facilityName: facilities.name,
        hospitalId: hospitals.id,
        hospitalName: hospitals.name,
      })
      .from(staffInvites)
      .innerJoin(facilities, eq(staffInvites.facilityId, facilities.id))
      .innerJoin(hospitals, eq(facilities.hospitalId, hospitals.id))
      .where(
        and(
          isNull(staffInvites.claimedAt),
          or(isNull(staffInvites.expiresAt), gte(staffInvites.expiresAt, now)),
          inviteToken ? eq(staffInvites.token, inviteToken) : eq(staffInvites.email, email as string),
        ),
      )
      .orderBy(desc(staffInvites.createdAt));

    const invites = await inviteQuery;

    if (!invites.length) {
      return NextResponse.json(
        { error: inviteToken ? "Invitation link is invalid or expired" : "No invitation found for this email address" },
        { status: 404 },
      );
    }

    if (!inviteToken && invites.length > 1) {
      return NextResponse.json(
        {
          error: "Multiple invites found for this email address",
          selectionRequired: true,
          invites: invites.map((invite) => ({
            token: invite.token,
            role: invite.role,
            facilityName: invite.facilityName,
            hospitalName: invite.hospitalName,
            name: invite.name,
          })),
        },
        { status: 409 },
      );
    }

    const invite = invites[0];

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
        email: invite.email ?? email ?? null,
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

    revalidatePath("/settings");
    revalidatePath("/admin/staff");
    revalidatePath("/dashboard");

    const response = NextResponse.json({
      success: true,
      userId: user.id,
      role: user.role,
      hospitalId: invite.hospitalId,
      hospitalName: invite.hospitalName,
      facilityId: user.facilityId,
      facilityName: invite.facilityName,
    });

    await setProviderSession(response.cookies, {
      sub: user.id,
      dynamicUserId: payload.sub,
      facilityUserId: user.id,
      role: user.role,
      hospitalId: invite.hospitalId,
      hospitalName: invite.hospitalName,
      facilityId: user.facilityId,
      facilityName: invite.facilityName,
      name: user.name,
      email: user.email,
    });

    return response;
  } catch (error) {
    console.error("[provider/claim-invite]", error);
    return NextResponse.json({ error: "Unable to claim invite" }, { status: 500 });
  }
}
