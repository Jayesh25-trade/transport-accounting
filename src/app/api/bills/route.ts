import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { createBill, listBills } from "@/services/bill.service";

export const GET = createApiHandler(async (req, { firmId }) => {
  return await listBills(db, firmId);
});

export const POST = createApiHandler(async (req, { firmId }) => {
  const body = await req.json();
  return await createBill(db, { ...body, firmId });
});
