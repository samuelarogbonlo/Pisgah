import { redirect } from "next/navigation";
import { and, desc, eq, isNull } from "drizzle-orm";
import { requireProviderSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { facilities, facilityUsers, staffInvites, testCatalog } from "@/lib/db/schema";
import { buildStaffInviteLink } from "@/lib/auth/invites";
import { InviteStaffForm } from "../admin/staff/staff-form";
import { SettingsClient } from "./settings-client";
import { TestCatalogManager } from "./test-catalog-form";

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
    .where(and(eq(facilities.hospitalId, session.hospitalId), isNull(staffInvites.claimedAt)))
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
                    {f.ensName ? (
                      <a href={`https://app.ens.domains/${f.ensName}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-black">{f.ensName}</a>
                    ) : "No ENS subname provisioned yet"}
                  </p>
                  <p className="mt-0.5 break-all font-mono text-[10px] text-[#999]">
                    {f.walletAddress ? (
                      <a href={`https://etherscan.io/address/${f.walletAddress}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-black">{f.walletAddress}</a>
                    ) : null}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full border border-black/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[#6d6d6d]">
                    {f.type}
                  </span>
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.14em] ${ensBadge.className}`}
                  >
                    {ensBadge.label}
                  </span>
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
        <TestCatalogManager
          tests={tests.map((t) => ({
            id: t.id,
            testName: t.testName,
            price: t.price,
            facilityName: t.facilityName,
          }))}
          facilities={hospitalFacilities.map((f) => ({
            id: f.id,
            name: f.name,
          }))}
        />
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
