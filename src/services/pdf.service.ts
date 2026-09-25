import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { firms } from "../db/schema";
import { getBillById } from "./bill.service";
import { formatCurrency, formatDate, numberToWordsIndian } from "../lib/utils";
import { EntityNotFoundError } from "../lib/errors";

/**
 * Pure HTML/CSS builder for transport bill invoice PDF.
 * Consumes authoritative stored bill data directly without recalculating formulas.
 */
export function buildBillInvoiceHtml(bill: any, firm: any): string {
  const firmName = firm?.name || "Transport Company";
  const firmCode = firm?.code || "";
  const firmPan = firm?.pan || "";
  const firmPhone = firm?.phone || "";
  const firmAddress = firm?.address || "";

  const partyName = bill.partyName || "Customer Invoice";
  const billNumber = bill.billNumber;
  const billDate = formatDate(bill.billDate);

  const subtotalFreight = Number(bill.subtotalFreight || 0);
  const debitNoteAmount = Number(bill.debitNoteAmount || 0);
  const tdsAmount = Number(bill.tdsAmount || 0);
  const netBillAmount = Number(bill.netBillAmount || 0);
  const receivedAmount = Number(bill.receivedAmount || 0);
  const pendingAmount = Number(bill.pendingAmount || 0);

  const totalNWeight = Number(bill.totalNWeight || 0);
  const totalRWeight = Number(bill.totalRWeight || 0);

  const items: any[] = bill.items || [];
  const amountInWords = numberToWordsIndian(netBillAmount);

  // Derive unique company names from items if present
  const companyNames = Array.from(
    new Set(items.map((i) => i.companyName || i.companyNameRaw).filter(Boolean))
  ).join(", ");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Bill Invoice #${billNumber}</title>
  <style>
    @page {
      size: A4;
      margin: 15mm 12mm 15mm 12mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: #1f2937;
      margin: 0;
      padding: 0;
      background: #ffffff;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 8px;
    }
    .firm-title {
      font-size: 18px;
      font-weight: 800;
      color: #1e3a8a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .firm-details {
      font-size: 10px;
      color: #4b5563;
      margin-top: 2px;
    }
    .invoice-title {
      font-size: 20px;
      font-weight: 900;
      color: #1e40af;
      text-align: right;
    }
    .invoice-no {
      font-size: 12px;
      font-weight: 700;
      color: #475569;
      margin-top: 2px;
    }
    .meta-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 12px;
      margin-bottom: 14px;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
    }
    .meta-table td {
      padding: 3px 0;
      font-size: 11px;
      vertical-align: top;
    }
    .meta-label {
      color: #64748b;
      font-weight: 600;
      width: 130px;
    }
    .meta-value {
      font-weight: 700;
      color: #0f172a;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      table-layout: fixed;
    }
    .items-table thead {
      display: table-header-group;
    }
    .items-table tr {
      page-break-inside: avoid;
    }
    .items-table th {
      background: #1e3a8a;
      color: #ffffff;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 6px 8px;
      border: 1px solid #1e3a8a;
      text-align: left;
    }
    .items-table td {
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
      font-size: 10px;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .items-table tbody tr:nth-child(even) {
      background: #f8fafc;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }

    .summary-wrapper {
      width: 100%;
      margin-top: 12px;
      page-break-inside: avoid;
    }
    .amount-words-box {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 12px;
    }
    .amount-words-label {
      font-size: 9px;
      font-weight: 700;
      color: #1d4ed8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .amount-words-value {
      font-size: 11px;
      font-weight: 800;
      color: #1e3a8a;
      margin-top: 1px;
    }

    .totals-and-status {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }
    .status-card {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 12px;
      background: #f8fafc;
      width: 220px;
      font-size: 10px;
    }
    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 800;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .status-posted { background: #dbeafe; color: #1e40af; }
    .status-paid { background: #d1fae5; color: #065f46; }
    .status-pending { background: #fef3c7; color: #92400e; }

    .summary-table {
      width: 330px;
      border-collapse: collapse;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      overflow: hidden;
    }
    .summary-table td {
      padding: 5px 10px;
      font-size: 11px;
      border-bottom: 1px solid #e2e8f0;
    }
    .summary-label {
      color: #475569;
      font-weight: 600;
    }
    .summary-value {
      text-align: right;
      font-weight: 700;
    }
    .net-payable-row {
      background: #047857 !important;
      color: #ffffff !important;
    }
    .net-payable-row td {
      font-size: 12px !important;
      font-weight: 900 !important;
      border-bottom: none !important;
      color: #ffffff !important;
    }

    .footer-note {
      margin-top: 24px;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
      font-size: 9px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
    .signature-box {
      margin-top: 30px;
      text-align: right;
      page-break-inside: avoid;
    }
    .signature-title {
      font-size: 10px;
      font-weight: 700;
      color: #334155;
    }
  </style>
</head>
<body>

  <!-- Firm Header -->
  <table class="header-table">
    <tr>
      <td style="vertical-align: top;">
        <div class="firm-title">${firmName}</div>
        <div class="firm-details">
          ${firmAddress ? `${firmAddress}<br>` : ""}
          ${firmPhone ? `Phone: ${firmPhone} | ` : ""}
          ${firmPan ? `PAN: ${firmPan}` : ""}
        </div>
      </td>
      <td style="vertical-align: top;" class="text-right">
        <div class="invoice-title">TRANSPORT INVOICE</div>
        <div class="invoice-no">Bill #${billNumber}</div>
      </td>
    </tr>
  </table>

  <!-- Meta Information -->
  <div class="meta-box">
    <table class="meta-table">
      <tr>
        <td class="meta-label">Billed To (Customer):</td>
        <td class="meta-value">${partyName}</td>
        <td class="meta-label text-right">Invoice Date:</td>
        <td class="meta-value text-right">${billDate}</td>
      </tr>
      <tr>
        <td class="meta-label">Loading Company / Site:</td>
        <td class="meta-value">${companyNames || "—"}</td>
        <td class="meta-label text-right">Total Trips:</td>
        <td class="meta-value text-right">${items.length} Trips</td>
      </tr>
    </table>
  </div>

  <!-- Trips Breakdown Table -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 25px;" class="text-center">Sr</th>
        <th style="width: 65px;">Date</th>
        <th style="width: 85px;">Truck No</th>
        <th style="width: 70px;">LR No</th>
        <th>Route (From → To)</th>
        <th style="width: 55px;" class="text-right">N-Wt</th>
        <th style="width: 55px;" class="text-right">R-Wt</th>
        <th style="width: 55px;" class="text-right">Rate</th>
        <th style="width: 70px;" class="text-right">Freight</th>
        <th style="width: 65px;" class="text-right">Shortage</th>
      </tr>
    </thead>
    <tbody>
      ${items.length === 0 ? `
        <tr>
          <td colSpan="10" class="text-center" style="padding: 15px; color: #94a3b8;">No trip records included in this bill.</td>
        </tr>
      ` : items.map((item: any, idx: number) => `
        <tr>
          <td class="text-center font-mono">${idx + 1}</td>
          <td class="font-mono">${formatDate(item.entryDate || item.tripDate)}</td>
          <td style="font-weight: 600;">${item.truckNumber || item.truckNumberRaw || "-"}</td>
          <td class="font-mono">${item.lrNumber || "-"}</td>
          <td>${item.fromLocation || item.fromLocationRaw || "-"} → ${item.toLocation || item.toLocationRaw || "-"}</td>
          <td class="text-right font-mono">${Number(item.nWeight || 0).toFixed(3)}</td>
          <td class="text-right font-mono">${Number(item.rWeight || 0).toFixed(3)}</td>
          <td class="text-right font-mono">${Number(item.rate || item.appliedRate || 0).toFixed(2)}</td>
          <td class="text-right font-mono font-medium">${formatCurrency(item.freight)}</td>
          <td class="text-right font-mono" style="color: ${Number(item.shortageDebitAmount) > 0 ? '#dc2626' : '#64748b'};">
            ${Number(item.shortageDebitAmount) > 0 ? `- ${formatCurrency(item.shortageDebitAmount)}` : '-'}
          </td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  <!-- Totals & Summary Wrapper -->
  <div class="summary-wrapper">
    <!-- Amount In Words -->
    <div class="amount-words-box">
      <div class="amount-words-label">Amount in Words</div>
      <div class="amount-words-value">${amountInWords}</div>
    </div>

    <div class="totals-and-status">
      <!-- Status & Accounting Breakdown Card -->
      <div class="status-card">
        <div style="margin-bottom: 6px;">
          <span style="color: #64748b; font-weight: 600;">Bill Status:</span>
          <span class="status-badge ${pendingAmount === 0 ? 'status-paid' : 'status-posted'}">
            ${pendingAmount === 0 ? 'PAID' : bill.status || 'POSTED'}
          </span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 4px;">
          <span style="color: #64748b;">Received Amount:</span>
          <span class="font-mono" style="font-weight: 700; color: #059669;">${formatCurrency(receivedAmount)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 2px;">
          <span style="color: #64748b;">Pending Outstanding:</span>
          <span class="font-mono" style="font-weight: 700; color: #d97706;">${formatCurrency(pendingAmount)}</span>
        </div>
      </div>

      <!-- Financial Calculation Summary Table -->
      <table class="summary-table">
        <tr>
          <td class="summary-label">Total Loading Wt (N-Wt):</td>
          <td class="summary-value font-mono">${totalNWeight.toFixed(3)} MT</td>
        </tr>
        <tr>
          <td class="summary-label">Total Received Wt (R-Wt):</td>
          <td class="summary-value font-mono">${totalRWeight.toFixed(3)} MT</td>
        </tr>
        <tr>
          <td class="summary-label">Subtotal Gross Freight:</td>
          <td class="summary-value font-mono">${formatCurrency(subtotalFreight)}</td>
        </tr>
        ${debitNoteAmount > 0 ? `
        <tr>
          <td class="summary-label" style="color: #dc2626;">Less: Shortage Debit Note:</td>
          <td class="summary-value font-mono" style="color: #dc2626;">- ${formatCurrency(debitNoteAmount)}</td>
        </tr>
        ` : ""}
        ${tdsAmount > 0 ? `
        <tr>
          <td class="summary-label" style="color: #7c3aed;">Less: TDS (${bill.appliedTdsPercentage}%):</td>
          <td class="summary-value font-mono" style="color: #7c3aed;">- ${formatCurrency(tdsAmount)}</td>
        </tr>
        ` : ""}
        <tr class="net-payable-row">
          <td>NET PAYABLE AMOUNT:</td>
          <td class="text-right font-mono">${formatCurrency(netBillAmount)}</td>
        </tr>
      </table>
    </div>
  </div>

  <!-- Signature Block -->
  <div class="signature-box">
    <div class="signature-title">For ${firmName}</div>
    <div style="height: 35px;"></div>
    <div style="font-size: 10px; color: #64748b;">Authorized Signatory</div>
  </div>

  <!-- Footer Note -->
  <div class="footer-note">
    <span>This is a computer-generated transport bill invoice.</span>
    <span>Firm Code: ${firmCode}</span>
  </div>

</body>
</html>
  `;
}

/**
 * Renders server-side PDF buffer for a bill using Puppeteer.
 * Supports Vercel Serverless environment via @sparticuz/chromium and puppeteer-core.
 * Enforces firm isolation and consumes stored authoritative domain values.
 */
export async function generateBillPdfBuffer(
  db: NodePgDatabase<any>,
  firmId: string,
  billId: string
): Promise<Buffer> {
  // 1. Fetch authoritative bill details
  const bill = await getBillById(db, billId, firmId);
  if (!bill) {
    throw new EntityNotFoundError("Bill", billId);
  }

  // 2. Fetch firm details
  const firmRows = await db
    .select()
    .from(firms)
    .where(eq(firms.id, firmId))
    .limit(1);

  if (firmRows.length === 0) {
    throw new EntityNotFoundError("Firm", firmId);
  }
  const firm = firmRows[0];

  // 3. Build HTML string
  const html = buildBillInvoiceHtml(bill, firm);

  // 4. Render PDF with environment-aware Puppeteer launcher
  let browser = null;
  try {
    const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

    if (isServerless) {
      const chromium = (await import("@sparticuz/chromium")).default as any;
      const puppeteerCore = (await import("puppeteer-core")).default as any;

      try {
        const execPath = await chromium.executablePath();
        browser = await puppeteerCore.launch({
          args: chromium.args,
          defaultViewport: chromium.defaultViewport,
          executablePath: execPath,
          headless: chromium.headless,
        });
      } catch (err: any) {
        console.warn("[PDF_SERVICE] Primary chromium launch failed, falling back to release pack tarball:", err?.message || err);
        const remoteExecPath = await chromium.executablePath(
          "https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar"
        );
        browser = await puppeteerCore.launch({
          args: chromium.args,
          defaultViewport: chromium.defaultViewport,
          executablePath: remoteExecPath,
          headless: chromium.headless,
        });
      }
    } else {
      let puppeteer;
      try {
        puppeteer = (await import("puppeteer")).default;
      } catch {
        puppeteer = (await import("puppeteer-core")).default;
      }
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      });
    }

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const pdfUint8Array = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "15mm",
        bottom: "15mm",
        left: "12mm",
        right: "12mm",
      },
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: `
        <div style="font-size: 8px; font-family: sans-serif; width: 100%; text-align: right; padding-right: 12mm; color: #94a3b8;">
          Page <span class="pageNumber"></span> of <span class="totalPages"></span>
        </div>
      `,
    });

    return Buffer.from(pdfUint8Array);
  } catch (err: any) {
    console.error(`[PDF_GEN_ERROR] Bill ${billId}:`, err?.message || err);
    throw new Error(`Failed to generate PDF for bill ${billId}`);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
