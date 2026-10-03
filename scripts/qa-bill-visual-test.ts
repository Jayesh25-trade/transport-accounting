import * as fs from "fs";
import * as path from "path";
import puppeteer from "puppeteer";
import { buildBillInvoiceHtml } from "../src/services/pdf.service";

const QA_DIR = path.join(process.cwd(), "ui-qa", "bill");
const BRAIN_DIR = "C:/Users/SHRIRAM/.gemini/antigravity-ide/brain/14c6df3a-3aea-4f5f-b31f-c2b1d6cdee34";

if (!fs.existsSync(QA_DIR)) {
  fs.mkdirSync(QA_DIR, { recursive: true });
}

// ─── Column Width Percentage Check (190mm Frame) ─────────────
const COLUMNS_MM = [
  { col: "Sr", mm: 7 },
  { col: "Date", mm: 19 },
  { col: "Truck", mm: 22 },
  { col: "LR no", mm: 15 },
  { col: "Route", mm: 30 },
  { col: "N-Wt (T)", mm: 14 },
  { col: "R-Wt (T)", mm: 14 },
  { col: "Rate", mm: 16 },
  { col: "Freight", mm: 21 },
  { col: "Short", mm: 12 },
  { col: "Balance", mm: 20 },
];

const TOTAL_FRAME_MM = 190;

function verifyGridMath() {
  const sumMm = COLUMNS_MM.reduce((acc, c) => acc + c.mm, 0);
  console.log(`Grid Column Width Sum (mm): ${sumMm}mm / ${TOTAL_FRAME_MM}mm`);
  if (Math.abs(sumMm - TOTAL_FRAME_MM) > 0.001) {
    throw new Error(`Grid width sum mismatch! Expected ${TOTAL_FRAME_MM}mm, got ${sumMm}mm`);
  }
}

// ─── Real Bill #3 Stored Data ─────────────────────────────────
const realBill3 = {
  id: "bill-3-id",
  billNumber: 3,
  billDate: "2026-10-02",
  dueDate: "2026-11-01",
  paymentTerms: "30 Days",
  placeOfSupply: "Maharashtra (27)",
  partyName: "Sample Traders Pvt. Ltd.",
  partyAddress: "Andheri East, Mumbai",
  partyGstin: "27AAAPA1234B1Z5",
  partyPhone: "98765 43210",
  subtotalFreight: 160000,
  debitNoteAmount: 3200,
  tdsAmount: 3200,
  driverVoucherTotal: 6600,
  netBillAmount: 150200,
  receivedAmount: 0,
  pendingAmount: 150200,
  totalNWeight: 40.000,
  totalRWeight: 40.000,
  appliedTdsPercentage: "2.00",
  termsAndConditions: "Payment to be made within 30 days. Subject to local jurisdiction.",
  notes: "Freight charges for October 2026 steel coil transportation batch.",
  displayOptionsSnapshot: {
    showBankDetails: true,
    showPaymentTerms: true,
    showDueDate: true,
    showAmountInWords: true,
    showRemarks: false,
    showTermsAndConditions: true,
    showAuthorisedSignature: true,
    showPlaceOfSupply: true,
  },
  bankDetailsSnapshot: {
    bankName: "Sample Bank",
    accountDisplayName: "DEEPRAJ TRANSPORT",
    accountNumber: "0000 0000 0000",
    ifscCode: "SAMP0000001",
  },
  items: [
    {
      id: "item-1",
      entryDate: "2026-10-02",
      truckNumber: "MH84AB1234",
      lrNumber: "LR-1001",
      fromLocation: "Mumbai Port",
      toLocation: "Pune Factory",
      nWeight: 40.000,
      rWeight: 40.000,
      rate: 4000.00,
      freight: 160000,
      shortageDebitAmount: 0,
      shortage: "NO",
    },
  ],
};

const realFirm = {
  name: "DEEPRAJ TRANSPORT",
  code: "DEEPRAJ",
  pan: "AQEPM2120M",
  phone: "+91 98250 12345",
  address: "Plot No. 42, Transport Nagar, Sector 10, Gandhidham",
  gstin: "24AQEPM2120M1Z5",
};

