// ============================================================
// SCHEMA: user_firm_memberships
// Junction table linking users to authorized firms and assigned roles.
// Supports single-user multi-firm authorization.
// ============================================================

import {
  pgTable,
  uuid,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users, userRoleEnum } from "./users";
import { firms } from "./firms";

export const userFirmMemberships = pgTable(
  "user_firm_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    firmId: uuid("firm_id")
      .notNull()
      .references(() => firms.id, { onDelete: "cascade" }),

    role: userRoleEnum("role").notNull().default("ACCOUNTANT"),

    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("user_firm_unique_idx").on(table.userId, table.firmId),
  ]
);

export type UserFirmMembership = typeof userFirmMemberships.$inferSelect;
export type NewUserFirmMembership = typeof userFirmMemberships.$inferInsert;
