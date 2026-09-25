import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { firms } from "../db/schema";
import { getBillById } from "./bill.service";
import { formatDate, numberToWordsIndian } from "../lib/utils";
import { EntityNotFoundError } from "../lib/errors";

/**
 * Pure HTML/CSS builder for transport bill invoice PDF.
 * Professional Indian Transport Accounting Bill — Tally/BUSY-style document.
 * Consumes authoritative stored bill data directly without recalculating formulas.
 */
export function buildBillInvoiceHtml(bill: any, firm: any): string {
  const firmName    = firm?.name    || "Transport Company";
  const firmCode    = firm?.code    || "";
  const firmPan     = firm?.pan     || "";
  const firmPhone   = firm?.phone   || "";
  const firmAddress = firm?.address || "";
  const firmGstin   = firm?.gstin   || "";

  const partyName  = bill.partyName || "Customer Invoice";
  const billNumber = bill.billNumber;
  const billDate   = formatDate(bill.billDate);

  const subtotalFreight = Number(bill.subtotalFreight || 0);
  const debitNoteAmount = Number(bill.debitNoteAmount || 0);
  const tdsAmount       = Number(bill.tdsAmount       || 0);
  const netBillAmount   = Number(bill.netBillAmount   || 0);
  const receivedAmount  = Number(bill.receivedAmount  || 0);
  const pendingAmount   = Number(bill.pendingAmount   || 0);
  const totalNWeight    = Number(bill.totalNWeight    || 0);
  const totalRWeight    = Number(bill.totalRWeight    || 0);
  const tdsPercent      = bill.appliedTdsPercentage   || "0.00";

  const items: any[]  = bill.items || [];
  const amountInWords = numberToWordsIndian(netBillAmount);

  const companyNames = Array.from(
    new Set(items.map((i: any) => i.companyName || i.companyNameRaw).filter(Boolean))
  ).join(", ");

  const paymentStatus = pendingAmount === 0 ? "PAID"
    : receivedAmount > 0 ? "PARTIALLY PAID"
    : "PENDING";

  const fmt   = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtWt = (n: number) => n.toFixed(3);

  /* ── firm meta line ──────────────────────────────────── */
  const firmMetaParts: string[] = [];
  if (firmAddress) firmMetaParts.push(firmAddress);
  if (firmPhone)   firmMetaParts.push(`Ph: ${firmPhone}`);
  if (firmGstin)   firmMetaParts.push(`GSTIN: ${firmGstin}`);
  if (firmPan)     firmMetaParts.push(`PAN: ${firmPan}`);
  const firmMeta = firmMetaParts.join(" &nbsp;|&nbsp; ");

  /* ── trip table rows ──────────────────────────────────── */
  const tripRows = items.length === 0
    ? `<tr><td colspan="11" style="text-align:center;padding:10pt 4pt;color:#888;font-size:9pt;">No trip records included in this bill.</td></tr>`
    : items.map((item: any, idx: number) => {
        const from     = item.fromLocation || item.fromLocationRaw || "-";
        const to       = item.toLocation   || item.toLocationRaw   || "-";
        const truck    = item.truckNumber  || item.truckNumberRaw  || "-";
        const lrNo     = item.lrNumber     || "-";
        const nWt      = fmtWt(Number(item.nWeight || 0));
        const rWt      = fmtWt(Number(item.rWeight || 0));
        const rate     = fmt(Number(item.rate || item.appliedRate || 0));
        const freight  = fmt(Number(item.freight || 0));
        const shortage = Number(item.shortageDebitAmount || 0);
        const shortStr = shortage > 0 ? fmt(shortage) : "-";
        const bg       = idx % 2 === 0 ? "#ffffff" : "#f6f6f6";
        return `
        <tr style="background:${bg};">
          <td style="text-align:center;">${idx + 1}</td>
          <td style="text-align:center;white-space:nowrap;">${formatDate(item.entryDate || item.tripDate)}</td>
          <td style="text-align:center;font-weight:700;white-space:nowrap;">${truck}</td>
          <td style="text-align:center;white-space:nowrap;">${lrNo}</td>
          <td style="word-wrap:break-word;">${from}</td>
          <td style="word-wrap:break-word;">${to}</td>
          <td style="text-align:right;">${nWt}</td>
          <td style="text-align:right;">${rWt}</td>
          <td style="text-align:right;">${rate}</td>
          <td style="text-align:right;font-weight:700;">${freight}</td>
          <td style="text-align:right;color:${shortage > 0 ? "#b00000" : "#666"};">${shortStr}</td>
        </tr>`;
      }).join("");

  /* ── totals footer row ────────────────────────────────── */
  const totalsRow = `
  <tr style="background:#e8ecf4;font-weight:700;">
    <td colspan="6" style="text-align:right;border-top:1pt solid #999;padding:3pt 4pt;color:#333;">Totals</td>
    <td style="text-align:right;border-top:1pt solid #999;">${fmtWt(totalNWeight)}</td>
    <td style="text-align:right;border-top:1pt solid #999;">${fmtWt(totalRWeight)}</td>
    <td style="border-top:1pt solid #999;"></td>
    <td style="text-align:right;border-top:1pt solid #999;">${fmt(subtotalFreight)}</td>
    <td style="text-align:right;border-top:1pt solid #999;color:#b00000;">${debitNoteAmount > 0 ? fmt(debitNoteAmount) : "-"}</td>
  </tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Transport Bill #${billNumber} — ${firmName}</title>
  <style>
    @page {
      size: A4;
      margin: 8mm 10mm 8mm 10mm;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9pt;
      color: #111111;
      background: #ffffff;
      line-height: 1.3;
    }

    /* ── OUTER BORDER ──────────────────────────── */
    .doc {
      border: 1.5pt solid #111111;
      width: 100%;
    }

    /* ── HEADER ────────────────────────────────── */
    .hdr {
      display: table;
      width: 100%;
      border-bottom: 1.5pt solid #111111;
    }
    .hdr-left {
      display: table-cell;
      padding: 7pt 10pt;
      vertical-align: middle;
    }
    .hdr-right {
      display: table-cell;
      border-left: 1pt solid #111111;
      padding: 7pt 10pt;
      vertical-align: middle;
      text-align: right;
      width: 160pt;
      white-space: nowrap;
    }
    .firm-name {
      font-size: 16pt;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5pt;
      color: #0a1a3a;
    }
    .firm-meta {
      font-size: 7.5pt;
      color: #333333;
      margin-top: 2pt;
    }
    .doc-title {
      font-size: 14pt;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 1.5pt;
      color: #0a1a3a;
      line-height: 1.1;
    }
    .bill-ref-table {
      margin-top: 4pt;
      font-size: 8.5pt;
      font-weight: 700;
      width: 100%;
    }
    .bill-ref-table td {
      padding: 1pt 0;
      text-align: left;
    }
    .bill-ref-table .lbl {
      color: #555;
      width: 60pt;
    }

    /* ── INFO BAND ─────────────────────────────── */
    .info-band {
      display: table;
      width: 100%;
      border-bottom: 1pt solid #111111;
    }
    .ic {
      display: table-cell;
      padding: 6pt 10pt;
      vertical-align: top;
      border-right: 0.75pt solid #aaaaaa;
    }
    .ic:last-child { border-right: none; }
    .ic-lbl {
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      color: #666;
      letter-spacing: 0.5pt;
      margin-bottom: 2pt;
    }
    .ic-val {
      font-size: 9.5pt;
      font-weight: 700;
      color: #111;
    }
    .ic-val.party {
      font-size: 10.5pt;
      text-transform: uppercase;
    }

    /* ── SECTION HEADING ───────────────────────── */
    .sec-hdr {
      background: #0a1a3a;
      color: #ffffff;
      font-size: 7.5pt;
      font-weight: 700;
      letter-spacing: 1pt;
      text-transform: uppercase;
      padding: 3.5pt 10pt;
      border-bottom: 1pt solid #0a1a3a;
    }

    /* ── TRIP TABLE ────────────────────────────── */
    .tt {
      width: 100%;
      border-collapse: collapse;
      font-size: 8pt;
      table-layout: fixed;
    }
    .tt thead tr {
      background: #0a1a3a;
    }
    .tt th {
      color: #ffffff;
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      padding: 4pt 3pt;
      border-right: 0.5pt solid #2a3a6a;
      letter-spacing: 0.2pt;
      vertical-align: bottom;
    }
    .tt th:last-child { border-right: none; }
    .tt td {
      padding: 4pt 3pt;
      border-right: 0.5pt solid #cccccc;
      border-bottom: 0.5pt solid #cccccc;
      vertical-align: top;
      overflow-wrap: break-word;
      word-break: break-word;
    }
    .tt td:last-child { border-right: none; }

    /* fixed column widths for A4 portrait (usable ~175mm) */
    .c-sr   { width: 16pt; }
    .c-dt   { width: 48pt; }
    .c-trk  { width: 58pt; }
    .c-lr   { width: 48pt; }
    .c-from { width: 62pt; }
    .c-to   { width: 62pt; }
    .c-nw   { width: 36pt; }
    .c-rw   { width: 36pt; }
    .c-rt   { width: 40pt; }
    .c-fr   { width: 52pt; }
    .c-sh   { width: 46pt; }

    /* ── WORDS BAND ────────────────────────────── */
    .words-band {
      border-top: 1pt solid #111;
      border-bottom: 1pt solid #111;
      padding: 5pt 10pt;
      font-size: 8pt;
    }
    .words-lbl {
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      color: #555;
      letter-spacing: 0.4pt;
    }
    .words-val {
      font-weight: 700;
      font-size: 8.5pt;
      margin-top: 1pt;
    }

    /* ── SUMMARY BAND ──────────────────────────── */
    .sum-band {
      display: table;
      width: 100%;
      border-bottom: 1pt solid #111;
    }
    .sum-left {
      display: table-cell;
      padding: 7pt 10pt;
      vertical-align: top;
      border-right: 1pt solid #aaaaaa;
    }
    .sum-right {
      display: table-cell;
      vertical-align: top;
      width: 230pt;
    }

    /* payment status */
    .ps-lbl {
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      color: #555;
      letter-spacing: 0.5pt;
      margin-bottom: 4pt;
    }
    .ps-badge {
      display: inline-block;
      font-size: 9pt;
      font-weight: 900;
      letter-spacing: 1pt;
      border: 1.5pt solid #111;
      padding: 2pt 8pt;
      margin-bottom: 7pt;
    }
    .ps-row {
      display: table;
      width: 100%;
      margin-top: 3pt;
      font-size: 8pt;
    }
    .ps-row-lbl { display: table-cell; color: #444; }
    .ps-row-val { display: table-cell; text-align: right; font-weight: 700; font-family: monospace; white-space: nowrap; }

    .wt-sep {
      margin-top: 8pt;
      border-top: 0.5pt solid #ccc;
      padding-top: 5pt;
    }

    /* account summary (right column) */
    .acct-sec-hdr {
      background: #0a1a3a;
      color: #fff;
      font-size: 7pt;
      font-weight: 700;
      letter-spacing: 1pt;
      text-transform: uppercase;
      padding: 3.5pt 10pt;
      border-bottom: 0.5pt solid #aaa;
    }
    .acct-row {
      display: table;
      width: 100%;
      padding: 3pt 10pt;
      border-bottom: 0.5pt solid #ddd;
      font-size: 8pt;
    }
    .acct-lbl { display: table-cell; color: #333; }
    .acct-val { display: table-cell; text-align: right; font-weight: 600; font-family: monospace; white-space: nowrap; }
    .acct-row.deduct .acct-lbl,
    .acct-row.deduct .acct-val { color: #990000; }
    .acct-row.subtotal {
      background: #f0f0f0;
      border-top: 0.5pt solid #999;
    }
    .acct-row.net {
      background: #0a1a3a;
      border-top: 1.5pt solid #0a1a3a;
    }
    .acct-row.net .acct-lbl,
    .acct-row.net .acct-val {
      color: #ffffff;
      font-weight: 900;
      font-size: 9pt;
    }

    /* ── BOTTOM SECTION ────────────────────────── */
    .btm {
      display: table;
      width: 100%;
      border-bottom: 1pt solid #111;
    }
    .btm-left {
      display: table-cell;
      padding: 6pt 10pt;
      font-size: 7.5pt;
      color: #444;
      border-right: 1pt solid #aaa;
      vertical-align: top;
    }
    .btm-right {
      display: table-cell;
      padding: 6pt 10pt 3pt 10pt;
      text-align: right;
      vertical-align: top;
      width: 190pt;
    }
    .sig-firm {
      font-size: 9pt;
      font-weight: 700;
      text-transform: uppercase;
    }
    .sig-line {
      border-bottom: 1pt solid #333;
      height: 30pt;
      margin: 6pt 0 2pt 0;
    }
    .sig-lbl {
      font-size: 7.5pt;
      color: #444;
    }

    /* ── FOOTER ────────────────────────────────── */
    .ftr {
      display: table;
      width: 100%;
      padding: 3.5pt 10pt;
      font-size: 7pt;
      color: #555;
    }
    .ftr-left  { display: table-cell; }
    .ftr-right { display: table-cell; text-align: right; }
  </style>
</head>
<body>
<div class="doc">

  <!-- ═══ HEADER ═══════════════════════════════════════ -->
  <div class="hdr">
    <div class="hdr-left">
      <div class="firm-name">${firmName}</div>
      ${firmMeta ? `<div class="firm-meta">${firmMeta}</div>` : ""}
    </div>
    <div class="hdr-right">
      <div class="doc-title">Transport Bill</div>
      <table class="bill-ref-table">
        <tr>
          <td class="lbl">Bill No.&nbsp;</td>
          <td>:&nbsp; <strong>#${billNumber}</strong></td>
        </tr>
        <tr>
          <td class="lbl">Bill Date</td>
          <td>:&nbsp; <strong>${billDate}</strong></td>
        </tr>
      </table>
    </div>
  </div>

  <!-- ═══ INFO BAND ════════════════════════════════════ -->
  <div class="info-band">
    <div class="ic" style="width:auto;">
      <div class="ic-lbl">Bill To &mdash; Customer / Party</div>
      <div class="ic-val party">${partyName}</div>
      ${companyNames ? `<div style="font-size:7.5pt;margin-top:2pt;color:#444;">Loading Co.: <strong>${companyNames}</strong></div>` : ""}
    </div>
    <div class="ic" style="width:90pt;">
      <div class="ic-lbl">Bill No.</div>
      <div class="ic-val">#${billNumber}</div>
    </div>
    <div class="ic" style="width:90pt;">
      <div class="ic-lbl">Bill Date</div>
      <div class="ic-val">${billDate}</div>
    </div>
    <div class="ic" style="width:70pt;border-right:none;">
      <div class="ic-lbl">Total Trips</div>
      <div class="ic-val">${items.length}</div>
    </div>
  </div>

  <!-- ═══ TRIP TABLE ═══════════════════════════════════ -->
  <div class="sec-hdr">Trip Details</div>
  <table class="tt">
    <colgroup>
      <col class="c-sr">
      <col class="c-dt">
      <col class="c-trk">
      <col class="c-lr">
      <col class="c-from">
      <col class="c-to">
      <col class="c-nw">
      <col class="c-rw">
      <col class="c-rt">
      <col class="c-fr">
      <col class="c-sh">
    </colgroup>
    <thead>
      <tr>
        <th style="text-align:center;">Sr.</th>
        <th style="text-align:center;">Date</th>
        <th style="text-align:center;">Truck No.</th>
        <th style="text-align:center;">LR No.</th>
        <th>From</th>
        <th>To</th>
        <th style="text-align:right;">N-Wt<br><span style="font-weight:400;">(MT)</span></th>
        <th style="text-align:right;">R-Wt<br><span style="font-weight:400;">(MT)</span></th>
        <th style="text-align:right;">Rate<br><span style="font-weight:400;">(&#8377;)</span></th>
        <th style="text-align:right;">Freight<br><span style="font-weight:400;">(&#8377;)</span></th>
        <th style="text-align:right;">Shortage<br><span style="font-weight:400;">(&#8377;)</span></th>
      </tr>
    </thead>
    <tbody>
      ${tripRows}
    </tbody>
    <tfoot>
      ${totalsRow}
    </tfoot>
  </table>

  <!-- ═══ AMOUNT IN WORDS ══════════════════════════════ -->
  <div class="words-band">
    <span class="words-lbl">Amount in Words (Net Payable):&nbsp;</span>
    <span class="words-val">${amountInWords}</span>
  </div>

  <!-- ═══ PAYMENT STATUS + ACCOUNT SUMMARY ════════════ -->
  <div class="sum-band">

    <!-- Left: Payment Status + Weights -->
    <div class="sum-left">
      <div class="ps-lbl">Payment Status</div>
      <div class="ps-badge">${paymentStatus}</div>
      <div class="ps-row">
        <span class="ps-row-lbl">Received Amount</span>
        <span class="ps-row-val">&#8377;&nbsp;${fmt(receivedAmount)}</span>
      </div>
      <div class="ps-row">
        <span class="ps-row-lbl">Pending / Outstanding</span>
        <span class="ps-row-val" style="color:${pendingAmount > 0 ? "#990000" : "#111"};">&#8377;&nbsp;${fmt(pendingAmount)}</span>
      </div>
      ${totalNWeight > 0 ? `
      <div class="wt-sep">
        <div class="ps-row">
          <span class="ps-row-lbl">Total Loading Wt. (N-Wt.)</span>
          <span class="ps-row-val">${fmtWt(totalNWeight)} MT</span>
        </div>
        <div class="ps-row">
          <span class="ps-row-lbl">Total Received Wt. (R-Wt.)</span>
          <span class="ps-row-val">${fmtWt(totalRWeight)} MT</span>
        </div>
      </div>` : ""}
    </div>

    <!-- Right: Account Summary -->
    <div class="sum-right">
      <div class="acct-sec-hdr">Account Summary</div>
      <div class="acct-row">
        <span class="acct-lbl">Gross Freight</span>
        <span class="acct-val">&#8377; ${fmt(subtotalFreight)}</span>
      </div>
      ${debitNoteAmount > 0 ? `
      <div class="acct-row deduct">
        <span class="acct-lbl">Less: Shortage Debit Note</span>
        <span class="acct-val">( ${fmt(debitNoteAmount)} )</span>
      </div>` : ""}
      ${tdsAmount > 0 ? `
      <div class="acct-row deduct">
        <span class="acct-lbl">Less: TDS @ ${tdsPercent}%</span>
        <span class="acct-val">( ${fmt(tdsAmount)} )</span>
      </div>` : ""}
      <div class="acct-row subtotal">
        <span class="acct-lbl" style="color:#111;font-weight:700;">Total Deductions</span>
        <span class="acct-val">( ${fmt(debitNoteAmount + tdsAmount)} )</span>
      </div>
      <div class="acct-row net">
        <span class="acct-lbl">NET PAYABLE</span>
        <span class="acct-val">&#8377; ${fmt(netBillAmount)}</span>
      </div>
    </div>

  </div>

  <!-- ═══ TERMS + SIGNATURE ════════════════════════════ -->
  <div class="btm">
    <div class="btm-left">
      <strong>Note:</strong> This bill is subject to the terms agreed between the parties.
    </div>
    <div class="btm-right">
      <div class="sig-firm">For ${firmName}</div>
      <div class="sig-line"></div>
      <div class="sig-lbl">Authorised Signatory</div>
    </div>
  </div>

  <!-- ═══ FOOTER ════════════════════════════════════════ -->
  <div class="ftr">
    <span class="ftr-left">This is a computer-generated transport bill.</span>
    <span class="ftr-right">${firmCode ? `Firm Code: ${firmCode} &nbsp;|&nbsp; ` : ""}Page 1 of 1</span>
  </div>

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
        top: "8mm",
        bottom: "8mm",
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
