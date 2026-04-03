import { eq } from "drizzle-orm";
import { db } from "../db";
import { diagnosticOrders } from "../db/schema";
import { canTransition, OrderStatus, Role } from "./machine";
import { logWorkflowEvent } from "./events";

type DiagnosticOrder = typeof diagnosticOrders.$inferSelect;

interface TransitionParams {
  orderId: string;
  nextStatus: OrderStatus;
  actorId: string;
  actorRole: Role;
}

interface TransitionResult {
  success: boolean;
  order?: DiagnosticOrder;
  error?: string;
}

export async function transitionOrder(
  params: TransitionParams,
): Promise<TransitionResult> {
  const { orderId, nextStatus, actorId, actorRole } = params;

  // 1. Fetch current order
  const [order] = await db
    .select()
    .from(diagnosticOrders)
    .where(eq(diagnosticOrders.id, orderId))
    .limit(1);

  if (!order) {
    return { success: false, error: `Order ${orderId} not found` };
  }

  const currentStatus = order.status as OrderStatus;

  // 2. Validate transition
  if (!canTransition(currentStatus, nextStatus, actorRole)) {
    return {
      success: false,
      error: `Transition from ${currentStatus} to ${nextStatus} is not allowed for role ${actorRole}`,
    };
  }

  // 3. Update status + updated_at
  const [updated] = await db
    .update(diagnosticOrders)
    .set({ status: nextStatus, updatedAt: new Date() })
    .where(eq(diagnosticOrders.id, orderId))
    .returning();

  // 4. Log workflow event
  await logWorkflowEvent({
    orderId,
    eventType: `STATUS_CHANGE:${currentStatus}->${nextStatus}`,
    actorId,
    actorRole,
    metadata: {
      previousStatus: currentStatus,
      newStatus: nextStatus,
    },
  });

  // 5. Return result
  return { success: true, order: updated };
}
