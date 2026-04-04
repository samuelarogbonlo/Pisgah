"use client";

import { createDynamicClient } from "@dynamic-labs-sdk/client";
import { addEvmExtension } from "@dynamic-labs-sdk/evm";

let initialized = false;

export function initDynamicClient() {
  if (initialized) return;
  const environmentId = process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID;
  if (!environmentId) return;
  createDynamicClient({
    environmentId,
    metadata: {
      name: "Pisgah",
      universalLink:
        typeof window !== "undefined" ? window.location.origin : "",
    },
  });
  addEvmExtension();
  initialized = true;
}
