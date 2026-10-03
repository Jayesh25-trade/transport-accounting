import * as fs from "fs";
import * as path from "path";
import puppeteer from "puppeteer";
import { buildBillInvoiceHtml } from "../src/services/pdf.service";

async function main() {
  const firm = {
    name: "DEEPRAJ TRANSPORT",
    code: "DEEPRAJ",
    pan: "AQEPM2120M",
    phone: "",
    address: "",
    gstin: "",
  };

  const bill = {
    id: "c992eeb1-69f5-4c1e-aec3-46affc820e5a",
    billNumber: "1",
    billDate: "2026-09-25",
    partyName: "Fairway Dream Pvt. Ltd.",
    subtotalFreight: 133000,
    debitNoteAmount: 5600,
    tdsAmount: 1330,
    netBillAmount: 126070,
    receivedAmount: 126070,
    pendingAmount: 0,
    totalNWeight: 40.000,
    totalRWeight: 38.000,
    appliedTdsPercentage: "1.00",
    status: "POSTED",
    items: [
      {
        entryDate: "2026-09-25",
        truckNumber: "MH02AB5896",
        lrNumber: "LR-9082",
        fromLocation: "WADHKAL",
        toLocation: "Pune",
        nWeight: 40.000,
        rWeight: 38.000,
        rate: 3500.00,
        freight: 133000,
        shortageDebitAmount: 5600,
      },
    ],
  };

  const html = buildBillInvoiceHtml(bill, firm);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "domcontentloaded" });

  const pdfBufferUint8 = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: {
      top: "8mm",
      bottom: "8mm",
      left: "10mm",
      right: "10mm",
    },
    displayHeaderFooter: false,
  });

  const pdfBuffer = Buffer.from(pdfBufferUint8);
  const pdfPath = path.join(__dirname, "../local_bill1_microfix_preview.pdf");
  fs.writeFileSync(pdfPath, pdfBuffer);
  console.log("Saved microfix PDF to:", pdfPath, "(", pdfBuffer.length, "bytes)");

  // Render first page screenshot of PDF
  await page.setViewport({ width: 1200, height: 1600 });
  const pngPath = path.join(__dirname, "../local_bill1_microfix_preview.png");
  await page.screenshot({ path: pngPath, fullPage: true });

  const brainDir = "C:/Users/SHRIRAM/.gemini/antigravity-ide/brain/14c6df3a-3aea-4f5f-b31f-c2b1d6cdee34";
  if (fs.existsSync(brainDir)) {
    fs.copyFileSync(pngPath, path.join(brainDir, "bill1_microfix_preview.png"));
    console.log("Copied PNG preview to brain artifacts directory as bill1_microfix_preview.png");
  }

  await browser.close();
  console.log("Done.");
}

main().catch(err => {
  console.error("Error generating microfix preview:", err);
  process.exit(1);
});
