import { db } from "../src/db";
import { bills, billItems, dailyEntries, trips, parties, customerRules, debitNotes, ledgerTransactions } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function run() {
  console.log("=== DETAILED BILL #2 TRACE ===");

  const bill2List = await db.select().from(bills).where(eq(bills.billNumber, 2));
  const bill2 = bill2List[0];
  console.log("BILL #2 RECORD:", bill2);

  const billParty = await db.select().from(parties).where(eq(parties.id, bill2.partyId));
  console.log("BILL #2 PARTY:", billParty[0]);

  const de5List = await db.select().from(dailyEntries).where(eq(dailyEntries.srNo, 5));
  console.log("DAILY ENTRY SR #5 RECORD:", de5List[0]);

  const de5Party = await db.select().from(parties).where(eq(parties.id, de5List[0].partyId!));
  console.log("DAILY ENTRY SR #5 PARTY:", de5Party[0]);

  const trip5List = await db.select().from(trips).where(eq(trips.dailyEntryId, de5List[0].id));
  console.log("TRIP FOR DAILY ENTRY SR #5 RECORD:", trip5List[0]);

  if (trip5List[0]?.partyId) {
    const trip5Party = await db.select().from(parties).where(eq(parties.id, trip5List[0].partyId));
    console.log("TRIP FOR DAILY ENTRY SR #5 PARTY:", trip5Party[0]);
  }

  const items = await db.select().from(billItems).where(eq(billItems.billId, bill2.id));
  console.log("BILL #2 ITEMS:", items);

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
