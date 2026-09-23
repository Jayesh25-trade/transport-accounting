// ============================================================
// SCHEMA: audit_logs
// Immutable audit trail for financial record changes.
//
// CONFIRMED REQUIREMENT (Phase 2 Final Locked Spec):
//   Financial records must be traceable.
//   Who created / edited / changed a record.
//   What the old and new values were.
//   When the change occurred.
//
// IMPORTANT: Audit log rows themselves should NEVER be deleted.
//   They are the system's financial integrity record.
//   Only ADMIN role should be able to view audit logs.
// ============================================================

import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { firms } from "./firms";

export const auditActionEnum = pgEnum("audit_action", [
  "CREATE",
  "UPDATE",
  "DELETE",
  "CANCEL",
  "POST",         // Posting a bill/voucher
  "REVERSE",      // Reversing a transaction
  "LOGIN",
  "LOGOUT",
  "IMPORT",       // Excel import batch
]);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    firmId: uuid("firm_id").references(() => firms.id, {
      onDelete: "set null",
    }),

    // User who performed the action
    userId: uuid("user_id"),
    userEmail: varchar("user_email", { length: 255 }),

    action: auditActionEnum("action").notNull(),

    // Entity type: "bill", "payment", "daily_entry", "customer_rule", etc.
    entityName: varchar("entity_name", { length: 100 }).notNull(),
    entityId: uuid("entity_id"),

    // Snapshot of data before change (null for CREATE)
    oldValues: jsonb("old_values"),

    // Snapshot of data after change (null for DELETE)
    newValues: jsonb("new_values"),

    // Human-readable reason for change (especially for financial corrections)
    reason: text("reason"),

    // Request metadata
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_logs_firm_id_idx").on(table.firmId),
    index("audit_logs_user_id_idx").on(table.userId),
    index("audit_logs_entity_idx").on(table.entityName, table.entityId),
    index("audit_logs_created_at_idx").on(table.createdAt),
    index("audit_logs_action_idx").on(table.action),
  ]
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
