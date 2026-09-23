import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { previewBillCalculation } from "@/services/bill.service";

export const POST = createApiHandler(async (req, { firmId }) => {
  const body = await req.json();
  return await previewBillCalculation(db, { ...body, firmId });
});
