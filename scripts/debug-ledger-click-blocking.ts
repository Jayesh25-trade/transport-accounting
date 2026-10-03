import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";

const PROD_URL = "https://transport-accounting-dusky.vercel.app";
const SCREENSHOT_DIR = path.join(
  process.env.APP_DATA_DIR || "C:\\Users\\SHRIRAM\\.gemini\\antigravity-ide\\brain\\14c6df3a-3aea-4f5f-b31f-c2b1d6cdee34",
  "ledger_click_debug_screenshots"
);

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runLedgerClickDebug() {
  console.log("=== FORENSIC CLICK-BLOCKING INVESTIGATION ===");
  console.log(`Target URL: ${PROD_URL}/ledger`);

  const browser = await puppeteer.launch({
    headless: false, // Visible Chrome
    defaultViewport: { width: 1920, height: 1080 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  try {
    // 1. Login
    console.log("\n[STEP 1] Logging in on production...");
    await page.goto(`${PROD_URL}/login`, { waitUntil: "domcontentloaded" });
    await new Promise((r) => setTimeout(r, 2000));
    await page.type('input[type="email"]', "jayeshneo07@gmail.com");
    await page.type('input[type="password"]', "Test123456");
    await page.click('button[type="submit"]');
    await new Promise((r) => setTimeout(r, 3000));

    console.log(`On page: ${page.url()}`);

    // 2. Measure element under mouse on /dashboard for sidebar link "Daily Book"
    const sidebarPos = await page.evaluate(() => {
      const link = document.querySelector('a[href="/daily-book"]');
      if (!link) return null;
      const rect = link.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, rect };
    });

    console.log("Sidebar Daily Book link position on /dashboard:", sidebarPos);

    if (sidebarPos) {
      const topElementOnDash = await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return el ? { tagName: el.tagName, className: el.className, id: el.id, html: el.outerHTML.substring(0, 150) } : null;
      }, sidebarPos);
      console.log("Element at point on /dashboard:", topElementOnDash);
    }

    // 3. Navigate to /ledger
    console.log("\n[STEP 2] Navigating to /ledger...");
    await page.goto(`${PROD_URL}/ledger`, { waitUntil: "domcontentloaded" });
    await new Promise((r) => setTimeout(r, 3000));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01_ledger_page_loaded.png") });

    // 4. Measure element under mouse on /ledger at sidebar position
    if (sidebarPos) {
      const topElementOnLedger = await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        if (!el) return null;
        const comp = window.getComputedStyle(el);
        return {
          tagName: el.tagName,
          className: el.className,
          id: el.id,
          outerHTML: el.outerHTML.substring(0, 300),
          position: comp.position,
          zIndex: comp.zIndex,
          pointerEvents: comp.pointerEvents,
          opacity: comp.opacity,
          display: comp.display,
          width: comp.width,
          height: comp.height,
          top: comp.top,
          left: comp.left,
          rect: el.getBoundingClientRect(),
        };
      }, sidebarPos);

      console.log("\n=== ELEMENT AT POINT ON /LEDGER (SIDEBAR COORDINATES) ===");
      console.log(JSON.stringify(topElementOnLedger, null, 2));
    }

    // 5. Inspect ALL fixed / absolute / overlay elements covering the viewport on /ledger
    const overlayInspection = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll("*"));
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;

      const suspicious: any[] = [];

      elements.forEach((el) => {
        const comp = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();

        const isFixedOrAbs = comp.position === "fixed" || comp.position === "absolute";
        const coversViewport = rect.width >= viewportW * 0.8 && rect.height >= viewportH * 0.8;
        const highZ = parseInt(comp.zIndex, 10) > 0;

        if (isFixedOrAbs && (coversViewport || highZ)) {
          suspicious.push({
            tagName: el.tagName,
            className: el.className,
            id: el.id,
            position: comp.position,
            zIndex: comp.zIndex,
            pointerEvents: comp.pointerEvents,
            opacity: comp.opacity,
            visibility: comp.visibility,
            background: comp.background,
            width: rect.width,
            height: rect.height,
            top: rect.top,
            left: rect.left,
            htmlSnippet: el.outerHTML.substring(0, 200),
          });
        }
      });

      return suspicious;
    });

    console.log("\n=== SUSPICIOUS FIX/ABS OVERLAY ELEMENTS ON /LEDGER ===");
    console.log(JSON.stringify(overlayInspection, null, 2));

    // 6. Attempt real mouse click on Sidebar Daily Book link while on /ledger
    console.log("\n[STEP 3] Attempting real mouse click on Sidebar Daily Book link while on /ledger...");
    if (sidebarPos) {
      await page.mouse.click(sidebarPos.x, sidebarPos.y);
      await new Promise((r) => setTimeout(r, 2000));
      console.log(`URL after mouse click on Daily Book: ${page.url()}`);
    }

  } catch (err: any) {
    console.error("Ledger Click Debug Error:", err.message);
  } finally {
    await browser.close();
    console.log("\nLedger click debug script finished.");
  }
}

runLedgerClickDebug();
