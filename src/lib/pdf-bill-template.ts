import { ARIAL_REGULAR_BASE64, ARIAL_BOLD_BASE64 } from "@/lib/fonts/font-data";
import { formatDate, numberToWordsIndian } from "@/lib/utils";

export interface BillTemplateData {
  bill: any;
  firm: any;
}

/**
 * Pure HTML & CSS Template Generator for Tally / BUSY Accounting Software Style Invoices.
 *
 * Design Spec & Structural Rules:
 * - Title "TRANSPORT BILL" centred above the 190mm frame in brand orange (#E05638, 12pt bold, letter-spacing 0.08em).
 * - Single outer frame container of width 190mm (0.4mm border #374151, box-sizing: border-box).
 * - Header Row (62% / 38%): Firm name 16pt bold, tagline, address, contact line; 2x2 grid for Bill no (plain "3"), Bill date, Due date, Payment terms.
 * - Bill-to Row (62% / 38%): "BILL TO", party name (as stored), address/GSTIN/phone; Place of supply / Reverse charge on right if enabled.
 * - Ruled Item Table (190mm width, 11 columns summing to 100%):
 *   Sr 7mm (3.6842%), Date 19mm (10%), Truck 22mm (11.5789%), LR no 15mm (7.8947%), Route 30mm (15.7895%),
 *   N-Wt 14mm (7.3684%), R-Wt 14mm (7.3684%), Rate 16mm (8.4211%), Freight 21mm (11.0526%), Short 12mm (6.3158%), Balance 20mm (10.5263%).
 * - Tally Table Style: Light grey header fill (#F3F4F6) with dark bold text, thin vertical lines (0.2mm #9CA3AF) between columns,
 *   NO horizontal lines between body rows, min-height ~70mm, header alignments matching cells (text left, numeric right),
 *   Short column shows numbers or neutral "—" (no green, no text "NO").
 * - TOTAL Row: Light grey fill (#F3F4F6), 0.4mm top & bottom borders (#374151), totals under respective columns.
 * - Amount in Words: Full-width ruled row inside frame.
 * - Lower Section (58% / 42%): Left = Bank details, Terms & Conditions, Payment status (friendly chip); Right = Summary table (Gross freight, Less: shortage/TDS/voucher in red, Net Payable in #FDF1EC band, balance outstanding).
 * - Signature Row (58% / 42%): Left = Receiver's signature (~18mm blank); Right = "For <Firm name>", ~18mm blank, "Authorised signatory".
 * - Pinned Page Footer: "Computer-generated bill." left, "Page X of Y" right (no internal codes).
 */
