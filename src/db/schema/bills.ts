// ============================================================
// SCHEMA: firm_bill_sequences
// Concurrency-safe bill number sequencing per firm.
//
// CONFIRMED BUSINESS RULE (Phase 2 Final Locked Spec):
//   Bill numbers are sequential per firm.
//   Deepraj: 23, 24, 25...
//   Shivsai: 23, 24, 25... (separate — same number is fine across firms)
//   Editing a bill NEVER changes its bill number.
//   Bill number once assigned is permanent.
//
// IMPORTANT — Concurrency Safety:
//   We use a dedicated sequence table with SELECT ... FOR UPDATE
//   in a transaction to prevent duplicate bill numbers under
//   concurrent API requests.
//   DO NOT use MAX(bill_number)+1 — it is not concurrency-safe.
// ============================================================

import {
  pgTable,
  uuid,
  integer,
  timestamp,
  unique,
  // Bills-specific imports (used below for the bills table)
  varchar,
  numeric,
  date,
  text,
  boolean,
  index,
  pgEnum,
  foreignKey,
} from "drizzle-orm/pg-core";
import { firms } from "./firms";

export const firmBillSequences = pgTable(
  "firm_bill_sequences",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    firmId: uuid("firm_id")
      .notNull()
      .references(() => firms.id, { onDelete: "restrict" }),

    // The last bill number issued for this firm
    // Next bill number = lastBillNumber + 1
    lastBillNumber: integer("last_bill_number").notNull().default(0),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // One sequence row per firm
    unique("firm_bill_sequences_firm_unique").on(table.firmId),
  ]
);

export type FirmBillSequence = typeof firmBillSequences.$inferSelect;
export type NewFirmBillSequence = typeof firmBillSequences.$inferInsert;

// ============================================================
// SCHEMA: bills
// A bill is a formal customer invoice containing multiple trips.
//
// CONFIRMED:
//   - Bill belongs to a firm and a party.
//   - Sequential bill number per firm (from firm_bill_sequences).
//   - Bill number is NEVER changed on edit.
//   - Only Received trips can be included.
//   - Bill editing triggers atomic recalculation of all related
//     records (totals, TDS, debit notes, ledger, outstanding).
//   - TDS is calculated on GROSS bill total.
//
// ============================================================
// CRITICAL SERVICE LAYER SAFETY PROTOCOLS — ENFORCED HERE, NOT OPTIONAL:
//
// [A] PAYMENT ALLOCATION TOTAL SAFETY:
//   Race condition risk: Two concurrent API calls can both read
//   bill.pending_amount = X and both insert allocations of X,
//   resulting in 2X allocated against a bill worth X.
//
//   MANDATORY: Before inserting into payment_allocations, the service
//   layer MUST execute:
//     BEGIN;
//     SELECT * FROM bills WHERE id = $bill_id FOR UPDATE;  ← serializes concurrent access
//     IF (existing_allocations + new_amount) > bill.net_bill_amount THEN ROLLBACK;
//     INSERT INTO payment_allocations (...) VALUES (...);
//     UPDATE bills SET received_amount = ..., pending_amount = ...;
//     COMMIT;
//
//   DO NOT use optimistic locking or application-level sum checks alone.
//   SELECT FOR UPDATE is required.
//
// [B] BILL EDIT WITH EXISTING PAYMENTS:
//   If a bill already has payments allocated and is edited:
//   - NEVER delete or silently rewrite payment_allocations rows.
//   - NEVER decrease net_bill_amount below received_amount.
//   - MANDATORY pre-edit check (inside transaction with FOR UPDATE):
//       IF (new_net_bill_amount < bills.received_amount) THEN
//         ROLLBACK with error:
//         "Bill has ₹{received_amount} already received.
//          Cannot edit bill below ₹{received_amount}."
//   - If check passes:
//       Recalculate: bill_items, tds_entries, debit_notes, ledger rows, pending_amount.
//       ALL in one atomic transaction.
//       Preserve all existing payment_allocations rows unchanged.
//       Audit log the before/after values.
//
// [C] BILL EDIT LOCK:
//   bill_edit_locked = true means the bill is locked from further edits.
//   Set automatically when bill status is POSTED.
//   Service layer must reject edits when this flag is true.
//   Only ADMIN role can unlock (future feature — not implemented in Phase 3).
// ============================================================

