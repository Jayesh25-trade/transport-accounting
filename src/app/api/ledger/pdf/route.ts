import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { generateLedgerPdfBuffer } from "@/services/pdf.service";
import { AppError } from "@/lib/errors";
import { NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export const GET = createApiHandler(async (req, { firmId }) => {
  const partyId = req.nextUrl.searchParams.get("partyId");
  if (!partyId) {
    throw new AppError("Query parameter 'partyId' is required", "MISSING_PARAM");
  }

  const isDownload = req.nextUrl.searchParams.get("download") === "true";
  const dateFrom = req.nextUrl.searchParams.get("dateFrom") || undefined;
  const dateTo = req.nextUrl.searchParams.get("dateTo") || undefined;
  const voucherType = req.nextUrl.searchParams.get("voucherType") || undefined;
  const entryType = req.nextUrl.searchParams.get("entryType") || undefined;
  const search = req.nextUrl.searchParams.get("search") || undefined;

  const filename = `Ledger_Statement_${partyId}.pdf`;
  const disposition = `${isDownload ? "attachment" : "inline"}; filename="${filename}"`;

  const pdfBuffer = await generateLedgerPdfBuffer(db, firmId, partyId, {
    dateFrom,
    dateTo,
    voucherType,
    entryType,
    search,
  });

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": disposition,
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
});
