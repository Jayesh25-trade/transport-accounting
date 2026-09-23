import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { getAgingReport } from "@/services/report.service";

export const GET = createApiHandler(async (req, { firmId }) => {
  const asOfDate = req.nextUrl.searchParams.get("asOfDate") || undefined;
  const partyId = req.nextUrl.searchParams.get("partyId") || undefined;

  return await getAgingReport(db, firmId, {
    asOfDate,
    partyId,
  });
});
