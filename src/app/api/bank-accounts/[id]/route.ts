import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { getBankAccountById, updateBankAccount } from "@/services/bank-account.service";

export const GET = createApiHandler(async (req, { firmId, params }) => {
  const { id } = await params;
  return await getBankAccountById(db, id, firmId);
});

export const PUT = createApiHandler(async (req, { firmId, params }) => {
  const { id } = await params;
  const body = await req.json();
  return await updateBankAccount(db, id, firmId, body);
});
