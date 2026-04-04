import { NextResponse } from "next/server";
import { finalizePayment } from "@/lib/payments/finalize";
import { verifyWorldPaymentTransaction } from "@/lib/payments/world";
import { requirePatientSession } from "@/lib/auth/session";

type ConfirmBody = {
  orderId?: string;
  reference?: string;
  transactionId?: string;
};

export async function POST(request: Request) {
  try {
    await requirePatientSession();
    const body = (await request.json().catch(() => ({}))) as ConfirmBody;
    const reference = body.reference?.trim();
    const transactionId = body.transactionId?.trim();

    if (!reference || !transactionId) {
      return NextResponse.json(
        { error: "Missing payment reference or transaction ID" },
        { status: 400 },
      );
    }

    const verification = await verifyWorldPaymentTransaction(
      transactionId,
      reference,
    );

    const finalized = await finalizePayment({
      provider: "world",
      reference,
      providerPaymentId: transactionId,
      payerWallet: verification.payerWallet,
      providerStatus: verification.status,
      verified: verification.verified,
      currency: "USDCE",
      raw: verification.raw,
      source: "world-confirm",
    });

    if (!finalized.success) {
      return NextResponse.json(
        { error: "World payment is not finalized yet", status: verification.status },
        { status: 409 },
      );
    }

    return NextResponse.json(finalized);
  } catch (error) {
    console.error("[payments/world/confirm]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to confirm World payment",
      },
      { status: 400 },
    );
  }
}
