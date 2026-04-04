import { and, eq, inArray, sql } from "drizzle-orm";
import { requireProviderSession } from "@/lib/auth/session";
import { parseAgentDraftEnvelope } from "@/lib/agent";
import { db } from "@/lib/db";
import {
  aiDrafts,
  diagnosticOrders,
  facilities,
  labResults,
  patients,
} from "@/lib/db/schema";
import { ReviewForm } from "./review-form";

function formatTimestamp(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function ReviewPage() {
  const session = await requireProviderSession(["doctor", "admin"]);

  const reviewOrders = await db
    .select({
      id: diagnosticOrders.id,
      testType: diagnosticOrders.testType,
      patientName: patients.name,
      rawText: labResults.rawText,
      attestationUid: labResults.attestationUid,
    })
    .from(diagnosticOrders)
    .innerJoin(patients, eq(diagnosticOrders.patientId, patients.id))
    .innerJoin(labResults, eq(diagnosticOrders.id, labResults.orderId))
    .where(
      and(
        eq(diagnosticOrders.status, "DOCTOR_REVIEW"),
        eq(diagnosticOrders.facilityId, session.facilityId),
      ),
    )
    .orderBy(sql`${diagnosticOrders.createdAt} desc`);

  const [pharmacy] = await db
    .select({
      name: facilities.name,
      ensName: facilities.ensName,
    })
    .from(facilities)
    .where(
      and(
        eq(facilities.type, "pharmacy"),
        eq(facilities.hospitalId, session.hospitalId),
      ),
    )
    .limit(1);

  const draftsMap: Record<
    string,
    {
      draftText: string;
      agentVerified: boolean;
      createdAt: Date | string | null;
    }
  > = {};

  if (reviewOrders.length > 0) {
    const drafts = await db
      .select({
        orderId: aiDrafts.orderId,
        draftText: aiDrafts.draftText,
        agentVerified: aiDrafts.agentVerified,
        createdAt: aiDrafts.createdAt,
      })
      .from(aiDrafts)
      .where(inArray(aiDrafts.orderId, reviewOrders.map((order) => order.id)))
      .orderBy(sql`${aiDrafts.createdAt} desc`);

    for (const draft of drafts) {
      if (!draftsMap[draft.orderId]) {
        draftsMap[draft.orderId] = {
          draftText: draft.draftText,
          agentVerified: Boolean(draft.agentVerified),
          createdAt: draft.createdAt,
        };
      }
    }
  }

  const serialized = reviewOrders.map((order) => {
    const draftRow = draftsMap[order.id] ?? null;
    const parsedDraft = parseAgentDraftEnvelope(draftRow?.draftText ?? null);
    const verifiedDraftAvailable = Boolean(draftRow?.agentVerified);

    return {
      id: order.id,
      testType: order.testType,
      patientName: order.patientName,
      rawText: order.rawText,
      attestationUid: order.attestationUid ?? null,
      aiDraft: verifiedDraftAvailable ? draftRow?.draftText ?? null : null,
      draftCreatedAt: formatTimestamp(draftRow?.createdAt),
      verifiedDraftAvailable,
      parsedDraft: parsedDraft.draft,
      provenance: verifiedDraftAvailable ? parsedDraft.provenance : null,
    };
  });

  return (
    <div>
      <div className="mb-4">
        <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-gray-500">
          <span className="inline-block h-px w-5 bg-black" />
          Doctor Review
        </p>
        <h2 className="mt-3 text-3xl leading-none tracking-tight">
          Review and Approve
        </h2>
        <p className="mt-2 text-sm text-gray-500">{session.facilityName}</p>
      </div>

      {serialized.length === 0 && (
        <div className="rounded-md border border-gray-200 bg-white p-4">
          <p className="py-8 text-center text-sm text-gray-400">
            No orders awaiting review.
          </p>
        </div>
      )}

      {serialized.map((order) => (
        <div key={order.id} className="mb-4">
          <p className="mb-3 text-sm text-gray-500">
            {order.patientName} / {order.testType}
          </p>

          <div className="grid grid-cols-2 gap-3 max-lg:grid-cols-1">
            <div className="rounded-md border border-gray-200 bg-gray-50/80 p-3.5">
              <h4 className="mb-3 text-xs uppercase tracking-[0.16em] text-gray-500">
                Raw Result
              </h4>
              <p className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-gray-800">
                {order.rawText}
              </p>

              <div className="mt-4 border-t border-gray-200 pt-4">
                <h4 className="mb-3 text-xs uppercase tracking-[0.16em] text-gray-500">
                  Assistant Draft
                </h4>

                {order.verifiedDraftAvailable && order.aiDraft ? (
                  <div className="space-y-3">
                    <div>
                      <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-gray-500">
                        Summary
                      </p>
                      <p className="text-sm leading-relaxed text-gray-800">
                        {order.parsedDraft.summary}
                      </p>
                    </div>

                    {order.parsedDraft.recommendations && (
                      <div>
                        <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-gray-500">
                          Recommendations
                        </p>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
                          {order.parsedDraft.recommendations}
                        </p>
                      </div>
                    )}

                    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                      <strong className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-emerald-800">
                        Verified AgentKit draft
                      </strong>
                      <p className="font-mono text-[11px]">
                        {order.provenance?.agentEnsName ?? "Verified assistant"}
                      </p>
                      {order.provenance?.agentAddress && (
                        <p className="mt-1 break-all font-mono text-[11px] text-emerald-800/80">
                          {order.provenance.agentAddress}
                        </p>
                      )}
                      {order.draftCreatedAt && (
                        <p className="mt-1">
                          Stored {order.draftCreatedAt}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                    <strong className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-amber-800">
                      Draft unavailable
                    </strong>
                    Agent verification failed or the assistant did not return a
                    verified draft. The doctor can still complete this review
                    manually.
                  </div>
                )}
              </div>

              {order.attestationUid && (
                <div className="mt-4 rounded-md border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-600">
                  <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-gray-500">
                    Result Attestation UID
                  </p>
                  <p className="break-all font-mono text-[11px] text-gray-700">
                    {order.attestationUid}
                  </p>
                </div>
              )}
            </div>

            <ReviewForm
              orderId={order.id}
              aiDraft={order.aiDraft}
              provenance={order.provenance}
              pharmacyName={pharmacy?.name ?? "Partner Pharmacy"}
              pharmacyEns={pharmacy?.ensName ?? null}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
