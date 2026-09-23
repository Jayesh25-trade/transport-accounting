// ============================================================
// SCHEMA: ledger_transactions
// The accounting-style Customer / Party Ledger.
//
// CONFIRMED BUSINESS RULE (Phase 2 Final Locked Spec):
//
// Ledger is automatically generated from transactions.
// Users do NOT manually type ledger rows.
//
// CONFIRMED Dr/Cr accounting treatment:
//   "Transportation Charges - RCM Journal" (Bill Invoice)  → CREDIT
//   "Transportation Charges - RCM Debit Note" (Shortage)   → DEBIT
//   "Tds on Contract 94C Journal" (TDS)                    → DEBIT
//   "Bank / Cash Payment" (Payment received)               → DEBIT
//
// Running balance = Opening Balance + Σ Credits − Σ Debits
//
// Source traceability:
//   Every ledger row must reference the entity that created it
//   (bill, payment, tds_entry, debit_note, opening_balance)
//   so that ledger rows can be regenerated / verified.
//
// IMPORTANT: Deepraj and Shivsai ledgers are strictly separate.
//   firm_id enforces this.
//
// SCHEMA: opening_balances
// CONFIRMED: Supports Party opening balance entry per firm.
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
  pgEnum,
  unique,
  foreignKey,
} from "drizzle-orm/pg-core";
import { firms } from "./firms";
import { parties } from "./parties-companies";

// Voucher types matching client's actual accounting ledger terminology
export const ledgerVoucherTypeEnum = pgEnum("ledger_voucher_type", [
  "OPENING_BALANCE",              // Opening balance entry
  "TRANSPORTATION_CHARGES_RCM",   // Bill invoice posting
  "DEBIT_NOTE_RCM",               // Shortage debit note posting
  "TDS_JOURNAL",                  // TDS deduction posting
  "PAYMENT_BANK",                 // Bank/cash payment received
  "PAYMENT_CASH",                 // Cash payment received
  "ADVANCE_RECEIPT",              // Advance payment received
  "ADJUSTMENT",                   // Manual correction (admin only)
]);

// Which direction this ledger entry affects the party account
export const ledgerEntryTypeEnum = pgEnum("ledger_entry_type", [
  "DEBIT",
  "CREDIT",
]);

export const ledgerTransactions = pgTable(
  "ledger_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    firmId: uuid("firm_id")
      .notNull()
      .references(() => firms.id, { onDelete: "restrict" }),

    partyId: uuid("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "restrict" }),

    transactionDate: date("transaction_date").notNull(),

    // Voucher description matching client ledger format
    // e.g. "By Transportation Charges- RCM Journal"
    //      "To Tds on Contract 94C Journal"
    //      "To Transportation Charges- RCM Debit Note"
    //      "To Bank of India CC - 0177 Payment"
    particulars: text("particulars").notNull(),

    voucherType: ledgerVoucherTypeEnum("voucher_type").notNull(),

    // System-generated voucher number for traceability
    voucherNumber: varchar("voucher_number", { length: 100 }),

    entryType: ledgerEntryTypeEnum("entry_type").notNull(),

    // One of debit_amount or credit_amount will be non-zero
    debitAmount: numeric("debit_amount", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    creditAmount: numeric("credit_amount", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),

    // Running balance at this point in the ledger
    // Recalculated atomically when a transaction is inserted/updated
    runningBalance: numeric("running_balance", {
      precision: 15,
      scale: 2,
    }).notNull(),

    // Source traceability — what entity created this ledger row
    sourceEntityType: varchar("source_entity_type", { length: 50 }),
    // e.g. "bill", "payment", "tds_entry", "debit_note", "opening_balance"

    sourceEntityId: uuid("source_entity_id"),
    // UUID of the source record for cross-referencing

    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by"),
  },
  (table) => [
    // FIRM ISOLATION — COMPOSITE FOREIGN KEY (DATABASE-LEVEL)
    // Every ledger row's party must belong to the same firm as the ledger entry.
    foreignKey({
      name: "ledger_transactions_party_firm_isolation_fk",
      columns: [table.partyId, table.firmId],
      foreignColumns: [parties.id, parties.firmId],
    }),

    index("ledger_firm_party_date_idx").on(
      table.firmId,
      table.partyId,
      table.transactionDate
    ),
    index("ledger_firm_id_idx").on(table.firmId),
    index("ledger_party_id_idx").on(table.partyId),
    index("ledger_voucher_type_idx").on(table.voucherType),
    index("ledger_source_entity_idx").on(
      table.sourceEntityType,
      table.sourceEntityId
    ),
  ]
);

// ------------------------------------------------------------
// OPENING BALANCES
// Supports party opening balance entry per firm per FY.
// CONFIRMED: Opening balance does NOT require recreating
//   historical bills individually.
// ------------------------------------------------------------
export const openingBalances = pgTable(
  "opening_balances",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    firmId: uuid("firm_id")
      .notNull()
      .references(() => firms.id, { onDelete: "restrict" }),

    partyId: uuid("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "restrict" }),

    // Financial year — e.g. "2024-25", "2025-26", "2026-27"
    financialYear: varchar("financial_year", { length: 10 }).notNull(),

    // Opening balance amount (always positive)
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),

    // Whether party owes us (DEBIT) or we owe them (CREDIT)
    balanceType: ledgerEntryTypeEnum("balance_type").notNull().default("DEBIT"),

    effectiveDate: date("effective_date").notNull(),

    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by"),
  },
  (table) => [
    // FIRM ISOLATION — COMPOSITE FOREIGN KEY (DATABASE-LEVEL)
    // An opening balance's party must belong to the same firm.
    foreignKey({
      name: "opening_balances_party_firm_isolation_fk",
      columns: [table.partyId, table.firmId],
      foreignColumns: [parties.id, parties.firmId],
    }),

    // One opening balance per party per firm per financial year
    unique("opening_balances_firm_party_fy_unique").on(
      table.firmId,
      table.partyId,
      table.financialYear
    ),
    index("opening_balances_firm_id_idx").on(table.firmId),
    index("opening_balances_party_id_idx").on(table.partyId),
  ]
);

export type LedgerTransaction = typeof ledgerTransactions.$inferSelect;
export type NewLedgerTransaction = typeof ledgerTransactions.$inferInsert;
export type OpeningBalance = typeof openingBalances.$inferSelect;
export type NewOpeningBalance = typeof openingBalances.$inferInsert;
