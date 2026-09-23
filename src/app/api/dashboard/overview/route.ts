import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { getDashboardOverview } from "@/services/dashboard.service";
import { NextResponse } from "next/server";

export const GET = createApiHandler(async (req, { firmId }) => {
  const url = new URL(req.url);
  const startDate = url.searchParams.get("startDate") || undefined;
  const endDate = url.searchParams.get("endDate") || undefined;

  const overview = await getDashboardOverview(db, firmId, {
    startDate,
    endDate,
  });

  return NextResponse.json(overview);
});
