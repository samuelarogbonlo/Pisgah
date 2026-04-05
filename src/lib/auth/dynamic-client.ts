"use client";

import { createDynamicClient, logout } from "@dynamic-labs-sdk/client";
import { addEvmExtension } from "@dynamic-labs-sdk/evm";

let initialized = false;
let readyPromise: Promise<void> | null = null;

/**
 * Initializes the Dynamic JS SDK client and clears any stale session state.
 *
 * The SDK hydrates `client.user` from localStorage on init. If a previous
 * session exists (e.g. from the old React SDK or a prior login), `verifyOTP`
 * will incorrectly route to the "update" endpoint instead of "sign-in",
 * causing a 401. Calling `logout()` after creation ensures a clean slate.
 */
export function initDynamicClient() {
  if (initialized) return;
  const environmentId = process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID;
  if (!environmentId) return;

  const client = createDynamicClient({
    environmentId,
    metadata: {
      name: "Pisgah",
      universalLink:
        typeof window !== "undefined" ? window.location.origin : "",
    },
  });
  addEvmExtension();
  initialized = true;

  // Clear any stale session so verifyOTP routes to the sign-in endpoint.
  // logout() is safe to call even when there is no active session.
  readyPromise = logout(client).catch(() => {
    // Ignore errors — there may be no session to revoke.
  });
}

/**
 * Returns a promise that resolves once the client is fully ready
 * (stale session cleared). Call this before sendEmailOTP / verifyOTP.
 */
export async function waitForDynamicReady(): Promise<void> {
  if (readyPromise) await readyPromise;
}
