import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { trips, dailyEntries, parties, companies, trucks, locations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

export const GET = createApiHandler(async (req, { firmId }) => {
  const fromLocations = alias(locations, "from_locations");
  const toLocations = alias(locations, "to_locations");

  const rows = await db
    .select({
      id: trips.id,
      firmId: trips.firmId,
      dailyEntryId: trips.dailyEntryId,
      partyId: trips.partyId,
      isReceived: trips.isReceived,
      isBilled: trips.isBilled,
      billId: trips.billId,
      createdAt: trips.createdAt,
      updatedAt: trips.updatedAt,

      // Joined Daily Entry details
      srNo: dailyEntries.srNo,
      entryDate: dailyEntries.entryDate,
      truckId: dailyEntries.truckId,
      truckNumberRaw: dailyEntries.truckNumberRaw,
      lrNumber: dailyEntries.lrNumber,
      fromLocationId: dailyEntries.fromLocationId,
      fromLocationRaw: dailyEntries.fromLocationRaw,
      toLocationId: dailyEntries.toLocationId,
      toLocationRaw: dailyEntries.toLocationRaw,
      nWeight: dailyEntries.nWeight,
      rWeight: dailyEntries.rWeight,
      advance: dailyEntries.advance,
      rate: dailyEntries.rate,
      cash: dailyEntries.cash,
      diesel: dailyEntries.diesel,
      ac: dailyEntries.ac,
      customerRate: dailyEntries.customerRate,
      companyId: dailyEntries.companyId,
      companyNameRaw: dailyEntries.companyNameRaw,
      partyNameRaw: dailyEntries.partyNameRaw,
      remarks: dailyEntries.remarks,

      // Joined master names
      partyName: parties.name,
      companyName: companies.name,
      truckNumber: trucks.truckNumber,
      fromLocationName: fromLocations.name,
      toLocationName: toLocations.name,
    })
    .from(trips)
    .innerJoin(dailyEntries, eq(trips.dailyEntryId, dailyEntries.id))
    .leftJoin(parties, eq(trips.partyId, parties.id))
    .leftJoin(companies, eq(dailyEntries.companyId, companies.id))
    .leftJoin(trucks, eq(dailyEntries.truckId, trucks.id))
    .leftJoin(fromLocations, eq(dailyEntries.fromLocationId, fromLocations.id))
    .leftJoin(toLocations, eq(dailyEntries.toLocationId, toLocations.id))
    .where(eq(trips.firmId, firmId))
    .orderBy(dailyEntries.entryDate, dailyEntries.srNo);

  return rows;
});
