// ============================================================
// SCHEMA: payments, payment_allocations, advance_payments
//
// CONFIRMED BUSINESS RULE (Phase 2 Final Locked Spec):
//
// TWO payment types:
//   TYPE 1 — AGAINST_BILL: Payment allocated to specific bill(s).
//   TYPE 2 — ADVANCE: Unallocated payment recorded before a bill exists.
//
// Payment Modes (extensible, not hardcoded):
//   Cash, Bank A/c, Cheque, UTR, NEFT, RTGS, UPI, Other
//
// ALLOCATION POLICY — NOT CONFIRMED:
//   The client has NOT confirmed FIFO vs manual allocation.
//   The schema supports flexible allocation without forcing either.
//   DO NOT implement auto-FIFO logic.
//
// ============================================================
// CRITICAL — PAYMENT ALLOCATION TOTAL SAFETY:
//
// PROBLEM: Two simultaneous API calls can both read
//   bill.pending_amount = X and both insert allocations of X,
//   producing 2X total allocated against a bill worth X.
//
// MANDATORY SERVICE LAYER PROTOCOL (no exceptions):
//
//   BEGIN;
//   SELECT id, net_bill_amount, received_amount, pending_amount
//     FROM bills
//     WHERE id = $bill_id
//     FOR UPDATE;                        ← serializes ALL concurrent access to this bill
//   -- Check: will new allocation exceed remaining pending?
//   IF (SELECT COALESCE(SUM(allocated_amount),0)
//         FROM payment_allocations WHERE bill_id = $bill_id)
//       + $new_allocation_amount > bill.net_bill_amount THEN
//     ROLLBACK;
//     RAISE ERROR 'Allocation exceeds bill outstanding amount';
//   END IF;
//   INSERT INTO payment_allocations (...);
//   UPDATE bills SET
//     received_amount = received_amount + $new_allocation_amount,
//     pending_amount  = pending_amount  - $new_allocation_amount,
//     updated_at      = NOW()
//     WHERE id = $bill_id;
//   COMMIT;
//
// DO NOT use optimistic locking or application-level SUM checks alone.
// SELECT FOR UPDATE is the ONLY concurrency-safe approach here.
// ============================================================

import {
  pgTable,
  uuid,
  varchar,
  numeric,
  text,
  date,
  boolean,
  timestamp,
  index,
  pgEnum,
  foreignKey,
} from "drizzle-orm/pg-core";
import { firms } from "./firms";
import { parties } from "./parties-companies";
import { bills } from "./bills";

// Payment types
export const paymentTypeEnum = pgEnum("payment_type", [
  "AGAINST_BILL", // Allocated to specific bill(s)
  "ADVANCE",      // Unallocated — to be applied against future bills
]);

// Payment modes — stored as varchar for extensibility
// The enum below provides the known standard modes.
// New modes can be supported without schema migration by using "OTHER".
export const paymentModeEnum = pgEnum("payment_mode", [
  "CASH",
  "BANK_AC",    // Bank Account / Bank Transfer
  "CHEQUE",
  "UTR",
  "NEFT",
  "RTGS",
  "UPI",
  "OTHER",
]);

// ------------------------------------------------------------
// PAYMENTS — Master payment records
// ------------------------------------------------------------
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    firmId: uuid("firm_id")
      .notNull()
      .references(() => firms.id, { onDelete: "restrict" }),

    partyId: uuid("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "restrict" }),

    paymentDate: date("payment_date").notNull(),

    paymentType: paymentTypeEnum("payment_type").notNull(),

    paymentMode: paymentModeEnum("payment_mode").notNull(),

    // Reference: UTR number / Cheque number / Bank reference
    referenceNumber: varchar("reference_number", { length: 100 }),

    // Bank name if applicable
    bankName: varchar("bank_name", { length: 255 }),

    // Total payment amount received
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),

    // For ADVANCE type: how much remains unallocated
    // For AGAINST_BILL: this is tracked via payment_allocations
    unallocatedAmount: numeric("unallocated_amount", {
      precision: 15,
      scale: 2,
    })
      .notNull()
      .default("0"),

    // Whether this advance has been fully utilized
    isFullyAllocated: boolean("is_fully_allocated").notNull().default(false),

    remarks: text("remarks"),

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
    // FIRM ISOLATION — COMPOSITE FOREIGN KEY (DATABASE-LEVEL)
    // A payment's party must belong to the same firm as the payment.
    // DEEPRAJ firm_id + SHIVSAI party_id → rejected by PostgreSQL.
    foreignKey({
      name: "payments_party_firm_isolation_fk",
      columns: [table.partyId, table.firmId],
      foreignColumns: [parties.id, parties.firmId],
    }),

    index("payments_firm_id_idx").on(table.firmId),
    index("payments_party_id_idx").on(table.partyId),
    index("payments_date_idx").on(table.paymentDate),
    index("payments_type_idx").on(table.paymentType),
    // Index for finding unallocated advances
    index("payments_unallocated_idx").on(
      table.firmId,
      table.partyId,
      table.paymentType,
      table.isFullyAllocated
    ),
  ]
);

// ------------------------------------------------------------
// PAYMENT_ALLOCATIONS — Bill settlement records
// Links a payment to a specific bill with an amount.
// Multiple allocations can exist per payment (multi-bill).
// ------------------------------------------------------------
export const paymentAllocations = pgTable(
  "payment_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "restrict" }),

    billId: uuid("bill_id")
      .notNull()
      .references(() => bills.id, { onDelete: "restrict" }),

    // Amount from this payment allocated to this bill
    allocatedAmount: numeric("allocated_amount", {
      precision: 15,
      scale: 2,
    }).notNull(),

    allocationDate: date("allocation_date").notNull(),

    remarks: text("remarks"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("payment_allocations_payment_id_idx").on(table.paymentId),
    index("payment_allocations_bill_id_idx").on(table.billId),
  ]
);

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type PaymentAllocation = typeof paymentAllocations.$inferSelect;
export type NewPaymentAllocation = typeof paymentAllocations.$inferInsert;
