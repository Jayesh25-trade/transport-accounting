import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { createLocation, listLocations } from "@/services/truck-location.service";

export const GET = createApiHandler(async (req, { firmId }) => {
  return await listLocations(db, firmId);
});

export const POST = createApiHandler(async (req, { firmId }) => {
  const body = await req.json();
  return await createLocation(db, { ...body, firmId });
});