// Helper generator for stress test items
function generateMockItems(count: number) {
  const items = [];
  for (let i = 1; i <= count; i++) {
    const isShort = i % 4 === 0;
    const shortageAmt = isShort ? 1500 : 0;
    items.push({
      id: `stress-item-${i}`,
      entryDate: `2026-10-${(i % 28 + 1).toString().padStart(2, "0")}`,
      truckNumber: `MH46XY${(1000 + i).toString()}`,
      lrNumber: `LR-${5000 + i}`,
      fromLocation: `Origin Location Alpha ${i}`,
      toLocation: `Destination Hub Beta ${i}`,
      nWeight: 20.000 + i * 0.1,
      rWeight: 19.800 + i * 0.1,
      rate: 2500.00,
      freight: 50000.00,
      shortageDebitAmount: shortageAmt,
      shortage: isShort ? shortageAmt : "NO",
    });
  }
  return items;
}

async function renderPdfAndPng(
  html: string,
  filenamePrefix: string,
  browser: puppeteer.Browser
) {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "domcontentloaded" });

  // Automated Overflow Assertion Test
  const overflowCheck = await page.evaluate(() => {
    const frame = document.querySelector(".invoice-frame") as HTMLElement;
    if (!frame) return { hasFrame: false, overflow: false, scrollWidth: 0, clientWidth: 0 };
    return {
      hasFrame: true,
      overflow: frame.scrollWidth > frame.clientWidth + 1,
      scrollWidth: frame.scrollWidth,
      clientWidth: frame.clientWidth,
    };
  });

  if (overflowCheck.overflow) {
    throw new Error(
      `OVERFLOW DETECTED in ${filenamePrefix}! ScrollWidth (${overflowCheck.scrollWidth}px) exceeds ClientWidth (${overflowCheck.clientWidth}px)`
    );
  }

  const pdfPath = path.join(QA_DIR, `${filenamePrefix}.pdf`);
  const pdfUint8 = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: {
      top: "10mm",
      bottom: "14mm",
      left: "10mm",
      right: "10mm",
    },
    displayHeaderFooter: false,
  });

  fs.writeFileSync(pdfPath, Buffer.from(pdfUint8));
  console.log(`Saved PDF: ${pdfPath}`);

  // Screenshot page rendered
  await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });
  const pngPath = path.join(QA_DIR, `${filenamePrefix}.png`);
  await page.screenshot({ path: pngPath, fullPage: true });
  console.log(`Saved PNG: ${pngPath}`);

  if (fs.existsSync(BRAIN_DIR)) {
    fs.copyFileSync(pngPath, path.join(BRAIN_DIR, `${filenamePrefix}.png`));
  }

  await page.close();
}

