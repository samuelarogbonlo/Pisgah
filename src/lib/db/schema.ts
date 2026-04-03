import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  date,
  numeric,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const facilityTypeEnum = pgEnum("facility_type", [
  "clinic",
  "lab",
  "pharmacy",
]);

export const facilityUserRoleEnum = pgEnum("facility_user_role", [
  "doctor",
  "accounts",
  "lab_tech",
  "pharmacist",
  "admin",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "CREATED",
  "AWAITING_PAYMENT",
  "PAID",
  "ROUTED_TO_LAB",
  "SAMPLE_COLLECTED",
  "RESULT_UPLOADED",
  "DOCTOR_REVIEW",
  "ACTION_PLAN_APPROVED",
  "PATIENT_NOTIFIED",
  "COMPLETED",
  "CANCELLED",
]);

export const billingStatusEnum = pgEnum("billing_status", [
  "unpaid",
  "cash_confirmed",
  "online_confirmed",
  "failed",
]);

export const prescriptionStatusEnum = pgEnum("prescription_status", [
  "issued",
  "sent_to_pharmacy",
  "ready_for_pickup",
  "fulfilled",
  "redeemed",
]);

// ─── Tables ──────────────────────────────────────────────────────────────────

export const facilities = pgTable("facilities", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  type: facilityTypeEnum("type").notNull(),
  ensName: text("ens_name"),
  walletAddress: text("wallet_address"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const testCatalog = pgTable("test_catalog", {
  id: uuid("id").defaultRandom().primaryKey(),
  facilityId: uuid("facility_id").notNull().references(() => facilities.id),
  testName: text("test_name").notNull(),
  price: numeric("price").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const facilityUsers = pgTable("facility_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  facilityId: uuid("facility_id")
    .notNull()
    .references(() => facilities.id),
  dynamicId: text("dynamic_id").notNull().unique(),
  role: facilityUserRoleEnum("role").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const patients = pgTable("patients", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  dob: date("dob"),
  worldIdHash: text("world_id_hash"),
  walletAddress: text("wallet_address"),
  registeredBy: uuid("registered_by")
    .notNull()
    .references(() => facilityUsers.id),
  facilityId: uuid("facility_id")
    .notNull()
    .references(() => facilities.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const diagnosticOrders = pgTable("diagnostic_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  patientId: uuid("patient_id")
    .notNull()
    .references(() => patients.id),
  facilityId: uuid("facility_id")
    .notNull()
    .references(() => facilities.id),
  doctorId: uuid("doctor_id")
    .notNull()
    .references(() => facilityUsers.id),
  labId: uuid("lab_id").references(() => facilities.id),
  status: orderStatusEnum("status").notNull(),
  testType: text("test_type").notNull(),
  clinicalNotes: text("clinical_notes"),
  totalAmount: numeric("total_amount"),
  attestationUid: text("attestation_uid"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const billingRecords = pgTable("billing_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => diagnosticOrders.id),
  amount: numeric("amount").notNull(),
  status: billingStatusEnum("status").notNull(),
  confirmedBy: uuid("confirmed_by").references(() => facilityUsers.id),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const labResults = pgTable("lab_results", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .unique()
    .references(() => diagnosticOrders.id),
  labUserId: uuid("lab_user_id")
    .notNull()
    .references(() => facilityUsers.id),
  rawText: text("raw_text").notNull(),
  fileUrl: text("file_url"),
  attestationUid: text("attestation_uid"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const aiDrafts = pgTable("ai_drafts", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => diagnosticOrders.id),
  resultId: uuid("result_id")
    .notNull()
    .references(() => labResults.id),
  draftText: text("draft_text").notNull(),
  agentVerified: boolean("agent_verified").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const actionPlans = pgTable("action_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .unique()
    .references(() => diagnosticOrders.id),
  resultId: uuid("result_id")
    .notNull()
    .references(() => labResults.id),
  summary: text("summary").notNull(),
  recommendations: text("recommendations").notNull(),
  approvedBy: uuid("approved_by")
    .notNull()
    .references(() => facilityUsers.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const prescriptions = pgTable("prescriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => diagnosticOrders.id),
  patientId: uuid("patient_id")
    .notNull()
    .references(() => patients.id),
  pharmacyId: uuid("pharmacy_id").references(() => facilities.id),
  items: jsonb("items").notNull(),
  status: prescriptionStatusEnum("status").notNull(),
  attestationUid: text("attestation_uid"),
  redemptionCode: text("redemption_code"),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const workflowEvents = pgTable("workflow_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => diagnosticOrders.id),
  eventType: text("event_type").notNull(),
  actorId: uuid("actor_id"),
  actorRole: text("actor_role"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Relations ───────────────────────────────────────────────────────────────

export const facilitiesRelations = relations(facilities, ({ many }) => ({
  facilityUsers: many(facilityUsers),
  patients: many(patients),
  diagnosticOrders: many(diagnosticOrders, { relationName: "orderFacility" }),
  labOrders: many(diagnosticOrders, { relationName: "orderLab" }),
  prescriptions: many(prescriptions),
  testCatalog: many(testCatalog),
}));

export const testCatalogRelations = relations(testCatalog, ({ one }) => ({
  facility: one(facilities, {
    fields: [testCatalog.facilityId],
    references: [facilities.id],
  }),
}));

export const facilityUsersRelations = relations(
  facilityUsers,
  ({ one, many }) => ({
    facility: one(facilities, {
      fields: [facilityUsers.facilityId],
      references: [facilities.id],
    }),
    registeredPatients: many(patients),
    diagnosticOrders: many(diagnosticOrders),
    billingConfirmations: many(billingRecords),
    labResults: many(labResults),
    approvedActionPlans: many(actionPlans),
  })
);

export const patientsRelations = relations(patients, ({ one, many }) => ({
  registeredByUser: one(facilityUsers, {
    fields: [patients.registeredBy],
    references: [facilityUsers.id],
  }),
  facility: one(facilities, {
    fields: [patients.facilityId],
    references: [facilities.id],
  }),
  diagnosticOrders: many(diagnosticOrders),
  prescriptions: many(prescriptions),
}));

export const diagnosticOrdersRelations = relations(
  diagnosticOrders,
  ({ one, many }) => ({
    patient: one(patients, {
      fields: [diagnosticOrders.patientId],
      references: [patients.id],
    }),
    facility: one(facilities, {
      fields: [diagnosticOrders.facilityId],
      references: [facilities.id],
      relationName: "orderFacility",
    }),
    doctor: one(facilityUsers, {
      fields: [diagnosticOrders.doctorId],
      references: [facilityUsers.id],
    }),
    lab: one(facilities, {
      fields: [diagnosticOrders.labId],
      references: [facilities.id],
      relationName: "orderLab",
    }),
    billingRecords: many(billingRecords),
    labResult: one(labResults),
    aiDrafts: many(aiDrafts),
    actionPlan: one(actionPlans),
    prescriptions: many(prescriptions),
    workflowEvents: many(workflowEvents),
  })
);

export const billingRecordsRelations = relations(billingRecords, ({ one }) => ({
  order: one(diagnosticOrders, {
    fields: [billingRecords.orderId],
    references: [diagnosticOrders.id],
  }),
  confirmedByUser: one(facilityUsers, {
    fields: [billingRecords.confirmedBy],
    references: [facilityUsers.id],
  }),
}));

export const labResultsRelations = relations(
  labResults,
  ({ one, many }) => ({
    order: one(diagnosticOrders, {
      fields: [labResults.orderId],
      references: [diagnosticOrders.id],
    }),
    labUser: one(facilityUsers, {
      fields: [labResults.labUserId],
      references: [facilityUsers.id],
    }),
    aiDrafts: many(aiDrafts),
    actionPlans: many(actionPlans),
  })
);

export const aiDraftsRelations = relations(aiDrafts, ({ one }) => ({
  order: one(diagnosticOrders, {
    fields: [aiDrafts.orderId],
    references: [diagnosticOrders.id],
  }),
  result: one(labResults, {
    fields: [aiDrafts.resultId],
    references: [labResults.id],
  }),
}));

export const actionPlansRelations = relations(actionPlans, ({ one }) => ({
  order: one(diagnosticOrders, {
    fields: [actionPlans.orderId],
    references: [diagnosticOrders.id],
  }),
  result: one(labResults, {
    fields: [actionPlans.resultId],
    references: [labResults.id],
  }),
  approvedByUser: one(facilityUsers, {
    fields: [actionPlans.approvedBy],
    references: [facilityUsers.id],
  }),
}));

export const prescriptionsRelations = relations(
  prescriptions,
  ({ one }) => ({
    order: one(diagnosticOrders, {
      fields: [prescriptions.orderId],
      references: [diagnosticOrders.id],
    }),
    patient: one(patients, {
      fields: [prescriptions.patientId],
      references: [patients.id],
    }),
    pharmacy: one(facilities, {
      fields: [prescriptions.pharmacyId],
      references: [facilities.id],
    }),
  })
);

export const workflowEventsRelations = relations(
  workflowEvents,
  ({ one }) => ({
    order: one(diagnosticOrders, {
      fields: [workflowEvents.orderId],
      references: [diagnosticOrders.id],
    }),
  })
);
