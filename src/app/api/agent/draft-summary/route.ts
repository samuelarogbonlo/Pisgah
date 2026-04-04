import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiDrafts } from "@/lib/db/schema";
import { generateDraft } from "@/lib/ai/generate-draft";
import {
  serializeAgentDraftEnvelope,
  type AgentDraftProvenance,
} from "@/lib/agent";
import { resolveEnsMetadataByAddress } from "@/lib/ens";
import {
  getAgentDraftEndpoint,
  recordAgentRequest,
  verifyAgentkitRequest,
} from "@/lib/agent/signer";

export async function POST(request: Request) {
  try {
    const header = request.headers.get("agentkit");
    if (!header) {
      return NextResponse.json({ error: "Missing AgentKit header" }, { status: 401 });
    }

    const { payload, humanId } = await verifyAgentkitRequest(
      header,
      getAgentDraftEndpoint(),
    );
    await recordAgentRequest({
      agentAddress: payload.address,
      nonce: payload.nonce,
      uri: payload.uri,
    });

    const body = (await request.json()) as {
      orderId?: string;
      resultId?: string;
      rawText?: string;
      testType?: string;
      patientName?: string;
    };

    if (!body.orderId || !body.resultId || !body.rawText || !body.testType || !body.patientName) {
      return NextResponse.json({ error: "Missing draft input fields" }, { status: 400 });
    }

    const ensMetadata = await resolveEnsMetadataByAddress(
      payload.address as `0x${string}`,
    );
    if (!ensMetadata.verified || !ensMetadata.ensName) {
      return NextResponse.json(
        { error: "Agent ENS metadata is not verified" },
        { status: 403 },
      );
    }

    const draft = await generateDraft({
      rawText: body.rawText,
      testType: body.testType,
      patientName: body.patientName,
    });
    const provenance: AgentDraftProvenance = {
      kind: "agentkit",
      verified: true,
      agentAddress: payload.address,
      agentEnsName: ensMetadata.ensName,
      agentHumanId: humanId,
      chainId: payload.chainId,
      requestUrl: request.url,
      issuedAt: payload.issuedAt,
      textRecords: ensMetadata.textRecords,
      issues: ensMetadata.issues,
    };
    const draftText = serializeAgentDraftEnvelope(draft, provenance);

    await db.delete(aiDrafts).where(eq(aiDrafts.orderId, body.orderId));
    await db.insert(aiDrafts).values({
      orderId: body.orderId,
      resultId: body.resultId,
      draftText,
      agentVerified: true,
    });

    return NextResponse.json({
      success: true,
      draftText,
      agentVerified: true,
      agentAddress: payload.address,
      provenance,
    });
  } catch (error) {
    console.error("[agent/draft-summary]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate verified draft",
      },
      { status: 500 },
    );
  }
}
