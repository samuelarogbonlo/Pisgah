import NameStone from "@namestone/namestone-sdk";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 20)
    .replace(/-$/, "");
}

function buildFacilityTextRecords(params: {
  name: string;
  type: "clinic" | "lab" | "pharmacy";
  state: string;
  lga: string;
  description?: string;
}) {
  return {
    description: params.description || `${params.name}, ${params.state}`,
    "pisgah.facility.type": params.type,
    "pisgah.facility.state": params.state,
    "pisgah.facility.lga": params.lga,
    "pisgah.facility.verified": "true",
  } satisfies Record<string, string>;
}

export async function provisionFacilityENS(params: {
  name: string;
  type: "clinic" | "lab" | "pharmacy";
  state: string;
  lga: string;
  description?: string;
}): Promise<{ ensName: string } | { error: string }> {
  const apiKey = process.env.NAMESTONE_API_KEY;
  if (!apiKey) return { error: "NAMESTONE_API_KEY not configured" };

  const ns = new NameStone(apiKey);
  const baseSlug = generateSlug(params.name);
  const domain = "pisgah.eth";
  const textRecords = buildFacilityTextRecords(params);

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    try {
      await ns.setName({
        name: slug,
        domain,
        address: "0x0000000000000000000000000000000000000000",
        text_records: textRecords,
      });
      return { ensName: `${slug}.${domain}` };
    } catch (err: unknown) {
      const error = err as { message?: string; status?: number };
      if (error?.message?.includes("already") || error?.status === 409) {
        continue;
      }
      return { error: error?.message || "NameStone provisioning failed" };
    }
  }

  return { error: "All ENS slug attempts exhausted (collision)" };
}

export async function syncProvisionedFacilityENS(params: {
  ensName: string;
  address: `0x${string}`;
  name: string;
  type: "clinic" | "lab" | "pharmacy";
  state: string;
  lga: string;
  description?: string;
}): Promise<{ ensName: string } | { error: string }> {
  const apiKey = process.env.NAMESTONE_API_KEY;
  if (!apiKey) return { error: "NAMESTONE_API_KEY not configured" };

  const parts = params.ensName.split(".");
  if (parts.length < 3) {
    return { error: "Facility ENS name is invalid" };
  }

  const [name, ...domainParts] = parts;
  const domain = domainParts.join(".");
  const ns = new NameStone(apiKey);

  try {
    await ns.setName({
      name,
      domain,
      address: params.address,
      text_records: buildFacilityTextRecords(params),
    });

    return { ensName: params.ensName };
  } catch (err: unknown) {
    const error = err as { message?: string };
    return { error: error?.message || "Failed to update ENS facility record" };
  }
}
