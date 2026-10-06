import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { createBill, listBills } from "@/services/bill.service";

export const GET = createApiHandler(async (req, { firmId }) => {
  return await listBills(db, firmId);
});

import { NextResponse } from "next/server";

export const POST = createApiHandler(async (req, { firmId }) => {
  const body = await req.json();
  try {
    return await createBill(db, { ...body, firmId });
  } catch (err: any) {
    const detailedMsg = err?.cause?.detail || err?.cause?.message || err?.message || "Failed to create bill";
    console.error("[POST /api/bills Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: detailedMsg,
          code: err?.code || "DATABASE_ERROR",
          details: err?.cause || err,
        },
      },
      { status: 400 }
    );
  }
});
