import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";
import { spawn, ChildProcess } from "child_process";

const SCREENSHOT_DIR = path.join(
  process.env.APP_DATA_DIR || "C:\\Users\\SHRIRAM\\.gemini\\antigravity-ide\\brain\\14c6df3a-3aea-4f5f-b31f-c2b1d6cdee34",
  "regression_fixed_screenshots"
);

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

let serverProcess: ChildProcess | null = null;

async function startLocalServer(): Promise<string> {
  return new Promise((resolve, reject) => {
    const port = 3099;
    const url = `http://localhost:${port}`;
    console.log(`Starting local Next.js production server on ${url}...`);

    serverProcess = spawn("npx.cmd", ["next", "start", "-p", String(port)], {
      cwd: "d:\\TRANSPORT ACC\\transport-app",
      env: { ...process.env, PORT: String(port) },
      shell: true,
    });

    let started = false;

    serverProcess.stdout?.on("data", (data) => {
      const msg = data.toString();
      if (msg.includes("Ready in") || msg.includes("started") || msg.includes("http://localhost")) {
        if (!started) {
          started = true;
          resolve(url);
        }
      }
    });

    serverProcess.stderr?.on("data", (data) => {
      console.error("[SERVER_STDERR]", data.toString());
    });

    setTimeout(() => {
      if (!started) {
        started = true;
        resolve(url);
      }
    }, 6000);
  });
}

async function runRegression() {
  const baseUrl = await startLocalServer();
  console.log(`=== PHASE 3B: VISIBLE BROWSER REGRESSION TEST (${baseUrl}) ===`);
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
    if (resp.status() >= 400 && !resp.url().includes("/favicon.ico")) {
      networkErrors.push(`${resp.status()} ${resp.url()}`);
    }
  });

  try {
    // 1. Visit /login
    console.log("\n[STEP 1] Visiting /login unauthenticated...");
    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle2" });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01_login_page_fixed.png") });

    // Verify NO error banner on login page
    const loginFirmText = await page.evaluate(() => {
      const el = document.querySelector(".firm-switcher");
      return el ? el.textContent : null;
    });
    console.log(`Login page firm switcher text: "${loginFirmText || "Clean (None)"}"`);

    // 2. Login
    console.log("\n[STEP 2] Logging in with jayeshneo07@gmail.com...");
    await page.type('input[type="email"]', "jayeshneo07@gmail.com");
    await page.type('input[type="password"]', "Test123456");
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: "networkidle2" });
    console.log(`Navigated to: ${page.url()}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02_dashboard_fixed.png") });

    // Verify firm switcher post-login
    const activeFirmName = await page.evaluate(() => {
      const btn = document.querySelector("#firm-switcher-button");
      return btn ? btn.textContent?.trim() : null;
    });
    console.log(`Active firm loaded post-login: "${activeFirmName}"`);

    // 3. Test Navigation across modules
    const routesToTest = [
      { name: "Daily Book", path: "/daily-book", shot: "03_daily_book.png" },
      { name: "Driver Vouchers", path: "/driver-vouchers", shot: "04_driver_vouchers.png" },
      { name: "Bills", path: "/billing/bills", shot: "05_bills.png" },
      { name: "Create Bill", path: "/billing/new", shot: "06_create_bill.png" },
      { name: "Payments", path: "/payments", shot: "07_payments.png" },
      { name: "Ledger", path: "/ledger", shot: "08_ledger.png" },
      { name: "Parties", path: "/masters/parties", shot: "09_parties.png" },
      { name: "Companies", path: "/masters/companies", shot: "10_companies.png" },
      { name: "Trucks", path: "/masters/trucks", shot: "11_trucks.png" },
      { name: "Locations", path: "/masters/locations", shot: "12_locations.png" },
      { name: "Customer Rules", path: "/masters/customer-rules", shot: "13_customer_rules.png" },
      { name: "Outstanding", path: "/reports/outstanding", shot: "14_outstanding.png" },
      { name: "Aging Analysis", path: "/reports/aging", shot: "15_aging.png" },
      { name: "Settings", path: "/settings", shot: "16_settings.png" },
    ];

    for (const r of routesToTest) {
      console.log(`Navigating to ${r.name} (${r.path})...`);
      await page.goto(`${baseUrl}${r.path}`, { waitUntil: "networkidle2" });
      await new Promise((res) => setTimeout(res, 1000));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, r.shot) });

      // Body overflow check
      const overflow = await page.evaluate(() => document.body.style.overflow);
      if (overflow && overflow !== "") {
        console.error(`[BODY OVERFLOW TRAP DETECTED on ${r.path}]: overflow="${overflow}"`);
      }
    }

    // 4. Ledger Special Navigation Test
    console.log("\n[STEP 4] Executing Ledger Special Navigation Test...");
    await page.goto(`${baseUrl}/ledger`, { waitUntil: "networkidle2" });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "18_ledger_special_before.png") });

    // Navigate Ledger -> Dashboard -> Daily Book -> Payments -> Reports -> Settings -> Ledger
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle2" });
    await page.goto(`${baseUrl}/daily-book`, { waitUntil: "networkidle2" });
    await page.goto(`${baseUrl}/payments`, { waitUntil: "networkidle2" });
    await page.goto(`${baseUrl}/reports/outstanding`, { waitUntil: "networkidle2" });
    await page.goto(`${baseUrl}/settings`, { waitUntil: "networkidle2" });
    await page.goto(`${baseUrl}/ledger`, { waitUntil: "networkidle2" });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "19_ledger_special_after.png") });

    // 5. Test Firm Switcher (Deepraj -> Shiv Sai -> Deepraj)
    console.log("\n[STEP 5] Testing Firm Switcher...");
    const switcherBtn = await page.$("#firm-switcher-button");
    if (switcherBtn) {
      await switcherBtn.click();
      await new Promise((r) => setTimeout(r, 500));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "20_firm_switcher_open.png") });
    }

    // 6. Test Responsive Viewports (Tablet & Mobile)
    console.log("\n[STEP 6] Testing Tablet Viewport (768x1024)...");
    await page.setViewport({ width: 768, height: 1024 });
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle2" });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "21_tablet_dashboard.png") });

    console.log("[STEP 6] Testing Mobile Viewport (375x812)...");
    await page.setViewport({ width: 375, height: 812 });
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle2" });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "22_mobile_dashboard.png") });

    console.log("\n=== REGRESSION TEST RESULTS ===");
    console.log(`Console Errors: ${consoleErrors.length}`);
    consoleErrors.forEach((e) => console.log(`  [CONSOLE ERROR] ${e}`));
    console.log(`Network Failures: ${networkErrors.length}`);
    networkErrors.forEach((n) => console.log(`  [NETWORK FAIL] ${n}`));

  } catch (err: any) {
    console.error("Regression Test Error:", err.message);
  } finally {
    await browser.close();
    if (serverProcess) {
      serverProcess.kill();
    }
    console.log("\nPhase 3B visible browser regression test finished.");
  }
}

runRegression();
