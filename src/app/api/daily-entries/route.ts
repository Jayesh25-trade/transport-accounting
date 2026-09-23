import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { createDailyEntry, listDailyEntries } from "@/services/daily-entry.service";

export const GET = createApiHandler(async (req, { firmId }) => {
  return await listDailyEntries(db, firmId);
});

export const POST = createApiHandler(async (req, { firmId }) => {
  const body = await req.json();
  return await createDailyEntry(db, { ...body, firmId });
});
