"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { DynamicWidget, getAuthToken, useDynamicContext, useIsLoggedIn } from "@dynamic-labs/sdk-react-core";
import { useRouter, useSearchParams } from "next/navigation";
import { SetupHospitalForm } from "./setup-hospital-form";

type SessionBootstrapResponse =
  | { success: true; session?: unknown }
  | {
      error?: string;
      needsOnboarding?: boolean;
      email?: string | null;
      name?: string | null;
    };

type InviteSelection = {
  token: string;
  role: string;
  facilityName: string;
  hospitalName: string;
  name: string;
};

function hasSession(
  payload: SessionBootstrapResponse | null,
): payload is Extract<SessionBootstrapResponse, { success: true }> {
  return Boolean(payload && "success" in payload && payload.success);
}

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isLoggedIn = useIsLoggedIn();
  const { sdkHasLoaded, user } = useDynamicContext();
  const [checkingSession, setCheckingSession] = useState(false);
  const [sessionResult, setSessionResult] = useState<SessionBootstrapResponse | null>(null);
  const [phone, setPhone] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [inviteChoices, setInviteChoices] = useState<InviteSelection[]>([]);
  const [autoClaimAttempted, setAutoClaimAttempted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Refs to prevent infinite re-fetch loops caused by Dynamic SDK flickering
  const hasAttemptedSync = useRef(false);
  const profileRef = useRef<{ email?: string; name?: string }>({ email: undefined, name: undefined });

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

  // Keep profileRef in sync without triggering effects
  profileRef.current = profile;

  // Reset only on genuine logout (stable false, not flicker)
  const wasLoggedIn = useRef(false);
  useEffect(() => {
    if (isLoggedIn) {
      wasLoggedIn.current = true;
    } else if (wasLoggedIn.current) {
      // Genuine logout — user was logged in, now isn't
      wasLoggedIn.current = false;
      hasAttemptedSync.current = false;
      setSessionResult(null);
      setCheckingSession(false);
      setInviteChoices([]);
      setAutoClaimAttempted(false);
      setError(null);
    }
  }, [isLoggedIn]);

  // Session sync — fires ONCE per login, never re-triggers
  useEffect(() => {
    if (!sdkHasLoaded || !isLoggedIn || hasAttemptedSync.current) {
      return;
    }

    hasAttemptedSync.current = true;

    async function syncSession() {
      try {
        setCheckingSession(true);
        setError(null);

        const token = getAuthToken();
        if (!token) {
          setCheckingSession(false);
          return;
        }

        const response = await fetch("/api/provider/session", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(profileRef.current),
        });

        const payload = (await response.json()) as SessionBootstrapResponse;

        if (response.ok && "success" in payload && payload.success) {
          router.replace("/dashboard");
          router.refresh();
          return;
        }

        setSessionResult(payload);
      } catch (syncError) {
        setError(syncError instanceof Error ? syncError.message : "Unable to start Pisgah session");
      } finally {
        setCheckingSession(false);
      }
    }

    void syncSession();
  }, [sdkHasLoaded, isLoggedIn, router]);

  const needsOnboarding =
    sessionResult !== null &&
    "needsOnboarding" in sessionResult &&
    sessionResult.needsOnboarding === true;
  const inviteToken = searchParams.get("invite")?.trim() || null;

  function handleClaimInvite(selectedToken?: string) {
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
            token: selectedToken ?? inviteToken ?? undefined,
          }),
        });

        const payload = (await response.json()) as {
          error?: string;
          selectionRequired?: boolean;
          invites?: InviteSelection[];
        };
        if (!response.ok) {
          if (payload.selectionRequired && payload.invites?.length) {
            setInviteChoices(payload.invites);
            return;
          }
          throw new Error(payload.error ?? "Unable to claim invite");
        }

        setInviteChoices([]);
        router.replace("/dashboard");
        router.refresh();
      } catch (claimError) {
        setError(claimError instanceof Error ? claimError.message : "Unable to claim invite");
      }
    });
  }

  useEffect(() => {
    if (!needsOnboarding || !inviteToken || autoClaimAttempted || !sdkHasLoaded || !isLoggedIn) {
      return;
    }

    setAutoClaimAttempted(true);
    handleClaimInvite(inviteToken);
  }, [autoClaimAttempted, inviteToken, isLoggedIn, needsOnboarding, sdkHasLoaded]);

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
            Dynamic is the provider login path. If this account already belongs
            to Pisgah, you will land in the correct role workspace. Otherwise,
            create your hospital or claim a staff invite.
          </p>

          <div className="mt-8 rounded-[10px] border border-black/10 bg-[#f8f8f6] p-5">
            <DynamicWidget />
          </div>

          {checkingSession && !needsOnboarding && (
            <p className="mt-4 text-sm text-[#6d6d6d]">
              Checking Pisgah access...
            </p>
          )}

          {needsOnboarding && (
            <p className="mt-4 text-sm text-green-700">
              Dynamic login successful. Complete your onboarding →
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
              <p>After that, Pisgah will either start your session, let you set up your hospital, or let you claim a staff invite.</p>
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

              {needsOnboarding && (
                <>
                  <SetupHospitalForm
                    dynamicToken={getAuthToken() ?? ""}
                    profile={profile}
                  />

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
                      Use this if a hospital admin already invited you into Pisgah.
                    </p>
                    {inviteToken && (
                      <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[#6d6d6d]">
                        Invite link detected. Sign in and claim this hospital access.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => handleClaimInvite()}
                      disabled={isPending}
                      className="mt-4 inline-flex rounded-full border border-black bg-black px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-white disabled:opacity-60"
                    >
                      {isPending ? "Working..." : "Claim Invite"}
                    </button>
                    {inviteChoices.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-xs uppercase tracking-[0.14em] text-[#6d6d6d]">
                          Choose your hospital invite
                        </p>
                        {inviteChoices.map((invite) => (
                          <button
                            key={invite.token}
                            type="button"
                            onClick={() => handleClaimInvite(invite.token)}
                            className="flex w-full items-start justify-between rounded-[8px] border border-black/10 px-3 py-3 text-left transition-colors hover:bg-black/[0.03]"
                          >
                            <span>
                              <span className="block text-sm font-semibold text-[#161616]">
                                {invite.hospitalName}
                              </span>
                              <span className="mt-1 block text-xs text-[#6d6d6d]">
                                {invite.facilityName} · {invite.role.replace("_", " ")}
                              </span>
                            </span>
                            <span className="text-[10px] uppercase tracking-[0.16em] text-[#6d6d6d]">
                              Claim
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
