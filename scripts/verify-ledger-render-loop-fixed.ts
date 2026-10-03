import puppeteer from "puppeteer";
import { spawn, ChildProcess } from "child_process";

let serverProcess: ChildProcess | null = null;

async function startLocalServer(): Promise<string> {
  return new Promise((resolve) => {
    const port = 3098;
    const url = `http://localhost:${port}`;
    console.log(`Starting local Next.js server on ${url}...`);

    serverProcess = spawn("npx.cmd", ["next", "start", "-p", String(port)], {
      cwd: "d:\\TRANSPORT ACC\\transport-app",
      env: { ...process.env, PORT: String(port) },
      shell: true,
    });

    let started = false;
    serverProcess.stdout?.on("data", (data) => {
      const msg = data.toString();
      if (msg.includes("Ready in") || msg.includes("started") || msg.includes("http://localhost")) {
        if (!started) {
          started = true;
          resolve(url);
        }
      }
    });

    setTimeout(() => {
      if (!started) {
        started = true;
        resolve(url);
      }
    }, 6000);
  });
}

async function verifyLedgerLoopFixed() {
  const baseUrl = await startLocalServer();
  console.log("=== FOCUSED LEDGER RENDER-LOOP FIX VERIFICATION ===");
  console.log(`Target: ${baseUrl}/ledger`);

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 },
  });

  const page = await browser.newPage();

  try {
    // 1. Login
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    await new Promise((r) => setTimeout(r, 2000));
    await page.type('input[type="email"]', "jayeshneo07@gmail.com");
    await page.type('input[type="password"]', "Test123456");
    await page.click('button[type="submit"]');
    await new Promise((r) => setTimeout(r, 3000));

    // 2. Open /ledger
    console.log("Navigating to /ledger...");
    await page.goto(`${baseUrl}/ledger`, { waitUntil: "domcontentloaded" });
    await new Promise((r) => setTimeout(r, 2000));

    // 3. Monitor DOM Mutations over 3 seconds
    const mutationCount = await page.evaluate(() => {
      let count = 0;
      const observer = new MutationObserver(() => {
        count++;
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });

      return new Promise((resolve) => {
        setTimeout(() => {
          observer.disconnect();
          resolve(count);
        }, 3000);
      });
    });

    console.log(`DOM Mutation Count over 3 seconds on /ledger: ${mutationCount}`);

    // 4. Test REAL MOUSE CLICK on Sidebar Daily Book link
    const sidebarPos = await page.evaluate(() => {
      const link = document.querySelector('a[href="/daily-book"]');
      if (!link) return null;
      const rect = link.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });

    if (sidebarPos) {
      console.log("Attempting REAL MOUSE CLICK on Sidebar Daily Book link...");
      await page.mouse.click(sidebarPos.x, sidebarPos.y);
      await new Promise((r) => setTimeout(r, 2000));
      console.log(`URL after mouse click on Daily Book: ${page.url()}`);
    }

    // 5. Test Party Dropdown Click
    const partyDropdownPos = await page.evaluate(() => {
      const select = document.querySelector("select");
      if (!select) return null;
      const rect = select.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });

    if (partyDropdownPos) {
      console.log("Attempting REAL MOUSE CLICK on Party Dropdown...");
      await page.mouse.click(partyDropdownPos.x, partyDropdownPos.y);
      await new Promise((r) => setTimeout(r, 1000));
      console.log("Party dropdown click executed cleanly.");
    }

  } catch (err: any) {
    console.error("Verification Error:", err.message);
  } finally {
    await browser.close();
    if (serverProcess) {
      serverProcess.kill();
    }
    console.log("Render-loop verification finished.");
  }
}

verifyLedgerLoopFixed();
