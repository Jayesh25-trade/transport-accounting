import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { listLedgerTransactions } from "@/services/ledger.service";
import { AppError } from "@/lib/errors";
import { z } from "zod";

export const GET = createApiHandler(async (req, { firmId }) => {
  const partyId = req.nextUrl.searchParams.get("partyId");
  if (!partyId) {
    throw new AppError("Query parameter 'partyId' is required", "MISSING_PARAM");
  }

  const parsedParty = z.string().uuid("Invalid party ID format").safeParse(partyId);
  if (!parsedParty.success) {
    throw new AppError("Invalid party ID format", "INVALID_PARAM");
  }

  const dateFrom = req.nextUrl.searchParams.get("dateFrom") || undefined;
  const dateTo = req.nextUrl.searchParams.get("dateTo") || undefined;
  const voucherType = req.nextUrl.searchParams.get("voucherType") || undefined;
  const entryType = req.nextUrl.searchParams.get("entryType") || undefined;
  const search = req.nextUrl.searchParams.get("search") || undefined;

  try {
    return await listLedgerTransactions(db, firmId, parsedParty.data, {
      dateFrom,
      dateTo,
      voucherType,
      entryType,
      search,
    });
  } catch (err: any) {
    console.error("[API_LEDGER_ERROR]", err);
    if (err instanceof AppError) throw err;
    throw new AppError(err?.message || "Failed to query ledger transactions", "LEDGER_QUERY_FAILED");
  }
});
