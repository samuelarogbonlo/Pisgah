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
  normalizeProviderRedirectPath,
  queryOpayPaymentStatus,
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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference = url.searchParams.get("reference")?.trim();
  const redirectTo = normalizeProviderRedirectPath(url.searchParams.get("redirectTo"), "/mini");
  const statusHint = url.searchParams.get("status")?.trim().toLowerCase() ?? "pending";

  if (!reference) {
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  try {
    const merchantId = await getMerchantIdForReference(reference);
    const status = await queryOpayPaymentStatus(reference, merchantId);
    const verified = status.status === "SUCCESS";

    await finalizePayment({
      provider: "opay",
      reference,
      providerPaymentId: status.transactionId ?? status.orderNo,
      providerStatus: status.status ?? statusHint,
      verified,
      amountMinorUnits: status.amountMinorUnits,
      currency: status.currency,
      raw: status.raw,
      source: "opay-return",
    });

    const redirectStatus = verified
      ? "opay_success"
      : `opay_${(status.status ?? statusHint).toLowerCase()}`;

    return NextResponse.redirect(
      new URL(
        `${redirectTo}?payment=${redirectStatus}&reference=${encodeURIComponent(reference)}`,
        request.url,
      ),
    );
  } catch (error) {
    console.error("[payments/opay/return]", error);
    return NextResponse.redirect(
      new URL(
        `${redirectTo}?payment=opay_verification_failed&reference=${encodeURIComponent(reference)}`,
        request.url,
      ),
    );
  }
}
