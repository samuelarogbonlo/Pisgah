"use server";

import { db } from "@/lib/db";
import { workflowEvents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function getTimelineEvents(orderId: string) {
  const events = await db
    .select({
      id: workflowEvents.id,
      eventType: workflowEvents.eventType,
      actorRole: workflowEvents.actorRole,
      createdAt: workflowEvents.createdAt,
    })
    .from(workflowEvents)
    .where(eq(workflowEvents.orderId, orderId))
    .orderBy(workflowEvents.createdAt);

  return events.map((e) => ({
    id: e.id,
    eventType: e.eventType,
    actorRole: e.actorRole,
    createdAt: e.createdAt?.toISOString() ?? null,
  }));
}
