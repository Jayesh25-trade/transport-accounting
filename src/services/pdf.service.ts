import puppeteer from "puppeteer";
import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { firms } from "../db/schema";
import { getBillById } from "./bill.service";
import { formatCurrency, formatDate } from "../lib/utils";
import { EntityNotFoundError, FirmIsolationError } from "../lib/errors";

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

  const totalNWeight = Number(bill.totalNWeight || 0);
  const totalRWeight = Number(bill.totalRWeight || 0);

  const items = bill.items || [];

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
      margin-bottom: 16px;
      border-bottom: 2px solid #3b82f6;
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
    .meta-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
    }
    .meta-table td {
      padding: 3px 0;
      font-size: 11px;
    }
    .meta-label {
      color: #64748b;
      font-weight: 600;
      width: 120px;
    }
    .meta-value {
      font-weight: 700;
      color: #0f172a;
      word-break: break-word;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
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
      overflow: hidden;
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

    .summary-section {
      width: 100%;
      margin-top: 12px;
      page-break-inside: avoid;
    }
    .summary-table {
      width: 320px;
      margin-left: auto;
      border-collapse: collapse;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      overflow: hidden;
    }
    .summary-table td {
      padding: 6px 10px;
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
      font-size: 13px !important;
      font-weight: 900 !important;
      border-bottom: none !important;
      color: #ffffff !important;
    }

    .footer-note {
      margin-top: 30px;
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
      font-size: 9px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
    .signature-box {
      margin-top: 40px;
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
        <div class="invoice-title">INVOICE</div>
        <div style="font-size: 12px; font-weight: 700; color: #475569; margin-top: 4px;">
          # ${billNumber}
        </div>
      </td>
    </tr>
  </table>

  <!-- Meta Information -->
  <div class="meta-box">
    <table class="meta-table">
      <tr>
        <td class="meta-label">Billed To (Party):</td>
        <td class="meta-value">${partyName}</td>
        <td class="meta-label text-right">Invoice Date:</td>
        <td class="meta-value text-right">${billDate}</td>
      </tr>
      <tr>
        <td class="meta-label">Total Trips:</td>
        <td class="meta-value">${items.length} Trips</td>
        <td class="meta-label text-right">TDS Applicable:</td>
        <td class="meta-value text-right">
          ${bill.appliedTdsPercentage ? `${bill.appliedTdsPercentage}% (${bill.appliedTdsSection || '94C'})` : 'No'}
        </td>
      </tr>
    </table>
  </div>

  <!-- Trips Breakdown Table -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 30px;" class="text-center">Sr</th>
        <th style="width: 70px;">Date</th>
        <th style="width: 90px;">Truck No</th>
        <th style="width: 80px;">LR No</th>
        <th>Route (From → To)</th>
        <th style="width: 60px;" class="text-right">N-Wt</th>
        <th style="width: 60px;" class="text-right">R-Wt</th>
        <th style="width: 60px;" class="text-right">Rate</th>
        <th style="width: 75px;" class="text-right">Freight</th>
        <th style="width: 70px;" class="text-right">Shortage</th>
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
          <td class="font-mono">${formatDate(item.entryDate)}</td>
          <td style="font-weight: 600;">${item.truckNumber || "-"}</td>
          <td class="font-mono">${item.lrNumber || "-"}</td>
          <td>${item.fromLocation || "-"} → ${item.toLocation || "-"}</td>
          <td class="text-right font-mono">${Number(item.nWeight || 0).toFixed(3)}</td>
          <td class="text-right font-mono">${Number(item.rWeight || 0).toFixed(3)}</td>
          <td class="text-right font-mono">${Number(item.rate || 0).toFixed(2)}</td>
          <td class="text-right font-mono font-medium">${formatCurrency(item.freight)}</td>
          <td class="text-right font-mono" style="color: ${Number(item.shortageDebitAmount) > 0 ? '#dc2626' : '#64748b'};">
            ${Number(item.shortageDebitAmount) > 0 ? `- ${formatCurrency(item.shortageDebitAmount)}` : '-'}
          </td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  <!-- Totals Summary Section -->
  <div class="summary-section">
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

  <!-- Signature Block -->
  <div class="signature-box">
    <div class="signature-title">For ${firmName}</div>
    <div style="height: 40px;"></div>
    <div style="font-size: 10px; color: #64748b;">Authorized Signatory</div>
  </div>

  <!-- Footer Note -->
  <div class="footer-note">
    <span>This is a computer generated transport bill invoice.</span>
    <span>Firm Code: ${firmCode}</span>
  </div>

</body>
</html>
  `;
}

/**
 * Renders server-side PDF buffer for a bill using Puppeteer.
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

  // 4. Render PDF with Puppeteer
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

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
    throw new Error(`Failed to generate PDF for bill ${billId}: ${err.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
