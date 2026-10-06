import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function ensureDbSchemaSynced() {
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

    // 3. Add all new columns to bills table individually
    await db.execute(sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS driver_voucher_total numeric(15, 2) NOT NULL DEFAULT '0'`);
    await db.execute(sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS applied_tds_section varchar(20)`);
    await db.execute(sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS applied_tds_percentage numeric(5, 2)`);
    await db.execute(sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS applied_freight_basis varchar(20)`);
    await db.execute(sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS bill_edit_locked boolean NOT NULL DEFAULT false`);
    await db.execute(sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS bank_account_id uuid REFERENCES bank_accounts(id) ON DELETE SET NULL`);
    await db.execute(sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS bank_details_snapshot jsonb`);
    await db.execute(sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS payment_terms varchar(100)`);
    await db.execute(sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS due_date date`);
    await db.execute(sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS terms_and_conditions text`);
    await db.execute(sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS display_options_snapshot jsonb`);

    // 4. Add columns to customer_rules table individually
    await db.execute(sql`ALTER TABLE customer_rules ADD COLUMN IF NOT EXISTS material_rate_per_ton numeric(12, 4)`);

    // 5. AUTO-HEAL ORPHANED FIRM REFERENCES: Ensure any firm_id present in parties or trips exists in firms table
    await db.execute(sql`
      INSERT INTO firms (id, name, code, is_active)
      SELECT DISTINCT p.firm_id, 'Deepraj Transport', 'DEEPRAJ', true
      FROM parties p
      LEFT JOIN firms f ON f.id = p.firm_id
      WHERE f.id IS NULL AND p.firm_id IS NOT NULL
      ON CONFLICT (id) DO NOTHING
    `);

    await db.execute(sql`
      INSERT INTO firms (id, name, code, is_active)
      SELECT DISTINCT t.firm_id, 'Deepraj Transport', 'DEEPRAJ', true
      FROM trips t
      LEFT JOIN firms f ON f.id = t.firm_id
      WHERE f.id IS NULL AND t.firm_id IS NOT NULL
      ON CONFLICT (id) DO NOTHING
    `);

    // 6. Explicitly ensure default Deepraj Transport firm ID exists in firms table
    await db.execute(sql`
      INSERT INTO firms (id, name, code, is_active)
      VALUES ('d4df3ccc-0146-401e-894d-c1af8140880e', 'Deepraj Transport', 'DEEPRAJ', true)
      ON CONFLICT (id) DO NOTHING
    `);

    console.log("[AutoMigrate] PostgreSQL schema successfully synchronized.");
  } catch (err: any) {
    console.error("[AutoMigrate] Schema sync warning:", err?.message || err);
  }
}
