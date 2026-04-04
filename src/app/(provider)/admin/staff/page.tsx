import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { facilities, facilityUsers, staffInvites } from "@/lib/db/schema";
import { requireProviderSession } from "@/lib/auth/session";
import { buildStaffInviteLink } from "@/lib/auth/invites";
import { InviteStaffForm } from "./staff-form";

export default async function StaffAdminPage() {
  const session = await requireProviderSession(["admin"]);

  const facilityRows = await db
    .select({
      id: facilities.id,
      name: facilities.name,
      type: facilities.type,
      ensName: facilities.ensName,
    })
    .from(facilities)
    .where(eq(facilities.hospitalId, session.hospitalId))
    .orderBy(facilities.name);

  const staffRows = await db
    .select({
      id: facilityUsers.id,
      name: facilityUsers.name,
      email: facilityUsers.email,
      role: facilityUsers.role,
      isActive: facilityUsers.isActive,
      facilityId: facilityUsers.facilityId,
      facilityName: facilities.name,
    })
    .from(facilityUsers)
    .innerJoin(facilities, eq(facilityUsers.facilityId, facilities.id))
    .where(eq(facilities.hospitalId, session.hospitalId))
    .orderBy(desc(facilityUsers.createdAt));

  const inviteRows = await db
    .select({
      id: staffInvites.id,
      token: staffInvites.token,
      name: staffInvites.name,
      email: staffInvites.email,
      role: staffInvites.role,
      claimedAt: staffInvites.claimedAt,
      expiresAt: staffInvites.expiresAt,
      facilityId: staffInvites.facilityId,
      facilityName: facilities.name,
    })
    .from(staffInvites)
    .innerJoin(facilities, eq(staffInvites.facilityId, facilities.id))
    .where(eq(facilities.hospitalId, session.hospitalId))
    .orderBy(desc(staffInvites.createdAt));

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] tracking-[0.22em] uppercase text-gray-500 flex items-center gap-2">
          <span className="inline-block w-5 h-px bg-black" />
          Hospital Admin
        </p>
        <h2 className="mt-3 text-3xl tracking-tight leading-none">
          {session.hospitalName} Staff Access
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Manage staff access across the clinic, lab, and pharmacy facilities in this hospital network.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-[8px] border border-gray-200 bg-white p-4">
          <h3 className="text-xl tracking-tight">Invite Hospital Staff</h3>
          <p className="mt-2 text-sm text-gray-500">
            Assign a staff member to the right facility and role inside this hospital. Hospital admins are promoted after the account is active.
          </p>

          <InviteStaffForm
            facilities={facilityRows.map((facility) => ({
              id: facility.id,
              label: `${facility.name} · ${facility.type}`,
            }))}
          />
        </div>

        <div className="space-y-4">
          <section className="rounded-[8px] border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl tracking-tight">Hospital Staff</h3>
              <span className="text-xs uppercase tracking-[0.16em] text-gray-500">
                {staffRows.length} linked accounts across {facilityRows.length} facilities
              </span>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="text-[11px] uppercase tracking-[0.16em] text-gray-500">
                  <tr>
                    <th className="border-b border-gray-200 px-0 py-3">Name</th>
                    <th className="border-b border-gray-200 px-0 py-3">Role</th>
                    <th className="border-b border-gray-200 px-0 py-3">Facility</th>
                    <th className="border-b border-gray-200 px-0 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {staffRows.map((staff) => (
                    <tr key={staff.id}>
                      <td className="border-b border-gray-100 py-3 pr-4">
                        <div className="font-semibold text-gray-900">{staff.name}</div>
                        <div className="font-mono text-xs text-gray-500">
                          {staff.email ?? "No email"}
                        </div>
                      </td>
                      <td className="border-b border-gray-100 py-3 pr-4 uppercase tracking-[0.14em] text-gray-600">
                        {staff.role.replace("_", " ")}
                      </td>
                      <td className="border-b border-gray-100 py-3 pr-4 text-gray-700">
                        {staff.facilityName}
                      </td>
                      <td className="border-b border-gray-100 py-3">
                        <span className="inline-flex rounded-full border border-black/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-gray-600">
                          {staff.isActive ? "active" : "inactive"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {staffRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-5 text-center text-sm text-gray-500"
                      >
                        No hospital staff accounts have been linked yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-[8px] border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl tracking-tight">Facility Invites</h3>
              <span className="text-xs uppercase tracking-[0.16em] text-gray-500">
                {inviteRows.length} issued across this hospital
              </span>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="text-[11px] uppercase tracking-[0.16em] text-gray-500">
                  <tr>
                    <th className="border-b border-gray-200 px-0 py-3">Invite</th>
                    <th className="border-b border-gray-200 px-0 py-3">Facility</th>
                    <th className="border-b border-gray-200 px-0 py-3">State</th>
                  </tr>
                </thead>
                <tbody>
                  {inviteRows.map((invite) => (
                    <tr key={invite.id}>
                      <td className="border-b border-gray-100 py-3 pr-4">
                        <div className="font-semibold text-gray-900">{invite.name}</div>
                        <div className="font-mono text-xs text-gray-500">{invite.email}</div>
                        <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-gray-500">
                          {invite.role.replace("_", " ")}
                        </div>
                        <div className="mt-2 break-all font-mono text-[11px] text-gray-500">
                          {buildStaffInviteLink(invite.token)}
                        </div>
                      </td>
                      <td className="border-b border-gray-100 py-3 pr-4 text-gray-700">
                        {invite.facilityName}
                      </td>
                      <td className="border-b border-gray-100 py-3">
                        <span className="inline-flex rounded-full border border-black/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-gray-600">
                          {invite.claimedAt ? "claimed" : "pending"}
                        </span>
                        <div className="mt-2 text-xs text-gray-500">
                          Expires {invite.expiresAt?.toLocaleDateString() ?? "never"}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {inviteRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="py-5 text-center text-sm text-gray-500"
                      >
                        No pending facility invites for this hospital network.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
