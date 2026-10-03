import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { getTruckById, updateTruck, deleteTruck } from "@/services/truck-location.service";

export const GET = createApiHandler(async (req, { firmId, params }) => {
  const { id } = await params;
  return await getTruckById(db, id, firmId);
});

export const PUT = createApiHandler(async (req, { firmId, params }) => {
  const { id } = await params;
  const body = await req.json();
  return await updateTruck(db, id, { ...body, firmId });
});

export const DELETE = createApiHandler(async (req, { firmId, params }) => {
  const { id } = await params;
  return await deleteTruck(db, id, firmId);
});
