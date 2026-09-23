// ============================================================
// SCHEMA: parties
// CONFIRMED BUSINESS RULE (Phase 2 Final Locked Spec):
//   Party = actual billing & payment entity.
//   Party makes payments TO US and holds the customer account ledger.
//   Party is NOT the same as Company.
//
// SCHEMA: companies
// CONFIRMED BUSINESS RULE:
//   Company = dispatch/loading site record only.
//   Company is where material/mall was loaded from.
//   Company does NOT hold a financial ledger.
//
// DO NOT MERGE these two entities.
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
// PARTIES — Billing & Payment Entities
// ------------------------------------------------------------
export const parties = pgTable(
  "parties",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    firmId: uuid("firm_id")
      .notNull()
      .references(() => firms.id, { onDelete: "restrict" }),

    name: varchar("name", { length: 255 }).notNull(),

    // Alias/trade name if different from legal name
    tradeName: varchar("trade_name", { length: 255 }),

    contactPerson: varchar("contact_person", { length: 255 }),
    phone: varchar("phone", { length: 20 }),
    email: varchar("email", { length: 255 }),
    address: text("address"),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 100 }),
    pincode: varchar("pincode", { length: 10 }),

    // Tax identifiers
    pan: varchar("pan", { length: 20 }),
    gstin: varchar("gstin", { length: 20 }),

    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // FIRM ISOLATION: This composite unique constraint enables downstream tables
    // (bills, payments, ledger_transactions, etc.) to use composite FKs:
    //   FOREIGN KEY (party_id, firm_id) REFERENCES parties(id, firm_id)
    // This guarantees at the DATABASE LEVEL that a party in firm A cannot be
    // used in a transaction belonging to firm B.
    unique("parties_id_firm_id_unique").on(table.id, table.firmId),
    index("parties_firm_id_idx").on(table.firmId),
    index("parties_name_idx").on(table.name),
  ]
);

// ------------------------------------------------------------
// COMPANIES — Dispatch / Loading Site Records
// ------------------------------------------------------------
export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    firmId: uuid("firm_id")
      .notNull()
      .references(() => firms.id, { onDelete: "restrict" }),

    name: varchar("name", { length: 255 }).notNull(),

    // Location of dispatch/loading
    address: text("address"),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 100 }),

    contactPerson: varchar("contact_person", { length: 255 }),
    phone: varchar("phone", { length: 20 }),

    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // FIRM ISOLATION: Same composite unique strategy as parties.
    // Enables daily_entries to enforce that company_id belongs to same firm.
    unique("companies_id_firm_id_unique").on(table.id, table.firmId),
    index("companies_firm_id_idx").on(table.firmId),
    index("companies_name_idx").on(table.name),
  ]
);

export type Party = typeof parties.$inferSelect;
export type NewParty = typeof parties.$inferInsert;
export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
