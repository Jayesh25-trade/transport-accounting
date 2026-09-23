CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'ACCOUNTANT', 'MANAGER');--> statement-breakpoint
CREATE TYPE "public"."freight_basis" AS ENUM('R_WEIGHT', 'N_WEIGHT', 'FIXED');--> statement-breakpoint
CREATE TYPE "public"."shortage_allowance_type" AS ENUM('PERCENTAGE', 'FIXED_KG');--> statement-breakpoint
CREATE TYPE "public"."shortage_rule_type" AS ENUM('EXCESS_ONLY', 'FULL_SHORTAGE');--> statement-breakpoint
CREATE TYPE "public"."driver_voucher_accounting_status" AS ENUM('PENDING_CONFIRMATION', 'CONFIRMED');--> statement-breakpoint
CREATE TYPE "public"."bill_status" AS ENUM('DRAFT', 'POSTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."payment_mode" AS ENUM('CASH', 'BANK_AC', 'CHEQUE', 'UTR', 'NEFT', 'RTGS', 'UPI', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('AGAINST_BILL', 'ADVANCE');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_type" AS ENUM('DEBIT', 'CREDIT');--> statement-breakpoint
CREATE TYPE "public"."ledger_voucher_type" AS ENUM('OPENING_BALANCE', 'TRANSPORTATION_CHARGES_RCM', 'DEBIT_NOTE_RCM', 'TDS_JOURNAL', 'PAYMENT_BANK', 'PAYMENT_CASH', 'ADVANCE_RECEIPT', 'ADJUSTMENT');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('CREATE', 'UPDATE', 'DELETE', 'CANCEL', 'POST', 'REVERSE', 'LOGIN', 'LOGOUT', 'IMPORT');--> statement-breakpoint
CREATE TYPE "public"."import_batch_status" AS ENUM('UPLOADED', 'VALIDATING', 'VALIDATED', 'ERRORS', 'COMMITTED', 'ROLLED_BACK');--> statement-breakpoint
CREATE TYPE "public"."import_data_type" AS ENUM('DAILY_ENTRIES', 'BILLS', 'PAYMENTS', 'LEDGER', 'OPENING_BALANCES', 'MIXED');--> statement-breakpoint
CREATE TABLE "firms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(50) NOT NULL,
	"pan" varchar(20),
	"phone" varchar(20),
	"address" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "firms_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" "user_role" DEFAULT 'ACCOUNTANT' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"password_reset_token" varchar(255),
	"password_reset_expires_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" text,
	"city" varchar(100),
	"state" varchar(100),
	"contact_person" varchar(255),
	"phone" varchar(20),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"trade_name" varchar(255),
	"contact_person" varchar(255),
	"phone" varchar(20),
	"email" varchar(255),
	"address" text,
	"city" varchar(100),
	"state" varchar(100),
	"pincode" varchar(10),
	"pan" varchar(20),
	"gstin" varchar(20),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"freight_basis" "freight_basis" DEFAULT 'R_WEIGHT' NOT NULL,
	"shortage_applicable" boolean DEFAULT false NOT NULL,
	"shortage_allowance_type" "shortage_allowance_type",
	"shortage_allowance_value" numeric(10, 4),
	"shortage_rule_type" "shortage_rule_type",
	"material_rate_per_ton" numeric(12, 4),
	"tds_applicable" boolean DEFAULT false NOT NULL,
	"tds_section" varchar(20),
	"tds_percentage" numeric(5, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_rules_firm_party_unique" UNIQUE("firm_id","party_id")
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"state" varchar(100),
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trucks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"truck_number" varchar(30) NOT NULL,
	"owner_name" varchar(255),
	"owner_phone" varchar(20),
	"capacity_tons" varchar(20),
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"sr_no" integer NOT NULL,
	"entry_date" date NOT NULL,
	"truck_id" uuid,
	"truck_number_raw" varchar(30),
	"lr_number" varchar(50),
	"from_location_id" uuid,
	"from_location_raw" varchar(255),
	"to_location_id" uuid,
	"to_location_raw" varchar(255),
	"n_weight" numeric(10, 3),
	"r_weight" numeric(10, 3),
	"advance" numeric(12, 2),
	"rate" numeric(12, 4),
	"cash" numeric(12, 2),
	"diesel" numeric(12, 2),
	"ac" numeric(12, 2),
	"company_id" uuid,
	"company_name_raw" varchar(255),
	"party_id" uuid,
	"party_name_raw" varchar(255),
	"customer_rate" numeric(12, 4),
	"is_received" boolean DEFAULT false NOT NULL,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "daily_entries_firm_date_srno_unique" UNIQUE("firm_id","entry_date","sr_no")
);
--> statement-breakpoint
CREATE TABLE "driver_vouchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"daily_entry_id" uuid NOT NULL,
	"voucher_date" date NOT NULL,
	"advance" numeric(12, 2),
	"cash" numeric(12, 2),
	"diesel" numeric(12, 2),
	"ac" numeric(12, 2),
	"truck_number_raw" varchar(30),
	"from_location_raw" varchar(255),
	"to_location_raw" varchar(255),
	"remarks" text,
	"accounting_status" "driver_voucher_accounting_status" DEFAULT 'PENDING_CONFIRMATION' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "driver_vouchers_daily_entry_unique" UNIQUE("daily_entry_id")
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"daily_entry_id" uuid NOT NULL,
	"party_id" uuid,
	"is_received" boolean DEFAULT false NOT NULL,
	"is_billed" boolean DEFAULT false NOT NULL,
	"bill_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trips_daily_entry_id_unique" UNIQUE("daily_entry_id")
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"bill_number" integer NOT NULL,
	"bill_date" date NOT NULL,
	"total_n_weight" numeric(12, 3),
	"total_r_weight" numeric(12, 3),
	"subtotal_freight" numeric(15, 2) NOT NULL,
	"tds_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"debit_note_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"net_bill_amount" numeric(15, 2) NOT NULL,
	"received_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"pending_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"applied_tds_section" varchar(20),
	"applied_tds_percentage" numeric(5, 2),
	"applied_freight_basis" varchar(20),
	"status" "bill_status" DEFAULT 'DRAFT' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "bills_firm_bill_number_unique" UNIQUE("firm_id","bill_number")
);
--> statement-breakpoint
CREATE TABLE "firm_bill_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"last_bill_number" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "firm_bill_sequences_firm_unique" UNIQUE("firm_id")
);
--> statement-breakpoint
CREATE TABLE "bill_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"trip_date" date,
	"truck_number_raw" varchar(30),
	"lr_number" varchar(50),
	"from_location_raw" varchar(255),
	"to_location_raw" varchar(255),
	"n_weight" numeric(10, 3),
	"r_weight" numeric(10, 3),
	"applied_rate" numeric(12, 4),
	"applied_freight_basis" varchar(20),
	"billed_weight" numeric(10, 3),
	"freight" numeric(15, 2),
	"shortage_qty_raw" numeric(10, 3),
	"shortage_allowance_value" numeric(10, 4),
	"shortage_allowance_type" varchar(20),
	"shortage_rule_type" varchar(20),
	"shortage_qty_applicable" numeric(10, 3),
	"shortage_material_rate" numeric(12, 4),
	"shortage_debit_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bill_items_trip_unique" UNIQUE("trip_id")
);
--> statement-breakpoint
CREATE TABLE "tds_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"bill_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"tds_section" varchar(20) NOT NULL,
	"tds_percentage" numeric(5, 2) NOT NULL,
	"tds_base_amount" numeric(15, 2) NOT NULL,
	"tds_amount" numeric(15, 2) NOT NULL,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tds_entries_bill_unique" UNIQUE("bill_id")
);
--> statement-breakpoint
CREATE TABLE "debit_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"bill_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"voucher_number" varchar(50) NOT NULL,
	"voucher_date" date NOT NULL,
	"total_shortage_qty_raw" numeric(12, 3),
	"total_shortage_allowance" numeric(12, 3),
	"total_shortage_qty_applicable" numeric(12, 3),
	"material_rate_applied" numeric(12, 4),
	"debit_amount" numeric(15, 2) NOT NULL,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"bill_id" uuid NOT NULL,
	"allocated_amount" numeric(15, 2) NOT NULL,
	"allocation_date" date NOT NULL,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"payment_date" date NOT NULL,
	"payment_type" "payment_type" NOT NULL,
	"payment_mode" "payment_mode" NOT NULL,
	"reference_number" varchar(100),
	"bank_name" varchar(255),
	"amount" numeric(15, 2) NOT NULL,
	"unallocated_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"is_fully_allocated" boolean DEFAULT false NOT NULL,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "ledger_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"transaction_date" date NOT NULL,
	"particulars" text NOT NULL,
	"voucher_type" "ledger_voucher_type" NOT NULL,
	"voucher_number" varchar(100),
	"entry_type" "ledger_entry_type" NOT NULL,
	"debit_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"credit_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"running_balance" numeric(15, 2) NOT NULL,
	"source_entity_type" varchar(50),
	"source_entity_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "opening_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"financial_year" varchar(10) NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"balance_type" "ledger_entry_type" DEFAULT 'DEBIT' NOT NULL,
	"effective_date" date NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "opening_balances_firm_party_fy_unique" UNIQUE("firm_id","party_id","financial_year")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid,
	"user_id" uuid,
	"user_email" varchar(255),
	"action" "audit_action" NOT NULL,
	"entity_name" varchar(100) NOT NULL,
	"entity_id" uuid,
	"old_values" jsonb,
	"new_values" jsonb,
	"reason" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"uploaded_by" uuid,
	"original_filename" varchar(255) NOT NULL,
	"financial_year" varchar(10) NOT NULL,
	"data_type" "import_data_type" NOT NULL,
	"status" "import_batch_status" DEFAULT 'UPLOADED' NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"valid_rows" integer DEFAULT 0 NOT NULL,
	"error_rows" integer DEFAULT 0 NOT NULL,
	"committed_rows" integer DEFAULT 0 NOT NULL,
	"committed_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"raw_record_id" uuid,
	"row_number" integer NOT NULL,
	"field_name" varchar(100),
	"raw_value" text,
	"error_message" text NOT NULL,
	"severity" varchar(20) DEFAULT 'ERROR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_import_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"raw_data" jsonb NOT NULL,
	"mapped_data" jsonb,
	"is_valid" boolean,
	"is_duplicate" boolean DEFAULT false NOT NULL,
	"is_committed" boolean DEFAULT false NOT NULL,
	"production_record_id" uuid,
	"production_table_name" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parties" ADD CONSTRAINT "parties_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_rules" ADD CONSTRAINT "customer_rules_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_rules" ADD CONSTRAINT "customer_rules_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trucks" ADD CONSTRAINT "trucks_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_entries_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_entries_truck_id_trucks_id_fk" FOREIGN KEY ("truck_id") REFERENCES "public"."trucks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_entries_from_location_id_locations_id_fk" FOREIGN KEY ("from_location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_entries_to_location_id_locations_id_fk" FOREIGN KEY ("to_location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_entries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_entries_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_vouchers" ADD CONSTRAINT "driver_vouchers_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_vouchers" ADD CONSTRAINT "driver_vouchers_daily_entry_id_daily_entries_id_fk" FOREIGN KEY ("daily_entry_id") REFERENCES "public"."daily_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_daily_entry_id_daily_entries_id_fk" FOREIGN KEY ("daily_entry_id") REFERENCES "public"."daily_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "firm_bill_sequences" ADD CONSTRAINT "firm_bill_sequences_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tds_entries" ADD CONSTRAINT "tds_entries_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tds_entries" ADD CONSTRAINT "tds_entries_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tds_entries" ADD CONSTRAINT "tds_entries_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_errors" ADD CONSTRAINT "import_errors_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_errors" ADD CONSTRAINT "import_errors_raw_record_id_raw_import_records_id_fk" FOREIGN KEY ("raw_record_id") REFERENCES "public"."raw_import_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_import_records" ADD CONSTRAINT "raw_import_records_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "companies_firm_id_idx" ON "companies" USING btree ("firm_id");--> statement-breakpoint
