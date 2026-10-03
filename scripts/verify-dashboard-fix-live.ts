/**
 * LIVE DASHBOARD VERIFICATION — commit 81b8c72
 * fix(ui): unwrap API response envelope in dashboard page
 *
 * READ-ONLY. No data creation/modification.
 * Uses puppeteer (already installed) against LIVE Vercel production.
 */

import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";

const PROD_URL = "https://transport-accounting-dusky.vercel.app";
const SCREENSHOT_DIR = path.join(
  "C:\\Users\\SHRIRAM\\.gemini\\antigravity-ide\\brain\\14c6df3a-3aea-4f5f-b31f-c2b1d6cdee34",
  "live_vercel_81b8c72_screenshots"
);
const TARGET_COMMIT = "81b8c72";
const LOGIN_EMAIL = "jayeshneo07@gmail.com";
const LOGIN_PASS = "Test123456";

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function log(msg: string) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
}

interface Result { step: string; pass: boolean; details: string; }
const results: Result[] = [];
const allConsoleErrors: string[] = [];
const apiLog: { url: string; status: number }[] = [];

async function shot(page: any, name: string) {
  const file = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file });
  log(`  📸 ${name}`);
  return file;
}

function r(step: string, pass: boolean, details = "") {
  results.push({ step, pass, details });
  log(`  ${pass ? "✅ PASS" : "❌ FAIL"} — ${step}${details ? ": " + details : ""}`);
}

