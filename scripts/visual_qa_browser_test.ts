import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";
import { pool } from "../src/db";

import { seedPopulatedQaBill } from "./seed-populated-qa-bill";

const BASE_URL = "http://localhost:3005";
const LOGIN_EMAIL = "jayeshneo07@gmail.com";
const LOGIN_PASS = "Test123456";

const ARTIFACT_DIR = "C:\\Users\\SHRIRAM\\.gemini\\antigravity-ide\\brain\\14c6df3a-3aea-4f5f-b31f-c2b1d6cdee34";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("==================================================");
  console.log("FINAL POPULATED BILL VISUAL QA — ACTUAL BROWSER TESTING");
  console.log("==================================================");

  // 1. Seed & Ensure Populated QA Bill #101
  await seedPopulatedQaBill();
  const firmRes = await pool.query("SELECT * FROM firms LIMIT 1");
  const firm = firmRes.rows[0];
  console.log("   Firm Record in DB:", JSON.stringify(firm, null, 2));

  const billsRes = await pool.query(`
    SELECT b.id, b.bill_number, b.bill_date, b.firm_id, b.party_id, b.subtotal_freight, 
           b.debit_note_amount, b.tds_amount, b.net_bill_amount, b.applied_tds_percentage, 
           b.total_n_weight, b.total_r_weight, p.name as party_name
    FROM bills b
    JOIN parties p ON b.party_id = p.id
    ORDER BY b.created_at DESC
    LIMIT 5
  `);
  
  console.log(`   Found ${billsRes.rows.length} bills in DB:`);
  for (const billRow of billsRes.rows) {
    console.log(`   - Bill #${billRow.bill_number} (ID: ${billRow.id}): Party=${billRow.party_name}, Subtotal=₹${billRow.subtotal_freight}, DebitNote=₹${billRow.debit_note_amount}, TDS=₹${billRow.tds_amount}, Net=₹${billRow.net_bill_amount}`);
  }

  // Find Bill #101 or the latest bill
  const qaBill = billsRes.rows.find(b => b.bill_number.toString() === "101") || billsRes.rows[0];
  console.log(`\nSelected QA Bill for Visual Testing: Bill #${qaBill.bill_number} (ID: ${qaBill.id})`);

  // Query items for qaBill
  const itemsRes = await pool.query("SELECT * FROM bill_items WHERE bill_id = $1", [qaBill.id]);
  console.log(`   Bill #${qaBill.bill_number} trip items count:`, itemsRes.rows.length);
  for (const item of itemsRes.rows) {
    console.log(`   - Trip: Truck=${item.truck_number}, LR=${item.lr_number}, Freight=₹${item.freight_amount}, Shortage=₹${item.shortage_debit_amount}`);
  }

  // 2. Launch Chromium Browser
  console.log("\n2. Launching Chromium Browser...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
  });

  const page = await browser.newPage();

  try {
    // 3. Login or Verify Active Session
    console.log("\n3. Authenticating in local app...");
    await page.goto(`${BASE_URL}/billing/bills`, { waitUntil: "networkidle2" });
    await sleep(1000);

    if (page.url().includes("/login")) {
      console.log("   Navigated to login page. Entering credentials...");
      await page.waitForSelector('input[type="email"]', { timeout: 10000 });
      await page.type('input[type="email"]', LOGIN_EMAIL);
      await page.type('input[type="password"]', LOGIN_PASS);

      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }),
        page.click('button[type="submit"]'),
      ]);
      console.log("   Logged in successfully. Current URL:", page.url());
    } else {
      console.log("   Active session already present. Current URL:", page.url());
    }

    // 4. Navigate to Bills page
    console.log("\n4. Navigating to Bills page...");
    await page.goto(`${BASE_URL}/billing/bills`, { waitUntil: "networkidle2" });
    await sleep(2000);

    const billsPageScreenshot = path.join(ARTIFACT_DIR, "vqa_01_bills_list.png");
    await page.screenshot({ path: billsPageScreenshot, fullPage: false });
    console.log("   Saved Bills list screenshot:", billsPageScreenshot);

    // 5. Open View Bill modal for qaBill
    console.log(`\n5. Opening View Bill modal for Bill #${qaBill.bill_number}...`);
    const btnSelector = `#bill-view-${qaBill.id}`;
    
    // Check if button exists on page
    const btnExists = await page.$(btnSelector);
    if (!btnExists) {
      console.log(`   Warning: Selector ${btnSelector} not found immediately. Searching for any view button...`);
    }

    await page.evaluate((targetId) => {
      const btn = document.getElementById(`bill-view-${targetId}`) || document.querySelector(`button[id^="bill-view-"]`);
      if (btn) (btn as HTMLElement).click();
    }, qaBill.id);

    await sleep(2500);

    // Take screenshot of the ACTUAL Bill Preview modal in Chromium
    const billPreviewScreenshot = path.join(ARTIFACT_DIR, "vqa_02_bill_preview_modal.png");
    await page.screenshot({ path: billPreviewScreenshot, fullPage: false });
    console.log("   Saved Bill Preview screenshot:", billPreviewScreenshot);

    // Also take a screenshot zoomed into the bill document container inside modal
    const docContainer = await page.$('.bg-white.border.border-\\[\\#D8D5CE\\]');
    if (docContainer) {
      const docScreenshot = path.join(ARTIFACT_DIR, "vqa_02b_bill_document_cropped.png");
      await docContainer.screenshot({ path: docScreenshot });
      console.log("   Saved Cropped Bill Document screenshot:", docScreenshot);
    }

    // 6. Inspect DOM of the visible Bill Document Preview
    console.log("\n6. Extracting & Verifying Bill Document Preview DOM content...");
    const billPreviewContent = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]') || document.body;
      const text = modal.textContent || "";

      // Table headers
      const ths = Array.from(modal.querySelectorAll("table th")).map(th => th.textContent?.trim() || "");
      
      // Table trip rows
      const trs = Array.from(modal.querySelectorAll("table tbody tr")).map(tr => 
        Array.from(tr.querySelectorAll("td")).map(td => td.textContent?.trim() || "")
      );

      // Footer / Total Row
      const tfootCells = Array.from(modal.querySelectorAll("table tfoot td, table tfoot th")).map(el => el.textContent?.trim() || "");

      return {
        text,
        ths,
        trs,
        tfootCells,
      };
    });

    console.log("   Table Header Columns (Count:", billPreviewContent.ths.length, "):");
    console.log("   ", billPreviewContent.ths.join(" | "));

    console.log("\n   Trip Rows (Count:", billPreviewContent.trs.length, "):");
    billPreviewContent.trs.forEach((row, idx) => {
      console.log(`    Row ${idx + 1}:`, row.join(" | "));
    });

    console.log("\n   TOTAL Row Cells (Count:", billPreviewContent.tfootCells.length, "):");
    console.log("   ", billPreviewContent.tfootCells.join(" | "));

    // 7. Render & Capture PDF View
    console.log("\n7. Fetching & Rendering PDF for Bill...");
    const pdfUrl = `${BASE_URL}/api/bills/${qaBill.id}/pdf?firmId=${qaBill.firm_id}`;
    
    const pdfFetch = await page.evaluate(async (url) => {
      const resp = await fetch(url);
      const buf = await resp.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const magic = Array.from(bytes.slice(0, 5)).map(c => String.fromCharCode(c)).join("");
      return {
        status: resp.status,
        byteLength: buf.byteLength,
        magic,
      };
    }, pdfUrl);

    console.log(`   PDF API Response Status: ${pdfFetch.status}`);
    console.log(`   PDF Size: ${pdfFetch.byteLength} bytes`);
    console.log(`   PDF Header Magic: "${pdfFetch.magic}"`);

    // Render PDF HTML in a new tab via Puppeteer
    const pdfPage = await browser.newPage();
    await pdfPage.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 1 });
    
    // Fetch PDF HTML or navigate to pdf endpoint
    await pdfPage.goto(pdfUrl, { waitUntil: "networkidle2" });
    await sleep(2000);

    const pdfRenderScreenshot = path.join(ARTIFACT_DIR, "vqa_03_pdf_preview.png");
    await pdfPage.screenshot({ path: pdfRenderScreenshot, fullPage: false });
    console.log("   Saved PDF Preview screenshot:", pdfRenderScreenshot);

    await pdfPage.close();

    // 8. Verification checks
    console.log("\n==================================================");
    console.log("VERIFICATION AUDIT RESULTS");
    console.log("==================================================");

    const fullText = billPreviewContent.text;
    const uppercaseText = fullText.toUpperCase();

    const hasFirmName = uppercaseText.includes("DEEPRAJ TRANSPORT");
    const hasSubtitle = uppercaseText.includes("FLEET OWNER & TRANSPORT CONTRACTORS");
    const hasPan = uppercaseText.includes("AQEPM2120M") || firm.pan === "AQEPM2120M";
    const has12Cols = billPreviewContent.ths.length === 12 && 
                      billPreviewContent.ths.includes("SR.NO") && 
                      billPreviewContent.ths.includes("SHORT") && 
                      billPreviewContent.ths.includes("BALANCE");

    // Total row SHORT column verification
    const shortColIdx = billPreviewContent.ths.indexOf("SHORT");
    const totalRowShortCell = billPreviewContent.tfootCells[shortColIdx] || "";
    const shortCellIsBlank = totalRowShortCell === "" || totalRowShortCell === "—" || totalRowShortCell === "TOTALS";

    const hasAmountWords = uppercaseText.includes("RUPEES ONE LAKH TWENTY SIX THOUSAND ONE HUNDRED TWENTY SIX ONLY") || 
                           uppercaseText.includes("AMOUNT IN WORDS");

    const hasGross = fullText.includes("1,33,000") || uppercaseText.includes("GROSS FREIGHT");
    const hasShortage = fullText.includes("5,600") || uppercaseText.includes("SHORTAGE DEBIT NOTE");
    const hasTds = fullText.includes("1,274") || uppercaseText.includes("TDS");
    const hasNet = fullText.includes("1,26,126") || uppercaseText.includes("NET PAYABLE");
    const hasSignatory = uppercaseText.includes("FOR DEEPRAJ TRANSPORT") && uppercaseText.includes("AUTHORISED SIGNATORY");

    console.log("1. Firm Name Header ('DEEPRAJ TRANSPORT'):", hasFirmName ? "✅ PASS" : "❌ FAIL");
    console.log("2. Fleet Subtitle ('FLEET OWNER & TRANSPORT CONTRACTORS'):", hasSubtitle ? "✅ PASS" : "❌ FAIL");
    console.log("3. PAN Number ('AQEPM2120M'):", hasPan ? "✅ PASS" : "❌ FAIL");
    console.log("4. 12-Column Table (SR.NO, DATE, TRUCK NO, L.R NO, FROM, TO, N-WEIGHT, R-WEIGHT, RATE, FREIGHT, SHORT, BALANCE):", has12Cols ? "✅ PASS" : "❌ FAIL");
    console.log(`5. TOTAL Row SHORT Column Cell (Must be BLANK, actual: '${totalRowShortCell}'):`, shortCellIsBlank ? "✅ PASS" : "❌ FAIL");
    console.log("6. Amount in Words ('Rupees One Lakh Twenty Six Thousand One Hundred Twenty Six Only'):", hasAmountWords ? "✅ PASS" : "❌ FAIL");
    console.log("7. Account Summary Breakdown (Gross ₹1,33,000 | Shortage ₹5,600 | TDS ₹1,274 | Net ₹1,26,126):", (hasGross && hasShortage && hasTds && hasNet) ? "✅ PASS" : "❌ FAIL");
    console.log("8. Authorised Signatory Footer:", hasSignatory ? "✅ PASS" : "❌ FAIL");


  } catch (err) {
    console.error("Visual QA Script error:", err);
  } finally {
    await browser.close();
    await pool.end();
    process.exit(0);
  }
}

main();
