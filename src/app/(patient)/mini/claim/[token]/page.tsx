import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { patientClaims, patients, diagnosticOrders } from "@/lib/db/schema";
import { ClaimClient } from "./claim-client";

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const [claim] = await db
    .select({
      token: patientClaims.token,
      claimedAt: patientClaims.claimedAt,
      expiresAt: patientClaims.expiresAt,
      patientName: patients.name,
      testType: diagnosticOrders.testType,
    })
    .from(patientClaims)
    .innerJoin(patients, eq(patientClaims.patientId, patients.id))
    .leftJoin(diagnosticOrders, eq(patientClaims.orderId, diagnosticOrders.id))
    .where(eq(patientClaims.token, token))
    .limit(1);

  if (!claim) {
    return (
      <div className="px-5 py-6">
        <p className="text-[10px] uppercase tracking-[0.24em] text-[#6d6d6d]">
          Pisgah Claim
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#161616]">
          Claim link not found
        </h1>
        <p className="mt-4 text-sm leading-7 text-[#6d6d6d]">
          Ask the clinic to issue a fresh patient link.
        </p>
      </div>
    );
  }

  if (claim.expiresAt < new Date()) {
    return (
      <div className="px-5 py-6">
        <p className="text-[10px] uppercase tracking-[0.24em] text-[#6d6d6d]">
          Pisgah Claim
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#161616]">
          Claim link expired
        </h1>
        <p className="mt-4 text-sm leading-7 text-[#6d6d6d]">
          Ask the clinic to resend your secure Pisgah link.
        </p>
      </div>
    );
  }

  return (
    <ClaimClient
      token={token}
      patientName={claim.patientName}
      testType={claim.testType ?? "Diagnostic order"}
      alreadyClaimed={Boolean(claim.claimedAt)}
    />
  );
}
