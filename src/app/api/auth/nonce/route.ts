import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

const PATIENT_AUTH_NONCE_COOKIE = "pisgah_patient_auth_nonce";
const NONCE_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function createWalletAuthNonce(length = 32) {
  const bytes = randomBytes(length);

  return Array.from(bytes, (byte) => NONCE_ALPHABET[byte % NONCE_ALPHABET.length]).join("");
}

export async function POST() {
  const nonce = createWalletAuthNonce();
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
