import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export interface DynamicTokenPayload extends JWTPayload {
  sub: string;
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  verified?: boolean;
  scopes?: string[] | string;
}

function getDynamicEnvironmentId() {
  const envId = process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID;
  if (!envId) {
    throw new Error("Missing NEXT_PUBLIC_DYNAMIC_ENV_ID");
  }
  return envId;
}

function getDynamicJwksUrl() {
  return new URL(
    `https://app.dynamic.xyz/api/v0/sdk/${getDynamicEnvironmentId()}/.well-known/jwks`,
  );
}

const dynamicJwks = createRemoteJWKSet(getDynamicJwksUrl());

export async function verifyDynamicToken(token: string) {
  const { payload } = await jwtVerify<DynamicTokenPayload>(token, dynamicJwks, {
    algorithms: ["RS256"],
  });

  if (!payload.sub) {
    throw new Error("Dynamic token is missing subject");
  }

  return payload;
}

export function extractBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice("Bearer ".length).trim();
}

export function getDynamicDisplayName(payload: DynamicTokenPayload, fallback?: string) {
  const fromParts = [payload.firstName, payload.lastName].filter(Boolean).join(" ").trim();
  return fromParts || payload.username || fallback || payload.email || "Pisgah User";
}
