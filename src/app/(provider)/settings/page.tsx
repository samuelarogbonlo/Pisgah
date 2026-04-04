import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { requireProviderSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  billingRecords,
  diagnosticOrders,
  facilities,
  facilityUsers,
  hospitalPaymentSettings,
  staffInvites,
  testCatalog,
} from "@/lib/db/schema";
import {
  updateFacilityWallet,
  updateHospitalPaymentSettings,
  verifyFacilityEns,
} from "@/app/actions";
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

  async function saveFacilityWalletAction(formData: FormData) {
    "use server";

    await updateFacilityWallet(formData);
  }

  async function verifyFacilityEnsAction(formData: FormData) {
    "use server";

    await verifyFacilityEns(formData);
  }

  async function savePaymentSettingsAction(formData: FormData) {
    "use server";

    await updateHospitalPaymentSettings(formData);
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

  const paymentLedger = await db
    .select({
      amount: billingRecords.amount,
      status: billingRecords.status,
      confirmedAt: billingRecords.confirmedAt,
      facilityName: facilities.name,
      facilityType: facilities.type,
      walletAddress: facilities.walletAddress,
      ensName: facilities.ensName,
      verificationStatus: facilities.verificationStatus,
    })
    .from(billingRecords)
    .innerJoin(diagnosticOrders, eq(billingRecords.orderId, diagnosticOrders.id))
    .innerJoin(facilities, eq(diagnosticOrders.facilityId, facilities.id))
    .where(eq(facilities.hospitalId, session.hospitalId))
    .orderBy(desc(billingRecords.createdAt));

  const openInvoices = paymentLedger.filter((row) => row.status === "unpaid");
  const confirmedInvoices = paymentLedger.filter((row) =>
    row.status === "cash_confirmed" || row.status === "online_confirmed",
  );
  const totalOpen = openInvoices.reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0,
  );
  const totalConfirmed = confirmedInvoices.reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0,
  );

  const [paymentSettings] = await db
    .select({
      opayEnabled: hospitalPaymentSettings.opayEnabled,
      opayMerchantId: hospitalPaymentSettings.opayMerchantId,
      worldPayEnabled: hospitalPaymentSettings.worldPayEnabled,
    })
    .from(hospitalPaymentSettings)
    .where(eq(hospitalPaymentSettings.hospitalId, session.hospitalId))
    .limit(1);

  const worldRecipientAddress =
    process.env.WORLD_PAYMENT_RECIPIENT_ADDRESS?.trim() || null;

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

      <section className="rounded-lg border border-[#d8d8d2] bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#6d6d6d]">
          Payment Configuration
        </h2>
        <p className="mt-2 text-sm text-[#6d6d6d]">
          Control which patient-side payment rails are exposed in the Pisgah Mini
          App. OPay uses the hospital merchant ID saved here. World App pay uses
          the server wallet configured for this deployment.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-[#d8d8d2] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#6d6d6d]">
              Open invoices
            </p>
            <p className="mt-2 text-2xl tracking-tight">{openInvoices.length}</p>
          </div>
          <div className="rounded-md border border-[#d8d8d2] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#6d6d6d]">
              Confirmed
            </p>
            <p className="mt-2 text-2xl tracking-tight">
              {confirmedInvoices.length}
            </p>
          </div>
          <div className="rounded-md border border-[#d8d8d2] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#6d6d6d]">
              Tracked value
            </p>
            <p className="mt-2 text-2xl tracking-tight">
              &#8358;{(totalOpen + totalConfirmed).toLocaleString()}
            </p>
          </div>
        </div>

        <form action={savePaymentSettingsAction} className="mt-5 rounded-md border border-[#d8d8d2] p-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="flex items-start gap-3 rounded-md border border-[#d8d8d2] px-3 py-3">
              <input
                type="checkbox"
                name="opayEnabled"
                defaultChecked={paymentSettings?.opayEnabled ?? false}
                className="mt-1 h-4 w-4 rounded border-black/20"
              />
              <span>
                <span className="block text-sm font-semibold">Enable OPay checkout</span>
                <span className="mt-1 block text-xs text-[#6d6d6d]">
                  Patients paying online from the Mini App will be redirected to
                  OPay hosted checkout for this hospital.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-md border border-[#d8d8d2] px-3 py-3">
              <input
                type="checkbox"
                name="worldPayEnabled"
                defaultChecked={paymentSettings?.worldPayEnabled ?? false}
                className="mt-1 h-4 w-4 rounded border-black/20"
              />
              <span>
                <span className="block text-sm font-semibold">Enable World App pay</span>
                <span className="mt-1 block text-xs text-[#6d6d6d]">
                  Charges are routed to the platform settlement wallet configured
                  on this deployment.
                </span>
              </span>
            </label>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.14em] text-[#6d6d6d]">
                OPay Merchant ID
              </span>
              <input
                name="opayMerchantId"
                defaultValue={paymentSettings?.opayMerchantId ?? ""}
                placeholder="256620120000073887"
                className="mt-2 w-full rounded-[8px] border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-black"
              />
            </label>

            <div className="rounded-md border border-[#d8d8d2] bg-[#fafaf8] px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#6d6d6d]">
                World settlement wallet
              </p>
              <p className="mt-2 break-all font-mono text-xs text-[#161616]">
                {worldRecipientAddress ?? "WORLD_PAYMENT_RECIPIENT_ADDRESS is missing"}
              </p>
              <p className="mt-2 text-[11px] text-[#6d6d6d]">
                This is deployment-wide for now. The hospital toggle above only
                controls whether World App pay is shown to patients.
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-[#6d6d6d]">
              Accounts no longer confirms payments manually. Verified provider
              callbacks move orders into the lab automatically.
            </p>
            <button
              type="submit"
              className="rounded-full border border-black bg-black px-4 py-2 text-[11px] uppercase tracking-[0.14em] text-white"
            >
              Save Payment Settings
            </button>
          </div>
        </form>

        <div className="mt-4 space-y-3">
          {hospitalFacilities.map((facility) => {
            const trackedInvoiceCount = paymentLedger.filter(
              (row) => row.facilityName === facility.name,
            ).length;
            const facilityOpen = paymentLedger.filter(
              (row) =>
                row.facilityName === facility.name && row.status === "unpaid",
            ).length;

            return (
              <div
                key={facility.id}
                className="rounded-md border border-[#d8d8d2] px-4 py-3 flex flex-wrap items-start justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-semibold">{facility.name}</p>
                  <p className="mt-1 font-mono text-xs text-[#6d6d6d]">
                    {facility.ensName ?? "ENS not provisioned"}
                  </p>
                  <p className="mt-1 break-all font-mono text-xs text-[#6d6d6d]">
                    {facility.walletAddress ?? "No facility wallet saved yet"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-black/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[#6d6d6d]">
                    {facility.type}
                  </span>
                  <span className="rounded-full border border-black/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[#6d6d6d]">
                    {trackedInvoiceCount} tracked
                  </span>
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.14em] ${
                      facilityOpen > 0
                        ? "bg-amber-50 text-amber-700"
                        : "bg-green-50 text-green-700"
                    }`}
                  >
                    {facilityOpen > 0 ? `${facilityOpen} open` : "settled"}
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
