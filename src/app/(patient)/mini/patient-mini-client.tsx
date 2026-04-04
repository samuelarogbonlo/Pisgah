"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { orbLegacy, type IDKitRequestConfig, IDKitRequestWidget, type IDKitResult } from "@worldcoin/idkit";
import { MiniKit } from "@worldcoin/minikit-js";
import { useMiniKit } from "@worldcoin/minikit-js/minikit-provider";
import { confirmReceipt } from "@/app/actions";
import { Spinner } from "@/components/ui/spinner";

type TimelineStep = {
  label: string;
  state: "done" | "current" | "pending";
};

type OrderInfo = {
  id: string;
  testType: string;
  displayStatus: string;
  timeline: TimelineStep[];
  amount: string | null;
};

type PlanInfo = {
  summary: string;
  recommendations: string;
} | null;

type PrescriptionInfo = {
  id: string;
  items: Array<{
    drugName?: string;
    dosage?: string;
    quantity?: string;
    instructions?: string;
  }>;
  pharmacyName: string;
  pharmacyEns: string | null;
  redemptionCode: string | null;
  status: string;
} | null;

type VerificationMode = "result" | "prescription";

type VerificationConfig = {
  mode: VerificationMode;
  request: {
    appId: `app_${string}`;
    action: string;
    allowLegacyProofs: boolean;
    environment: "production" | "staging";
    rpContext: IDKitRequestConfig["rp_context"];
  };
};

