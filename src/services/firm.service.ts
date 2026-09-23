import { eq, and } from "drizzle-orm";
import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import { type PgTransaction } from "drizzle-orm/pg-core";
import { firms, parties, companies, trucks, locations, trips, bills } from "../db/schema";
import { FirmIsolationError, EntityNotFoundError } from "../lib/errors";

export async function verifyFirmExists(
  dbOrTx: NodePgDatabase<any> | PgTransaction<any, any, any>,
  firmId: string
): Promise<void> {
  const result = await dbOrTx.select({ id: firms.id }).from(firms).where(eq(firms.id, firmId)).limit(1);
  if (result.length === 0) {
    throw new EntityNotFoundError("Firm", firmId);
  }
}

export async function verifyPartyInFirm(
  dbOrTx: NodePgDatabase<any> | PgTransaction<any, any, any>,
  partyId: string,
  firmId: string
): Promise<void> {
  const result = await dbOrTx
    .select({ id: parties.id, firmId: parties.firmId })
    .from(parties)
    .where(eq(parties.id, partyId))
    .limit(1);

  if (result.length === 0) {
    throw new EntityNotFoundError("Party", partyId);
  }

  if (result[0].firmId !== firmId) {
    throw new FirmIsolationError(
      `Party '${partyId}' belongs to firm '${result[0].firmId}', not active firm context '${firmId}'`
    );
  }
}

export async function verifyCompanyInFirm(
  dbOrTx: NodePgDatabase<any> | PgTransaction<any, any, any>,
  companyId: string,
  firmId: string
): Promise<void> {
  const result = await dbOrTx
    .select({ id: companies.id, firmId: companies.firmId })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (result.length === 0) {
    throw new EntityNotFoundError("Company", companyId);
  }

  if (result[0].firmId !== firmId) {
    throw new FirmIsolationError(
      `Company '${companyId}' belongs to firm '${result[0].firmId}', not active firm context '${firmId}'`
    );
  }
}

export async function verifyTruckInFirm(
  dbOrTx: NodePgDatabase<any> | PgTransaction<any, any, any>,
  truckId: string,
  firmId: string
): Promise<void> {
  const result = await dbOrTx
    .select({ id: trucks.id, firmId: trucks.firmId })
    .from(trucks)
    .where(eq(trucks.id, truckId))
    .limit(1);

  if (result.length === 0) {
    throw new EntityNotFoundError("Truck", truckId);
  }

  if (result[0].firmId !== firmId) {
    throw new FirmIsolationError(
      `Truck '${truckId}' belongs to firm '${result[0].firmId}', not active firm context '${firmId}'`
    );
  }
}

export async function verifyLocationInFirm(
  dbOrTx: NodePgDatabase<any> | PgTransaction<any, any, any>,
  locationId: string,
  firmId: string
): Promise<void> {
  const result = await dbOrTx
    .select({ id: locations.id, firmId: locations.firmId })
    .from(locations)
    .where(eq(locations.id, locationId))
    .limit(1);

  if (result.length === 0) {
    throw new EntityNotFoundError("Location", locationId);
  }

  if (result[0].firmId !== firmId) {
    throw new FirmIsolationError(
      `Location '${locationId}' belongs to firm '${result[0].firmId}', not active firm context '${firmId}'`
    );
  }
}

export async function verifyTripInFirm(
  dbOrTx: NodePgDatabase<any> | PgTransaction<any, any, any>,
  tripId: string,
  firmId: string
): Promise<void> {
  const result = await dbOrTx
    .select({ id: trips.id, firmId: trips.firmId })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1);

  if (result.length === 0) {
    throw new EntityNotFoundError("Trip", tripId);
  }

  if (result[0].firmId !== firmId) {
    throw new FirmIsolationError(
      `Trip '${tripId}' belongs to firm '${result[0].firmId}', not active firm context '${firmId}'`
    );
  }
}

export async function verifyBillInFirm(
  dbOrTx: NodePgDatabase<any> | PgTransaction<any, any, any>,
  billId: string,
  firmId: string
): Promise<void> {
  const result = await dbOrTx
    .select({ id: bills.id, firmId: bills.firmId })
    .from(bills)
    .where(eq(bills.id, billId))
    .limit(1);

  if (result.length === 0) {
    throw new EntityNotFoundError("Bill", billId);
  }

  if (result[0].firmId !== firmId) {
    throw new FirmIsolationError(
      `Bill '${billId}' belongs to firm '${result[0].firmId}', not active firm context '${firmId}'`
    );
  }
}
