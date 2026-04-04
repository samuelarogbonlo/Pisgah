import { NextResponse } from "next/server";
import { requirePatientSession } from "@/lib/auth/session";
import { prepareWorldPaymentForPatient } from "@/lib/payments/world";

type PrepareBody = {
  orderId?: string;
};

export async function POST(request: Request) {
  try {
    const patientSession = await requirePatientSession();
    const body = (await request.json().catch(() => ({}))) as PrepareBody;
    const orderId = body.orderId?.trim();

    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    const prepared = await prepareWorldPaymentForPatient({
      orderId,
      patientId: patientSession.patientId,
    });

    return NextResponse.json({
      success: true,
      ...prepared,
    });
  } catch (error) {
    console.error("[payments/world/prepare]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to prepare World payment",
      },
      { status: 400 },
    );
  }
}
