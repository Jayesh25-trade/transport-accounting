/**
 * inspect-voucher-1.ts
 * READ-ONLY database query script to inspect Driver Voucher #1 and Daily Entry #1.
 */

import "dotenv/config";
import { db } from "../db";
import { dailyEntries, driverVouchers, firms } from "../db/schema";
import { eq, desc } from "drizzle-orm";

async function inspectData() {
  console.log("=================================================");
  console.log("INSPECTING DRIVER VOUCHER & DAILY ENTRY DATA");
  console.log("=================================================\n");

  // 1. Fetch all firms
  const allFirms = await db.select().from(firms);
  console.log("Active Firms in DB:", allFirms.map(f => ({ id: f.id, name: f.name, code: f.code })));

  // 2. Fetch daily_entries with srNo = 1 or all entries
  const allEntries = await db
    .select({
      id: dailyEntries.id,
      firmId: dailyEntries.firmId,
      srNo: dailyEntries.srNo,
      entryDate: dailyEntries.entryDate,
      truckNumberRaw: dailyEntries.truckNumberRaw,
      advance: dailyEntries.advance,
      cash: dailyEntries.cash,
      diesel: dailyEntries.diesel,
      ac: dailyEntries.ac,
      rate: dailyEntries.rate,
      customerRate: dailyEntries.customerRate,
      partyId: dailyEntries.partyId,
      partyNameRaw: dailyEntries.partyNameRaw,
      isReceived: dailyEntries.isReceived,
      remarks: dailyEntries.remarks,
      createdAt: dailyEntries.createdAt,
      updatedAt: dailyEntries.updatedAt,
    })
    .from(dailyEntries)
    .orderBy(dailyEntries.srNo);

  console.log(`\nFound ${allEntries.length} daily_entries rows in DB:`);
  console.table(allEntries);

  // 3. Fetch driver_vouchers joined with daily_entries
  const allVouchers = await db
    .select({
      id: driverVouchers.id,
      firmId: driverVouchers.firmId,
      dailyEntryId: driverVouchers.dailyEntryId,
      voucherDate: driverVouchers.voucherDate,
      advance: driverVouchers.advance,
      cash: driverVouchers.cash,
      diesel: driverVouchers.diesel,
      ac: driverVouchers.ac,
      truckNumberRaw: driverVouchers.truckNumberRaw,
      fromLocationRaw: driverVouchers.fromLocationRaw,
      toLocationRaw: driverVouchers.toLocationRaw,
      remarks: driverVouchers.remarks,
      accountingStatus: driverVouchers.accountingStatus,
      createdAt: driverVouchers.createdAt,
      updatedAt: driverVouchers.updatedAt,
      dailyEntrySrNo: dailyEntries.srNo,
    })
    .from(driverVouchers)
    .leftJoin(dailyEntries, eq(driverVouchers.dailyEntryId, dailyEntries.id))
    .orderBy(dailyEntries.srNo);

  console.log(`\nFound ${allVouchers.length} driver_vouchers rows in DB:`);
  console.table(allVouchers);
}

inspectData().catch((err) => {
  console.error("Inspection error:", err);
  process.exit(1);
});
