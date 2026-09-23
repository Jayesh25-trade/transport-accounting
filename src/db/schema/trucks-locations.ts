// ============================================================
// SCHEMA: trucks, locations
// Master data for vehicles and loading/unloading points.
// Both scoped per firm.
// ============================================================

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { firms } from "./firms";

// ------------------------------------------------------------
// TRUCKS — Vehicle Registry
// ------------------------------------------------------------
export const trucks = pgTable(
  "trucks",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    firmId: uuid("firm_id")
      .notNull()
      .references(() => firms.id, { onDelete: "restrict" }),

    // Registration number e.g. "MH06BW 0111"
    truckNumber: varchar("truck_number", { length: 30 }).notNull(),

    ownerName: varchar("owner_name", { length: 255 }),
    ownerPhone: varchar("owner_phone", { length: 20 }),

    // Truck capacity in Tons (informational)
    capacityTons: varchar("capacity_tons", { length: 20 }),

    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // FIRM ISOLATION: Enables daily_entries to enforce truck belongs to same firm.
    unique("trucks_id_firm_id_unique").on(table.id, table.firmId),
    index("trucks_firm_id_idx").on(table.firmId),
    index("trucks_number_idx").on(table.truckNumber),
  ]
);

// ------------------------------------------------------------
// LOCATIONS — Loading / Unloading Points
// ------------------------------------------------------------
export const locations = pgTable(
  "locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    firmId: uuid("firm_id")
      .notNull()
      .references(() => firms.id, { onDelete: "restrict" }),

    // e.g. "WADKHAL", "MANCHAR", "TALOJA", "MAHAD"
    name: varchar("name", { length: 255 }).notNull(),

    state: varchar("state", { length: 100 }),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // FIRM ISOLATION: Enables daily_entries to enforce location belongs to same firm.
    unique("locations_id_firm_id_unique").on(table.id, table.firmId),
    index("locations_firm_id_idx").on(table.firmId),
    index("locations_name_idx").on(table.name),
  ]
);

export type Truck = typeof trucks.$inferSelect;
export type NewTruck = typeof trucks.$inferInsert;
export type Location = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;
