"use client";

import { useEffect, useRef, useState } from "react";
import { sendEmailOTP, verifyOTP } from "@dynamic-labs-sdk/client";
import type { OTPVerification } from "@dynamic-labs-sdk/client";
import { useRouter } from "next/navigation";
import { initDynamicClient } from "@/lib/auth/dynamic-client";
import { Spinner } from "@/components/ui/spinner";

type AuthStep = "email" | "otp" | "done";

export function InviteClient({
  token,
  staffName,
  role,
  facilityName,
  hospitalName,
  inviterName,
}: {
  token: string;
  staffName: string;
  role: string;
  facilityName: string;
  hospitalName: string;
  inviterName: string;
}) {
  const router = useRouter();

  // --- Dynamic SDK init ---
  useEffect(() => {
    initDynamicClient();
  }, []);

  // --- Auth flow state ---
  const [authStep, setAuthStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpVerification, setOtpVerification] =
    useState<OTPVerification | null>(null);
  const [authPending, setAuthPending] = useState(false);

  // --- Claim state ---
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasAttemptedClaim = useRef(false);

  // --- Send email OTP ---
  async function handleSendOTP() {
    try {
      setAuthPending(true);
      setError(null);
      const verification = await sendEmailOTP({ email });
      setOtpVerification(verification);
      setAuthStep("otp");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send verification code",
      );
    } finally {
      setAuthPending(false);
    }
  }

  // --- Verify OTP and auto-claim ---
  async function handleVerifyOTP() {
    if (!otpVerification) return;
    try {
      setAuthPending(true);
      setError(null);
      const response = await verifyOTP({
        otpVerification,
        verificationToken: otpCode,
      });

      const jwt = response.jwt;
      if (!jwt) {
        throw new Error("Authentication succeeded but no JWT was returned");
      }

      setAuthStep("done");

      // Auto-claim the invite immediately
      setClaiming(true);
      const claimResponse = await fetch("/api/provider/claim-invite", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      const payload = (await claimResponse.json()) as { error?: string };
      if (!claimResponse.ok) {
        throw new Error(payload.error ?? "Unable to accept invite");
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setClaiming(false);
    } finally {
      setAuthPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f3f3f1] px-6">
      <div className="w-full max-w-md rounded-[10px] border border-black/10 bg-white p-8">
        <p className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-[#6d6d6d]">
          <span className="inline-block h-px w-6 bg-black" />
          Staff Invite
        </p>

        <h1 className="mt-5 text-3xl font-bold tracking-tight">
          Join {hospitalName}
        </h1>

        {/* Invite details card */}
        <div className="mt-5 rounded-md border border-black/10 bg-[#f8f8f6] p-4">
          <p className="text-sm text-[#6d6d6d]">You&apos;ve been invited as</p>
          <p className="mt-1 text-lg font-bold">{role}</p>
          <p className="mt-0.5 text-sm text-[#6d6d6d]">at {facilityName}</p>
          <p className="mt-3 text-xs text-[#6d6d6d]">
            Invited by {inviterName}
          </p>
        </div>

        {/* Auth flow */}
        {authStep === "email" && !claiming && (
          <div className="mt-6 space-y-3">
            <p className="mb-3 text-sm text-[#6d6d6d]">
              Sign in to accept your invite
            </p>
            <label className="block">
              <span className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-[#6d6d6d]">
                Email address
              </span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                className="w-full rounded-[8px] border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black"
                placeholder="you@hospital.com"
                disabled={authPending}
              />
            </label>
            <button
              type="button"
              onClick={handleSendOTP}
              disabled={authPending || !email.trim()}
              className="w-full rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {authPending ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner className="text-white" /> Sending...
                </span>
              ) : (
                "Send Code"
              )}
            </button>
          </div>
        )}

        {authStep === "otp" && !claiming && (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-[#6d6d6d]">
              Enter the code sent to{" "}
              <span className="font-medium text-[#161616]">{email}</span>
            </p>
            <input
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="w-full rounded-[8px] border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black"
              placeholder="Verification code"
              disabled={authPending}
            />
            <button
              type="button"
              onClick={handleVerifyOTP}
              disabled={authPending || !otpCode.trim()}
              className="w-full rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {authPending ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner className="text-white" /> Verifying...
                </span>
              ) : (
                "Verify Code"
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthStep("email");
                setOtpCode("");
                setOtpVerification(null);
              }}
              className="text-sm text-[#6d6d6d] underline"
            >
              Use a different email
            </button>
          </div>
        )}

        {claiming && (
          <p className="mt-5 flex items-center gap-2 text-sm text-[#6d6d6d]">
            <Spinner /> Accepting invite and setting up your workspace...
          </p>
        )}

        {error && (
          <p className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {authStep === "done" && !claiming && !error && (
          <p className="mt-5 flex items-center gap-2 text-sm text-[#6d6d6d]">
            <Spinner /> Processing...
          </p>
        )}
      </div>
    </div>
  );
}
