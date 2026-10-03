import { db } from "../db";
import { ledgerTransactions, openingBalances } from "../db/schema";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import { calculateLedgerRunningBalance } from "../domain/ledger";

async function testLedgerOrderingFix() {
  console.log("=== TESTING LEDGER VOUCHER RANK ORDERING FIX ===");

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

  const txList = await db
    .select()
    .from(ledgerTransactions)
    .orderBy(
      asc(ledgerTransactions.transactionDate),
      asc(ledgerTransactions.createdAt),
      asc(voucherRankAsc),
      asc(ledgerTransactions.id)
    );

  console.log(`Found ${txList.length} total ledger transactions.`);

  let runningBal = 0;
  for (const row of txList) {
    const dr = Number(row.debitAmount || 0);
    const cr = Number(row.creditAmount || 0);

    const newBal = calculateLedgerRunningBalance(
      runningBal,
      row.entryType,
      dr,
      cr
    );

    runningBal = newBal;

    console.log(
      `Row [${row.voucherType}] ${row.particulars.slice(0, 45)}... | Entry: ${row.entryType} Dr: ₹${dr} Cr: ₹${cr} -> Calculated Bal: ₹${newBal}`
    );

    await db
      .update(ledgerTransactions)
      .set({ runningBalance: newBal.toString(), updatedAt: new Date() })
      .where(eq(ledgerTransactions.id, row.id));
  }

  console.log("\n=== VERIFYING LATEST RUNNING BALANCE QUERY ===");
  const voucherRankDesc = sql`
    CASE ${ledgerTransactions.voucherType}
      WHEN 'OPENING_BALANCE' THEN 1
      WHEN 'PAYMENT_BANK' THEN 2
      WHEN 'PAYMENT_CASH' THEN 2
      WHEN 'ADVANCE_RECEIPT' THEN 2
      WHEN 'DRIVER_VOUCHER_DEDUCTION' THEN 3
      WHEN 'DEBIT_NOTE_RCM' THEN 4
      WHEN 'TDS_JOURNAL' THEN 5
      WHEN 'TRANSPORTATION_CHARGES_RCM' THEN 6
      ELSE 7
    END
  `;

  const partyId = txList[0]?.partyId;
  const firmId = txList[0]?.firmId;

  if (partyId && firmId) {
    const latestTx = await db
      .select({
        voucherType: ledgerTransactions.voucherType,
        runningBalance: ledgerTransactions.runningBalance,
      })
      .from(ledgerTransactions)
      .where(and(eq(ledgerTransactions.firmId, firmId), eq(ledgerTransactions.partyId, partyId)))
      .orderBy(
        desc(ledgerTransactions.transactionDate),
        desc(ledgerTransactions.createdAt),
        asc(voucherRankDesc),
        desc(ledgerTransactions.id)
      )
      .limit(1);

    console.log("Latest transaction returned:", latestTx[0]);
  }

  process.exit(0);
}

testLedgerOrderingFix().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
