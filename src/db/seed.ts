// ============================================================
// DATABASE SEED — DEVELOPMENT ONLY
// Creates minimal records required to verify DB relationships.
//
// WARNING: This creates DEVELOPMENT SEED DATA only.
// - It inserts only the 2 known transport firms.
// - No fake financial data, no fake bills, no fake client records.
// - All seed records are clearly marked for identification.
//
// Run: npm run db:seed
// ============================================================

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "./index";
import { firms, firmBillSequences } from "./schema";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("[SEED] Starting development seed...");

  // ---- Insert the two confirmed transport firms ----
  const firmData = [
    {
      name: "Deepraj Transport",
      code: "DEEPRAJ",
      pan: "AQEPM2120M", // From real Fairway Dream Bill No. 23
    },
    {
      name: "Shiv Sai Transport",
      code: "SHIVSAI",
      pan: "BSFPM1051D", // From source documents
    },
  ];

  for (const firm of firmData) {
    // Check if firm already exists to prevent duplicates on re-seed
    const existing = await db
      .select()
      .from(firms)
      .where(eq(firms.code, firm.code))
      .limit(1);

    if (existing.length > 0) {
      console.log(`[SEED] Firm already exists: ${firm.name} — skipping.`);
      continue;
    }

    // Insert firm
    const [insertedFirm] = await db
      .insert(firms)
      .values(firm)
      .returning({ id: firms.id, name: firms.name });

    console.log(`[SEED] Created firm: ${insertedFirm.name} (${insertedFirm.id})`);

    // Initialize bill sequence for this firm (starting at 0)
    await db.insert(firmBillSequences).values({
      firmId: insertedFirm.id,
      lastBillNumber: 0,
    });

    console.log(`[SEED] Initialized bill sequence for: ${insertedFirm.name}`);
  }

  console.log("[SEED] Development seed complete.");
  console.log("[SEED] Two firms created: Deepraj Transport, Shiv Sai Transport");
  console.log("[SEED] No financial data, bills, or client records were inserted.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("[SEED] Seed failed:", err);
  process.exit(1);
});
