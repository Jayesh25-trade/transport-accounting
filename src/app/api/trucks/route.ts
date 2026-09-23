import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { createTruck, listTrucks } from "@/services/truck-location.service";

export const GET = createApiHandler(async (req, { firmId }) => {
  return await listTrucks(db, firmId);
});

export const POST = createApiHandler(async (req, { firmId }) => {
  const body = await req.json();
  return await createTruck(db, { ...body, firmId });
});
