import puppeteer from "puppeteer";

const PROD_URL = "https://transport-accounting-dusky.vercel.app";

async function investigateDashboardError() {
  console.log("=== PHASE 5A.1: DASHBOARD HYDRATION ERROR FORENSIC INVESTIGATION ===");
  console.log(`Target URL: ${PROD_URL}`);

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  const consoleLogs: { type: string; text: string; location?: string }[] = [];
  const apiResponses: { url: string; status: number; headers: Record<string, string>; body: any }[] = [];

  page.on("console", (msg) => {
    const text = msg.text();
    consoleLogs.push({
      type: msg.type(),
      text,
      location: msg.location() ? `${msg.location().url}:${msg.location().lineNumber}` : undefined,
    });
    console.log(`[Browser Console ${msg.type().toUpperCase()}]: ${text}`);
  });

  page.on("response", async (res) => {
    const url = res.url();
    if (url.includes("/api/dashboard/overview") || url.includes("/api/firms")) {
      let body = null;
      try {
        body = await res.json();
      } catch (e) {
        body = "<non-json>";
      }
      apiResponses.push({
        url,
        status: res.status(),
        headers: res.headers(),
        body,
      });
      console.log(`[API Response] ${res.status()} ${url}`);
      console.log(`[API Body]`, JSON.stringify(body, null, 2));
    }
  });

  try {
    // Step 1: Login
    console.log("\n--- STEP 1: LOGIN & INITIAL DASHBOARD MOUNT ---");
    await page.goto(`${PROD_URL}/login`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1000));

    await page.type('input[type="email"]', "jayeshneo07@gmail.com");
    await page.type('input[type="password"]', "Test123456");

    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2" }),
      page.click('button[type="submit"]'),
    ]);

    console.log(`URL after login: ${page.url()}`);
    await new Promise((r) => setTimeout(r, 3000));

    // Step 2: Hard Reload Dashboard 3 times
    console.log("\n--- STEP 2: DASHBOARD HARD RELOADS ---");
    for (let i = 1; i <= 3; i++) {
      console.log(`Hard reload #${i}...`);
      await page.reload({ waitUntil: "networkidle2" });
      await new Promise((r) => setTimeout(r, 2000));
    }

    // Step 3: Navigations to and from Dashboard
    console.log("\n--- STEP 3: NAVIGATIONS TO AND FROM DASHBOARD ---");
    const routes = ["/ledger", "/daily-book", "/payments", "/masters/parties", "/reports/outstanding"];
    for (const r of routes) {
      console.log(`Navigating Dashboard -> ${r} -> Dashboard...`);
      await page.goto(`${PROD_URL}${r}`, { waitUntil: "networkidle2" });
      await new Promise((r) => setTimeout(r, 1500));
      await page.goto(`${PROD_URL}/dashboard`, { waitUntil: "networkidle2" });
      await new Promise((r) => setTimeout(r, 1500));
    }

    // Step 4: Firm Switching (Deepraj -> Shiv Sai -> Deepraj)
    console.log("\n--- STEP 4: FIRM SWITCHER TEST ---");
    // Find firm switcher select or dropdown
    const selectExists = await page.evaluate(() => {
      const select = document.querySelector("select");
      return !!select;
    });

    if (selectExists) {
      const firms = await page.evaluate(() => {
        const select = document.querySelector("select");
        if (!select) return [];
        return Array.from(select.options).map((o) => ({ value: o.value, text: o.text }));
      });
      console.log("Firms found in switcher:", firms);
      if (firms.length > 1) {
        console.log(`Switching to second firm (${firms[1].text})...`);
        await page.select("select", firms[1].value);
        await new Promise((r) => setTimeout(r, 2500));

        console.log(`Switching back to first firm (${firms[0].text})...`);
        await page.select("select", firms[0].value);
        await new Promise((r) => setTimeout(r, 2500));
      }
    }

  } catch (err: any) {
    console.error("Investigation Exception:", err.message);
  } finally {
    await browser.close();
  }

  console.log("\n==================================================");
  console.log("=== FORENSIC SUMMARY ===");
  console.log("==================================================");
  console.log(`Total Console Logs Recorded: ${consoleLogs.length}`);
  console.log(`Total Relevant API Responses Captured: ${apiResponses.length}`);

  const targetErrors = consoleLogs.filter((l) => l.text.includes("totalOutstandingAmount"));
  console.log(`\nExact Target Error Occurrences (${targetErrors.length}):`);
  targetErrors.forEach((e, idx) => {
    console.log(`Occurrence #${idx + 1}:`);
    console.log(`  Text: ${e.text}`);
    console.log(`  Location: ${e.location || "N/A"}`);
  });
}

investigateDashboardError();
