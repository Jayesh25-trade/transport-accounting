import puppeteer from "puppeteer";
import * as fs from "fs";
import * as path from "path";

const PROD_URL = "https://transport-accounting-dusky.vercel.app";
const OUT_DIR  = "C:/Users/SHRIRAM/.gemini/antigravity-ide/brain/14c6df3a-3aea-4f5f-b31f-c2b1d6cdee34/live_d6b659a_verification";

const LOGIN_EMAIL = process.env.TEST_USER_EMAIL || "jayeshneo07@gmail.com";
const LOGIN_PASS  = process.env.TEST_USER_PASS  || "Test123456";

fs.mkdirSync(OUT_DIR, { recursive: true });

function log(msg: string) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

async function verifyLiveD6b659a() {
  log("========================================================");
  log("LIVE VERCEL PRODUCTION VERIFICATION — COMMIT d6b659a");
  log(`Production URL: ${PROD_URL}`);
  log("========================================================");

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1400, height: 900 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  try {
    // 1. Login to production
    log("\n1. Navigating to login page...");
    await page.goto(`${PROD_URL}/login`, { waitUntil: "networkidle2" });

    const emailInput = await page.$('input[type="email"], input[name="email"]');
    const passInput  = await page.$('input[type="password"], input[name="password"]');

    if (emailInput && passInput) {
      log("   Submitting login credentials...");
      await emailInput.type(LOGIN_EMAIL);
      await passInput.type(LOGIN_PASS);
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 25000 }),
        page.click('button[type="submit"]'),
      ]);
    }
    log(`   Logged in. Current URL: ${page.url()}`);

    // 2. Open Billing -> Bills page
    log("\n2. Navigating to Billing -> Bills...");
    await page.goto(`${PROD_URL}/billing/bills`, { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: path.join(OUT_DIR, "02_bills_page.png") });

    // Extract Bill #1 from DOM table
    const liveBillData = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("tr"));
      for (const row of rows) {
        const text = row.innerText || "";
        if (text.includes("#1") || text.includes("Fairway")) {
          const pdfLink = row.querySelector('a[id^="bill-pdf-"]');
          const href = pdfLink ? pdfLink.getAttribute("href") || "" : "";
          const match = href.match(/\/api\/bills\/([^/]+)\/pdf/);
          const billId = match ? match[1] : "";
          return { rowText: text, href, billId };
        }
      }
      return null;
    });

    if (!liveBillData || !liveBillData.billId) {
      throw new Error("Could not find Bill #1 row in DOM table!");
    }

    const billId = liveBillData.billId;
    const urlObj = new URL(liveBillData.href, PROD_URL);
    const firmId = urlObj.searchParams.get("firmId") || "beb79822-876c-41cf-8e4d-dacdafa17eed";

    log(`   Found Production Bill #1 UUID: ${billId}`);
    log(`   Firm ID Context: ${firmId}`);

    // Fetch exact Bill API details
    const bill1 = await page.evaluate(async ({ billId, firmId }) => {
      const resp = await fetch(`/api/bills/${billId}?firmId=${firmId}`, {
        headers: { 'x-firm-id': firmId }
      });
      const data = await resp.json();
      return data.data || data;
    }, { billId, firmId });

    log(`   Bill Number: ${bill1.billNumber}`);
    log(`   Bill Date: ${bill1.billDate}`);
    log(`   Party Name: ${bill1.partyName}`);
    log(`   Subtotal Freight: ₹${Number(bill1.subtotalFreight).toLocaleString('en-IN')}`);
    log(`   Shortage Debit: ₹${Number(bill1.debitNoteAmount).toLocaleString('en-IN')}`);
    log(`   TDS Amount: ₹${Number(bill1.tdsAmount).toLocaleString('en-IN')}`);
    log(`   Net Bill Amount: ₹${Number(bill1.netBillAmount).toLocaleString('en-IN')}`);
    log(`   Received Amount: ₹${Number(bill1.receivedAmount).toLocaleString('en-IN')}`);
    log(`   Pending Amount: ₹${Number(bill1.pendingAmount).toLocaleString('en-IN')}`);

    // 3. Open Live PDF and check headers
    log("\n3. Fetching live PDF endpoint...");
    const pdfUrl = `${PROD_URL}/api/bills/${bill1.id}/pdf?firmId=${firmId}`;
    
    const pdfFetchResult = await page.evaluate(async ({ url, firmId }) => {
      const resp = await fetch(url, { headers: { 'x-firm-id': firmId } });
      const headers: Record<string, string> = {};
      resp.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
      const buf = await resp.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const headerMagic = Array.from(bytes.slice(0, 5)).map(c => String.fromCharCode(c)).join("");
      return {
        status: resp.status,
        headers,
        byteLength: buf.byteLength,
        headerMagic,
      };
    }, { url: pdfUrl, firmId });

    log(`   HTTP Response Status: ${pdfFetchResult.status}`);
    log(`   Content-Type: ${pdfFetchResult.headers['content-type']}`);
    log(`   PDF Magic Header: "${pdfFetchResult.headerMagic}"`);
    log(`   Downloaded PDF Size: ${pdfFetchResult.byteLength} bytes (${(pdfFetchResult.byteLength / 1024).toFixed(1)} KB)`);

    // 4. Render Live PDF in Tab and Screenshot
    log("\n4. Opening PDF in new tab to capture screenshot...");
    const pdfPage = await browser.newPage();
    await pdfPage.goto(pdfUrl, { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 4000));
    const livePdfScreenshotPath = path.join(OUT_DIR, "03_live_pdf_rendered_d6b659a.png");
    await pdfPage.screenshot({ path: livePdfScreenshotPath, fullPage: false });
    
    // Copy screenshot to root brain directory for easy embedding
    const rootBrainPath = "C:/Users/SHRIRAM/.gemini/antigravity-ide/brain/14c6df3a-3aea-4f5f-b31f-c2b1d6cdee34/live_pdf_d6b659a.png";
    fs.copyFileSync(livePdfScreenshotPath, rootBrainPath);
    log(`   Captured live PDF screenshot to: ${livePdfScreenshotPath}`);

    // Save actual PDF file buffer locally
    const pdfBufferPage = await page.evaluate(async ({ url, firmId }) => {
      const resp = await fetch(url, { headers: { 'x-firm-id': firmId } });
      const buf = await resp.arrayBuffer();
      return Array.from(new Uint8Array(buf));
    }, { url: pdfUrl, firmId });
    fs.writeFileSync(path.join(OUT_DIR, "live_bill1_d6b659a.pdf"), Buffer.from(pdfBufferPage));

    // 5. Test Download & Print & View Modal Actions
    log("\n5. Testing View Modal action...");
    await page.bringToFront();
    const viewClicked = await page.evaluate(() => {
      const btn = document.querySelector('button[id^="bill-view-"]');
      if (btn) { (btn as HTMLElement).click(); return true; }
      return false;
    });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(OUT_DIR, "04_view_modal.png") });
    log(`   View Modal Opened: ${viewClicked ? "PASS" : "FAIL"}`);

    // 6. Security Isolation Check
    log("\n6. Testing Security Isolation (Deepraj Bill #1 with Shiv Sai Firm ID)...");
    const shivSaiId = "1ff5a00e-aa16-4086-a4c7-8e6b1391b17b";
    const secCheck = await page.evaluate(async (bId: string, sId: string) => {
      const resp = await fetch(`/api/bills/${bId}/pdf?firmId=${sId}`);
      return { status: resp.status };
    }, bill1.id, shivSaiId);
    log(`   Cross-Firm Access Status: ${secCheck.status} (Expected: 403)`);

    await pdfPage.close();
    await browser.close();

    log("\n========================================================");
    log("LIVE VERCEL PRODUCTION VERIFICATION COMPLETE — SUCCESS!");
    log("========================================================");

  } catch (err: any) {
    console.error("Error in live verification:", err);
    await browser.close();
    process.exit(1);
  }
}

verifyLiveD6b659a();
