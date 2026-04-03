"use client";

import { useEffect, useState } from "react";
import { getTimelineEvents } from "./timeline-action";

type TimelineEvent = {
  id: string;
  eventType: string;
  actorRole: string | null;
  createdAt: string | null;
};

const EVENT_LABELS: Record<string, string> = {
  ORDER_CREATED: "Order created",
  PAID: "Payment confirmed",
  ROUTED_TO_LAB: "Routed to lab",
  SAMPLE_COLLECTED: "Sample collected",
  RESULT_UPLOADED: "Result uploaded",
  DOCTOR_REVIEW: "Sent for doctor review",
  ACTION_PLAN_APPROVED: "Action plan approved",
  PATIENT_NOTIFIED: "Patient notified",
  COMPLETED: "Order completed",
  CANCELLED: "Order cancelled",
};

function parseEventLabel(eventType: string): string {
  if (eventType === "ORDER_CREATED") return EVENT_LABELS.ORDER_CREATED;

  const statusMatch = eventType.match(/STATUS_CHANGE:.*?[→>](.+)/);
  if (statusMatch) {
    const target = statusMatch[1].trim();
    return (
      EVENT_LABELS[target] ??
      `Status changed to ${target.replace(/_/g, " ").toLowerCase()}`
    );
  }

  return eventType
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-NG", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function roleLabel(role: string | null): string {
  if (!role) return "";
  if (role === "system") return "";
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function TimelinePanel({ orderId }: { orderId: string }) {
  const [events, setEvents] = useState<TimelineEvent[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getTimelineEvents(orderId).then(
      (data) => {
        if (!cancelled) setEvents(data);
      },
      () => {
        if (!cancelled) setError(true);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (error) {
    return <p className="text-xs text-red-500">Failed to load timeline.</p>;
  }

  if (!events) {
    return <p className="text-xs text-gray-400">Loading timeline...</p>;
  }

  if (events.length === 0) {
    return (
      <p className="text-xs text-gray-400">No workflow events recorded.</p>
    );
  }

  return (
    <div className="relative pl-5 py-1">
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-300" />

      {events.map((event) => (
        <div
          key={event.id}
          className="relative flex items-start gap-3 pb-2.5 last:pb-0"
        >
          <div className="absolute left-[-15px] top-[5px] h-[9px] w-[9px] rounded-full border border-gray-400 bg-white shrink-0" />
          <div className="min-w-0">
            <span className="text-xs text-gray-800">
              {parseEventLabel(event.eventType)}
            </span>
            <span className="ml-2 text-[11px] text-gray-400">
              {formatTime(event.createdAt)}
            </span>
            {event.actorRole && event.actorRole !== "system" && (
              <span className="ml-2 text-[11px] text-gray-400">
                by {roleLabel(event.actorRole)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
