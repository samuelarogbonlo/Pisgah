import { randomBytes } from "node:crypto";

export function generatePaymentReference(provider: "opay" | "world") {
  const timestamp = Date.now().toString(36);
  const suffix = randomBytes(6).toString("hex");
  return `${provider}_${timestamp}_${suffix}`;
}
