import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { allocatePaymentToBill } from "@/services/payment.service";

export const POST = createApiHandler(async (req, { firmId }) => {
  const body = await req.json();
  return await allocatePaymentToBill(db, { ...body, firmId });
});
