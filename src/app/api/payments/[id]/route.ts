import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { getPaymentById } from "@/services/payment.service";

export const GET = createApiHandler(async (req, { firmId, params }) => {
  const { id } = await params;
  return await getPaymentById(db, id, firmId);
});
