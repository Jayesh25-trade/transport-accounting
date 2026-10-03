import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  index,
  foreignKey,
} from "drizzle-orm/pg-core";
import { firms } from "./firms";

export const bankAccounts = pgTable(
  "bank_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    firmId: uuid("firm_id")
      .notNull()
      .references(() => firms.id, { onDelete: "restrict" }),

    accountDisplayName: varchar("account_display_name", { length: 255 }).notNull(),
    bankName: varchar("bank_name", { length: 255 }).notNull(),
    accountNumber: varchar("account_number", { length: 100 }).notNull(),
    ifscCode: varchar("ifsc_code", { length: 20 }).notNull(),
    branch: varchar("branch", { length: 255 }),
    accountType: varchar("account_type", { length: 50 }).notNull().default("CURRENT"),
    upiId: varchar("upi_id", { length: 100 }),

    isDefaultForBills: boolean("is_default_for_bills").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("bank_accounts_firm_id_idx").on(table.firmId),
  ]
);

export type BankAccount = typeof bankAccounts.$inferSelect;
export type NewBankAccount = typeof bankAccounts.$inferInsert;
