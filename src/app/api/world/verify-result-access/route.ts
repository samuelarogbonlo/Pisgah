import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import type { IDKitResult } from "@worldcoin/idkit";
import { requirePatientSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { diagnosticOrders, worldIdVerifications } from "@/lib/db/schema";
import {
  buildWorldIdRequest,
  extractWorldProofRecord,
  verifyWorldIdResult,
} from "@/lib/world/idkit";

export async function GET(request: Request) {
  const patientSession = await requirePatientSession();
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");

  if (!orderId) {
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
  }

  const [order] = await db
    .select({ id: diagnosticOrders.id })
    .from(diagnosticOrders)
    .where(
      and(
        eq(diagnosticOrders.id, orderId),
        eq(diagnosticOrders.patientId, patientSession.patientId),
      ),
    )
    .limit(1);

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json(buildWorldIdRequest("view-result"));
}

export async function POST(request: Request) {
  try {
    const patientSession = await requirePatientSession();
    const body = (await request.json()) as {
      orderId?: string;
      result?: IDKitResult;
    };

    if (!body.orderId || !body.result) {
      return NextResponse.json({ error: "Missing order or proof" }, { status: 400 });
    }

    const [order] = await db
      .select({ id: diagnosticOrders.id })
      .from(diagnosticOrders)
      .where(
        and(
          eq(diagnosticOrders.id, body.orderId),
          eq(diagnosticOrders.patientId, patientSession.patientId),
        ),
      )
      .limit(1);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const verification = await verifyWorldIdResult(body.result);
    if (!verification.verified) {
      return NextResponse.json({ error: "World verification failed" }, { status: 401 });
    }

    const proof = extractWorldProofRecord(body.result);
    await db.insert(worldIdVerifications).values({
      patientId: patientSession.patientId,
      action: "view-result",
      orderId: body.orderId,
      nullifierHash: proof.nullifierHash ?? `missing-${crypto.randomUUID()}`,
      merkleRoot: proof.merkleRoot,
      verifiedAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[world/verify-result-access]", error);
    return NextResponse.json({ error: "Unable to verify World ID proof" }, { status: 500 });
  }
}
