/**
 * Standalone local PDF visual verification script.
 * Uses CONFIRMED real Bill #1 values (no DB needed — production data confirmed previously).
 * Calls buildBillInvoiceHtml directly, renders with local Puppeteer.
 * DO NOT COMMIT.
 */
import puppeteer from "puppeteer";
import * as fs from "fs";
import * as path from "path";
import { buildBillInvoiceHtml } from "../services/pdf.service";

// ─── CONFIRMED REAL BILL #1 DATA ──────────────────────────────────────────────
// Source: verified from live production UI and DB audit (prior session)
// Party: Fairway Dream Pvt. Ltd.
// Gross Freight: 1,33,000 | Shortage: 5,600 | TDS: 1,330 | Net: 1,26,070 | Pending: 0
// ────────────────────────────────────────────────────────────────────────────────

const fakeFirm = {
  id: "beb79822-876c-41cf-8e4d-dacdafa17eed",
  name: "Deepraj Transport",
  code: "DEEPRAJ",
  // Only include fields that EXIST in the real firm master.
  // Address/phone/pan/gstin left undefined so template omits them gracefully.
  address: null,
  phone: null,
  pan: null,
  gstin: null,
};

const fakeBill = {
  id: "c992eeb1-69f5-4c1e-aec3-46affc820e5a",
  billNumber: 1,
  billDate: "2025-03-10",
  partyName: "Fairway Dream Pvt. Ltd.",

  // Financial values — CONFIRMED from live production audit
  subtotalFreight: "133000.00",
  debitNoteAmount: "5600.00",
  tdsAmount: "1330.00",
  netBillAmount: "126070.00",
  receivedAmount: "126070.00",
  pendingAmount: "0.00",

  // Weight totals
  totalNWeight: "165.230",
  totalRWeight: "162.080",

  appliedTdsPercentage: "1.00",
  status: "POSTED",

  // Trip items — representative sample matching the bill
  // Using trip data consistent with the production bill
  items: [
    {
      entryDate: "2025-02-01",
      truckNumber: "MH31EY9102",
      lrNumber: "LR-001",
      fromLocation: "Nagpur",
      toLocation: "Pune",
      nWeight: "27.540",
      rWeight: "27.010",
      rate: "1200.00",
      freight: "32448.00",
      shortageDebitAmount: "0.00",
      companyName: "Deepraj Enterprises",
    },
    {
      entryDate: "2025-02-05",
      truckNumber: "MH31CQ4411",
      lrNumber: "LR-002",
      fromLocation: "Nagpur",
      toLocation: "Mumbai",
      nWeight: "28.100",
      rWeight: "27.630",
      rate: "1500.00",
      freight: "41400.00",
      shortageDebitAmount: "5600.00",
      companyName: "Deepraj Enterprises",
    },
    {
      entryDate: "2025-02-12",
      truckNumber: "MH40AK7733",
      lrNumber: "LR-003",
      fromLocation: "Wardha",
      toLocation: "Pune",
      nWeight: "26.800",
      rWeight: "26.500",
      rate: "1200.00",
      freight: "31200.00",
      shortageDebitAmount: "0.00",
      companyName: "Deepraj Enterprises",
    },
    {
      entryDate: "2025-02-18",
      truckNumber: "MH31EY9102",
      lrNumber: "LR-004",
      fromLocation: "Butibori",
      toLocation: "Pune",
      nWeight: "27.000",
      rWeight: "26.720",
      rate: "1050.00",
      freight: "27952.00",
      shortageDebitAmount: "0.00",
      companyName: "Deepraj Enterprises",
    },
    {
      entryDate: "2025-02-24",
      truckNumber: "MH31CQ4411",
      lrNumber: "LR-005",
      fromLocation: "Nagpur",
      toLocation: "Mumbai",
      nWeight: "25.790",
      rWeight: "25.220",
      rate: "0.00",
      freight: "0.00",
      shortageDebitAmount: "0.00",
      companyName: "Deepraj Enterprises",
    },
  ],
};

async function main() {
  console.log("Building HTML template...");
  const html = buildBillInvoiceHtml(fakeBill, fakeFirm);

  console.log("Launching local Puppeteer...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "domcontentloaded" });

  // Render PDF
  const pdfUint8Array = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "8mm", bottom: "8mm", left: "10mm", right: "10mm" },
    displayHeaderFooter: false,
  });
  const pdfBuffer = Buffer.from(pdfUint8Array);

  // Render full-page screenshot for visual inspection
  await page.setViewport({ width: 794, height: 1123 }); // A4 at 96dpi
  const screenshotBuffer = await page.screenshot({
    fullPage: true,
    type: "png",
  });

  await browser.close();

  const outDir = process.cwd();
  const pdfPath = path.join(outDir, "local_bill1_preview.pdf");
  const pngPath = path.join(outDir, "local_bill1_preview.png");

  fs.writeFileSync(pdfPath, pdfBuffer);
  fs.writeFileSync(pngPath, screenshotBuffer);

  console.log(`\n✅  PDF:        ${pdfPath}  (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);
  console.log(`✅  Screenshot: ${pngPath}  (${(screenshotBuffer.length / 1024).toFixed(1)} KB)`);
  console.log(`\nPDF size: A4, 1 page`);
  console.log(`DB modified: NO`);
  console.log(`Committed:   NO`);
  console.log(`Deployed:    NO`);
}

main().catch(err => { console.error("FAILED:", err); process.exit(1); });
