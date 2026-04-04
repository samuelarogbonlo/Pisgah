import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  billingRecords,
  diagnosticOrders,
  paymentTransactions,
  type PaymentProvider,
} from "@/lib/db/schema";
import { logWorkflowEvent } from "@/lib/workflow/events";
import { type OrderStatus } from "@/lib/workflow/machine";
import { transitionOrder } from "@/lib/workflow/transition";

const POST_PAYMENT_STATUSES = new Set<OrderStatus>([
  "ROUTED_TO_LAB",
  "SAMPLE_COLLECTED",
  "RESULT_UPLOADED",
  "DOCTOR_REVIEW",
  "ACTION_PLAN_APPROVED",
  "PATIENT_NOTIFIED",
  "COMPLETED",
]);

type TransactionStatus =
  | "initialized"
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "expired";

export interface FinalizePaymentParams {
  provider: PaymentProvider;
  reference: string;
  providerPaymentId?: string | null;
  providerStatus?: string | null;
  verified: boolean;
  amountMinorUnits?: number | null;
  currency?: string | null;
  payerWallet?: string | null;
  raw?: unknown;
  source: string;
}

async function getBillingContext(billingId: string) {
  const [row] = await db
    .select({
      billingId: billingRecords.id,
      billingStatus: billingRecords.status,
      orderId: billingRecords.orderId,
      orderStatus: diagnosticOrders.status,
    })
    .from(billingRecords)
    .innerJoin(diagnosticOrders, eq(billingRecords.orderId, diagnosticOrders.id))
    .where(eq(billingRecords.id, billingId))
    .limit(1);

  return row;
}

async function getPaymentTransaction(provider: PaymentProvider, reference: string) {
  const [row] = await db
    .select()
    .from(paymentTransactions)
    .where(
      and(
        eq(paymentTransactions.provider, provider),
        eq(paymentTransactions.providerReference, reference),
      ),
    )
    .limit(1);

  return row;
}

function toMajorUnits(amountMinorUnits: number | null | undefined) {
  if (amountMinorUnits == null || !Number.isFinite(amountMinorUnits)) {
    return undefined;
  }

  return String(amountMinorUnits / 100);
}

function mapProviderStatusToTransactionStatus(
  verified: boolean,
  providerStatus: string | null | undefined,
): TransactionStatus {
  if (verified) {
    return "paid";
  }

  const status = providerStatus?.trim().toLowerCase() ?? "";

  if (!status || ["initialized", "pending", "processing", "submitted"].includes(status)) {
    return "pending";
  }

  if (status.includes("cancel")) {
    return "cancelled";
  }

  if (status.includes("expire")) {
    return "expired";
  }

  return "failed";
}

async function ensureOrderProgressedAfterPayment(orderId: string) {
  let [order] = await db
    .select({ status: diagnosticOrders.status })
    .from(diagnosticOrders)
    .where(eq(diagnosticOrders.id, orderId))
    .limit(1);

  if (!order) {
    return { success: false as const, error: "Order not found during payment reconciliation" };
  }

  if (order.status === "AWAITING_PAYMENT") {
    const paidResult = await transitionOrder({
      orderId,
      nextStatus: "PAID",
      actorRole: "system",
    });

    if (!paidResult.success) {
      return { success: false as const, error: paidResult.error };
    }

    order = { status: "PAID" };
  }

  if (order.status === "PAID") {
    const routedResult = await transitionOrder({
      orderId,
      nextStatus: "ROUTED_TO_LAB",
      actorRole: "system",
    });

    if (!routedResult.success) {
      return { success: false as const, error: routedResult.error };
    }

    order = { status: "ROUTED_TO_LAB" };
  }

  if (!POST_PAYMENT_STATUSES.has(order.status as OrderStatus) && order.status !== "ROUTED_TO_LAB") {
    return {
      success: false as const,
      error: `Order is in an invalid state after payment confirmation: ${order.status}`,
    };
  }

  return { success: true as const };
}

