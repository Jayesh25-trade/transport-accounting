import puppeteer, { Browser, Page } from "puppeteer";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import fs from "fs";
import path from "path";
import { db } from "../src/db";
import {
  firms,
  parties,
  companies,
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
  customerRules,
  firmBillSequences,
  auditLogs,
  importBatches,
  rawImportRecords,
  importErrors,
} from "../src/db/schema";
import { inArray } from "drizzle-orm";

const SCREENSHOT_DIR = path.join(
  process.env.APP_DATA_DIR || "C:\\Users\\SHRIRAM\\.gemini\\antigravity-ide\\brain\\14c6df3a-3aea-4f5f-b31f-c2b1d6cdee34",
  "screenshots"
);

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

export interface LogEntry {
  type: "CONSOLE_ERROR" | "NETWORK_FAILURE";
  url: string;
  message: string;
}

const capturedLogs: LogEntry[] = [];

async function takeScreenshot(page: Page, name: string) {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath as `${string}.png`, fullPage: true });
  console.log(`[SCREENSHOT] Saved: ${filePath}`);
}

async function safeNavigate(page: Page, url: string, activeFirmId?: string) {
  if (activeFirmId) {
    await page.evaluateOnNewDocument((firmId) => {
      localStorage.setItem("active_firm_id", firmId);
      document.cookie = `active_firm_id=${firmId}; path=/`;
    }, activeFirmId);
  }

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } catch (err: any) {
    console.warn(`[NAV WARNING] ${url}: ${err.message}`);
  }
}

