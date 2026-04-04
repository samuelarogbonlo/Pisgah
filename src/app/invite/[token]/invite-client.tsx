"use client";

import { useEffect, useRef, useState } from "react";
import { DynamicContextProvider, DynamicWidget, getAuthToken, useIsLoggedIn, useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { useRouter } from "next/navigation";

function InviteAcceptFlow({
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
  const isLoggedIn = useIsLoggedIn();
  const { sdkHasLoaded } = useDynamicContext();
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasAttempted = useRef(false);

  useEffect(() => {
    if (!sdkHasLoaded || !isLoggedIn || hasAttempted.current) return;

    hasAttempted.current = true;

    async function claimInvite() {
      try {
        setClaiming(true);
        setError(null);

        const authToken = getAuthToken();
        if (!authToken) {
          setError("Authentication failed. Please try again.");
          setClaiming(false);
          return;
        }

        const response = await fetch("/api/provider/claim-invite", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        });

        const payload = await response.json();

        if (!response.ok) {
          setError(payload.error ?? "Unable to accept invite");
          setClaiming(false);
          return;
        }

        router.replace("/dashboard");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setClaiming(false);
      }
    }

    void claimInvite();
  }, [sdkHasLoaded, isLoggedIn, token, router]);

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

        <div className="mt-5 rounded-md border border-black/10 bg-[#f8f8f6] p-4">
          <p className="text-sm text-[#6d6d6d]">You&apos;ve been invited as</p>
          <p className="mt-1 text-lg font-bold">{role}</p>
          <p className="mt-0.5 text-sm text-[#6d6d6d]">at {facilityName}</p>
          <p className="mt-3 text-xs text-[#6d6d6d]">Invited by {inviterName}</p>
        </div>

        {claiming && (
          <p className="mt-5 text-sm text-[#6d6d6d]">
            Accepting invite and setting up your workspace...
          </p>
        )}

        {error && (
          <p className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {!isLoggedIn && !claiming && (
          <div className="mt-6">
            <p className="mb-3 text-sm text-[#6d6d6d]">
              Sign in to accept your invite
            </p>
            <DynamicWidget />
          </div>
        )}

        {isLoggedIn && !claiming && !error && (
          <p className="mt-5 text-sm text-[#6d6d6d]">
            Processing...
          </p>
        )}
      </div>
    </div>
  );
}

export function InviteClient(props: {
  token: string;
  staffName: string;
  role: string;
  facilityName: string;
  hospitalName: string;
  inviterName: string;
}) {
  const environmentId = process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID;

  if (!environmentId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f3f1]">
        <p className="text-sm text-red-700">Dynamic is not configured.</p>
      </div>
    );
  }

  return (
    <DynamicContextProvider
      settings={{
        environmentId,
        appName: "Pisgah",
        walletConnectors: [EthereumWalletConnectors],
      }}
    >
      <InviteAcceptFlow {...props} />
    </DynamicContextProvider>
  );
}
