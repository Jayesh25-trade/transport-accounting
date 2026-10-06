import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { firms, parties } from "../db/schema";
import { getBillById } from "./bill.service";
import { listLedgerTransactions } from "./ledger.service";
import { formatDate, numberToWordsIndian } from "../lib/utils";
import { EntityNotFoundError } from "../lib/errors";

import { generateBillInvoiceHtml } from "../lib/pdf-bill-template";

/**
 * Pure HTML/CSS builder for transport bill invoice PDF.
 * Consumes authoritative stored bill data directly without recalculating formulas.
 * Delegates to the unified generateBillInvoiceHtml template generator.
 */
export function buildBillInvoiceHtml(bill: any, firm: any): string {
  return generateBillInvoiceHtml(bill, firm);
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
      browser = await (puppeteer as any).launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      });
    }

    const page = await (browser as any).newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const pdfUint8Array = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "10mm",
        bottom: "14mm",
        left: "10mm",
        right: "10mm",
      },
      displayHeaderFooter: false,
    });

    return Buffer.from(pdfUint8Array);
  } catch (err: any) {
    console.error(`[PDF_GEN_ERROR] Bill ${billId}:`, err?.message || err);
    throw new Error(`Failed to generate PDF for bill ${billId}`);
  } finally {
    if (browser) {
      await (browser as any).close().catch(() => {});
    }
  }
}

import {
  cleanLedgerRow,
  formatIndianCurrency,
  formatLedgerDate,
  sanitizeText,
  stripSymbols,
} from "../lib/ledger-pdf-formatter";

/**
 * HTML builder for Ledger Statement PDF export (Black & White edition).
 */
