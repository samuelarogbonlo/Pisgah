import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiDrafts } from "@/lib/db/schema";
import { generateDraft } from "@/lib/ai/generate-draft";
import {
  serializeAgentDraftEnvelope,
  type AgentDraftProvenance,
} from "@/lib/agent";
import { verifyAgentEns } from "@/lib/ens";
import {
  buildAgentkitHeader,
  getAgentDraftEndpoint,
  recordAgentRequest,
  verifyAgentkitRequest,
} from "@/lib/agent/signer";

interface VerifiedDraftInput {
  orderId: string;
  resultId: string;
  rawText: string;
  testType: string;
  patientName: string;
  agentPrivateKey?: string;
  agentEnsName?: string;
}

interface VerifiedDraftResult {
  success: boolean;
  error?: string;
  draftText?: string;
  agentVerified?: boolean;
  provenance?: AgentDraftProvenance;
}

/**
 * Core function: signs as the agent, verifies AgentKit + ENS, generates AI draft, stores in DB.
 * Called directly from server actions (no HTTP round-trip).
 * Also usable from the API route as a thin wrapper.
 */
export async function generateVerifiedAgentDraft(
  input: VerifiedDraftInput,
): Promise<VerifiedDraftResult> {
  // 1. Build the signed AgentKit header (agent wallet signs CAIP-122 message)
  const resourceUri = getAgentDraftEndpoint();
  let header: string;
  try {
    header = await buildAgentkitHeader(resourceUri, input.agentPrivateKey);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to build AgentKit header";
    console.error("[agent/draft] header build failed:", msg);
    return { success: false, error: msg };
  }

  // 2. Verify the AgentKit header (signature + AgentBook human-backed check)
  let payload: Awaited<ReturnType<typeof verifyAgentkitRequest>>["payload"];
  let humanId: string | null;
  try {
    const result = await verifyAgentkitRequest(header, resourceUri);
    payload = result.payload;
    humanId = result.humanId;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AgentKit verification failed";
    console.error("[agent/draft] AgentKit verification failed:", msg);
    return { success: false, error: msg };
  }

  // 3. Record the nonce to prevent replay
  try {
    await recordAgentRequest({
      agentAddress: payload.address,
      nonce: payload.nonce,
      uri: payload.uri,
    });
  } catch (err) {
    console.error("[agent/draft] nonce recording failed:", err);
    // Non-fatal — continue
  }

  // 4. Forward-resolve agent ENS identity (non-blocking — AgentKit already verified)
  const agentEnsName = input.agentEnsName ?? process.env.AGENT_ENS_NAME;
  let ensResult: Awaited<ReturnType<typeof verifyAgentEns>> | null = null;
  if (agentEnsName) {
    try {
      ensResult = await verifyAgentEns(agentEnsName, payload.address);
      if (!ensResult.verified) {
        console.warn("[agent/draft] ENS verification soft-failed:", ensResult.error);
      }
    } catch (err) {
      console.warn("[agent/draft] ENS verification error (continuing):", err);
    }
  }

  // 5. Generate AI draft via Claude
  console.log("[agent/draft] calling Claude for AI draft...");
  const draft = await generateDraft({
    rawText: input.rawText,
    testType: input.testType,
    patientName: input.patientName,
  });
  console.log("[agent/draft] Claude draft generated, storing in DB...");

  // 6. Build provenance
  const ensVerified = ensResult?.verified ?? false;
  const provenance: AgentDraftProvenance = {
    kind: "agentkit",
    verified: true,
    agentAddress: payload.address,
    agentEnsName: ensResult?.ensName ?? agentEnsName ?? null,
    agentHumanId: humanId,
    chainId: payload.chainId,
    requestUrl: resourceUri,
    issuedAt: payload.issuedAt,
    textRecords: ensResult?.textRecords ?? {},
    issues: ensVerified ? [] : [ensResult?.error ?? "ENS verification skipped"],
  };

  const draftText = serializeAgentDraftEnvelope(draft, provenance);

  // 7. Store in DB (delete old draft for this order, insert new)
  await db.delete(aiDrafts).where(eq(aiDrafts.orderId, input.orderId));
  await db.insert(aiDrafts).values({
    orderId: input.orderId,
    resultId: input.resultId,
    draftText,
    agentVerified: true,
  });

  return {
    success: true,
    draftText,
    agentVerified: true,
    provenance,
  };
}
