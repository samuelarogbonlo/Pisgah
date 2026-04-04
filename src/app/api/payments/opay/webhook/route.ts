import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  hospitalPaymentSettings,
  hospitals,
  paymentTransactions,
} from "@/lib/db/schema";
import { finalizePayment } from "@/lib/payments/finalize";
import {
  type OpayCallbackEnvelope,
  queryOpayPaymentStatus,
  verifyOpayCallbackSignature,
} from "@/lib/payments/opay";

async function getMerchantIdForReference(reference: string) {
  const [row] = await db
    .select({
      merchantId: hospitalPaymentSettings.opayMerchantId,
    })
    .from(paymentTransactions)
    .innerJoin(hospitals, eq(paymentTransactions.hospitalId, hospitals.id))
    .innerJoin(
      hospitalPaymentSettings,
      eq(hospitalPaymentSettings.hospitalId, hospitals.id),
    )
    .where(
      and(
        eq(paymentTransactions.provider, "opay"),
        eq(paymentTransactions.providerReference, reference),
      ),
    )
    .limit(1);

  return row?.merchantId ?? null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as OpayCallbackEnvelope | null;

    if (!body?.payload || !body.sha512) {
      return NextResponse.json({ error: "Invalid callback payload" }, { status: 400 });
    }

    if (!verifyOpayCallbackSignature(body)) {
      return NextResponse.json({ error: "Invalid callback signature" }, { status: 401 });
    }

    const reference = body.payload.reference?.trim();
    if (!reference) {
      return NextResponse.json({ error: "Missing payment reference" }, { status: 400 });
    }

    const merchantId = await getMerchantIdForReference(reference);
    const status = await queryOpayPaymentStatus(reference, merchantId);
    const verified = status.status === "SUCCESS";

    await finalizePayment({
      provider: "opay",
      reference,
      providerPaymentId: status.transactionId ?? body.payload.transactionId ?? body.payload.orderNo ?? null,
      providerStatus: status.status ?? body.payload.status ?? "UNKNOWN",
      verified,
      amountMinorUnits: status.amountMinorUnits,
      currency: status.currency,
      raw: {
        callback: body,
        status,
      },
      source: "opay-webhook",
    });

    return NextResponse.json({ success: true, verified });
  } catch (error) {
    console.error("[payments/opay/webhook]", error);
    return NextResponse.json(
      { error: "Unable to process OPay webhook" },
      { status: 500 },
    );
  }
}
