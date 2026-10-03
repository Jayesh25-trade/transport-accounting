import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { setDefaultBankAccount } from "@/services/bank-account.service";

export const POST = createApiHandler(async (req, { firmId, params }) => {
  const { id } = await params;
  return await setDefaultBankAccount(db, id, firmId);
});
