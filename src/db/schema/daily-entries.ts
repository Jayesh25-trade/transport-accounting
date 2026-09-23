// ============================================================
// SCHEMA: daily_entries
// CONFIRMED BUSINESS RULE (Phase 2 Final Locked Spec):
//
// Daily Book / Roznamcha — the core operational log.
// ALL fields are manually entered by the user.
// The system does NOT auto-calculate any field unless an
// explicit confirmed business rule requires it.
//
// Received/Pending:
//   isReceived = true  → Trip is eligible for billing
//   isReceived = false → Trip is NOT eligible for billing
//
// Driver Voucher fields:
//   advance, cash, diesel, ac
//   These flow INTO driver_vouchers automatically.
//   Editing daily_entry → must update related driver_voucher.
//   The EXACT accounting treatment of driver vouchers is NOT
//   yet confirmed — driver_vouchers stores the data only.
// ============================================================

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  numeric,
  integer,
  date,
  timestamp,
  index,
  unique,
  foreignKey,
} from "drizzle-orm/pg-core";
import { firms } from "./firms";
import { parties } from "./parties-companies";
import { companies } from "./parties-companies";
import { trucks } from "./trucks-locations";
import { locations } from "./trucks-locations";

export const dailyEntries = pgTable(
  "daily_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    firmId: uuid("firm_id")
      .notNull()
      .references(() => firms.id, { onDelete: "restrict" }),

    // Daily serial number within the roznamcha
    srNo: integer("sr_no").notNull(),

    entryDate: date("entry_date").notNull(),

    // Truck reference (FK to trucks master; nullable to allow freetext fallback)
    truckId: uuid("truck_id").references(() => trucks.id, {
      onDelete: "set null",
    }),
    // Freetext fallback in case truck not in master
    truckNumberRaw: varchar("truck_number_raw", { length: 30 }),

    // LR (Lorry Receipt) number
    lrNumber: varchar("lr_number", { length: 50 }),

    // From / To locations
    fromLocationId: uuid("from_location_id").references(() => locations.id, {
      onDelete: "set null",
    }),
    fromLocationRaw: varchar("from_location_raw", { length: 255 }),

    toLocationId: uuid("to_location_id").references(() => locations.id, {
      onDelete: "set null",
    }),
    toLocationRaw: varchar("to_location_raw", { length: 255 }),

    // ---- Weight Fields ----
    // N-Weight = Net / Loading Weight (in Tons)
    nWeight: numeric("n_weight", { precision: 10, scale: 3 }),

    // R-Weight = Received / Unloading Weight (in Tons)
    rWeight: numeric("r_weight", { precision: 10, scale: 3 }),

    // ---- Manually Entered Financial Fields ----
    // These are operational fields only.
    // Their accounting treatment in the final ledger is
    // [DRIVER VOUCHER — ACCOUNTING TREATMENT NOT YET CONFIRMED]

    // Advance paid to driver
    advance: numeric("advance", { precision: 12, scale: 2 }),

    // Trip rate (freight rate per ton or fixed)
    rate: numeric("rate", { precision: 12, scale: 4 }),

    // Cash given
    cash: numeric("cash", { precision: 12, scale: 2 }),

    // Diesel amount
    diesel: numeric("diesel", { precision: 12, scale: 2 }),

    // A/c — Account adjustment amount (exact accounting treatment TBD)
    ac: numeric("ac", { precision: 12, scale: 2 }),

    // Company reference (loading site)
    companyId: uuid("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    companyNameRaw: varchar("company_name_raw", { length: 255 }),

    // Party reference (billing entity)
    partyId: uuid("party_id").references(() => parties.id, {
      onDelete: "set null",
    }),
    partyNameRaw: varchar("party_name_raw", { length: 255 }),

    // Final/Customer Rate — the rate applicable to the customer's bill
    customerRate: numeric("customer_rate", { precision: 12, scale: 4 }),

    // ---- Status ----
    // CONFIRMED: Only isReceived = true trips can be billed.
    isReceived: boolean("is_received").notNull().default(false),

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
    // Prevent duplicate sr_no within same firm on same date
    unique("daily_entries_firm_date_srno_unique").on(
      table.firmId,
      table.entryDate,
      table.srNo
    ),

    // ============================================================
    // FIRM ISOLATION — COMPOSITE FOREIGN KEYS (DATABASE-LEVEL)
    // ============================================================
    // Each composite FK ensures that the referenced master record
    // (party, company, truck, location) belongs to the SAME firm
    // as the daily entry.
    //
    // For nullable FK columns: PostgreSQL skips the FK check when
    // either column in the composite key is NULL. So a NULL truck_id
    // with firm_id=DEEPRAJ is valid (truck not in master, raw text used).
    // But truck_id=SHIVSAI_TRUCK with firm_id=DEEPRAJ is REJECTED.

    // Party isolation
    foreignKey({
      name: "daily_entries_party_firm_isolation_fk",
      columns: [table.partyId, table.firmId],
      foreignColumns: [parties.id, parties.firmId],
    }),

    // Company (loading site) isolation
    foreignKey({
      name: "daily_entries_company_firm_isolation_fk",
      columns: [table.companyId, table.firmId],
      foreignColumns: [companies.id, companies.firmId],
    }),

    // Truck isolation
    foreignKey({
      name: "daily_entries_truck_firm_isolation_fk",
      columns: [table.truckId, table.firmId],
      foreignColumns: [trucks.id, trucks.firmId],
    }),

    // From-Location isolation
    foreignKey({
      name: "daily_entries_from_location_firm_isolation_fk",
      columns: [table.fromLocationId, table.firmId],
      foreignColumns: [locations.id, locations.firmId],
    }),

    // To-Location isolation
    foreignKey({
      name: "daily_entries_to_location_firm_isolation_fk",
      columns: [table.toLocationId, table.firmId],
      foreignColumns: [locations.id, locations.firmId],
    }),

    index("daily_entries_firm_id_idx").on(table.firmId),
    index("daily_entries_date_idx").on(table.entryDate),
    index("daily_entries_party_id_idx").on(table.partyId),
    index("daily_entries_is_received_idx").on(table.isReceived),
  ]
);

export type DailyEntry = typeof dailyEntries.$inferSelect;
export type NewDailyEntry = typeof dailyEntries.$inferInsert;
