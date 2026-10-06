import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { generateBillPdfBuffer, generateBillPdfHtml } from "@/services/pdf.service";
import { getBillById } from "@/services/bill.service";
import { NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export const GET = createApiHandler(async (req, { firmId, params }) => {
  const { id } = await params;
  const isDownload = req.nextUrl.searchParams.get("download") === "true";
  const format = req.nextUrl.searchParams.get("format");

  if (format === "html") {
    const html = await generateBillPdfHtml(db, firmId, id);
    const htmlWithPrint = html + `<script>window.onload = function() { window.print(); };</script>`;
    return new NextResponse(htmlWithPrint, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  try {
    const pdfBuffer = await generateBillPdfBuffer(db, firmId, id);
    const bill = await getBillById(db, id, firmId);
    const cleanParty = (bill.partyName || "Invoice").replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `Bill_${bill.billNumber}_${cleanParty}.pdf`;
    const disposition = `${isDownload ? "attachment" : "inline"}; filename="${filename}"`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": disposition,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (pdfErr: any) {
    console.warn("[BILL_PDF_FALLBACK] Binary PDF generation failed, serving printable HTML fallback:", pdfErr?.message || pdfErr);
    const html = await generateBillPdfHtml(db, firmId, id);
    const htmlWithPrint = html + `<script>window.onload = function() { window.print(); };</script>`;
    return new NextResponse(htmlWithPrint, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
});
