// ============================================================
// SCHEMA: customer_rules
// CONFIRMED BUSINESS RULE (Phase 2 Final Locked Spec):
//
// Rules are configurable per Party — NOT globally hardcoded.
//
// Freight Basis:
//   R_WEIGHT  = Received Weight × Rate  (evidenced in Fairway Dream Bill)
//   N_WEIGHT  = Net/Loading Weight × Rate
//   FIXED     = Fixed amount per trip
//
// Shortage:
//   Quantity   = N-Weight − R-Weight
//   Allowance  = Percentage OR Fixed KG quantity
//   Rule Type  = EXCESS_ONLY | FULL_SHORTAGE
//   Valuation  = Applicable Shortage Qty × MATERIAL RATE (NOT Freight Rate)
//
// TDS:
//   Calculated on GROSS bill total.
//   Example: ₹1,00,000 × 1% = ₹1,000
//   Section and percentage are party-configurable.
//
// IMPORTANT:
//   These rules must NOT be applied retroactively to historical bills
//   when edited. Bill-level snapshots of rules applied are stored
//   inside bill_items to preserve auditability.
// ============================================================

import {
  pgTable,
  uuid,
  varchar,
  numeric,
  boolean,
  timestamp,
  pgEnum,
  unique,
  foreignKey,
} from "drizzle-orm/pg-core";
import { firms } from "./firms";
import { parties } from "./parties-companies";

// Freight basis options
export const freightBasisEnum = pgEnum("freight_basis", [
  "R_WEIGHT",  // Received Weight × Rate
  "N_WEIGHT",  // Net/Loading Weight × Rate
  "FIXED",     // Fixed amount per trip
]);

// Shortage allowance types
export const shortageAllowanceTypeEnum = pgEnum("shortage_allowance_type", [
  "PERCENTAGE",  // e.g. 1%, 1.5%
  "FIXED_KG",    // e.g. 300 KG, 400 KG
]);

// Shortage calculation rules
export const shortageRuleTypeEnum = pgEnum("shortage_rule_type", [
  "EXCESS_ONLY",     // Debit only shortage exceeding allowance
  "FULL_SHORTAGE",   // Debit full shortage once threshold is crossed
]);

export const customerRules = pgTable(
  "customer_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    firmId: uuid("firm_id")
      .notNull()
      .references(() => firms.id, { onDelete: "restrict" }),

    partyId: uuid("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "restrict" }),

    // ---- Freight Configuration ----
    freightBasis: freightBasisEnum("freight_basis").notNull().default("R_WEIGHT"),

    // ---- Shortage Configuration ----
    shortageApplicable: boolean("shortage_applicable").notNull().default(false),

    shortageAllowanceType: shortageAllowanceTypeEnum("shortage_allowance_type"),

    // Allowance value: e.g. 1.00 for 1%, or 300.00 for 300 KG
    shortageAllowanceValue: numeric("shortage_allowance_value", {
      precision: 10,
      scale: 4,
    }),

    shortageRuleType: shortageRuleTypeEnum("shortage_rule_type"),

    // Material Rate per Ton used for shortage debit valuation
    // CONFIRMED: Shortage Debit = Applicable Qty × Material Rate (NOT Freight Rate)
    materialRatePerTon: numeric("material_rate_per_ton", {
      precision: 12,
      scale: 4,
    }),

    // ---- TDS Configuration ----
    tdsApplicable: boolean("tds_applicable").notNull().default(false),

    // e.g. "94C"
    tdsSection: varchar("tds_section", { length: 20 }),

    // e.g. 1.00 for 1%
    tdsPercentage: numeric("tds_percentage", { precision: 5, scale: 2 }),

    // ---- Validity ----
    isActive: boolean("is_active").notNull().default(true),

    // Rules take effect from this date (supports future rule changes without
    // affecting historical bills)
    effectiveFrom: timestamp("effective_from", { withTimezone: true })
      .notNull()
      .defaultNow(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // FIRM ISOLATION — COMPOSITE FOREIGN KEY (DATABASE-LEVEL)
    // A customer rule's party must belong to the same firm.
    foreignKey({
      name: "customer_rules_party_firm_isolation_fk",
      columns: [table.partyId, table.firmId],
      foreignColumns: [parties.id, parties.firmId],
    }),

    // One active rule per party per firm
    unique("customer_rules_firm_party_unique").on(table.firmId, table.partyId),
  ]
);

export type CustomerRule = typeof customerRules.$inferSelect;
export type NewCustomerRule = typeof customerRules.$inferInsert;
