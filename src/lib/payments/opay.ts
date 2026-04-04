import { createHmac, timingSafeEqual } from "node:crypto";

export const OPAY_COUNTRY = "NG";
export const OPAY_CURRENCY = "NGN";

export type OpayEnvironment = "sandbox" | "production";

export type OpayCustomerInfo = {
  userId?: string | null;
  userName?: string | null;
  userMobile?: string | null;
  userEmail?: string | null;
};

export type OpayInitializeInput = {
  merchantId?: string | null;
  reference: string;
  amountMinorUnits: number;
  productName: string;
  productDescription: string;
  displayName?: string | null;
  returnTo?: string | null;
  cancelTo?: string | null;
  callbackOverride?: string | null;
  customer?: OpayCustomerInfo;
  expireAtMinutes?: number;
};

export type OpayInitializeResult = {
  code: string;
  message: string;
  reference: string;
  orderNo: string | null;
  cashierUrl: string | null;
  raw: unknown;
};

export type OpayCallbackPayload = {
  amount?: string | number | { total?: string | number; currency?: string };
  channel?: string;
  country?: string;
  currency?: string;
  displayedFailure?: string;
  fee?: string | number;
  feeCurrency?: string;
  instrumentType?: string;
  reference?: string;
  refunded?: boolean;
  status?: string;
  timestamp?: string;
  token?: string | null;
  transactionId?: string;
  updated_at?: string;
  orderNo?: string;
};

export type OpayCallbackEnvelope = {
  payload?: OpayCallbackPayload;
  sha512?: string;
  type?: string;
};

export type OpayPaymentStatus = {
  code: string;
  message: string;
  reference: string | null;
  orderNo: string | null;
  status: string | null;
  transactionId: string | null;
  token: string | null;
  amountMinorUnits: number | null;
  currency: string | null;
  raw: unknown;
};

export type FinalizeWithSharedHelperInput = {
  reference: string;
  orderNo?: string | null;
  transactionId?: string | null;
  status?: string | null;
  amountMinorUnits?: number | null;
  currency?: string | null;
  source: "return" | "webhook";
  raw?: unknown;
};

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

export function getOpayMerchantId() {
  return requireEnv("OPAY_MERCHANT_ID");
}

export function getOpayPublicKey() {
  return requireEnv("OPAY_PUBLIC_KEY");
}

export function getOpaySecretKey() {
  return process.env.OPAY_SECRET_KEY?.trim() || requireEnv("OPAY_PRIVATE_KEY");
}

export function getOpayEnvironment(): OpayEnvironment {
  const explicit = process.env.OPAY_ENVIRONMENT?.trim().toLowerCase();
  if (explicit === "production" || explicit === "sandbox") {
    return explicit;
  }

  return process.env.NODE_ENV === "production" ? "production" : "sandbox";
}

export function getOpayApiBaseUrl() {
  return getOpayEnvironment() === "production"
    ? "https://api.opaycheckout.com"
    : "https://sandboxapi.opaycheckout.com";
}

export function getAppBaseUrl() {
  return (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export function toMinorUnits(amount: string | number) {
  const numeric = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(numeric)) {
    throw new Error("Invalid amount");
  }

  return Math.round(numeric * 100);
}

export function normalizeProviderRedirectPath(
  value: string | null | undefined,
  fallback = "/mini",
) {
  if (!value) return fallback;

  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  return trimmed;
}

export function buildOpayReturnUrl(
  reference: string,
  redirectTo?: string | null,
) {
  const url = new URL("/api/payments/opay/return", getAppBaseUrl());
  url.searchParams.set("reference", reference);

  if (redirectTo) {
    url.searchParams.set("redirectTo", normalizeProviderRedirectPath(redirectTo));
  }

  return url.toString();
}

export function buildOpayCallbackUrl() {
  return new URL("/api/payments/opay/webhook", getAppBaseUrl()).toString();
}

export function buildOpayCancelUrl(
  reference: string,
  redirectTo?: string | null,
) {
  const url = new URL("/api/payments/opay/return", getAppBaseUrl());
  url.searchParams.set("reference", reference);
  url.searchParams.set("status", "cancelled");

  if (redirectTo) {
    url.searchParams.set("redirectTo", normalizeProviderRedirectPath(redirectTo));
  }

  return url.toString();
}

function signHmacSha512(data: string, secret: string) {
  return createHmac("sha512", secret).update(data).digest("hex");
}

function buildStatusSignature(body: unknown) {
  return signHmacSha512(JSON.stringify(body), getOpaySecretKey());
}

export function verifyOpayCallbackSignature(envelope: OpayCallbackEnvelope) {
  const payload = envelope.payload;
  const signature = envelope.sha512?.trim().toLowerCase();

  if (!payload || !signature || !/^[a-f0-9]+$/i.test(signature)) {
    return false;
  }

  const computed = signHmacSha512(JSON.stringify(payload), getOpaySecretKey());
  if (computed.length !== signature.length) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(computed, "hex"),
    Buffer.from(signature, "hex"),
  );
}

