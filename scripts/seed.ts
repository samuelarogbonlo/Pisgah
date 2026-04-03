import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/lib/db/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

const FACILITY_IDS = {
  stLukes: "a1b2c3d4-0001-4000-8000-000000000001",
  sunshineLab: "a1b2c3d4-0002-4000-8000-000000000002",
  greenLeaf: "a1b2c3d4-0003-4000-8000-000000000003",
} as const;

const USER_IDS = {
  drAdeyemi: "a1b2c3d4-0011-4000-8000-000000000011",
  mrsObi: "a1b2c3d4-0012-4000-8000-000000000012",
  mrChukwu: "a1b2c3d4-0013-4000-8000-000000000013",
  pharmNwosu: "a1b2c3d4-0014-4000-8000-000000000014",
} as const;

const PATIENTS = [
  {
    id: "a1b2c3d4-0021-4000-8000-000000000021",
    name: "Amara Okafor",
    phone: "+2348012345678",
  },
  {
    id: "a1b2c3d4-0022-4000-8000-000000000022",
    name: "Emeka Nwankwo",
    phone: "+2348023456789",
  },
  {
    id: "a1b2c3d4-0023-4000-8000-000000000023",
    name: "Fatima Bello",
    phone: "+2348034567890",
  },
  {
    id: "a1b2c3d4-0024-4000-8000-000000000024",
    name: "Chidi Okonkwo",
    phone: "+2348045678901",
  },
  {
    id: "a1b2c3d4-0025-4000-8000-000000000025",
    name: "Ngozi Eze",
    phone: "+2348056789012",
  },
  {
    id: "a1b2c3d4-0026-4000-8000-000000000026",
    name: "Blessing Adamu",
    phone: "+2348067890123",
  },
] as const;

const ORDER_IDS = {
  amara: "a1b2c3d4-0031-4000-8000-000000000031",
  emeka: "a1b2c3d4-0032-4000-8000-000000000032",
  fatima: "a1b2c3d4-0033-4000-8000-000000000033",
  chidi: "a1b2c3d4-0034-4000-8000-000000000034",
  ngozi: "a1b2c3d4-0035-4000-8000-000000000035",
  blessing: "a1b2c3d4-0036-4000-8000-000000000036",
} as const;

const TEST_ATTESTATION_UID =
  "0xf11bf6b47f6eb4d90f6c46c510f59415207dd9324acb9b16da4f6ac84dd86ad2";

function atToday(hour: number, minute: number) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
}

function atYesterday(hour: number, minute: number) {
  const date = atToday(hour, minute);
  date.setDate(date.getDate() - 1);
  return date;
}

