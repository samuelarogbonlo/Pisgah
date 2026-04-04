"use server";

import { db } from "@/lib/db";
import { diagnosticOrders, labResults, prescriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface OrderProvenance {
  labResultUid: string | null;
  prescriptionUid: string | null;
  deliveryUid: string | null;
}

export async function getOrderProvenance(
  orderId: string,
): Promise<OrderProvenance> {
  const [labResult] = await db
    .select({ attestationUid: labResults.attestationUid })
    .from(labResults)
    .where(eq(labResults.orderId, orderId))
    .limit(1);

  const [prescription] = await db
    .select({ attestationUid: prescriptions.attestationUid })
    .from(prescriptions)
    .where(eq(prescriptions.orderId, orderId))
    .limit(1);

  const [order] = await db
    .select({ attestationUid: diagnosticOrders.attestationUid })
    .from(diagnosticOrders)
    .where(eq(diagnosticOrders.id, orderId))
    .limit(1);

  return {
    labResultUid: labResult?.attestationUid ?? null,
    prescriptionUid: prescription?.attestationUid ?? null,
    deliveryUid: order?.attestationUid ?? null,
  };
}
