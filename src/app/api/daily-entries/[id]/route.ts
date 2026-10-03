import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { getDailyEntryById, updateDailyEntry, deleteDailyEntry } from "@/services/daily-entry.service";

export const GET = createApiHandler(async (req, { firmId, params }) => {
  const { id } = await params;
  return await getDailyEntryById(db, id, firmId);
});

export const PUT = createApiHandler(async (req, { firmId, params, user }) => {
  const { id } = await params;
  const body = await req.json();
  return await updateDailyEntry(db, id, { ...body, firmId, userId: user?.id });
});

export const DELETE = createApiHandler(async (req, { firmId, params, user }) => {
  const { id } = await params;
  return await deleteDailyEntry(db, id, firmId, user?.id);
});

