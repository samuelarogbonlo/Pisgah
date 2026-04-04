import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

const ENS_CACHE_TTL_MS = 120_000;

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export const PISGAH_AGENT_TEXT_KEYS = [
  "description",
  "pisgah.agent.type",
  "pisgah.agent.role",
  "pisgah.agent.facility",
  "pisgah.agent.supervised_by",
  "pisgah.agent.verified",
  "pisgah.facility.type",
  "pisgah.facility.capabilities",
  "pisgah.facility.hours",
  "pisgah.facility.state",
  "pisgah.facility.lga",
  "pisgah.facility.license",
] as const;

export interface ResolvedEnsMetadata {
  address: string;
  ensName: string | null;
  resolvedAddress: string | null;
  textRecords: Record<string, string | null>;
  verified: boolean;
  issues: string[];
}

export interface EnsResolutionOptions {
  rpcUrl?: string;
  textKeys?: readonly string[];
}

const ensMetadataCache = new Map<string, CacheEntry<ResolvedEnsMetadata>>();

function createEnsClient(rpcUrl?: string) {
  return createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl),
  });
}

function getCacheKey(prefix: string, value: string, textKeys: readonly string[]) {
  return `${prefix}:${value}:${textKeys.join("|")}`;
}

function getCachedMetadata(key: string) {
  const cached = ensMetadataCache.get(key);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    ensMetadataCache.delete(key);
    return null;
  }

  return cached.value;
}

function setCachedMetadata(key: string, value: ResolvedEnsMetadata) {
  ensMetadataCache.set(key, {
    value,
    expiresAt: Date.now() + ENS_CACHE_TTL_MS,
  });
}

function normalizeRecord(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function readEnsTextRecords(
  client: ReturnType<typeof createEnsClient>,
  ensName: string,
  textKeys: readonly string[],
) {
  const textRecords: Record<string, string | null> = {};

  for (const key of textKeys) {
    try {
      textRecords[key] = normalizeRecord(
        await client.getEnsText({ name: ensName, key }),
      );
    } catch {
      textRecords[key] = null;
    }
  }

  return textRecords;
}

export async function resolveEnsMetadataByAddress(
  address: `0x${string}`,
  options: EnsResolutionOptions = {},
): Promise<ResolvedEnsMetadata> {
  const textKeys = options.textKeys ?? PISGAH_AGENT_TEXT_KEYS;
  const cacheKey = getCacheKey("address", address.toLowerCase(), textKeys);
  const cached = getCachedMetadata(cacheKey);
  if (cached) {
    return cached;
  }

  const client = createEnsClient(options.rpcUrl);
  const issues: string[] = [];

  let ensName: string | null = null;
  let resolvedAddress: string | null = null;

  try {
    ensName = await client.getEnsName({ address });
  } catch (error) {
    issues.push(
      error instanceof Error
        ? `ENS reverse lookup failed: ${error.message}`
        : "ENS reverse lookup failed",
    );
  }

  if (ensName) {
    try {
      resolvedAddress = await client.getEnsAddress({ name: ensName });
      if (
        resolvedAddress &&
        resolvedAddress.toLowerCase() !== address.toLowerCase()
      ) {
        issues.push("ENS forward resolution does not match the signing address");
      }
    } catch (error) {
      issues.push(
        error instanceof Error
          ? `ENS forward lookup failed: ${error.message}`
          : "ENS forward lookup failed",
      );
    }
  } else {
    issues.push("No ENS name resolved for the address");
  }

  const textRecords = ensName
    ? await readEnsTextRecords(client, ensName, textKeys)
    : Object.fromEntries(textKeys.map((key) => [key, null]));

  if (ensName && textRecords["pisgah.agent.verified"] !== "true") {
    issues.push("pisgah.agent.verified text record is not set to true");
  }

  if (ensName && textRecords["pisgah.agent.type"] == null) {
    issues.push("pisgah.agent.type text record is missing");
  }

  const verified =
    Boolean(ensName) &&
    textRecords["pisgah.agent.verified"] === "true" &&
    (!resolvedAddress || resolvedAddress.toLowerCase() === address.toLowerCase());

  const resolved = {
    address,
    ensName,
    resolvedAddress,
    textRecords,
    verified,
    issues,
  };

  setCachedMetadata(cacheKey, resolved);
  return resolved;
}

export async function resolveEnsMetadataByName(
  ensName: string,
  options: EnsResolutionOptions = {},
): Promise<ResolvedEnsMetadata> {
  const textKeys = options.textKeys ?? PISGAH_AGENT_TEXT_KEYS;
  const cacheKey = getCacheKey("name", ensName.toLowerCase(), textKeys);
  const cached = getCachedMetadata(cacheKey);
  if (cached) {
    return cached;
  }

  const client = createEnsClient(options.rpcUrl);
  const issues: string[] = [];

  let resolvedAddress: string | null = null;

  try {
    resolvedAddress = await client.getEnsAddress({ name: ensName });
  } catch (error) {
    issues.push(
      error instanceof Error
        ? `ENS forward lookup failed: ${error.message}`
        : "ENS forward lookup failed",
    );
  }

  const textRecords = await readEnsTextRecords(client, ensName, textKeys);
  const verified =
    textRecords["pisgah.agent.verified"] === "true" &&
    Boolean(resolvedAddress);

  if (textRecords["pisgah.agent.verified"] !== "true") {
    issues.push("pisgah.agent.verified text record is not set to true");
  }

  const resolved = {
    address: resolvedAddress ?? "",
    ensName,
    resolvedAddress,
    textRecords,
    verified,
    issues,
  };

  setCachedMetadata(cacheKey, resolved);
  return resolved;
}
