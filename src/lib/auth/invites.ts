import { randomBytes } from "node:crypto";

export function generateStaffInviteToken() {
  return randomBytes(24).toString("base64url");
}

export function buildStaffInviteLink(token: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  return `${baseUrl.replace(/\/$/, "")}/login?invite=${encodeURIComponent(token)}`;
}
