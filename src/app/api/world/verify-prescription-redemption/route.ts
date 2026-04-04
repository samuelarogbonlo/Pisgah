import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import type { IDKitResult } from "@worldcoin/idkit";
import { requirePatientSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { prescriptions, worldIdVerifications } from "@/lib/db/schema";
import {
  buildWorldIdRequest,
  extractWorldProofRecord,
  verifyWorldIdResult,
} from "@/lib/world/idkit";

export async function GET(request: Request) {
  const patientSession = await requirePatientSession();
  const { searchParams } = new URL(request.url);
  const prescriptionId = searchParams.get("prescriptionId");

  if (!prescriptionId) {
    return NextResponse.json({ error: "Missing prescriptionId" }, { status: 400 });
  }

  const [prescription] = await db
    .select({ id: prescriptions.id })
    .from(prescriptions)
    .where(
      and(
        eq(prescriptions.id, prescriptionId),
        eq(prescriptions.patientId, patientSession.patientId),
      ),
    )
    .limit(1);

  if (!prescription) {
    return NextResponse.json({ error: "Prescription not found" }, { status: 404 });
  }

  return NextResponse.json(buildWorldIdRequest("redeem-prescription"));
}

export async function POST(request: Request) {
  try {
    const patientSession = await requirePatientSession();
    const body = (await request.json()) as {
      prescriptionId?: string;
      result?: IDKitResult;
    };

    if (!body.prescriptionId || !body.result) {
      return NextResponse.json({ error: "Missing prescription or proof" }, { status: 400 });
    }

    const [prescription] = await db
      .select({ id: prescriptions.id })
      .from(prescriptions)
      .where(
        and(
          eq(prescriptions.id, body.prescriptionId),
          eq(prescriptions.patientId, patientSession.patientId),
        ),
      )
      .limit(1);

    if (!prescription) {
      return NextResponse.json({ error: "Prescription not found" }, { status: 404 });
    }

    const verification = await verifyWorldIdResult(body.result);
    if (!verification.verified) {
      return NextResponse.json({ error: "World verification failed" }, { status: 401 });
    }

    const proof = extractWorldProofRecord(body.result);
    await db.insert(worldIdVerifications).values({
      patientId: patientSession.patientId,
      action: "redeem-prescription",
      prescriptionId: body.prescriptionId,
      nullifierHash: proof.nullifierHash ?? `missing-${crypto.randomUUID()}`,
      merkleRoot: proof.merkleRoot,
      verifiedAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[world/verify-prescription-redemption]", error);
    return NextResponse.json({ error: "Unable to verify World ID proof" }, { status: 500 });
  }
}
