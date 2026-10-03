import puppeteer from "puppeteer";
import { db } from "../src/db";
import { bills, firms } from "../src/db/schema";

const PROD_URL = "https://transport-accounting-dusky.vercel.app";

async function inspect403PdfBody() {
  const allFirms = await db.select().from(firms);
  const deeprajFirm = allFirms.find((f) => f.code === "DEEPRAJ")!;
  const allBills = await db.select().from(bills);
  const deeprajBill17 = allBills.find((b) => b.firmId === deeprajFirm.id && b.billNumber === 17)!;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  // Login
  await page.goto(`${PROD_URL}/login`, { waitUntil: "networkidle2" });
  await page.type('input[type="email"]', "jayeshneo07@gmail.com");
  await page.type('input[type="password"]', "Test123456");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2" }),
    page.click('button[type="submit"]'),
  ]);

  const deeprajPdfUrl = `${PROD_URL}/api/bills/${deeprajBill17.id}/pdf?firmId=${deeprajFirm.id}`;
  const resData = await page.evaluate(async (url) => {
    const res = await fetch(url);
    const status = res.status;
    const text = await res.text();
    return { status, text };
  }, deeprajPdfUrl);

  console.log("PDF 403 Response Status:", resData.status);
  console.log("PDF 403 Response Body:", resData.text);

  await browser.close();
}

inspect403PdfBody().catch(console.error);
