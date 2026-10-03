import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { listBankAccounts, createBankAccount } from "@/services/bank-account.service";

export const GET = createApiHandler(async (req, { firmId }) => {
  const url = new URL(req.url);
  const includeInactive = url.searchParams.get("includeInactive") === "true";
  return await listBankAccounts(db, firmId, includeInactive);
});

export const POST = createApiHandler(async (req, { firmId }) => {
  const body = await req.json();
  return await createBankAccount(db, firmId, body);
});
