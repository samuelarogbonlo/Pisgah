"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { DynamicWidget, getAuthToken, useDynamicContext, useIsLoggedIn } from "@dynamic-labs/sdk-react-core";
import { useRouter } from "next/navigation";

type SessionBootstrapResponse =
  | { success: true; session?: unknown }
  | {
      error?: string;
      needsOnboarding?: boolean;
      email?: string | null;
      name?: string | null;
    };

function hasSession(
  payload: SessionBootstrapResponse | null,
): payload is Extract<SessionBootstrapResponse, { success: true }> {
  return Boolean(payload && "success" in payload && payload.success);
}

export function LoginClient() {
  const router = useRouter();
  const isLoggedIn = useIsLoggedIn();
  const { sdkHasLoaded, user } = useDynamicContext();
  const [checkingSession, setCheckingSession] = useState(false);
  const [sessionResult, setSessionResult] = useState<SessionBootstrapResponse | null>(null);
  const [bootstrapCode, setBootstrapCode] = useState("");
  const [phone, setPhone] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const profile = useMemo(
    () => ({
      email: user?.email ?? undefined,
      name:
        [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
        user?.alias ||
        undefined,
    }),
    [user],
  );

  useEffect(() => {
    if (!sdkHasLoaded || !isLoggedIn || checkingSession || hasSession(sessionResult)) {
      return;
    }

    let cancelled = false;

    async function syncSession() {
      try {
        setCheckingSession(true);
        setError(null);

        const token = getAuthToken();
        if (!token) {
          return;
        }

        const response = await fetch("/api/provider/session", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(profile),
        });

        const payload = (await response.json()) as SessionBootstrapResponse;
        if (cancelled) {
          return;
        }

        if (response.ok && "success" in payload && payload.success) {
          router.replace("/dashboard");
          router.refresh();
          return;
        }

        setSessionResult(payload);
      } catch (syncError) {
        if (!cancelled) {
          setError(syncError instanceof Error ? syncError.message : "Unable to start Pisgah session");
        }
      } finally {
        if (!cancelled) {
          setCheckingSession(false);
        }
      }
    }

    void syncSession();

    return () => {
      cancelled = true;
    };
  }, [checkingSession, isLoggedIn, profile, router, sdkHasLoaded, sessionResult]);

  function handleClaimInvite() {
    startTransition(async () => {
      try {
        setError(null);
        const token = getAuthToken();
        if (!token) {
          throw new Error("Dynamic login is required first");
        }

        const response = await fetch("/api/provider/claim-invite", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: profile.email,
            name: sessionResult && "name" in sessionResult ? sessionResult.name ?? profile.name : profile.name,
            phone,
            licenseNumber,
          }),
        });

        const payload = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to claim invite");
        }

        router.replace("/dashboard");
        router.refresh();
      } catch (claimError) {
        setError(claimError instanceof Error ? claimError.message : "Unable to claim invite");
      }
    });
  }

  function handleBootstrap() {
    startTransition(async () => {
      try {
        setError(null);
        const token = getAuthToken();
        if (!token) {
          throw new Error("Dynamic login is required first");
        }

        const response = await fetch("/api/provider/bootstrap", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code: bootstrapCode,
            email: profile.email,
            name: profile.name,
            phone,
          }),
        });

        const payload = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to bootstrap admin");
        }

        router.replace("/dashboard");
        router.refresh();
      } catch (bootstrapError) {
        setError(
          bootstrapError instanceof Error
            ? bootstrapError.message
            : "Unable to bootstrap the hospital admin",
        );
      }
    });
  }

  return (
    <div className="min-h-screen bg-[#f3f3f1] px-6 py-10">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[10px] border border-black/10 bg-white p-8">
          <p className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-[#6d6d6d]">
            <span className="inline-block h-px w-6 bg-black" />
            Phase 4 Provider Access
          </p>
          <h1 className="mt-5 text-5xl font-semibold leading-none tracking-tight">
            Sign in to Pisgah
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[#6d6d6d]">
            Dynamic is now the only provider login path. If this account already
            belongs to Pisgah, you will land in the correct role workspace. If
            not, claim your invite or bootstrap the first admin.
          </p>

          <div className="mt-8 rounded-[10px] border border-black/10 bg-[#f8f8f6] p-5">
            <DynamicWidget />
          </div>

          {checkingSession && (
            <p className="mt-4 text-sm text-[#6d6d6d]">
              Checking Pisgah access...
            </p>
          )}

          {error && (
            <p className="mt-4 rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </section>

        <section className="rounded-[10px] border border-black/10 bg-white p-8">
          <p className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-[#6d6d6d]">
            <span className="inline-block h-px w-6 bg-black" />
            Onboarding
          </p>

          {(!sdkHasLoaded || !isLoggedIn) && (
            <div className="mt-5 space-y-3 text-sm text-[#6d6d6d]">
              <p>Sign in with Dynamic first.</p>
              <p>After that, Pisgah will either start your session, let you claim an invite, or let you bootstrap the first admin.</p>
            </div>
          )}

          {sdkHasLoaded && isLoggedIn && (
            <div className="mt-5 space-y-6">
              <div className="rounded-[10px] border border-black/10 bg-[#f8f8f6] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#6d6d6d]">
                  Dynamic Identity
                </p>
                <p className="mt-3 text-lg font-semibold text-[#161616]">
                  {profile.name ?? "Unnamed provider"}
                </p>
                <p className="mt-1 font-mono text-xs text-[#6d6d6d]">
                  {profile.email ?? "No email on Dynamic profile"}
                </p>
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-[#6d6d6d]">
                    Phone
                  </span>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="w-full rounded-[8px] border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black"
                    placeholder="+234..."
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-[#6d6d6d]">
                    License Number
                  </span>
                  <input
                    value={licenseNumber}
                    onChange={(event) => setLicenseNumber(event.target.value)}
                    className="w-full rounded-[8px] border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black"
                    placeholder="Optional for clinicians/pharmacists"
                  />
                </label>
              </div>

              <div className="rounded-[10px] border border-black/10 p-4">
                <p className="text-sm font-semibold text-[#161616]">Claim a staff invite</p>
                <p className="mt-1 text-sm leading-6 text-[#6d6d6d]">
                  Use this if the hospital admin already added you in Staff Management.
                </p>
                <button
                  type="button"
                  onClick={handleClaimInvite}
                  disabled={isPending}
                  className="mt-4 inline-flex rounded-full border border-black bg-black px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-white disabled:opacity-60"
                >
                  {isPending ? "Working..." : "Claim Invite"}
                </button>
              </div>

              <div className="rounded-[10px] border border-black/10 p-4">
                <p className="text-sm font-semibold text-[#161616]">Bootstrap the first admin</p>
                <p className="mt-1 text-sm leading-6 text-[#6d6d6d]">
                  Use this only once, with the bootstrap code in your environment, to create the initial Pisgah admin.
                </p>
                <label className="mt-4 block">
                  <span className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-[#6d6d6d]">
                    Bootstrap Code
                  </span>
                  <input
                    value={bootstrapCode}
                    onChange={(event) => setBootstrapCode(event.target.value)}
                    className="w-full rounded-[8px] border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black"
                    placeholder="PISGAH_BOOTSTRAP_CODE"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleBootstrap}
                  disabled={isPending || !bootstrapCode.trim()}
                  className="mt-4 inline-flex rounded-full border border-black px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-black disabled:opacity-50"
                >
                  {isPending ? "Working..." : "Bootstrap Admin"}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
