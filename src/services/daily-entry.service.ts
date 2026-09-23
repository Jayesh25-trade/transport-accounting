import { eq, and } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import { dailyEntries, driverVouchers, trips, parties, companies, trucks, locations } from "../db/schema";
import { dailyEntryInputSchema, type DailyEntryInput } from "../validators/daily-entry";
import { verifyPartyInFirm, verifyCompanyInFirm, verifyTruckInFirm, verifyLocationInFirm } from "./firm.service";
import { recordAuditLog } from "./audit.service";
import { EntityNotFoundError } from "../lib/errors";

export async function createDailyEntry(
  db: NodePgDatabase<any>,
  rawInput: DailyEntryInput
) {
  const input = dailyEntryInputSchema.parse(rawInput);

  return await db.transaction(async (tx) => {
    // 1. Verify entity firm isolation
    if (input.partyId) await verifyPartyInFirm(tx, input.partyId, input.firmId);
    if (input.companyId) await verifyCompanyInFirm(tx, input.companyId, input.firmId);
    if (input.truckId) await verifyTruckInFirm(tx, input.truckId, input.firmId);
    if (input.fromLocationId) await verifyLocationInFirm(tx, input.fromLocationId, input.firmId);
    if (input.toLocationId) await verifyLocationInFirm(tx, input.toLocationId, input.firmId);

    // 2. Insert daily_entry
    const [entry] = await tx
      .insert(dailyEntries)
      .values({
        firmId: input.firmId,
        srNo: input.srNo,
        entryDate: input.entryDate,
        truckId: input.truckId || null,
        truckNumberRaw: input.truckNumberRaw || null,
        lrNumber: input.lrNumber || null,
        fromLocationId: input.fromLocationId || null,
        fromLocationRaw: input.fromLocationRaw || null,
        toLocationId: input.toLocationId || null,
        toLocationRaw: input.toLocationRaw || null,
        nWeight: input.nWeight !== undefined && input.nWeight !== null ? input.nWeight.toString() : null,
        rWeight: input.rWeight !== undefined && input.rWeight !== null ? input.rWeight.toString() : null,
        advance: input.advance !== undefined && input.advance !== null ? input.advance.toString() : null,
        rate: input.rate !== undefined && input.rate !== null ? input.rate.toString() : null,
        cash: input.cash !== undefined && input.cash !== null ? input.cash.toString() : null,
        diesel: input.diesel !== undefined && input.diesel !== null ? input.diesel.toString() : null,
        ac: input.ac !== undefined && input.ac !== null ? input.ac.toString() : null,
        companyId: input.companyId || null,
        companyNameRaw: input.companyNameRaw || null,
        partyId: input.partyId || null,
        partyNameRaw: input.partyNameRaw || null,
        customerRate: input.customerRate !== undefined && input.customerRate !== null ? input.customerRate.toString() : null,
        isReceived: input.isReceived,
        remarks: input.remarks || null,
        createdBy: input.userId || null,
      })
      .returning();

    // 3. Create driver_voucher synchronized with daily_entry (Rule 12)
    // Status MUST be 'PENDING_CONFIRMATION' (NO automatic ledger postings)
    const [voucher] = await tx
      .insert(driverVouchers)
      .values({
        firmId: input.firmId,
        dailyEntryId: entry.id,
        voucherDate: input.entryDate,
        advance: input.advance !== undefined && input.advance !== null ? input.advance.toString() : null,
        cash: input.cash !== undefined && input.cash !== null ? input.cash.toString() : null,
        diesel: input.diesel !== undefined && input.diesel !== null ? input.diesel.toString() : null,
        ac: input.ac !== undefined && input.ac !== null ? input.ac.toString() : null,
        truckNumberRaw: input.truckNumberRaw || null,
        fromLocationRaw: input.fromLocationRaw || null,
        toLocationRaw: input.toLocationRaw || null,
        remarks: input.remarks || null,
        accountingStatus: "PENDING_CONFIRMATION",
        createdBy: input.userId || null,
      })
      .returning();

    // 4. Create trips record if partyId exists
    let tripRecord = null;
    if (input.partyId) {
      const [trip] = await tx
        .insert(trips)
        .values({
          firmId: input.firmId,
          dailyEntryId: entry.id,
          partyId: input.partyId,
          isReceived: input.isReceived,
          isBilled: false,
        })
        .returning();
      tripRecord = trip;
    }

    // 5. Audit log
    await recordAuditLog(tx, {
      firmId: input.firmId,
      userId: input.userId,
      action: "CREATE",
      entityName: "daily_entries",
      entityId: entry.id,
      newValues: { entry, voucher, trip: tripRecord },
    });

    return { entry, voucher, trip: tripRecord };
  });
}