export async function finalizePayment(params: FinalizePaymentParams) {
  const reference = params.reference.trim();
  if (!reference) {
    return { success: false as const, error: "Missing payment reference" };
  }

  const transaction = await getPaymentTransaction(params.provider, reference);
  if (!transaction) {
    return { success: false as const, error: "Payment transaction not found" };
  }

  const billing = await getBillingContext(transaction.billingRecordId);
  if (!billing) {
    return { success: false as const, error: "Billing record not found" };
  }

  const finalizedAt = new Date();
  const nextStatus = mapProviderStatusToTransactionStatus(
    params.verified,
    params.providerStatus,
  );

  await db
    .update(paymentTransactions)
    .set({
      providerPaymentId: params.providerPaymentId ?? transaction.providerPaymentId,
      amount:
        params.amountMinorUnits != null
          ? toMajorUnits(params.amountMinorUnits) ?? transaction.amount
          : transaction.amount,
      currency: params.currency ?? transaction.currency,
      status: nextStatus,
      payerWallet: params.payerWallet ?? transaction.payerWallet,
      finalizedAt: nextStatus === "paid" ? finalizedAt : transaction.finalizedAt,
      failureReason:
        nextStatus === "paid"
          ? null
          : params.providerStatus ?? transaction.failureReason ?? "provider-verification-failed",
      providerPayload: {
        source: params.source,
        providerStatus: params.providerStatus ?? null,
        raw: params.raw ?? null,
      },
      updatedAt: finalizedAt,
    })
    .where(eq(paymentTransactions.id, transaction.id));

  if (!params.verified) {
    return {
      success: false as const,
      billingId: transaction.billingRecordId,
      orderId: transaction.orderId,
      paymentTransactionId: transaction.id,
      status: nextStatus,
      error: `Payment is not verified yet (${params.providerStatus ?? "unknown"})`,
    };
  }

  if (billing.billingStatus === "cash_confirmed") {
    return {
      success: false as const,
      billingId: transaction.billingRecordId,
      orderId: transaction.orderId,
      paymentTransactionId: transaction.id,
      status: "cash_confirmed",
      error: "Billing was already confirmed manually",
    };
  }

  let alreadyFinalized = billing.billingStatus === "online_confirmed";

  if (billing.billingStatus === "unpaid") {
    const [updatedBilling] = await db
      .update(billingRecords)
      .set({
        status: "online_confirmed",
        confirmedBy: null,
        confirmedAt: finalizedAt,
      })
      .where(
        and(
          eq(billingRecords.id, transaction.billingRecordId),
          eq(billingRecords.status, "unpaid"),
        ),
      )
      .returning();

    if (!updatedBilling) {
      const latestBilling = await getBillingContext(transaction.billingRecordId);
      if (!latestBilling || latestBilling.billingStatus !== "online_confirmed") {
        return {
          success: false as const,
          billingId: transaction.billingRecordId,
          orderId: transaction.orderId,
          paymentTransactionId: transaction.id,
          error: "Billing state changed while confirming payment",
        };
      }
      alreadyFinalized = true;
    } else {
      await logWorkflowEvent({
        orderId: transaction.orderId,
        eventType: "PAYMENT_ONLINE_CONFIRMED",
        actorRole: "system",
        metadata: {
          provider: transaction.provider,
          providerReference: transaction.providerReference,
          providerPaymentId: params.providerPaymentId ?? null,
          paymentTransactionId: transaction.id,
          providerStatus: params.providerStatus ?? null,
          source: params.source,
        },
      });
    }
  }

  const transitionResult = await ensureOrderProgressedAfterPayment(transaction.orderId);
  if (!transitionResult.success) {
    return {
      success: false as const,
      billingId: transaction.billingRecordId,
      orderId: transaction.orderId,
      paymentTransactionId: transaction.id,
      error: transitionResult.error,
    };
  }

  return {
    success: true as const,
    alreadyFinalized,
    billingId: transaction.billingRecordId,
    orderId: transaction.orderId,
    paymentTransactionId: transaction.id,
    status: "online_confirmed" as const,
  };
}
