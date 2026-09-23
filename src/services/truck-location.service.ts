import { eq, and } from "drizzle-orm";
import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import { trucks, locations } from "../db/schema";
import {
  truckInputSchema,
  locationInputSchema,
  type TruckInput,
  type LocationInput,
} from "../validators/truck-location";
import { verifyTruckInFirm, verifyLocationInFirm } from "./firm.service";
import { recordAuditLog } from "./audit.service";
import { EntityNotFoundError } from "../lib/errors";

// ==========================================
// TRUCK SERVICES
// ==========================================

export async function createTruck(db: NodePgDatabase<any>, rawInput: TruckInput) {
  const input = truckInputSchema.parse(rawInput);
  const [truck] = await db.insert(trucks).values(input).returning();
  await recordAuditLog(db, {
    firmId: input.firmId,
    action: "CREATE",
    entityName: "trucks",
    entityId: truck.id,
    newValues: truck,
  });
  return truck;
}

export async function updateTruck(
  db: NodePgDatabase<any>,
  truckId: string,
  rawInput: TruckInput
) {
  const input = truckInputSchema.parse(rawInput);
  await verifyTruckInFirm(db, truckId, input.firmId);
  const [updated] = await db
    .update(trucks)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(trucks.id, truckId), eq(trucks.firmId, input.firmId)))
    .returning();
  await recordAuditLog(db, {
    firmId: input.firmId,
    action: "UPDATE",
    entityName: "trucks",
    entityId: truckId,
    newValues: updated,
  });
  return updated;
}

export async function getTruckById(
  db: NodePgDatabase<any>,
  truckId: string,
  firmId: string
) {
  await verifyTruckInFirm(db, truckId, firmId);
  const res = await db
    .select()
    .from(trucks)
    .where(and(eq(trucks.id, truckId), eq(trucks.firmId, firmId)))
    .limit(1);
  if (res.length === 0) throw new EntityNotFoundError("Truck", truckId);
  return res[0];
}

export async function listTrucks(db: NodePgDatabase<any>, firmId: string) {
  return await db.select().from(trucks).where(eq(trucks.firmId, firmId));
}

// ==========================================
// LOCATION SERVICES
// ==========================================

export async function createLocation(
  db: NodePgDatabase<any>,
  rawInput: LocationInput
) {
  const input = locationInputSchema.parse(rawInput);
  const [location] = await db.insert(locations).values(input).returning();
  await recordAuditLog(db, {
    firmId: input.firmId,
    action: "CREATE",
    entityName: "locations",
    entityId: location.id,
    newValues: location,
  });
  return location;
}

export async function updateLocation(
  db: NodePgDatabase<any>,
  locationId: string,
  rawInput: LocationInput
) {
  const input = locationInputSchema.parse(rawInput);
  await verifyLocationInFirm(db, locationId, input.firmId);
  const [updated] = await db
    .update(locations)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(locations.id, locationId), eq(locations.firmId, input.firmId)))
    .returning();
  await recordAuditLog(db, {
    firmId: input.firmId,
    action: "UPDATE",
    entityName: "locations",
    entityId: locationId,
    newValues: updated,
  });
  return updated;
}

export async function getLocationById(
  db: NodePgDatabase<any>,
  locationId: string,
  firmId: string
) {
  await verifyLocationInFirm(db, locationId, firmId);
  const res = await db
    .select()
    .from(locations)
    .where(and(eq(locations.id, locationId), eq(locations.firmId, firmId)))
    .limit(1);
  if (res.length === 0) throw new EntityNotFoundError("Location", locationId);
  return res[0];
}

export async function listLocations(db: NodePgDatabase<any>, firmId: string) {
  return await db.select().from(locations).where(eq(locations.firmId, firmId));
}
