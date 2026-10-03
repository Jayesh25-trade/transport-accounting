import { db } from "../db";
import { bills, payments, paymentAllocations, ledgerTransactions, parties, firms } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { getOutstandingReport, getAgingReport } from "../services/report.service";
import { listLedgerTransactions } from "../services/ledger.service";

async function verifyFinalQAState() {
  console.log("=== READ-ONLY VERIFICATION OF FINAL QA STATE ===");

  const firmRows = await db.select().from(firms);
  const partyRows = await db.select().from(parties);

  if (firmRows.length === 0 || partyRows.length === 0) {
    console.error("No firm/party found!");
    process.exit(1);
  }

  const firmId = firmRows[0].id;
  const partyId = partyRows[0].id;

  // 1. Verify Bill #1 Net
  const billList = await db.select().from(bills).where(eq(bills.id, bills.id));
  console.log(`\n1. Bills Count: ${billList.length}`);
  if (billList.length > 0) {
    const b = billList[0];
    console.log(`   Bill #${b.billNumber}: Gross Freight = ₹${b.subtotalFreight}, Shortage = ₹${b.debitNoteAmount}, TDS = ₹${b.tdsAmount}, DV = ₹${b.driverVoucherTotal}, Net = ₹${b.netBillAmount}, Received = ₹${b.receivedAmount}, Pending = ₹${b.pendingAmount}`);
  }

  // 2. Verify Payments & Allocations
  const paymentList = await db.select().from(payments);
  console.log(`\n2. Payments Count: ${paymentList.length}`);
  for (const p of paymentList) {
    console.log(`   Payment [${p.paymentType}]: Amount = ₹${p.amount}, Unallocated = ₹${p.unallocatedAmount}, FullyAllocated = ${p.isFullyAllocated}`);
  }

  const allocList = await db.select().from(paymentAllocations);
  console.log(`\n3. Payment Allocations Count: ${allocList.length}`);
  for (const a of allocList) {
    console.log(`   Allocation: Amount = ₹${a.allocatedAmount}, BillId = ${a.billId}`);
  }

  // 4. Verify Ledger Transactions & Net Balance
  const ledgerList = await listLedgerTransactions(db, firmId, partyId);
  console.log(`\n4. Ledger Transactions Count: ${ledgerList.length}`);
  for (const l of ledgerList) {
    console.log(`   Row [${l.voucherType}] ${l.particulars.slice(0, 40)}... | Dr: ₹${l.debitAmount} Cr: ₹${l.creditAmount} | Running Bal: ₹${l.runningBalance}`);
  }

  const latestBal = ledgerList.length > 0 ? Number(ledgerList[ledgerList.length - 1].runningBalance) : 0;
  console.log(`\n   Latest Ledger Net Balance: ₹${latestBal}`);

  // 5. Verify Outstanding Report
  const outReport = await getOutstandingReport(db, firmId, { partyId });
  console.log(`\n5. Outstanding Report:`);
  console.log(`   Total Outstanding Bills: ₹${outReport.summary.totalOutstanding}`);
  console.log(`   Total Unallocated Advances: ₹${outReport.summary.totalUnallocatedAdvances}`);

  // 6. Verify Aging Report
  const agingReport = await getAgingReport(db, firmId, { partyId });
  console.log(`\n6. Aging Report Total Outstanding: ₹${agingReport.summary.totalOutstanding}`);

  // Checks
  const billPendingOk = billList.length > 0 && Number(billList[0].pendingAmount) === 129310;
  const ledgerBalOk = latestBal === 124310;
  const unallocAdvOk = outReport.summary.totalUnallocatedAdvances === 5000;
  const outReportOk = outReport.summary.totalOutstanding === 129310;
  const agingOk = agingReport.summary.totalOutstanding === 129310;

  if (billPendingOk && ledgerBalOk && unallocAdvOk && outReportOk && agingOk) {
    console.log("\n SUCCESS: ALL QA STATE VERIFICATIONS PASSED PERFECTLY!");
  } else {
    console.error("\n FAILURE IN QA VERIFICATION!");
    process.exit(1);
  }

  process.exit(0);
}

verifyFinalQAState().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
