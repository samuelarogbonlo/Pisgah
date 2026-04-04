const NAMESTONE_PUBLIC_API = "https://namestone.xyz/api/public_v1/get-names";

const PISGAH_AGENT_TEXT_KEYS = [
  "pisgah.agent.type",
  "pisgah.agent.role",
  "pisgah.agent.facility",
  "pisgah.agent.verified",
  "pisgah.agent.supervised_by",
  "description",
];

export interface AgentEnsVerification {
  verified: boolean;
  ensName: string;
  resolvedAddress: string | null;
  textRecords: Record<string, string | null>;
  error?: string;
}

interface NameStonePublicRecord {
  name: string;
  address: string;
  domain: string;
  text_records?: Record<string, string>;
}

function normalizeValue(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? null;
}

function deriveExpectedFacilityEns(assistantEnsName: string) {
  const [, ...rest] = assistantEnsName.split(".");
  return rest.length > 0 ? rest.join(".").toLowerCase() : null;
}

export async function verifyAgentEns(
  ensName: string,
  expectedAddress: string,
): Promise<AgentEnsVerification> {
  try {
    // NameStone stores subnames relative to the registered domain (pisgah.eth)
    // e.g. "assistant.bluegloves-clinic.pisgah.eth" → name="assistant.bluegloves-clinic", domain="pisgah.eth"
    const parts = ensName.split(".");
    if (parts.length < 3) {
      return {
        verified: false,
        ensName,
        resolvedAddress: null,
        textRecords: {},
        error: "Invalid ENS subname format",
      };
    }

    const domain = parts.slice(-2).join(".");
    const name = parts.slice(0, -2).join(".");

    const url = new URL(NAMESTONE_PUBLIC_API);
    url.searchParams.set("domain", domain);
    url.searchParams.set("name", name);
    url.searchParams.set("exact_match", "true");
    url.searchParams.set("text_records", "true");

    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return {
        verified: false,
        ensName,
        resolvedAddress: null,
        textRecords: {},
        error: `NameStone public API returned ${res.status}`,
      };
    }

    const results: NameStonePublicRecord[] = await res.json();

    const record = results?.find(
      (r) => r.name.toLowerCase() === name.toLowerCase(),
    );

    if (!record) {
      return {
        verified: false,
        ensName,
        resolvedAddress: null,
        textRecords: {},
        error: `ENS name ${ensName} not found in NameStone`,
      };
    }

    const resolvedAddress = record.address || null;

    if (
      !resolvedAddress ||
      resolvedAddress.toLowerCase() !== expectedAddress.toLowerCase()
    ) {
      return {
        verified: false,
        ensName,
        resolvedAddress,
        textRecords: record.text_records ?? {},
        error: `ENS address mismatch: expected ${expectedAddress}, got ${resolvedAddress}`,
      };
    }

    const textRecords: Record<string, string | null> = {};
    for (const key of PISGAH_AGENT_TEXT_KEYS) {
      textRecords[key] = record.text_records?.[key] ?? null;
    }

    const isVerified =
      normalizeValue(textRecords["pisgah.agent.verified"]) === "true";
    if (!isVerified) {
      return {
        verified: false,
        ensName,
        resolvedAddress,
        textRecords,
        error: "Agent ENS text record pisgah.agent.verified is not 'true'",
      };
    }

    if (
      normalizeValue(textRecords["pisgah.agent.type"]) !== "clinic-assistant"
    ) {
      return {
        verified: false,
        ensName,
        resolvedAddress,
        textRecords,
        error:
          "Agent ENS text record pisgah.agent.type must be 'clinic-assistant'",
      };
    }

    const roleRecord = normalizeValue(textRecords["pisgah.agent.role"]);
    const roles =
      roleRecord
        ?.split(",")
        .map((value) => value.trim())
        .filter(Boolean) ?? [];
    if (!roles.includes("draft-summaries")) {
      return {
        verified: false,
        ensName,
        resolvedAddress,
        textRecords,
        error:
          "Agent ENS text record pisgah.agent.role must include 'draft-summaries'",
      };
    }

    const expectedFacilityEns = deriveExpectedFacilityEns(ensName);
    if (!expectedFacilityEns) {
      return {
        verified: false,
        ensName,
        resolvedAddress,
        textRecords,
        error: "Agent ENS name must be scoped under a facility subname",
      };
    }

    if (
      normalizeValue(textRecords["pisgah.agent.facility"]) !==
      expectedFacilityEns
    ) {
      return {
        verified: false,
        ensName,
        resolvedAddress,
        textRecords,
        error: `Agent ENS text record pisgah.agent.facility must match '${expectedFacilityEns}'`,
      };
    }

    return {
      verified: true,
      ensName,
      resolvedAddress,
      textRecords,
    };
  } catch (error) {
    return {
      verified: false,
      ensName,
      resolvedAddress: null,
      textRecords: {},
      error: error instanceof Error ? error.message : "ENS resolution failed",
    };
  }
}
