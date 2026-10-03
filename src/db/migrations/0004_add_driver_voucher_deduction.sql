ALTER TYPE "public"."ledger_voucher_type" ADD VALUE 'DRIVER_VOUCHER_DEDUCTION';--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "driver_voucher_total" numeric(15, 2) DEFAULT '0' NOT NULL;