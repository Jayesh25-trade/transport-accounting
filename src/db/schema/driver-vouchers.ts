// ============================================================
// SCHEMA: driver_vouchers
// CONFIRMED BUSINESS RULE (Phase 2 Final Locked Spec):
//
// Daily Book fields (advance, cash, diesel, ac) automatically
// flow into a Driver Voucher record.
//
// Each daily_entry produces at most ONE driver_voucher.
// (unique constraint on daily_entry_id prevents duplicates)
//
// When a daily_entry is edited, the related driver_voucher
// must be updated — this will be enforced in the business
// service layer via atomic transactions.
//
// IMPORTANT — ACCOUNTING TREATMENT NOT CONFIRMED:
//   The exact Debit/Credit accounting treatment for Driver Vouchers
//   has NOT been finalized by the client.
//   This schema stores operational data ONLY.
//   accountingStatus = "PENDING_CONFIRMATION" tracks this.
//   DO NOT add ledger postings for driver vouchers until confirmed.
// ============================================================

import {
  pgTable,
  uuid,
  numeric,
  text,
  varchar,
  date,
  timestamp,
  pgEnum,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { firms } from "./firms";
import { dailyEntries } from "./daily-entries";

// Tracks whether accounting treatment has been confirmed for this voucher
export const driverVoucherAccountingStatusEnum = pgEnum(
  "driver_voucher_accounting_status",
  [
    "PENDING_CONFIRMATION", // Default — accounting Dr/Cr not yet defined
    "CONFIRMED",            // Accounting rules confirmed and applied
  ]
);

export const driverVouchers = pgTable(
  "driver_vouchers",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    firmId: uuid("firm_id")
      .notNull()
      .references(() => firms.id, { onDelete: "restrict" }),

    // Source: one daily entry → one driver voucher
    dailyEntryId: uuid("daily_entry_id")
      .notNull()
      .references(() => dailyEntries.id, { onDelete: "cascade" }),

    voucherDate: date("voucher_date").notNull(),

    // Amounts copied from daily_entry (and kept in sync on edit)
    advance: numeric("advance", { precision: 12, scale: 2 }),
    cash: numeric("cash", { precision: 12, scale: 2 }),
    diesel: numeric("diesel", { precision: 12, scale: 2 }),
    ac: numeric("ac", { precision: 12, scale: 2 }),

    // Truck/driver info (denormalized from daily entry for voucher readability)
    truckNumberRaw: varchar("truck_number_raw", { length: 30 }),
    fromLocationRaw: varchar("from_location_raw", { length: 255 }),
    toLocationRaw: varchar("to_location_raw", { length: 255 }),

    remarks: text("remarks"),

    // IMPORTANT: Accounting Dr/Cr treatment is NOT YET CONFIRMED.
    // This field tracks that pending state.
    accountingStatus: driverVoucherAccountingStatusEnum("accounting_status")
      .notNull()
      .default("PENDING_CONFIRMATION"),

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
    // One daily entry → one driver voucher only (prevent duplicates)
    unique("driver_vouchers_daily_entry_unique").on(table.dailyEntryId),
    index("driver_vouchers_firm_id_idx").on(table.firmId),
    index("driver_vouchers_date_idx").on(table.voucherDate),
  ]
);

export type DriverVoucher = typeof driverVouchers.$inferSelect;
export type NewDriverVoucher = typeof driverVouchers.$inferInsert;
