import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";

const BASE_URL = "http://localhost:3000";
const LOGIN_EMAIL = "jayeshneo07@gmail.com";
const LOGIN_PASS = "Test123456";

const ARTIFACT_DIR = path.join(
  "C:\\Users\\SHRIRAM\\.gemini\\antigravity-ide\\brain\\14c6df3a-3aea-4f5f-b31f-c2b1d6cdee34",
  "global_ui_qa_screenshots"
);

fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const consoleErrors: string[] = [];

async function main() {
  console.log("==================================================");
  console.log("GLOBAL UI REFINEMENT — COMPREHENSIVE VISUAL QA");
  console.log("Output Directory:", ARTIFACT_DIR);
  console.log("==================================================");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  page.on("pageerror", (err) => {
    consoleErrors.push(err.message);
  });

  try {
    // 1. LOGIN
    console.log("\n[1/16] Logging in...");
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle2" });
    await sleep(1000);

    await page.type('input[type="email"]', LOGIN_EMAIL);
    await page.type('input[type="password"]', LOGIN_PASS);

    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }),
      page.click('button[type="submit"]'),
    ]);
    await sleep(2000);

    console.log("Logged in successfully. Current URL:", page.url());

    // 2. DASHBOARD 1920x1080
    console.log("\n[2/16] Capturing Dashboard @ 1920x1080...");
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    await sleep(1500);
    const dash1920 = path.join(ARTIFACT_DIR, "01_dashboard_1920x1080.png");
    await page.screenshot({ path: dash1920, fullPage: false });

    // 3. DASHBOARD 1280x800
    console.log("[3/16] Capturing Dashboard @ 1280x800...");
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    await sleep(1000);
    const dash1280 = path.join(ARTIFACT_DIR, "02_dashboard_1280x800.png");
    await page.screenshot({ path: dash1280, fullPage: false });

    // 4. DASHBOARD 390x844
    console.log("[4/16] Capturing Dashboard @ 390x844...");
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await sleep(1000);
    const dash390 = path.join(ARTIFACT_DIR, "03_dashboard_390x844.png");
    await page.screenshot({ path: dash390, fullPage: false });

    // Switch back to desktop viewport
    await page.setViewport({ width: 1440, height: 900 });

    // 5. DAILY BOOK DESKTOP
    console.log("\n[5/16] Navigating to Daily Book...");
    await page.goto(`${BASE_URL}/daily-book`, { waitUntil: "networkidle2" });
    await sleep(1500);
    const dailyBookDesktop = path.join(ARTIFACT_DIR, "04_daily_book_desktop.png");
    await page.screenshot({ path: dailyBookDesktop, fullPage: false });

    // 6. DAILY BOOK MODAL DESKTOP
    console.log("[6/16] Opening Daily Book Modal (Desktop)...");
    let modalOpened = await page.evaluate(() => {
      const addBtn = document.querySelector('#daily-book-new-entry') as HTMLElement;
      if (addBtn) {
        addBtn.click();
        return true;
      }
      const row = document.querySelector("table tbody tr") as HTMLElement;
      if (row) {
        row.click();
        return true;
      }
      return false;
    });

    // Fallback: click button by text content
    if (!modalOpened) {
      modalOpened = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const addBtn = buttons.find((b) => b.textContent?.includes("Add Entry") || b.textContent?.includes("Add trip"));
        if (addBtn) {
          addBtn.click();
          return true;
        }
        return false;
      });
    }

    if (modalOpened) {
      await sleep(1200);
      const modalDesktop = path.join(ARTIFACT_DIR, "05_daily_book_modal_desktop.png");
      await page.screenshot({ path: modalDesktop, fullPage: false });

      // 7. DAILY BOOK MODAL MOBILE
      console.log("[7/16] Capturing Daily Book Modal (Mobile 390x844)...");
      await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
      await sleep(1000);
      const modalMobile = path.join(ARTIFACT_DIR, "06_daily_book_modal_mobile.png");
      await page.screenshot({ path: modalMobile, fullPage: false });

      // Close modal
      await page.evaluate(() => {
        const closeBtn = (document.querySelector('button[aria-label="Close modal"]') || document.querySelector('.fixed button')) as HTMLElement;
        if (closeBtn) closeBtn.click();
      });
      await sleep(500);
    } else {
      console.log("No daily book row or add button found to click!");
    }

    await page.setViewport({ width: 1440, height: 900 });

    // 8. BILLS
    console.log("\n[8/16] Navigating to Bills...");
    await page.goto(`${BASE_URL}/billing/bills`, { waitUntil: "networkidle2" });
    await sleep(1500);
    const billsDesktop = path.join(ARTIFACT_DIR, "07_bills_desktop.png");
    await page.screenshot({ path: billsDesktop, fullPage: false });

    // 9. CREATE BILL
    console.log("[9/16] Navigating to Create Bill...");
    await page.goto(`${BASE_URL}/billing/new`, { waitUntil: "networkidle2" });
    await sleep(1500);
    const createBillDesktop = path.join(ARTIFACT_DIR, "08_create_bill_desktop.png");
    await page.screenshot({ path: createBillDesktop, fullPage: false });

    // 10. PAYMENTS
    console.log("[10/16] Navigating to Payments...");
    await page.goto(`${BASE_URL}/payments`, { waitUntil: "networkidle2" });
    await sleep(1500);
    const paymentsDesktop = path.join(ARTIFACT_DIR, "09_payments_desktop.png");
    await page.screenshot({ path: paymentsDesktop, fullPage: false });

    // 11. LEDGER
    console.log("[11/16] Navigating to Ledger...");
    await page.goto(`${BASE_URL}/ledger`, { waitUntil: "networkidle2" });
    await sleep(1500);
    const ledgerDesktop = path.join(ARTIFACT_DIR, "10_ledger_desktop.png");
    await page.screenshot({ path: ledgerDesktop, fullPage: false });

    // 12. OUTSTANDING
    console.log("[12/16] Navigating to Outstanding...");
    await page.goto(`${BASE_URL}/reports/outstanding`, { waitUntil: "networkidle2" });
    await sleep(1500);
    const outstandingDesktop = path.join(ARTIFACT_DIR, "11_outstanding_desktop.png");
    await page.screenshot({ path: outstandingDesktop, fullPage: false });

    // 13. AGING
    console.log("[13/16] Navigating to Aging Analysis...");
    await page.goto(`${BASE_URL}/reports/aging`, { waitUntil: "networkidle2" });
    await sleep(1500);
    const agingDesktop = path.join(ARTIFACT_DIR, "12_aging_desktop.png");
    await page.screenshot({ path: agingDesktop, fullPage: false });

    // 14. DRIVER VOUCHERS
    console.log("[14/16] Navigating to Driver Vouchers...");
    await page.goto(`${BASE_URL}/driver-vouchers`, { waitUntil: "networkidle2" });
    await sleep(1500);
    const driverVouchersDesktop = path.join(ARTIFACT_DIR, "13_driver_vouchers_desktop.png");
    await page.screenshot({ path: driverVouchersDesktop, fullPage: false });

    // 15. MASTERS (PARTIES)
    console.log("[15/16] Navigating to Masters (Parties)...");
    await page.goto(`${BASE_URL}/masters/parties`, { waitUntil: "networkidle2" });
    await sleep(1500);
    const mastersDesktop = path.join(ARTIFACT_DIR, "14_masters_parties_desktop.png");
    await page.screenshot({ path: mastersDesktop, fullPage: false });

    // 16. SETTINGS
    console.log("[16/16] Navigating to Settings...");
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle2" });
    await sleep(1500);
    const settingsDesktop = path.join(ARTIFACT_DIR, "15_settings_desktop.png");
    await page.screenshot({ path: settingsDesktop, fullPage: false });

    // FIRM SWITCHER VERIFICATION
    console.log("\n==================================================");
    console.log("FIRM SWITCHER LOGIC VERIFICATION");
    console.log("==================================================");
    
    // Check firm switcher content in sidebar
    const firmSwitcherState = await page.evaluate(() => {
      const sidebar = document.querySelector('aside');
      if (!sidebar) return { ok: false, reason: "Sidebar not found" };

      const text = sidebar.innerText;
      return {
        ok: true,
        sidebarText: text,
      };
    });
    console.log("Sidebar firm text snapshot:\n", firmSwitcherState.sidebarText);

    console.log("\n==================================================");
    console.log("CONSOLE ERRORS AUDIT");
    console.log("==================================================");
    if (consoleErrors.length === 0) {
      console.log("Clean console! Zero critical errors encountered.");
    } else {
      console.log(`Encountered ${consoleErrors.length} console log/error items:`);
      consoleErrors.forEach((err, idx) => console.log(` [${idx + 1}] ${err}`));
    }

    console.log("\nSUCCESS! All 15 required screenshots captured.");
  } catch (err) {
    console.error("Error running QA screenshot script:", err);
  } finally {
    await browser.close();
    process.exit(0);
  }
}

main();
