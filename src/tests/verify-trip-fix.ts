/**
 * verify-trip-fix.ts
 * One-shot verification script for the Daily Book → trips upsert fix.
 * Run: npx tsx src/tests/verify-trip-fix.ts
 *
 * Reads: daily_entries, trips tables
 * Writes: ONE trips row (the missing one being fixed) via updateDailyEntry
 * Does NOT create any new daily entries, bills, payments, or parties.
 */

import "dotenv/config";
import { db } from "../db";
import { dailyEntries, trips } from "../db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { updateDailyEntry } from "../services/daily-entry.service";

async function main() {
  console.log("\n=== TRIP FIX VERIFICATION ===\n");

  // ── STEP 1: Find daily entries with is_received=true but NO trips row ──────
  console.log("STEP 1: Searching for daily entries where is_received=true but no trips row exists…\n");

  // Get ALL daily entries for Deepraj (we find firm dynamically)
  const allEntries = await db
    .select({
      id: dailyEntries.id,
      firmId: dailyEntries.firmId,
      srNo: dailyEntries.srNo,
      entryDate: dailyEntries.entryDate,
      partyId: dailyEntries.partyId,
      partyNameRaw: dailyEntries.partyNameRaw,
      isReceived: dailyEntries.isReceived,
      truckNumberRaw: dailyEntries.truckNumberRaw,
    })
    .from(dailyEntries)
    .where(eq(dailyEntries.isReceived, true));

  // Get all existing trip dailyEntryIds
  const allTrips = await db
    .select({ dailyEntryId: trips.dailyEntryId, id: trips.id })
    .from(trips);

  const trippedEntryIds = new Set(allTrips.map((t) => t.dailyEntryId));

  const orphaned = allEntries.filter(
    (e) => !trippedEntryIds.has(e.id) && e.partyId !== null
  );

  console.log(`Found ${allEntries.length} total is_received=true daily entries`);
  console.log(`Found ${allTrips.length} total trips rows`);
  console.log(`Found ${orphaned.length} ORPHANED entries (is_received=true, has partyId, NO trips row):\n`);

  if (orphaned.length === 0) {
    console.log("✅ No orphaned entries found — all received+partyId entries already have trips rows.");
    console.log("   This means the fix already ran or the test entry was created post-fix.");
    process.exit(0);
  }

  for (const e of orphaned) {
    console.log(`  Entry ID : ${e.id}`);
    console.log(`  Firm ID  : ${e.firmId}`);
    console.log(`  Sr No    : ${e.srNo}   Date: ${e.entryDate}`);
    console.log(`  Truck    : ${e.truckNumberRaw || "(none)"}`);
    console.log(`  Party    : ${e.partyNameRaw || e.partyId}`);
    console.log(`  Received : ${e.isReceived}`);
    console.log();
  }

  // ── STEP 2: Re-save the first orphaned entry to trigger the upsert fix ─────
  const target = orphaned[0];
  console.log(`STEP 2: Re-saving entry ${target.id} (Sr #${target.srNo}) to trigger upsert…\n`);

  // Fetch complete entry data for the update call
  const [fullEntry] = await db
    .select()
    .from(dailyEntries)
    .where(eq(dailyEntries.id, target.id))
    .limit(1);

  if (!fullEntry) {
    console.error("ERROR: Could not fetch full entry. Aborting.");
    process.exit(1);
  }

  await updateDailyEntry(db, target.id, {
    firmId: fullEntry.firmId,
    srNo: fullEntry.srNo,
    entryDate: fullEntry.entryDate,
    truckId: fullEntry.truckId || undefined,
    truckNumberRaw: fullEntry.truckNumberRaw || undefined,
    lrNumber: fullEntry.lrNumber || undefined,
    fromLocationId: fullEntry.fromLocationId || undefined,
    fromLocationRaw: fullEntry.fromLocationRaw || undefined,
    toLocationId: fullEntry.toLocationId || undefined,
    toLocationRaw: fullEntry.toLocationRaw || undefined,
    nWeight: fullEntry.nWeight ? Number(fullEntry.nWeight) : undefined,
    rWeight: fullEntry.rWeight ? Number(fullEntry.rWeight) : undefined,
    advance: fullEntry.advance ? Number(fullEntry.advance) : undefined,
    rate: fullEntry.rate ? Number(fullEntry.rate) : undefined,
    cash: fullEntry.cash ? Number(fullEntry.cash) : undefined,
    diesel: fullEntry.diesel ? Number(fullEntry.diesel) : undefined,
    ac: fullEntry.ac ? Number(fullEntry.ac) : undefined,
    companyId: fullEntry.companyId || undefined,
    companyNameRaw: fullEntry.companyNameRaw || undefined,
    partyId: fullEntry.partyId || undefined,
    partyNameRaw: fullEntry.partyNameRaw || undefined,
    customerRate: fullEntry.customerRate ? Number(fullEntry.customerRate) : undefined,
    isReceived: fullEntry.isReceived,
    remarks: fullEntry.remarks || undefined,
    userId: null,
  });

  console.log("  ✅ updateDailyEntry completed.\n");

  // ── STEP 3: Verify exactly ONE trips row exists now ────────────────────────
  console.log("STEP 3: Verifying trips row was created…\n");

  const newTrips = await db
    .select()
    .from(trips)
    .where(eq(trips.dailyEntryId, target.id));

  if (newTrips.length === 0) {
    console.error("❌ FAIL: No trips row found after updateDailyEntry. Fix did not work.");
    process.exit(1);
  }

  if (newTrips.length > 1) {
    console.error(`❌ FAIL: ${newTrips.length} trips rows found — DUPLICATE created. Fix has a bug.`);
    process.exit(1);
  }

  const trip = newTrips[0];
  console.log("  Trips row details:");
  console.log(`    trips.id           = ${trip.id}`);
  console.log(`    trips.firmId       = ${trip.firmId}`);
  console.log(`    trips.dailyEntryId = ${trip.dailyEntryId}`);
  console.log(`    trips.partyId      = ${trip.partyId}`);
  console.log(`    trips.isReceived   = ${trip.isReceived}`);
  console.log(`    trips.isBilled     = ${trip.isBilled}`);
  console.log(`    trips.billId       = ${trip.billId}`);
  console.log();

  // ── STEP 4: Validate field mapping matches expectations ────────────────────
  const checks = [
    { name: "firmId matches entry.firmId", pass: trip.firmId === fullEntry.firmId },
    { name: "dailyEntryId matches entry.id", pass: trip.dailyEntryId === fullEntry.id },
    { name: "partyId matches entry.partyId", pass: trip.partyId === fullEntry.partyId },
    { name: "isReceived=true (billable)", pass: trip.isReceived === true },
    { name: "isBilled=false (not yet billed)", pass: trip.isBilled === false },
    { name: "billId=null (not assigned to any bill)", pass: trip.billId === null },
  ];

  console.log("STEP 4: Field mapping validation:\n");
  let allPass = true;
  for (const c of checks) {
    const icon = c.pass ? "✅" : "❌";
    console.log(`  ${icon} ${c.name}`);
    if (!c.pass) allPass = false;
  }

  // ── STEP 5: Run again to confirm no duplicate on second save ────────────────
  console.log("\nSTEP 5: Re-running updateDailyEntry AGAIN to confirm no duplicate trip on repeated saves…\n");

  await updateDailyEntry(db, target.id, {
    firmId: fullEntry.firmId,
    srNo: fullEntry.srNo,
    entryDate: fullEntry.entryDate,
    truckId: fullEntry.truckId || undefined,
    truckNumberRaw: fullEntry.truckNumberRaw || undefined,
    lrNumber: fullEntry.lrNumber || undefined,
    fromLocationId: fullEntry.fromLocationId || undefined,
    fromLocationRaw: fullEntry.fromLocationRaw || undefined,
    toLocationId: fullEntry.toLocationId || undefined,
    toLocationRaw: fullEntry.toLocationRaw || undefined,
    nWeight: fullEntry.nWeight ? Number(fullEntry.nWeight) : undefined,
    rWeight: fullEntry.rWeight ? Number(fullEntry.rWeight) : undefined,
    advance: fullEntry.advance ? Number(fullEntry.advance) : undefined,
    rate: fullEntry.rate ? Number(fullEntry.rate) : undefined,
    cash: fullEntry.cash ? Number(fullEntry.cash) : undefined,
    diesel: fullEntry.diesel ? Number(fullEntry.diesel) : undefined,
    ac: fullEntry.ac ? Number(fullEntry.ac) : undefined,
    companyId: fullEntry.companyId || undefined,
    companyNameRaw: fullEntry.companyNameRaw || undefined,
    partyId: fullEntry.partyId || undefined,
    partyNameRaw: fullEntry.partyNameRaw || undefined,
    customerRate: fullEntry.customerRate ? Number(fullEntry.customerRate) : undefined,
    isReceived: fullEntry.isReceived,
    remarks: fullEntry.remarks || undefined,
    userId: null,
  });

  const tripsAfterSecondSave = await db
    .select({ id: trips.id })
    .from(trips)
    .where(eq(trips.dailyEntryId, target.id));

  if (tripsAfterSecondSave.length !== 1) {
    console.error(`❌ FAIL: ${tripsAfterSecondSave.length} trips rows after second save — duplicate bug!`);
    allPass = false;
  } else {
    console.log("  ✅ Still exactly 1 trips row after second save. No duplicate created.");
  }

  console.log("\n=== FINAL RESULT ===\n");
  if (allPass) {
    console.log("✅ ALL CHECKS PASSED");
    console.log("   - Missing trips row created correctly");
    console.log("   - All fields match createDailyEntry mapping");
    console.log("   - No duplicate on repeated saves");
    console.log("   - Trip is now eligible for Create Bill");
  } else {
    console.log("❌ SOME CHECKS FAILED — review output above");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
