// ============================================================
// SCHEMA: bill_items
// Individual trip lines within a bill.
//
// Each bill_item links ONE trip to ONE bill.
// A trip can only appear in ONE bill (enforced via unique constraint
// on trip_id, and via trips.is_billed flag).
//
// Freight is calculated at item level based on the customer rule
// that was active at billing time. The applied rule values are
// snapshotted here so edits to customer_rules do not change
// historical bill calculations silently.
//
// Shortage valuation:
//   CONFIRMED: Shortage Debit = Applicable Shortage Qty × Material Rate
//   NOT Freight Rate.
// ============================================================

import {
  pgTable,
  uuid,
  numeric,
  varchar,
  date,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { bills } from "./bills";
import { trips } from "./trips";

export const billItems = pgTable(
  "bill_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    billId: uuid("bill_id")
      .notNull()
      .references(() => bills.id, { onDelete: "cascade" }),

    // CONSTRAINT: A trip can only appear in one bill
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "restrict" }),

    // ---- Trip details (denormalized snapshot at billing time) ----
    tripDate: date("trip_date"),
    truckNumberRaw: varchar("truck_number_raw", { length: 30 }),
    lrNumber: varchar("lr_number", { length: 50 }),
    fromLocationRaw: varchar("from_location_raw", { length: 255 }),
    toLocationRaw: varchar("to_location_raw", { length: 255 }),

    // ---- Weights ----
    nWeight: numeric("n_weight", { precision: 10, scale: 3 }),
    rWeight: numeric("r_weight", { precision: 10, scale: 3 }),

    // ---- Freight Calculation Snapshot ----
    // Rate applied for this trip at billing time
    appliedRate: numeric("applied_rate", { precision: 12, scale: 4 }),

    // Weight basis used (snapshot of customer rule)
    // e.g. "R_WEIGHT", "N_WEIGHT", "FIXED"
    appliedFreightBasis: varchar("applied_freight_basis", { length: 20 }),

    // Weight actually used for freight calculation
    billedWeight: numeric("billed_weight", { precision: 10, scale: 3 }),

    // Calculated freight = billed_weight × applied_rate (or fixed)
    freight: numeric("freight", { precision: 15, scale: 2 }),

    // ---- Shortage Snapshot ----
    // Raw shortage = n_weight - r_weight
    shortageQtyRaw: numeric("shortage_qty_raw", { precision: 10, scale: 3 }),

    // Allowed shortage (snapshot of customer rule at billing time)
    shortageAllowanceValue: numeric("shortage_allowance_value", {
      precision: 10,
      scale: 4,
    }),
    shortageAllowanceType: varchar("shortage_allowance_type", { length: 20 }),
    shortageRuleType: varchar("shortage_rule_type", { length: 20 }),

    // Applicable (debitable) shortage quantity after applying allowance
    shortageQtyApplicable: numeric("shortage_qty_applicable", {
      precision: 10,
      scale: 3,
    }),

    // Material rate used for shortage valuation (NOT freight rate)
    shortageMaterialRate: numeric("shortage_material_rate", {
      precision: 12,
      scale: 4,
    }),

    // Shortage debit amount = applicable_qty × material_rate
    shortageDebitAmount: numeric("shortage_debit_amount", {
      precision: 15,
      scale: 2,
    })
      .notNull()
      .default("0"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // CRITICAL: One trip can only appear in one bill
    unique("bill_items_trip_unique").on(table.tripId),
    index("bill_items_bill_id_idx").on(table.billId),
    index("bill_items_trip_id_idx").on(table.tripId),
  ]
);

export type BillItem = typeof billItems.$inferSelect;
export type NewBillItem = typeof billItems.$inferInsert;
