// ============================================================
// SCHEMA: trips
// A trip is a normalized, billable transport movement.
// Trips are derived from daily_entries.
//
// CONFIRMED BUSINESS RULE (Phase 2 Final Locked Spec):
//   ONLY trips with is_received = TRUE are eligible for billing.
//   A trip can only be assigned to ONE bill (isBilled + billId).
//   If isBilled = true, the trip is locked from being billed again.
// ============================================================

import {
  pgTable,
  uuid,
  boolean,
  timestamp,
  index,
  foreignKey,
} from "drizzle-orm/pg-core";
import { firms } from "./firms";
import { dailyEntries } from "./daily-entries";
import { parties } from "./parties-companies";

export const trips = pgTable(
  "trips",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    firmId: uuid("firm_id")
      .notNull()
      .references(() => firms.id, { onDelete: "restrict" }),

    // Each trip originates from exactly one daily entry
    dailyEntryId: uuid("daily_entry_id")
      .notNull()
      .unique() // One daily entry → one trip only
      .references(() => dailyEntries.id, { onDelete: "restrict" }),

    // Party this trip will be billed to
    partyId: uuid("party_id").references(() => parties.id, {
      onDelete: "set null",
    }),

    // Billing eligibility tracking
    // CONFIRMED: Only received trips (is_received=true) can be billed.
    // This is mirrored from daily_entry.is_received for query efficiency.
    isReceived: boolean("is_received").notNull().default(false),

    // Once billed, this trip is locked from re-billing
    isBilled: boolean("is_billed").notNull().default(false),

    // billId is set when the trip is included in a bill
    // Nullable: null = not yet billed
    billId: uuid("bill_id"), // FK added after bills table is defined (circular dep avoided via migration)

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // FIRM ISOLATION — COMPOSITE FOREIGN KEY (DATABASE-LEVEL)
    // party_id is nullable (a trip may not have a party assigned yet).
    // When party_id IS NULL, PostgreSQL skips the FK check — correct behaviour.
    // When party_id IS SET, PostgreSQL enforces that party belongs to same firm.
    foreignKey({
      name: "trips_party_firm_isolation_fk",
      columns: [table.partyId, table.firmId],
      foreignColumns: [parties.id, parties.firmId],
    }),

    index("trips_firm_id_idx").on(table.firmId),
    index("trips_party_id_idx").on(table.partyId),
    index("trips_is_received_is_billed_idx").on(
      table.isReceived,
      table.isBilled
    ),
    // Critical index: finding unbilled, received trips per firm per party
    index("trips_billable_idx").on(
      table.firmId,
      table.partyId,
      table.isReceived,
      table.isBilled
    ),
  ]
);

export type Trip = typeof trips.$inferSelect;
export type NewTrip = typeof trips.$inferInsert;
