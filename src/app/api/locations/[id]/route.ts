import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { getLocationById, updateLocation } from "@/services/truck-location.service";

export const GET = createApiHandler(async (req, { firmId, params }) => {
  const { id } = await params;
  return await getLocationById(db, id, firmId);
});

export const PUT = createApiHandler(async (req, { firmId, params }) => {
  const { id } = await params;
  const body = await req.json();
  return await updateLocation(db, id, { ...body, firmId });
});
