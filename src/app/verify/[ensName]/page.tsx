import { resolveEnsMetadataByName } from "@/lib/ens";
import type { Metadata } from "next";

const VERIFICATION_TEXT_KEYS = [
  "description",
  "pisgah.facility.type",
  "pisgah.facility.capabilities",
  "pisgah.facility.state",
  "pisgah.facility.lga",
  "pisgah.facility.verified",
  "pisgah.agent.type",
  "pisgah.agent.role",
  "pisgah.agent.facility",
  "pisgah.agent.verified",
] as const;

function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function isVerified(records: Record<string, string | null>): boolean {
  return (
    records["pisgah.facility.verified"] === "true" ||
    records["pisgah.agent.verified"] === "true"
  );
}

function isFacility(records: Record<string, string | null>): boolean {
  return records["pisgah.facility.type"] != null;
}

function isAgent(records: Record<string, string | null>): boolean {
  return records["pisgah.agent.type"] != null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ensName: string }>;
}): Promise<Metadata> {
  const { ensName } = await params;
  const decoded = decodeURIComponent(ensName);
  return {
    title: `Verify ${decoded} - Pisgah`,
    description: `Public verification page for ${decoded} on the Pisgah Trust Network`,
  };
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ ensName: string }>;
}) {
  const { ensName } = await params;
  const decoded = decodeURIComponent(ensName);

  const resolved = await resolveEnsMetadataByName(decoded, {
    textKeys: VERIFICATION_TEXT_KEYS,
  });

  const hasAddress = resolved.resolvedAddress && resolved.resolvedAddress.length > 0;
  const records = resolved.textRecords;
  const verified = isVerified(records);
  const facility = isFacility(records);
  const agent = isAgent(records);

  if (!hasAddress && !facility && !agent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f3f1] px-4">
        <div className="w-full max-w-md rounded-md border border-[#d8d8d2] bg-white px-8 py-10 shadow-[0_18px_46px_rgba(0,0,0,0.08)]">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[#6d6d6d]">
            Pisgah Verification
          </p>
          <p className="mt-4 font-mono text-sm text-gray-800">{decoded}</p>
          <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-800">
              This name could not be verified on the Pisgah Trust Network.
            </p>
          </div>
          <p className="mt-6 text-[11px] text-gray-400">
            Resolved via ENS (CCIP-Read)
          </p>
          <p className="text-[11px] text-gray-400">Pisgah Trust Network</p>
        </div>
      </div>
    );
  }

  const type = facility
    ? records["pisgah.facility.type"]
    : records["pisgah.agent.type"];
  const state = records["pisgah.facility.state"];
  const lga = records["pisgah.facility.lga"];
  const capabilities = facility
    ? records["pisgah.facility.capabilities"]
    : records["pisgah.agent.role"];
  const description = records["description"];
  const agentFacility = records["pisgah.agent.facility"];

  const etherscanUrl = hasAddress
    ? `https://etherscan.io/address/${resolved.resolvedAddress}`
    : null;
  const ensUrl = `https://app.ens.domains/${decoded}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f3f3f1] px-4">
      <div className="w-full max-w-md rounded-md border border-[#d8d8d2] bg-white px-8 py-10 shadow-[0_18px_46px_rgba(0,0,0,0.08)]">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[#6d6d6d]">
          Pisgah Verification
        </p>

        <p className="mt-4 font-mono text-sm text-gray-800">{decoded}</p>

        {verified ? (
          <p className="mt-2 text-sm font-medium text-emerald-700">
            Verified on Pisgah Network
          </p>
        ) : (
          <p className="mt-2 text-sm text-amber-700">
            Registered but not yet verified
          </p>
        )}

        <div className="mt-6 space-y-2.5 text-sm text-gray-700">
          {type && (
            <div className="flex justify-between">
              <span className="text-gray-500">Type</span>
              <span className="capitalize">{type.replace(/-/g, " ")}</span>
            </div>
          )}

          {description && (
            <div className="flex justify-between gap-4">
              <span className="shrink-0 text-gray-500">Description</span>
              <span className="text-right">{description}</span>
            </div>
          )}

          {state && (
            <div className="flex justify-between">
              <span className="text-gray-500">State</span>
              <span>{state}</span>
            </div>
          )}

          {lga && (
            <div className="flex justify-between">
              <span className="text-gray-500">LGA</span>
              <span>{lga}</span>
            </div>
          )}

          {capabilities && (
            <div className="flex justify-between gap-4">
              <span className="shrink-0 text-gray-500">
                {facility ? "Capabilities" : "Role"}
              </span>
              <span className="text-right">
                {capabilities.split(",").map((cap) => cap.trim()).join(", ")}
              </span>
            </div>
          )}

          {agent && agentFacility && (
            <div className="flex justify-between gap-4">
              <span className="shrink-0 text-gray-500">Facility</span>
              <span className="font-mono text-xs">{agentFacility}</span>
            </div>
          )}
        </div>

        {hasAddress && (
          <div className="mt-6 border-t border-[#d8d8d2] pt-4">
            <p className="text-sm text-gray-700">
              <span className="text-gray-500">Wallet: </span>
              <span className="font-mono text-xs">
                {truncateAddress(resolved.resolvedAddress!)}
              </span>
            </p>
            {etherscanUrl && (
              <a
                href={etherscanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-sm text-gray-700 underline underline-offset-2 hover:text-black"
              >
                View on Etherscan
              </a>
            )}
          </div>
        )}

        <div className="mt-4 border-t border-[#d8d8d2] pt-4">
          <a
            href={ensUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-sm text-gray-700 underline underline-offset-2 hover:text-black"
          >
            View on ENS
          </a>
        </div>

        <div className="mt-6 space-y-0.5">
          <p className="text-[11px] text-gray-400">
            Resolved via ENS (CCIP-Read)
          </p>
          <p className="text-[11px] text-gray-400">Pisgah Trust Network</p>
        </div>
      </div>
    </div>
  );
}
