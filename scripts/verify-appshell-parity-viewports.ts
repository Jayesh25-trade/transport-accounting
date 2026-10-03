import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(process.cwd(), 'appshell_parity_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

interface ViewportTest {
  name: string;
  width: number;
  height: number;
}

const VIEWPORTS: ViewportTest[] = [
  { name: '01_desktop_1920x1080', width: 1920, height: 1080 },
  { name: '02_laptop_1280x800', width: 1280, height: 800 },
  { name: '03_tablet_768x1024', width: 768, height: 1024 },
  { name: '04_mobile_large_390x844', width: 390, height: 844 },
  { name: '05_mobile_375x812', width: 375, height: 812 },
];

async function main() {
  console.log('==================================================');
  console.log('STEP 2 APPSHELL PARITY VIEWPORT VERIFICATION');
  console.log('==================================================');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const consoleErrors: string[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('favicon') && !text.includes('React DevTools')) {
        consoleErrors.push(text);
      }
    }
  });

  try {
    // Log in
    console.log('Logging in...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.type('input[type="email"]', 'jayeshneo07@gmail.com');
    await page.type('input[type="password"]', 'Test123456');
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname !== '/login', { timeout: 10000 });
    console.log(`Logged in successfully. URL: ${page.url()}`);

    for (const vp of VIEWPORTS) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('main', { timeout: 10000 });
      await new Promise(r => setTimeout(r, 1000));

      const layoutMetrics = await page.evaluate(() => {
        const documentWidth = document.documentElement.clientWidth;
        const scrollWidth = document.documentElement.scrollWidth;
        const main = document.querySelector('main');
        const mainRect = main ? main.getBoundingClientRect() : null;

        return {
          documentWidth,
          scrollWidth,
          hasHorizontalOverflow: scrollWidth > documentWidth + 2,
          mainWidth: mainRect ? Math.round(mainRect.width) : 0,
          mainLeft: mainRect ? Math.round(mainRect.left) : 0,
          mainRight: mainRect ? Math.round(mainRect.right) : 0,
        };
      });

      console.log(`\nViewport ${vp.name} (${vp.width}x${vp.height}):`);
      console.log(`  - <main> width: ${layoutMetrics.mainWidth}px`);
      console.log(`  - <main> left offset: ${layoutMetrics.mainLeft}px`);
      console.log(`  - Horizontal overflow: ${layoutMetrics.hasHorizontalOverflow}`);

      const screenshotPath = path.join(SCREENSHOT_DIR, `${vp.name}.png`);
      await page.screenshot({ path: screenshotPath });

      // Test mobile menu toggle if screen < 768px
      if (vp.width < 768) {
        const toggleBtn = await page.$('#mobile-menu-toggle');
        if (toggleBtn) {
          await toggleBtn.click();
          await new Promise(r => setTimeout(r, 400));
          const drawerPath = path.join(SCREENSHOT_DIR, `${vp.name}_drawer_open.png`);
          await page.screenshot({ path: drawerPath });
          console.log(`  - Mobile drawer toggle clicked & captured.`);

          // close drawer
          await toggleBtn.click();
          await new Promise(r => setTimeout(r, 400));
        } else {
          console.log(`  - Warning: #mobile-menu-toggle not found on screen width ${vp.width}`);
        }
      }
    }

    console.log(`\nConsole error count: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.log('Console errors:', consoleErrors);
    }
  } catch (err: any) {
    console.error('Verification error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }

  console.log('\nAppShell parity viewport verification complete!');
}

main();