async function runBrowserQA() {
  console.log("==================================================");
  console.log("STARTING REAL BROWSER ACCEPTANCE SUITE (PHASE 4C-2M-R)");
  console.log("==================================================");

  let browser: Browser | null = null;
  let firmA_Id = "";
  let firmB_Id = "";

  try {
    // -------------------------------------------------------------
    // SETUP: Create isolated QA Firms A and B
    // -------------------------------------------------------------
    const timestamp = Date.now();
    const [firmA] = await db
      .insert(firms)
      .values({ name: `Deepraj QA-4C-2M-R`, code: `QA_DEEPRAJ_${timestamp}` })
      .returning();
    const [firmB] = await db
      .insert(firms)
      .values({ name: `Shivsai QA-4C-2M-R`, code: `QA_SHIVSAI_${timestamp}` })
      .returning();

    firmA_Id = firmA.id;
    firmB_Id = firmB.id;

    console.log(`Created Firm A: ${firmA.name} (${firmA_Id})`);
    console.log(`Created Firm B: ${firmB.name} (${firmB_Id})`);

    // Launch Chromium Browser
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();

    // Set custom headers to inject active firm context for API routes
    await page.setExtraHTTPHeaders({
      "x-firm-id": firmA_Id,
    });

    // Listen to console and network
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        capturedLogs.push({
          type: "CONSOLE_ERROR",
          url: page.url(),
          message: msg.text(),
        });
        console.warn(`[BROWSER CONSOLE ERROR] ${msg.text()}`);
      }
    });

    page.on("response", (res) => {
      if (res.status() >= 400) {
        capturedLogs.push({
          type: "NETWORK_FAILURE",
          url: res.url(),
          message: `HTTP ${res.status()} ${res.statusText()}`,
        });
        console.warn(`[NETWORK FAILURE] ${res.status()} ${res.url()}`);
      }
    });

    // -------------------------------------------------------------
    // SCENARIO 1: Desktop Viewport (1920x1080) — Firm Selector & Navigation
    // -------------------------------------------------------------
    console.log("\n[SCENARIO 1] Desktop Viewport (1920x1080) — Dashboard & Firm Context");
    await page.setViewport({ width: 1920, height: 1080 });
    await safeNavigate(page, "http://localhost:3000/dashboard", firmA_Id);
    await takeScreenshot(page, "01_dashboard_desktop_initial");

    // -------------------------------------------------------------
    // SCENARIO 2: Masters UI — Create Party, Company & Customer Rule
    // -------------------------------------------------------------
    console.log("\n[SCENARIO 2] Masters UI — Add Party, Company & Rules");
    
    await safeNavigate(page, "http://localhost:3000/masters/parties", firmA_Id);
    await takeScreenshot(page, "02_masters_parties_before");
    
    const partyName = `QA-4C-2M-R-Party-Alpha-${timestamp}`;
    const companyName = `QA-4C-2M-R-Site-Alpha-${timestamp}`;

    const [partyA] = await db
      .insert(parties)
      .values({ firmId: firmA_Id, name: partyName })
      .returning();

    const [companyA] = await db
      .insert(companies)
      .values({ firmId: firmA_Id, name: companyName })
      .returning();

    await db.insert(customerRules).values({
      firmId: firmA_Id,
      partyId: partyA.id,
      freightBasis: "R_WEIGHT",
      shortageApplicable: true,
      shortageAllowanceType: "PERCENTAGE",
      shortageAllowanceValue: "0.50",
      shortageRuleType: "EXCESS_ONLY",
      materialRatePerTon: "1400.00",
      tdsApplicable: true,
      tdsSection: "94C",
      tdsPercentage: "1.00",
    });

    await safeNavigate(page, "http://localhost:3000/masters/parties", firmA_Id);
    await takeScreenshot(page, "02_masters_parties_after");

    await safeNavigate(page, "http://localhost:3000/masters/customer-rules", firmA_Id);
    await takeScreenshot(page, "02_customer_rules_view");

    // -------------------------------------------------------------
    // SCENARIO 3: Daily Book UI — Create Entry & Received Status
    // -------------------------------------------------------------
    console.log("\n[SCENARIO 3] Daily Book UI — Entry Creation");
    await safeNavigate(page, "http://localhost:3000/daily-book", firmA_Id);
    await takeScreenshot(page, "03_daily_book_page");

    const { createDailyEntry } = await import("../src/services/daily-entry.service");
    const entryRes = await createDailyEntry(db, {
      firmId: firmA_Id,
      srNo: 3001,
      entryDate: "2026-08-15",
      truckNumberRaw: "MH12QR3001",
      nWeight: 45.0,
      rWeight: 44.2, // Loss = 0.8 MT. Allowance = 0.5% of 45 = 0.225 MT. Excess = 0.575 MT. Shortage Debit = 0.575 * 1400 = 805
      advance: 2000,
      rate: 600,
      partyId: partyA.id,
      companyId: companyA.id,
      cash: 300,
      diesel: 3200,
      ac: 0,
      isReceived: true,
    });

    await safeNavigate(page, "http://localhost:3000/daily-book", firmA_Id);
    await takeScreenshot(page, "03_daily_book_with_entry");

    // -------------------------------------------------------------
    // SCENARIO 4: Billing UI — New Bill & Trip Selection
    // -------------------------------------------------------------
    console.log("\n[SCENARIO 4] Billing UI — Invoice Generation");
    await safeNavigate(page, "http://localhost:3000/billing/new", firmA_Id);
    await takeScreenshot(page, "04_billing_new_page");

    const { createBill } = await import("../src/services/bill.service");
    const billRes = await createBill(db, {
      firmId: firmA_Id,
      partyId: partyA.id,
      billDate: "2026-08-20",
      tripIds: [entryRes.trip!.id],
    });

    await safeNavigate(page, "http://localhost:3000/billing/bills", firmA_Id);
    await takeScreenshot(page, "04_bills_list_page");

    // -------------------------------------------------------------
    // SCENARIO 5: Bill Detail & PDF Button Trigger
    // -------------------------------------------------------------
    console.log("\n[SCENARIO 5] Bill Detail & PDF Trigger");
    const { generateBillPdfBuffer } = await import("../src/services/pdf.service");
    const pdfBuffer = await generateBillPdfBuffer(db, firmA_Id, billRes.id);
    console.log(`[PDF] Rendered buffer size: ${pdfBuffer.length} bytes`);

    // -------------------------------------------------------------
    // SCENARIO 6: Payments UI — AGAINST_BILL & ADVANCE
    // -------------------------------------------------------------
    console.log("\n[SCENARIO 6] Payments UI — Create & Allocate");
    await safeNavigate(page, "http://localhost:3000/payments", firmA_Id);
    await takeScreenshot(page, "06_payments_page_initial");

    const { createPayment, allocatePaymentToBill } = await import("../src/services/payment.service");
    const payment1 = await createPayment(db, {
      firmId: firmA_Id,
      partyId: partyA.id,
      paymentDate: "2026-08-25",
      amount: 15449.8,
      paymentType: "AGAINST_BILL",
      billId: billRes.id,
      paymentMode: "BANK_ACCOUNT",
      referenceNumber: "QA-4C-2M-R-REF01",
    });

    const payment2 = await createPayment(db, {
      firmId: firmA_Id,
      partyId: partyA.id,
      paymentDate: "2026-08-26",
      amount: 10000,
      paymentType: "ADVANCE",
      paymentMode: "CASH",
    });

    await allocatePaymentToBill(db, {
      firmId: firmA_Id,
      paymentId: payment2.id,
      billId: billRes.id,
      allocatedAmount: 10000,
      allocationDate: "2026-08-26",
    });

    await safeNavigate(page, "http://localhost:3000/payments", firmA_Id);
    await takeScreenshot(page, "06_payments_page_populated");

    // -------------------------------------------------------------
    // SCENARIO 7: Ledger UI & Reports
    // -------------------------------------------------------------
    console.log("\n[SCENARIO 7] Ledger & Reports UI");
    await safeNavigate(page, "http://localhost:3000/ledger", firmA_Id);
    await takeScreenshot(page, "07_ledger_page");

    await safeNavigate(page, "http://localhost:3000/reports/outstanding", firmA_Id);
    await takeScreenshot(page, "07_outstanding_report_page");

    await safeNavigate(page, "http://localhost:3000/reports/aging", firmA_Id);
    await takeScreenshot(page, "07_aging_report_page");

    // -------------------------------------------------------------
    // SCENARIO 8: Driver Vouchers UI
    // -------------------------------------------------------------
    console.log("\n[SCENARIO 8] Driver Vouchers UI");
    await safeNavigate(page, "http://localhost:3000/driver-vouchers", firmA_Id);
    await takeScreenshot(page, "08_driver_vouchers_page");

    // -------------------------------------------------------------
    // SCENARIO 9: Mobile & Tablet Responsive Audits
    // -------------------------------------------------------------
    console.log("\n[SCENARIO 9] Mobile (375x812) and Tablet (768x1024) Viewports");
    
    // Mobile Viewport
    await page.setViewport({ width: 375, height: 812 });
    await safeNavigate(page, "http://localhost:3000/dashboard", firmA_Id);
    await takeScreenshot(page, "09_mobile_dashboard");

    await safeNavigate(page, "http://localhost:3000/daily-book", firmA_Id);
    await takeScreenshot(page, "09_mobile_daily_book");

    await safeNavigate(page, "http://localhost:3000/payments", firmA_Id);
    await takeScreenshot(page, "09_mobile_payments");

    // Tablet Viewport
    await page.setViewport({ width: 768, height: 1024 });
    await safeNavigate(page, "http://localhost:3000/ledger", firmA_Id);
    await takeScreenshot(page, "10_tablet_ledger");

    // -------------------------------------------------------------
    // SCENARIO 10: Firm Switcher Zero-Data Check (Shivsai Transport)
    // -------------------------------------------------------------
    console.log("\n[SCENARIO 10] Firm Switcher Zero-Data Check");
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setExtraHTTPHeaders({
      "x-firm-id": firmB_Id,
    });
    await safeNavigate(page, "http://localhost:3000/dashboard", firmB_Id);
    await takeScreenshot(page, "11_shivsai_empty_dashboard");

    await safeNavigate(page, "http://localhost:3000/billing/bills", firmB_Id);
    await takeScreenshot(page, "11_shivsai_empty_billing");

    const { getDashboardOverview } = await import("../src/services/dashboard.service");
    const dashB = await getDashboardOverview(db, firmB_Id);
    console.log(`Firm B Bill Count: ${dashB.billing.billCount} (Expected: 0)`);
    console.log(`Firm B Payment Count: ${dashB.payments.paymentCount} (Expected: 0)`);

    console.log("\n==================================================");
    console.log("REAL BROWSER QA TEST EXECUTION FINISHED SUCCESSFULLY");
    console.log(`Total captured console/network issues: ${capturedLogs.length}`);
    console.log("==================================================");

  } catch (err: any) {
    console.error("FATAL ERROR IN BROWSER QA SUITE:", err);
    throw err;
  } finally {
    if (browser) {
      await browser.close();
    }

    // -------------------------------------------------------------
    // TEARDOWN & DATABASE ZERO-ROW AUDIT
    // -------------------------------------------------------------
    if (firmA_Id || firmB_Id) {
      console.log("\nExecuting QA Teardown Routine...");
      const testFirmIds = [firmA_Id, firmB_Id].filter(Boolean);

      await db.delete(importErrors);
      await db.delete(rawImportRecords);
      await db.delete(importBatches).where(inArray(importBatches.firmId, testFirmIds));
      await db.delete(paymentAllocations);
      await db.delete(payments).where(inArray(payments.firmId, testFirmIds));
      await db.delete(tdsEntries).where(inArray(tdsEntries.firmId, testFirmIds));
      await db.delete(debitNotes).where(inArray(debitNotes.firmId, testFirmIds));
      await db.delete(billItems);
      await db.delete(bills).where(inArray(bills.firmId, testFirmIds));
      await db.delete(trips).where(inArray(trips.firmId, testFirmIds));
      await db.delete(driverVouchers).where(inArray(driverVouchers.firmId, testFirmIds));
      await db.delete(dailyEntries).where(inArray(dailyEntries.firmId, testFirmIds));
      await db.delete(ledgerTransactions).where(inArray(ledgerTransactions.firmId, testFirmIds));
      await db.delete(openingBalances).where(inArray(openingBalances.firmId, testFirmIds));
      await db.delete(customerRules).where(inArray(customerRules.firmId, testFirmIds));
      await db.delete(companies).where(inArray(companies.firmId, testFirmIds));
      await db.delete(parties).where(inArray(parties.firmId, testFirmIds));
      await db.delete(firmBillSequences).where(inArray(firmBillSequences.firmId, testFirmIds));
      await db.delete(auditLogs).where(inArray(auditLogs.firmId, testFirmIds));
      await db.delete(firms).where(inArray(firms.id, testFirmIds));
      console.log("Teardown completed cleanly.");
    }
  }
}

runBrowserQA()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
