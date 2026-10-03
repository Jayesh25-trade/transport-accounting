import puppeteer from "puppeteer";

const PROD_URL = "https://transport-accounting-dusky.vercel.app";

async function runLoopCheck() {
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

    // Monitor fetch requests count over 5 seconds
    let fetchCount = 0;
    page.on("request", (req) => {
      if (req.url().includes("/api/")) {
        fetchCount++;
        console.log(`[API REQUEST #${fetchCount}] ${req.method()} ${req.url()}`);
      }
    });

    console.log("Monitoring API requests on /ledger for 5 seconds...");
    await new Promise((r) => setTimeout(r, 5000));

    console.log(`Total API requests in 5 seconds on /ledger: ${fetchCount}`);

  } catch (err: any) {
    console.error(err.message);
  } finally {
    await browser.close();
  }
}

runLoopCheck();
