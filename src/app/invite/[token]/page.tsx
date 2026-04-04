import { eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { staffInvites, facilities, hospitals, facilityUsers } from "@/lib/db/schema";
import { InviteClient } from "./invite-client";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const [invite] = await db
    .select({
      id: staffInvites.id,
      token: staffInvites.token,
      name: staffInvites.name,
      email: staffInvites.email,
      role: staffInvites.role,
      claimedAt: staffInvites.claimedAt,
      expiresAt: staffInvites.expiresAt,
      facilityName: facilities.name,
      hospitalName: hospitals.name,
    })
    .from(staffInvites)
    .innerJoin(facilities, eq(staffInvites.facilityId, facilities.id))
    .innerJoin(hospitals, eq(facilities.hospitalId, hospitals.id))
    .where(eq(staffInvites.token, decodeURIComponent(token)))
    .limit(1);

  if (!invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f3f1] px-6">
        <div className="max-w-md rounded-[10px] border border-black/10 bg-white p-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Invalid Invite</h1>
          <p className="mt-3 text-sm text-[#6d6d6d]">
            This invite link is not valid. Contact your hospital admin for a new one.
          </p>
        </div>
      </div>
    );
  }

  if (invite.claimedAt) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f3f1] px-6">
        <div className="max-w-md rounded-[10px] border border-black/10 bg-white p-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Already Claimed</h1>
          <p className="mt-3 text-sm text-[#6d6d6d]">
            This invite has already been used. If this is your account, sign in directly.
          </p>
          <a
            href="/login"
            className="mt-5 inline-block rounded-full bg-black px-5 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-white"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f3f1] px-6">
        <div className="max-w-md rounded-[10px] border border-black/10 bg-white p-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Invite Expired</h1>
          <p className="mt-3 text-sm text-[#6d6d6d]">
            This invite has expired. Contact your hospital admin for a new one.
          </p>
        </div>
      </div>
    );
  }

  // Look up who invited them
  const [inviter] = await db
    .select({ name: facilityUsers.name })
    .from(facilityUsers)
    .where(eq(facilityUsers.id, invite.id))
    .limit(1);

  const roleLabel = invite.role.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <InviteClient
      token={invite.token}
      staffName={invite.name}
      role={roleLabel}
      facilityName={invite.facilityName}
      hospitalName={invite.hospitalName}
      inviterName={inviter?.name ?? "Hospital Admin"}
    />
  );
}
