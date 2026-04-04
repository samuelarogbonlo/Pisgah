import { and, eq } from "drizzle-orm";
import { Network, Tokens } from "@worldcoin/minikit-js/commands";
import { db } from "@/lib/db";
import {
  billingRecords,
  diagnosticOrders,
  facilities,
  hospitalPaymentSettings,
  hospitals,
  paymentTransactions,
} from "@/lib/db/schema";
import { getWorldAppId } from "@/lib/world/idkit";
import { generatePaymentReference } from "./reference";

export type PreparedWorldPayment = {
  orderId: string;
  billingId: string;
  nairaAmount: string;
  usdcAmount: string;
  recipientName: string;
  payment: {
    reference: string;
    to: `0x${string}`;
    tokens: Array<{
      symbol: Tokens;
      token_amount: string;
    }>;
    description: string;
    network: Network;
  };
};

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

export function getWorldPaymentRecipientAddress() {
  return requireEnv("WORLD_PAYMENT_RECIPIENT_ADDRESS") as `0x${string}`;
}

function getWorldUsdcRate() {
  const raw = process.env.WORLD_USDC_NAIRA_RATE?.trim();
  const parsed = raw ? Number(raw) : 1600;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("WORLD_USDC_NAIRA_RATE must be a positive number");
  }

  return parsed;
}

function formatUsdcAmount(nairaAmount: string | number) {
  const numeric = typeof nairaAmount === "string" ? Number(nairaAmount) : nairaAmount;
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error("Invalid bill amount");
  }

  const usdc = numeric / getWorldUsdcRate();
  const precision = usdc >= 1 ? 2 : 4;
  return usdc.toFixed(precision).replace(/\.?0+$/, "");
}

function normalizeWorldTxStatus(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : null;
}

function extractReference(payload: Record<string, unknown>) {
  if (typeof payload.reference === "string") {
    return payload.reference;
  }

  const transaction = payload.transaction;
  if (transaction && typeof transaction === "object") {
    const nested = transaction as Record<string, unknown>;
    if (typeof nested.reference === "string") {
      return nested.reference;
    }
  }

  return null;
}

function extractPayerWallet(payload: Record<string, unknown>) {
  if (typeof payload.from === "string") {
    return payload.from;
  }

  const transaction = payload.transaction;
  if (transaction && typeof transaction === "object") {
    const nested = transaction as Record<string, unknown>;
    if (typeof nested.from === "string") {
      return nested.from;
    }
    if (typeof nested.sender === "string") {
      return nested.sender;
    }
  }

  return null;
}

async function fetchWorldTransaction(transactionId: string) {
  const appId = getWorldAppId();
  const response = await fetch(
    `https://developer.worldcoin.org/api/v2/minikit/transaction/${transactionId}?app_id=${appId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${requireEnv("WORLD_API_KEY")}`,
      },
      cache: "no-store",
    },
  );

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;

  if (!response.ok || !payload) {
    throw new Error("Unable to verify World payment");
  }

  return payload;
}

export async function verifyWorldPaymentTransaction(
  transactionId: string,
  expectedReference: string,
) {
  let payload = await fetchWorldTransaction(transactionId);
  let status = normalizeWorldTxStatus(
    payload.transaction_status ?? payload.status ?? payload.transactionStatus,
  );

  for (let attempt = 0; attempt < 4 && status === "submitted"; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    payload = await fetchWorldTransaction(transactionId);
    status = normalizeWorldTxStatus(
      payload.transaction_status ?? payload.status ?? payload.transactionStatus,
    );
  }

  const reference = extractReference(payload);
  if (reference && reference !== expectedReference) {
    throw new Error("World payment reference does not match this bill");
  }

  return {
    verified: status === "mined" || status === "confirmed" || status === "success",
    status: status ?? "unknown",
    payerWallet: extractPayerWallet(payload),
    raw: payload,
  };
}

export async function prepareWorldPaymentForPatient(params: {
  orderId: string;
  patientId: string;
}) {
  const [record] = await db
    .select({
      orderId: diagnosticOrders.id,
      orderStatus: diagnosticOrders.status,
      testType: diagnosticOrders.testType,
      patientId: diagnosticOrders.patientId,
      billingId: billingRecords.id,
      billingStatus: billingRecords.status,
      amount: billingRecords.amount,
      hospitalName: hospitals.name,
      hospitalId: hospitals.id,
      worldPayEnabled: hospitalPaymentSettings.worldPayEnabled,
    })
    .from(diagnosticOrders)
    .innerJoin(billingRecords, eq(billingRecords.orderId, diagnosticOrders.id))
    .innerJoin(facilities, eq(diagnosticOrders.facilityId, facilities.id))
    .innerJoin(hospitals, eq(facilities.hospitalId, hospitals.id))
    .innerJoin(
      hospitalPaymentSettings,
      eq(hospitalPaymentSettings.hospitalId, hospitals.id),
    )
    .where(
      and(
        eq(diagnosticOrders.id, params.orderId),
        eq(diagnosticOrders.patientId, params.patientId),
      ),
    )
    .limit(1);

  if (!record) {
    throw new Error("Order is not available for this patient");
  }

  if (record.orderStatus !== "AWAITING_PAYMENT" || record.billingStatus !== "unpaid") {
    throw new Error("This bill is no longer awaiting payment");
  }

  if (!record.worldPayEnabled) {
    throw new Error("World App payment is not enabled for this hospital");
  }

  const reference = generatePaymentReference("world");
  const usdcAmount = formatUsdcAmount(record.amount);

  await db.insert(paymentTransactions).values({
    hospitalId: record.hospitalId,
    billingRecordId: record.billingId,
    orderId: record.orderId,
    provider: "world",
    providerReference: reference,
    amount: usdcAmount,
    currency: Tokens.USDC,
    status: "initialized",
  });

  return {
    orderId: record.orderId,
    billingId: record.billingId,
    nairaAmount: record.amount,
    usdcAmount,
    recipientName: record.hospitalName,
    payment: {
      reference,
      to: getWorldPaymentRecipientAddress(),
      tokens: [
        {
          symbol: Tokens.USDC,
          token_amount: usdcAmount,
        },
      ],
      description: `Pisgah payment for ${record.testType} at ${record.hospitalName}`,
      network: Network.WorldChain,
    },
  } satisfies PreparedWorldPayment;
}
