import { NextResponse } from "next/server";
import { eq, like, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { facilities, facilityUsers, hospitals } from "@/lib/db/schema";
import {
  extractBearerToken,
  getDynamicDisplayName,
  verifyDynamicToken,
} from "@/lib/auth/dynamic";
import { setProviderSession } from "@/lib/auth/session";
import { provisionFacilityENS, provisionAgentENS } from "@/lib/ens/provision";
import { slugifyHospitalName } from "@/lib/hospitals/scope";
import { encrypt } from "@/lib/crypto";
import { Wallet } from "ethers";

interface DepartmentInput {
  name: string;
  type: "clinic" | "lab" | "pharmacy";
}

interface SetupHospitalBody {
  hospitalName: string;
  state: string;
  lga?: string;
  address?: string;
  phone?: string;
  email?: string;
  adminName?: string;
  departments: DepartmentInput[];
}

async function generateHospitalSlug(hospitalName: string) {
  const baseSlug = slugifyHospitalName(hospitalName) || "hospital";
  const existing = await db
    .select({ slug: hospitals.slug })
    .from(hospitals)
    .where(like(hospitals.slug, `${baseSlug}%`));

  if (!existing.some((row) => row.slug === baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;
  while (existing.some((row) => row.slug === `${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseSlug}-${suffix}`;
}

export async function POST(request: Request) {
  try {
    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
    }

    const dynamicPayload = await verifyDynamicToken(token);
    const body = (await request.json()) as SetupHospitalBody;
    const hospitalName = body.hospitalName?.trim();
    const state = body.state?.trim();
    const lga = body.lga?.trim() || null;
    const address = body.address?.trim() || null;
    const phone = body.phone?.trim() || null;
    const email = body.email?.trim().toLowerCase() || dynamicPayload.email?.trim().toLowerCase() || null;

    if (!hospitalName) {
      return NextResponse.json({ error: "Hospital name is required" }, { status: 400 });
    }

    if (!state) {
      return NextResponse.json({ error: "State is required" }, { status: 400 });
    }

    if (!Array.isArray(body.departments) || body.departments.length === 0) {
      return NextResponse.json({ error: "At least one department is required" }, { status: 400 });
    }

    const departments = body.departments
      .map((department) => ({
        name: department.name?.trim(),
        type: department.type,
      }))
      .filter((department) => Boolean(department.name)) as DepartmentInput[];

    if (departments.length === 0) {
      return NextResponse.json({ error: "At least one department is required" }, { status: 400 });
    }

    if (!departments.some((department) => department.type === "clinic")) {
      return NextResponse.json(
        { error: "At least one clinic department is required" },
        { status: 400 },
      );
    }

    const [existingUser] = await db
      .select({ id: facilityUsers.id })
      .from(facilityUsers)
      .where(eq(facilityUsers.dynamicId, dynamicPayload.sub))
      .limit(1);

    if (existingUser) {
      return NextResponse.json(
        { error: "This Dynamic account is already linked to Pisgah" },
        { status: 409 },
      );
    }

    const hospitalSlug = await generateHospitalSlug(hospitalName);
    const adminName = body.adminName?.trim() || getDynamicDisplayName(dynamicPayload, "Hospital Admin");
    const facilitiesMetadata = {
      hospitalName,
      state,
      lga,
      address,
      phone,
      email,
    };

    const setupResult = await db.execute(sql`
      with new_hospital as (
        insert into hospitals (name, slug, state, lga, address, phone, email)
        values (
          ${hospitalName},
          ${hospitalSlug},
          ${state},
          ${lga},
          ${address},
          ${phone},
          ${email}
        )
        returning id, name
      ),
      department_input as (
        select
          trim(value->>'name') as name,
          (value->>'type')::facility_type as type
        from jsonb_array_elements(${JSON.stringify(departments)}::jsonb) as value
      ),
      inserted_facilities as (
        insert into facilities (hospital_id, name, type, verification_status, metadata)
        select
          new_hospital.id,
          department_input.name,
          department_input.type,
          'pending'::facility_verification_status,
          ${JSON.stringify(facilitiesMetadata)}::jsonb
        from new_hospital
        cross join department_input
        returning id, hospital_id, name, type
      ),
      clinic_facility as (
        select id, hospital_id, name
        from inserted_facilities
        where type = 'clinic'::facility_type
        order by name
        limit 1
      ),
      inserted_admin as (
        insert into facility_users (facility_id, dynamic_id, role, name, email, phone)
        select
          clinic_facility.id,
          ${dynamicPayload.sub},
          'admin'::facility_user_role,
          ${adminName},
          ${email},
          ${phone}
        from clinic_facility
        returning id, facility_id, role, name, email
      )
      select
        (select id::text from new_hospital limit 1) as hospital_id,
        (select name from new_hospital limit 1) as hospital_name,
        (select id::text from clinic_facility limit 1) as facility_id,
        (select name from clinic_facility limit 1) as facility_name,
        (select id::text from inserted_admin limit 1) as user_id,
        (select name from inserted_admin limit 1) as user_name,
        (select email from inserted_admin limit 1) as user_email
    `);

    const setupRow = setupResult.rows[0] as
      | {
          hospital_id: string | null;
          hospital_name: string | null;
          facility_id: string | null;
          facility_name: string | null;
          user_id: string | null;
          user_name: string | null;
          user_email: string | null;
        }
      | undefined;

    if (
      !setupRow?.hospital_id ||
      !setupRow.hospital_name ||
      !setupRow.facility_id ||
      !setupRow.facility_name ||
      !setupRow.user_id ||
      !setupRow.user_name
    ) {
      return NextResponse.json({ error: "Unable to set up hospital" }, { status: 500 });
    }

    const insertedFacilities = await db
      .select({
        id: facilities.id,
        name: facilities.name,
        type: facilities.type,
        ensName: facilities.ensName,
        verificationStatus: facilities.verificationStatus,
      })
      .from(facilities)
      .where(eq(facilities.hospitalId, setupRow.hospital_id));

    for (const facility of insertedFacilities) {
      const facilityWallet = Wallet.createRandom();
      const ensResult = await provisionFacilityENS({
        name: facility.name,
        type: facility.type,
        state,
        lga: lga ?? "",
        address: facilityWallet.address,
      });

      if ("ensName" in ensResult) {
        await db
          .update(facilities)
          .set({
            ensName: ensResult.ensName,
            walletAddress: facilityWallet.address,
            verificationStatus: "verified",
            verifiedAt: new Date(),
          })
          .where(eq(facilities.id, facility.id));
      }
    }

    // --- Agent ENS provisioning (non-blocking) ---
    try {
      const clinicFacility = insertedFacilities.find((f) => f.type === "clinic");
      const clinicEnsName = clinicFacility
        ? (
            await db
              .select({ ensName: facilities.ensName })
              .from(facilities)
              .where(eq(facilities.id, clinicFacility.id))
              .limit(1)
          )[0]?.ensName
        : null;

      if (clinicEnsName) {
        const slug = clinicEnsName.replace(".pisgah.eth", "");
        // Use the registered agent wallet (already verified in AgentBook)
        // rather than generating a new unregistered one
        const registeredAgentKey = process.env.AGENT_PRIVATE_KEY;
        const agentWallet = registeredAgentKey
          ? new Wallet(registeredAgentKey)
          : Wallet.createRandom();

        const ensResult = await provisionAgentENS({
          clinicEnsSlug: slug,
          agentAddress: agentWallet.address,
        });

        if ("ensName" in ensResult) {
          await db
            .update(hospitals)
            .set({
              agentPrivateKey: encrypt(agentWallet.privateKey),
              agentEnsName: ensResult.ensName,
            })
            .where(eq(hospitals.id, setupRow.hospital_id));
          console.log("[setup-hospital] agent ENS provisioned:", ensResult.ensName);
        } else {
          console.warn("[setup-hospital] agent ENS provisioning failed:", ensResult.error);
        }
      }
    } catch (err) {
      console.warn("[setup-hospital] agent provisioning error (non-blocking):", err);
    }

    const refreshedFacilities = await db
      .select({
        id: facilities.id,
        name: facilities.name,
        type: facilities.type,
        ensName: facilities.ensName,
        verificationStatus: facilities.verificationStatus,
      })
      .from(facilities)
      .where(eq(facilities.hospitalId, setupRow.hospital_id));

    const response = NextResponse.json({
      success: true,
      hospital: {
        id: setupRow.hospital_id,
        name: setupRow.hospital_name,
        slug: hospitalSlug,
      },
      facilities: refreshedFacilities,
      adminUser: {
        id: setupRow.user_id,
        name: setupRow.user_name,
        role: "admin",
        facilityId: setupRow.facility_id,
      },
    });

    await setProviderSession(response.cookies, {
      sub: setupRow.user_id,
      dynamicUserId: dynamicPayload.sub,
      facilityUserId: setupRow.user_id,
      role: "admin",
      hospitalId: setupRow.hospital_id,
      hospitalName: setupRow.hospital_name,
      facilityId: setupRow.facility_id,
      facilityName: setupRow.facility_name,
      name: setupRow.user_name,
      email: setupRow.user_email,
    });

    return response;
  } catch (error) {
    console.error("[provider/setup-hospital]", error);
    return NextResponse.json({ error: "Unable to set up hospital" }, { status: 500 });
  }
}
