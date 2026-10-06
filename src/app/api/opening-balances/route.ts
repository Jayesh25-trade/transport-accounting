import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { createOpeningBalance, listOpeningBalances } from "@/services/opening-balance.service";
import { AppError } from "@/lib/errors";

export const GET = createApiHandler(async (req, { firmId }) => {
  try {
    return await listOpeningBalances(db, firmId);
  } catch (err: any) {
    console.error("[API_OPENING_BALANCES_ERROR]", err);
    if (err instanceof AppError) throw err;
    throw new AppError(err?.message || "Failed to query opening balances", "OPENING_BALANCES_QUERY_FAILED");
  }
});

export const POST = createApiHandler(async (req, { firmId }) => {
  const body = await req.json();
  return await createOpeningBalance(db, { ...body, firmId });
});