// All drizzle imports are at the top of this file.
import { parties } from "./parties-companies";

export const billStatusEnum = pgEnum("bill_status", [
  "DRAFT",      // Being prepared, not yet posted
  "POSTED",     // Finalized and posted to ledger
  "CANCELLED",  // Cancelled — number retained for audit trail
]);

export const bills = pgTable(
  "bills",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    firmId: uuid("firm_id")
      .notNull()
      .references(() => firms.id, { onDelete: "restrict" }),

    partyId: uuid("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "restrict" }),

    // Sequential bill number per firm. NEVER changes after assignment.
    billNumber: integer("bill_number").notNull(),

    billDate: date("bill_date").notNull(),

    // ---- Weight Totals ----
    totalNWeight: numeric("total_n_weight", { precision: 12, scale: 3 }),
    totalRWeight: numeric("total_r_weight", { precision: 12, scale: 3 }),

    // ---- Financial Totals ----
    // Gross freight before any deductions
    subtotalFreight: numeric("subtotal_freight", {
      precision: 15,
      scale: 2,
    }).notNull(),

    // TDS — CONFIRMED: calculated on gross bill total
    tdsAmount: numeric("tds_amount", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),

    // Shortage debit total
    debitNoteAmount: numeric("debit_note_amount", {
      precision: 15,
      scale: 2,
    })
      .notNull()
      .default("0"),

    // Net bill amount = Gross - TDS - Debit Notes (or per confirmed formula)
    netBillAmount: numeric("net_bill_amount", {
      precision: 15,
      scale: 2,
    }).notNull(),

    // Amount already received against this bill
    receivedAmount: numeric("received_amount", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),

    // Pending = net_bill_amount - received_amount
    pendingAmount: numeric("pending_amount", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),

    // Rule snapshot: what TDS config was applied at bill creation time
    appliedTdsSection: varchar("applied_tds_section", { length: 20 }),
    appliedTdsPercentage: numeric("applied_tds_percentage", {
      precision: 5,
      scale: 2,
    }),

    // Rule snapshot: what freight basis was used
    appliedFreightBasis: varchar("applied_freight_basis", { length: 20 }),

    status: billStatusEnum("status").notNull().default("DRAFT"),

    // SAFETY FLAG — see service layer protocol [C] above.
    // When true: bill cannot be edited until unlocked by ADMIN.
    // Automatically set to true when status transitions to POSTED.
    // Service layer MUST reject any edit attempt when this is true.
    billEditLocked: boolean("bill_edit_locked").notNull().default(false),

    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    // CRITICAL: bill number must be unique per firm
    unique("bills_firm_bill_number_unique").on(table.firmId, table.billNumber),

    // ============================================================
    // FIRM ISOLATION — COMPOSITE FOREIGN KEY (DATABASE-LEVEL ENFORCEMENT)
    // ============================================================
    // This FK references parties(id, firm_id).
    // PostgreSQL will check that bills.firm_id === parties.firm_id for
    // every row where party_id is set.
    //
    // NEGATIVE TEST: INSERT bills WHERE firm_id=DEEPRAJ, party_id=SHIVSAI_PARTY
    //   → PostgreSQL: ERROR: insert or update on table "bills" violates foreign
    //     key constraint "bills_party_firm_isolation_fk"
    //   This is rejected at the DATABASE level, NOT just in application code.
    foreignKey({
      name: "bills_party_firm_isolation_fk",
      columns: [table.partyId, table.firmId],
      foreignColumns: [parties.id, parties.firmId],
    }),

    index("bills_firm_id_idx").on(table.firmId),
    index("bills_party_id_idx").on(table.partyId),
    index("bills_date_idx").on(table.billDate),
    index("bills_status_idx").on(table.status),
    index("bills_pending_idx").on(table.firmId, table.partyId, table.status),
  ]
);

export type Bill = typeof bills.$inferSelect;
export type NewBill = typeof bills.$inferInsert;