function normalizeOpayStatus(value: unknown) {
  const status = typeof value === "string" ? value.trim().toUpperCase() : null;
  if (!status) return null;

  if (status === "SUCCESSFUL") return "SUCCESS";
  return status;
}

function parseMinorUnits(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (value && typeof value === "object") {
    const amount = value as Record<string, unknown>;
    return parseMinorUnits(amount.total);
  }

  return null;
}

function parseCurrency(amountValue: unknown, fallback: unknown) {
  if (amountValue && typeof amountValue === "object") {
    const amount = amountValue as Record<string, unknown>;
    if (typeof amount.currency === "string" && amount.currency.trim()) {
      return amount.currency.trim();
    }
  }

  if (typeof fallback === "string" && fallback.trim()) {
    return fallback.trim();
  }

  return null;
}

export async function createOpayCashierPayment(
  input: OpayInitializeInput,
): Promise<OpayInitializeResult> {
  const merchantId = input.merchantId?.trim() || getOpayMerchantId();
  const body: Record<string, unknown> = {
    country: OPAY_COUNTRY,
    reference: input.reference,
    amount: {
      total: input.amountMinorUnits,
      currency: OPAY_CURRENCY,
    },
    returnUrl: buildOpayReturnUrl(input.reference, input.returnTo),
    callbackUrl: input.callbackOverride ?? buildOpayCallbackUrl(),
    cancelUrl: buildOpayCancelUrl(
      input.reference,
      input.cancelTo ?? input.returnTo,
    ),
    expireAt: input.expireAtMinutes ?? 30,
    productList: [
      {
        productId: input.reference,
        name: input.productName,
        description: input.productDescription,
        price: input.amountMinorUnits,
        quantity: 1,
      },
    ],
  };

  if (
    input.customer?.userId ||
    input.customer?.userName ||
    input.customer?.userMobile ||
    input.customer?.userEmail
  ) {
    body.userInfo = {
      userId: input.customer.userId ?? undefined,
      userName: input.customer.userName ?? undefined,
      userMobile: input.customer.userMobile ?? undefined,
      userEmail: input.customer.userEmail ?? undefined,
    };
  }

  const response = await fetch(
    `${getOpayApiBaseUrl()}/api/v1/international/cashier/create`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${getOpayPublicKey()}`,
        MerchantId: merchantId,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );

  const raw = (await response.json().catch(() => null)) as
    | { code?: string; message?: string; data?: Record<string, unknown> }
    | null;

  if (!response.ok) {
    throw new Error(raw?.message ?? `OPay cashier create failed (${response.status})`);
  }

  if (!raw || raw.code !== "00000" || !raw.data) {
    throw new Error(raw?.message ?? "OPay cashier create failed");
  }

  return {
    code: raw.code,
    message: raw.message ?? "SUCCESSFUL",
    reference: String(raw.data.reference ?? input.reference),
    orderNo: raw.data.orderNo ? String(raw.data.orderNo) : null,
    cashierUrl:
      raw.data.cashierUrl && String(raw.data.cashierUrl).trim()
        ? String(raw.data.cashierUrl)
        : raw.data.payUrl && String(raw.data.payUrl).trim()
          ? String(raw.data.payUrl)
          : null,
    raw,
  };
}

export async function queryOpayPaymentStatus(
  reference: string,
  merchantId?: string | null,
) {
  const body = {
    country: OPAY_COUNTRY,
    reference,
  };

  const response = await fetch(
    `${getOpayApiBaseUrl()}/api/v1/international/cashier/status`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${buildStatusSignature(body)}`,
        MerchantId: merchantId?.trim() || getOpayMerchantId(),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );

  const raw = (await response.json().catch(() => null)) as
    | { code?: string; message?: string; data?: Record<string, unknown> }
    | null;

  if (!response.ok) {
    throw new Error(raw?.message ?? `OPay status query failed (${response.status})`);
  }

  if (!raw) {
    throw new Error("OPay status query returned an empty payload");
  }

  const data = raw.data ?? {};

  return {
    code: raw.code ?? "",
    message: raw.message ?? "",
    reference: data.reference ? String(data.reference) : reference,
    orderNo: data.orderNo ? String(data.orderNo) : null,
    status: normalizeOpayStatus(
      data.orderStatus ?? data.status ?? data.paymentStatus,
    ),
    transactionId: data.transactionId ? String(data.transactionId) : null,
    token: data.token ? String(data.token) : null,
    amountMinorUnits: parseMinorUnits(data.amount),
    currency: parseCurrency(data.amount, data.currency),
    raw,
  } satisfies OpayPaymentStatus;
}
