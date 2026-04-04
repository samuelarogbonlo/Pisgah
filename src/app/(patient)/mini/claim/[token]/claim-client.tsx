"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MiniKit } from "@worldcoin/minikit-js";

export function ClaimClient({
  token,
  patientName,
  testType,
  alreadyClaimed,
}: {
  token: string;
  patientName: string;
  testType: string;
  alreadyClaimed: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const appId = process.env.NEXT_PUBLIC_WORLD_APP_ID;
  const openInWorldUrl = appId
    ? MiniKit.getMiniAppUrl(appId, `/mini/claim/${token}`)
    : null;

  async function handleContinue() {
    try {
      setIsPending(true);
      setError(null);

      const nonceResponse = await fetch("/api/auth/nonce", { method: "POST" });
      const noncePayload = (await nonceResponse.json()) as {
        nonce?: string;
        statement?: string;
        error?: string;
      };

      if (!nonceResponse.ok || !noncePayload.nonce) {
        throw new Error(noncePayload.error ?? "Unable to start wallet auth");
      }

      const walletAuthResult = await MiniKit.walletAuth({
        nonce: noncePayload.nonce,
        statement: noncePayload.statement,
        expirationTime: new Date(Date.now() + 1000 * 60 * 5),
      });

      const verifyResponse = await fetch("/api/auth/wallet-verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          claimToken: token,
          walletAuth: walletAuthResult.data,
        }),
      });

      const verifyPayload = (await verifyResponse.json().catch(() => null)) as { error?: string } | null;
      if (!verifyResponse.ok) {
        throw new Error(verifyPayload?.error ?? "Unable to link this claim to World App");
      }

      router.replace("/mini");
      router.refresh();
    } catch (claimError) {
      setError(claimError instanceof Error ? claimError.message : "Unable to continue");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="px-5 py-6">
      <p className="text-[10px] uppercase tracking-[0.24em] text-[#6d6d6d]">
        Patient Claim
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#161616]">
        Continue in World App
      </h1>
      <p className="mt-4 text-sm leading-7 text-[#6d6d6d]">
        This secure link was issued for <strong className="text-[#161616]">{patientName}</strong> and the order <strong className="text-[#161616]">{testType}</strong>.
      </p>

      <div className="mt-5 rounded-[10px] border border-black/10 bg-[#f8f8f6] p-4">
        <p className="text-sm leading-7 text-[#6d6d6d]">
          {alreadyClaimed
            ? "This claim has already been linked. Open Pisgah in World App to continue."
            : "Use World App wallet auth to link this hospital-issued case to your Pisgah session."}
        </p>
      </div>

      {MiniKit.isInWorldApp() ? (
        <button
          type="button"
          onClick={() => void handleContinue()}
          disabled={isPending}
          className="mt-5 inline-flex rounded-full border border-black bg-black px-4 py-2.5 text-[11px] uppercase tracking-[0.16em] text-white disabled:opacity-60"
        >
          {isPending ? "Linking..." : "Continue with World App"}
        </button>
      ) : (
        <div className="mt-5">
          <p className="text-sm text-[#6d6d6d]">
            Open this claim on your phone in World App.
          </p>
          {openInWorldUrl && (
            <a
              href={openInWorldUrl}
              className="mt-3 inline-flex rounded-full border border-black bg-black px-4 py-2.5 text-[11px] uppercase tracking-[0.16em] text-white"
            >
              Open in World App
            </a>
          )}
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
