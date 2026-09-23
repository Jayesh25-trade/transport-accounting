// ============================================================
// SCHEMA: tds_entries
// TDS (Tax Deducted at Source) records linked to bills.
//
// CONFIRMED BUSINESS RULE (Phase 2 Final Locked Spec):
//   TDS is recorded at BILL CREATION time.
//   TDS = Gross Bill Total × TDS Percentage.
//   Example: ₹1,00,000 × 1% = ₹1,000.
//   Section example from client ledger: "94C"
//   TDS must auto-recalculate when bill is edited.
//   Ledger posting: "Tds on Contract 94C Journal" → DEBIT
// ============================================================

import {
  pgTable,
  uuid,
  varchar,
  numeric,
  text,
  timestamp,
  index,
  unique,
  foreignKey,
} from "drizzle-orm/pg-core";
import { firms } from "./firms";
import { bills } from "./bills";
import { parties } from "./parties-companies";

export const tdsEntries = pgTable(
  "tds_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    firmId: uuid("firm_id")
      .notNull()
      .references(() => firms.id, { onDelete: "restrict" }),

    billId: uuid("bill_id")
      .notNull()
      .references(() => bills.id, { onDelete: "cascade" }),

    partyId: uuid("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "restrict" }),

    // e.g. "94C"
    tdsSection: varchar("tds_section", { length: 20 }).notNull(),

    // e.g. 1.00 for 1%
    tdsPercentage: numeric("tds_percentage", { precision: 5, scale: 2 }).notNull(),

    // The gross amount on which TDS was calculated
    tdsBaseAmount: numeric("tds_base_amount", {
      precision: 15,
      scale: 2,
    }).notNull(),

    // TDS Amount = tds_base_amount × (tds_percentage / 100)
    tdsAmount: numeric("tds_amount", { precision: 15, scale: 2 }).notNull(),

    // For reconciliation / IT returns
    remarks: text("remarks"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // FIRM ISOLATION — COMPOSITE FOREIGN KEY (DATABASE-LEVEL)
    foreignKey({
      name: "tds_entries_party_firm_isolation_fk",
      columns: [table.partyId, table.firmId],
      foreignColumns: [parties.id, parties.firmId],
    }),

    // One TDS entry per bill (TDS is calculated once per bill)
    unique("tds_entries_bill_unique").on(table.billId),
    index("tds_entries_firm_id_idx").on(table.firmId),
    index("tds_entries_party_id_idx").on(table.partyId),
  ]
);

export type TdsEntry = typeof tdsEntries.$inferSelect;
export type NewTdsEntry = typeof tdsEntries.$inferInsert;
