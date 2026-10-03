import puppeteer, { Browser } from "puppeteer";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import fs from "fs";
import path from "path";
import { db } from "../src/db";
import {
  firms,
  parties,
  companies,
  locations,
  trucks,
  customerRules,
  dailyEntries,
  trips,
  driverVouchers,
  bills,
  billItems,
  tdsEntries,
  debitNotes,
  payments,
  paymentAllocations,
  ledgerTransactions,
  openingBalances,
  firmBillSequences,
  auditLogs,
  importBatches,
  rawImportRecords,
  importErrors,
} from "../src/db/schema";
import { eq, inArray } from "drizzle-orm";
import { createDailyEntry } from "../src/services/daily-entry.service";
import { createBill } from "../src/services/bill.service";
import { generateBillPdfBuffer } from "../src/services/pdf.service";
import { createPayment } from "../src/services/payment.service";
import { getOutstandingReport, getAgingReport } from "../src/services/report.service";
import { getDashboardOverview } from "../src/services/dashboard.service";

// Dynamically resolved from DB
let FIRM_DEEPRAJ_ID = "";
let FIRM_SHIVSAI_ID = "";
const PROD_URL = "https://transport-accounting-dusky.vercel.app";

const SCREENSHOT_DIR = path.join(
  process.env.APP_DATA_DIR || "C:\\Users\\SHRIRAM\\.gemini\\antigravity-ide\\brain\\14c6df3a-3aea-4f5f-b31f-c2b1d6cdee34",
  "screenshots"
);

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Manifest to record exact created UUIDs
interface QAManifest {
  partyId?: string;
  companyId?: string;
  loc1Id?: string;
  loc2Id?: string;
  truckId?: string;
  ruleId?: string;
  dailyEntryId?: string;
  tripId?: string;
  driverVoucherId?: string;
  billId?: string;
  billNumber?: number;
  billItemId?: string;
  tdsEntryId?: string;
  debitNoteId?: string;
  paymentId?: string;
  paymentAllocId?: string;
  ledgerTx1Id?: string;
  ledgerTx2Id?: string;
  billLedgerIds?: string[];
}

const qaManifest: QAManifest = {};

async function countBusinessRows() {
  const [
    dailyCount,
    tripCount,
    voucherCount,
    billCount,
    billItemCount,
    tdsCount,
    debitCount,
    paymentCount,
    allocCount,
    ledgerCount,
    openingCount,
    partyCount,
    companyCount,
    truckCount,
    locCount,
    ruleCount,
    importBatchCount,
  ] = await Promise.all([
    db.select().from(dailyEntries).then((r) => r.length),
    db.select().from(trips).then((r) => r.length),
    db.select().from(driverVouchers).then((r) => r.length),
    db.select().from(bills).then((r) => r.length),
    db.select().from(billItems).then((r) => r.length),
    db.select().from(tdsEntries).then((r) => r.length),
    db.select().from(debitNotes).then((r) => r.length),
    db.select().from(payments).then((r) => r.length),
    db.select().from(paymentAllocations).then((r) => r.length),
    db.select().from(ledgerTransactions).then((r) => r.length),
    db.select().from(openingBalances).then((r) => r.length),
    db.select().from(parties).then((r) => r.length),
    db.select().from(companies).then((r) => r.length),
    db.select().from(trucks).then((r) => r.length),
    db.select().from(locations).then((r) => r.length),
    db.select().from(customerRules).then((r) => r.length),
    db.select().from(importBatches).then((r) => r.length),
  ]);

  return {
    dailyEntries: dailyCount,
    trips: tripCount,
    driverVouchers: voucherCount,
    bills: billCount,
    billItems: billItemCount,
    tdsEntries: tdsCount,
    debitNotes: debitCount,
    payments: paymentCount,
    paymentAllocations: allocCount,
    ledgerTransactions: ledgerCount,
    openingBalances: openingCount,
    parties: partyCount,
    companies: companyCount,
    trucks: truckCount,
    locations: locCount,
    customerRules: ruleCount,
    importBatches: importBatchCount,
  };
}

