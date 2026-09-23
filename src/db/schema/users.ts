// ============================================================
// SCHEMA: users
// System users with role-based access per firm.
// Roles: ADMIN | ACCOUNTANT | MANAGER
// ============================================================

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { firms } from "./firms";

export const userRoleEnum = pgEnum("user_role", [
  "ADMIN",
  "ACCOUNTANT",
  "MANAGER",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),

  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "restrict" }),

  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),

  // Hashed password — never store plaintext
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),

  role: userRoleEnum("role").notNull().default("ACCOUNTANT"),

  isActive: boolean("is_active").notNull().default(true),

  // Password reset support (future auth phase)
  passwordResetToken: varchar("password_reset_token", { length: 255 }),
  passwordResetExpiresAt: timestamp("password_reset_expires_at", {
    withTimezone: true,
  }),

  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),

  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