async function renderModalScreenshot(
  html: string,
  width: number,
  filenamePrefix: string,
  browser: puppeteer.Browser
) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, deviceScaleFactor: 2 });

  const modalWrappedHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <style>
      body {
        margin: 0;
        padding: 24px;
        background-color: #F3F4F6;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .modal-dialog {
        max-width: 900px;
        margin: 0 auto;
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
        overflow: hidden;
        border: 1px solid #E5E7EB;
      }
      .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 20px;
        background: #ffffff;
        border-bottom: 1px solid #E5E7EB;
      }
      .modal-title {
        font-size: 15px;
        font-weight: 700;
        color: #111827;
      }
      .btn-group {
        display: flex;
        gap: 8px;
      }
      .btn {
        padding: 6px 14px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        text-decoration: none;
        border: 1px solid transparent;
      }
      .btn-secondary { background: #FFFFFF; border-color: #D1D5DB; color: #374151; }
      .btn-coral { background: #E05638; color: #FFFFFF; }
      .close-x { font-size: 18px; color: #6B7280; margin-left: 12px; cursor: pointer; }
      .modal-body {
        background-color: #F3F4F6;
        padding: 24px;
        max-height: 80vh;
        overflow-y: auto;
      }
    </style>
  </head>
  <body>
    <div class="modal-dialog">
      <div class="modal-header">
        <div class="modal-title">Bill #3 · Sample Traders Pvt. Ltd.</div>
        <div style="display:flex; align-items:center;">
          <div class="btn-group">
            <span class="btn btn-secondary">Download PDF</span>
            <span class="btn btn-coral">Print</span>
          </div>
          <span class="close-x">✕</span>
        </div>
      </div>
      <div class="modal-body">
        ${html}
      </div>
    </div>
  </body>
  </html>
  `;

  await page.setContent(modalWrappedHtml, { waitUntil: "domcontentloaded" });

  const pngPath = path.join(QA_DIR, `${filenamePrefix}.png`);
  await page.screenshot({ path: pngPath, fullPage: true });
  console.log(`Saved Modal Screenshot: ${pngPath}`);

  if (fs.existsSync(BRAIN_DIR)) {
    fs.copyFileSync(pngPath, path.join(BRAIN_DIR, `${filenamePrefix}.png`));
  }

  await page.close();
}

async function main() {
  console.log("Starting Tally/BUSY Bill Visual & Overflow QA...");
  verifyGridMath();

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    // 1. Render Real Bill #3
    console.log("Rendering Real Bill #3 (Tally Style)...");
    const bill3Html = buildBillInvoiceHtml(realBill3, realFirm);
    await renderPdfAndPng(bill3Html, "Bill_3_Real_Verification", browser);

    // 2. Stress Test Case A: 1 Trip Row
    console.log("Rendering Stress Test 1 Row...");
    const test1Html = buildBillInvoiceHtml(
      { ...realBill3, items: generateMockItems(1) },
      realFirm
    );
    await renderPdfAndPng(test1Html, "Stress_Test_1_Row", browser);

    // 3. Stress Test Case B: 8 Trip Rows
    console.log("Rendering Stress Test 8 Rows...");
    const test8Html = buildBillInvoiceHtml(
      { ...realBill3, items: generateMockItems(8) },
      realFirm
    );
    await renderPdfAndPng(test8Html, "Stress_Test_8_Rows", browser);

    // 4. Stress Test Case C: 25 Trip Rows
    console.log("Rendering Stress Test 25 Rows...");
    const test25Html = buildBillInvoiceHtml(
      { ...realBill3, items: generateMockItems(25) },
      realFirm
    );
    await renderPdfAndPng(test25Html, "Stress_Test_25_Rows", browser);

    // 5. Stress Test Case D: 60 Trip Rows (Multi-page document test)
    console.log("Rendering Stress Test 60 Rows (Multi Page)...");
    const test60Html = buildBillInvoiceHtml(
      { ...realBill3, items: generateMockItems(60) },
      realFirm
    );
    await renderPdfAndPng(test60Html, "Stress_Test_60_Rows_Multipage", browser);

    // 6. Stress Test Case E: All Toggles OFF
    console.log("Rendering Stress Test All Toggles OFF...");
    const testOffHtml = buildBillInvoiceHtml(
      {
        ...realBill3,
        displayOptionsSnapshot: {
          showBankDetails: false,
          showPaymentTerms: false,
          showDueDate: false,
          showAmountInWords: false,
          showRemarks: false,
          showTermsAndConditions: false,
          showAuthorisedSignature: false,
          showPlaceOfSupply: false,
        },
      },
      realFirm
    );
    await renderPdfAndPng(testOffHtml, "Stress_Test_Toggles_OFF", browser);

    // 7. Stress Test Case F: 12-Digit Freight & Long Strings
    console.log("Rendering Stress Test 12-Digit Amounts & Long Strings...");
    const testLongHtml = buildBillInvoiceHtml(
      {
        ...realBill3,
        partyName: "Shree Ganesh International Freight Forwarding & Logistics Private Limited Corporation",
        partyAddress: "Plot No. 42-45, Industrial Logistics & Freight Corridor Complex, Near Kalamboli Steel Yard, Navi Mumbai, District Thane, Maharashtra - 410218, India",
        subtotalFreight: 99999999999.99,
        netBillAmount: 99999999999.99,
        items: [
          {
            id: "long-item-1",
            entryDate: "2026-10-02",
            truckNumber: "MH46AR1234",
            lrNumber: "LR-99998888",
            fromLocation: "Visakhapatnam Steel Plant Yard No 4, Andhra Pradesh",
            toLocation: "Industrial Development Corporation Complex, Chakan Phase 2, Pune, Maharashtra",
            nWeight: 35.123,
            rWeight: 34.987,
            rate: 4200.50,
            freight: 99999999999.99,
            shortageDebitAmount: 2500,
          },
        ],
      },
      realFirm
    );
    await renderPdfAndPng(testLongHtml, "Stress_Test_12Digit_Amounts", browser);

    // 8. Modal Screenshots at 1440px, 1024px, 390px
    console.log("Rendering Modal Preview Screenshots...");
    await renderModalScreenshot(bill3Html, 1440, "modal_preview_1440px", browser);
    await renderModalScreenshot(bill3Html, 1024, "modal_preview_1024px", browser);
    await renderModalScreenshot(bill3Html, 390, "modal_preview_390px", browser);

    console.log("All visual QA assets successfully generated in /ui-qa/bill/");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Error running visual QA script:", err);
  process.exit(1);
});
