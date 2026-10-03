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

/**
 * HTML builder for Ledger Statement PDF export.
 */
export function buildLedgerPdfHtml(
  transactions: any[],
  party: any,
  firm: any,
  dateFrom?: string,
  dateTo?: string
): string {
  const firmName = firm?.name || "Transport Company";
  const firmAddress = firm?.address || "";
  const firmPhone = firm?.phone || "";
  const firmGstin = firm?.gstin || "";
  const firmPan = firm?.pan || "";

  const partyName = party?.name || "Customer Ledger";
  const partyPhone = party?.phone || "";
  const partyGstin = party?.gstin || "";

  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  let totalDebit = 0;
  let totalCredit = 0;

  const rowsHtml = transactions.map((t: any, idx: number) => {
    const dr = Number(t.debitAmount || 0);
    const cr = Number(t.creditAmount || 0);
    totalDebit += dr;
    totalCredit += cr;
    const bal = Number(t.runningBalance || 0);
    const bg = idx % 2 === 0 ? "#ffffff" : "#f8f9fa";
    return `
      <tr style="background:${bg};">
        <td style="text-align:center;padding:5pt 4pt;">${idx + 1}</td>
        <td style="text-align:center;padding:5pt 4pt;white-space:nowrap;">${formatDate(t.transactionDate)}</td>
        <td style="padding:5pt 4pt;word-wrap:break-word;">${t.particulars || "-"}</td>
        <td style="text-align:center;padding:5pt 4pt;">${t.voucherType || "-"}</td>
        <td style="text-align:center;padding:5pt 4pt;font-family:monospace;">${t.voucherNumber || "-"}</td>
        <td style="text-align:right;padding:5pt 4pt;color:${dr > 0 ? "#111827" : "#9ca3af"};">${dr > 0 ? fmt(dr) : "-"}</td>
        <td style="text-align:right;padding:5pt 4pt;color:${cr > 0 ? "#111827" : "#9ca3af"};">${cr > 0 ? fmt(cr) : "-"}</td>
        <td style="text-align:right;padding:5pt 4pt;font-weight:700;color:${bal >= 0 ? "#1e3a8a" : "#b91c1c"};">${fmt(bal)}</td>
      </tr>`;
  }).join("");

  const closingBalance = transactions.length > 0 ? Number(transactions[transactions.length - 1].runningBalance || 0) : 0;
  const periodText = dateFrom || dateTo ? `${dateFrom ? formatDate(dateFrom) : "Start"} to ${dateTo ? formatDate(dateTo) : "Present"}` : "All Records";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Ledger Statement — ${partyName}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm 10mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 8.5pt; color: #1f2937; margin: 0; padding: 0; background: #fff; }
    .header { border-bottom: 2pt solid #1e293b; padding-bottom: 8pt; margin-bottom: 10pt; }
    .title-row { display: flex; justify-content: space-between; align-items: flex-start; }
    .firm-name { font-size: 16pt; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
    .firm-meta { font-size: 8pt; color: #475569; margin-top: 2pt; }
    .doc-badge { background: #1e293b; color: #fff; padding: 4pt 10pt; font-size: 11pt; font-weight: 700; border-radius: 4px; text-transform: uppercase; }
    .info-grid { display: flex; gap: 12pt; margin-bottom: 10pt; background: #f8fafc; border: 1pt solid #e2e8f0; border-radius: 6px; padding: 8pt 10pt; }
    .info-box { flex: 1; }
    .info-label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 2pt; }
    .info-val { font-size: 9.5pt; font-weight: 700; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; font-size: 8pt; margin-bottom: 10pt; }
    th { background: #1e293b; color: #ffffff; font-weight: 700; text-transform: uppercase; font-size: 7.5pt; padding: 6pt 4pt; border: 0.5pt solid #1e293b; }
    td { border: 0.5pt solid #cbd5e1; vertical-align: middle; }
    .totals-row td { background: #e2e8f0; font-weight: 700; border-top: 1.5pt solid #0f172a; font-size: 8.5pt; }
    .footer-note { font-size: 7.5pt; color: #64748b; text-align: center; border-top: 0.5pt solid #e2e8f0; padding-top: 6pt; margin-top: 15pt; }
  </style>
</head>
<body>
  <div class="header">
    <table style="width:100%;border:none;margin:0;">
      <tr style="background:transparent;">
        <td style="border:none;padding:0;">
          <div class="firm-name">${firmName}</div>
          <div class="firm-meta">
            ${firmAddress ? firmAddress + " &nbsp;|&nbsp; " : ""}
            ${firmPhone ? "Ph: " + firmPhone + " &nbsp;|&nbsp; " : ""}
            ${firmGstin ? "GSTIN: " + firmGstin + " &nbsp;|&nbsp; " : ""}
            ${firmPan ? "PAN: " + firmPan : ""}
          </div>
        </td>
        <td style="border:none;padding:0;text-align:right;vertical-align:top;">
          <span class="doc-badge">Ledger Statement</span>
        </td>
      </tr>
    </table>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <div class="info-label">Account / Party</div>
      <div class="info-val">${partyName}</div>
      <div style="font-size:8pt;color:#64748b;margin-top:2pt;">
        ${partyPhone ? "Phone: " + partyPhone : ""} ${partyGstin ? "| GSTIN: " + partyGstin : ""}
      </div>
    </div>
    <div class="info-box" style="text-align:right;">
      <div class="info-label">Statement Period</div>
      <div class="info-val">${periodText}</div>
      <div style="font-size:8pt;color:#64748b;margin-top:2pt;">Generated on ${formatDate(new Date().toISOString())}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:24pt;text-align:center;">#</th>
        <th style="width:54pt;text-align:center;">Date</th>
        <th>Particulars</th>
        <th style="width:65pt;text-align:center;">Voucher Type</th>
        <th style="width:70pt;text-align:center;">Voucher No.</th>
        <th style="width:65pt;text-align:right;">Debit (₹)</th>
        <th style="width:65pt;text-align:right;">Credit (₹)</th>
        <th style="width:75pt;text-align:right;">Balance (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || `<tr><td colspan="8" style="text-align:center;padding:12pt;color:#64748b;">No ledger transactions found for this period.</td></tr>`}
      <tr class="totals-row">
        <td colspan="5" style="text-align:right;padding:6pt 4pt;">Totals & Closing Balance</td>
        <td style="text-align:right;padding:6pt 4pt;">${fmt(totalDebit)}</td>
        <td style="text-align:right;padding:6pt 4pt;">${fmt(totalCredit)}</td>
        <td style="text-align:right;padding:6pt 4pt;color:${closingBalance >= 0 ? "#1e3a8a" : "#b91c1c"};">${fmt(closingBalance)}</td>
      </tr>
    </tbody>
  </table>

  <div class="footer-note">
    This is a computer-generated ledger statement for ${partyName} — ${firmName}. Page 1 of 1.
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
      margin: { top: "8mm", bottom: "8mm", left: "10mm", right: "10mm" },
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

