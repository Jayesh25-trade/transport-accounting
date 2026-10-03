import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(process.cwd(), 'mobile_sidebar_verification');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

interface ViewportTest {
  name: string;
  width: number;
  height: number;
  isMobile: boolean;
}

const VIEWPORTS: ViewportTest[] = [
  { name: '375x812_iPhone_X', width: 375, height: 812, isMobile: true },
  { name: '390x844_iPhone_13', width: 390, height: 844, isMobile: true },
  { name: '768x1024_iPad_Tablet', width: 768, height: 1024, isMobile: false },
  { name: '1280x800_Desktop_Laptop', width: 1280, height: 800, isMobile: false },
  { name: '1920x1080_Desktop_FHD', width: 1920, height: 1080, isMobile: false },
];

const PAGES_TO_VERIFY = [
  { name: 'settings', url: '/settings' },
  { name: 'dashboard', url: '/dashboard' },
  { name: 'daily_book', url: '/daily-book' },
  { name: 'driver_vouchers', url: '/driver-vouchers' },
  { name: 'billing', url: '/billing/bills' },
];

async function runVerification() {
  console.log('==================================================');
  console.log('MOBILE SIDEBAR UX MICRO-FIX LOCAL VERIFICATION');
  console.log('==================================================');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const consoleErrors: string[] = [];
  const results: { test: string; pass: boolean; details: string }[] = [];

  try {
    const page = await browser.newPage();
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('React DevTools')) {
          consoleErrors.push(text);
        }
      }
    });

    // 1. Authenticate
    console.log('[Step 1] Logging into local instance...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.type('input[type="email"]', 'jayeshneo07@gmail.com');
    await page.type('input[type="password"]', 'Test123456');
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname !== '/login' || document.querySelector('.app-shell') !== null, { timeout: 10000 });

    console.log(`[Auth Check] Logged in successfully: Current URL = ${page.url()}`);

    // 2. Test Mobile Sidebar Toggle & Drawer Behavior at 375x812
    console.log('\n[Step 2] Testing Mobile Drawer Interactions (375x812)...');
    await page.setViewport({ width: 375, height: 812 });
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle0' });

    // Check main area width before drawer open
    const mainAreaBoxBefore = await page.evaluate(() => {
      const mainEl = document.querySelector('.main-area');
      const bodyScrollWidth = document.documentElement.scrollWidth;
      return {
        width: mainEl?.clientWidth ?? 0,
        bodyScrollWidth,
        viewportWidth: window.innerWidth
      };
    });

    console.log(`Main area width (Closed): ${mainAreaBoxBefore.width}px / Viewport: ${mainAreaBoxBefore.viewportWidth}px`);
    const isFullWidthMobile = mainAreaBoxBefore.width >= 350; // Near full viewport width minus scrollbars/padding
    const noOverflowMobile = mainAreaBoxBefore.bodyScrollWidth <= mainAreaBoxBefore.viewportWidth;

    results.push({
      test: 'Mobile (375x812) Full-Width Main Area & No Body Overflow (Closed Drawer)',
      pass: isFullWidthMobile && noOverflowMobile,
      details: `MainArea: ${mainAreaBoxBefore.width}px, ScrollWidth: ${mainAreaBoxBefore.bodyScrollWidth}px`
    });

    // Take screenshot of settings closed on mobile
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_settings_mobile_375_closed.png') });

    // Click Hamburger toggle button
    console.log('Clicking hamburger menu toggle...');
    await page.click('#mobile-menu-toggle');
    await new Promise(r => setTimeout(r, 400)); // wait for drawer animation

    const drawerOpenState = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar');
      const backdrop = document.querySelector('.sidebar-backdrop');
      return {
        hasMobileOpenClass: sidebar?.classList.contains('mobile-open') ?? false,
        backdropVisible: backdrop !== null
      };
    });

    results.push({
      test: 'Mobile Hamburger Toggle Opens Off-Canvas Sidebar & Backdrop',
      pass: drawerOpenState.hasMobileOpenClass && drawerOpenState.backdropVisible,
      details: `hasMobileOpenClass: ${drawerOpenState.hasMobileOpenClass}, backdropVisible: ${drawerOpenState.backdropVisible}`
    });

    // Take screenshot of open drawer on mobile
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_settings_mobile_375_drawer_open.png') });

    // Test nav item click closes drawer
    console.log('Clicking navigation link inside mobile drawer...');
    await page.evaluate(() => {
      const dashboardLink = document.querySelector('a[href="/dashboard"]') as HTMLElement;
      dashboardLink?.click();
    });
    await new Promise(r => setTimeout(r, 500));

    const drawerClosedAfterNav = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar');
      const backdrop = document.querySelector('.sidebar-backdrop');
      return {
        hasMobileOpenClass: sidebar?.classList.contains('mobile-open') ?? false,
        backdropVisible: backdrop !== null
      };
    });

    results.push({
      test: 'Clicking Navigation Link Closes Mobile Drawer',
      pass: !drawerClosedAfterNav.hasMobileOpenClass && !drawerClosedAfterNav.backdropVisible,
      details: `ClosedAfterNav: ${!drawerClosedAfterNav.hasMobileOpenClass}`
    });

    // 3. Multi-Viewport Layout Verification Across Pages
    console.log('\n[Step 3] Verifying 5 Viewports x 5 Pages...');

    for (const vp of VIEWPORTS) {
      await page.setViewport({ width: vp.width, height: vp.height });
      console.log(`\nTesting Viewport: ${vp.name} (${vp.width}x${vp.height})`);

      for (const p of PAGES_TO_VERIFY) {
        await page.goto(`${BASE_URL}${p.url}`, { waitUntil: 'networkidle0' });
        await new Promise(r => setTimeout(r, 200));

        const overflowCheck = await page.evaluate(() => {
          const documentWidth = document.documentElement.clientWidth;
          const scrollWidth = document.documentElement.scrollWidth;
          const sidebar = document.querySelector('.sidebar');
          const sidebarWidth = sidebar ? sidebar.getBoundingClientRect().width : 0;
          const mainArea = document.querySelector('.main-area');
          const mainAreaWidth = mainArea ? mainArea.getBoundingClientRect().width : 0;

          return {
            documentWidth,
            scrollWidth,
            sidebarWidth,
            mainAreaWidth,
            hasHorizontalOverflow: scrollWidth > documentWidth + 2
          };
        });

        const pass = !overflowCheck.hasHorizontalOverflow;
        console.log(`  - Page /${p.name}: Pass=${pass}, MainAreaWidth=${Math.round(overflowCheck.mainAreaWidth)}px, Overflow=${overflowCheck.hasHorizontalOverflow}`);

        results.push({
          test: `Viewport ${vp.name} - Page /${p.name} Layout Integrity`,
          pass,
          details: `MainAreaWidth: ${Math.round(overflowCheck.mainAreaWidth)}px, ScrollWidth: ${overflowCheck.scrollWidth}px vs Window: ${overflowCheck.documentWidth}px`
        });

        // Save representative screenshot for 375px Settings and 1280px Settings
        if (vp.name === '375x812_iPhone_X' && p.name === 'settings') {
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_settings_mobile_375_final.png') });
        } else if (vp.name === '1280x800_Desktop_Laptop' && p.name === 'settings') {
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_settings_desktop_1280_final.png') });
        }
      }
    }

    // 4. Console Errors Check
    results.push({
      test: 'Zero Critical Browser Console Errors',
      pass: consoleErrors.length === 0,
      details: `Count: ${consoleErrors.length} ${consoleErrors.length > 0 ? JSON.stringify(consoleErrors) : ''}`
    });

  } catch (err: any) {
    console.error('Verification error:', err);
    results.push({
      test: 'Execution Safety',
      pass: false,
      details: err.message
    });
  } finally {
    await browser.close();
  }

  console.log('\n==================================================');
  console.log('VERIFICATION SUMMARY');
  console.log('==================================================');
  let allPassed = true;
  results.forEach((r, idx) => {
    const status = r.pass ? 'PASS' : 'FAIL';
    if (!r.pass) allPassed = false;
    console.log(`${idx + 1}. [${status}] ${r.test}: ${r.details}`);
  });

  console.log(`\nOverall Verification Result: ${allPassed ? 'ALL PASS' : 'SOME FAILS'}`);
  process.exit(allPassed ? 0 : 1);
}

runVerification();
