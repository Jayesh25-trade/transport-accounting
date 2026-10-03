/**
 * verify-trip-fix-rollback.ts
 * Functional verification of Daily Book entry -> trips upsert fix
 * using a Postgres transaction with guaranteed ROLLBACK.
 *
 * Guaranteed zero mutation on persistent/production database.
 */

import "dotenv/config";
import assert from "node:assert/strict";
import { db } from "../db";
import { dailyEntries, trips, parties, firms } from "../db/schema";
import { createDailyEntry, updateDailyEntry } from "../services/daily-entry.service";
import { eq, and } from "drizzle-orm";

class TestRollbackSignal extends Error {
  constructor() {
    super("INTENTIONAL_TEST_ROLLBACK");
  }
}

async function runRollbackTest() {
  console.log("=================================================");
  console.log("STARTING ISOLATED TRANSACTION ROLLBACK TEST");
  console.log("=================================================\n");

  let createdEntryId: string | null = null;
  let testFirmId: string | null = null;
  let testPartyId: string | null = null;

  try {
    await db.transaction(async (tx) => {
      // 1. Get an existing firm or create a temporary firm record within the transaction
      const existingFirms = await tx.select({ id: firms.id, name: firms.name }).from(firms).limit(1);
      if (existingFirms.length === 0) {
        throw new Error("No existing firm found in database for testing.");
      }
      testFirmId = existingFirms[0].id;
      console.log(`[Step 1] Selected active test firm: ${existingFirms[0].name} (${testFirmId})`);

      // 2. Find or pick a valid party for this firm
      const existingParties = await tx
        .select({ id: parties.id, name: parties.name })
        .from(parties)
        .where(eq(parties.firmId, testFirmId))
        .limit(1);

      if (existingParties.length === 0) {
        throw new Error(`No party found for firm ${testFirmId}`);
      }
      testPartyId = existingParties[0].id;
      console.log(`[Step 2] Selected test party: ${existingParties[0].name} (${testPartyId})`);

      // 3. Create a Daily Book entry WITHOUT a partyId
      console.log("\n[Step 3] Creating Daily Entry WITHOUT partyId...");
      const createRes = await createDailyEntry(tx as any, {
        firmId: testFirmId,
        srNo: 999999, // Unique srNo for test entry
        entryDate: "2026-09-28",
        truckNumberRaw: "TEST-ROLLBACK-01",
        nWeight: 10,
        rWeight: 10,
        rate: 1000,
        isReceived: false,
        // partyId intentionally omitted
      });

      createdEntryId = createRes.entry.id;
      console.log(`  -> Daily entry created with ID: ${createdEntryId}`);
      assert.equal(createRes.trip, null, "createDailyEntry must return null trip when partyId is omitted");

      // 4. Verify NO trips row exists in database for this entry
      const tripsBefore = await tx
        .select()
        .from(trips)
        .where(eq(trips.dailyEntryId, createdEntryId));
      
      console.log(`[Step 4] Querying trips table for dailyEntryId ${createdEntryId}...`);
      console.log(`  -> Found ${tripsBefore.length} trips rows.`);
      assert.equal(tripsBefore.length, 0, "No trips row must exist when daily entry has no partyId");

      // 5. Update Daily Book entry WITH partyId and set isReceived = true
      console.log("\n[Step 5] Updating Daily Entry with partyId & setting isReceived = true...");
      const updateRes = await updateDailyEntry(tx as any, createdEntryId, {
        firmId: testFirmId,
        srNo: 999999,
        entryDate: "2026-09-28",
        truckNumberRaw: "TEST-ROLLBACK-01",
        nWeight: 10,
        rWeight: 10,
        rate: 1000,
        partyId: testPartyId,
        isReceived: true,
      });

      console.log(`  -> Daily entry updated successfully.`);

      // 6. Verify trips row is now CREATED via the fallback upsert path
      console.log("[Step 6] Querying trips table post-update...");
      const tripsAfter = await tx
        .select()
        .from(trips)
        .where(eq(trips.dailyEntryId, createdEntryId));

      console.log(`  -> Found ${tripsAfter.length} trips row(s).`);
      assert.equal(tripsAfter.length, 1, "Exactly 1 trips row must exist post-update");

      const trip = tripsAfter[0];
      console.log("  -> Trip details:", {
        id: trip.id,
        firmId: trip.firmId,
        dailyEntryId: trip.dailyEntryId,
        partyId: trip.partyId,
        isReceived: trip.isReceived,
        isBilled: trip.isBilled,
      });

      assert.equal(trip.firmId, testFirmId, "Trip firmId must match");
      assert.equal(trip.partyId, testPartyId, "Trip partyId must match updated partyId");
      assert.equal(trip.isReceived, true, "Trip isReceived must be true");
      assert.equal(trip.isBilled, false, "Trip isBilled must be false");

      // 7. Verify Create Bill / eligibility logic returns this trip
      console.log("\n[Step 7] Verifying Create Bill eligibility query...");
      const eligibleTrips = await tx
        .select({
          tripId: trips.id,
          partyId: trips.partyId,
          isReceived: trips.isReceived,
          isBilled: trips.isBilled,
        })
        .from(trips)
        .where(
          and(
            eq(trips.firmId, testFirmId),
            eq(trips.isReceived, true),
            eq(trips.isBilled, false),
            eq(trips.partyId, testPartyId)
          )
        );

      const foundEligible = eligibleTrips.some((t) => t.tripId === trip.id);
      console.log(`  -> Total eligible unbilled trips for party: ${eligibleTrips.length}`);
      console.log(`  -> Newly created trip present in Create Bill eligibility query? ${foundEligible}`);
      assert.ok(foundEligible, "The newly created trip MUST be returned by Create Bill eligibility query");

      // 8. Intentional ROLLBACK to ensure zero persistent database changes
      console.log("\n[Step 8] Triggering intentional transaction ROLLBACK...");
      throw new TestRollbackSignal();
    });
  } catch (err) {
    if (err instanceof TestRollbackSignal) {
      console.log("  -> Transaction rolled back successfully! (TestRollbackSignal caught)");
    } else {
      console.error("  -> Unexpected error during transaction test:", err);
      throw err;
    }
  }

  // 9. Post-rollback verification: Confirm that NO entry or trip exists in persistent DB
  console.log("\n[Step 9] POST-ROLLBACK PERSISTENT DB VERIFICATION...");
  if (createdEntryId) {
    const checkEntry = await db
      .select()
      .from(dailyEntries)
      .where(eq(dailyEntries.id, createdEntryId));
    console.log(`  -> daily_entries rows remaining for ID ${createdEntryId}: ${checkEntry.length}`);
    assert.equal(checkEntry.length, 0, "Daily entry MUST NOT exist in persistent DB post-rollback");

    const checkTrip = await db
      .select()
      .from(trips)
      .where(eq(trips.dailyEntryId, createdEntryId));
    console.log(`  -> trips rows remaining for dailyEntryId ${createdEntryId}: ${checkTrip.length}`);
    assert.equal(checkTrip.length, 0, "Trip MUST NOT exist in persistent DB post-rollback");
  }

  console.log("\n=================================================");
  console.log("✅ ALL VERIFICATION STEPS PASSED SUCCESSFULLY");
  console.log("   (100% Isolated, ZERO Database Mutation)");
  console.log("=================================================");
}

runRollbackTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
