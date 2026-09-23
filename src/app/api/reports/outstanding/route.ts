import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { getOutstandingReport } from "@/services/report.service";

export const GET = createApiHandler(async (req, { firmId }) => {
  const partyId = req.nextUrl.searchParams.get("partyId") || undefined;
  const dateFrom = req.nextUrl.searchParams.get("dateFrom") || undefined;
  const dateTo = req.nextUrl.searchParams.get("dateTo") || undefined;
  const status = (req.nextUrl.searchParams.get("status") as any) || undefined;

  return await getOutstandingReport(db, firmId, {
    partyId,
    dateFrom,
    dateTo,
    status,
  });
});
