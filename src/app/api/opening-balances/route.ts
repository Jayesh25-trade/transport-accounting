import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { createOpeningBalance, listOpeningBalances } from "@/services/opening-balance.service";

export const GET = createApiHandler(async (req, { firmId }) => {
  return await listOpeningBalances(db, firmId);
});

export const POST = createApiHandler(async (req, { firmId }) => {
  const body = await req.json();
  return await createOpeningBalance(db, { ...body, firmId });
});
