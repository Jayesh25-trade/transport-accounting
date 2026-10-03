import { db } from "../src/db";
import { bills, debitNotes, tdsEntries, ledgerTransactions, openingBalances } from "../src/db/schema";
import { eq, and, asc, sql, desc } from "drizzle-orm";
import { calculateLedgerRunningBalance } from "../src/domain/ledger";

const BILL_2_ID = "d39ea3e8-8afa-4946-b7a3-25c1ec1d9e56";
const OLD_PARTY_ID = "7ecdd0c3-3560-4b41-9b9e-da294ef52f97"; // QA Final Test Customer
const NEW_PARTY_ID = "fad486ed-d622-4e2d-b122-78027fc81577"; // Validation Test

async function recalculatePartyLedger(tx: any, firmId: string, partyId: string) {
  // Fetch opening balance
  const obRes = await tx
    .select({ amount: openingBalances.amount, balanceType: openingBalances.balanceType })
    .from(openingBalances)
    .where(and(eq(openingBalances.firmId, firmId), eq(openingBalances.partyId, partyId)))
    .orderBy(desc(openingBalances.effectiveDate))
    .limit(1);

  let runningBalance = 0;
  if (obRes.length > 0) {
    const amt = Number(obRes[0].amount || 0);
    runningBalance = obRes[0].balanceType === "CREDIT" ? amt : -amt;
  }

  const voucherRankAsc = sql`
    CASE ${ledgerTransactions.voucherType}
      WHEN 'OPENING_BALANCE' THEN 1
      WHEN 'TRANSPORTATION_CHARGES_RCM' THEN 2
      WHEN 'TDS_JOURNAL' THEN 3
      WHEN 'DEBIT_NOTE_RCM' THEN 4
      WHEN 'DRIVER_VOUCHER_DEDUCTION' THEN 5
      WHEN 'PAYMENT_BANK' THEN 6
      WHEN 'PAYMENT_CASH' THEN 6
      WHEN 'ADVANCE_RECEIPT' THEN 6
      ELSE 7
    END
  `;

  const txns = await tx
    .select()
    .from(ledgerTransactions)
    .where(and(eq(ledgerTransactions.firmId, firmId), eq(ledgerTransactions.partyId, partyId)))
    .orderBy(
      ledgerTransactions.transactionDate,
      ledgerTransactions.createdAt,
      asc(voucherRankAsc),
      ledgerTransactions.id
    );

  for (const t of txns) {
    const debit = Number(t.debitAmount || 0);
    const credit = Number(t.creditAmount || 0);

    runningBalance = calculateLedgerRunningBalance(
      runningBalance,
      t.entryType,
      debit,
      credit
    );

    await tx
      .update(ledgerTransactions)
      .set({ runningBalance: runningBalance.toString() })
      .where(eq(ledgerTransactions.id, t.id));
  }
}

async function run() {
  console.log("=== PHASE 4 & 5 — EXECUTING BILL #2 PARTY CORRECTION & LEDGER RECONCILIATION ===");

  await db.transaction(async (tx) => {
    // 1. Fetch Bill #2 to confirm state
    const billRows = await tx.select().from(bills).where(eq(bills.id, BILL_2_ID));
    if (billRows.length === 0) {
      throw new Error("Bill #2 not found in DB!");
    }
    const bill2 = billRows[0];
    console.log(`Found Bill #2: Number ${bill2.billNumber}, Firm ID ${bill2.firmId}, Current Party ID ${bill2.partyId}`);

    // 2. Update bills.party_id
    await tx
      .update(bills)
      .set({ partyId: NEW_PARTY_ID, updatedAt: new Date() })
      .where(eq(bills.id, BILL_2_ID));
    console.log(`✓ Updated bills.party_id to Validation Test (${NEW_PARTY_ID})`);

    // 3. Update debit_notes.party_id
    const dnUpdate = await tx
      .update(debitNotes)
      .set({ partyId: NEW_PARTY_ID, updatedAt: new Date() })
      .where(eq(debitNotes.billId, BILL_2_ID))
      .returning();
    console.log(`✓ Updated ${dnUpdate.length} debit_notes record(s) to Validation Test`);

    // 4. Update tds_entries.party_id
    const tdsUpdate = await tx
      .update(tdsEntries)
      .set({ partyId: NEW_PARTY_ID })
      .where(eq(tdsEntries.billId, BILL_2_ID))
      .returning();
    console.log(`✓ Updated ${tdsUpdate.length} tds_entries record(s) to Validation Test`);

    // 5. Find and update ledger_transactions belonging to Bill #2 or DN-2
    const dnIds = dnUpdate.map((dn) => dn.id);
    const ledgerTxnsToUpdate = await tx
      .select()
      .from(ledgerTransactions)
      .where(
        and(
          eq(ledgerTransactions.firmId, bill2.firmId),
          sql`(${ledgerTransactions.sourceEntityId} = ${BILL_2_ID} OR ${ledgerTransactions.sourceEntityId} IN ${dnIds.length > 0 ? dnIds : ["00000000-0000-0000-0000-000000000000"]})`
        )
      );

    console.log(`Found ${ledgerTxnsToUpdate.length} ledger transactions linked to Bill #2`);

    for (const lt of ledgerTxnsToUpdate) {
      await tx
        .update(ledgerTransactions)
        .set({ partyId: NEW_PARTY_ID, updatedAt: new Date() })
        .where(eq(ledgerTransactions.id, lt.id));
      console.log(`  ✓ Updated ledger txn ${lt.voucherType} (${lt.particulars}) party_id -> Validation Test`);
    }

    // 6. Recalculate Ledger Running Balances for both OLD party and NEW party
    console.log("\nRecalculating ledger running balances...");
    await recalculatePartyLedger(tx, bill2.firmId, OLD_PARTY_ID);
    console.log(`✓ Recalculated ledger running balances for QA Final Test Customer (${OLD_PARTY_ID})`);

    await recalculatePartyLedger(tx, bill2.firmId, NEW_PARTY_ID);
    console.log(`✓ Recalculated ledger running balances for Validation Test (${NEW_PARTY_ID})`);
  });

  console.log("\n=== CORRECTION & RECONCILIATION COMPLETE ===");
  process.exit(0);
}

run().catch((err) => {
  console.error("Correction failed:", err);
  process.exit(1);
});
