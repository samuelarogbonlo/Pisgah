import { db } from "../db";
import { workflowEvents } from "../db/schema";

export interface WorkflowEventParams {
  orderId: string;
  eventType: string;
  actorId?: string;
  actorRole?: string;
  metadata?: Record<string, unknown>;
}

export async function logWorkflowEvent(params: WorkflowEventParams) {
  const [event] = await db
    .insert(workflowEvents)
    .values(params)
    .returning();

  return event;
}
