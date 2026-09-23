// ============================================================
// SCHEMA: debit_notes
// Shortage debit vouchers generated during billing.
//
// CONFIRMED BUSINESS RULE (Phase 2 Final Locked Spec):
//   Shortage Qty = N-Weight - R-Weight
//   Applicable Qty depends on customer Rule A or Rule B.
//   Debit Amount = Applicable Qty × MATERIAL RATE (NOT Freight Rate)
//   Ledger posting:
//     "Transportation Charges - RCM Debit Note" → DEBIT
// ============================================================

import {
  pgTable,
  uuid,
  varchar,
  numeric,
  text,
  date,
  timestamp,
  index,
  foreignKey,
} from "drizzle-orm/pg-core";
import { firms } from "./firms";
import { bills } from "./bills";
import { parties } from "./parties-companies";

export const debitNotes = pgTable(
  "debit_notes",
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

    // Sequential debit note voucher number (system generated)
    voucherNumber: varchar("voucher_number", { length: 50 }).notNull(),

    voucherDate: date("voucher_date").notNull(),

    // ---- Shortage Summary ----
    // Total raw shortage across all bill items
    totalShortageQtyRaw: numeric("total_shortage_qty_raw", {
      precision: 12,
      scale: 3,
    }),

    // Total allowable shortage (sum of item allowances)
    totalShortageAllowance: numeric("total_shortage_allowance", {
      precision: 12,
      scale: 3,
    }),

    // Total applicable (debitable) shortage quantity
    totalShortageQtyApplicable: numeric("total_shortage_qty_applicable", {
      precision: 12,
      scale: 3,
    }),

    // Material rate used for valuation
    materialRateApplied: numeric("material_rate_applied", {
      precision: 12,
      scale: 4,
    }),

    // CONFIRMED: Debit Amount = Applicable Qty × Material Rate
    debitAmount: numeric("debit_amount", { precision: 15, scale: 2 }).notNull(),

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
      name: "debit_notes_party_firm_isolation_fk",
      columns: [table.partyId, table.firmId],
      foreignColumns: [parties.id, parties.firmId],
    }),

    index("debit_notes_firm_id_idx").on(table.firmId),
    index("debit_notes_bill_id_idx").on(table.billId),
    index("debit_notes_party_id_idx").on(table.partyId),
  ]
);

export type DebitNote = typeof debitNotes.$inferSelect;
export type NewDebitNote = typeof debitNotes.$inferInsert;
