// Workflow state machine for diagnostic orders.
// Zero dependencies — pure TypeScript logic only.

export const ORDER_STATUSES = [
  "CREATED",
  "AWAITING_PAYMENT",
  "PAID",
  "ROUTED_TO_LAB",
  "SAMPLE_COLLECTED",
  "RESULT_UPLOADED",
  "DOCTOR_REVIEW",
  "ACTION_PLAN_APPROVED",
  "PATIENT_NOTIFIED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ROLES = [
  "doctor",
  "accounts",
  "lab_tech",
  "pharmacist",
  "admin",
  "system",
] as const;

export type Role = (typeof ROLES)[number];

const TERMINAL_STATUSES: ReadonlySet<OrderStatus> = new Set([
  "COMPLETED",
  "CANCELLED",
]);

interface TransitionRule {
  to: OrderStatus;
  allowedRoles: ReadonlySet<Role>;
}

/**
 * Map from a source status to all valid transition rules.
 * Each rule specifies the target status and which roles may trigger it.
 */
export const TRANSITIONS: ReadonlyMap<OrderStatus, readonly TransitionRule[]> =
  new Map<OrderStatus, TransitionRule[]>([
    [
      "CREATED",
      [{ to: "AWAITING_PAYMENT", allowedRoles: new Set(["system"]) }],
    ],
    ["AWAITING_PAYMENT", [{ to: "PAID", allowedRoles: new Set(["accounts", "admin"]) }]],
    ["PAID", [{ to: "ROUTED_TO_LAB", allowedRoles: new Set(["system"]) }]],
    [
      "ROUTED_TO_LAB",
      [{ to: "SAMPLE_COLLECTED", allowedRoles: new Set(["lab_tech"]) }],
    ],
    [
      "SAMPLE_COLLECTED",
      [{ to: "RESULT_UPLOADED", allowedRoles: new Set(["lab_tech"]) }],
    ],
    [
      "RESULT_UPLOADED",
      [{ to: "DOCTOR_REVIEW", allowedRoles: new Set(["system"]) }],
    ],
    [
      "DOCTOR_REVIEW",
      [{ to: "ACTION_PLAN_APPROVED", allowedRoles: new Set(["doctor"]) }],
    ],
    [
      "ACTION_PLAN_APPROVED",
      [{ to: "PATIENT_NOTIFIED", allowedRoles: new Set(["system"]) }],
    ],
    [
      "PATIENT_NOTIFIED",
      [{ to: "COMPLETED", allowedRoles: new Set(["system"]) }],
    ],
  ]);

const CANCEL_ROLES: ReadonlySet<Role> = new Set(["doctor", "admin"]);

/**
 * Returns true if the given status is terminal (no further transitions possible).
 */
export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

/**
 * Checks whether a transition from `current` to `next` is allowed for the given role.
 */
export function canTransition(
  current: OrderStatus,
  next: OrderStatus,
  role: Role,
): boolean {
  if (isTerminal(current)) return false;

  // Cancellation from any non-terminal status
  if (next === "CANCELLED") {
    return CANCEL_ROLES.has(role);
  }

  const rules = TRANSITIONS.get(current);
  if (!rules) return false;

  return rules.some(
    (rule) => rule.to === next && rule.allowedRoles.has(role),
  );
}

/**
 * Returns every status the given role can transition to from the current status.
 */
export function getNextStatuses(
  current: OrderStatus,
  role: Role,
): OrderStatus[] {
  if (isTerminal(current)) return [];

  const result: OrderStatus[] = [];

  const rules = TRANSITIONS.get(current);
  if (rules) {
    for (const rule of rules) {
      if (rule.allowedRoles.has(role)) {
        result.push(rule.to);
      }
    }
  }

  // Any non-terminal status can be cancelled by doctor or admin
  if (CANCEL_ROLES.has(role)) {
    result.push("CANCELLED");
  }

  return result;
}
