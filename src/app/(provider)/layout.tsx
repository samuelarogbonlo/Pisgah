import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getProviderSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { facilities } from "@/lib/db/schema";
import { ProviderProviders } from "./providers";
import { ProviderShell } from "./provider-shell";

export default async function ProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getProviderSession();

  if (!session) {
    redirect("/login");
  }

  const [facility] = await db
    .select({
      ensName: facilities.ensName,
      verificationStatus: facilities.verificationStatus,
    })
    .from(facilities)
    .where(eq(facilities.id, session.facilityId))
    .limit(1);

  return (
    <ProviderProviders>
      <ProviderShell
        session={{
          name: session.name,
          role: session.role,
          facilityName: session.facilityName,
          ensName: facility?.ensName ?? null,
          verificationStatus: facility?.verificationStatus ?? null,
        }}
      >
        {children}
      </ProviderShell>
    </ProviderProviders>
  );
}
