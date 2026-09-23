import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { getDriverVouchers } from "@/services/driver-voucher.service";
import { NextResponse } from "next/server";

export const GET = createApiHandler(async (req, { firmId }) => {
  const url = new URL(req.url);
  const search = url.searchParams.get("search") || undefined;
  const startDate = url.searchParams.get("startDate") || undefined;
  const endDate = url.searchParams.get("endDate") || undefined;
  const truckNumber = url.searchParams.get("truckNumber") || undefined;
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = parseInt(url.searchParams.get("limit") || "50", 10);

  const result = await getDriverVouchers(db, firmId, {
    search,
    startDate,
    endDate,
    truckNumber,
    page,
    limit,
  });

  return NextResponse.json(result);
});
