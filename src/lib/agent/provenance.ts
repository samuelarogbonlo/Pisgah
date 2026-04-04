import type { DraftResult } from "@/lib/ai/generate-draft";

export interface AgentDraftProvenance {
  kind: "agentkit";
  verified: boolean;
  agentAddress: string;
  agentEnsName: string | null;
  agentHumanId: string | null;
  chainId: string;
  requestUrl: string;
  issuedAt: string;
  textRecords: Record<string, string | null>;
  issues: string[];
}

export interface ParsedAgentDraft {
  draft: DraftResult;
  provenance: AgentDraftProvenance | null;
  verified: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeMedication(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  return {
    drugName: typeof value.drugName === "string" ? value.drugName : "",
    dosage: typeof value.dosage === "string" ? value.dosage : "",
    quantity: typeof value.quantity === "string" ? value.quantity : "",
    instructions: typeof value.instructions === "string" ? value.instructions : "",
  };
}

function normalizeDraft(value: unknown): DraftResult {
  if (!isRecord(value)) {
    return {
      summary: "",
      recommendations: "",
      suggestedMedication: null,
    };
  }

  return {
    summary: typeof value.summary === "string" ? value.summary : "",
    recommendations:
      typeof value.recommendations === "string" ? value.recommendations : "",
    suggestedMedication: normalizeMedication(value.suggestedMedication),
  };
}

function parsePlainDraft(raw: string): DraftResult {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isRecord(parsed)) {
      return normalizeDraft(parsed);
    }
  } catch {
    // Fall through to the raw-text summary fallback.
  }

  return {
    summary: raw,
    recommendations: "",
    suggestedMedication: null,
  };
}

function normalizeTextRecords(
  value: unknown,
): Record<string, string | null> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, recordValue]) => [
      key,
      typeof recordValue === "string" && recordValue.trim().length > 0
        ? recordValue.trim()
        : null,
    ]),
  );
}

function normalizeProvenance(
  value: unknown,
): AgentDraftProvenance | null {
  if (!isRecord(value)) {
    return null;
  }

  const agentAddress =
    typeof value.agentAddress === "string" ? value.agentAddress : "";
  const chainId = typeof value.chainId === "string" ? value.chainId : "";
  const requestUrl =
    typeof value.requestUrl === "string" ? value.requestUrl : "";
  const issuedAt = typeof value.issuedAt === "string" ? value.issuedAt : "";

  return {
    kind: "agentkit",
    verified: Boolean(value.verified),
    agentAddress,
    agentEnsName:
      typeof value.agentEnsName === "string" ? value.agentEnsName : null,
    agentHumanId:
      typeof value.agentHumanId === "string" ? value.agentHumanId : null,
    chainId,
    requestUrl,
    issuedAt,
    textRecords: normalizeTextRecords(value.textRecords),
    issues: Array.isArray(value.issues)
      ? value.issues.filter((issue): issue is string => typeof issue === "string")
      : [],
  };
}

export function serializeAgentDraftEnvelope(
  draft: DraftResult,
  provenance: AgentDraftProvenance,
): string {
  return JSON.stringify({
    ...draft,
    provenance,
  });
}

export function parseAgentDraftEnvelope(
  raw: string | null | undefined,
): ParsedAgentDraft {
  if (!raw) {
    return {
      draft: {
        summary: "",
        recommendations: "",
        suggestedMedication: null,
      },
      provenance: null,
      verified: false,
    };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isRecord(parsed)) {
      const provenance = normalizeProvenance(parsed.provenance);

      if (
        "summary" in parsed ||
        "recommendations" in parsed ||
        "suggestedMedication" in parsed
      ) {
        return {
          draft: normalizeDraft(parsed),
          provenance,
          verified: provenance?.verified ?? false,
        };
      }

      if (isRecord(parsed.draft)) {
        return {
          draft: normalizeDraft(parsed.draft),
          provenance: normalizeProvenance(parsed.draft.provenance) ?? provenance,
          verified:
            normalizeProvenance(parsed.draft.provenance)?.verified ??
            provenance?.verified ??
            false,
        };
      }
    }
  } catch {
    // Fall through to the plain draft parser.
  }

  const draft = parsePlainDraft(raw);

  return {
    draft,
    provenance: null,
    verified: false,
  };
}
