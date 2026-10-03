import { db } from "../src/db";
import { bills, billItems, trips, dailyEntries, parties, customerRules, debitNotes, ledgerTransactions } from "../src/db/schema";
import { eq, inArray } from "drizzle-orm";

async function run() {
  console.log("=== PHASE 1 — AUDITING ALL EXISTING BILLS IN DATABASE ===");

  const allBills = await db.select().from(bills);
  console.log(`Total Bills Found: ${allBills.length}`);

  const auditReport: any[] = [];

  for (const b of allBills) {
    const billParty = await db.select().from(parties).where(eq(parties.id, b.partyId));
    const billPartyName = billParty[0]?.name || "UNKNOWN";

    const items = await db.select().from(billItems).where(eq(billItems.billId, b.id));
    const tripIds = items.map((i) => i.tripId).filter(Boolean) as string[];

    let tripParties: string[] = [];
    let deIds: string[] = [];
    let deParties: string[] = [];

    if (tripIds.length > 0) {
      const tripRows = await db.select().from(trips).where(inArray(trips.id, tripIds));
      tripParties = tripRows.map((t) => t.partyId).filter(Boolean) as string[];

      const deRowIds = tripRows.map((t) => t.dailyEntryId).filter(Boolean) as string[];
      deIds = deRowIds;

      if (deRowIds.length > 0) {
        const deRows = await db.select().from(dailyEntries).where(inArray(dailyEntries.id, deRowIds));
        deParties = deRows.map((d) => d.partyId).filter(Boolean) as string[];
      }
    }

    const uniqueTripPartyIds = [...new Set(tripParties)];
    const uniqueTripPartyNames: string[] = [];
    for (const pid of uniqueTripPartyIds) {
      const p = await db.select().from(parties).where(eq(parties.id, pid));
      uniqueTripPartyNames.push(p[0]?.name || pid);
    }

    const dNotes = await db.select().from(debitNotes).where(eq(debitNotes.billId, b.id));
    const dnPartyIds = dNotes.map((dn) => dn.partyId);
    const uniqueDnPartyNames: string[] = [];
    for (const pid of dnPartyIds) {
      const p = await db.select().from(parties).where(eq(parties.id, pid));
      uniqueDnPartyNames.push(p[0]?.name || pid);
    }

    const ledger = await db.select().from(ledgerTransactions).where(eq(ledgerTransactions.sourceEntityId, b.id));
    const ledgerPartyIds = ledger.map((l) => l.partyId);
    const uniqueLedgerPartyNames: string[] = [];
    for (const pid of [...new Set(ledgerPartyIds)]) {
      const p = await db.select().from(parties).where(eq(parties.id, pid));
      uniqueLedgerPartyNames.push(p[0]?.name || pid);
    }

    const rulePartyIds: string[] = [];
    for (const pid of uniqueTripPartyIds) {
      const r = await db.select().from(customerRules).where(eq(customerRules.partyId, pid));
      if (r.length > 0) {
        rulePartyIds.push(pid);
      }
    }

    const isHeaderMismatch = uniqueTripPartyIds.length > 0 && !uniqueTripPartyIds.every((pid) => pid === b.partyId);
    const isLedgerMismatch = ledgerPartyIds.length > 0 && !ledgerPartyIds.every((pid) => pid === b.partyId);
    const isDnMismatch = dnPartyIds.length > 0 && !dnPartyIds.every((pid) => pid === b.partyId);

    const isMismatch = isHeaderMismatch || isLedgerMismatch || isDnMismatch;

    auditReport.push({
      billNumber: b.billNumber,
      billId: b.id,
      dailyEntryIds: deIds.join(", "),
      expectedParty: uniqueTripPartyNames.join(", "),
      actualBillParty: billPartyName,
      actualLedgerParty: uniqueLedgerPartyNames.join(", "),
      actualDebitNoteParty: uniqueDnPartyNames.join(", "),
      customerRuleParty: uniqueTripPartyNames.join(", "),
      netBillAmount: b.netBillAmount,
      isMismatch,
      mismatchDetails: isMismatch
        ? `Header Mismatch: ${isHeaderMismatch}, Ledger Mismatch: ${isLedgerMismatch}, DN Mismatch: ${isDnMismatch}`
        : "NONE — Synchronized",
    });
  }

  console.log("\n=================== AUDIT RESULTS TABLE ===================");
  console.table(auditReport);

  console.log("\nMISMATCHED BILLS SUMMARY:");
  const mismatched = auditReport.filter((r) => r.isMismatch);
  console.log(`Found ${mismatched.length} mismatched bill(s):`);
  console.log(JSON.stringify(mismatched, null, 2));

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
