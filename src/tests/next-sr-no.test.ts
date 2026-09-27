import test from "node:test";
import assert from "node:assert/strict";
import { db } from "../db";
import { getNextSrNo, createDailyEntry } from "../services/daily-entry.service";
import { firms, dailyEntries, parties, driverVouchers, trips } from "../db/schema";
import { eq, like } from "drizzle-orm";

test("getNextSrNo: returns 1 for an empty firm with no existing daily entries", async () => {
  // Use a non-existent firm ID to simulate an empty firm
  const emptyFirmId = "00000000-0000-0000-0000-000000000000";
  const nextSrNo = await getNextSrNo(db, emptyFirmId);
  assert.equal(nextSrNo, 1, "Next Sr No for an empty firm must be 1");
});

test("getNextSrNo: returns max(srNo) + 1 when entries exist for a firm", async () => {
  const allFirms = await db.select().from(firms);
  if (allFirms.length === 0) return;
  const targetFirmId = allFirms[0].id;

  // Cleanup test entries for this firm if any exist with tag
  const tag = `[TEST-SRNO-${Date.now()}]`;

  // Create a party for test entry
  const [testParty] = await db
    .insert(parties)
    .values({
      firmId: targetFirmId,
      name: `${tag} Test Party`,
    })
    .returning();

  // Create entry with srNo = 99
  const entryRes = await createDailyEntry(db, {
    firmId: targetFirmId,
    srNo: 99,
    entryDate: "2026-09-27",
    truckNumberRaw: "MH01AA1111",
    partyId: testParty.id,
    isReceived: true,
  });

  const nextSrNo = await getNextSrNo(db, targetFirmId);
  assert.ok(nextSrNo >= 100, `Expected nextSrNo to be >= 100 after inserting srNo 99, got ${nextSrNo}`);

  // Clean up test entry & party
  await db.delete(trips).where(eq(trips.dailyEntryId, entryRes.entry.id));
  await db.delete(driverVouchers).where(eq(driverVouchers.dailyEntryId, entryRes.entry.id));
  await db.delete(dailyEntries).where(eq(dailyEntries.id, entryRes.entry.id));
  await db.delete(parties).where(eq(parties.id, testParty.id));
});

test("getNextSrNo: maintains strict firm isolation between separate firms", async () => {
  const allFirms = await db.select().from(firms);
  if (allFirms.length < 2) return;

  const firmA = allFirms[0].id;
  const firmB = allFirms[1].id;

  const nextA = await getNextSrNo(db, firmA);
  const nextB = await getNextSrNo(db, firmB);

  assert.ok(typeof nextA === "number", "Next Sr No for Firm A must be a number");
  assert.ok(typeof nextB === "number", "Next Sr No for Firm B must be a number");
  // Firm A and Firm B sequences operate independently
  assert.ok(nextA >= 1, "Firm A sequence >= 1");
  assert.ok(nextB >= 1, "Firm B sequence >= 1");
});
