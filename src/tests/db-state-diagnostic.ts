/**
 * db-state-diagnostic.ts
 * READ-ONLY diagnostic. No writes.
 * Run: npx tsx src/tests/db-state-diagnostic.ts
 */

import "dotenv/config";
import { db } from "../db";
import { dailyEntries, trips, bills } from "../db/schema";
import { eq, sql } from "drizzle-orm";

async function main() {
  console.log("\n=== DB STATE DIAGNOSTIC (READ ONLY) ===\n");

  // Raw count of all daily entries
  const [allCount] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(dailyEntries);

  const [receivedCount] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(dailyEntries)
    .where(sql`is_received = true`);

  const [notReceivedCount] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(dailyEntries)
    .where(sql`is_received = false`);

  console.log(`daily_entries total       : ${allCount.total}`);
  console.log(`daily_entries is_received=true  : ${receivedCount.total}`);
  console.log(`daily_entries is_received=false : ${notReceivedCount.total}`);
  console.log();

  // All daily entries with their received status and trips linkage
  const entries = await db
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
    .orderBy(dailyEntries.entryDate, dailyEntries.srNo);

  // All trips
  const allTrips = await db
    .select({
      id: trips.id,
      dailyEntryId: trips.dailyEntryId,
      partyId: trips.partyId,
      isReceived: trips.isReceived,
      isBilled: trips.isBilled,
      billId: trips.billId,
    })
    .from(trips);

  const tripByEntry = new Map(allTrips.map((t) => [t.dailyEntryId, t]));

  console.log("All daily entries with trip linkage:\n");
  console.log(
    "Sr | Date       | isReceived | partyId?    | tripExists | trip.isRecv | trip.isBilled | truck"
  );
  console.log(
    "---|------------|------------|-------------|------------|-------------|---------------|------"
  );

  for (const e of entries) {
    const trip = tripByEntry.get(e.id);
    const sr = String(e.srNo).padStart(2, " ");
    const date = e.entryDate;
    const recv = String(e.isReceived).padEnd(10, " ");
    const hasParty = e.partyId ? "YES" : "NO ".padEnd(11, " ");
    const tripExists = trip ? "YES" : "NO ";
    const tRecv = trip ? String(trip.isReceived).padEnd(11, " ") : "N/A".padEnd(11, " ");
    const tBilled = trip ? String(trip.isBilled).padEnd(13, " ") : "N/A".padEnd(13, " ");
    const truck = e.truckNumberRaw || "(raw)";
    console.log(`${sr} | ${date} | ${recv} | ${hasParty} | ${tripExists}       | ${tRecv} | ${tBilled} | ${truck}`);
  }

  // Find entries with trips rows where trips.isReceived=true and isBilled=false (these should show in Create Bill)
  const eligibleTrips = allTrips.filter((t) => t.isReceived && !t.isBilled);
  console.log(`\nTrips eligible for Create Bill (isReceived=true, isBilled=false): ${eligibleTrips.length}`);
  for (const t of eligibleTrips) {
    console.log(`  Trip ${t.id} | entry: ${t.dailyEntryId} | party: ${t.partyId}`);
  }

  // Find daily entries: is_received=true but NO trip row
  const orphaned = entries.filter((e) => e.isReceived === true && !tripByEntry.has(e.id));
  console.log(`\nOrphaned entries (is_received=true in daily_entries, NO trips row): ${orphaned.length}`);
  for (const e of orphaned) {
    console.log(`  Entry Sr#${e.srNo} date:${e.entryDate} partyId:${e.partyId} truck:${e.truckNumberRaw}`);
  }

  // Also find entries where daily_entries.is_received=true but trip.isReceived=false
  const mismatch = entries.filter((e) => {
    if (!e.isReceived) return false;
    const t = tripByEntry.get(e.id);
    return t && !t.isReceived;
  });
  console.log(`\nMismatch entries (daily_entries.is_received=true but trips.is_received=false): ${mismatch.length}`);
  for (const e of mismatch) {
    const t = tripByEntry.get(e.id)!;
    console.log(`  Entry Sr#${e.srNo} date:${e.entryDate} | trips.id: ${t.id} | trips.isReceived: ${t.isReceived}`);
  }

  console.log("\n=== END DIAGNOSTIC ===\n");
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
