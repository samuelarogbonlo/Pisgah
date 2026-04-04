import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { requireProviderSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { facilities, facilityUsers, staffInvites, testCatalog } from "@/lib/db/schema";
import { updateFacilityWallet, verifyFacilityEns } from "@/app/actions";
import { buildStaffInviteLink } from "@/lib/auth/invites";
import { InviteStaffForm } from "../admin/staff/staff-form";
import { SettingsClient } from "./settings-client";

function getEnsBadge(ensName: string | null, verificationStatus: string) {
  if (!ensName) {
    return {
      label: "Verification Pending",
      className: "bg-gray-100 text-gray-600",
    };
  }

  if (verificationStatus === "verified") {
    return {
      label: "ENS Verified",
      className: "bg-green-50 text-green-700",
    };
  }

  return {
    label: "ENS Provisioned",
    className: "bg-amber-50 text-amber-700",
  };
}

export default async function SettingsPage() {
  const session = await requireProviderSession(["admin"]).catch(() => null);

  if (!session || session.role !== "admin") {
    redirect("/dashboard");
  }

  async function saveFacilityWalletAction(formData: FormData) {
    "use server";

    await updateFacilityWallet(formData);
  }

  async function verifyFacilityEnsAction(formData: FormData) {
    "use server";

    await verifyFacilityEns(formData);
  }

  const hospitalFacilities = await db
    .select({
      id: facilities.id,
      name: facilities.name,
      type: facilities.type,
      ensName: facilities.ensName,
      walletAddress: facilities.walletAddress,
      verificationStatus: facilities.verificationStatus,
    })
    .from(facilities)
    .where(eq(facilities.hospitalId, session.hospitalId))
    .orderBy(facilities.name);

  // Query test catalog for the clinic
  const tests = await db
    .select({
      id: testCatalog.id,
      testName: testCatalog.testName,
      price: testCatalog.price,
      facilityName: facilities.name,
    })
    .from(testCatalog)
    .innerJoin(facilities, eq(testCatalog.facilityId, facilities.id))
    .where(eq(facilities.hospitalId, session.hospitalId));

  const inviteRows = await db
    .select({
      id: staffInvites.id,
      token: staffInvites.token,
      name: staffInvites.name,
      email: staffInvites.email,
      role: staffInvites.role,
      claimedAt: staffInvites.claimedAt,
      expiresAt: staffInvites.expiresAt,
      facilityName: facilities.name,
    })
    .from(staffInvites)
    .innerJoin(facilities, eq(staffInvites.facilityId, facilities.id))
    .where(eq(facilities.hospitalId, session.hospitalId))
    .orderBy(desc(staffInvites.createdAt));

  const staff = await db
    .select({
      id: facilityUsers.id,
      name: facilityUsers.name,
      role: facilityUsers.role,
      email: facilityUsers.email,
      isActive: facilityUsers.isActive,
      facilityId: facilityUsers.facilityId,
      facilityName: facilities.name,
    })
    .from(facilityUsers)
    .innerJoin(facilities, eq(facilityUsers.facilityId, facilities.id))
    .where(eq(facilities.hospitalId, session.hospitalId));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Hospital Settings</h1>
        <p className="mt-1 text-sm text-[#6d6d6d]">
          {session.hospitalName} administration across {hospitalFacilities.length} facilities
        </p>
      </div>

      {/* Facilities */}
      <section className="rounded-lg border border-[#d8d8d2] bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#6d6d6d]">
          Hospital Facilities
        </h2>
        <div className="mt-4 space-y-3">
          {hospitalFacilities.map((f) => {
            const ensBadge = getEnsBadge(f.ensName, f.verificationStatus);

            return (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-md border border-[#d8d8d2] px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold">{f.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-[#6d6d6d]">
                    {f.ensName ?? "No ENS subname provisioned yet"}
                  </p>
                  <p className="mt-1 break-all font-mono text-xs text-[#6d6d6d]">
                    {f.walletAddress ?? "No facility wallet saved yet"}
                  </p>
                </div>
                <div className="flex max-w-[420px] items-center gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full border border-black/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[#6d6d6d]">
                      {f.type}
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.14em] ${ensBadge.className}`}
                    >
                      {ensBadge.label}
                    </span>
                  </div>
                  <div className="ml-auto space-y-2">
                    <form action={saveFacilityWalletAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="facilityId" value={f.id} />
                      <input
                        name="walletAddress"
                        defaultValue={f.walletAddress ?? ""}
                        placeholder="0x..."
                        className="w-[220px] rounded-[8px] border border-black/10 bg-white px-3 py-2 text-xs outline-none focus:border-black"
                      />
                      <button
                        type="submit"
                        className="rounded-full border border-black/10 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-[#161616]"
                      >
                        Save Wallet
                      </button>
                    </form>
                    <form action={verifyFacilityEnsAction} className="flex justify-end">
                      <input type="hidden" name="facilityId" value={f.id} />
                      <button
                        type="submit"
                        disabled={!f.ensName || !f.walletAddress}
                        className="rounded-full border border-black bg-black px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-white disabled:cursor-not-allowed disabled:border-black/10 disabled:bg-black/10 disabled:text-[#6d6d6d]"
                      >
                        Verify ENS
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            );
          })}
          {hospitalFacilities.length === 0 && (
            <div className="rounded-md border border-dashed border-[#d8d8d2] px-4 py-6 text-sm text-[#6d6d6d]">
              No facilities are linked to this hospital yet.
            </div>
          )}
        </div>
      </section>

      {/* Test Catalog */}
      <section className="rounded-lg border border-[#d8d8d2] bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#6d6d6d]">
          Hospital Test Catalog
        </h2>
        <div className="mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#d8d8d2] text-left text-xs uppercase tracking-[0.1em] text-[#6d6d6d]">
                <th className="pb-2 font-medium">Test</th>
                <th className="pb-2 font-medium">Facility</th>
                <th className="pb-2 text-right font-medium">Price</th>
              </tr>
            </thead>
            <tbody>
              {tests.map((t) => (
                <tr key={t.id} className="border-b border-[#d8d8d2]/50">
                  <td className="py-2.5">{t.testName}</td>
                  <td className="py-2.5 text-[#6d6d6d]">{t.facilityName}</td>
                  <td className="py-2.5 text-right font-mono">
                    {Number(t.price).toLocaleString()}
                  </td>
                </tr>
              ))}
              {tests.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-[#6d6d6d]">
                    No tests configured
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Staff Management */}
      <section className="rounded-lg border border-[#d8d8d2] bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#6d6d6d]">
          Staff Management
        </h2>

        <div className="mt-4 grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          {/* Invite Form */}
          <div className="rounded-md border border-[#d8d8d2] p-4">
            <h3 className="text-sm font-semibold">Invite Staff</h3>
            <p className="mt-1 text-xs text-[#6d6d6d]">
              Assign a staff member to a facility and role. Admins are promoted after account creation.
            </p>
            <InviteStaffForm
              facilities={hospitalFacilities.map((f) => ({
                id: f.id,
                label: `${f.name} · ${f.type}`,
              }))}
            />
          </div>

          {/* Staff List + Promote */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold">Active Staff</h3>
              <SettingsClient
                staff={staff.map((s) => ({
                  id: s.id,
                  name: s.name,
                  role: s.role,
                  email: s.email,
                  isActive: s.isActive,
                  facilityName: s.facilityName,
                }))}
                currentUserId={session.facilityUserId}
              />
            </div>

            {/* Pending Invites */}
            <div>
              <h3 className="text-sm font-semibold">Pending Invites</h3>
              <div className="mt-2 space-y-2">
                {inviteRows.map((invite) => (
                  <div key={invite.id} className="rounded-md border border-[#d8d8d2] px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">{invite.name}</p>
                        <p className="font-mono text-xs text-[#6d6d6d]">{invite.email}</p>
                        <p className="mt-0.5 text-[10px] uppercase tracking-widest text-[#6d6d6d]">
                          {invite.role.replace("_", " ")} · {invite.facilityName}
                        </p>
                      </div>
                      <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-widest ${
                        invite.claimedAt ? "border-green-200 text-green-700" : "border-[#d8d8d2] text-[#6d6d6d]"
                      }`}>
                        {invite.claimedAt ? "claimed" : "pending"}
                      </span>
                    </div>
                    {!invite.claimedAt && (
                      <p className="mt-2 break-all font-mono text-[10px] text-[#6d6d6d]">
                        {buildStaffInviteLink(invite.token)}
                      </p>
                    )}
                  </div>
                ))}
                {inviteRows.length === 0 && (
                  <p className="py-3 text-center text-xs text-[#6d6d6d]">No pending invites</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
