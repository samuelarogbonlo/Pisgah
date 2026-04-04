import { signRequest } from "@worldcoin/idkit";
import type { IDKitResult } from "@worldcoin/idkit";

export type WorldVerificationAction =
  | "view-result"
  | "redeem-prescription";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

export function getWorldAppId() {
  return requireEnv("NEXT_PUBLIC_WORLD_APP_ID") as `app_${string}`;
}

export function getWorldRpId() {
  return requireEnv("WORLD_RP_ID");
}

export function buildWorldIdRequest(action: WorldVerificationAction) {
  const signature = signRequest(action, requireEnv("WORLD_SIGNING_KEY"), 5 * 60);

  return {
    appId: getWorldAppId(),
    action,
    allowLegacyProofs: true,
    environment:
      process.env.WORLD_ID_ENVIRONMENT === "staging" ? "staging" : "production",
    rpContext: {
      rp_id: getWorldRpId(),
      nonce: signature.nonce,
      created_at: signature.createdAt,
      expires_at: signature.expiresAt,
      signature: signature.sig,
    },
  };
}

export async function verifyWorldIdResult(result: IDKitResult) {
  const response = await fetch(
    `https://developer.worldcoin.org/api/v4/verify/${getWorldRpId()}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(result),
      cache: "no-store",
    },
  );

  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; verify_status?: string }
    | null;

  const verified =
    response.ok &&
    payload !== null &&
    payload.success !== false &&
    payload.verify_status !== "failed";

  return {
    verified,
    payload,
  };
}

export function extractWorldProofRecord(result: IDKitResult) {
  const firstResponse = result.responses[0];
  if (!firstResponse) {
    throw new Error("World ID result did not include a proof response");
  }

  if ("proof" in firstResponse && Array.isArray(firstResponse.proof)) {
    return {
      protocolVersion: result.protocol_version,
      nullifierHash:
        "nullifier" in firstResponse
          ? firstResponse.nullifier
          : firstResponse.session_nullifier?.[0],
      merkleRoot: firstResponse.proof[4] ?? null,
    };
  }

  if ("nullifier" in firstResponse) {
    return {
      protocolVersion: result.protocol_version,
      nullifierHash: firstResponse.nullifier,
      merkleRoot: "merkle_root" in firstResponse ? firstResponse.merkle_root : null,
    };
  }

  throw new Error("Unsupported World ID proof format");
}
