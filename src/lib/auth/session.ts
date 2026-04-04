import { cookies } from "next/headers";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import {
  PATIENT_SESSION_COOKIE,
  PROVIDER_SESSION_COOKIE,
} from "./constants";

type CookieReader = {
  get(name: string): { value: string } | undefined;
  set(
    name: string,
    value: string,
    options?: {
      httpOnly?: boolean;
      sameSite?: "lax" | "strict" | "none";
      secure?: boolean;
      path?: string;
      maxAge?: number;
    },
  ): unknown;
  delete(name: string): unknown;
};

export interface ProviderSessionPayload extends JWTPayload {
  sub: string;
  dynamicUserId: string;
  facilityUserId: string;
  role: "doctor" | "accounts" | "lab_tech" | "pharmacist" | "admin";
  hospitalId: string;
  hospitalName: string;
  facilityId: string;
  facilityName: string;
  name: string;
  email?: string | null;
}

export interface PatientSessionPayload extends JWTPayload {
  sub: string;
  patientId: string;
  walletAddress: string;
  claimId: string;
}

function getSessionSecret() {
  const secret = process.env.PISGAH_SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing PISGAH_SESSION_SECRET");
  }

  return new TextEncoder().encode(secret);
}

async function signToken(
  payload: JWTPayload,
  audience: "provider-session" | "patient-session",
  expiresIn: string,
) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("pisgah")
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSessionSecret());
}

async function verifyToken<T extends JWTPayload>(
  token: string,
  audience: "provider-session" | "patient-session",
) {
  const { payload } = await jwtVerify<T>(token, getSessionSecret(), {
    issuer: "pisgah",
    audience,
  });

  return payload;
}

function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export async function setProviderSession(
  cookieStore: CookieReader,
  payload: Omit<ProviderSessionPayload, "iat" | "exp" | "iss" | "aud">,
) {
  const token = await signToken(payload, "provider-session", "12h");
  cookieStore.set(
    PROVIDER_SESSION_COOKIE,
    token,
    sessionCookieOptions(60 * 60 * 12),
  );
  return token;
}

export async function setPatientSession(
  cookieStore: CookieReader,
  payload: Omit<PatientSessionPayload, "iat" | "exp" | "iss" | "aud">,
) {
  const token = await signToken(payload, "patient-session", "7d");
  cookieStore.set(
    PATIENT_SESSION_COOKIE,
    token,
    sessionCookieOptions(60 * 60 * 24 * 7),
  );
  return token;
}

export function clearProviderSession(cookieStore: CookieReader) {
  cookieStore.delete(PROVIDER_SESSION_COOKIE);
}

export function clearPatientSession(cookieStore: CookieReader) {
  cookieStore.delete(PATIENT_SESSION_COOKIE);
}

export async function getProviderSessionFromStore(cookieStore: CookieReader) {
  const token = cookieStore.get(PROVIDER_SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    return await verifyToken<ProviderSessionPayload>(token, "provider-session");
  } catch {
    return null;
  }
}

export async function getPatientSessionFromStore(cookieStore: CookieReader) {
  const token = cookieStore.get(PATIENT_SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    return await verifyToken<PatientSessionPayload>(token, "patient-session");
  } catch {
    return null;
  }
}

export async function getProviderSession() {
  const cookieStore = await cookies();
  return getProviderSessionFromStore(cookieStore);
}

export async function getPatientSession() {
  const cookieStore = await cookies();
  return getPatientSessionFromStore(cookieStore);
}

export async function requireProviderSession(
  allowedRoles?: ProviderSessionPayload["role"][],
) {
  const session = await getProviderSession();
  if (!session) {
    throw new Error("Provider session required");
  }

  if (allowedRoles && !allowedRoles.includes(session.role)) {
    throw new Error("Provider is not allowed to access this resource");
  }

  return session;
}

export async function requirePatientSession() {
  const session = await getPatientSession();
  if (!session) {
    throw new Error("Patient session required");
  }

  return session;
}
