import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireProviderSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { facilities, facilityUsers, testCatalog } from "@/lib/db/schema";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const session = await requireProviderSession(["admin"]).catch(() => null);

  if (!session || session.role !== "admin") {
    redirect("/dashboard");
  }

  // Get all facilities that share this hospital (via metadata.hospitalName)
  const [currentFacility] = await db
    .select()
    .from(facilities)
    .where(eq(facilities.id, session.facilityId))
    .limit(1);

  if (!currentFacility) {
    redirect("/dashboard");
  }

  const hospitalName =
    (currentFacility.metadata as Record<string, unknown> | null)
      ?.hospitalName as string | undefined;

  // Query all facilities — in a single-hospital setup, all facilities belong to this hospital
  const allFacilities = await db
    .select({
      id: facilities.id,
      name: facilities.name,
      type: facilities.type,
      ensName: facilities.ensName,
      verificationStatus: facilities.verificationStatus,
    })
    .from(facilities);

  // Query test catalog for the clinic
  const tests = await db
    .select({
      id: testCatalog.id,
      testName: testCatalog.testName,
      price: testCatalog.price,
    })
    .from(testCatalog)
    .where(eq(testCatalog.facilityId, session.facilityId));

  // Query all staff
  const staff = await db
    .select({
      id: facilityUsers.id,
      name: facilityUsers.name,
      role: facilityUsers.role,
      email: facilityUsers.email,
      isActive: facilityUsers.isActive,
      facilityId: facilityUsers.facilityId,
    })
    .from(facilityUsers);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-[#6d6d6d]">
          {hospitalName || currentFacility.name} administration
        </p>
      </div>

      {/* Facilities */}
      <section className="rounded-lg border border-[#d8d8d2] bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#6d6d6d]">
          Facilities
        </h2>
        <div className="mt-4 space-y-3">
          {allFacilities.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between rounded-md border border-[#d8d8d2] px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold">{f.name}</p>
                <p className="mt-0.5 font-mono text-xs text-[#6d6d6d]">
                  {f.ensName ?? "ENS pending"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full border border-black/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[#6d6d6d]">
                  {f.type}
                </span>
                <span
                  className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.14em] ${
                    f.verificationStatus === "verified"
                      ? "bg-green-50 text-green-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {f.verificationStatus}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Test Catalog */}
      <section className="rounded-lg border border-[#d8d8d2] bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#6d6d6d]">
          Test Catalog
        </h2>
        <div className="mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#d8d8d2] text-left text-xs uppercase tracking-[0.1em] text-[#6d6d6d]">
                <th className="pb-2 font-medium">Test</th>
                <th className="pb-2 text-right font-medium">Price</th>
              </tr>
            </thead>
            <tbody>
              {tests.map((t) => (
                <tr key={t.id} className="border-b border-[#d8d8d2]/50">
                  <td className="py-2.5">{t.testName}</td>
                  <td className="py-2.5 text-right font-mono">
                    {Number(t.price).toLocaleString()}
                  </td>
                </tr>
              ))}
              {tests.length === 0 && (
                <tr>
                  <td colSpan={2} className="py-4 text-center text-[#6d6d6d]">
                    No tests configured
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Staff */}
      <section className="rounded-lg border border-[#d8d8d2] bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#6d6d6d]">
          Staff
        </h2>
        <SettingsClient
          staff={staff.map((s) => ({
            id: s.id,
            name: s.name,
            role: s.role,
            email: s.email,
            isActive: s.isActive,
          }))}
          currentUserId={session.facilityUserId}
        />
      </section>
    </div>
  );
}
