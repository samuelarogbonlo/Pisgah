import type { AgentDraftProvenance } from "@/lib/agent";

const AGENTBOOK_ADDRESS = "0xA23aB2712eA7BBa896930544C7d6636a96b944dA";

function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function AgentIdentityCard({
  provenance,
  draftCreatedAt,
}: {
  provenance: AgentDraftProvenance;
  draftCreatedAt: string | null;
}) {
  const ensName = provenance.agentEnsName;
  const address = provenance.agentAddress;
  const role =
    provenance.textRecords?.["pisgah.agent.role"] ?? null;
  const facility =
    provenance.textRecords?.["pisgah.agent.facility"] ?? null;
  const supervisedBy =
    provenance.textRecords?.["pisgah.agent.supervised_by"] ??
    provenance.agentHumanId ??
    null;
  const verified = provenance.verified;

  const ensUrl = ensName
    ? `https://app.ens.domains/${ensName}`
    : null;
  const worldscanUrl = `https://worldscan.org/address/${AGENTBOOK_ADDRESS}`;

  return (
    <div
      className={`rounded-md border p-4 ${
        verified
          ? "border-emerald-300 bg-emerald-50/60"
          : "border-amber-300 bg-amber-50/60"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-700">
        Verified Agent Identity
      </p>

      <div className="mt-3 space-y-1">
        {ensName && (
          <p className="font-mono text-sm text-gray-800">{ensName}</p>
        )}
        {address && (
          <p className="font-mono text-[11px] text-gray-500">
            {truncateAddress(address)}
          </p>
        )}
      </div>

      <div className="mt-4 space-y-2 text-sm text-gray-700">
        {role && (
          <div className="flex justify-between">
            <span className="text-gray-500">Role</span>
            <span>{role}</span>
          </div>
        )}
        {facility && (
          <div className="flex justify-between gap-4">
            <span className="shrink-0 text-gray-500">Facility</span>
            <span className="font-mono text-xs">{facility}</span>
          </div>
        )}
        {supervisedBy && (
          <div className="flex justify-between">
            <span className="text-gray-500">Supervised by</span>
            <span>{supervisedBy}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-500">Verified</span>
          <span>{verified ? "Yes" : "No"}</span>
        </div>
      </div>

      <div className="mt-3 space-y-0.5 text-[11px] text-gray-500">
        <p>Human-backed via AgentBook</p>
        <p>Registered on World Chain</p>
      </div>

      {draftCreatedAt && (
        <p className="mt-3 text-[11px] text-gray-500">
          Draft generated: {draftCreatedAt}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-1.5">
        {ensUrl && (
          <a
            href={ensUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-700 underline underline-offset-2 hover:text-black"
          >
            Verify on ENS
          </a>
        )}
        <a
          href={worldscanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-gray-700 underline underline-offset-2 hover:text-black"
        >
          Verify Agent on World Chain
        </a>
      </div>
    </div>
  );
}