function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div className="mt-4 pl-4">
      {steps.map((step, index) => (
        <div key={`${step.label}-${index}`} className="relative pb-4 pl-5 last:pb-0">
          {index < steps.length - 1 && (
            <div
              className={`absolute left-[-1px] top-1.5 bottom-[-6px] w-px ${
                step.state === "done" ? "bg-black" : "bg-gray-200"
              }`}
            />
          )}
          <div
            className={`absolute left-[-5px] top-[5px] h-[9px] w-[9px] rounded-full border-[1.5px] ${
              step.state === "done"
                ? "border-black bg-black"
                : step.state === "current"
                  ? "border-[2.5px] border-black bg-white"
                  : "border-gray-400 bg-white"
            }`}
          />
          <span
            className={`text-xs ${
              step.state === "pending" ? "text-gray-500" : "font-semibold text-black"
            }`}
          >
            {step.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function GateCard({
  title,
  body,
  onClick,
  disabled,
}: {
  title: string;
  body: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="mt-3.5 rounded-lg border border-gray-200 bg-white/80 p-3 text-center">
      <p className="text-xs text-gray-500">{body}</p>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="mt-3 inline-flex rounded-full border border-black bg-black px-3.5 py-2.5 text-[11px] uppercase tracking-[0.14em] text-white disabled:opacity-50"
      >
        {title}
      </button>
    </div>
  );
}

function ConfirmReceiptButton({ orderId }: { orderId: string }) {
  const [isPending, startTransition] = useTransition();
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    startTransition(async () => {
      setError(null);
      const result = await confirmReceipt(orderId);
      if (!result.success) {
        setError(result.error ?? "Could not confirm receipt");
        return;
      }
      setConfirmed(true);
    });
  }

  if (confirmed) {
    return (
      <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-center">
        <p className="text-sm font-semibold text-green-700">Order complete.</p>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={handleConfirm}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-full border border-black bg-black px-3.5 py-2.5 text-[11px] uppercase tracking-[0.14em] text-white disabled:opacity-50"
      >
        {isPending ? <><Spinner /> Confirming...</> : "Confirm Drugs Received"}
      </button>
      {error && <p className="mt-2 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}

export function PatientMiniClient({
  order,
  plan,
  prescription,
  resultVerified,
  prescriptionVerified,
}: {
  order: OrderInfo;
  plan: PlanInfo;
  prescription: PrescriptionInfo;
  resultVerified: boolean;
  prescriptionVerified: boolean;
}) {
  const router = useRouter();
  const { isInstalled } = useMiniKit();
  const [verificationConfig, setVerificationConfig] = useState<VerificationConfig | null>(null);
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [isInWorldApp, setIsInWorldApp] = useState(false);

  const awaitingPayment = order.displayStatus === "Awaiting Payment";
  const processing =
    order.displayStatus === "Paid" ||
    order.displayStatus === "In Lab" ||
    order.displayStatus === "Sample Collected";
  const underReview =
    order.displayStatus === "Result Ready" ||
    order.displayStatus === "Doctor Review";
  const doctorApproved =
    order.displayStatus === "Doctor Approved" ||
    order.displayStatus === "Patient Notified" ||
    order.displayStatus === "Completed";

  const canRevealResult = doctorApproved && resultVerified;
  const needsPrescriptionGate =
    Boolean(prescription?.id) && !prescriptionVerified && prescription?.status !== "redeemed";

  const deepLink = useMemo(() => {
    const appId = process.env.NEXT_PUBLIC_WORLD_APP_ID;
    if (!appId) {
      return null;
    }
    return MiniKit.getMiniAppUrl(appId, "/mini");
  }, []);

  useEffect(() => {
    setHasMounted(true);
    setIsInWorldApp(MiniKit.isInWorldApp());
  }, []);

  async function beginVerification(mode: VerificationMode) {
    setVerificationError(null);

    const endpoint =
      mode === "result"
        ? `/api/world/verify-result-access?orderId=${order.id}`
        : `/api/world/verify-prescription-redemption?prescriptionId=${prescription?.id ?? ""}`;

    const response = await fetch(endpoint, { method: "GET" });
    const payload = (await response.json()) as {
      appId?: `app_${string}`;
      action?: string;
      allowLegacyProofs?: boolean;
      environment?: "production" | "staging";
      rpContext?: IDKitRequestConfig["rp_context"];
      error?: string;
    };

    if (!response.ok || !payload.appId || !payload.action || !payload.rpContext) {
      setVerificationError(payload.error ?? "Unable to start World verification");
      return;
    }

    setVerificationConfig({
      mode,
      request: {
        appId: payload.appId,
        action: payload.action,
        allowLegacyProofs: payload.allowLegacyProofs ?? true,
        environment: payload.environment ?? "production",
        rpContext: payload.rpContext,
      },
    });
    setVerificationOpen(true);
  }

  async function handleWorldProof(result: IDKitResult) {
    if (!verificationConfig) {
      throw new Error("Verification request was not initialized");
    }

    const endpoint =
      verificationConfig.mode === "result"
        ? "/api/world/verify-result-access"
        : "/api/world/verify-prescription-redemption";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        verificationConfig.mode === "result"
          ? { orderId: order.id, result }
          : { prescriptionId: prescription?.id, result },
      ),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      throw new Error(payload?.error ?? "World verification failed");
    }
  }

  return (
    <div className="px-5 py-6">
      <div className="border-b border-gray-200 pb-4 text-center">
        <strong className="block text-[15px] uppercase tracking-wide">Pisgah</strong>
        <span className="text-xs text-gray-500">Doctor-approved patient updates</span>
      </div>

      {hasMounted && !isInWorldApp && (
        <div className="mt-4 rounded-lg border border-black/10 bg-[#f8f8f6] p-3 text-sm text-[#6d6d6d]">
          Open this claim in World App on your phone.
          {deepLink && (
            <a className="mt-2 block font-medium text-black underline" href={deepLink}>
              Open in World App
            </a>
          )}
        </div>
      )}

      <div className="mt-4 rounded-lg border border-gray-200 bg-white/80 p-3">
        <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-gray-500">
          <span className="inline-block h-px w-5 bg-black" />
          Order
        </p>
        <h4 className="mt-1.5 text-sm font-semibold">{order.testType}</h4>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="inline-block rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
            {order.displayStatus}
          </span>
          {awaitingPayment && order.amount && (
            <span className="inline-block rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-amber-700">
              ₦{order.amount} at accounts desk
            </span>
          )}
        </div>

        {processing && (
          <p className="mt-3 text-xs text-gray-500">Your sample is being processed.</p>
        )}
        {underReview && (
          <p className="mt-3 text-xs text-gray-500">
            Results are in review with your doctor.
          </p>
        )}

        <Timeline steps={order.timeline} />
      </div>

      {doctorApproved && !canRevealResult && (
        <GateCard
          title="Verify to View Result"
          body="Your doctor-approved update is ready. Verify with World before viewing sensitive result details."
          onClick={() => void beginVerification("result")}
          disabled={!isInstalled}
        />
      )}

      {verificationError && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
          {verificationError}
        </p>
      )}

      {canRevealResult && plan && (
        <>
          <div className="mt-3 rounded-lg border border-gray-200 bg-white/80 p-3">
            <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-gray-500">
              <span className="inline-block h-px w-5 bg-black" />
              Doctor Summary
            </p>
            <p className="mt-2 text-sm leading-relaxed text-gray-800">{plan.summary}</p>
          </div>

          <div className="mt-3 rounded-lg border border-gray-200 bg-white/80 p-3">
            <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-gray-500">
              <span className="inline-block h-px w-5 bg-black" />
              Next Steps
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
              {plan.recommendations}
            </p>
          </div>
        </>
      )}

      {prescription && canRevealResult && (
        <div className="mt-3 rounded-lg border border-gray-200 bg-white/80 p-3">
          <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-gray-500">
            <span className="inline-block h-px w-5 bg-black" />
            Prescription
          </p>

          {prescription.status === "ready_for_pickup" && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs text-amber-800">
                Your medication has been prescribed. Preparing for delivery.
              </p>
            </div>
          )}
          {prescription.status === "dispatched" && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs text-amber-800">
                Your medication has been dispatched. A rider is on the way.
              </p>
            </div>
          )}
          {prescription.status === "delivered" && (
            <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-xs text-green-800">
                Delivery confirmed. Please confirm you received your medication below.
              </p>
            </div>
          )}

          {prescription.items.map((item, index) => (
            <div key={`${item.drugName ?? "item"}-${index}`} className="mt-3">
              <h4 className="text-sm font-semibold">
                {item.drugName} {item.dosage}
              </h4>
              <p className="mt-1 text-xs leading-6 text-gray-500">
                {item.quantity} · {item.instructions}
              </p>
            </div>
          ))}

          <div className="mt-3 rounded-lg border border-gray-200 bg-[#f8f8f6] p-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-gray-500">
              Pickup Location
            </p>
            <p className="mt-2 text-sm font-semibold text-gray-900">
              {prescription.pharmacyName}
            </p>
            <p className="mt-1 font-mono text-xs text-gray-500">
              {prescription.pharmacyEns ?? "ENS pending"}
            </p>
          </div>

          {needsPrescriptionGate && (
            <GateCard
              title="Verify to Redeem"
              body="Verify again with World before revealing the prescription redemption code."
              onClick={() => void beginVerification("prescription")}
              disabled={!isInstalled}
            />
          )}

          {prescriptionVerified && prescription.redemptionCode && (
            <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3 text-center">
              <p className="text-[10px] uppercase tracking-[0.22em] text-gray-500">
                Redemption Code
              </p>
              <p className="mt-3 font-mono text-3xl font-bold tracking-[0.25em] text-gray-900">
                {prescription.redemptionCode}
              </p>
              <p className="mt-2 text-[10px] text-gray-500">
                Show this code at pickup or to the delivery rider.
              </p>
            </div>
          )}

          {prescription.status === "delivered" && <ConfirmReceiptButton orderId={order.id} />}
        </div>
      )}

      {verificationConfig && (
        <IDKitRequestWidget
          open={verificationOpen}
          onOpenChange={setVerificationOpen}
          app_id={verificationConfig.request.appId}
          action={verificationConfig.request.action}
          rp_context={verificationConfig.request.rpContext}
          allow_legacy_proofs={verificationConfig.request.allowLegacyProofs}
          environment={verificationConfig.request.environment}
          preset={orbLegacy()}
          handleVerify={handleWorldProof}
          onSuccess={() => {
            setVerificationOpen(false);
            router.refresh();
          }}
          onError={() => {
            setVerificationError("World verification was not completed.");
          }}
        />
      )}
    </div>
  );
}
