import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { facilities, facilityUsers, testCatalog } from "@/lib/db/schema";
import {
  extractBearerToken,
  getDynamicDisplayName,
  verifyDynamicToken,
} from "@/lib/auth/dynamic";
import { setProviderSession } from "@/lib/auth/session";
import { provisionFacilityENS } from "@/lib/ens/provision";

interface DepartmentInput {
  name: string;
  type: "clinic" | "lab" | "pharmacy";
}

interface SetupHospitalBody {
  hospitalName: string;
  state: string;
  lga: string;
  address?: string;
  phone?: string;
  email?: string;
  adminName?: string;
  departments: DepartmentInput[];
}

const DEFAULT_TEST_CATALOG = [
  { testName: "Complete Blood Count", price: "5000" },
  { testName: "Malaria RDT", price: "3500" },
  { testName: "Urinalysis", price: "6000" },
  { testName: "Liver Function", price: "12000" },
  { testName: "Renal Function", price: "14000" },
];

export async function POST(request: Request) {
  try {
    // 1. Verify Dynamic bearer token
    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json(
        { error: "Missing bearer token" },
        { status: 401 },
      );
    }

    const dynamicPayload = await verifyDynamicToken(token);

    // 2. First-admin guard
    const [existingAdmin] = await db
      .select({ id: facilityUsers.id })
      .from(facilityUsers)
      .where(eq(facilityUsers.role, "admin"))
      .limit(1);

    if (existingAdmin) {
      return NextResponse.json(
        { error: "Hospital already set up" },
        { status: 403 },
      );
    }

    // 3. Parse and validate body
    const body = (await request.json()) as SetupHospitalBody;

    if (!body.hospitalName?.trim()) {
      return NextResponse.json(
        { error: "Hospital name is required" },
        { status: 400 },
      );
    }

    if (!Array.isArray(body.departments) || body.departments.length === 0) {
      return NextResponse.json(
        { error: "At least one department is required" },
        { status: 400 },
      );
    }

    const hasClinic = body.departments.some((d) => d.type === "clinic");
    if (!hasClinic) {
      return NextResponse.json(
        { error: "At least one clinic department is required" },
        { status: 400 },
      );
    }

    // 4. Create facilities and provision ENS for each department
    const createdFacilities: Array<{
      id: string;
      name: string;
      type: string;
      ensName: string | null;
      verificationStatus: string;
    }> = [];

    for (const dept of body.departments) {
      const ensResult = await provisionFacilityENS({
        name: dept.name,
        type: dept.type,
        state: body.state,
        lga: body.lga,
      });

      const ensSuccess = "ensName" in ensResult;

      const [facility] = await db
        .insert(facilities)
        .values({
          name: dept.name,
          type: dept.type,
          ensName: ensSuccess ? ensResult.ensName : null,
          verificationStatus: ensSuccess ? "verified" : "pending",
          verifiedAt: ensSuccess ? new Date() : null,
          metadata: {
            hospitalName: body.hospitalName,
            state: body.state,
            lga: body.lga,
            address: body.address || null,
            phone: body.phone || null,
            email: body.email || null,
          },
        })
        .returning();

      createdFacilities.push({
        id: facility.id,
        name: facility.name,
        type: facility.type,
        ensName: facility.ensName,
        verificationStatus: facility.verificationStatus,
      });
    }

    // 5. Find the clinic facility (first one with type "clinic")
    const clinicFacility = createdFacilities.find((f) => f.type === "clinic");
    if (!clinicFacility) {
      return NextResponse.json(
        { error: "Clinic facility creation failed" },
        { status: 500 },
      );
    }

    // 6. Insert default test catalog for clinic
    await db.insert(testCatalog).values(
      DEFAULT_TEST_CATALOG.map((test) => ({
        facilityId: clinicFacility.id,
        testName: test.testName,
        price: test.price,
      })),
    );

    // 7. Create admin user linked to clinic
    const adminName =
      body.adminName ||
      getDynamicDisplayName(dynamicPayload, "Hospital Admin");

    const [adminUser] = await db
      .insert(facilityUsers)
      .values({
        facilityId: clinicFacility.id,
        dynamicId: dynamicPayload.sub,
        role: "admin",
        name: adminName,
        email: body.email || dynamicPayload.email || null,
        phone: body.phone || null,
      })
      .returning();

    // 8. Set provider session cookie
    const response = NextResponse.json({
      success: true,
      facilities: createdFacilities,
      adminUser: {
        id: adminUser.id,
        name: adminUser.name,
        role: adminUser.role,
        facilityId: adminUser.facilityId,
      },
    });

    await setProviderSession(response.cookies, {
      sub: adminUser.id,
      dynamicUserId: dynamicPayload.sub,
      facilityUserId: adminUser.id,
      role: adminUser.role,
      facilityId: adminUser.facilityId,
      facilityName: clinicFacility.name,
      name: adminUser.name,
      email: adminUser.email,
    });

    return response;
  } catch (error) {
    console.error("[provider/setup-hospital]", error);
    return NextResponse.json(
      { error: "Unable to set up hospital" },
      { status: 500 },
    );
  }
}