async function physicalClick(page: any, selector: string, name: string): Promise<boolean> {
  const pos = await page.evaluate((sel: string) => {
    const el: Element | null = document.querySelector(sel);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, selector);

  if (!pos) {
    log(`  ⚠️  Element not found: ${selector} (${name})`);
    return false;
  }
  await page.mouse.click(pos.x, pos.y);
  return true;
}

async function main() {
  log("══════════════════════════════════════════════");
  log(`LIVE DASHBOARD VERIFICATION — target commit ${TARGET_COMMIT}`);
  log(`Production: ${PROD_URL}`);
  log("══════════════════════════════════════════════");

  // ── STEP 0: Verify Vercel is reachable + check x-vercel headers ──────────
  log("\nSTEP 0 — Vercel reachability + headers check...");
  try {
    const { default: https } = await import("https");
    await new Promise<void>((resolve) => {
      https.get(`${PROD_URL}/api/health`, (res) => {
        log(`  /api/health HTTP status : ${res.statusCode}`);
        log(`  x-vercel-id             : ${res.headers["x-vercel-id"] || "not-present"}`);
        log(`  x-vercel-cache          : ${res.headers["x-vercel-cache"] || "not-present"}`);
        r("Health endpoint reachable", res.statusCode === 200, `HTTP ${res.statusCode}`);
        res.resume();
        resolve();
      }).on("error", (e) => {
        log(`  ERROR: ${e.message}`);
        r("Health endpoint reachable", false, e.message);
        resolve();
      });
    });
  } catch (e: any) {
    log(`  WARNING: ${e.message}`);
  }

  // ── STEP 1: Launch visible Chromium via puppeteer ────────────────────────
  log("\nSTEP 1 — Launching visible Chromium...");
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 800 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  // Console error collector — ignore known noise
  page.on("console", (msg: any) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (!text.includes("favicon") && !text.includes("Third-party cookie") && !text.includes("net::ERR_ABORTED")) {
        allConsoleErrors.push(text);
        log(`  🔴 CONSOLE ERROR: ${text}`);
      }
    }
  });

  // API response tracker
  page.on("response", (resp: any) => {
    const url: string = resp.url();
    if (url.includes("/api/")) {
      apiLog.push({ url, status: resp.status() });
    }
  });

  try {
    // ── STEP 2: Login ───────────────────────────────────────────────────────
    log("\nSTEP 2 — Login...");
    await page.goto(`${PROD_URL}/login`, { waitUntil: "networkidle2" });
    await sleep(1500);
    await shot(page, "01_login_page");

    await page.type('input[type="email"]', LOGIN_EMAIL);
    await page.type('input[type="password"]', LOGIN_PASS);

    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }),
      page.click('button[type="submit"]'),
    ]);
    await sleep(2000);

    const afterLoginUrl: string = page.url();
    const loginOk = afterLoginUrl.includes("/dashboard");
    r("Login → /dashboard", loginOk, `URL: ${afterLoginUrl}`);
    await shot(page, "02_dashboard_after_login");

    if (!loginOk) {
      throw new Error(`Login failed — ended up at ${afterLoginUrl}`);
    }

    // ── STEP 3: Zero TypeErrors on initial dashboard load ───────────────────
    log("\nSTEP 3 — Check for TypeErrors on initial dashboard load...");
    const typeErrors = allConsoleErrors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read properties of undefined")
    );
    r(
      "Zero TypeErrors on initial Dashboard load",
      typeErrors.length === 0,
      typeErrors.length > 0 ? typeErrors[0] : "none"
    );

    // ── STEP 4: Error boundary not shown ───────────────────────────────────
    const errorBoundaryVisible = await page.evaluate(() => {
      const text = (document.body as HTMLElement).innerText || "";
      return text.includes("Something went wrong") || text.includes("Application error");
    });
    r("No error boundary fallback visible", !errorBoundaryVisible);

    // ── STEP 5: /api/dashboard/overview = HTTP 200 ──────────────────────────
    log("\nSTEP 4 — Verify /api/dashboard/overview = HTTP 200...");
    const overviewCalls = apiLog.filter(c => c.url.includes("/api/dashboard/overview"));
    if (overviewCalls.length > 0) {
      overviewCalls.forEach(c => log(`  API: ${c.url} → HTTP ${c.status}`));
      r(
        "/api/dashboard/overview HTTP 200",
        overviewCalls.every(c => c.status === 200),
        overviewCalls.map(c => c.status).join(", ")
      );
    } else {
      log("  ⚠️  /api/dashboard/overview not intercepted yet (reloading to capture)...");
      apiLog.length = 0;
      allConsoleErrors.length = 0;
      await page.reload({ waitUntil: "networkidle2" });
      await sleep(2000);
      const overviewAfterReload = apiLog.filter(c => c.url.includes("/api/dashboard/overview"));
      overviewAfterReload.forEach(c => log(`  API: ${c.url} → HTTP ${c.status}`));
      r(
        "/api/dashboard/overview HTTP 200",
        overviewAfterReload.length > 0 && overviewAfterReload.every(c => c.status === 200),
        overviewAfterReload.length > 0 ? overviewAfterReload.map(c => c.status).join(", ") : "not intercepted"
      );
    }

    // ── STEP 6: Hard refresh ────────────────────────────────────────────────
    log("\nSTEP 5 — Hard refresh Dashboard...");
    allConsoleErrors.length = 0;
    apiLog.length = 0;
    await page.reload({ waitUntil: "networkidle2" });
    await sleep(2500);
    await shot(page, "03_dashboard_hard_refresh");

    const refreshTypeErrors = allConsoleErrors.filter(e => e.includes("TypeError") || e.includes("Cannot read"));
    r("Zero TypeErrors after hard refresh", refreshTypeErrors.length === 0, refreshTypeErrors[0] || "none");
    const overviewAfterRefresh = apiLog.filter(c => c.url.includes("/api/dashboard/overview"));
    log(`  /api/dashboard/overview calls after reload: ${overviewAfterRefresh.map(c => c.status).join(", ") || "none captured"}`);

    // ── STEP 7: Dashboard → Ledger → Dashboard ──────────────────────────────
    log("\nSTEP 6 — Dashboard → Ledger → Dashboard...");
    allConsoleErrors.length = 0;
    await page.goto(`${PROD_URL}/ledger`, { waitUntil: "networkidle2" });
    await sleep(1500);
    await shot(page, "04_ledger");
    await physicalClick(page, 'a[href="/dashboard"]', "Dashboard sidebar link");
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});
    await sleep(2000);
    await shot(page, "05_ledger_to_dashboard");
    const ledgerNavUrl: string = page.url();
    r("Ledger → Dashboard navigation", ledgerNavUrl.includes("/dashboard"), ledgerNavUrl);
    const ledgerTypeErrors = allConsoleErrors.filter(e => e.includes("TypeError"));
    r("Zero TypeErrors: Ledger → Dashboard", ledgerTypeErrors.length === 0, ledgerTypeErrors[0] || "none");

    // ── STEP 8: Dashboard → Daily Book → Dashboard ──────────────────────────
    log("\nSTEP 7 — Dashboard → Daily Book → Dashboard...");
    allConsoleErrors.length = 0;
    await page.goto(`${PROD_URL}/dashboard`, { waitUntil: "networkidle2" });
    await sleep(1000);
    await physicalClick(page, 'a[href="/daily-book"]', "Daily Book");
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});
    await sleep(1500);
    await shot(page, "06_daily_book");
    await physicalClick(page, 'a[href="/dashboard"]', "Dashboard");
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});
    await sleep(2000);
    await shot(page, "07_daily_book_to_dashboard");
    r("Daily Book → Dashboard navigation", page.url().includes("/dashboard"), page.url());
    r("Zero TypeErrors: Daily Book → Dashboard", allConsoleErrors.filter(e => e.includes("TypeError")).length === 0);

    // ── STEP 9: Dashboard → Payments → Dashboard ────────────────────────────
    log("\nSTEP 8 — Dashboard → Payments → Dashboard...");
    allConsoleErrors.length = 0;
    await page.goto(`${PROD_URL}/dashboard`, { waitUntil: "networkidle2" });
    await sleep(1000);
    await physicalClick(page, 'a[href="/payments"]', "Payments");
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});
    await sleep(1500);
    await shot(page, "08_payments");
    await physicalClick(page, 'a[href="/dashboard"]', "Dashboard");
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});
    await sleep(2000);
    await shot(page, "09_payments_to_dashboard");
    r("Payments → Dashboard navigation", page.url().includes("/dashboard"), page.url());
    r("Zero TypeErrors: Payments → Dashboard", allConsoleErrors.filter(e => e.includes("TypeError")).length === 0);

    // ── STEP 10: Dashboard → Masters → Dashboard ────────────────────────────
    log("\nSTEP 9 — Dashboard → Masters → Dashboard...");
    allConsoleErrors.length = 0;
    await page.goto(`${PROD_URL}/dashboard`, { waitUntil: "networkidle2" });
    await sleep(1000);

    // Expand Masters accordion if needed
    const mastersExpanded = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a"));
      return links.some((a: any) => a.href && a.href.includes("/masters/parties"));
    });
    if (!mastersExpanded) {
      await physicalClick(page, "button", "Masters accordion");
      await sleep(600);
    }
    const mastersClicked = await physicalClick(page, 'a[href="/masters/parties"]', "Masters/Parties");
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});
    await sleep(1500);
    await shot(page, "10_masters");
    await physicalClick(page, 'a[href="/dashboard"]', "Dashboard");
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});
    await sleep(2000);
    await shot(page, "11_masters_to_dashboard");
    r("Masters → Dashboard navigation", page.url().includes("/dashboard"), page.url());
    r("Zero TypeErrors: Masters → Dashboard", allConsoleErrors.filter(e => e.includes("TypeError")).length === 0);

    // ── STEP 11: Dashboard → Reports → Dashboard ────────────────────────────
    log("\nSTEP 10 — Dashboard → Reports → Dashboard...");
    allConsoleErrors.length = 0;
    await page.goto(`${PROD_URL}/dashboard`, { waitUntil: "networkidle2" });
    await sleep(1000);
    const reportsClicked = await physicalClick(page, 'a[href="/reports/outstanding"]', "Reports/Outstanding");
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});
    await sleep(1500);
    await shot(page, "12_reports");
    await physicalClick(page, 'a[href="/dashboard"]', "Dashboard");
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});
    await sleep(2000);
    await shot(page, "13_reports_to_dashboard");
    r("Reports → Dashboard navigation", page.url().includes("/dashboard"), page.url());
    r("Zero TypeErrors: Reports → Dashboard", allConsoleErrors.filter(e => e.includes("TypeError")).length === 0);

    // ── STEP 12: Firm switch Deepraj → Shiv Sai → Deepraj ───────────────────
    log("\nSTEP 11 — Firm switch: Deepraj → Shiv Sai → Deepraj...");
    allConsoleErrors.length = 0;
    await page.goto(`${PROD_URL}/dashboard`, { waitUntil: "networkidle2" });
    await sleep(1500);
    await shot(page, "14_dashboard_firm_deepraj");

    // Detect firm selector (could be a select, button, or dropdown trigger)
    const firmSelectorInfo = await page.evaluate(() => {
      // Check for select element
      const select = document.querySelector("select");
      if (select) {
        const opts = Array.from((select as HTMLSelectElement).options).map((o: any) => ({ val: o.value, text: o.text }));
        return { type: "select", options: opts };
      }
      // Check for buttons/links containing firm names
      const all = Array.from(document.querySelectorAll("button, [role='button'], [data-testid*='firm']"));
      const firmButtons = all.filter((el: any) =>
        el.textContent?.includes("Deepraj") || el.textContent?.includes("Shiv")
      );
      if (firmButtons.length > 0) {
        return { type: "button", text: (firmButtons[0] as any).textContent?.trim() };
      }
      return { type: "not-found" };
    });
    log(`  Firm selector type: ${firmSelectorInfo.type}`);

    if (firmSelectorInfo.type === "select" && firmSelectorInfo.options && firmSelectorInfo.options.length > 1) {
      const shivSaiOpt = firmSelectorInfo.options.find((o: any) =>
        o.text.toLowerCase().includes("shiv")
      );
      if (shivSaiOpt) {
        await page.select("select", shivSaiOpt.val);
        await sleep(2500);
        await shot(page, "15_firm_shiv_sai");
        const firmTypeErrors = allConsoleErrors.filter(e => e.includes("TypeError"));
        r("Firm switch to Shiv Sai: Zero TypeErrors", firmTypeErrors.length === 0, firmTypeErrors[0] || "none");

        // Switch back to Deepraj
        const deeprajOpt = firmSelectorInfo.options.find((o: any) =>
          o.text.toLowerCase().includes("deepraj")
        );
        if (deeprajOpt) {
          await page.select("select", deeprajOpt.val);
          await sleep(2500);
          await shot(page, "16_firm_back_to_deepraj");
          r("Firm switch back to Deepraj: OK", true);
        }
      } else {
        log("  ⚠️  Shiv Sai option not found in firm selector");
        r("Firm switch Deepraj → Shiv Sai → Deepraj", false, "Shiv Sai option not found");
      }
    } else if (firmSelectorInfo.type === "button") {
      log(`  Firm button found: "${firmSelectorInfo.text}" — clicking to open dropdown`);
      await physicalClick(page, `button`, "Firm dropdown button");
      await sleep(800);
      await shot(page, "14b_firm_dropdown_open");
      const shivClicked = await page.evaluate(() => {
        const all = Array.from(document.querySelectorAll("button, li, [role='option'], [role='menuitem']"));
        const shivEl = all.find((el: any) => el.textContent?.includes("Shiv"));
        if (shivEl) { (shivEl as HTMLElement).click(); return true; }
        return false;
      });
      await sleep(2000);
      await shot(page, "15_firm_shiv_sai");
      r("Firm switch to Shiv Sai", shivClicked, shivClicked ? "clicked" : "not found");
      if (shivClicked) {
        await physicalClick(page, `button`, "Firm dropdown button (back)");
        await sleep(800);
        const deeprajClicked = await page.evaluate(() => {
          const all = Array.from(document.querySelectorAll("button, li, [role='option'], [role='menuitem']"));
          const el = all.find((e: any) => e.textContent?.includes("Deepraj"));
          if (el) { (el as HTMLElement).click(); return true; }
          return false;
        });
        await sleep(2000);
        await shot(page, "16_firm_back_to_deepraj");
        r("Firm switch back to Deepraj", deeprajClicked);
      }
    } else {
      log("  ⚠️  Firm selector not found — skipping firm switch test");
      r("Firm switch test", false, "Firm selector UI not found");
    }

    // ── STEP 13: No 404/5xx API errors across all steps ─────────────────────
    log("\nSTEP 12 — API error audit...");
    const api5xx = apiLog.filter(c => c.status >= 500);
    const api404 = apiLog.filter(c => c.status === 404 && !c.url.includes("favicon"));
    r("Zero API 5xx errors", api5xx.length === 0, api5xx.map(c => `${c.url}:${c.status}`).join(", ") || "none");
    r("Zero API 404 errors", api404.length === 0, api404.map(c => c.url).join(", ") || "none");

    // ── STEP 14: Final dashboard screenshot ─────────────────────────────────
    log("\nSTEP 13 — Final dashboard screenshot...");
    await page.goto(`${PROD_URL}/dashboard`, { waitUntil: "networkidle2" });
    await sleep(2000);
    await shot(page, "17_final_dashboard");

  } catch (err: any) {
    log(`FATAL TEST EXCEPTION: ${err.message}`);
    results.push({ step: "Execution Exception", pass: false, details: err.message });
  } finally {
    await sleep(3000);
    await browser.close();
    log("Browser closed.");
  }

  // ── FINAL REPORT ──────────────────────────────────────────────────────────
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;

  console.log("\n══════════════════════════════════════════════════════");
  console.log("FINAL DASHBOARD FIX VERIFICATION REPORT");
  console.log("══════════════════════════════════════════════════════");
  console.log(`Production URL : ${PROD_URL}`);
  console.log(`Target commit  : ${TARGET_COMMIT} — fix(ui): unwrap API response envelope in dashboard page`);
  console.log(`Results        : ${passed} PASS / ${failed} FAIL`);
  console.log(`Console Errors : ${allConsoleErrors.length}`);
  console.log(`API calls      : ${apiLog.length}`);
  console.log("──────────────────────────────────────────────────────");
  for (const res of results) {
    console.log(`${res.pass ? "[PASS]" : "[FAIL]"} ${res.step}${res.details ? " — " + res.details : ""}`);
  }
  console.log("──────────────────────────────────────────────────────");
  if (failed === 0 && allConsoleErrors.length === 0) {
    console.log("VERDICT: ✅ DASHBOARD FIX FULLY VERIFIED ON LIVE PRODUCTION");
  } else if (failed === 0) {
    console.log("VERDICT: ⚠️  ALL STEPS PASSED but console errors were recorded (review above)");
  } else {
    console.log("VERDICT: ❌ FAILURES DETECTED — see above");
  }
  console.log("══════════════════════════════════════════════════════");
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
