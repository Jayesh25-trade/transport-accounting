import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { getBillById, editBill } from "@/services/bill.service";

export const GET = createApiHandler(async (req, { firmId, params }) => {
  const { id } = await params;
  return await getBillById(db, id, firmId);
});

export const PUT = createApiHandler(async (req, { firmId, params }) => {
  const { id } = await params;
  const body = await req.json();
  return await editBill(db, { ...body, billId: id, firmId });
});
