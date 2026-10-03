import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { firms } from "./firms";
import { bankAccounts } from "./bank-accounts";

export const firmBillSettings = pgTable("firm_bill_settings", {
  id: uuid("id").primaryKey().defaultRandom(),

  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "restrict" })
    .unique(),

  defaultBankAccountId: uuid("default_bank_account_id").references(
    () => bankAccounts.id,
    { onDelete: "set null" }
  ),

  defaultPaymentTerms: varchar("default_payment_terms", { length: 100 }).default(
    "30 Days"
  ),
  defaultTermsAndConditions: text("default_terms_and_conditions"),
  defaultRemarks: text("default_remarks"),

  showBankDetails: boolean("show_bank_details").notNull().default(true),
  showPaymentTerms: boolean("show_payment_terms").notNull().default(true),
  showDueDate: boolean("show_due_date").notNull().default(true),
  showAmountInWords: boolean("show_amount_in_words").notNull().default(true),
  showRemarks: boolean("show_remarks").notNull().default(true),
  showTermsAndConditions: boolean("show_terms_and_conditions")
    .notNull()
    .default(true),
  showAuthorisedSignature: boolean("show_authorised_signature")
    .notNull()
    .default(true),
  showVehicleType: boolean("show_vehicle_type").notNull().default(false),
  showGstDetails: boolean("show_gst_details").notNull().default(false),
  showReverseCharge: boolean("show_reverse_charge").notNull().default(false),
  showPlaceOfSupply: boolean("show_place_of_supply").notNull().default(false),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type FirmBillSetting = typeof firmBillSettings.$inferSelect;
export type NewFirmBillSetting = typeof firmBillSettings.$inferInsert;
