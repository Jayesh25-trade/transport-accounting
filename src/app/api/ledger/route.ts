import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { listLedgerTransactions } from "@/services/ledger.service";
import { AppError } from "@/lib/errors";

export const GET = createApiHandler(async (req, { firmId }) => {
  const partyId = req.nextUrl.searchParams.get("partyId");
  if (!partyId) {
    throw new AppError("Query parameter 'partyId' is required", "MISSING_PARAM");
  }

  const dateFrom = req.nextUrl.searchParams.get("dateFrom") || undefined;
  const dateTo = req.nextUrl.searchParams.get("dateTo") || undefined;
  const voucherType = req.nextUrl.searchParams.get("voucherType") || undefined;
  const entryType = req.nextUrl.searchParams.get("entryType") || undefined;
  const search = req.nextUrl.searchParams.get("search") || undefined;

  return await listLedgerTransactions(db, firmId, partyId, {
    dateFrom,
    dateTo,
    voucherType,
    entryType,
    search,
  });
});
