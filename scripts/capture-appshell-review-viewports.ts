import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";

const BASE_URL = "http://localhost:3000";
const LOGIN_EMAIL = "jayeshneo07@gmail.com";
const LOGIN_PASS = "Test123456";

const ARTIFACT_DIR = path.join(
  "C:\\Users\\SHRIRAM\\.gemini\\antigravity-ide\\brain\\14c6df3a-3aea-4f5f-b31f-c2b1d6cdee34",
  "appshell_step2_review_screenshots"
);

fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const VIEWPORTS = [
  { name: "01_desktop_1920x1080", width: 1920, height: 1080, label: "Desktop (1920 × 1080)" },
  { name: "02_laptop_1280x800", width: 1280, height: 800, label: "Laptop (1280 × 800)" },
  { name: "03_tablet_768x1024", width: 768, height: 1024, label: "Tablet (768 × 1024)" },
  { name: "04_mobile_390x844_closed", width: 390, height: 844, label: "Mobile (390 × 844) - Closed Drawer" },
];

async function main() {
  console.log("==================================================");
  console.log("STEP 2 APPSHELL VISUAL REVIEW CAPTURE");
  console.log("Base URL:", BASE_URL);
  console.log("Output Directory:", ARTIFACT_DIR);
  console.log("==================================================");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  try {
    // 1. Login
    console.log("\n[1/3] Logging in...");
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

    console.log("Logged in. Current URL:", page.url());

    // 2. Capture standard viewports
    console.log("\n[2/3] Capturing viewports...");

    for (const vp of VIEWPORTS) {
      console.log(`\n--- Viewport: ${vp.label} ---`);
      await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 });
      await sleep(1500);

      const filePath = path.join(ARTIFACT_DIR, `${vp.name}.png`);
      await page.screenshot({ path: filePath, fullPage: false });
      console.log(` Saved: ${filePath}`);
    }

    // 3. Mobile Open Drawer
    console.log("\n--- Viewport: Mobile (390 × 844) - Open Drawer ---");
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await sleep(1000);

    // Click mobile menu toggle
    await page.click("#mobile-menu-toggle");
    await sleep(800);

    const drawerOpenPath = path.join(ARTIFACT_DIR, "05_mobile_390x844_drawer_open.png");
    await page.screenshot({ path: drawerOpenPath, fullPage: false });
    console.log(` Saved open drawer: ${drawerOpenPath}`);

    console.log("\nAll AppShell viewports captured successfully!");
  } catch (err) {
    console.error("Error capturing screenshots:", err);
  } finally {
    await browser.close();
    process.exit(0);
  }
}

main();