export async function updateDailyEntry(
  db: NodePgDatabase<any>,
  entryId: string,
  rawInput: DailyEntryInput
) {
  const input = dailyEntryInputSchema.parse(rawInput);

  return await db.transaction(async (tx) => {
    // 1. Fetch existing daily entry
    const existingList = await tx
      .select()
      .from(dailyEntries)
      .where(and(eq(dailyEntries.id, entryId), eq(dailyEntries.firmId, input.firmId)))
      .limit(1);

    if (existingList.length === 0) {
      throw new EntityNotFoundError("DailyEntry", entryId);
    }
    const existing = existingList[0];

    // 2. Verify firm context for updated entities
    if (input.partyId) await verifyPartyInFirm(tx, input.partyId, input.firmId);
    if (input.companyId) await verifyCompanyInFirm(tx, input.companyId, input.firmId);
    if (input.truckId) await verifyTruckInFirm(tx, input.truckId, input.firmId);
    if (input.fromLocationId) await verifyLocationInFirm(tx, input.fromLocationId, input.firmId);
    if (input.toLocationId) await verifyLocationInFirm(tx, input.toLocationId, input.firmId);

    // 3. Update daily_entry
    const [updatedEntry] = await tx
      .update(dailyEntries)
      .set({
        srNo: input.srNo,
        entryDate: input.entryDate,
        truckId: input.truckId || null,
        truckNumberRaw: input.truckNumberRaw || null,
        lrNumber: input.lrNumber || null,
        fromLocationId: input.fromLocationId || null,
        fromLocationRaw: input.fromLocationRaw || null,
        toLocationId: input.toLocationId || null,
        toLocationRaw: input.toLocationRaw || null,
        nWeight: input.nWeight !== undefined && input.nWeight !== null ? input.nWeight.toString() : null,
        rWeight: input.rWeight !== undefined && input.rWeight !== null ? input.rWeight.toString() : null,
        advance: input.advance !== undefined && input.advance !== null ? input.advance.toString() : null,
        rate: input.rate !== undefined && input.rate !== null ? input.rate.toString() : null,
        cash: input.cash !== undefined && input.cash !== null ? input.cash.toString() : null,
        diesel: input.diesel !== undefined && input.diesel !== null ? input.diesel.toString() : null,
        ac: input.ac !== undefined && input.ac !== null ? input.ac.toString() : null,
        companyId: input.companyId || null,
        companyNameRaw: input.companyNameRaw || null,
        partyId: input.partyId || null,
        partyNameRaw: input.partyNameRaw || null,
        customerRate: input.customerRate !== undefined && input.customerRate !== null ? input.customerRate.toString() : null,
        isReceived: input.isReceived,
        remarks: input.remarks || null,
        updatedBy: input.userId || null,
        updatedAt: new Date(),
      })
      .where(eq(dailyEntries.id, entryId))
      .returning();

    // 4. Synchronize related driver_voucher (Rule 12)
    const [updatedVoucher] = await tx
      .update(driverVouchers)
      .set({
        voucherDate: input.entryDate,
        advance: input.advance !== undefined && input.advance !== null ? input.advance.toString() : null,
        cash: input.cash !== undefined && input.cash !== null ? input.cash.toString() : null,
        diesel: input.diesel !== undefined && input.diesel !== null ? input.diesel.toString() : null,
        ac: input.ac !== undefined && input.ac !== null ? input.ac.toString() : null,
        truckNumberRaw: input.truckNumberRaw || null,
        fromLocationRaw: input.fromLocationRaw || null,
        toLocationRaw: input.toLocationRaw || null,
        remarks: input.remarks || null,
        updatedBy: input.userId || null,
        updatedAt: new Date(),
      })
      .where(eq(driverVouchers.dailyEntryId, entryId))
      .returning();

    // 5. Update related trip record
    if (input.partyId) {
      await tx
        .update(trips)
        .set({
          partyId: input.partyId,
          isReceived: input.isReceived,
          updatedAt: new Date(),
        })
        .where(eq(trips.dailyEntryId, entryId));
    }

    // 6. Audit log
    await recordAuditLog(tx, {
      firmId: input.firmId,
      userId: input.userId,
      action: "UPDATE",
      entityName: "daily_entries",
      entityId: entryId,
      oldValues: existing,
      newValues: updatedEntry,
    });

    return { entry: updatedEntry, voucher: updatedVoucher };
  });
}

