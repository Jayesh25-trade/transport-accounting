import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { generateBillPdfBuffer } from "@/services/pdf.service";
import { NextResponse } from "next/server";

export const GET = createApiHandler(async (req, { firmId, params }) => {
  const { id } = await params;

  const pdfBuffer = await generateBillPdfBuffer(db, firmId, id);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Bill_${id}.pdf"`,
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
});