async function seed() {
  console.log("Clearing existing data...");

  await db.delete(schema.workflowEvents);
  await db.delete(schema.prescriptions);
  await db.delete(schema.actionPlans);
  await db.delete(schema.aiDrafts);
  await db.delete(schema.labResults);
  await db.delete(schema.billingRecords);
  await db.delete(schema.diagnosticOrders);
  await db.delete(schema.patients);
  await db.delete(schema.facilityUsers);
  await db.delete(schema.testCatalog);
  await db.delete(schema.facilities);

  console.log("Seeding facilities...");

  await db.insert(schema.facilities).values([
    {
      id: FACILITY_IDS.stLukes,
      name: "St. Luke's Clinic",
      type: "clinic",
      ensName: "stlukes.pisgah.eth",
    },
    {
      id: FACILITY_IDS.sunshineLab,
      name: "Sunshine Diagnostics Lab",
      type: "lab",
      ensName: "sunshinelab.pisgah.eth",
    },
    {
      id: FACILITY_IDS.greenLeaf,
      name: "GreenLeaf Pharmacy",
      type: "pharmacy",
      ensName: "greenleaf.pisgah.eth",
    },
  ]);

  console.log("  3 facilities created");

  console.log("Seeding test catalog...");
  await db.insert(schema.testCatalog).values([
    { facilityId: FACILITY_IDS.stLukes, testName: "Complete Blood Count", price: "5000" },
    { facilityId: FACILITY_IDS.stLukes, testName: "Malaria RDT", price: "3500" },
    { facilityId: FACILITY_IDS.stLukes, testName: "Urinalysis", price: "6000" },
    { facilityId: FACILITY_IDS.stLukes, testName: "Liver Function", price: "12000" },
    { facilityId: FACILITY_IDS.stLukes, testName: "Renal Function", price: "14000" },
  ]);
  console.log("  5 test catalog entries created");

  console.log("Seeding facility users...");

  await db.insert(schema.facilityUsers).values([
    {
      id: USER_IDS.drAdeyemi,
      facilityId: FACILITY_IDS.stLukes,
      dynamicId: "demo-doctor-adeyemi",
      role: "doctor",
      name: "Dr. Adeyemi",
    },
    {
      id: USER_IDS.mrsObi,
      facilityId: FACILITY_IDS.stLukes,
      dynamicId: "demo-accounts-obi",
      role: "accounts",
      name: "Mrs. Obi",
    },
    {
      id: USER_IDS.mrChukwu,
      facilityId: FACILITY_IDS.sunshineLab,
      dynamicId: "demo-labtech-chukwu",
      role: "lab_tech",
      name: "Mr. Chukwu",
    },
    {
      id: USER_IDS.pharmNwosu,
      facilityId: FACILITY_IDS.greenLeaf,
      dynamicId: "demo-pharmacist-nwosu",
      role: "pharmacist",
      name: "Pharm. Nwosu",
    },
  ]);

  console.log("  4 facility users created");

  console.log("Seeding patients...");

  await db.insert(schema.patients).values(
    PATIENTS.map((patient, index) => ({
      ...patient,
      registeredBy: USER_IDS.drAdeyemi,
      facilityId: FACILITY_IDS.stLukes,
      createdAt:
        index < 3
          ? atToday(7, 30 + index * 12)
          : atYesterday(9, 10 + index * 7),
    }))
  );

  console.log(`  ${PATIENTS.length} patients created`);

  console.log("Seeding diagnostic orders...");

  await db.insert(schema.diagnosticOrders).values([
    {
      id: ORDER_IDS.amara,
      patientId: PATIENTS[0].id,
      facilityId: FACILITY_IDS.stLukes,
      doctorId: USER_IDS.drAdeyemi,
      labId: FACILITY_IDS.sunshineLab,
      status: "DOCTOR_REVIEW",
      testType: "Complete Blood Count",
      clinicalNotes: "Fatigue, dizziness, and fever for three days.",
      totalAmount: "5000",
      createdAt: atToday(10, 7),
      updatedAt: atToday(10, 35),
    },
    {
      id: ORDER_IDS.emeka,
      patientId: PATIENTS[1].id,
      facilityId: FACILITY_IDS.stLukes,
      doctorId: USER_IDS.drAdeyemi,
      labId: FACILITY_IDS.sunshineLab,
      status: "SAMPLE_COLLECTED",
      testType: "Malaria RDT",
      clinicalNotes: "Intermittent fever and chills since yesterday.",
      totalAmount: "3500",
      createdAt: atToday(9, 15),
      updatedAt: atToday(9, 45),
    },
    {
      id: ORDER_IDS.fatima,
      patientId: PATIENTS[2].id,
      facilityId: FACILITY_IDS.stLukes,
      doctorId: USER_IDS.drAdeyemi,
      labId: FACILITY_IDS.sunshineLab,
      status: "AWAITING_PAYMENT",
      testType: "Liver Function",
      clinicalNotes: "Abdominal discomfort and elevated fatigue.",
      totalAmount: "12000",
      createdAt: atToday(8, 45),
      updatedAt: atToday(8, 45),
    },
    {
      id: ORDER_IDS.chidi,
      patientId: PATIENTS[3].id,
      facilityId: FACILITY_IDS.stLukes,
      doctorId: USER_IDS.drAdeyemi,
      labId: FACILITY_IDS.sunshineLab,
      status: "COMPLETED",
      testType: "Urinalysis",
      clinicalNotes: "Dysuria and lower abdominal pain.",
      totalAmount: "6000",
      attestationUid: TEST_ATTESTATION_UID,
      createdAt: atYesterday(11, 5),
      updatedAt: atYesterday(15, 20),
    },
    {
      id: ORDER_IDS.ngozi,
      patientId: PATIENTS[4].id,
      facilityId: FACILITY_IDS.stLukes,
      doctorId: USER_IDS.drAdeyemi,
      labId: FACILITY_IDS.sunshineLab,
      status: "PATIENT_NOTIFIED",
      testType: "Renal Function",
      clinicalNotes: "Swelling and blood pressure follow-up.",
      totalAmount: "14000",
      attestationUid: TEST_ATTESTATION_UID,
      createdAt: atYesterday(13, 40),
      updatedAt: atYesterday(16, 10),
    },
    {
      id: ORDER_IDS.blessing,
      patientId: PATIENTS[5].id,
      facilityId: FACILITY_IDS.stLukes,
      doctorId: USER_IDS.drAdeyemi,
      labId: FACILITY_IDS.sunshineLab,
      status: "PATIENT_NOTIFIED",
      testType: "Malaria RDT",
      clinicalNotes: "Fever with headache and weakness.",
      totalAmount: "8000",
      attestationUid: TEST_ATTESTATION_UID,
      createdAt: atToday(11, 30),
      updatedAt: atToday(12, 20),
    },
  ]);

  console.log("  6 diagnostic orders created");

  console.log("Seeding billing records...");

  await db.insert(schema.billingRecords).values([
    {
      orderId: ORDER_IDS.amara,
      amount: "5000",
      status: "cash_confirmed",
      confirmedBy: USER_IDS.mrsObi,
      confirmedAt: atToday(10, 10),
      createdAt: atToday(10, 7),
    },
    {
      orderId: ORDER_IDS.emeka,
      amount: "3500",
      status: "cash_confirmed",
      confirmedBy: USER_IDS.mrsObi,
      confirmedAt: atToday(9, 18),
      createdAt: atToday(9, 15),
    },
    {
      orderId: ORDER_IDS.fatima,
      amount: "12000",
      status: "unpaid",
      createdAt: atToday(8, 45),
    },
    {
      orderId: ORDER_IDS.chidi,
      amount: "6000",
      status: "cash_confirmed",
      confirmedBy: USER_IDS.mrsObi,
      confirmedAt: atToday(8, 5),
      createdAt: atToday(8, 0),
    },
    {
      orderId: ORDER_IDS.ngozi,
      amount: "14000",
      status: "cash_confirmed",
      confirmedBy: USER_IDS.mrsObi,
      confirmedAt: atToday(8, 25),
      createdAt: atToday(8, 20),
    },
    {
      orderId: ORDER_IDS.blessing,
      amount: "8000",
      status: "cash_confirmed",
      confirmedBy: USER_IDS.mrsObi,
      confirmedAt: atToday(11, 35),
      createdAt: atToday(11, 30),
    },
  ]);

  console.log("  6 billing records created");

  console.log("Seeding lab results...");

  const labResultRows = await db
    .insert(schema.labResults)
    .values([
      {
        orderId: ORDER_IDS.amara,
        labUserId: USER_IDS.mrChukwu,
        rawText:
          "Haemoglobin: 9.8 g/dL\nPCV: 30%\nWBC: 7.2 x10^9/L\nPlatelets: 215 x10^9/L",
        attestationUid: TEST_ATTESTATION_UID,
        createdAt: atToday(10, 32),
      },
      {
        orderId: ORDER_IDS.chidi,
        labUserId: USER_IDS.mrChukwu,
        rawText:
          "Urinalysis: mild leukocytes present, nitrites negative, pH 6.0, SG 1.015",
        attestationUid: TEST_ATTESTATION_UID,
        createdAt: atYesterday(12, 10),
      },
      {
        orderId: ORDER_IDS.ngozi,
        labUserId: USER_IDS.mrChukwu,
        rawText:
          "Creatinine mildly elevated. Urea within reference range. Suggest follow-up hydration review.",
        attestationUid: TEST_ATTESTATION_UID,
        createdAt: atYesterday(15, 10),
      },
      {
        orderId: ORDER_IDS.blessing,
        labUserId: USER_IDS.mrChukwu,
        rawText:
          "Malaria RDT positive. Clinical correlation advised before final treatment plan.",
        attestationUid: TEST_ATTESTATION_UID,
        createdAt: atToday(12, 5),
      },
    ])
    .returning({
      id: schema.labResults.id,
      orderId: schema.labResults.orderId,
    });

  const resultByOrder = new Map(
    labResultRows.map((result) => [result.orderId, result.id])
  );

  console.log("  4 lab results created");

  console.log("Seeding AI drafts...");

  await db.insert(schema.aiDrafts).values([
    {
      orderId: ORDER_IDS.amara,
      resultId: resultByOrder.get(ORDER_IDS.amara)!,
      draftText:
        "CBC suggests mild anaemia. Review symptoms, confirm bleeding history, and consider iron support after clinician assessment.",
      agentVerified: true,
      createdAt: atToday(10, 34),
    },
  ]);

  console.log("  1 AI draft created");

  console.log("Seeding action plans...");

  await db.insert(schema.actionPlans).values([
    {
      orderId: ORDER_IDS.chidi,
      resultId: resultByOrder.get(ORDER_IDS.chidi)!,
      summary:
        "Urinalysis findings are consistent with an uncomplicated urinary tract infection.",
      recommendations:
        "Encourage oral fluids and complete the prescribed antibiotic course.",
      approvedBy: USER_IDS.drAdeyemi,
      approvedAt: atYesterday(15, 20),
      createdAt: atYesterday(15, 20),
    },
    {
      orderId: ORDER_IDS.ngozi,
      resultId: resultByOrder.get(ORDER_IDS.ngozi)!,
      summary:
        "Renal markers require follow-up review but do not suggest an acute emergency.",
      recommendations:
        "Schedule repeat renal function monitoring and reinforce hydration guidance.",
      approvedBy: USER_IDS.drAdeyemi,
      approvedAt: atYesterday(16, 10),
      createdAt: atYesterday(16, 10),
    },
    {
      orderId: ORDER_IDS.blessing,
      resultId: resultByOrder.get(ORDER_IDS.blessing)!,
      summary:
        "Malaria test is positive. Start treatment promptly and monitor symptom resolution.",
      recommendations:
        "Begin antimalarial medication, maintain hydration, and return if fever persists beyond 48 hours.",
      approvedBy: USER_IDS.drAdeyemi,
      approvedAt: atToday(12, 20),
      createdAt: atToday(12, 20),
    },
  ]);

  console.log("  3 action plans created");

  console.log("Seeding prescriptions...");

  await db.insert(schema.prescriptions).values([
    {
      orderId: ORDER_IDS.blessing,
      patientId: PATIENTS[5].id,
      pharmacyId: FACILITY_IDS.greenLeaf,
      items: [
        {
          drugName: "Artemether-Lumefantrine",
          dosage: "80/480 mg",
          quantity: "6 doses",
          instructions: "Take with food as directed.",
        },
      ],
      status: "ready_for_pickup",
      attestationUid: TEST_ATTESTATION_UID,
      createdAt: atToday(12, 24),
    },
  ]);

  console.log("  1 prescription created");
  console.log("Seed complete.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