export function buildLedgerPdfHtml(
  transactions: any[],
  party: any,
  firm: any,
  dateFrom?: string,
  dateTo?: string
): string {
  const firmName = firm?.name ? stripSymbols(firm.name) : "DEEPRAJ TRANSPORT";
  const firmAddress = firm?.address ? stripSymbols(firm.address) : "";
  const firmPhone = firm?.phone ? stripSymbols(firm.phone) : "";
  const firmGstin = firm?.gstin ? stripSymbols(firm.gstin) : "";
  const firmPan = firm?.pan ? stripSymbols(firm.pan) : "";

  const partyName = party?.name ? stripSymbols(party.name) : "Customer Ledger";
  const partyPhone = party?.phone ? stripSymbols(party.phone) : "";
  const partyGstin = party?.gstin ? stripSymbols(party.gstin) : "";

  let totalDebit = 0;
  let totalCredit = 0;

  const cleanedRows = (transactions || []).map((t) => {
    const row = cleanLedgerRow(t);
    totalDebit += row.debitRaw;
    totalCredit += row.creditRaw;
    return row;
  });

  // Calculate opening and closing balance
  let openingBalNum = 0;
  if (cleanedRows.length > 0) {
    const firstRow = cleanedRows[0];
    openingBalNum = firstRow.balanceRaw - firstRow.creditRaw + firstRow.debitRaw;
  }

  const closingBalNum = cleanedRows.length > 0 ? cleanedRows[cleanedRows.length - 1].balanceRaw : openingBalNum;
  const closingBalSuffix = closingBalNum >= 0 ? "Cr" : "Dr";

  const openingBalanceFormatted = openingBalNum === 0 ? "0.00" : `${formatIndianCurrency(Math.abs(openingBalNum))} ${openingBalNum >= 0 ? "Cr" : "Dr"}`;
  const totalDebitFormatted = formatIndianCurrency(totalDebit);
  const totalCreditFormatted = formatIndianCurrency(totalCredit);
  const closingBalanceFormatted = `${formatIndianCurrency(Math.abs(closingBalNum))} ${closingBalSuffix}`;

  // Period display text
  let periodText = "All Records";
  if (dateFrom || dateTo) {
    const fromStr = dateFrom ? formatLedgerDate(dateFrom) : "Start";
    const toStr = dateTo ? formatLedgerDate(dateTo) : "Present";
    periodText = `${fromStr} - ${toStr}`;
  }

  const generatedOnDate = formatLedgerDate(new Date().toISOString());

  // Extract city for jurisdiction
  let jurisdictionCity = "Gandhidham";
  if (firmAddress) {
    const match = firmAddress.match(/\b(Gandhidham|Ahmedabad|Surat|Rajkot|Vadodara|Mumbai|Delhi)\b/i);
    if (match) {
      jurisdictionCity = match[0];
    }
  }

  const renderRow = (r: any) => `
    <tr>
      <td style="text-align:left;vertical-align:top;padding:7px 4px;font-size:11px;white-space:nowrap;color:#000000;">${r.dateFormatted}</td>
      <td style="text-align:left;vertical-align:top;padding:7px 4px;color:#000000;">
        <div style="font-weight:700;font-size:11px;color:#000000;line-height:1.2;">${r.title}</div>
        ${r.narration ? `<div style="font-size:10px;color:#000000;margin-top:2px;line-height:1.2;">${r.narration}</div>` : ""}
      </td>
      <td style="text-align:center;vertical-align:top;padding:7px 4px;font-size:11px;color:#000000;white-space:nowrap;">${r.voucherNumber}</td>
      <td style="text-align:right;vertical-align:top;padding:7px 4px;font-size:11px;color:#000000;white-space:nowrap;font-variant-numeric:tabular-nums;">${r.debitFormatted}</td>
      <td style="text-align:right;vertical-align:top;padding:7px 4px;font-size:11px;color:#000000;white-space:nowrap;font-variant-numeric:tabular-nums;">${r.creditFormatted}</td>
      <td style="text-align:right;vertical-align:top;padding:7px 4px;font-size:11px;font-weight:700;color:#000000;white-space:nowrap;font-variant-numeric:tabular-nums;">${r.balanceFormatted}</td>
    </tr>`;

  const renderTotalsRow = () => `
    <tr class="totals-row">
      <td colspan="3" style="text-align:right;padding:8px 4px;font-weight:700;font-size:11px;color:#000000;border-top:2px solid #000000;border-bottom:2px solid #000000;">TOTAL</td>
      <td style="text-align:right;padding:8px 4px;font-weight:700;font-size:11px;color:#000000;white-space:nowrap;font-variant-numeric:tabular-nums;border-top:2px solid #000000;border-bottom:2px solid #000000;">${totalDebitFormatted}</td>
      <td style="text-align:right;padding:8px 4px;font-weight:700;font-size:11px;color:#000000;white-space:nowrap;font-variant-numeric:tabular-nums;border-top:2px solid #000000;border-bottom:2px solid #000000;">${totalCreditFormatted}</td>
      <td style="text-align:right;padding:8px 4px;font-weight:700;font-size:11px;color:#000000;white-space:nowrap;font-variant-numeric:tabular-nums;border-top:2px solid #000000;border-bottom:2px solid #000000;">${closingBalanceFormatted}</td>
    </tr>`;

  // Rule 5: Keep Total row with at least the last 2 rows using a dedicated keep-together tbody
  let tableBodiesHtml = "";
  if (cleanedRows.length === 0) {
    tableBodiesHtml = `
      <tbody>
        <tr><td colspan="6" style="text-align:center;padding:20px;color:#000000;font-size:12px;">No transactions in this period</td></tr>
        ${renderTotalsRow()}
      </tbody>`;
  } else if (cleanedRows.length <= 2) {
    tableBodiesHtml = `
      <tbody class="keep-together">
        ${cleanedRows.map(renderRow).join("")}
        ${renderTotalsRow()}
      </tbody>`;
  } else {
    const mainRows = cleanedRows.slice(0, cleanedRows.length - 2);
    const lastTwoRows = cleanedRows.slice(cleanedRows.length - 2);
    tableBodiesHtml = `
      <tbody>
        ${mainRows.map(renderRow).join("")}
      </tbody>
      <tbody class="keep-together">
        ${lastTwoRows.map(renderRow).join("")}
        ${renderTotalsRow()}
      </tbody>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Ledger Statement — ${partyName}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: Arial, Helvetica, 'Segoe UI', sans-serif;
      font-size: 11px;
      color: #000000;
      margin: 0;
      padding: 0;
      background: #ffffff;
      line-height: 1.35;
    }

    /* HEADER */
    .header {
      margin-bottom: 10px;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      border: none;
    }
    .firm-name {
      font-size: 22px;
      font-weight: 800;
      color: #000000;
      text-transform: uppercase;
      letter-spacing: -0.2px;
      line-height: 1.1;
      margin-bottom: 4px;
    }
    .firm-meta {
      font-size: 11px;
      color: #000000;
      line-height: 1.4;
    }
    .doc-badge {
      border: 1.5px solid #000000;
      background: #ffffff;
      color: #000000;
      padding: 5px 12px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      display: inline-block;
    }
    .header-line {
      height: 2px;
      background: #000000;
      margin-top: 10px;
    }

    /* PARTY & PERIOD BOX */
    .party-period-box {
      margin-top: 10px;
      margin-bottom: 12px;
    }
    .box-label {
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #000000;
      margin-bottom: 3px;
    }
    .party-name {
      font-size: 15px;
      font-weight: 700;
      color: #000000;
      margin-bottom: 2px;
    }
    .party-meta {
      font-size: 11px;
      color: #000000;
    }
    .period-info {
      text-align: right;
      white-space: nowrap;
    }
    .period-val {
      font-size: 14px;
      font-weight: 700;
      color: #000000;
      margin-bottom: 2px;
    }
    .generated-meta {
      font-size: 11px;
      color: #000000;
    }
    .section-divider {
      height: 1.5px;
      background: #000000;
      margin-top: 10px;
      margin-bottom: 12px;
    }

    /* SUMMARY CARDS */
    .summary-cards {
      display: flex;
      gap: 10px;
      margin-bottom: 0;
    }
    .summary-card {
      flex: 1;
      background: #ffffff;
      border: 1.5px solid #000000;
      padding: 8px 10px;
    }
    .card-label {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #000000;
      margin-bottom: 4px;
    }
    .card-value {
      font-size: 15px;
      font-weight: 700;
      color: #000000;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    /* TRANSACTION TABLE */
    table.txn-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin-bottom: 8px;
    }
    thead {
      display: table-header-group;
    }
    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    th {
      background: #ffffff;
      color: #000000;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 10.5px;
      letter-spacing: 0.3px;
      padding: 8px 4px;
      border-top: 2px solid #000000;
      border-bottom: 2px solid #000000;
    }
    td {
      border-bottom: 1px solid #000000;
    }
    tbody.keep-together {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* FOOTER */
    .footer-container {
      margin-top: 36px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .discrepancy-note {
      font-size: 10px;
      color: #000000;
      line-height: 1.4;
    }
    .signature-block {
      display: inline-block;
      text-align: center;
      min-width: 180px;
    }
    .signature-company {
      font-size: 11px;
      font-weight: 700;
      color: #000000;
      margin-bottom: 36px;
    }
    .signature-line {
      border-top: 1px solid #000000;
      margin-bottom: 4px;
    }
    .signature-label {
      font-size: 11px;
      font-weight: 700;
      color: #000000;
    }
  </style>
</head>
<body>
  <!-- HEADER -->
  <div class="header">
    <table class="header-table">
      <tr style="background:transparent;">
        <td style="border:none;padding:0;vertical-align:top;">
          <div class="firm-name">${firmName}</div>
          <div class="firm-meta">
            ${firmAddress ? firmAddress : ""}
            ${firmAddress && (firmPhone || firmPan) ? "<br>" : ""}
            ${firmPhone ? "Phone: " + firmPhone : ""}
            ${firmPhone && firmPan ? " &nbsp;|&nbsp; " : ""}
            ${firmPan ? "PAN: " + firmPan : ""}
          </div>
        </td>
        <td style="border:none;padding:0;text-align:right;vertical-align:top;">
          <div class="doc-badge">LEDGER STATEMENT</div>
        </td>
      </tr>
    </table>
    <div class="header-line"></div>
  </div>

  <!-- PARTY / PERIOD BOX -->
  <div class="party-period-box">
    <table style="width:100%;border-collapse:collapse;border:none;">
      <tr style="background:transparent;">
        <td style="border:none;padding:0;vertical-align:top;">
          <div class="box-label">ACCOUNT / PARTY</div>
          <div class="party-name">${partyName}</div>
          <div class="party-meta">
            ${partyPhone ? "Phone: " + partyPhone : ""}
            ${partyPhone && partyGstin ? " &nbsp;|&nbsp; " : ""}
            ${partyGstin ? "GSTIN: " + partyGstin : ""}
          </div>
        </td>
        <td style="border:none;padding:0;text-align:right;vertical-align:top;white-space:nowrap;">
          <div class="box-label">STATEMENT PERIOD</div>
          <div class="period-val">${periodText}</div>
          <div class="generated-meta">Generated on ${generatedOnDate}</div>
        </td>
      </tr>
    </table>
    <div class="section-divider"></div>
  </div>

  <!-- SUMMARY CARDS -->
  <div class="summary-cards">
    <div class="summary-card">
      <div class="card-label">OPENING BALANCE</div>
      <div class="card-value">${openingBalanceFormatted}</div>
    </div>
    <div class="summary-card">
      <div class="card-label">TOTAL DEBIT</div>
      <div class="card-value">${totalDebitFormatted}</div>
    </div>
    <div class="summary-card">
      <div class="card-label">TOTAL CREDIT</div>
      <div class="card-value">${totalCreditFormatted}</div>
    </div>
    <div class="summary-card">
      <div class="card-label">CLOSING BALANCE</div>
      <div class="card-value">${closingBalanceFormatted}</div>
    </div>
  </div>
  <div class="section-divider"></div>

  <!-- TRANSACTION TABLE -->
  <table class="txn-table">
    <thead>
      <tr>
        <th style="width:84px;text-align:left;">DATE</th>
        <th style="text-align:left;">PARTICULARS</th>
        <th style="width:60px;text-align:center;">VCH NO.</th>
        <th style="width:92px;text-align:right;">DEBIT</th>
        <th style="width:92px;text-align:right;">CREDIT</th>
        <th style="width:110px;text-align:right;">BALANCE</th>
      </tr>
    </thead>
    ${tableBodiesHtml}
  </table>

  <!-- CURRENCY DISCLAIMER BELOW TABLE -->
  <div style="font-size:10px;color:#000000;margin-top:4px;margin-bottom:24px;">
    All amounts are in Indian Rupees. Cr means amount payable to ${firmName}.
  </div>

  <!-- FOOTER -->
  <div class="footer-container">
    <table style="width:100%;border-collapse:collapse;border:none;margin:0;">
      <tr style="background:transparent;">
        <td style="border:none;padding:0;vertical-align:bottom;width:65%;">
          <div class="discrepancy-note">
            This is a computer generated statement and does not require a signature. Please report any discrepancy within 7 days of receipt. Subject to ${jurisdictionCity} jurisdiction.
          </div>
        </td>
        <td style="border:none;padding:0;text-align:right;vertical-align:bottom;width:35%;">
          <div class="signature-block">
            <div class="signature-company">For ${firmName.toUpperCase()}</div>
            <div class="signature-line"></div>
            <div class="signature-label">Authorised Signatory</div>
          </div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}


/**
 * Generates a PDF Buffer for a party's ledger.
 */
export async function generateLedgerPdfBuffer(
  db: NodePgDatabase<any>,
  firmId: string,
  partyId: string,
  filters?: { dateFrom?: string; dateTo?: string; voucherType?: string; entryType?: string; search?: string }
): Promise<Buffer> {
  const firmRows = await db.select().from(firms).where(eq(firms.id, firmId)).limit(1);
  if (firmRows.length === 0) throw new EntityNotFoundError("Firm", firmId);
  const firm = firmRows[0];

  const partyRows = await db.select().from(parties).where(eq(parties.id, partyId)).limit(1);
  if (partyRows.length === 0) throw new EntityNotFoundError("Party", partyId);
  const party = partyRows[0];

  const transactions = await listLedgerTransactions(db, firmId, partyId, filters);
  const html = buildLedgerPdfHtml(transactions, party, firm, filters?.dateFrom, filters?.dateTo);

  let browser = null;
  try {
    const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    if (isServerless) {
      const chromium = (await import("@sparticuz/chromium")).default as any;
      const puppeteerCore = (await import("puppeteer-core")).default as any;
      const execPath = await chromium.executablePath();
      browser = await puppeteerCore.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: execPath,
        headless: chromium.headless,
      });
    } else {
      let puppeteer;
      try {
        puppeteer = (await import("puppeteer")).default;
      } catch {
        puppeteer = (await import("puppeteer-core")).default;
      }
      browser = await (puppeteer as any).launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      });
    }

    const page = await (browser as any).newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const pdfUint8Array = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "14mm", bottom: "14mm", left: "14mm", right: "14mm" },
      displayHeaderFooter: false,
    });

    return Buffer.from(pdfUint8Array);
  } catch (err: any) {
    console.error(`[PDF_GEN_ERROR] Ledger for party ${partyId}:`, err?.message || err);
    throw new Error(`Failed to generate ledger PDF for party ${partyId}`);
  } finally {
    if (browser) {
      await (browser as any).close().catch(() => {});
    }
  }
}
