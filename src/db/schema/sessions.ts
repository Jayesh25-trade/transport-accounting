// ============================================================
// SCHEMA: sessions
// Server-side user sessions for secure HTTP-only cookie authentication.
// ============================================================

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { firms } from "./firms";

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),

  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // SHA-256 token hash (plain token stored in __Host-session HTTP-only cookie)
  tokenHash: varchar("token_hash", { length: 255 }).notNull().unique(),

  // Active firm context selected by user for this session
  activeFirmId: uuid("active_firm_id").references(() => firms.id, {
    onDelete: "set null",
  }),

  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),

  // Expiry timestamp (idle & absolute expiration support)
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