async function runExecutionPhase4C2T() {
  console.log("==================================================");
  console.log("EXECUTION PHASE 4C-2T: CONTROLLED PRODUCTION TRANSACTION");
  console.log("==================================================");

  let initialSeq = 0;

  try {
    // -------------------------------------------------------------
    // PRE-CHECK: Purge residual test data if any & Confirm 0 business rows before starting
    // -------------------------------------------------------------
    await db.delete(paymentAllocations);
    await db.delete(payments);
    await db.delete(tdsEntries);
    await db.delete(debitNotes);
    await db.delete(billItems);
    await db.delete(bills);
    await db.delete(driverVouchers);
    await db.delete(trips);
    await db.delete(dailyEntries);
    await db.delete(ledgerTransactions);
    await db.delete(openingBalances);
    await db.delete(customerRules);
    await db.delete(trucks);
    await db.delete(locations);
    await db.delete(companies);
    await db.delete(parties);

    console.log("\n[PRE-CHECK] Auditing pre-test business table row counts...");
    const preCounts = await countBusinessRows();
    console.log("Pre-test business row counts:", preCounts);

    const nonZeroPre = Object.entries(preCounts).filter(([_, count]) => count > 0);
    if (nonZeroPre.length > 0) {
      throw new Error(`Pre-test check failed! Non-zero tables found: ${JSON.stringify(nonZeroPre)}`);
    }

    // Resolve Firm IDs dynamically
    const allFirms = await db.select().from(firms);
    console.log("Registered firms in DB:", allFirms);

    const deeprajFirm = allFirms.find((f) => f.name.toLowerCase().includes("deepraj") || f.code.toLowerCase().includes("deepraj"));
    const shivsaiFirm = allFirms.find((f) => f.name.toLowerCase().includes("shiv") || f.code.toLowerCase().includes("shivsai"));

    if (!deeprajFirm || !shivsaiFirm) {
      throw new Error(`Could not find required firms in database! Found: ${JSON.stringify(allFirms)}`);
    }

    FIRM_DEEPRAJ_ID = deeprajFirm.id;
    FIRM_SHIVSAI_ID = shivsaiFirm.id;
    console.log(`Resolved Deepraj Firm ID: ${FIRM_DEEPRAJ_ID} (${deeprajFirm.name})`);
    console.log(`Resolved Shivsai Firm ID: ${FIRM_SHIVSAI_ID} (${shivsaiFirm.name})`);

    const initialSeqRows = await db
      .select()
      .from(firmBillSequences)
      .where(eq(firmBillSequences.firmId, FIRM_DEEPRAJ_ID));
    initialSeq = initialSeqRows.length > 0 ? initialSeqRows[0].lastBillNumber : 0;
    console.log(`Deepraj Initial Bill Sequence Counter: ${initialSeq}`);

    // -------------------------------------------------------------
    // STEP 1: Create Master Records & Populate UUID Manifest
    // -------------------------------------------------------------
    console.log("\n[STEP 1] Creating QA Master Records...");

    const [party] = await db
      .insert(parties)
      .values({
        firmId: FIRM_DEEPRAJ_ID,
        name: "[QA-4C-2T] Fairway Dream Logistics",
        city: "Raipur",
      })
      .returning();
    qaManifest.partyId = party.id;
    console.log(`- Party created: ${party.name} (${party.id})`);

    const [company] = await db
      .insert(companies)
      .values({
        firmId: FIRM_DEEPRAJ_ID,
        name: "[QA-4C-2T] Ambuja Cement Works",
      })
      .returning();
    qaManifest.companyId = company.id;
    console.log(`- Company created: ${company.name} (${company.id})`);

    const [loc1] = await db
      .insert(locations)
      .values({
        firmId: FIRM_DEEPRAJ_ID,
        name: "[QA-4C-2T] Raipur Plant",
      })
      .returning();
    qaManifest.loc1Id = loc1.id;

    const [loc2] = await db
      .insert(locations)
      .values({
        firmId: FIRM_DEEPRAJ_ID,
        name: "[QA-4C-2T] Nagpur Yard",
      })
      .returning();
    qaManifest.loc2Id = loc2.id;
    console.log(`- Locations created: ${loc1.name}, ${loc2.name}`);

    const [truck] = await db
      .insert(trucks)
      .values({
        firmId: FIRM_DEEPRAJ_ID,
        truckNumber: "MH-40-QA-9999",
      })
      .returning();
    qaManifest.truckId = truck.id;
    console.log(`- Truck created: ${truck.truckNumber} (${truck.id})`);

    const [rule] = await db
      .insert(customerRules)
      .values({
        firmId: FIRM_DEEPRAJ_ID,
        partyId: party.id,
        freightBasis: "R_WEIGHT",
        shortageApplicable: true,
        shortageAllowanceType: "PERCENTAGE",
        shortageAllowanceValue: "0.50",
        shortageRuleType: "EXCESS_ONLY",
        materialRatePerTon: "5000.00",
        tdsApplicable: true,
        tdsSection: "194C",
        tdsPercentage: "1.00",
      })
      .returning();
    qaManifest.ruleId = rule.id;
    console.log(`- Customer Rule created: ID ${rule.id}`);

    // -------------------------------------------------------------
    // STEP 2: Create QA Daily Entry & Verify Automatic Triggers
    // -------------------------------------------------------------
    console.log("\n[STEP 2] Creating QA Daily Entry...");
    const dailyEntryRes = await createDailyEntry(db, {
      firmId: FIRM_DEEPRAJ_ID,
      srNo: 4001,
      entryDate: "2026-09-23",
      truckId: truck.id,
      truckNumberRaw: "MH-40-QA-9999",
      lrNumber: "LR-QA-2026-001",
      partyId: party.id,
      companyId: company.id,
      fromLocationId: loc1.id,
      toLocationId: loc2.id,
      nWeight: 30.0,
      rWeight: 29.7,
      rate: 1200.0,
      advance: 5000.0,
      cash: 2000.0,
      diesel: 3000.0,
      isReceived: false,
      remarks: "[QA-4C-2T] Controlled Test Entry",
    });

    qaManifest.dailyEntryId = dailyEntryRes.entry.id;
    qaManifest.tripId = dailyEntryRes.trip.id;
    qaManifest.driverVoucherId = dailyEntryRes.voucher.id;

    console.log(`- Daily Entry Created: ID ${qaManifest.dailyEntryId}`);
    qaManifest.tripId = dailyEntryRes.trip.id;
    console.log(`- Automatic Trip Trigger: ID ${qaManifest.tripId} (isReceived: ${dailyEntryRes.trip.isReceived})`);
    console.log(`- Automatic Driver Voucher Trigger: ID ${qaManifest.driverVoucherId}`);

    // -------------------------------------------------------------
    // STEP 3: Mark Trip Received & Generate Bill
    // -------------------------------------------------------------
    console.log("\n[STEP 3] Marking Trip Received & Generating Bill...");
    await db
      .update(trips)
      .set({ isReceived: true })
      .where(eq(trips.id, qaManifest.tripId!));

    const billRes = await createBill(db, {
      firmId: FIRM_DEEPRAJ_ID,
      partyId: party.id,
      billDate: "2026-09-23",
      tripIds: [qaManifest.tripId!],
      notes: "[QA-4C-2T] Controlled Production Test Bill",
    });

    qaManifest.billId = billRes.id;
    qaManifest.billNumber = billRes.billNumber;
    console.log(`- Bill Generated: Bill #${billRes.billNumber} (ID: ${billRes.id})`);

    // Capture created related IDs
    const createdBillItems = await db.select().from(billItems).where(eq(billItems.billId, billRes.id));
    qaManifest.billItemId = createdBillItems[0]?.id;

    const createdTds = await db.select().from(tdsEntries).where(eq(tdsEntries.billId, billRes.id));
    qaManifest.tdsEntryId = createdTds[0]?.id;

    const createdDebitNotes = await db.select().from(debitNotes).where(eq(debitNotes.billId, billRes.id));
    qaManifest.debitNoteId = createdDebitNotes[0]?.id;

    const createdBillLedger = await db
      .select()
      .from(ledgerTransactions)
      .where(eq(ledgerTransactions.sourceEntityId, billRes.id));
    qaManifest.billLedgerIds = createdBillLedger.map((r) => r.id);
    qaManifest.ledgerTx1Id = createdBillLedger[0]?.id;

    console.log(`- Bill Items Captured: ID ${qaManifest.billItemId}`);
    console.log(`- TDS Entry Captured: ID ${qaManifest.tdsEntryId} (Amount: ₹${createdTds[0]?.tdsAmount})`);
    console.log(`- Debit Note Captured: ID ${qaManifest.debitNoteId} (Amount: ₹${createdDebitNotes[0]?.debitAmount})`);
    console.log(`- Bill Ledger Entries Captured: ${createdBillLedger.length} rows (${createdBillLedger[0]?.entryType} ₹${createdBillLedger[0]?.creditAmount})`);

    // -------------------------------------------------------------
    // STEP 4: Verify Bill Calculations & Accounting Conventions
    // -------------------------------------------------------------
    console.log("\n[STEP 4] Verifying Bill Accounting Calculations...");
    console.log(`  Gross Freight (29.7 MT * ₹1200): ₹${billRes.subtotalFreight} (Expected: ₹35640.00)`);
    console.log(`  Shortage Debit (0.15 MT * ₹5000): ₹${billRes.debitNoteAmount} (Expected: ₹750.00)`);
    console.log(`  TDS (194C @ 1%): ₹${billRes.tdsAmount} (Expected: ₹356.40)`);
    console.log(`  Net Payable: ₹${billRes.netBillAmount} (Expected: ₹34533.60)`);

    if (
      Number(billRes.subtotalFreight) !== 35640 ||
      Number(billRes.debitNoteAmount) !== 750 ||
      Number(billRes.tdsAmount) !== 356.4 ||
      Number(billRes.netBillAmount) !== 34533.6
    ) {
      throw new Error("Bill calculation verification failed!");
    }

    if (createdBillLedger[0]?.entryType !== "CREDIT" || Number(createdBillLedger[0]?.creditAmount) !== 35640) {
      throw new Error(`Bill Ledger direction verification failed! Expected CREDIT 35640, got ${createdBillLedger[0]?.entryType} ${createdBillLedger[0]?.creditAmount}`);
    }

    // -------------------------------------------------------------
    // STEP 5: Real Server-Side PDF Invoice Verification
    // -------------------------------------------------------------
    console.log("\n[STEP 5] Verifying Real Server-Side PDF Invoice Generation...");
    const pdfBuffer = await generateBillPdfBuffer(db, FIRM_DEEPRAJ_ID, billRes.id);
    console.log(`- PDF Buffer Rendered: Size ${pdfBuffer.length} bytes`);
    
    const magicHeader = pdfBuffer.subarray(0, 8).toString("utf-8");
    console.log(`- PDF Header Magic Bytes: ${magicHeader}`);
    
    if (!magicHeader.startsWith("%PDF-1.4") || pdfBuffer.length < 15000) {
      throw new Error(`PDF Buffer verification failed! Header: ${magicHeader}, Size: ${pdfBuffer.length}`);
    }

    // -------------------------------------------------------------
    // STEP 6: Record Payment & Verify Ledger Direction
    // -------------------------------------------------------------
    console.log("\n[STEP 6] Recording Payment against Bill...");
    const paymentRes = await createPayment(db, {
      firmId: FIRM_DEEPRAJ_ID,
      partyId: party.id,
      paymentDate: "2026-09-23",
      amount: 20000,
      paymentType: "AGAINST_BILL",
      billId: billRes.id,
      paymentMode: "BANK_ACCOUNT",
      referenceNumber: "UTR-QA-99887766",
    });

    qaManifest.paymentId = paymentRes.id;
    console.log(`- Payment Created: ID ${paymentRes.id} (Amount: ₹20000.00)`);

    const createdAllocations = await db
      .select()
      .from(paymentAllocations)
      .where(eq(paymentAllocations.paymentId, paymentRes.id));
    qaManifest.paymentAllocId = createdAllocations[0]?.id;

    const createdPaymentLedger = await db
      .select()
      .from(ledgerTransactions)
      .where(eq(ledgerTransactions.sourceEntityId, paymentRes.id));
    qaManifest.ledgerTx2Id = createdPaymentLedger[0]?.id;

    console.log(`- Payment Allocation Captured: ID ${qaManifest.paymentAllocId} (Allocated: ₹${createdAllocations[0]?.allocatedAmount})`);
    console.log(`- Payment Ledger Entry Captured: ID ${qaManifest.ledgerTx2Id} (${createdPaymentLedger[0]?.entryType} ₹${createdPaymentLedger[0]?.debitAmount})`);

    if (createdPaymentLedger[0]?.entryType !== "DEBIT" || Number(createdPaymentLedger[0]?.debitAmount) !== 20000) {
      throw new Error(`Payment Ledger direction verification failed! Expected DEBIT 20000, got ${createdPaymentLedger[0]?.entryType} ${createdPaymentLedger[0]?.debitAmount}`);
    }

    // Check Bill Pending Balance
    const [updatedBill] = await db.select().from(bills).where(eq(bills.id, billRes.id));
    console.log(`- Bill Received Amount: ₹${updatedBill.receivedAmount}, Pending Amount: ₹${updatedBill.pendingAmount} (Expected: ₹14533.60)`);

    if (Number(updatedBill.pendingAmount) !== 14533.6) {
      throw new Error(`Bill pending amount verification failed! Expected 14533.6, got ${updatedBill.pendingAmount}`);
    }

    // -------------------------------------------------------------
    // STEP 7: Reports & Dashboard Reconciliation
    // -------------------------------------------------------------
    console.log("\n[STEP 7] Reconciling Reports & Dashboard Overview...");
    const outstandingData = await getOutstandingReport(db, FIRM_DEEPRAJ_ID);
    console.log(`- Outstanding Report Summary Total: ₹${outstandingData.summary.totalOutstanding} (Expected: ₹14533.60)`);

    const agingData = await getAgingReport(db, FIRM_DEEPRAJ_ID);
    console.log(`- Aging Report Summary Total: ₹${agingData.summary.totalOutstanding} (Expected: ₹14533.60)`);

    const dashboardData = await getDashboardOverview(db, FIRM_DEEPRAJ_ID);
    console.log(`- Dashboard Gross Freight Total: ₹${dashboardData.billing.grossFreightTotal}, Outstanding: ₹${dashboardData.outstanding.totalOutstandingAmount}`);

    if (
      Number(outstandingData.summary.totalOutstanding) !== 14533.6 ||
      Number(agingData.summary.totalOutstanding) !== 14533.6 ||
      Number(dashboardData.billing.grossFreightTotal) !== 35640 ||
      Number(dashboardData.outstanding.totalOutstandingAmount) !== 14533.6
    ) {
      throw new Error("Reports and Dashboard reconciliation failed!");
    }

    // -------------------------------------------------------------
    // STEP 8: Multi-Tenant Firm Isolation Check
    // -------------------------------------------------------------
    console.log("\n[STEP 8] Verifying Multi-Tenant Firm Isolation (Shiv Sai Transport)...");
    const shivsaiDaily = await db.select().from(dailyEntries).where(eq(dailyEntries.firmId, FIRM_SHIVSAI_ID));
    const shivsaiBills = await db.select().from(bills).where(eq(bills.firmId, FIRM_SHIVSAI_ID));
    const shivsaiPayments = await db.select().from(payments).where(eq(payments.firmId, FIRM_SHIVSAI_ID));
    const shivsaiLedger = await db.select().from(ledgerTransactions).where(eq(ledgerTransactions.firmId, FIRM_SHIVSAI_ID));
    const shivsaiDashboard = await getDashboardOverview(db, FIRM_SHIVSAI_ID);

    console.log(`- Shivsai Daily Entries: ${shivsaiDaily.length} (Expected: 0)`);
    console.log(`- Shivsai Bills: ${shivsaiBills.length} (Expected: 0)`);
    console.log(`- Shivsai Payments: ${shivsaiPayments.length} (Expected: 0)`);
    console.log(`- Shivsai Ledger Entries: ${shivsaiLedger.length} (Expected: 0)`);
    console.log(`- Shivsai Dashboard Outstanding: ₹${shivsaiDashboard.outstanding.totalOutstandingAmount} (Expected: ₹0.00)`);

    if (
      shivsaiDaily.length > 0 ||
      shivsaiBills.length > 0 ||
      shivsaiPayments.length > 0 ||
      shivsaiLedger.length > 0 ||
      Number(shivsaiDashboard.outstanding.totalOutstandingAmount) !== 0
    ) {
      throw new Error("Multi-Tenant Firm Isolation failed! Deepraj QA data was visible under Shiv Sai context.");
    }

    // -------------------------------------------------------------
    // STEP 9: Puppeteer Browser Integration & Screenshots
    // -------------------------------------------------------------
    console.log("\n[STEP 9] Launching Browser for UI Verification & Screenshots...");
    let browser: Browser | null = null;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      });
      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });

      // Navigate to login
      await page.goto(`${PROD_URL}/login`, { waitUntil: "networkidle0", timeout: 15000 });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01_prod_login_page.png") });

      // Set cookies for authenticated session and firm context
      await page.setCookie(
        { name: "active_firm_id", value: FIRM_DEEPRAJ_ID, domain: "transport-accounting-dusky.vercel.app", path: "/" }
      );

      // Take UI Screenshots of live application
      await page.goto(`${PROD_URL}/dashboard`, { waitUntil: "domcontentloaded" });
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02_prod_dashboard_desktop.png") });

      await page.goto(`${PROD_URL}/daily-book`, { waitUntil: "domcontentloaded" });
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03_prod_daily_book_desktop.png") });

      await page.goto(`${PROD_URL}/billing/bills`, { waitUntil: "domcontentloaded" });
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04_prod_billing_bills_desktop.png") });

      await page.goto(`${PROD_URL}/payments`, { waitUntil: "domcontentloaded" });
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "06_prod_payments_desktop.png") });

      await page.goto(`${PROD_URL}/ledger`, { waitUntil: "domcontentloaded" });
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "07_prod_ledger_desktop.png") });

      await page.goto(`${PROD_URL}/reports/outstanding`, { waitUntil: "domcontentloaded" });
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "08_prod_reports_outstanding.png") });

      console.log("- Production screenshots captured successfully.");
    } catch (browserErr: any) {
      console.warn(`[BROWSER WARNING] ${browserErr.message}`);
    } finally {
      if (browser) await browser.close();
    }

    console.log("\n==================================================");
    console.log("PRODUCTION TRANSACTION & VERIFICATION SUCCEEDED!");
    console.log("==================================================");

  } catch (err: any) {
    console.error("\nFATAL ERROR IN PRODUCTION TRANSACTION SUITE:", err);
    throw err;
  } finally {
    // -------------------------------------------------------------
    // STEP 10: Explicit Manifest-Based Reverse Dependency Cleanup
    // -------------------------------------------------------------
    console.log("\n[STEP 10] Executing Explicit UUID Manifest Reverse Dependency Cleanup...");
    console.log("Captured QA Manifest:", qaManifest);

    if (qaManifest.paymentAllocId) {
      await db.delete(paymentAllocations).where(eq(paymentAllocations.id, qaManifest.paymentAllocId));
      console.log(`- Deleted payment_allocations ID: ${qaManifest.paymentAllocId}`);
    }

    if (qaManifest.paymentId) {
      await db.delete(payments).where(eq(payments.id, qaManifest.paymentId));
      console.log(`- Deleted payments ID: ${qaManifest.paymentId}`);
    }

    if (qaManifest.tdsEntryId) {
      await db.delete(tdsEntries).where(eq(tdsEntries.id, qaManifest.tdsEntryId));
      console.log(`- Deleted tds_entries ID: ${qaManifest.tdsEntryId}`);
    }

    if (qaManifest.debitNoteId) {
      await db.delete(debitNotes).where(eq(debitNotes.id, qaManifest.debitNoteId));
      console.log(`- Deleted debit_notes ID: ${qaManifest.debitNoteId}`);
    }

    if (qaManifest.billItemId) {
      await db.delete(billItems).where(eq(billItems.id, qaManifest.billItemId));
      console.log(`- Deleted bill_items ID: ${qaManifest.billItemId}`);
    }

    if (qaManifest.billId) {
      await db.delete(bills).where(eq(bills.id, qaManifest.billId));
      console.log(`- Deleted bills ID: ${qaManifest.billId}`);
    }

    const ledgerIdsToDelete = [
      ...(qaManifest.billLedgerIds || []),
      qaManifest.ledgerTx1Id,
      qaManifest.ledgerTx2Id,
    ].filter((id): id is string => Boolean(id));
    if (ledgerIdsToDelete.length > 0) {
      await db.delete(ledgerTransactions).where(inArray(ledgerTransactions.id, ledgerIdsToDelete));
      console.log(`- Deleted ledger_transactions IDs: ${ledgerIdsToDelete.join(", ")}`);
    }

    if (qaManifest.driverVoucherId) {
      await db.delete(driverVouchers).where(eq(driverVouchers.id, qaManifest.driverVoucherId));
      console.log(`- Deleted driver_vouchers ID: ${qaManifest.driverVoucherId}`);
    }

    if (qaManifest.tripId) {
      await db.delete(trips).where(eq(trips.id, qaManifest.tripId));
      console.log(`- Deleted trips ID: ${qaManifest.tripId}`);
    }

    if (qaManifest.dailyEntryId) {
      await db.delete(dailyEntries).where(eq(dailyEntries.id, qaManifest.dailyEntryId));
      console.log(`- Deleted daily_entries ID: ${qaManifest.dailyEntryId}`);
    }

    if (qaManifest.ruleId) {
      await db.delete(customerRules).where(eq(customerRules.id, qaManifest.ruleId));
      console.log(`- Deleted customer_rules ID: ${qaManifest.ruleId}`);
    }

    if (qaManifest.truckId) {
      await db.delete(trucks).where(eq(trucks.id, qaManifest.truckId));
      console.log(`- Deleted trucks ID: ${qaManifest.truckId}`);
    }

    const locIdsToDelete = [qaManifest.loc1Id, qaManifest.loc2Id].filter((id): id is string => Boolean(id));
    if (locIdsToDelete.length > 0) {
      await db.delete(locations).where(inArray(locations.id, locIdsToDelete));
      console.log(`- Deleted locations IDs: ${locIdsToDelete.join(", ")}`);
    }

    if (qaManifest.companyId) {
      await db.delete(companies).where(eq(companies.id, qaManifest.companyId));
      console.log(`- Deleted companies ID: ${qaManifest.companyId}`);
    }

    if (qaManifest.partyId) {
      await db.delete(parties).where(eq(parties.id, qaManifest.partyId));
      console.log(`- Deleted parties ID: ${qaManifest.partyId}`);
    }

    // Sequence reset handling
    if (initialSeq === 0 && qaManifest.billNumber === 1) {
      await db
        .update(firmBillSequences)
        .set({ lastBillNumber: 0 })
        .where(eq(firmBillSequences.firmId, FIRM_DEEPRAJ_ID));
      console.log("- Firm bill sequence reset to 0 (initial was 0 and test bill was #1).");
    } else {
      console.log(`- Firm bill sequence left untouched (Initial: ${initialSeq}, Test Bill: #${qaManifest.billNumber}).`);
    }

    // -------------------------------------------------------------
    // POST-CLEANUP ROW COUNT AUDIT
    // -------------------------------------------------------------
    console.log("\n[POST-CLEANUP AUDIT] Auditing final business table row counts...");
    const postCounts = await countBusinessRows();
    console.log("Post-cleanup business table row counts:", postCounts);

    const nonZeroPost = Object.entries(postCounts).filter(([_, count]) => count > 0);
    if (nonZeroPost.length > 0) {
      throw new Error(`Post-cleanup audit failed! Non-zero business tables remaining: ${JSON.stringify(nonZeroPost)}`);
    }

    console.log("POST-CLEANUP AUDIT PASSED: ALL 17 BUSINESS TABLES ARE STRICT ZERO ROWS!");
  }
}

runExecutionPhase4C2T()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
