import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { getDailyEntryById, updateDailyEntry } from "@/services/daily-entry.service";

export const GET = createApiHandler(async (req, { firmId, params }) => {
  const { id } = await params;
  return await getDailyEntryById(db, id, firmId);
});

export const PUT = createApiHandler(async (req, { firmId, params }) => {
  const { id } = await params;
  const body = await req.json();
  return await updateDailyEntry(db, id, { ...body, firmId });
});