CREATE INDEX "companies_name_idx" ON "companies" USING btree ("name");--> statement-breakpoint
CREATE INDEX "parties_firm_id_idx" ON "parties" USING btree ("firm_id");--> statement-breakpoint
CREATE INDEX "parties_name_idx" ON "parties" USING btree ("name");--> statement-breakpoint
CREATE INDEX "locations_firm_id_idx" ON "locations" USING btree ("firm_id");--> statement-breakpoint
CREATE INDEX "locations_name_idx" ON "locations" USING btree ("name");--> statement-breakpoint
CREATE INDEX "trucks_firm_id_idx" ON "trucks" USING btree ("firm_id");--> statement-breakpoint
CREATE INDEX "trucks_number_idx" ON "trucks" USING btree ("truck_number");--> statement-breakpoint
CREATE INDEX "daily_entries_firm_id_idx" ON "daily_entries" USING btree ("firm_id");--> statement-breakpoint
CREATE INDEX "daily_entries_date_idx" ON "daily_entries" USING btree ("entry_date");--> statement-breakpoint
CREATE INDEX "daily_entries_party_id_idx" ON "daily_entries" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "daily_entries_is_received_idx" ON "daily_entries" USING btree ("is_received");--> statement-breakpoint
CREATE INDEX "driver_vouchers_firm_id_idx" ON "driver_vouchers" USING btree ("firm_id");--> statement-breakpoint
CREATE INDEX "driver_vouchers_date_idx" ON "driver_vouchers" USING btree ("voucher_date");--> statement-breakpoint
CREATE INDEX "trips_firm_id_idx" ON "trips" USING btree ("firm_id");--> statement-breakpoint
CREATE INDEX "trips_party_id_idx" ON "trips" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "trips_is_received_is_billed_idx" ON "trips" USING btree ("is_received","is_billed");--> statement-breakpoint
CREATE INDEX "trips_billable_idx" ON "trips" USING btree ("firm_id","party_id","is_received","is_billed");--> statement-breakpoint
CREATE INDEX "bills_firm_id_idx" ON "bills" USING btree ("firm_id");--> statement-breakpoint
CREATE INDEX "bills_party_id_idx" ON "bills" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "bills_date_idx" ON "bills" USING btree ("bill_date");--> statement-breakpoint
CREATE INDEX "bills_status_idx" ON "bills" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bills_pending_idx" ON "bills" USING btree ("firm_id","party_id","status");--> statement-breakpoint
CREATE INDEX "bill_items_bill_id_idx" ON "bill_items" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "bill_items_trip_id_idx" ON "bill_items" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "tds_entries_firm_id_idx" ON "tds_entries" USING btree ("firm_id");--> statement-breakpoint
CREATE INDEX "tds_entries_party_id_idx" ON "tds_entries" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "debit_notes_firm_id_idx" ON "debit_notes" USING btree ("firm_id");--> statement-breakpoint
CREATE INDEX "debit_notes_bill_id_idx" ON "debit_notes" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "debit_notes_party_id_idx" ON "debit_notes" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_payment_id_idx" ON "payment_allocations" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_bill_id_idx" ON "payment_allocations" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "payments_firm_id_idx" ON "payments" USING btree ("firm_id");--> statement-breakpoint
CREATE INDEX "payments_party_id_idx" ON "payments" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "payments_date_idx" ON "payments" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "payments_type_idx" ON "payments" USING btree ("payment_type");--> statement-breakpoint
CREATE INDEX "payments_unallocated_idx" ON "payments" USING btree ("firm_id","party_id","payment_type","is_fully_allocated");--> statement-breakpoint
CREATE INDEX "ledger_firm_party_date_idx" ON "ledger_transactions" USING btree ("firm_id","party_id","transaction_date");--> statement-breakpoint
CREATE INDEX "ledger_firm_id_idx" ON "ledger_transactions" USING btree ("firm_id");--> statement-breakpoint
CREATE INDEX "ledger_party_id_idx" ON "ledger_transactions" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "ledger_voucher_type_idx" ON "ledger_transactions" USING btree ("voucher_type");--> statement-breakpoint
CREATE INDEX "ledger_source_entity_idx" ON "ledger_transactions" USING btree ("source_entity_type","source_entity_id");--> statement-breakpoint
CREATE INDEX "opening_balances_firm_id_idx" ON "opening_balances" USING btree ("firm_id");--> statement-breakpoint
CREATE INDEX "opening_balances_party_id_idx" ON "opening_balances" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "audit_logs_firm_id_idx" ON "audit_logs" USING btree ("firm_id");--> statement-breakpoint
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_name","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "import_batches_firm_id_idx" ON "import_batches" USING btree ("firm_id");--> statement-breakpoint
CREATE INDEX "import_batches_status_idx" ON "import_batches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "import_batches_fy_idx" ON "import_batches" USING btree ("financial_year");--> statement-breakpoint
CREATE INDEX "import_errors_batch_id_idx" ON "import_errors" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "import_errors_row_number_idx" ON "import_errors" USING btree ("row_number");--> statement-breakpoint
CREATE INDEX "raw_import_records_batch_id_idx" ON "raw_import_records" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "raw_import_records_is_valid_idx" ON "raw_import_records" USING btree ("is_valid");--> statement-breakpoint
CREATE INDEX "raw_import_records_is_committed_idx" ON "raw_import_records" USING btree ("is_committed");