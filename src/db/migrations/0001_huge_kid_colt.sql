ALTER TABLE "bills" ADD COLUMN "bill_edit_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_id_firm_id_unique" UNIQUE("id","firm_id");--> statement-breakpoint
ALTER TABLE "parties" ADD CONSTRAINT "parties_id_firm_id_unique" UNIQUE("id","firm_id");--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_id_firm_id_unique" UNIQUE("id","firm_id");--> statement-breakpoint
ALTER TABLE "trucks" ADD CONSTRAINT "trucks_id_firm_id_unique" UNIQUE("id","firm_id");