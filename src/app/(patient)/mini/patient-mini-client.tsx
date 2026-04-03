"use client";

import { useState } from "react";

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
}

interface Props {
  order: OrderInfo;
  plan: PlanInfo | null;
  prescription: PrescriptionInfo | null;
}

function RedeemButton() {
  const [redeemed, setRedeemed] = useState(false);

  if (redeemed) {
    return (
      <span className="inline-flex mt-3 px-3.5 py-2.5 rounded-full border border-[#1a7a3a] bg-[#1a7a3a] text-white text-[11px] tracking-[0.14em] uppercase">
        Verified
      </span>
    );
  }

  return (
    <button
      onClick={() => setRedeemed(true)}
      className="inline-flex mt-3 px-3.5 py-2.5 rounded-full border border-black bg-black text-white text-[11px] tracking-[0.14em] uppercase"
    >
      Verify to Redeem
    </button>
  );
}

export function PatientMiniClient({ order, plan, prescription }: Props) {
  const [verified, setVerified] = useState(false);

  const isApproved =
    order.displayStatus === "Doctor Approved" ||
    order.displayStatus === "Patient Notified" ||
    order.displayStatus === "Completed";

  return (
    <>
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
                  isApproved
                    ? "border-green-700 text-green-700 bg-green-50"
                    : "border-gray-200 text-gray-500 bg-white"
                }`}
              >
                {order.displayStatus}
              </span>
            </div>

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
              <RedeemButton />
            </div>
          )}

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
