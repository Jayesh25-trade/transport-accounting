// ============================================================
// SCHEMA: import_batches, raw_import_records, import_errors
//
// CONFIRMED REQUIREMENT (Phase 2 Final Locked Spec):
//   Historical Excel data must be safely imported for:
//     FY 2024-25, FY 2025-26, FY 2026-27
//
//   Pipeline:
//     Upload Excel → Staging (raw_import_records)
//                 → Validate & Map
//                 → Preview with errors
//                 → Atomic batch commit OR rollback
//
//   Phase 3 creates the INFRASTRUCTURE ONLY.
//   Actual Excel data import happens in a later phase.
// ============================================================

import {
  pgTable,
  uuid,
  varchar,
  integer,
  text,
  boolean,
  jsonb,
  timestamp,
  date,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { firms } from "./firms";
import { users } from "./users";

// Import batch status lifecycle
export const importBatchStatusEnum = pgEnum("import_batch_status", [
  "UPLOADED",     // File received, not yet processed
  "VALIDATING",   // Validation in progress
  "VALIDATED",    // Validation complete — ready for preview
  "ERRORS",       // Validation found errors — needs review
  "COMMITTED",    // Successfully imported to production tables
  "ROLLED_BACK",  // Import was rolled back
]);

// Type of data being imported
export const importDataTypeEnum = pgEnum("import_data_type", [
  "DAILY_ENTRIES",
  "BILLS",
  "PAYMENTS",
  "LEDGER",
  "OPENING_BALANCES",
  "MIXED",
]);

// ------------------------------------------------------------
// IMPORT_BATCHES — Tracks each Excel upload session
// ------------------------------------------------------------
export const importBatches = pgTable(
  "import_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    firmId: uuid("firm_id")
      .notNull()
      .references(() => firms.id, { onDelete: "restrict" }),

    uploadedBy: uuid("uploaded_by").references(() => users.id, {
      onDelete: "set null",
    }),

    // Original filename for reference
    originalFileName: varchar("original_filename", { length: 255 }).notNull(),

    // Financial year being imported: "2024-25", "2025-26", "2026-27"
    financialYear: varchar("financial_year", { length: 10 }).notNull(),

    dataType: importDataTypeEnum("data_type").notNull(),

    status: importBatchStatusEnum("status").notNull().default("UPLOADED"),

    // Counts for progress tracking
    totalRows: integer("total_rows").notNull().default(0),
    validRows: integer("valid_rows").notNull().default(0),
    errorRows: integer("error_rows").notNull().default(0),
    committedRows: integer("committed_rows").notNull().default(0),

    // When the import was committed to production
    committedAt: timestamp("committed_at", { withTimezone: true }),

    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("import_batches_firm_id_idx").on(table.firmId),
    index("import_batches_status_idx").on(table.status),
    index("import_batches_fy_idx").on(table.financialYear),
  ]
);

// ------------------------------------------------------------
// RAW_IMPORT_RECORDS — Staging table for Excel row data
// Each row from the uploaded Excel is stored here before
// validation and mapping to production tables.
// ------------------------------------------------------------
export const rawImportRecords = pgTable(
  "raw_import_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    batchId: uuid("batch_id")
      .notNull()
      .references(() => importBatches.id, { onDelete: "cascade" }),

    // Row number from the Excel file (for error reporting)
    rowNumber: integer("row_number").notNull(),

    // The raw data from the Excel row stored as JSON
    rawData: jsonb("raw_data").notNull(),

    // Mapped/resolved data after validation
    mappedData: jsonb("mapped_data"),

    // Validation result
    isValid: boolean("is_valid"),
    isDuplicate: boolean("is_duplicate").notNull().default(false),
    isCommitted: boolean("is_committed").notNull().default(false),

    // If committed, the ID of the production record created
    productionRecordId: uuid("production_record_id"),
    productionTableName: varchar("production_table_name", { length: 100 }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("raw_import_records_batch_id_idx").on(table.batchId),
    index("raw_import_records_is_valid_idx").on(table.isValid),
    index("raw_import_records_is_committed_idx").on(table.isCommitted),
  ]
);

// ------------------------------------------------------------
// IMPORT_ERRORS — Detailed error records per row
// ------------------------------------------------------------
export const importErrors = pgTable(
  "import_errors",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    batchId: uuid("batch_id")
      .notNull()
      .references(() => importBatches.id, { onDelete: "cascade" }),

    rawRecordId: uuid("raw_record_id").references(() => rawImportRecords.id, {
      onDelete: "cascade",
    }),

    rowNumber: integer("row_number").notNull(),

    // Field that caused the error
    fieldName: varchar("field_name", { length: 100 }),

    // Raw value that was invalid
    rawValue: text("raw_value"),

    // Human-readable error message
    errorMessage: text("error_message").notNull(),

    // Error severity
    severity: varchar("severity", { length: 20 }).notNull().default("ERROR"),
    // "ERROR" = must fix | "WARNING" = can proceed

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("import_errors_batch_id_idx").on(table.batchId),
    index("import_errors_row_number_idx").on(table.rowNumber),
  ]
);

export type ImportBatch = typeof importBatches.$inferSelect;
export type NewImportBatch = typeof importBatches.$inferInsert;
export type RawImportRecord = typeof rawImportRecords.$inferSelect;
export type NewRawImportRecord = typeof rawImportRecords.$inferInsert;
export type ImportError = typeof importErrors.$inferSelect;
export type NewImportError = typeof importErrors.$inferInsert;
