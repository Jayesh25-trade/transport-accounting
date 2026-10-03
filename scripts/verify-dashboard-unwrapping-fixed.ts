import puppeteer from "puppeteer";

const PORT = 3105;
const baseUrl = `http://localhost:${PORT}`;

async function verifyDashboardFix() {
  console.log("=== FOCUSED DASHBOARD API UNWRAPPING VERIFICATION ===");
  console.log(`Target: ${baseUrl}/dashboard`);

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 },
  });

  const page = await browser.newPage();
  const consoleErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (!text.includes("favicon")) {
        consoleErrors.push(text);
        console.error(`[Console Error]: ${text}`);
      }
    }
  });

  try {
    // 1. Login
    console.log("1. Logging in...");
    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 2000));
    await page.type('input[type="email"]', "jayeshneo07@gmail.com");
    await page.type('input[type="password"]', "Test123456");
    await page.click('button[type="submit"]');
    await new Promise((r) => setTimeout(r, 3000));

    // 2. Open /dashboard
    console.log("2. Navigating to /dashboard...");
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 3000));

    // 3. Inspect populated DOM card text
    const cardData = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasTotalOutstanding: text.includes("Total Outstanding"),
        hasNetRevenue: text.includes("Net Billed Revenue"),
        hasPayments: text.includes("Payment Receipts"),
        hasDailyBook: text.includes("Daily Book Trips"),
        hasAging: text.includes("Customer Accounts Aging Analysis"),
        hasErrorMsg: text.includes("TypeError") || text.includes("totalOutstandingAmount") || text.includes("This page couldn't load"),
      };
    });

    console.log("Card Data Extraction:", cardData);

    // 4. Test Hard Refresh
    console.log("3. Testing Hard Refresh on /dashboard...");
    await page.reload({ waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 2500));

    // 5. Test Navigation away and return
    console.log("4. Testing Navigation away -> /ledger -> return to /dashboard...");
    await page.goto(`${baseUrl}/ledger`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1500));
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 2500));

    // 6. Test Firm Switcher (Deepraj -> Shiv Sai -> Deepraj)
    console.log("5. Testing Firm Switcher on Dashboard...");
    const firms = await page.evaluate(() => {
      const select = document.querySelector("select");
      if (!select) return [];
      return Array.from(select.options).map((o) => ({ value: o.value, text: o.text }));
    });

    if (firms.length > 1) {
      console.log(`Switching to firm: ${firms[1].text}`);
      await page.select("select", firms[1].value);
      await new Promise((r) => setTimeout(r, 2500));

      console.log(`Switching back to firm: ${firms[0].text}`);
      await page.select("select", firms[0].value);
      await new Promise((r) => setTimeout(r, 2500));
    }

    const typeErrorCount = consoleErrors.filter((e) => e.includes("totalOutstandingAmount")).length;
    console.log(`\nTarget TypeError Count: ${typeErrorCount}`);
    console.log(`Total Console Errors: ${consoleErrors.length}`);

    if (typeErrorCount === 0 && !cardData.hasErrorMsg && cardData.hasTotalOutstanding) {
      console.log("\nVERDICT: DASHBOARD FIX VERIFIED SUCCESSFULLY (PASS)");
    } else {
      console.log("\nVERDICT: DASHBOARD FIX FAILED (FAIL)");
    }

  } catch (err: any) {
    console.error("Verification Exception:", err.message);
  } finally {
    await browser.close();
  }
}

verifyDashboardFix();
