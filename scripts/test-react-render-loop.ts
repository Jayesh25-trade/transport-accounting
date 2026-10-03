import puppeteer from "puppeteer";

const PROD_URL = "https://transport-accounting-dusky.vercel.app";

async function runRenderLoopTest() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 },
  });

  const page = await browser.newPage();

  try {
    await page.goto(`${PROD_URL}/login`, { waitUntil: "domcontentloaded" });
    await new Promise((r) => setTimeout(r, 2000));
    await page.type('input[type="email"]', "jayeshneo07@gmail.com");
    await page.type('input[type="password"]', "Test123456");
    await page.click('button[type="submit"]');
    await new Promise((r) => setTimeout(r, 3000));

    console.log("Navigating to /ledger...");
    await page.goto(`${PROD_URL}/ledger`, { waitUntil: "domcontentloaded" });
    await new Promise((r) => setTimeout(r, 2000));

    // Measure CPU / DOM mutations / JS stack over 3 seconds
    const renderStats = await page.evaluate(() => {
      let renderCount = 0;
      const observer = new MutationObserver(() => {
        renderCount++;
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });

      return new Promise((resolve) => {
        setTimeout(() => {
          observer.disconnect();
          resolve(renderCount);
        }, 3000);
      });
    });

    console.log(`DOM Mutations / Re-render events in 3 seconds on /ledger: ${renderStats}`);

  } catch (err: any) {
    console.error(err.message);
  } finally {
    await browser.close();
  }
}

runRenderLoopTest();
