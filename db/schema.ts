import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const riskStudies = sqliteTable(
  "risk_studies",
  {
    id: text("id").primaryKey(),
    clientFirstName: text("client_first_name").notNull(),
    clientLastName: text("client_last_name").notNull(),
    spouseName: text("spouse_name"),
    maritalRegime: text("marital_regime"),
    familyMode: text("family_mode").notNull(),
    consultantKey: text("consultant_key").notNull(),
    totalAssetsCents: integer("total_assets_cents").notNull().default(0),
    coverageGapCents: integer("coverage_gap_cents").notNull().default(0),
    payloadJson: text("payload_json").notNull(),
    revision: integer("revision").notNull().default(1),
    createdBy: text("created_by").notNull(),
    updatedBy: text("updated_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_risk_studies_client_name").on(
      table.clientLastName,
      table.clientFirstName,
    ),
    index("idx_risk_studies_updated_at").on(table.updatedAt),
    index("idx_risk_studies_consultant").on(table.consultantKey),
  ],
);

export const riskStudyRevisions = sqliteTable(
  "risk_study_revisions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    studyId: text("study_id")
      .notNull()
      .references(() => riskStudies.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    payloadJson: text("payload_json").notNull(),
    changedBy: text("changed_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("uidx_risk_study_revisions_study_revision").on(
      table.studyId,
      table.revision,
    ),
    index("idx_risk_study_revisions_study").on(table.studyId),
  ],
);
