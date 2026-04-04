import { NextResponse } from "next/server";
import { clearProviderSession } from "@/lib/auth/session";

export async function POST() {
  const response = NextResponse.json({ success: true });
  clearProviderSession(response.cookies);
  return response;
}
