import { eq, and, sql, gte, lte, ilike, or, count, desc } from "drizzle-orm";
import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import { driverVouchers, dailyEntries, firms } from "../db/schema";
import { EntityNotFoundError, FirmIsolationError } from "../lib/errors";

export interface DriverVoucherFilterOptions {
  search?: string;
  startDate?: string;
  endDate?: string;
  truckNumber?: string;
  page?: number;
  limit?: number;
}

export async function getDriverVouchers(
  db: NodePgDatabase<any>,
  firmId: string,
  options: DriverVoucherFilterOptions = {}
) {
  const page = options.page || 1;
  const limit = options.limit || 50;
  const offset = (page - 1) * limit;

  const conditions = [eq(driverVouchers.firmId, firmId)];

  if (options.startDate) {
    conditions.push(gte(driverVouchers.voucherDate, options.startDate));
  }
  if (options.endDate) {
    conditions.push(lte(driverVouchers.voucherDate, options.endDate));
  }
  if (options.truckNumber) {
    conditions.push(eq(driverVouchers.truckNumberRaw, options.truckNumber));
  }
  if (options.search) {
    const term = `%${options.search.trim()}%`;
    conditions.push(
      or(
        ilike(driverVouchers.truckNumberRaw, term),
        ilike(driverVouchers.fromLocationRaw, term),
        ilike(driverVouchers.toLocationRaw, term),
        ilike(driverVouchers.remarks, term)
      )!
    );
  }

  const whereClause = and(...conditions);

  // 1. Fetch total counts and sum metrics
  const [totals] = await db
    .select({
      totalCount: count(),
      totalAdvance: sql<string>`COALESCE(SUM(CAST(${driverVouchers.advance} AS NUMERIC)), 0)`,
      totalCash: sql<string>`COALESCE(SUM(CAST(${driverVouchers.cash} AS NUMERIC)), 0)`,
      totalDiesel: sql<string>`COALESCE(SUM(CAST(${driverVouchers.diesel} AS NUMERIC)), 0)`,
      totalAc: sql<string>`COALESCE(SUM(CAST(${driverVouchers.ac} AS NUMERIC)), 0)`,
    })
    .from(driverVouchers)
    .where(whereClause);

  // 2. Fetch paginated voucher list with joined daily entry details
  const rows = await db
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
      // Source daily entry srNo & lrNumber
      dailyEntrySrNo: dailyEntries.srNo,
      dailyEntryLrNumber: dailyEntries.lrNumber,
    })
    .from(driverVouchers)
    .innerJoin(dailyEntries, eq(driverVouchers.dailyEntryId, dailyEntries.id))
    .where(whereClause)
    .orderBy(desc(driverVouchers.voucherDate), desc(driverVouchers.createdAt))
    .limit(limit)
    .offset(offset);

  const totalCount = Number(totals?.totalCount || 0);
  const totalPages = Math.ceil(totalCount / limit) || 1;

  const totalAdvanceNum = Number(totals?.totalAdvance || 0);
  const totalCashNum = Number(totals?.totalCash || 0);
  const totalDieselNum = Number(totals?.totalDiesel || 0);
  const totalAcNum = Number(totals?.totalAc || 0);
  const totalExpenseNum = totalAdvanceNum + totalCashNum + totalDieselNum + totalAcNum;

  return {
    vouchers: rows,
    pagination: {
      total: totalCount,
      page,
      limit,
      totalPages,
    },
    metrics: {
      totalVouchers: totalCount,
      totalAdvance: totalAdvanceNum,
      totalCash: totalCashNum,
      totalDiesel: totalDieselNum,
      totalAc: totalAcNum,
      totalExpense: totalExpenseNum,
    },
  };
}

export async function getDriverVoucherById(
  db: NodePgDatabase<any>,
  id: string,
  firmId: string
) {
  const rows = await db
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
      dailyEntryLrNumber: dailyEntries.lrNumber,
      dailyEntryPartyName: dailyEntries.partyNameRaw,
      dailyEntryCompanyName: dailyEntries.companyNameRaw,
    })
    .from(driverVouchers)
    .innerJoin(dailyEntries, eq(driverVouchers.dailyEntryId, dailyEntries.id))
    .where(eq(driverVouchers.id, id))
    .limit(1);

  if (rows.length === 0) {
    throw new EntityNotFoundError("DriverVoucher", id);
  }

  const voucher = rows[0];

  if (voucher.firmId !== firmId) {
    throw new FirmIsolationError(
      `Driver Voucher '${id}' belongs to firm '${voucher.firmId}', not active firm context '${firmId}'`
    );
  }

  return voucher;
}
