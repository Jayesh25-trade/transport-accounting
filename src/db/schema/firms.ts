// ============================================================
// SCHEMA: firms
// Represents the two transport business entities:
// - Deepraj Transport
// - Shivsai Transport
// All transactional data is scoped to a firm_id.
// Firm data must NEVER mix across different firms.
// ============================================================

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const firms = pgTable("firms", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Display name — e.g. "Deepraj Transport"
  name: varchar("name", { length: 255 }).notNull(),

  // Short code — e.g. "DEEPRAJ", "SHIVSAI" (used in references)
  code: varchar("code", { length: 50 }).notNull().unique(),

  // Permanent Account Number for TDS/taxation
  pan: varchar("pan", { length: 20 }),

  // Contact
  phone: varchar("phone", { length: 20 }),
  address: text("address"),

  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Firm = typeof firms.$inferSelect;
export type NewFirm = typeof firms.$inferInsert;
