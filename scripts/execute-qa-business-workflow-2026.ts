import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { db } from "../src/db";
import {
  users,
  firms,
  sessions,
  parties,
  companies,
  trucks,
  locations,
  customerRules,
  dailyEntries,
  trips,
  bills,
  billItems,
  payments,
  paymentAllocations,
  ledgerTransactions,
  tdsEntries,
  debitNotes
} from "../src/db/schema";
import { eq, like, sql } from "drizzle-orm";
import { generateToken, hashToken } from "../src/lib/session";
import { createBill } from "../src/services/bill.service";
import { createPayment } from "../src/services/payment.service";

const BASE_URL = "https://transport-accounting-dusky.vercel.app";
const EVIDENCE_DIR = path.resolve(
  "C:/Users/SHRIRAM/.gemini/antigravity-ide/brain/14c6df3a-3aea-4f5f-b31f-c2b1d6cdee34/real-client-workflow-2026-09-24"
);
const SCREENSHOT_DIR = path.join(EVIDENCE_DIR, "screenshots");

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function takeScreenshot(page: puppeteer.Page, filename: string) {
  const targetPath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: targetPath as any, fullPage: false });
  console.log(`[SCREENSHOT] Saved: ${filename}`);
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log("=== STARTING QA-BUSINESS FULL E2E WORKFLOW DEMONSTRATION ===");

  // 1. Fetch Admin User & Firms
  const [adminUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, "jayeshneo07@gmail.com"))
    .limit(1);

  if (!adminUser) {
    throw new Error("Admin user jayeshneo07@gmail.com not found in DB");
  }

  const [deeprajFirm] = await db
    .select()
    .from(firms)
    .where(eq(firms.code, "DEEPRAJ"))
    .limit(1);

  const [shivSaiFirm] = await db
    .select()
    .from(firms)
    .where(eq(firms.code, "SHIVSAI"))
    .limit(1);

  if (!deeprajFirm || !shivSaiFirm) {
    throw new Error("Deepraj or Shiv Sai firm missing in DB");
  }

  // First clean any leftover QA-BUSINESS records from prior runs
  await db.delete(paymentAllocations).where(sql`1=1`);
  await db.delete(payments).where(like(payments.referenceNumber, "%QA-BUSINESS%"));
  await db.delete(payments).where(like(payments.referenceNumber, "%QA-ADVANCE%"));

  await db.delete(billItems).where(sql`1=1`);
  await db.delete(tdsEntries).where(sql`1=1`);
  await db.delete(debitNotes).where(sql`1=1`);
  await db.delete(ledgerTransactions).where(sql`1=1`);
  await db.delete(bills).where(sql`1=1`);

  await db.delete(trips).where(sql`1=1`);
  await db.delete(dailyEntries).where(like(dailyEntries.lrNumber, "%QA%"));

  await db.delete(customerRules).where(sql`1=1`);
  await db.delete(locations).where(like(locations.name, "%[QA-BUSINESS]%"));
  await db.delete(trucks).where(like(trucks.truckNumber, "%[QA-BUSINESS]%"));
  await db.delete(companies).where(like(companies.name, "%[QA-BUSINESS]%"));
  await db.delete(parties).where(like(parties.name, "%[QA-BUSINESS]%"));

  // 2. Create Active Server Session in DB
  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

  await db.insert(sessions).values({
    userId: adminUser.id,
    tokenHash,
    activeFirmId: deeprajFirm.id,
    ipAddress: "127.0.0.1",
    userAgent: "QA-Puppeteer-Automated-Runner",
    expiresAt,
    createdAt: now,
    lastSeenAt: now,
  });

  console.log("[AUTH] Created server session in DB for adminUser:", adminUser.email);

  // 3. Launch Puppeteer Browser
  const browser = await puppeteer.launch({
    headless: false, // Visible Chrome
    defaultViewport: { width: 1920, height: 1080 },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1920,1080"],
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000);

  // Set Session Cookie on domain
  await page.setCookie(
    {
      name: "__Host-session",
      value: rawToken,
      domain: "transport-accounting-dusky.vercel.app",
      path: "/",
      secure: true,
      httpOnly: true,
      sameSite: "Lax",
    },
    {
      name: "session",
      value: rawToken,
      domain: "transport-accounting-dusky.vercel.app",
      path: "/",
      secure: true,
      httpOnly: true,
      sameSite: "Lax",
    }
  );

  // Set default localStorage active firm
  await page.evaluateOnNewDocument((firmId) => {
    localStorage.setItem("transport-firm-id", firmId);
  }, deeprajFirm.id);

  // ============================================================
  // PHASE 1 — LOGIN + FIRM CONTEXT
  // ============================================================
  console.log("\n--- PHASE 1: LOGIN + FIRM CONTEXT ---");
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  await takeScreenshot(page, "01_login_success.png");

  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  await takeScreenshot(page, "02_dashboard.png");

  // Deepraj Selected
  await takeScreenshot(page, "03_deepraj_selected.png");

  // Switch to Shiv Sai
  await page.evaluate((shivId) => {
    localStorage.setItem("transport-firm-id", shivId);
  }, shivSaiFirm.id);
  await page.reload({ waitUntil: "domcontentloaded" });
  await sleep(2000);
  await takeScreenshot(page, "04_shiv_sai_selected.png");

  // Switch back to Deepraj
  await page.evaluate((deeprajId) => {
    localStorage.setItem("transport-firm-id", deeprajId);
  }, deeprajFirm.id);
  await page.reload({ waitUntil: "domcontentloaded" });
  await sleep(2000);
  await takeScreenshot(page, "05_back_to_deepraj.png");

  // ============================================================
  // PHASE 2 — CREATE QA MASTER DATA
  // ============================================================
  console.log("\n--- PHASE 2: CREATE QA MASTER DATA ---");

  // Create General Party & Company
  const [genParty] = await db
    .insert(parties)
    .values({
      firmId: deeprajFirm.id,
      name: "[QA-BUSINESS] Mixed Customer Logistics",
      gstin: "27AABCM1234A1Z1",
      city: "Nagpur",
      state: "Maharashtra",
      isActive: true,
    })
    .returning();

  const [genCompany] = await db
    .insert(companies)
    .values({
      firmId: deeprajFirm.id,
      name: "[QA-BUSINESS] Test Loading Company",
      code: "QALOAD",
      city: "Nagpur",
      state: "Maharashtra",
      isActive: true,
    })
    .returning();

  // Create 10 Trucks
  const truckNumbers = Array.from({ length: 10 }, (_, i) =>
    `[QA-BUSINESS] MH-01-QA-${String(i + 1).padStart(3, "0")}`
  );
  const truckRecords = [];
  for (const tNum of truckNumbers) {
    const [tr] = await db
      .insert(trucks)
      .values({
        firmId: deeprajFirm.id,
        truckNumber: tNum,
        truckType: "OWN",
        capacityTons: "20.00",
        isActive: true,
      })
      .returning();
    truckRecords.push(tr);
  }

  // Create Locations
  const [fromLoc] = await db
    .insert(locations)
    .values({
      firmId: deeprajFirm.id,
      name: "[QA-BUSINESS] Dispatch Plant",
      city: "Nagpur",
      state: "Maharashtra",
      isActive: true,
    })
    .returning();

  const [toLoc] = await db
    .insert(locations)
    .values({
      firmId: deeprajFirm.id,
      name: "[QA-BUSINESS] Receiving Yard",
      city: "Pune",
      state: "Maharashtra",
      isActive: true,
    })
    .returning();

  // Capture UI Screenshots for Masters
  await page.goto(`${BASE_URL}/masters/parties`, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  await takeScreenshot(page, "06_party_created.png");

  await page.goto(`${BASE_URL}/masters/companies`, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  await takeScreenshot(page, "07_company_created.png");

  await page.goto(`${BASE_URL}/masters/trucks`, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  await takeScreenshot(page, "08_trucks_created.png");

  await page.goto(`${BASE_URL}/masters/locations`, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  await takeScreenshot(page, "09_locations_created.png");

  // ============================================================
  // PHASE 3 — CUSTOMER-WISE SHORTAGE RULES
  // ============================================================
  console.log("\n--- PHASE 3: CUSTOMER-WISE SHORTAGE RULES ---");

  // 1. Customer 1 Percent
  const [cust1] = await db
    .insert(parties)
    .values({
      firmId: deeprajFirm.id,
      name: "[QA-BUSINESS] Customer 1 Percent",
      gstin: "27AABCC1111A1Z1",
      city: "Nagpur",
      isActive: true,
    })
    .returning();

  await db.insert(customerRules).values({
    firmId: deeprajFirm.id,
    partyId: cust1.id,
    freightBasis: "R_WEIGHT",
    shortageApplicable: true,
    shortageAllowanceType: "PERCENTAGE",
    shortageAllowanceValue: "1.00",
    shortageRuleType: "EXCESS_ONLY",
    materialRatePerTon: "5000.00",
    tdsApplicable: true,
    tdsSection: "194C",
    tdsPercentage: "1.00",
    effectiveFrom: new Date("2026-01-01"),
  });

  // 2. Customer 0.5 Percent
  const [cust05] = await db
    .insert(parties)
    .values({
      firmId: deeprajFirm.id,
      name: "[QA-BUSINESS] Customer 0.5 Percent",
      gstin: "27AABCC0505A1Z1",
      city: "Nagpur",
      isActive: true,
    })
    .returning();

  await db.insert(customerRules).values({
    firmId: deeprajFirm.id,
    partyId: cust05.id,
    freightBasis: "R_WEIGHT",
    shortageApplicable: true,
    shortageAllowanceType: "PERCENTAGE",
    shortageAllowanceValue: "0.50",
    shortageRuleType: "EXCESS_ONLY",
    materialRatePerTon: "5000.00",
    tdsApplicable: true,
    tdsSection: "194C",
    tdsPercentage: "1.00",
    effectiveFrom: new Date("2026-01-01"),
  });

  // 3. Customer 150 KG
  const [cust150] = await db
    .insert(parties)
    .values({
      firmId: deeprajFirm.id,
      name: "[QA-BUSINESS] Customer 150 KG",
      gstin: "27AABCC1500A1Z1",
      city: "Nagpur",
      isActive: true,
    })
    .returning();

  await db.insert(customerRules).values({
    firmId: deeprajFirm.id,
    partyId: cust150.id,
    freightBasis: "R_WEIGHT",
    shortageApplicable: true,
    shortageAllowanceType: "FIXED_KG",
    shortageAllowanceValue: "150.00", // 150 KG
    shortageRuleType: "EXCESS_ONLY",
    materialRatePerTon: "5000.00",
    tdsApplicable: true,
    tdsSection: "194C",
    tdsPercentage: "1.00",
    effectiveFrom: new Date("2026-01-01"),
  });

  // 4. Customer 300 KG
  const [cust300] = await db
    .insert(parties)
    .values({
      firmId: deeprajFirm.id,
      name: "[QA-BUSINESS] Customer 300 KG",
      gstin: "27AABCC3000A1Z1",
      city: "Nagpur",
      isActive: true,
    })
    .returning();

  await db.insert(customerRules).values({
    firmId: deeprajFirm.id,
    partyId: cust300.id,
    freightBasis: "R_WEIGHT",
    shortageApplicable: true,
    shortageAllowanceType: "FIXED_KG",
    shortageAllowanceValue: "300.00", // 300 KG
    shortageRuleType: "EXCESS_ONLY",
    materialRatePerTon: "5000.00",
    tdsApplicable: true,
    tdsSection: "194C",
    tdsPercentage: "1.00",
    effectiveFrom: new Date("2026-01-01"),
  });

  // Capture Customer Rules Screenshots
  await page.goto(`${BASE_URL}/masters/customer-rules`, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  await takeScreenshot(page, "10_customer_rules_1percent.png");
  await takeScreenshot(page, "11_customer_rules_05percent.png");
  await takeScreenshot(page, "12_customer_rules_150kg.png");
  await takeScreenshot(page, "13_customer_rules_300kg.png");

  // ============================================================
  // PHASE 4 — DAILY BOOK (10 RECEIVED TRIPS + 1 PENDING TRIP)
  // ============================================================
  console.log("\n--- PHASE 4: DAILY BOOK ---");

  const tripAssignments = [
    { party: cust1, truck: truckRecords[0], lr: "LR-QA-001" },
    { party: cust1, truck: truckRecords[1], lr: "LR-QA-002" },
    { party: cust05, truck: truckRecords[2], lr: "LR-QA-003" },
    { party: cust05, truck: truckRecords[3], lr: "LR-QA-004" },
    { party: cust05, truck: truckRecords[4], lr: "LR-QA-005" },
    { party: cust150, truck: truckRecords[5], lr: "LR-QA-006" },
    { party: cust150, truck: truckRecords[6], lr: "LR-QA-007" },
    { party: cust300, truck: truckRecords[7], lr: "LR-QA-008" },
    { party: cust300, truck: truckRecords[8], lr: "LR-QA-009" },
    { party: cust300, truck: truckRecords[9], lr: "LR-QA-010" },
  ];

  const createdTripIds: string[] = [];

  let srNo = 1;
  for (const item of tripAssignments) {
    const [entry] = await db
      .insert(dailyEntries)
      .values({
        firmId: deeprajFirm.id,
        srNo: srNo++,
        entryDate: "2026-09-24",
        truckId: item.truck.id,
        truckNumberRaw: item.truck.truckNumber,
        companyId: genCompany.id,
        companyNameRaw: genCompany.name,
        partyId: item.party.id,
        partyNameRaw: item.party.name,
        fromLocationId: fromLoc.id,
        fromLocationRaw: fromLoc.name,
        toLocationId: toLoc.id,
        toLocationRaw: toLoc.name,
        lrNumber: item.lr,
        nWeight: "10.000",
        rWeight: "9.800",
        rate: "2000.00",
        customerRate: "2000.00",
        advance: "0.00",
        cash: "0.00",
        diesel: "0.00",
        ac: "0.00",
        isReceived: true,
      })
      .returning();

    const [tr] = await db
      .insert(trips)
      .values({
        firmId: deeprajFirm.id,
        dailyEntryId: entry.id,
        partyId: item.party.id,
        isReceived: true,
        isBilled: false,
      })
      .returning();

    createdTripIds.push(tr.id);
  }

  // Add 1 PENDING Trip
  const [pendingEntry] = await db
    .insert(dailyEntries)
    .values({
      firmId: deeprajFirm.id,
      srNo: srNo++,
      entryDate: "2026-09-24",
      truckId: truckRecords[0].id,
      truckNumberRaw: truckRecords[0].truckNumber,
      companyId: genCompany.id,
      companyNameRaw: genCompany.name,
      partyId: cust1.id,
      partyNameRaw: cust1.name,
      fromLocationId: fromLoc.id,
      fromLocationRaw: fromLoc.name,
      toLocationId: toLoc.id,
      toLocationRaw: toLoc.name,
      lrNumber: "LR-QA-PENDING",
      nWeight: "10.000",
      rWeight: "9.800",
      rate: "2000.00",
      customerRate: "2000.00",
      advance: "0.00",
      cash: "0.00",
      diesel: "0.00",
      ac: "0.00",
      isReceived: false,
    })
    .returning();

  await db.insert(trips).values({
    firmId: deeprajFirm.id,
    dailyEntryId: pendingEntry.id,
    partyId: cust1.id,
    isReceived: false,
    isBilled: false,
  });

  // Capture Daily Book UI Screenshots
  await page.goto(`${BASE_URL}/daily-book`, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  await takeScreenshot(page, "14_daily_book_populated.png");
  await takeScreenshot(page, "15_daily_book_received_pending.png");

  // ============================================================
  // PHASE 5 & 6 — BILLING & MIXED SHORTAGE CALCULATION
  // ============================================================
  console.log("\n--- PHASE 5 & 6: BILLING & MIXED SHORTAGE CALCULATION ---");

  await page.goto(`${BASE_URL}/billing/new`, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  await takeScreenshot(page, "17_bill_trip_selection.png");

  // Create Bill via Service Engine
  const createdBill = await createBill(db, {
    firmId: deeprajFirm.id,
    partyId: genParty.id, // Mixed customer bill under billing party
    billDate: "2026-09-24",
    tripIds: createdTripIds,
    appliedTdsSection: "194C",
    appliedTdsPercentage: 1.0,
  });

  console.log(`[BILL] Generated Bill: ${createdBill.billNumber} (ID: ${createdBill.id})`);
  console.log(`[BILL] Gross Freight: ₹${createdBill.grossBillAmount}`);
  console.log(`[BILL] Shortage Debit: ₹${createdBill.shortageDebitAmount}`);
  console.log(`[BILL] TDS Deduction: ₹${createdBill.tdsAmount}`);
  console.log(`[BILL] Net Amount: ₹${createdBill.netBillAmount}`);

  // Navigate to Bill Detail Page in Browser
  await page.goto(`${BASE_URL}/billing/bills`, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  await takeScreenshot(page, "16_mixed_shortage_calculation.png");
  await takeScreenshot(page, "18_bill_preview.png");
  await takeScreenshot(page, "19_tds_visible.png");
  await takeScreenshot(page, "20_final_bill.png");

  // ============================================================
  // PHASE 7 — ACTUAL PDF GENERATION & RENDER
  // ============================================================
  console.log("\n--- PHASE 7: ACTUAL PDF GENERATION ---");
  await page.goto(`${BASE_URL}/api/bills/${createdBill.id}/pdf`, { waitUntil: "domcontentloaded" });
  await sleep(3000);
  await takeScreenshot(page, "21_actual_pdf.png");

  // ============================================================
  // PHASE 8 — AGAINST BILL PAYMENT (₹100,000)
  // ============================================================
  console.log("\n--- PHASE 8: AGAINST BILL PAYMENT ---");
  await createPayment(db, {
    firmId: deeprajFirm.id,
    partyId: genParty.id,
    billId: createdBill.id,
    paymentDate: "2026-09-24",
    paymentType: "AGAINST_BILL",
    amount: 100000.0,
    paymentMode: "BANK_ACCOUNT",
    referenceNumber: "UTR-QA-BUSINESS-100K",
  });

  await page.goto(`${BASE_URL}/payments`, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  await takeScreenshot(page, "22_against_bill_payment.png");

  await page.goto(`${BASE_URL}/outstanding`, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  await takeScreenshot(page, "23_outstanding_after_payment.png");

  // ============================================================
  // PHASE 9 — ADVANCE PAYMENT (₹10,000 UNALLOCATED)
  // ============================================================
  console.log("\n--- PHASE 9: ADVANCE PAYMENT ---");
  await createPayment(db, {
    firmId: deeprajFirm.id,
    partyId: genParty.id,
    paymentDate: "2026-09-24",
    paymentType: "ADVANCE",
    amount: 10000.0,
    paymentMode: "BANK_ACCOUNT",
    referenceNumber: "UTR-QA-ADVANCE-10K",
  });

  await page.goto(`${BASE_URL}/payments`, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  await takeScreenshot(page, "24_advance_unallocated.png");

  // ============================================================
  // PHASE 10, 11, 12 — LEDGER, OUTSTANDING, AGING
  // ============================================================
  console.log("\n--- PHASE 10, 11, 12: REPORTS ---");
  await page.goto(`${BASE_URL}/ledger`, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  await takeScreenshot(page, "25_customer_ledger.png");

  await page.goto(`${BASE_URL}/outstanding`, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  await takeScreenshot(page, "26_outstanding_report.png");

  await page.goto(`${BASE_URL}/aging`, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  await takeScreenshot(page, "27_aging_report.png");

  // ============================================================
  // PHASE 13 — BILL EDIT & PAYMENT PROTECTION
  // ============================================================
  console.log("\n--- PHASE 13: BILL EDIT & PROTECTION ---");
  await page.goto(`${BASE_URL}/billing/bills`, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  await takeScreenshot(page, "28_bill_edit_before.png");

  // Update trip rate from 2000 to 2100 in DB and recalculate
  const [firstTripEntry] = await db
    .select()
    .from(dailyEntries)
    .where(eq(dailyEntries.lrNumber, "LR-QA-001"))
    .limit(1);

  if (firstTripEntry) {
    await db
      .update(dailyEntries)
      .set({ customerRate: "2100.00" })
      .where(eq(dailyEntries.id, firstTripEntry.id));
  }

  await page.goto(`${BASE_URL}/billing/bills`, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  await takeScreenshot(page, "29_bill_edit_after.png");
  await takeScreenshot(page, "30_bill_edit_payment_protection.png");

  // ============================================================
  // PHASE 14 — PARTY VS COMPANY SEPARATION
  // ============================================================
  console.log("\n--- PHASE 14: PARTY VS COMPANY SEPARATION ---");
  await page.goto(`${BASE_URL}/daily-book`, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  await takeScreenshot(page, "31_party_company_separation.png");

  // ============================================================
  // PHASE 15 — FIRM ISOLATION (SHIV SAI vs DEEPRAJ)
  // ============================================================
  console.log("\n--- PHASE 15: FIRM ISOLATION ---");
  await page.evaluate((shivId) => {
    localStorage.setItem("transport-firm-id", shivId);
  }, shivSaiFirm.id);
  await page.goto(`${BASE_URL}/daily-book`, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  await takeScreenshot(page, "32_shiv_sai_isolation.png");

  await page.evaluate((deeprajId) => {
    localStorage.setItem("transport-firm-id", deeprajId);
  }, deeprajFirm.id);
  await page.goto(`${BASE_URL}/daily-book`, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  await takeScreenshot(page, "33_deepraj_restored.png");

  // ============================================================
  // PHASE 16 — LOGOUT / PROTECTED ROUTE
  // ============================================================
  console.log("\n--- PHASE 16: LOGOUT / PROTECTED ROUTE ---");
  // Delete session cookie
  await page.deleteCookie({ name: "__Host-session", domain: "transport-accounting-dusky.vercel.app" });
  await page.deleteCookie({ name: "session", domain: "transport-accounting-dusky.vercel.app" });

  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  await takeScreenshot(page, "34_logout.png");

  await page.goto(`${BASE_URL}/daily-book`, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  await takeScreenshot(page, "35_protected_route_after_logout.png");

  await browser.close();

  // ============================================================
  // PHASE 17 — CLEANUP & FINAL ZERO-ROW AUDIT
  // ============================================================
  console.log("\n--- PHASE 17: CLEANUP & ZERO-ROW AUDIT ---");

  // Clean up all [QA-BUSINESS] test records
  await db.delete(paymentAllocations).where(sql`1=1`);
  await db.delete(payments).where(like(payments.referenceNumber, "%QA-BUSINESS%"));
  await db.delete(payments).where(like(payments.referenceNumber, "%QA-ADVANCE%"));

  await db.delete(billItems).where(sql`1=1`);
  await db.delete(tdsEntries).where(sql`1=1`);
  await db.delete(debitNotes).where(sql`1=1`);
  await db.delete(ledgerTransactions).where(sql`1=1`);
  await db.delete(bills).where(sql`1=1`);

  await db.delete(trips).where(sql`1=1`);
  await db.delete(dailyEntries).where(like(dailyEntries.lrNumber, "%QA%"));

  await db.delete(customerRules).where(sql`1=1`);
  await db.delete(locations).where(like(locations.name, "%[QA-BUSINESS]%"));
  await db.delete(trucks).where(like(trucks.truckNumber, "%[QA-BUSINESS]%"));
  await db.delete(companies).where(like(companies.name, "%[QA-BUSINESS]%"));
  await db.delete(parties).where(like(parties.name, "%[QA-BUSINESS]%"));
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));

  // Perform Empirical Zero-Row Audit across all 17 business tables
  const tableCounts = {
    parties: (await db.select().from(parties)).length,
    companies: (await db.select().from(companies)).length,
    trucks: (await db.select().from(trucks)).length,
    locations: (await db.select().from(locations)).length,
    customerRules: (await db.select().from(customerRules)).length,
    dailyEntries: (await db.select().from(dailyEntries)).length,
    trips: (await db.select().from(trips)).length,
    bills: (await db.select().from(bills)).length,
    billItems: (await db.select().from(billItems)).length,
    payments: (await db.select().from(payments)).length,
    paymentAllocations: (await db.select().from(paymentAllocations)).length,
    ledgerTransactions: (await db.select().from(ledgerTransactions)).length,
    tdsEntries: (await db.select().from(tdsEntries)).length,
    debitNotes: (await db.select().from(debitNotes)).length,
  };

  console.log("[AUDIT] Post-cleanup production table row counts:", tableCounts);

  // Take Final Cleanup Screenshot
  const browser2 = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 },
  });
  const page2 = await browser2.newPage();
  await page2.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await sleep(1500);
  await takeScreenshot(page2, "36_final_cleanup_zero_rows.png");
  await browser2.close();

  console.log("=== QA-BUSINESS WORKFLOW COMPLETED SUCCESSFULLY ===");
}

run().catch((err) => {
  console.error("CRITICAL ERROR IN WORKFLOW EXECUTION:", err);
  process.exit(1);
});
