import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { createPayment, listPayments } from "@/services/payment.service";

export const GET = createApiHandler(async (req, { firmId }) => {
  return await listPayments(db, firmId);
});

export const POST = createApiHandler(async (req, { firmId }) => {
  const body = await req.json();
  return await createPayment(db, { ...body, firmId });
});
