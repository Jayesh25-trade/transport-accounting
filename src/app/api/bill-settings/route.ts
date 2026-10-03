import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { getFirmBillSettings, updateFirmBillSettings } from "@/services/bill-settings.service";

export const GET = createApiHandler(async (req, { firmId }) => {
  return await getFirmBillSettings(db, firmId);
});

export const PUT = createApiHandler(async (req, { firmId }) => {
  const body = await req.json();
  return await updateFirmBillSettings(db, firmId, body);
});
