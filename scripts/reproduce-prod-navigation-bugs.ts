import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";

const SCREENSHOT_DIR = path.join(
  process.env.APP_DATA_DIR || "C:\\Users\\SHRIRAM\\.gemini\\antigravity-ide\\brain\\14c6df3a-3aea-4f5f-b31f-c2b1d6cdee34",
  "reproduction_screenshots"
);

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runReproduction() {
  console.log("=== PHASE 2: VISIBLE BROWSER REPRODUCTION ===");
  console.log(`Saving screenshots to: ${SCREENSHOT_DIR}`);

  const browser = await puppeteer.launch({
    headless: false, // Visible Chrome
    defaultViewport: { width: 1920, height: 1080 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  // Monitor network & console errors
  const consoleErrors: string[] = [];
  const networkFailures: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  page.on("response", (resp) => {
    if (resp.status() >= 400) {
      networkFailures.push(`${resp.status()} ${resp.url()}`);
    }
  });

  try {
    // 1. Visit Login Page
    console.log("\n[TEST 1] Opening /login...");
    await page.goto("https://transport-accounting-dusky.vercel.app/login", { waitUntil: "networkidle2" });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01_login_page.png") });

    // 2. Perform Login
    console.log("[TEST 1] Logging in with jayeshneo07@gmail.com...");
    await page.type('input[type="email"]', "jayeshneo07@gmail.com");
    await page.type('input[type="password"]', "Test123456");
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: "networkidle2" });
    console.log(`Redirected to: ${page.url()}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02_dashboard_after_login.png") });

    // 3. Inspect Firm Switcher state
    const firmText = await page.evaluate(() => {
      const el = document.querySelector(".firm-switcher");
      return el ? el.textContent : null;
    });
    console.log(`Firm Switcher text: "${firmText}"`);

    // 4. Test Navigation to Driver Vouchers
    console.log("\n[TEST 4] Navigating to Driver Vouchers...");
    await page.click('a[href="/driver-vouchers"]');
    await new Promise((r) => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03_driver_vouchers.png") });

    // 5. Test Navigation to Reports -> Outstanding
    console.log("[TEST 4] Navigating to Outstanding Report...");
    await page.click('a[href="/reports/outstanding"]');
    await new Promise((r) => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04_outstanding_report.png") });

    // 6. Test Navigation to Reports -> Aging
    console.log("[TEST 4] Navigating to Aging Analysis...");
    await page.click('a[href="/reports/aging"]');
    await new Promise((r) => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05_aging_report.png") });

    // 7. Test Navigation to Ledger
    console.log("[TEST 2/3] Navigating to Ledger...");
    await page.click('a[href="/ledger"]');
    await new Promise((r) => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "06_ledger.png") });

    console.log("\n--- REPRODUCTION CONSOLE ERRORS ---");
    consoleErrors.forEach((e) => console.log(`[CONSOLE] ${e}`));

    console.log("\n--- REPRODUCTION NETWORK FAILURES ---");
    networkFailures.forEach((n) => console.log(`[NETWORK] ${n}`));

  } catch (err: any) {
    console.error("Reproduction error:", err.message);
  } finally {
    await browser.close();
    console.log("\nPhase 2 reproduction finished.");
  }
}

runReproduction();
