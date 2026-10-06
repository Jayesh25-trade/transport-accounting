import { db } from "@/db";
import { sql } from "drizzle-orm";

let isSynced = false;

export async function ensureDbSchemaSynced() {
  if (isSynced) return;
  try {
    // 1. bank_accounts table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS bank_accounts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE RESTRICT,
        account_display_name varchar(255) NOT NULL,
        bank_name varchar(255) NOT NULL,
        account_number varchar(100) NOT NULL,
        ifsc_code varchar(20) NOT NULL,
        branch varchar(255),
        account_type varchar(50) NOT NULL DEFAULT 'CURRENT',
        upi_id varchar(100),
        is_default_for_bills boolean NOT NULL DEFAULT false,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp with time zone NOT NULL DEFAULT now(),
        updated_at timestamp with time zone NOT NULL DEFAULT now()
      )
    `);

    // 2. firm_bill_settings table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS firm_bill_settings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        firm_id uuid NOT NULL UNIQUE REFERENCES firms(id) ON DELETE RESTRICT,
        default_bank_account_id uuid REFERENCES bank_accounts(id) ON DELETE SET NULL,
        default_payment_terms varchar(100) DEFAULT '30 Days',
        default_terms_and_conditions text,
        default_remarks text,
        show_bank_details boolean NOT NULL DEFAULT true,
        show_payment_terms boolean NOT NULL DEFAULT true,
        show_due_date boolean NOT NULL DEFAULT true,
        show_amount_in_words boolean NOT NULL DEFAULT true,
        show_remarks boolean NOT NULL DEFAULT true,
        show_terms_and_conditions boolean NOT NULL DEFAULT true,
        show_authorised_signature boolean NOT NULL DEFAULT true,
        show_vehicle_type boolean NOT NULL DEFAULT false,
        show_gst_details boolean NOT NULL DEFAULT false,
        show_reverse_charge boolean NOT NULL DEFAULT false,
        show_place_of_supply boolean NOT NULL DEFAULT false,
        updated_at timestamp with time zone NOT NULL DEFAULT now()
      )
    `);

    // 3. Add columns to bills table individually to prevent multi-statement prepared statement errors in PostgreSQL
    await db.execute(sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS bank_account_id uuid REFERENCES bank_accounts(id) ON DELETE SET NULL`);
    await db.execute(sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS bank_details_snapshot jsonb`);
    await db.execute(sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS payment_terms varchar(100)`);
    await db.execute(sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS due_date date`);
    await db.execute(sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS terms_and_conditions text`);
    await db.execute(sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS display_options_snapshot jsonb`);

    // 4. Add columns to customer_rules table individually
    await db.execute(sql`ALTER TABLE customer_rules ADD COLUMN IF NOT EXISTS material_rate_per_ton numeric(12, 4)`);

    isSynced = true;
    console.log("[AutoMigrate] PostgreSQL schema successfully synchronized.");
  } catch (err: any) {
    console.error("[AutoMigrate] Schema sync error:", err?.message || err);
    throw err;
  }
}
