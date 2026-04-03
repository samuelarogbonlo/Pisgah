"use client";

import { useState, useTransition } from "react";
import { simulateOnlinePayment, confirmReceipt } from "@/app/actions";

interface TimelineStep {
  label: string;
  state: "done" | "current" | "pending";
}

interface OrderInfo {
  testType: string;
  displayStatus: string;
  timeline: TimelineStep[];
}

interface PlanInfo {
  summary: string;
  recommendations: string;
}

interface PrescriptionInfo {
  items: Array<{
    drugName?: string;
    dosage?: string;
    quantity?: string;
    instructions?: string;
  }>;
  pharmacyEns: string | null;
  redemptionCode: string | null;
  status: string;
}

interface Props {
  order: OrderInfo;
  plan: PlanInfo | null;
  prescription: PrescriptionInfo | null;
  orderId: string;
  amount: string | null;
  redemptionCode: string | null;
}

function PayNowCard({
  orderId,
  amount,
  testType,
}: {
  orderId: string;
  amount: string | null;
  testType: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [paid, setPaid] = useState(false);

  function handlePay() {
    startTransition(async () => {
      await simulateOnlinePayment(orderId);
      setPaid(true);
      window.location.reload();
    });
  }

  if (paid) {
    return (
      <div className="p-3 rounded-lg border border-green-200 bg-green-50 text-center">
        <p className="text-xs text-green-700 font-semibold">
          Payment received. Refreshing...
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-lg border border-gray-200 bg-white/80">
      <p className="text-[10px] tracking-[0.22em] uppercase text-gray-500 flex items-center gap-2">
        <span className="inline-block w-5 h-px bg-black" />
        Payment Required
      </p>
      <h4 className="text-sm font-semibold mt-1.5">{testType}</h4>
      {amount && (
        <p className="mt-1 text-lg font-bold tracking-tight">
          &#8358;{amount}
        </p>
      )}
      <button
        onClick={handlePay}
        disabled={isPending}
        className="inline-flex mt-3 px-3.5 py-2.5 rounded-full border border-black bg-black text-white text-[11px] tracking-[0.14em] uppercase disabled:opacity-50"
      >
        {isPending ? "Processing..." : "Pay Online"}
      </button>
      <p className="mt-2 text-[10px] text-gray-400">
        Or pay cash at the accounts desk
      </p>
    </div>
  );
}

function RedemptionCodeCard({ code }: { code: string }) {
  return (
    <div className="mt-3 p-3 rounded-lg border border-gray-200 bg-white/80 text-center">
      <p className="text-[10px] tracking-[0.22em] uppercase text-gray-500 flex items-center justify-center gap-2">
        <span className="inline-block w-5 h-px bg-black" />
        Your Redemption Code
        <span className="inline-block w-5 h-px bg-black" />
      </p>
      <p className="mt-3 text-3xl font-mono font-bold tracking-widest">
        {code}
      </p>
      <p className="mt-2 text-[10px] text-gray-400">
        Show this code to the pharmacist or delivery rider
      </p>
    </div>
  );
}

function ConfirmReceiptButton({ orderId }: { orderId: string }) {
  const [isPending, startTransition] = useTransition();
  const [confirmed, setConfirmed] = useState(false);

  function handleConfirm() {
    startTransition(async () => {
      await confirmReceipt(orderId);
      setConfirmed(true);
    });
  }

  if (confirmed) {
    return (
      <div className="mt-3 p-3 rounded-lg border border-green-200 bg-green-50 text-center">
        <p className="text-sm font-semibold text-green-700">
          Order complete &#10003;
        </p>
      </div>
    );
  }

  return (
    <button
      onClick={handleConfirm}
      disabled={isPending}
      className="inline-flex mt-3 px-3.5 py-2.5 rounded-full border border-black bg-black text-white text-[11px] tracking-[0.14em] uppercase disabled:opacity-50"
    >
      {isPending ? "Confirming..." : "Confirm Drugs Received"}
    </button>
  );
}

function OrderCompleteMessage() {
  return (
    <div className="mt-3 p-3 rounded-lg border border-green-200 bg-green-50 text-center">
      <p className="text-sm font-semibold text-green-700">
        Order complete &#10003;
      </p>
    </div>
  );
}

export function PatientMiniClient({
  order,
  plan,
  prescription,
  orderId,
  amount,
  redemptionCode,
}: Props) {
  const [verified, setVerified] = useState(false);

  const isAwaitingPayment = order.displayStatus === "Awaiting Payment";

  const isProcessing =
    order.displayStatus === "Paid" ||
    order.displayStatus === "In Lab" ||
    order.displayStatus === "Sample Collected";

  const isUnderReview =
    order.displayStatus === "Result Ready" ||
    order.displayStatus === "Doctor Review";

  const isApproved =
    order.displayStatus === "Doctor Approved" ||
    order.displayStatus === "Patient Notified";

  const isCompleted = order.displayStatus === "Completed";

  const prescriptionFulfilled =
    prescription?.status === "fulfilled" ||
    prescription?.status === "redeemed";

  return (
    <>
      {/* Pay Now card — shown before everything when awaiting payment */}
      {isAwaitingPayment && (
        <div className="mb-3.5">
          <PayNowCard
            orderId={orderId}
            amount={amount}
            testType={order.testType}
          />
        </div>
      )}

      {/* Pre-verify state */}
      {!verified && (
        <>
          <div className="p-3 rounded-lg border border-gray-200 bg-white/80">
            <p className="text-[10px] tracking-[0.22em] uppercase text-gray-500 flex items-center gap-2">
              <span className="inline-block w-5 h-px bg-black" />
              Order
            </p>
            <h4 className="text-sm font-semibold mt-1.5 mb-2">
              {order.testType}
            </h4>
            <div className="flex gap-2 mt-2">
              <span
                className={`inline-block rounded-full px-2.5 py-1 text-[10px] tracking-widest uppercase font-semibold border ${
                  isApproved || isCompleted
                    ? "border-green-700 text-green-700 bg-green-50"
                    : "border-gray-200 text-gray-500 bg-white"
                }`}
              >
                {order.displayStatus}
              </span>
            </div>

            {/* Status messages */}
            {isProcessing && (
              <p className="mt-3 text-xs text-gray-500">
                Your sample is being processed
              </p>
            )}
            {isUnderReview && (
              <p className="mt-3 text-xs text-gray-500">
                Results are being reviewed by your doctor
              </p>
            )}

            {/* Timeline */}
            <div className="mt-4 pl-4">
              {order.timeline.map((step, i) => (
                <div key={i} className="relative pb-4 pl-5 last:pb-0">
                  {/* Connecting line */}
                  {i < order.timeline.length - 1 && (
                    <div
                      className={`absolute left-[-1px] top-1.5 bottom-[-6px] w-px ${
                        step.state === "done" ? "bg-black" : "bg-gray-200"
                      }`}
                    />
                  )}
                  {/* Dot */}
                  <div
                    className={`absolute left-[-5px] top-[5px] w-[9px] h-[9px] rounded-full border-[1.5px] ${
                      step.state === "done"
                        ? "bg-black border-black"
                        : step.state === "current"
                          ? "bg-white border-black border-[2.5px]"
                          : "bg-white border-gray-400"
                    }`}
                  />
                  <span
                    className={`text-xs ${
                      step.state === "done" || step.state === "current"
                        ? "text-black font-semibold"
                        : "text-gray-500"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Verification gate — only show when approved/notified and not yet completed */}
          {(isApproved || isCompleted) && (
            <div className="mt-3.5 p-3 rounded-lg border border-gray-200 bg-white/80 text-center">
              <p className="text-xs text-gray-500 mb-3">
                Verify with World ID to view your results
              </p>
              <button
                onClick={() => setVerified(true)}
                className="inline-flex px-3.5 py-2.5 rounded-full border border-black bg-black text-white text-[11px] tracking-[0.14em] uppercase"
              >
                Verify with World ID
              </button>
            </div>
          )}

          {/* Completed state — show static message */}
          {isCompleted && <OrderCompleteMessage />}
        </>
      )}

      {/* Post-verify state */}
      {verified && (
        <>
          {plan && (
            <>
              <div className="p-3 rounded-lg border border-gray-200 bg-white/80">
                <p className="text-[10px] tracking-[0.22em] uppercase text-gray-500 flex items-center gap-2">
                  <span className="inline-block w-5 h-px bg-black" />
                  Doctor Summary
                </p>
                <h4 className="text-sm font-semibold mt-1.5">
                  Review Summary
                </h4>
                <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">
                  {plan.summary}
                </p>
              </div>

              <div className="mt-3 p-3 rounded-lg border border-gray-200 bg-white/80">
                <p className="text-[10px] tracking-[0.22em] uppercase text-gray-500 flex items-center gap-2">
                  <span className="inline-block w-5 h-px bg-black" />
                  Recommendations
                </p>
                <h4 className="text-sm font-semibold mt-1.5">Next steps</h4>
                <p className="mt-1.5 text-xs text-gray-500 leading-relaxed whitespace-pre-wrap">
                  {plan.recommendations}
                </p>
              </div>
            </>
          )}

          {prescription && prescription.items.length > 0 && (
            <div className="mt-3 p-3 rounded-lg border border-gray-200 bg-white/80">
              <p className="text-[10px] tracking-[0.22em] uppercase text-gray-500 flex items-center gap-2">
                <span className="inline-block w-5 h-px bg-black" />
                Prescription
              </p>
              {prescription.items.map((item, i) => (
                <div key={i}>
                  <h4 className="text-sm font-semibold mt-1.5">
                    {item.drugName} {item.dosage}
                  </h4>
                  <p className="mt-1 text-xs text-gray-500">
                    {item.quantity}
                    {item.instructions && `, ${item.instructions}`}
                  </p>
                </div>
              ))}
              {prescription.pharmacyEns && (
                <p className="mt-2 font-mono text-xs text-gray-400">
                  {prescription.pharmacyEns}
                </p>
              )}

              {/* Redemption code replaces the old "Verify to Redeem" button */}
              {redemptionCode && (
                <RedemptionCodeCard code={redemptionCode} />
              )}

              {/* Confirm receipt when prescription is fulfilled/redeemed */}
              {prescriptionFulfilled && !isCompleted && (
                <ConfirmReceiptButton orderId={orderId} />
              )}
            </div>
          )}

          {/* Completed state in post-verify */}
          {isCompleted && <OrderCompleteMessage />}

          {!plan && !prescription && (
            <div className="p-3 rounded-lg border border-gray-200 bg-white/80 text-center">
              <p className="text-xs text-gray-500">
                No results available yet. Your doctor is still reviewing.
              </p>
            </div>
          )}
        </>
      )}
    </>
  );
}