export async function listDailyEntries(db: NodePgDatabase<any>, firmId: string) {
  const fromLocations = alias(locations, "from_locations");
  const toLocations = alias(locations, "to_locations");

  return await db
    .select({
      id: dailyEntries.id,
      firmId: dailyEntries.firmId,
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
      companyId: dailyEntries.companyId,
      companyNameRaw: dailyEntries.companyNameRaw,
      partyId: dailyEntries.partyId,
      partyNameRaw: dailyEntries.partyNameRaw,
      customerRate: dailyEntries.customerRate,
      isReceived: dailyEntries.isReceived,
      remarks: dailyEntries.remarks,
      createdAt: dailyEntries.createdAt,
      updatedAt: dailyEntries.updatedAt,
      // Master details
      partyName: parties.name,
      companyName: companies.name,
      truckNumber: trucks.truckNumber,
      fromLocationName: fromLocations.name,
      toLocationName: toLocations.name,
    })
    .from(dailyEntries)
    .leftJoin(parties, eq(dailyEntries.partyId, parties.id))
    .leftJoin(companies, eq(dailyEntries.companyId, companies.id))
    .leftJoin(trucks, eq(dailyEntries.truckId, trucks.id))
    .leftJoin(fromLocations, eq(dailyEntries.fromLocationId, fromLocations.id))
    .leftJoin(toLocations, eq(dailyEntries.toLocationId, toLocations.id))
    .where(eq(dailyEntries.firmId, firmId))
    .orderBy(dailyEntries.entryDate, dailyEntries.srNo);
}

export async function getDailyEntryById(db: NodePgDatabase<any>, entryId: string, firmId: string) {
  const fromLocations = alias(locations, "from_locations");
  const toLocations = alias(locations, "to_locations");

  const res = await db
    .select({
      id: dailyEntries.id,
      firmId: dailyEntries.firmId,
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
      companyId: dailyEntries.companyId,
      companyNameRaw: dailyEntries.companyNameRaw,
      partyId: dailyEntries.partyId,
      partyNameRaw: dailyEntries.partyNameRaw,
      customerRate: dailyEntries.customerRate,
      isReceived: dailyEntries.isReceived,
      remarks: dailyEntries.remarks,
      createdAt: dailyEntries.createdAt,
      updatedAt: dailyEntries.updatedAt,
      // Master details
      partyName: parties.name,
      companyName: companies.name,
      truckNumber: trucks.truckNumber,
      fromLocationName: fromLocations.name,
      toLocationName: toLocations.name,
    })
    .from(dailyEntries)
    .leftJoin(parties, eq(dailyEntries.partyId, parties.id))
    .leftJoin(companies, eq(dailyEntries.companyId, companies.id))
    .leftJoin(trucks, eq(dailyEntries.truckId, trucks.id))
    .leftJoin(fromLocations, eq(dailyEntries.fromLocationId, fromLocations.id))
    .leftJoin(toLocations, eq(dailyEntries.toLocationId, toLocations.id))
    .where(and(eq(dailyEntries.id, entryId), eq(dailyEntries.firmId, firmId)))
    .limit(1);

  if (res.length === 0) throw new EntityNotFoundError("DailyEntry", entryId);
  return res[0];
}

