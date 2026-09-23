import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { getDriverVoucherById } from "@/services/driver-voucher.service";
import { NextResponse } from "next/server";

export const GET = createApiHandler(async (req, { firmId, params }) => {
  const { id } = await params;

  const voucher = await getDriverVoucherById(db, id, firmId);

  return NextResponse.json(voucher);
});
