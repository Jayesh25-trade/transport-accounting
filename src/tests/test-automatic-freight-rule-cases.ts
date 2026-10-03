import { calculateFreight } from "../domain/freight";
import { calculateShortage } from "../domain/shortage";
import { db } from "../db";
import { bills, payments, paymentAllocations, ledgerTransactions, parties, firms } from "../db/schema";
import { eq } from "drizzle-orm";
import { getOutstandingReport } from "../services/report.service";
import { listLedgerTransactions } from "../services/ledger.service";

async function runAutomaticFreightRuleTests() {
  console.log("=== VERIFYING AUTOMATIC FREIGHT RULE & QA SYSTEM INTEGRITY ===");

  // -------------------------------------------------------------
  // TEST CASE A — ALLOWANCE NOT BREACHED
  // N = 25 T, R = 24.8 T, Rate = ₹4,000, Allowance = 300 KG
  // -------------------------------------------------------------
  console.log("\n--- TEST CASE A: Allowance Not Breached ---");
  const shortageA = calculateShortage({
    nWeight: 25,
    rWeight: 24.8,
    shortageApplicable: true,
    allowanceType: "FIXED_KG",
    allowanceValue: 300,
    shortageRuleType: "EXCESS_ONLY",
    materialRatePerTon: 3500,
  });

  const freightA = calculateFreight({
    freightBasis: "AUTO_SHORTAGE_BASED",
    rate: 4000,
    nWeight: 25,
    rWeight: 24.8,
    applicableShortageDebit: shortageA.shortageDebitAmount,
  });

  console.log(`Test A Physical Shortage: ${shortageA.rawShortageQty * 1000} KG`);
  console.log(`Test A Shortage Debit: ₹${shortageA.shortageDebitAmount}`);
  console.log(`Test A Billed Weight: ${freightA.billedWeight} T`);
  console.log(`Test A Freight Amount: ₹${freightA.freightAmount}`);

  const testAPassed =
    freightA.billedWeight === 25 &&
    freightA.freightAmount === 100000 &&
    shortageA.shortageDebitAmount === 0;

  if (testAPassed) {
    console.log("✓ TEST CASE A PASSED (Freight = ₹1,00,000)");
  } else {
    console.error("❌ TEST CASE A FAILED!");
    process.exit(1);
  }

  // -------------------------------------------------------------
  // TEST CASE B — ALLOWANCE BREACHED
  // N = 25 T, R = 24 T, Rate = ₹4,000, Allowance = 300 KG
  // -------------------------------------------------------------
  console.log("\n--- TEST CASE B: Allowance Breached ---");
  const shortageB = calculateShortage({
    nWeight: 25,
    rWeight: 24,
    shortageApplicable: true,
    allowanceType: "FIXED_KG",
    allowanceValue: 300,
    shortageRuleType: "EXCESS_ONLY",
    materialRatePerTon: 3500,
  });

  const freightB = calculateFreight({
    freightBasis: "AUTO_SHORTAGE_BASED",
    rate: 4000,
    nWeight: 25,
    rWeight: 24,
    applicableShortageDebit: shortageB.shortageDebitAmount,
  });

  console.log(`Test B Physical Shortage: ${shortageB.rawShortageQty * 1000} KG`);
  console.log(`Test B Shortage Debit: ₹${shortageB.shortageDebitAmount}`);
  console.log(`Test B Billed Weight: ${freightB.billedWeight} T`);
  console.log(`Test B Freight Amount: ₹${freightB.freightAmount}`);

  const testBPassed =
    freightB.billedWeight === 24 &&
    freightB.freightAmount === 96000 &&
    shortageB.shortageDebitAmount > 0;

  if (testBPassed) {
    console.log("✓ TEST CASE B PASSED (Freight = ₹96,000)");
  } else {
    console.error("❌ TEST CASE B FAILED!");
    process.exit(1);
  }

  // -------------------------------------------------------------
  // READ-ONLY REGRESSION CHECK OF EXISTING QA BILL #1
  // -------------------------------------------------------------
  console.log("\n--- REGRESSION VERIFICATION OF EXISTING QA BILL #1 & LEDGER ---");
  const firmRows = await db.select().from(firms);
  const partyRows = await db.select().from(parties);

  if (firmRows.length > 0 && partyRows.length > 0) {
    const firmId = firmRows[0].id;
    const partyId = partyRows[0].id;

    const billList = await db.select().from(bills);
    if (billList.length > 0) {
      const b = billList[0];
      console.log(`Gross Freight: ₹${b.subtotalFreight}`);
      console.log(`Shortage Debit: ₹${b.debitNoteAmount}`);
      console.log(`TDS Amount: ₹${b.tdsAmount}`);
      console.log(`Driver Voucher: ₹${b.driverVoucherTotal}`);
      console.log(`Net Bill Amount: ₹${b.netBillAmount}`);

      const billOk =
        Number(b.subtotalFreight) === 195200 &&
        Number(b.debitNoteAmount) === 700 &&
        Number(b.tdsAmount) === 3890 &&
        Number(b.driverVoucherTotal) === 6300 &&
        Number(b.netBillAmount) === 184310 &&
        Number(b.pendingAmount) === 129310;

      const ledgerList = await listLedgerTransactions(db, firmId, partyId);
      const latestBal = ledgerList.length > 0 ? Number(ledgerList[ledgerList.length - 1].runningBalance) : 0;
      console.log(`Ledger Net Balance: ₹${latestBal}`);

      const outReport = await getOutstandingReport(db, firmId, { partyId });
      console.log(`Outstanding Report Total: ₹${outReport.summary.totalOutstanding}`);
      console.log(`Unallocated Advances Total: ₹${outReport.summary.totalUnallocatedAdvances}`);

      const regOk =
        billOk &&
        latestBal === 124310 &&
        outReport.summary.totalOutstanding === 129310 &&
        outReport.summary.totalUnallocatedAdvances === 5000;

      if (regOk) {
        console.log("✓ REGRESSION VERIFICATION PASSED (QA Bill #1, Ledger & Outstanding Intact)");
      } else {
        console.error("❌ REGRESSION VERIFICATION FAILED!");
        process.exit(1);
      }
    }
  }

  console.log("\n ALL TEST CASES & REGRESSION CHECKS PASSED PERFECTLY!");
  process.exit(0);
}

runAutomaticFreightRuleTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
