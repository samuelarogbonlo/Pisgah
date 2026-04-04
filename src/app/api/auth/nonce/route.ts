import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

const PATIENT_AUTH_NONCE_COOKIE = "pisgah_patient_auth_nonce";

export async function POST() {
  const nonce = randomBytes(18).toString("base64url");
  const response = NextResponse.json({
    nonce,
    statement: "Sign in to Pisgah inside World App",
  });

  response.cookies.set(PATIENT_AUTH_NONCE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}
