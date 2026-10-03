import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";

const PROD_URL = "https://transport-accounting-dusky.vercel.app";
const SCREENSHOT_DIR = "C:\\Users\\SHRIRAM\\.gemini\\antigravity-ide\\brain\\14c6df3a-3aea-4f5f-b31f-c2b1d6cdee34\\live_vercel_f2e38ee_screenshots";

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

interface TestResult {
  step: string;
  success: boolean;
  details: string;
}

const results: TestResult[] = [];
const consoleErrors: string[] = [];
const networkErrors: string[] = [];

async function runLiveVerification() {
  console.log("=== STARTING LIVE PRODUCTION VERIFICATION ON VERCEL (f2e38ee) ===");
  console.log(`Target URL: ${PROD_URL}`);

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (!text.includes("favicon") && !text.includes("Third-party cookie")) {
        consoleErrors.push(text);
        console.error(`[Browser Console Error]: ${text}`);
      }
    }
  });

  page.on("response", (res) => {
    if (res.status() >= 400) {
      const url = res.url();
      if (!url.includes("favicon.ico")) {
        networkErrors.push(`${res.status()} ${res.statusText()} - ${url}`);
        console.error(`[HTTP ${res.status()}]: ${url}`);
      }
    }
  });

  try {
    // 1. Open Login Page
    console.log("\n--- STEP 1: LOGIN ---");
    await page.goto(`${PROD_URL}/login`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 2000));

    await page.type('input[type="email"]', "jayeshneo07@gmail.com");
    await page.type('input[type="password"]', "Test123456");

    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2" }),
      page.click('button[type="submit"]'),
    ]);

    await new Promise((r) => setTimeout(r, 3000));
    console.log(`LoggedIn URL: ${page.url()}`);
    results.push({
      step: "Login",
      success: page.url().includes("/dashboard"),
      details: `Current URL: ${page.url()}`,
    });

    // Helper to perform physical mouse click on an element by selector or text
    async function physicalMouseClick(selector: string, name: string): Promise<boolean> {
      const pos = await page.evaluate((sel) => {
        let el = document.querySelector(sel);
        if (!el) {
          // Fallback search by button text
          const btns = Array.from(document.querySelectorAll("button, a, span"));
          el = btns.find((b) => b.textContent?.trim().includes(sel)) || null;
        }
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      }, selector);

      if (!pos) {
        console.error(`Element not found for mouse click: ${selector} (${name})`);
        return false;
      }

      await page.mouse.click(pos.x, pos.y);
      return true;
    }

    // Helper to ensure accordion group is open
    async function ensureGroupOpen(groupName: string) {
      const isOpen = await page.evaluate((gName) => {
        const btns = Array.from(document.querySelectorAll("button"));
        const btn = btns.find((b) => b.textContent?.trim().includes(gName));
        if (!btn) return false;
        // Check if next sibling div exists and has children
        const parent = btn.parentElement;
        const subContainer = parent?.querySelector("div");
        return subContainer ? subContainer.children.length > 0 : false;
      }, groupName);

      if (!isOpen) {
        console.log(`Expanding sidebar group: ${groupName}...`);
        await physicalMouseClick(groupName, `Group ${groupName}`);
        await new Promise((r) => setTimeout(r, 800));
      }
    }

    // 2. Open Ledger Page
    console.log("\n--- STEP 2: OPEN LEDGER ---");
    await page.goto(`${PROD_URL}/ledger`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 3000));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01_live_ledger.png") });

    // Check main thread responsiveness / DOM mutations on Ledger
    const mutationCount = await page.evaluate(() => {
      let count = 0;
      const observer = new MutationObserver(() => count++);
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
      return new Promise<number>((res) => {
        setTimeout(() => {
          observer.disconnect();
          res(count);
        }, 2000);
      });
    });

    console.log(`DOM Mutation Count over 2s on /ledger: ${mutationCount}`);
    results.push({
      step: "Ledger Render Loop Check",
      success: mutationCount === 0,
      details: `Mutation count: ${mutationCount} (0 expected)`,
    });

    // 3. Test REAL MOUSE CLICKS from Ledger to each section
    const navTargets = [
      { name: "Dashboard", group: null, selector: 'a[href="/dashboard"]', expectedUrl: "/dashboard", screenshot: "02_ledger_to_dashboard.png" },
      { name: "Daily Book", group: null, selector: 'a[href="/daily-book"]', expectedUrl: "/daily-book", screenshot: "03_ledger_to_daily_book.png" },
      { name: "Driver Vouchers", group: null, selector: 'a[href="/driver-vouchers"]', expectedUrl: "/driver-vouchers", screenshot: "04_ledger_to_driver_vouchers.png" },
      { name: "Payments", group: null, selector: 'a[href="/payments"]', expectedUrl: "/payments", screenshot: "05_ledger_to_payments.png" },
      { name: "Masters", group: "Masters", selector: 'a[href="/masters/parties"]', expectedUrl: "/masters/parties", screenshot: "06_ledger_to_masters.png" },
      { name: "Reports", group: "Reports", selector: 'a[href="/reports/outstanding"]', expectedUrl: "/reports/outstanding", screenshot: "07_ledger_to_reports.png" },
      { name: "Settings", group: null, selector: 'a[href="/settings"]', expectedUrl: "/settings", screenshot: "08_ledger_to_settings.png" },
    ];

    console.log("\n--- STEP 3: INDIVIDUAL MOUSE CLICK NAVIGATION FROM LEDGER ---");
    for (const target of navTargets) {
      // Ensure we are on Ledger before clicking
      if (!page.url().endsWith("/ledger")) {
        await page.goto(`${PROD_URL}/ledger`, { waitUntil: "networkidle2" });
        await new Promise((r) => setTimeout(r, 2000));
      }

      if (target.group) {
        await ensureGroupOpen(target.group);
      }

      console.log(`Clicking ${target.name} (${target.selector}) via physical mouse click...`);
      const clicked = await physicalMouseClick(target.selector, target.name);
      await new Promise((r) => setTimeout(r, 2500));

      const currentUrl = page.url();
      const pass = clicked && currentUrl.includes(target.expectedUrl);
      console.log(`Result for ${target.name}: ${pass ? "PASS" : "FAIL"} -> ${currentUrl}`);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, target.screenshot) });
      results.push({
        step: `Mouse Click: Ledger -> ${target.name}`,
        success: pass,
        details: `Target: ${target.expectedUrl}, Actual: ${currentUrl}`,
      });
    }

    // 4. Test Party Dropdown Click on Ledger
    console.log("\n--- STEP 4: LEDGER PARTY DROPDOWN MOUSE CLICK ---");
    await page.goto(`${PROD_URL}/ledger`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 2000));

    const dropdownClicked = await physicalMouseClick("select", "Party Dropdown");
    await new Promise((r) => setTimeout(r, 1000));

    // Select the first party option if available
    const partyOptions = await page.evaluate(() => {
      const select = document.querySelector("select");
      if (!select) return [];
      return Array.from(select.options).map((o) => ({ value: o.value, text: o.text }));
    });

    if (partyOptions.length > 1) {
      await page.select("select", partyOptions[1].value);
      await new Promise((r) => setTimeout(r, 2000));
      console.log(`Selected party: ${partyOptions[1].text}`);
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "09_ledger_party_dropdown.png") });
    results.push({
      step: "Ledger Party Dropdown Interactive Check",
      success: dropdownClicked && partyOptions.length > 0,
      details: `Dropdown clicked: ${dropdownClicked}, Options count: ${partyOptions.length}`,
    });

    // 5. Test Refresh Statement Button Click
    console.log("\n--- STEP 5: REFRESH STATEMENT BUTTON CLICK ---");
    const refreshClicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Refresh Statement"));
      if (!btn) return false;
      (btn as HTMLButtonElement).click();
      return true;
    });
    await new Promise((r) => setTimeout(r, 1500));
    console.log(`Refresh Statement button clicked: ${refreshClicked}`);
    results.push({
      step: "Refresh Statement Button Click",
      success: refreshClicked,
      details: `Button clicked successfully`,
    });

    // 6. Test Browser Back/Forward Navigation
    console.log("\n--- STEP 6: BROWSER BACK / FORWARD NAVIGATION FROM LEDGER ---");
    const historyTargets = ["/daily-book", "/payments", "/masters/parties", "/reports/outstanding"];
    for (const hTarget of historyTargets) {
      await page.goto(`${PROD_URL}/ledger`, { waitUntil: "networkidle2" });
      await new Promise((r) => setTimeout(r, 1500));

      await page.goto(`${PROD_URL}${hTarget}`, { waitUntil: "networkidle2" });
      await new Promise((r) => setTimeout(r, 1500));

      await page.goBack({ waitUntil: "networkidle2" });
      await new Promise((r) => setTimeout(r, 1500));

      const urlAfterBack = page.url();
      const backPass = urlAfterBack.includes("/ledger");
      console.log(`Back from ${hTarget} to /ledger: ${backPass ? "PASS" : "FAIL"} (${urlAfterBack})`);

      results.push({
        step: `Browser Back: ${hTarget} -> Ledger`,
        success: backPass,
        details: `Actual URL: ${urlAfterBack}`,
      });
    }

    // 7. Full Section Regression Navigation Sweep
    console.log("\n--- STEP 7: FULL APP SECTION REGRESSION SWEEP ---");
    const allAppRoutes = [
      "/dashboard",
      "/daily-book",
      "/driver-vouchers",
      "/billing/bills",
      "/billing/new",
      "/payments",
      "/ledger",
      "/masters/parties",
      "/masters/companies",
      "/masters/trucks",
      "/masters/locations",
      "/masters/customer-rules",
      "/reports/outstanding",
      "/reports/aging",
      "/settings",
    ];

    for (const route of allAppRoutes) {
      await page.goto(`${PROD_URL}${route}`, { waitUntil: "networkidle2" });
      await new Promise((r) => setTimeout(r, 1500));

      const hasCrash = await page.evaluate(() => {
        const text = document.body.innerText || "";
        return (
          text.includes("Application error") ||
          text.includes("This page couldn't load") ||
          text.includes("500 Internal Server Error") ||
          text.includes("404 Page Not Found")
        );
      });

      console.log(`Route ${route}: ${hasCrash ? "CRASH/ERROR" : "PASS"}`);
      results.push({
        step: `Regression Check: ${route}`,
        success: !hasCrash,
        details: hasCrash ? "Page crash or error detected" : "Rendered cleanly",
      });
    }

    // Final Ledger screenshot
    await page.goto(`${PROD_URL}/ledger`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "10_final_ledger.png") });

  } catch (err: any) {
    console.error("Critical Test Exception:", err.message);
    results.push({
      step: "Execution Error",
      success: false,
      details: err.message,
    });
  } finally {
    await browser.close();
  }

  // Generate Report Summary
  console.log("\n==================================================");
  console.log("=== VERCEL LIVE PROD VERIFICATION REPORT ===");
  console.log("==================================================");

  let passedCount = 0;
  let failedCount = 0;

  for (const r of results) {
    if (r.success) {
      passedCount++;
      console.log(`[PASS] ${r.step}: ${r.details}`);
    } else {
      failedCount++;
      console.log(`[FAIL] ${r.step}: ${r.details}`);
    }
  }

  console.log(`\nSUMMARY: Passed = ${passedCount}, Failed = ${failedCount}`);
  console.log(`Console Errors Recorded: ${consoleErrors.length}`);
  console.log(`Network Errors Recorded: ${networkErrors.length}`);

  if (failedCount === 0 && consoleErrors.length === 0 && networkErrors.length === 0) {
    console.log("\nFINAL VERDICT: PASS");
  } else if (failedCount === 0) {
    console.log("\nFINAL VERDICT: PASS WITH DEFECTS");
  } else {
    console.log("\nFINAL VERDICT: FAIL");
  }
}

runLiveVerification();
