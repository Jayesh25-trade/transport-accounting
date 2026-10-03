import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";

const BASE_URL = "http://localhost:3000";
const LOGIN_EMAIL = "jayeshneo07@gmail.com";
const LOGIN_PASS = "Test123456";

const ARTIFACT_DIR = path.join(
  "C:\\Users\\SHRIRAM\\.gemini\\antigravity-ide\\brain\\14c6df3a-3aea-4f5f-b31f-c2b1d6cdee34",
  "dashboard_step2_viewports"
);

fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const VIEWPORTS = [
  { name: "01_mobile_375x812", width: 375, height: 812, label: "Mobile (375 × 812)" },
  { name: "02_mobile_large_390x844", width: 390, height: 844, label: "Mobile Large (390 × 844)" },
  { name: "03_tablet_768x1024", width: 768, height: 1024, label: "Tablet (768 × 1024)" },
  { name: "04_laptop_1280x800", width: 1280, height: 800, label: "Laptop (1280 × 800)" },
  { name: "05_desktop_1920x1080", width: 1920, height: 1080, label: "Desktop (1920 × 1080)" },
];

async function main() {
  console.log("==================================================");
  console.log("STEP 2 DASHBOARD LOCAL VIEWPORT SCREENSHOT CAPTURE");
  console.log("Target Base URL:", BASE_URL);
  console.log("Screenshot Output Directory:", ARTIFACT_DIR);
  console.log("==================================================");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  try {
    // Step 1: Login
    console.log("\n[1/3] Navigating to login page...");
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle2" });
    await sleep(1000);

    console.log("[2/3] Submitting login credentials...");
    await page.type('input[type="email"]', LOGIN_EMAIL);
    await page.type('input[type="password"]', LOGIN_PASS);

    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }),
      page.click('button[type="submit"]'),
    ]);
    await sleep(2000);

    console.log("Logged in successfully. Current URL:", page.url());

    // Step 2: Capture Screenshots per viewport
    console.log("\n[3/3] Capturing screenshots across 5 viewports...");

    for (const vp of VIEWPORTS) {
      console.log(`\n--- Capturing viewport: ${vp.label} ---`);
      await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 });
      await sleep(1500);

      // Capture view-above-fold
      const foldPath = path.join(ARTIFACT_DIR, `${vp.name}_above_fold.png`);
      await page.screenshot({ path: foldPath, fullPage: false });
      console.log(` Saved above-fold: ${foldPath}`);

      // Capture full page
      const fullPath = path.join(ARTIFACT_DIR, `${vp.name}_full_page.png`);
      await page.screenshot({ path: fullPath, fullPage: true });
      console.log(` Saved full-page: ${fullPath}`);
    }

    console.log("\nAll 5 viewports captured successfully!");
  } catch (err) {
    console.error("Error capturing viewport screenshots:", err);
  } finally {
    await browser.close();
    process.exit(0);
  }
}

main();
