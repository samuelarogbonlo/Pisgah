import { randomUUID } from "node:crypto";
import { Wallet } from "ethers";
import {
  createAgentBookVerifier,
  formatSIWEMessage,
  parseAgentkitHeader,
  validateAgentkitMessage,
  verifyAgentkitSignature,
} from "@worldcoin/agentkit";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { agentRequestLog } from "@/lib/db/schema";

export function getAgentDraftEndpoint() {
  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${baseUrl}/api/agent/draft-summary`;
}

export async function buildAgentkitHeader(resourceUri = getAgentDraftEndpoint()) {
  const privateKey = process.env.AGENT_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("Missing AGENT_PRIVATE_KEY");
  }

  const wallet = new Wallet(privateKey);
  const url = new URL(resourceUri);
  const info = {
    domain: url.hostname,
    uri: resourceUri,
    statement: "Pisgah verified clinic assistant draft request",
    version: "1",
    chainId: "eip155:480",
    type: "eip191" as const,
    nonce: randomUUID().replace(/-/g, ""),
    issuedAt: new Date().toISOString(),
    resources: [resourceUri],
  };

  const message = formatSIWEMessage(info, wallet.address);
  const signature = await wallet.signMessage(message);

  return Buffer.from(
    JSON.stringify({
      ...info,
      address: wallet.address,
      signature,
    }),
  ).toString("base64");
}

async function hasUsedNonce(nonce: string) {
  const [existing] = await db
    .select({ id: agentRequestLog.id })
    .from(agentRequestLog)
    .where(and(eq(agentRequestLog.nonce, nonce), isNotNull(agentRequestLog.usedAt)))
    .limit(1);

  return Boolean(existing);
}

export async function verifyAgentkitRequest(header: string, resourceUri = getAgentDraftEndpoint()) {
  const payload = parseAgentkitHeader(header);
  const validation = await validateAgentkitMessage(payload, resourceUri, {
    checkNonce: async (nonce) => !(await hasUsedNonce(nonce)),
  });

  if (!validation.valid) {
    throw new Error(validation.error || "Invalid AgentKit message");
  }

  const verification = await verifyAgentkitSignature(
    payload,
    process.env.WORLD_CHAIN_RPC_URL || "https://worldchain-mainnet.g.alchemy.com/public",
  );
  if (!verification.valid) {
    throw new Error(verification.error || "Invalid AgentKit signature");
  }

  const verifier = createAgentBookVerifier({
    rpcUrl:
      process.env.WORLD_CHAIN_RPC_URL || "https://worldchain-mainnet.g.alchemy.com/public",
  });
  const humanId = await verifier.lookupHuman(payload.address, payload.chainId);
  if (!humanId) {
    throw new Error("Agent is not registered in AgentBook");
  }

  return { payload, humanId };
}

export async function recordAgentRequest(params: {
  agentAddress: string;
  nonce: string;
  uri: string;
}) {
  await db.insert(agentRequestLog).values({
    agentAddress: params.agentAddress,
    nonce: params.nonce,
    uri: params.uri,
    issuedAt: new Date(),
    usedAt: new Date(),
  });
}