export function generateBillInvoiceHtml(bill: any, firm: any): string {
  const firmName = firm?.name || "DEEPRAJ TRANSPORT";
  const firmAddress = firm?.address || "";
  const firmPhone = firm?.phone || "";
  const firmEmail = firm?.email || "";
  const firmPan = firm?.pan || "";
  const firmGstin = firm?.gstin || "";
  const logoUrl = firm?.logoUrl || firm?.logo || "";

  const partyName = bill?.partyName || "Sample Traders Pvt. Ltd.";
  const billNumber = bill?.billNumber !== undefined && bill?.billNumber !== null ? String(bill.billNumber) : "3";
  const billDate = bill?.billDate ? formatDate(bill.billDate) : "—";
  const partyAddress = bill?.partyAddress || bill?.party?.address || "";
  const partyGstin = bill?.partyGstin || bill?.party?.gstin || "";
  const partyPhone = bill?.partyPhone || bill?.party?.phone || "";

  const items: any[] = bill?.items || [];
  const hasItems = items.length > 0;

  // Compute column totals from items if present, else stored header values
  const totalNWeight = hasItems
    ? items.reduce((sum: number, i: any) => sum + Number(i.nWeight || 0), 0)
    : Number(bill?.totalNWeight || 0);
  const totalRWeight = hasItems
    ? items.reduce((sum: number, i: any) => sum + Number(i.rWeight || 0), 0)
    : Number(bill?.totalRWeight || 0);

  // Authoritative Stored Financials
  const subtotalFreight = Number(bill?.subtotalFreight || 0);
  const debitNoteAmount = Number(bill?.debitNoteAmount || 0);
  const amountAfterShortage = Math.max(0, subtotalFreight - debitNoteAmount);

  const tdsPercent = bill?.appliedTdsPercentage ? String(bill.appliedTdsPercentage) : "0.00";
  const tdsAmount = Number(bill?.tdsAmount || 0);
  const driverVoucherTotal = Number(bill?.driverVoucherTotal || 0);
  const netBillAmount = Number(bill?.netBillAmount || 0);
  const receivedAmount = Number(bill?.receivedAmount || 0);
  const pendingAmount = Number(bill?.pendingAmount ?? (netBillAmount - receivedAmount));

  const amountInWords = numberToWordsIndian(netBillAmount);

  // Derive payment status
  const paymentStatusText =
    pendingAmount <= 0
      ? "Paid"
      : receivedAmount > 0
      ? "Partially Paid"
      : "Pending";

  // Display Options Snapshot & Bank Details
  const opts = bill?.displayOptionsSnapshot || {};
  const showBank = opts.showBankDetails ?? true;
  const showPaymentTerms = opts.showPaymentTerms ?? true;
  const showDueDate = opts.showDueDate ?? true;
  const showWords = opts.showAmountInWords ?? true;
  const showRemarks = opts.showRemarks ?? true;
  const showTerms = opts.showTermsAndConditions ?? true;
  const showSignature = opts.showAuthorisedSignature ?? true;
  const showVehicleType = opts.showVehicleType ?? false;
  const showPlaceOfSupply = opts.showPlaceOfSupply ?? true;
  const showReverseCharge = opts.showReverseCharge ?? false;

  const placeOfSupplyText = bill?.placeOfSupply || firm?.state || "";
  const reverseChargeText = bill?.reverseCharge ? "Yes" : "No";

  const bankSnap = bill?.bankDetailsSnapshot || null;
  const paymentTermsText = bill?.paymentTerms || "30 Days";
  const dueDateText = bill?.dueDate ? formatDate(bill.dueDate) : null;
  const termsText = bill?.termsAndConditions || "Payment to be made within 30 days. Subject to local jurisdiction.";
  const remarksText = bill?.notes || null;

  // Formatting helpers
  const fmtMoney = (n: number) =>
    "₹" +
    n.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const fmtBare = (n: number) =>
    n.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const fmtWt = (n: number) => (n > 0 ? n.toFixed(3) : "—");

  // Format short column display value per business rule (YES if shortage debit > 0, else NO)
  const formatShortValue = (val: any) => {
    const num = Number(val || 0);
    if (!isNaN(num) && num > 0) {
      return "YES";
    }
    return "NO";
  };

  // Firm contact line (ONLY existing fields)
  const firmMetaParts: string[] = [];
  if (firmPhone) firmMetaParts.push(`Ph: ${firmPhone}`);
  if (firmEmail) firmMetaParts.push(`Email: ${firmEmail}`);
  if (firmPan) firmMetaParts.push(`PAN: ${firmPan}`);
  if (firmGstin) firmMetaParts.push(`GSTIN: ${firmGstin}`);
  const firmMetaLine = firmMetaParts.join(" · ");

  // Party sub line (Address, GSTIN, Phone)
  const partySubParts: string[] = [];
  if (partyAddress) partySubParts.push(partyAddress);
  if (partyGstin) partySubParts.push(`GSTIN ${partyGstin}`);
  if (partyPhone) partySubParts.push(partyPhone);
  const partySubLine = partySubParts.join(" · ");

  // Right cell fields for Header 2x2 grid
  const hasDueDate = showDueDate && Boolean(dueDateText);
  const hasPayTerms = showPaymentTerms && Boolean(paymentTermsText);

  // Right cell fields for Bill-To row
  const hasPlaceOfSupply = showPlaceOfSupply && Boolean(placeOfSupplyText);
  const hasReverseCharge = showReverseCharge && Boolean(bill?.reverseCharge);
  const hasBillToRight = hasPlaceOfSupply || hasReverseCharge;

  // Render Trip Table Body Rows (11 Columns)
  const tripRowsHtml = items
    .map((item: any, idx: number) => {
      const entryDate = item.entryDate || item.tripDate ? formatDate(item.entryDate || item.tripDate) : "—";
      const truck = item.truckNumber || item.truckNumberRaw || "—";
      const lrNo = item.lrNumber || "—";
      const origin = item.fromLocation || item.fromLocationRaw || "";
      const dest = item.toLocation || item.toLocationRaw || "";
      let routeStr = "—";
      if (origin && dest) routeStr = `${origin} → ${dest}`;
      else if (origin) routeStr = origin;
      else if (dest) routeStr = dest;

      const vehicleTypeStr = showVehicleType && (item.vehicleType || item.truckType) ? String(item.vehicleType || item.truckType) : "";

      const nWtNum = Number(item.nWeight || 0);
      const rWtNum = Number(item.rWeight || 0);
      const rateNum = Number(item.rate || item.appliedRate || 0);
      const freightAmt = Number(item.freight || 0);
      const shortageVal = item.shortageDebitAmount || item.shortage;
      const shortDisplay = formatShortValue(shortageVal);
      const shortageNum =
        shortageVal !== null &&
        shortageVal !== undefined &&
        shortageVal !== "" &&
        shortageVal !== "NO" &&
        !isNaN(Number(shortageVal))
          ? Number(shortageVal)
          : 0;
      const balanceAmt = freightAmt - shortageNum;

      return `
      <tr>
        <td class="col-sr cell-text">${idx + 1}</td>
        <td class="col-dt cell-text nowrap">${entryDate}</td>
        <td class="col-trk cell-text bold">
          ${truck}
          ${vehicleTypeStr ? `<div class="sub-muted">${vehicleTypeStr}</div>` : ""}
        </td>
        <td class="col-lr cell-text">${lrNo}</td>
        <td class="col-route cell-text route-cell">${routeStr}</td>
        <td class="col-nwt cell-num">${fmtWt(nWtNum)}</td>
        <td class="col-rwt cell-num">${fmtWt(rWtNum)}</td>
        <td class="col-rate cell-num">${rateNum > 0 ? fmtBare(rateNum) : "—"}</td>
        <td class="col-frt cell-num bold">${fmtBare(freightAmt)}</td>
        <td class="col-short cell-num">${shortDisplay}</td>
        <td class="col-bal cell-num bold">${fmtBare(balanceAmt)}</td>
      </tr>`;
    })
    .join("");

  // Totals Row
  const totalsRowHtml = `
  <tr class="totals-row">
    <td colspan="5" class="col-total-label cell-text bold">TOTAL</td>
    <td class="col-nwt cell-num bold">${totalNWeight > 0 ? fmtWt(totalNWeight) : "—"}</td>
    <td class="col-rwt cell-num bold">${totalRWeight > 0 ? fmtWt(totalRWeight) : "—"}</td>
    <td class="col-rate cell-num"></td>
    <td class="col-frt cell-num bold">${fmtBare(subtotalFreight)}</td>
    <td class="col-short cell-num"></td>
    <td class="col-bal cell-num bold">${fmtBare(amountAfterShortage)}</td>
  </tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Bill ${billNumber} — ${partyName}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 10mm 14mm 10mm;
    }

    @font-face {
      font-family: 'AppPdfFont';
      src: url(data:font/ttf;charset=utf-8;base64,${ARIAL_REGULAR_BASE64}) format('truetype');
      font-weight: 400;
      font-style: normal;
    }

    @font-face {
      font-family: 'AppPdfFont';
      src: url(data:font/ttf;charset=utf-8;base64,${ARIAL_BOLD_BASE64}) format('truetype');
      font-weight: 700;
      font-style: normal;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'AppPdfFont', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 9pt;
      color: #111827;
      background: #ffffff;
      line-height: 1.35;
      font-variant-numeric: tabular-nums;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* Outer centered title above frame */
    .outer-doc-title {
      text-align: center;
      font-size: 12pt;
      font-weight: 700;
      color: #E05638;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 2.5mm;
    }

    /* Main 190mm single box frame */
    .invoice-frame {
      width: 190mm;
      margin: 0 auto;
      border: 0.4mm solid #374151;
      box-sizing: border-box;
      background: #ffffff;
    }

    /* Common Table Structure inside frame */
    .frame-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    /* Standard cell labels & values */
    .cell-lbl {
      font-size: 7pt;
      font-weight: 600;
      text-transform: uppercase;
      color: #4B5563;
      letter-spacing: 0.4pt;
      line-height: 1.1;
    }
    .cell-val {
      font-size: 9pt;
      font-weight: 700;
      color: #111827;
      margin-top: 1px;
    }
    .sub-muted {
      font-size: 7.5pt;
      color: #6B7280;
      font-weight: normal;
    }
    .bold { font-weight: 700; }

    /* ── HEADER ROW (62% / 38%) ────────────────────────────── */
    .hdr-row {
      border-bottom: 0.4mm solid #374151;
    }
    .hdr-left {
      width: 62%;
      vertical-align: top;
      padding: 3mm 3.5mm;
      border-right: 0.2mm solid #9CA3AF;
    }
    .hdr-right {
      width: 38%;
      vertical-align: top;
      padding: 0;
    }

    .firm-name {
      font-size: 16pt;
      font-weight: 700;
      color: #111827;
      letter-spacing: normal;
      line-height: 1.15;
    }
    .firm-tagline {
      font-size: 8.5pt;
      color: #4B5563;
      margin-top: 1px;
    }
    .firm-address {
      font-size: 8.5pt;
      color: #111827;
      margin-top: 2px;
    }
    .firm-meta {
      font-size: 8pt;
      color: #374151;
      margin-top: 2px;
    }
    .firm-logo {
      max-height: 40px;
      max-width: 160px;
      margin-bottom: 3px;
      object-fit: contain;
    }

    /* 2x2 Header Grid */
    .grid-2x2 {
      width: 100%;
      height: 100%;
      border-collapse: collapse;
    }
    .grid-cell {
      padding: 2.5mm 3mm;
      border-right: 0.2mm solid #9CA3AF;
      border-bottom: 0.2mm solid #9CA3AF;
      vertical-align: top;
    }
    .grid-cell:last-child {
      border-right: none;
    }
    .grid-row-bottom .grid-cell {
      border-bottom: none;
    }

    /* ── BILL TO ROW (62% / 38%) ────────────────────────────── */
    .billto-row {
      border-bottom: 0.4mm solid #374151;
    }
    .billto-left {
      vertical-align: top;
      padding: 2.5mm 3.5mm;
    }
    .billto-right {
      width: 38%;
      vertical-align: top;
      padding: 2.5mm 3mm;
      border-left: 0.2mm solid #9CA3AF;
    }
    .party-name {
      font-size: 9.5pt;
      font-weight: 700;
      color: #111827;
      margin-top: 1px;
    }
    .party-sub {
      font-size: 8.5pt;
      color: #374151;
      margin-top: 1px;
    }

    /* ── ITEM TABLE (190mm Width, 11 Columns, Exact % Summing to 100%) ── */
    .item-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 8pt;
    }
    .item-table thead {
      display: table-header-group;
    }
    .item-table tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* Tally Column Widths (Sum = 190mm = 100.00%) */
    .col-sr    { width: 3.6842%; }  /* 7mm */
    .col-dt    { width: 10.0000%; } /* 19mm */
    .col-trk   { width: 11.5789%; } /* 22mm */
    .col-lr    { width: 7.8947%; }  /* 15mm */
    .col-route { width: 15.7895%; } /* 30mm */
    .col-nwt   { width: 7.3684%; }  /* 14mm */
    .col-rwt   { width: 7.3684%; }  /* 14mm */
    .col-rate  { width: 8.4211%; }  /* 16mm */
    .col-frt   { width: 11.0526%; } /* 21mm */
    .col-short { width: 6.3158%; }  /* 12mm */
    .col-bal   { width: 10.5263%; } /* 20mm */

    .item-table th {
      background-color: #F3F4F6;
      color: #111827;
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      padding: 2.2mm 2px;
      border-right: 0.2mm solid #9CA3AF;
      border-bottom: 0.4mm solid #374151;
      border-top: none;
      border-left: none;
      vertical-align: middle;
      white-space: nowrap;
    }
    .item-table th:last-child {
      border-right: none;
    }

    /* Body Row Alignment & Borders */
    .item-table td {
      padding: 2mm 2px;
      border-right: 0.2mm solid #9CA3AF;
      border-bottom: none; /* NO horizontal lines between body rows per Tally style */
      vertical-align: top;
      overflow-wrap: break-word;
      word-break: break-word;
    }
    .item-table td:last-child {
      border-right: none;
    }

    .cell-text { text-align: left; }
    .cell-num  { text-align: right; }
    .nowrap    { white-space: nowrap; }
    .route-cell {
      line-height: 1.2;
      color: #111827;
    }

    /* Minimum Height for Table Body Container (min-height ~70mm) */
    .item-table-container {
      min-height: 70mm;
      width: 100%;
    }

    /* TOTAL Row */
    .item-table tr.totals-row td {
      background-color: #F3F4F6;
      border-top: 0.4mm solid #374151;
      border-bottom: 0.4mm solid #374151;
      font-weight: 700;
      color: #111827;
      padding-top: 2.2mm;
      padding-bottom: 2.2mm;
    }

    /* ── AMOUNT IN WORDS ────────────────────────────────────── */
    .words-row {
      border-bottom: 0.4mm solid #374151;
      padding: 2mm 3.5mm;
      font-size: 8.5pt;
    }
    .words-lbl {
      font-size: 7pt;
      font-weight: 600;
      text-transform: uppercase;
      color: #4B5563;
      letter-spacing: 0.4pt;
    }
    .words-val {
      font-size: 9pt;
      font-weight: 700;
      color: #111827;
    }

    /* ── LOWER SECTION (58% / 42%) ──────────────────────────── */
    .lower-row {
      border-bottom: 0.4mm solid #374151;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .lower-left {
      width: 58%;
      vertical-align: top;
      padding: 0;
      border-right: 0.2mm solid #9CA3AF;
    }
    .lower-right {
      width: 42%;
      vertical-align: top;
      padding: 0;
    }

    .lower-block {
      padding: 2.5mm 3.5mm;
      border-bottom: 0.2mm solid #E5E7EB;
    }
    .lower-block:last-child {
      border-bottom: none;
    }

    .status-chip {
      display: inline-block;
      font-size: 8.5pt;
      font-weight: 700;
      color: #111827;
    }

    /* Summary Table */
    .summary-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
    }
    .summary-table td {
      padding: 2.2mm 3.5mm;
      border-bottom: 0.2mm solid #E5E7EB;
    }
    .sum-lbl {
      color: #111827;
      font-weight: 500;
      text-align: left;
    }
    .sum-val {
      text-align: right;
      font-weight: 700;
      color: #111827;
      white-space: nowrap;
    }
    .deduct-row .sum-lbl,
    .deduct-row .sum-val {
      color: #B91C1C;
    }
    .sub-muted-line {
      font-size: 7.5pt;
      color: #6B7280;
      display: block;
      font-weight: normal;
    }
    .net-payable-row {
      background-color: #FDF1EC;
      border-top: 0.4mm solid #374151;
      border-bottom: 0.2mm solid #E5E7EB;
    }
    .net-payable-row .sum-lbl,
    .net-payable-row .sum-val {
      font-size: 10.5pt;
      font-weight: 700;
      color: #111827;
    }
    .outstanding-row {
      font-size: 8pt;
      color: #6B7280;
      text-align: right;
      padding: 1.5mm 3.5mm;
    }

    /* ── SIGNATURE ROW (58% / 42%) ──────────────────────────── */
    .sig-row {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .sig-left {
      width: 58%;
      vertical-align: bottom;
      padding: 2.5mm 3.5mm;
      border-right: 0.2mm solid #9CA3AF;
    }
    .sig-right {
      width: 42%;
      vertical-align: bottom;
      padding: 2.5mm 3.5mm;
      text-align: right;
    }
    .sig-space {
      height: 18mm;
    }
    .sig-firm-title {
      font-size: 9pt;
      font-weight: 700;
      color: #111827;
    }
    .sig-label {
      font-size: 7.5pt;
      font-weight: 600;
      color: #4B5563;
    }

    /* ── PINNED PAGE FOOTER ─────────────────────────────────── */
    .page-footer-container {
      margin-top: 3mm;
      width: 190mm;
      margin-left: auto;
      margin-right: auto;
    }
    .footer-table {
      width: 100%;
      border-collapse: collapse;
      border-top: 0.2mm solid #9CA3AF;
      padding-top: 1.5mm;
      font-size: 7.5pt;
      color: #6B7280;
    }
  </style>
</head>
<body>

  <!-- Outer Centered Document Title -->
  <div class="outer-doc-title">TRANSPORT BILL</div>

  <!-- Single 190mm Outer Box Frame Container -->
  <div class="invoice-frame">

    <!-- ═══ 1. HEADER ROW (62% / 38%) ══════════════════════════ -->
    <table class="frame-table hdr-row">
      <tr>
        <td class="hdr-left">
          ${logoUrl ? `<img src="${logoUrl}" alt="Logo" class="firm-logo" />` : ""}
          <div class="firm-name">${firmName}</div>
          <div class="firm-tagline">Fleet Owner &amp; Transport Contractors</div>
          ${firmAddress ? `<div class="firm-address">${firmAddress}</div>` : ""}
          ${firmMetaLine ? `<div class="firm-meta">${firmMetaLine}</div>` : ""}
        </td>
        <td class="hdr-right">
          <table class="grid-2x2">
            <tr>
              <td class="grid-cell">
                <div class="cell-lbl">Bill no.</div>
                <div class="cell-val">${billNumber}</div>
              </td>
              <td class="grid-cell">
                <div class="cell-lbl">Bill date</div>
                <div class="cell-val">${billDate}</div>
              </td>
            </tr>
            <tr class="grid-row-bottom">
              ${
                hasDueDate
                  ? `<td class="grid-cell">
                      <div class="cell-lbl">Due date</div>
                      <div class="cell-val">${dueDateText}</div>
                    </td>`
                  : ""
              }
              ${
                hasPayTerms
                  ? `<td class="grid-cell" ${!hasDueDate ? 'colspan="2"' : ""}>
                      <div class="cell-lbl">Payment terms</div>
                      <div class="cell-val">${paymentTermsText}</div>
                    </td>`
                  : !hasDueDate
                  ? `<td class="grid-cell" colspan="2"></td>`
                  : ""
              }
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- ═══ 2. BILL TO ROW (62% / 38%) ═════════════════════════ -->
    <table class="frame-table billto-row">
      <tr>
        <td class="billto-left" style="${!hasBillToRight ? 'width:100%;' : ''}">
          <div class="cell-lbl">Bill to</div>
          <div class="party-name">${partyName}</div>
          ${partySubLine ? `<div class="party-sub">${partySubLine}</div>` : ""}
        </td>
        ${
          hasBillToRight
            ? `<td class="billto-right">
                ${
                  hasPlaceOfSupply
                    ? `<div class="cell-lbl">Place of supply</div>
                       <div class="cell-val">${placeOfSupplyText}</div>`
                    : ""
                }
                ${
                  hasReverseCharge
                    ? `<div class="cell-lbl" style="${hasPlaceOfSupply ? 'margin-top:2mm;' : ''}">Reverse charge</div>
                       <div class="cell-val">${reverseChargeText}</div>`
                    : ""
                }
              </td>`
            : ""
        }
      </tr>
    </table>

    <!-- ═══ 3. ITEM TABLE (190mm Width, 11 Columns Summing to 100%) ═══ -->
    <div class="item-table-container">
      <table class="item-table">
        <thead>
          <tr>
            <th class="col-sr cell-text">Sr</th>
            <th class="col-dt cell-text">Date</th>
            <th class="col-trk cell-text">Truck</th>
            <th class="col-lr cell-text">LR no</th>
            <th class="col-route cell-text">Route</th>
            <th class="col-nwt cell-num">N-Wt (T)</th>
            <th class="col-rwt cell-num">R-Wt (T)</th>
            <th class="col-rate cell-num">Rate</th>
            <th class="col-frt cell-num">Freight</th>
            <th class="col-short cell-num">Short</th>
            <th class="col-bal cell-num">Balance</th>
          </tr>
        </thead>
        <tbody>
          ${tripRowsHtml}
        </tbody>
        <tfoot>
          ${totalsRowHtml}
        </tfoot>
      </table>
    </div>

    <!-- ═══ 4. AMOUNT IN WORDS ═════════════════════════════════ -->
    ${
      showWords
        ? `<div class="words-row">
            <span class="words-lbl">AMOUNT IN WORDS:&nbsp;</span>
            <span class="words-val">${amountInWords}</span>
          </div>`
        : ""
    }

    <!-- ═══ 5. LOWER SECTION (58% / 42%) ═══════════════════════ -->
    <table class="frame-table lower-row">
      <tr>
        <!-- Left Column: Bank, Terms, Payment Status, Remarks -->
        <td class="lower-left">
          ${
            showBank && bankSnap
              ? `<div class="lower-block">
                  <div class="cell-lbl">BANK DETAILS</div>
                  <div class="cell-val" style="font-size:8.5pt;">
                    ${bankSnap.bankName || bankSnap.accountDisplayName || "Sample Bank"} · A/C ${bankSnap.accountNumber || "0000 0000 0000"} · IFSC ${bankSnap.ifscCode || "SAMP0000001"}
                    ${bankSnap.branch ? ` · Branch: ${bankSnap.branch}` : ""}
                    ${bankSnap.upiId ? `<br>UPI ID: ${bankSnap.upiId}` : ""}
                  </div>
                </div>`
              : ""
          }

          ${
            showTerms && termsText
              ? `<div class="lower-block">
                  <div class="cell-lbl">TERMS &amp; CONDITIONS</div>
                  <div class="cell-val" style="font-size:8pt; font-weight:normal; color:#374151;">${termsText}</div>
                </div>`
              : ""
          }

          <div class="lower-block">
            <div class="cell-lbl">PAYMENT STATUS</div>
            <div class="status-chip">${paymentStatusText}</div>
          </div>

          ${
            showRemarks && remarksText
              ? `<div class="lower-block">
                  <div class="cell-lbl">REMARKS</div>
                  <div class="cell-val" style="font-size:8.5pt; font-weight:normal;">${remarksText}</div>
                </div>`
              : ""
          }
        </td>

        <!-- Right Column: Account Summary -->
        <td class="lower-right">
          <table class="summary-table">
            <tbody>
              <tr>
                <td class="sum-lbl">Gross freight</td>
                <td class="sum-val">${fmtMoney(subtotalFreight)}</td>
              </tr>

              ${
                debitNoteAmount > 0
                  ? `<tr class="deduct-row">
                      <td class="sum-lbl">Less: Shortage Debit Note</td>
                      <td class="sum-val">- ${fmtMoney(debitNoteAmount)}</td>
                    </tr>`
                  : ""
              }

              ${
                tdsAmount > 0
                  ? `<tr class="deduct-row">
                      <td class="sum-lbl">
                        Less: TDS @ ${tdsPercent}%
                        <span class="sub-muted-line">on amount after shortage</span>
                      </td>
                      <td class="sum-val" style="vertical-align:top;">- ${fmtMoney(tdsAmount)}</td>
                    </tr>`
                  : ""
              }

              ${
                driverVoucherTotal > 0
                  ? `<tr class="deduct-row">
                      <td class="sum-lbl">Less: Driver voucher</td>
                      <td class="sum-val">- ${fmtMoney(driverVoucherTotal)}</td>
                    </tr>`
                  : ""
              }

              <tr class="net-payable-row">
                <td class="sum-lbl">NET PAYABLE</td>
                <td class="sum-val">${fmtMoney(netBillAmount)}</td>
              </tr>
            </tbody>
          </table>

          ${
            pendingAmount > 0 && receivedAmount > 0
              ? `<div class="outstanding-row">Balance outstanding ${fmtMoney(pendingAmount)}</div>`
              : ""
          }
        </td>
      </tr>
    </table>

    <!-- ═══ 6. SIGNATURE ROW (58% / 42%) ═══════════════════════ -->
    ${
      showSignature
        ? `<table class="frame-table sig-row">
            <tr>
              <td class="sig-left">
                <div class="sig-space"></div>
                <div class="sig-label">Receiver's signature</div>
              </td>
              <td class="sig-right">
                <div class="sig-firm-title">For ${firmName}</div>
                <div class="sig-space"></div>
                <div class="sig-label">Authorised signatory</div>
              </td>
            </tr>
          </table>`
        : ""
    }

  </div> <!-- End of .invoice-frame -->

  <!-- ═══ PINNED FOOTER ═════════════════════════════════════ -->
  <div class="page-footer-container">
    <table class="footer-table">
      <tr>
        <td class="cell-text">Computer-generated bill.</td>
        <td class="cell-num">Page 1 of 1</td>
      </tr>
    </table>
  </div>

</body>
</html>`;
}
