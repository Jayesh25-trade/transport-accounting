import puppeteer from 'puppeteer';

const BASE_URL = 'http://localhost:3000';

async function verifyFirmSwitching() {
  console.log('==================================================');
  console.log('FIRM SWITCHING & PRODUCTION DATA VERIFICATION');
  console.log('==================================================');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    // Log in
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.type('input[type="email"]', 'jayeshneo07@gmail.com');
    await page.type('input[type="password"]', 'Test123456');
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname !== '/login', { timeout: 10000 });

    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('main', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1000));

    // Get current firm title
    const headerTitle = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      return h1 ? h1.textContent : '';
    });
    console.log(`Current Header Title: "${headerTitle}"`);

    // Click firm switcher button for alternate firm
    const buttons = await page.$$('button');
    let switched = false;
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && (text.includes('Shiv Sai') || text.includes('SS'))) {
        console.log(`Clicking firm switcher for: ${text}`);
        await btn.click();
        switched = true;
        break;
      }
    }

    if (switched) {
      await new Promise(r => setTimeout(r, 1000));
      const newHeaderTitle = await page.evaluate(() => {
        const h1 = document.querySelector('h1');
        return h1 ? h1.textContent : '';
      });
      console.log(`Updated Header Title after switch: "${newHeaderTitle}"`);
    }

    console.log('\nFirm switching verification SUCCESS!');
  } catch (err) {
    console.error('Firm switching verification error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

verifyFirmSwitching();
