import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(process.cwd(), 'dashboard_visual_review_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

interface ViewportConfig {
  name: string;
  width: number;
  height: number;
}

const VIEWPORTS: ViewportConfig[] = [
  { name: '01_desktop_1920x1080', width: 1920, height: 1080 },
  { name: '02_laptop_1280x800', width: 1280, height: 800 },
  { name: '03_tablet_768x1024', width: 768, height: 1024 },
  { name: '04_mobile_large_390x844', width: 390, height: 844 },
  { name: '05_mobile_375x812', width: 375, height: 812 },
];

async function captureVisualReview() {
  console.log('==================================================');
  console.log('STEP 3 DASHBOARD VISUAL REVIEW SCREENSHOT CAPTURE');
  console.log('==================================================');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    // Log in
    console.log('Logging into local app...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.type('input[type="email"]', 'jayeshneo07@gmail.com');
    await page.type('input[type="password"]', 'Test123456');
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname !== '/login', { timeout: 10000 });
    console.log(`Logged in successfully. Current URL: ${page.url()}`);

    for (const vp of VIEWPORTS) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('main', { timeout: 10000 });
      await new Promise(r => setTimeout(r, 1000));

      const screenshotPath = path.join(SCREENSHOT_DIR, `${vp.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`Captured full-page screenshot: ${screenshotPath}`);

      if (vp.width < 768) {
        const toggleBtn = await page.$('#mobile-menu-toggle');
        if (toggleBtn) {
          await toggleBtn.click();
          await new Promise(r => setTimeout(r, 400));
          const drawerPath = path.join(SCREENSHOT_DIR, `${vp.name}_drawer_open.png`);
          await page.screenshot({ path: drawerPath });
          console.log(`Captured drawer open screenshot: ${drawerPath}`);
          await toggleBtn.click();
          await new Promise(r => setTimeout(r, 400));
        }
      }
    }

    console.log('\nVisual review screenshot capture completed successfully!');
  } catch (err) {
    console.error('Visual review screenshot capture failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

captureVisualReview();
