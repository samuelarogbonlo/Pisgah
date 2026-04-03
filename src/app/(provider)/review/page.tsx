import { db } from "@/lib/db";
import {
  diagnosticOrders,
  patients,
  labResults,
  aiDrafts,
} from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { ReviewForm } from "./review-form";

export default async function ReviewPage() {
  // Fetch orders in DOCTOR_REVIEW status with lab results and AI drafts
  const reviewOrders = await db
    .select({
      id: diagnosticOrders.id,
      testType: diagnosticOrders.testType,
      patientName: patients.name,
      rawText: labResults.rawText,
      resultId: labResults.id,
    })
    .from(diagnosticOrders)
    .innerJoin(patients, eq(diagnosticOrders.patientId, patients.id))
    .innerJoin(labResults, eq(diagnosticOrders.id, labResults.orderId))
    .where(eq(diagnosticOrders.status, "DOCTOR_REVIEW"))
    .orderBy(sql`${diagnosticOrders.createdAt} desc`);

  // Fetch AI drafts for these orders
  const orderIds = reviewOrders.map((o) => o.id);
  let draftsMap: Record<string, string> = {};
  if (orderIds.length > 0) {
    const drafts = await db
      .select({
        orderId: aiDrafts.orderId,
        draftText: aiDrafts.draftText,
      })
      .from(aiDrafts);

    for (const draft of drafts) {
      if (orderIds.includes(draft.orderId)) {
        draftsMap[draft.orderId] = draft.draftText;
      }
    }
  }

  const serialized = reviewOrders.map((o) => ({
    id: o.id,
    testType: o.testType,
    patientName: o.patientName,
    rawText: o.rawText,
    aiDraft: draftsMap[o.id] ?? null,
  }));

  return (
    <div>
      <div className="mb-4">
        <p className="text-[10px] tracking-[0.22em] uppercase text-gray-500 flex items-center gap-2">
          <span className="inline-block w-5 h-px bg-black" />
          Doctor Review
        </p>
        <h2 className="text-3xl tracking-tight leading-none mt-3">
          Review and Approve
        </h2>
      </div>

      {serialized.length === 0 && (
        <div className="border border-gray-200 rounded-md bg-white p-4">
          <p className="text-sm text-gray-400 text-center py-8">
            No orders awaiting review.
          </p>
        </div>
      )}

      {serialized.map((order) => (
        <div key={order.id} className="mb-4">
          <p className="text-sm text-gray-500 mb-3">
            {order.patientName} / {order.testType}
          </p>
          <div className="grid grid-cols-2 gap-3 max-lg:grid-cols-1">
            {/* Left: Raw Result + AI Draft */}
            <div className="p-3.5 rounded-md border border-gray-200 bg-gray-50/80">
              <h4 className="text-xs tracking-[0.16em] uppercase text-gray-500 mb-3">
                Raw Result
              </h4>
              <p className="font-mono text-[13px] leading-relaxed whitespace-pre-wrap text-gray-800">
                {order.rawText}
              </p>

              {order.aiDraft && (
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <h4 className="text-xs tracking-[0.16em] uppercase text-gray-500 mb-3">
                    AI Draft
                  </h4>
                  <p className="text-sm leading-relaxed text-gray-800">
                    {order.aiDraft}
                  </p>
                  <div className="mt-3.5 p-2.5 rounded-md border border-gray-400 bg-white">
                    <strong className="block text-[11px] uppercase tracking-[0.14em] text-gray-500 mb-1">
                      Drafted by
                    </strong>
                    <span className="font-mono text-xs text-gray-400">
                      assistant.stlukes.pisgah.eth
                    </span>
                    <span className="block mt-1 text-xs text-gray-500">
                      Human-backed clinic assistant
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Action Plan Form */}
            <ReviewForm
              orderId={order.id}
              defaultSummary={order.aiDraft ?? ""}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
