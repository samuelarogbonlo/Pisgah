import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { patientClaims } from "@/lib/db/schema";

export function generateClaimToken() {
  return randomBytes(24).toString("base64url");
}

export function buildClaimLink(token: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  return `${baseUrl.replace(/\/$/, "")}/mini/claim/${token}`;
}

export async function issuePatientClaim(params: {
  patientId: string;
  orderId: string;
  issuedBy: string;
  expiresInHours?: number;
}) {
  const token = generateClaimToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + (params.expiresInHours ?? 72));

  const [claim] = await db
    .insert(patientClaims)
    .values({
      token,
      patientId: params.patientId,
      orderId: params.orderId,
      issuedBy: params.issuedBy,
      expiresAt,
    })
    .returning();

  return {
    claim,
    claimLink: buildClaimLink(token),
  };
}

export async function consumePatientClaimWallet(params: {
  claimId: string;
  walletAddress: string;
}) {
  await db
    .update(patientClaims)
    .set({
      claimedAt: new Date(),
      claimedByWallet: params.walletAddress,
    })
    .where(eq(patientClaims.id, params.claimId));
}
