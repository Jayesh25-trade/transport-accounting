import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";

const PROD_URL = "https://transport-accounting-dusky.vercel.app";
const SCREENSHOT_DIR = path.join(
  process.env.APP_DATA_DIR || "C:\\Users\\SHRIRAM\\.gemini\\antigravity-ide\\brain\\14c6df3a-3aea-4f5f-b31f-c2b1d6cdee34",
  "live_vercel_e87cbb2_screenshots"
);

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runLiveVerification() {
  console.log("=== PHASE 5: LIVE VERCEL PRODUCTION BROWSER VERIFICATION ===");
  console.log(`Target URL: ${PROD_URL}`);
  console.log(`Commit: e87cbb2638848d7d8fcae13463977348fd609c13`);
  console.log(`Saving screenshots to: ${SCREENSHOT_DIR}`);

  const browser = await puppeteer.launch({
    headless: false, // Visible Chrome
    defaultViewport: { width: 1920, height: 1080 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  page.on("response", (resp) => {
    if (resp.status() >= 400 && !resp.url().includes("favicon.ico")) {
      networkErrors.push(`${resp.status()} ${resp.url()}`);
    }
  });

  try {
    // STEP 3: Test Login
    console.log("\n[STEP 3] Opening /login on Live Production...");
    await page.goto(`${PROD_URL}/login`, { waitUntil: "networkidle2" });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01_live_login_page.png") });

    // Verify firm switcher text on /login
    const loginFirmText = await page.evaluate(() => {
      const el = document.querySelector(".firm-switcher");
      return el ? el.textContent?.trim() : null;
    });
    console.log(`Login page firm switcher text: "${loginFirmText || "Clean (None)"}"`);

    console.log("[STEP 3] Logging in with jayeshneo07@gmail.com...");
    await page.type('input[type="email"]', "jayeshneo07@gmail.com");
    await page.type('input[type="password"]', "Test123456");
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: "networkidle2" });
    console.log(`Navigated to: ${page.url()}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02_live_dashboard.png") });

    const activeFirmName = await page.evaluate(() => {
      const btn = document.querySelector("#firm-switcher-button");
      return btn ? btn.textContent?.trim() : null;
    });
    console.log(`Active firm loaded post-login: "${activeFirmName}"`);

    // STEP 4: Test Every Sidebar Section
    const routesToTest = [
      { name: "Dashboard", path: "/dashboard", shot: "03_live_dashboard.png" },
      { name: "Daily Book", path: "/daily-book", shot: "04_live_daily_book.png" },
      { name: "Driver Vouchers", path: "/driver-vouchers", shot: "05_live_driver_vouchers.png" },
      { name: "Bills", path: "/billing/bills", shot: "06_live_bills.png" },
      { name: "Create Bill", path: "/billing/new", shot: "07_live_create_bill.png" },
      { name: "Payments", path: "/payments", shot: "08_live_payments.png" },
      { name: "Ledger", path: "/ledger", shot: "09_live_ledger.png" },
      { name: "Parties", path: "/masters/parties", shot: "10_live_parties.png" },
      { name: "Companies", path: "/masters/companies", shot: "11_live_companies.png" },
      { name: "Trucks", path: "/masters/trucks", shot: "12_live_trucks.png" },
      { name: "Locations", path: "/masters/locations", shot: "13_live_locations.png" },
      { name: "Customer Rules", path: "/masters/customer-rules", shot: "14_live_customer_rules.png" },
      { name: "Outstanding", path: "/reports/outstanding", shot: "15_live_outstanding.png" },
      { name: "Aging Analysis", path: "/reports/aging", shot: "16_live_aging.png" },
      { name: "Settings", path: "/settings", shot: "17_live_settings.png" },
    ];

    console.log("\n[STEP 4 & 6] Testing all 15 sidebar sections & direct URL loads...");
    for (const r of routesToTest) {
      console.log(`Navigating to ${r.name} (${r.path})...`);
      await page.goto(`${PROD_URL}${r.path}`, { waitUntil: "networkidle2" });
      await new Promise((res) => setTimeout(res, 1200));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, r.shot) });

      // Hard refresh check
      await page.reload({ waitUntil: "networkidle2" });
      await new Promise((res) => setTimeout(res, 800));

      const overflow = await page.evaluate(() => document.body.style.overflow);
      if (overflow && overflow !== "") {
        console.error(`[BODY OVERFLOW TRAP DETECTED on ${r.path}]: overflow="${overflow}"`);
      }
    }

    // STEP 5: Critical Ledger Navigation Test
    console.log("\n[STEP 5] Executing Critical Ledger Navigation Test...");
    await page.goto(`${PROD_URL}/ledger`, { waitUntil: "networkidle2" });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "18_live_ledger_before.png") });

    const ledgerTargets = [
      "/dashboard",
      "/daily-book",
      "/payments",
      "/masters/parties",
      "/masters/companies",
      "/masters/trucks",
      "/masters/locations",
      "/masters/customer-rules",
      "/reports/outstanding",
      "/reports/aging",
      "/settings",
    ];

    for (const target of ledgerTargets) {
      console.log(`Ledger -> ${target}...`);
      await page.goto(`${PROD_URL}${target}`, { waitUntil: "networkidle2" });
      const overflow = await page.evaluate(() => document.body.style.overflow);
      if (overflow !== "") {
        console.error(`Overflow trapped on navigation to ${target}: "${overflow}"`);
      }
    }

    await page.goto(`${PROD_URL}/ledger`, { waitUntil: "networkidle2" });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "19_live_ledger_after.png") });

    // STEP 7: Firm Switch Test
    console.log("\n[STEP 7] Testing Firm Switcher (Deepraj -> Shiv Sai -> Deepraj)...");
    const switcherBtn = await page.$("#firm-switcher-button");
    if (switcherBtn) {
      await switcherBtn.click();
      await new Promise((r) => setTimeout(r, 500));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "20_live_firm_switcher_open.png") });
    }

    // STEP 8: Mobile + Tablet Viewports
    console.log("\n[STEP 8] Quick Check: Tablet Viewport (768x1024)...");
    await page.setViewport({ width: 768, height: 1024 });
    await page.goto(`${PROD_URL}/dashboard`, { waitUntil: "networkidle2" });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "21_live_tablet_dashboard.png") });

    console.log("[STEP 8] Quick Check: Mobile Viewport (375x812)...");
    await page.setViewport({ width: 375, height: 812 });
    await page.goto(`${PROD_URL}/dashboard`, { waitUntil: "networkidle2" });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "22_live_mobile_dashboard.png") });

    console.log("\n=== LIVE VERIFICATION SUMMARY ===");
    console.log(`Console Errors Captured: ${consoleErrors.length}`);
    consoleErrors.forEach((e) => console.log(`  [CONSOLE] ${e}`));
    console.log(`Network Errors Captured (>=400): ${networkErrors.length}`);
    networkErrors.forEach((n) => console.log(`  [NETWORK] ${n}`));

  } catch (err: any) {
    console.error("Live Verification Error:", err.message);
  } finally {
    await browser.close();
    console.log("\nPhase 5 live production verification complete.");
  }
}

runLiveVerification();
