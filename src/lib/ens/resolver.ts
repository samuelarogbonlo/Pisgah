import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

const ENS_PROFILE_CACHE_TTL_MS = 120_000;

type EnsProfile = {
  name: string;
  address: `0x${string}` | null;
  description: string | null;
  facilityType: string | null;
  capabilities: string | null;
  verified: string | null;
  region: string | null;
  supervisingFacility: string | null;
};

let ensClient: ReturnType<typeof createPublicClient> | null = null;
const ensProfileCache = new Map<
  string,
  {
    value: EnsProfile | null;
    expiresAt: number;
  }
>();

function getEnsClient() {
  if (ensClient) {
    return ensClient;
  }

  ensClient = createPublicClient({
    chain: mainnet,
    transport: http(process.env.ENS_RPC_URL || mainnet.rpcUrls.default.http[0]),
  });

  return ensClient;
}

function getCachedProfile(name: string) {
  const cached = ensProfileCache.get(name);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    ensProfileCache.delete(name);
    return null;
  }

  return cached.value;
}

function setCachedProfile(name: string, value: EnsProfile | null) {
  ensProfileCache.set(name, {
    value,
    expiresAt: Date.now() + ENS_PROFILE_CACHE_TTL_MS,
  });
}

export async function resolveEnsProfile(name: string | null | undefined): Promise<EnsProfile | null> {
  if (!name) {
    return null;
  }

  const cacheKey = name.toLowerCase();
  const cached = getCachedProfile(cacheKey);
  if (cached) {
    return cached;
  }

  const client = getEnsClient();

  try {
    const [address, description, facilityType, capabilities, verified, state, lga, supervisingFacility] =
      await Promise.all([
        client.getEnsAddress({ name }),
        client.getEnsText({ name, key: "description" }),
        client.getEnsText({
          name,
          key: "pisgah.facility.type",
        }).catch(() =>
          client.getEnsText({ name, key: "pisgah.agent.type" }),
        ),
        client.getEnsText({
          name,
          key: "pisgah.facility.capabilities",
        }).catch(() =>
          client.getEnsText({ name, key: "pisgah.agent.role" }),
        ),
        client.getEnsText({
          name,
          key: "pisgah.facility.verified",
        }).catch(() =>
          client.getEnsText({ name, key: "pisgah.agent.verified" }),
        ),
        client.getEnsText({ name, key: "pisgah.facility.state" }),
        client.getEnsText({ name, key: "pisgah.facility.lga" }),
        client.getEnsText({ name, key: "pisgah.agent.facility" }),
      ]);

    const resolved = {
      name,
      address,
      description: description ?? null,
      facilityType: facilityType ?? null,
      capabilities: capabilities ?? null,
      verified: verified ?? null,
      region:
        [state, lga].filter(Boolean).join(", ").trim() || null,
      supervisingFacility: supervisingFacility ?? null,
    };
    setCachedProfile(cacheKey, resolved);
    return resolved;
  } catch (error) {
    console.error("[ens/resolver]", error);
    setCachedProfile(cacheKey, null);
    return null;
  }
}
