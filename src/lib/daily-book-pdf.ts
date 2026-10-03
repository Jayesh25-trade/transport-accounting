import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { formatDate, formatCurrency } from "@/lib/utils";
import { ARIAL_REGULAR_BASE64, ARIAL_BOLD_BASE64 } from "@/lib/fonts/font-data";

export interface DailyBookExportRow {
  srNo: number;
  entryDate: string; // YYYY-MM-DD
  truckNumber: string;
  lrNumber: string;
  fromLocation: string;
  toLocation: string;
  nWeight: number;
  rWeight: number;
  shortage: number;
  partyName: string;
  companyName: string;
  rate: number;
  isReceived: boolean;
}

export interface DailyBookExportOptions {
  firmName: string;
  fromDate?: string;
  toDate?: string;
  partyFilterName?: string;
  companyFilterName?: string;
  truckFilterName?: string;
  statusFilterName?: string;
  rows: DailyBookExportRow[];
  actionType: "download-pdf" | "print-pdf" | "download-excel";
}

function formatCurrencyPdf(val: number): string {
  if (val === undefined || val === null || isNaN(val) || val <= 0) return "₹0.00";
  return formatCurrency(val);
}

export async function generateDailyBookExport(options: DailyBookExportOptions): Promise<{ filename: string; blob?: Blob }> {
  const {
    firmName,
    fromDate,
    toDate,
    partyFilterName,
    companyFilterName,
    truckFilterName,
    statusFilterName,
    rows,
    actionType,
  } = options;

  const sanitizeName = (str: string) => str.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_");
  const firmClean = sanitizeName(firmName || "Firm");
  const dateSuffix = fromDate && toDate ? `${fromDate}_to_${toDate}` : new Date().toISOString().split("T")[0];
  const filenameBase = `DailyBook_${firmClean}_${dateSuffix}`;

  // ─── 1. Excel Export Handler ──────────────────────────────────
  if (actionType === "download-excel") {
    const excelRows = rows.map((r) => ({
      "SR": r.srNo,
      "Date": formatDate(r.entryDate),
      "Truck": r.truckNumber || "—",
      "LR No": r.lrNumber || "—",
      "From Location": r.fromLocation || "—",
      "To Location": r.toLocation || "—",
      "N-WT (T)": r.nWeight,
      "R-WT (T)": r.rWeight,
      "Shortage (T)": r.shortage > 0 ? r.shortage : 0,
      "Party (Billing)": r.partyName || "—",
      "Company (Site)": r.companyName || "—",
      "Rate (₹/T)": r.rate,
      "Amount (₹)": r.rate * r.rWeight,
      "Status": r.isReceived ? "Received" : "Pending",
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Daily Book");
    XLSX.writeFile(workbook, `${filenameBase}.xlsx`);
    return { filename: `${filenameBase}.xlsx` };
  }

  // ─── 2. PDF Generation Handler (A4 Landscape) ──────────────────
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  // Register Font with Rupee (₹) Symbol Support
  doc.addFileToVFS("ArialCustom-Regular.ttf", ARIAL_REGULAR_BASE64);
  doc.addFont("ArialCustom-Regular.ttf", "ArialCustom", "normal");
  doc.addFileToVFS("ArialCustom-Bold.ttf", ARIAL_BOLD_BASE64);
  doc.addFont("ArialCustom-Bold.ttf", "ArialCustom", "bold");
  doc.setFont("ArialCustom", "normal");

  // Calculate totals
  const totalN = rows.reduce((sum, r) => sum + r.nWeight, 0);
  const totalR = rows.reduce((sum, r) => sum + r.rWeight, 0);
  const totalShortage = rows.reduce((sum, r) => sum + r.shortage, 0);

  const totalTrips = rows.length;
  const periodText = fromDate && toDate ? `Period: ${formatDate(fromDate)} – ${formatDate(toDate)}` : "Period: All dates";
  const nowStr = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
    ", " +
    new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

  const filterSummary = `Filters: Party – ${partyFilterName || "All"} · Company – ${companyFilterName || "All"} · Truck – ${truckFilterName || "All"} · Status – ${statusFilterName || "All"}`;

  // Document metadata
  doc.setProperties({
    title: `Daily Book — ${firmName}`,
    subject: "Daily Operational Roznamcha Report",
    author: firmName,
    creator: "Transport App",
  });

  // Page dimensions (A4 Landscape: 297mm x 210mm)
  const pageWidth = doc.internal.pageSize.getWidth(); // ~297mm
  const pageHeight = doc.internal.pageSize.getHeight(); // ~210mm
  const marginLeft = 10;
  const marginTop = 10;
  const marginRight = 10;
  const marginBottom = 12;
  const usableWidth = pageWidth - marginLeft - marginRight; // 277mm

  // Header Block
  doc.setFont("ArialCustom", "bold");
  doc.setFontSize(15);
  doc.setTextColor(17, 24, 39);
  doc.text(firmName.toUpperCase(), marginLeft, marginTop + 5, { maxWidth: usableWidth - 100 });

  doc.setFont("ArialCustom", "bold");
  doc.setFontSize(12);
  doc.setTextColor(17, 24, 39);
  doc.text("DAILY BOOK (ROZNAMCHA)", pageWidth - marginRight, marginTop + 5, { align: "right" });

  doc.setFont("ArialCustom", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(107, 114, 128);
  doc.text(periodText, pageWidth - marginRight, marginTop + 9.5, { align: "right" });
  doc.text(`Generated: ${nowStr}`, pageWidth - marginRight, marginTop + 13.5, { align: "right" });

  // Orange Rule Divider Line
  const ruleY = marginTop + 16;
  doc.setDrawColor(224, 86, 56); // #E05638
  doc.setLineWidth(0.6);
  doc.line(marginLeft, ruleY, pageWidth - marginRight, ruleY);

  // Filters summary line
  doc.setFont("ArialCustom", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(75, 85, 99);
  doc.text(filterSummary, marginLeft, ruleY + 5);

  // Summary Cards Strip (4 Equal Boxes)
  const stripY = ruleY + 8;
  const numBoxes = 4;
  const boxGap = 4;
  const boxWidth = (usableWidth - (numBoxes - 1) * boxGap) / numBoxes; // ~66.25mm
  const boxHeight = 11;

  const boxes = [
    { title: "TOTAL TRIPS", value: String(totalTrips) },
    { title: "TOTAL N-WT (T)", value: totalN.toFixed(3) },
    { title: "TOTAL R-WT (T)", value: totalR.toFixed(3) },
    { title: "TOTAL SHORTAGE (T)", value: totalShortage > 0 ? totalShortage.toFixed(3) : "—" },
  ];

  boxes.forEach((b, idx) => {
    const x = marginLeft + idx * (boxWidth + boxGap);
    doc.setFillColor(247, 247, 245);
    doc.roundedRect(x, stripY, boxWidth, boxHeight, 1.5, 1.5, "F");

    doc.setFont("ArialCustom", "bold");
    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128);
    doc.text(b.title, x + 3, stripY + 4);

    doc.setFont("ArialCustom", "bold");
    doc.setFontSize(10);
    doc.setTextColor(17, 24, 39);
    doc.text(b.value, x + 3, stripY + 9);
  });

  const tableStartY = stripY + boxHeight + 4;

  // Table Data Mapping (12 Columns)
  const tableHead = [
    [
      "SR",
      "DATE",
      "TRUCK",
      "LR NO",
      "ROUTE",
      "N-WT (T)",
      "R-WT (T)",
      "SHORT (T)",
      "PARTY (BILLING)",
      "COMPANY (SITE)",
      "RATE (₹/T)",
      "STATUS",
    ],
  ];

  const tableBody = rows.map((r) => [
    r.srNo,
    formatDate(r.entryDate),
    r.truckNumber || "—",
    r.lrNumber || "—",
    `${r.fromLocation || "—"} → ${r.toLocation || "—"}`,
    r.nWeight.toFixed(3),
    r.rWeight.toFixed(3),
    r.shortage > 0 ? r.shortage.toFixed(3) : "—",
    r.partyName || "—",
    r.companyName || "—",
    formatCurrencyPdf(r.rate),
    r.isReceived ? "Received" : "Pending",
  ]);

  // Totals Footer Row with Colspan
  const tableFoot: any = [
    [
      { content: `TOTAL (${totalTrips} TRIPS)`, colSpan: 5, styles: { halign: "left", fontStyle: "bold" } },
      { content: totalN.toFixed(3), styles: { halign: "right", fontStyle: "bold" } },
      { content: totalR.toFixed(3), styles: { halign: "right", fontStyle: "bold" } },
      { content: totalShortage > 0 ? totalShortage.toFixed(3) : "—", styles: { halign: "right", fontStyle: "bold" } },
      { content: "", colSpan: 4 },
    ],
  ];

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: marginLeft, right: marginRight, top: marginTop + 10, bottom: marginBottom + 6 },
    head: tableHead,
    body: tableBody,
    foot: tableFoot,
    theme: "plain",
    tableWidth: usableWidth,
    showHead: "everyPage",
    rowPageBreak: "avoid",
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 22, halign: "left" },
      2: { cellWidth: 26, halign: "left" },
      3: { cellWidth: 22, halign: "left" },
      4: { cellWidth: 52, halign: "left" },
      5: { cellWidth: 18, halign: "right" },
      6: { cellWidth: 18, halign: "right" },
      7: { cellWidth: 18, halign: "right" },
      8: { cellWidth: 34, halign: "left" },
      9: { cellWidth: 34, halign: "left" },
      10: { cellWidth: 24, halign: "right" },
      11: { cellWidth: 21, halign: "center" },
    },
    styles: {
      font: "ArialCustom",
      fontSize: 8,
      cellPadding: 2,
      lineColor: [229, 231, 235],
      lineWidth: 0.1,
      textColor: [17, 24, 39],
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [31, 41, 55],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      font: "ArialCustom",
      fontSize: 7.5,
      halign: "left",
    },
    alternateRowStyles: {
      fillColor: [247, 247, 245],
    },
    footStyles: {
      fillColor: [247, 247, 245],
      textColor: [17, 24, 39],
      fontStyle: "bold",
      font: "ArialCustom",
      fontSize: 8,
      lineWidth: { top: 0.5 },
      lineColor: [31, 41, 55],
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 11) {
        const val = String(data.cell.raw);
        if (val === "Received") {
          data.cell.styles.textColor = [4, 120, 87]; // Emerald green
          data.cell.styles.fontStyle = "bold";
        } else {
          data.cell.styles.textColor = [180, 83, 9]; // Amber
          data.cell.styles.fontStyle = "bold";
        }
      }
      if (data.section === "body" && data.column.index === 7) {
        const val = String(data.cell.raw);
        if (val !== "—") {
          data.cell.styles.textColor = [185, 28, 28]; // Red
        }
      }
    },
  });

  // Check signature block position & page overflow
  const finalY = (doc as any).lastAutoTable?.finalY || tableStartY + 40;
  let sigY = finalY + 10;

  if (sigY + 22 > pageHeight - marginBottom) {
    doc.addPage();
    sigY = marginTop + 15;
  }

  // Signature Block: 3 Equal Columns
  const gap = 10;
  const colWidth = (usableWidth - 2 * gap) / 3; // ~85.6mm per column

  const sigCols = [
    { line1: "Prepared by", line2: "" },
    { line1: "Checked by", line2: "" },
    { line1: "Authorised Signatory", line2: `For ${firmName}` },
  ];

  sigCols.forEach((col, idx) => {
    const x = marginLeft + idx * (colWidth + gap);

    // Signature Top Line
    doc.setDrawColor(156, 163, 175);
    doc.setLineWidth(0.3);
    doc.line(x, sigY, x + colWidth, sigY);

    // Label Line 1
    doc.setFont("ArialCustom", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(31, 41, 55);
    doc.text(col.line1, x, sigY + 4.5);

    // Label Line 2 (Firm name)
    if (col.line2) {
      doc.setFont("ArialCustom", "normal");
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.text(col.line2, x, sigY + 8.5, { maxWidth: colWidth });
    }
  });

  // Page Numbers Footer on every page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    const footerY = pageHeight - 5;
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.2);
    doc.line(marginLeft, footerY - 3, pageWidth - marginRight, footerY - 3);

    doc.setFont("ArialCustom", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(107, 114, 128);

    doc.text(`${firmName} · Daily Book`, marginLeft, footerY);
    doc.text("System-generated report", pageWidth / 2, footerY, { align: "center" });
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - marginRight, footerY, { align: "right" });
  }

  const pdfBlob = doc.output("blob");
  const pdfFilename = `${filenameBase}.pdf`;

  if (actionType === "download-pdf") {
    doc.save(pdfFilename);
    return { filename: pdfFilename, blob: pdfBlob };
  } else if (actionType === "print-pdf") {
    const blobUrl = URL.createObjectURL(pdfBlob);
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.src = blobUrl;

    document.body.appendChild(iframe);

    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error("Iframe print failed, falling back to window.open", e);
          window.open(blobUrl, "_blank");
        } finally {
          setTimeout(() => {
            document.body.removeChild(iframe);
            URL.revokeObjectURL(blobUrl);
          }, 3000);
        }
      }, 300);
    };

    return { filename: pdfFilename, blob: pdfBlob };
  }

  return { filename: pdfFilename, blob: pdfBlob };
}

