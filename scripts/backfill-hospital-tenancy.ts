import { randomBytes } from "node:crypto";
import { config } from "dotenv";
import { sql } from "drizzle-orm";

config({ path: ".env.local" });

type LegacyFacilityRow = {
  id: string;
  name: string;
  metadata: Record<string, unknown> | null;
  hospital_id: string | null;
};

type HospitalRow = {
  id: string;
  slug: string;
  name: string;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "hospital";
}

function getHospitalName(metadata: Record<string, unknown> | null, fallback: string) {
  const hospitalName = typeof metadata?.hospitalName === "string" ? metadata.hospitalName.trim() : "";
  if (hospitalName) {
    return hospitalName;
  }

  const compound = typeof metadata?.compound === "string" ? metadata.compound.trim() : "";
  if (compound) {
    return compound;
  }

  return `${fallback} Hospital`;
}

async function ensureBaseStructures(db: Awaited<ReturnType<typeof loadDb>>) {
  await db.execute(sql.raw(`
    create table if not exists hospitals (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      slug text not null,
      state text not null default '',
      lga text,
      address text,
      phone text,
      email text,
      created_at timestamptz default now()
    )
  `));

  await db.execute(sql.raw(`
    create unique index if not exists hospitals_slug_idx on hospitals (slug)
  `));

  await db.execute(sql.raw(`
    alter table facilities add column if not exists hospital_id uuid references hospitals(id)
  `));

  await db.execute(sql.raw(`
    alter table staff_invites add column if not exists token text
  `));
}

async function backfillHospitals(db: Awaited<ReturnType<typeof loadDb>>) {
  const existingHospitalsResult = await db.execute(
    sql.raw("select id, slug, name from hospitals"),
  );
  const existingHospitals = new Map<string, HospitalRow>();
  for (const row of existingHospitalsResult.rows as HospitalRow[]) {
    existingHospitals.set(row.slug, row);
  }

  const facilitiesResult = await db.execute(
    sql.raw(`
      select id, name, metadata, hospital_id
      from facilities
      order by created_at asc
    `),
  );
  const facilities = facilitiesResult.rows as LegacyFacilityRow[];
  const grouped = new Map<string, LegacyFacilityRow[]>();

  for (const facility of facilities) {
    if (facility.hospital_id) {
      continue;
    }

    const hospitalName = getHospitalName(facility.metadata, facility.name);
    const group = grouped.get(hospitalName) ?? [];
    group.push(facility);
    grouped.set(hospitalName, group);
  }

  for (const [hospitalName, groupFacilities] of grouped.entries()) {
    let baseSlug = slugify(hospitalName);
    let slug = baseSlug;
    let suffix = 2;

    while (existingHospitals.has(slug)) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const inserted = await db.execute(sql`
      insert into hospitals (name, slug, state)
      values (${hospitalName}, ${slug}, ${""})
      returning id, slug, name
    `);

    const hospital = inserted.rows[0] as HospitalRow;
    existingHospitals.set(hospital.slug, hospital);

    for (const facility of groupFacilities) {
      await db.execute(sql`
        update facilities
        set hospital_id = ${hospital.id}
        where id = ${facility.id}
      `);
    }
  }
}

async function backfillInviteTokens(db: Awaited<ReturnType<typeof loadDb>>) {
  const invitesResult = await db.execute(
    sql.raw("select id, token from staff_invites where token is null or token = ''"),
  );

  for (const row of invitesResult.rows as Array<{ id: string }>) {
    const token = randomBytes(24).toString("base64url");
    await db.execute(sql`
      update staff_invites
      set token = ${token}
      where id = ${row.id}
    `);
  }

  await db.execute(
    sql.raw("create unique index if not exists staff_invites_token_idx on staff_invites(token)"),
  );
}

async function normalizeFacilityVerificationState(
  db: Awaited<ReturnType<typeof loadDb>>,
) {
  await db.execute(sql.raw(`
    update facilities
    set verification_status = case
      when wallet_address is not null and verified_at is not null then 'verified'::facility_verification_status
      when ens_name is not null then 'provisioned'::facility_verification_status
      else 'pending'::facility_verification_status
    end
  `));
}

async function loadDb() {
  const module = await import("../src/lib/db");
  return module.db;
}

async function main() {
  const db = await loadDb();

  await ensureBaseStructures(db);
  await backfillHospitals(db);
  await backfillInviteTokens(db);
  await normalizeFacilityVerificationState(db);
  console.log("Hospital tenancy backfill complete");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
