import { eq, and, sql, gte, lte, count, desc } from "drizzle-orm";
import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import { dailyEntries, trips, bills, payments, parties } from "../db/schema";
import { getOutstandingReport, getAgingReport } from "./report.service";
import { getDriverVouchers } from "./driver-voucher.service";

export interface DashboardFilterOptions {
  startDate?: string;
  endDate?: string;
}

export async function getDashboardOverview(
  db: NodePgDatabase<any>,
  firmId: string,
  options: DashboardFilterOptions = {}
) {
  // -------------------------------------------------------------
  // 1. DAILY BOOK OVERVIEW
  // -------------------------------------------------------------
  const dailyConditions = [eq(dailyEntries.firmId, firmId)];
  if (options.startDate) {
    dailyConditions.push(gte(dailyEntries.entryDate, options.startDate));
  }
  if (options.endDate) {
    dailyConditions.push(lte(dailyEntries.entryDate, options.endDate));
  }

  const [dailyStats] = await db
    .select({
      totalEntries: count(dailyEntries.id),
      receivedCount: sql<number>`COALESCE(COUNT(CASE WHEN ${dailyEntries.isReceived} = true THEN 1 END), 0)`,
      pendingCount: sql<number>`COALESCE(COUNT(CASE WHEN ${dailyEntries.isReceived} = false THEN 1 END), 0)`,
    })
    .from(dailyEntries)
    .where(and(...dailyConditions));

  // -------------------------------------------------------------
  // 2. BILLING OVERVIEW
  // -------------------------------------------------------------
  const billConditions = [eq(bills.firmId, firmId)];
  if (options.startDate) {
    billConditions.push(gte(bills.billDate, options.startDate));
  }
  if (options.endDate) {
    billConditions.push(lte(bills.billDate, options.endDate));
  }

  const [billStats] = await db
    .select({
      billCount: count(bills.id),
      grossFreightTotal: sql<string>`COALESCE(SUM(CAST(${bills.subtotalFreight} AS NUMERIC)), 0)`,
      shortageDebitTotal: sql<string>`COALESCE(SUM(CAST(${bills.debitNoteAmount} AS NUMERIC)), 0)`,
      tdsTotal: sql<string>`COALESCE(SUM(CAST(${bills.tdsAmount} AS NUMERIC)), 0)`,
      netPayableTotal: sql<string>`COALESCE(SUM(CAST(${bills.netBillAmount} AS NUMERIC)), 0)`,
    })
    .from(bills)
    .where(and(...billConditions));

  // Fetch 5 most recent bills for dashboard activity view
  const recentBillsRows = await db
    .select({
      id: bills.id,
      billNumber: bills.billNumber,
      billDate: bills.billDate,
      partyName: parties.name,
      netBillAmount: bills.netBillAmount,
      status: bills.status,
    })
    .from(bills)
    .leftJoin(parties, eq(bills.partyId, parties.id))
    .where(eq(bills.firmId, firmId))
    .orderBy(desc(bills.billNumber), desc(bills.createdAt))
    .limit(5);

  const recentBills = recentBillsRows.map((b) => ({
    id: b.id,
    billNumber: String(b.billNumber),
    billDate: b.billDate,
    partyName: b.partyName || "Customer Invoice",
    netBillAmount: b.netBillAmount,
    status: b.status,
  }));

  // -------------------------------------------------------------
  // 3. PAYMENTS OVERVIEW
  // -------------------------------------------------------------
  const paymentConditions = [eq(payments.firmId, firmId)];
  if (options.startDate) {
    paymentConditions.push(gte(payments.paymentDate, options.startDate));
  }
  if (options.endDate) {
    paymentConditions.push(lte(payments.paymentDate, options.endDate));
  }

  const [paymentStats] = await db
    .select({
      paymentCount: count(payments.id),
      totalReceipts: sql<string>`COALESCE(SUM(CAST(${payments.amount} AS NUMERIC)), 0)`,
      againstBillTotal: sql<string>`COALESCE(SUM(CASE WHEN ${payments.paymentType} = 'AGAINST_BILL' THEN CAST(${payments.amount} AS NUMERIC) ELSE 0 END), 0)`,
      advanceTotal: sql<string>`COALESCE(SUM(CASE WHEN ${payments.paymentType} = 'ADVANCE' THEN CAST(${payments.amount} AS NUMERIC) ELSE 0 END), 0)`,
    })
    .from(payments)
    .where(and(...paymentConditions));

  // Fetch 5 most recent payments for dashboard activity view
  const recentPaymentsRows = await db
    .select({
      id: payments.id,
      paymentDate: payments.paymentDate,
      paymentType: payments.paymentType,
      paymentMode: payments.paymentMode,
      amount: payments.amount,
      partyName: parties.name,
      referenceNumber: payments.referenceNumber,
    })
    .from(payments)
    .leftJoin(parties, eq(payments.partyId, parties.id))
    .where(eq(payments.firmId, firmId))
    .orderBy(desc(payments.paymentDate), desc(payments.createdAt))
    .limit(5);

  const recentPayments = recentPaymentsRows.map((p) => ({
    id: p.id,
    paymentDate: p.paymentDate,
    paymentType: p.paymentType,
    paymentMode: p.paymentMode,
    amount: p.amount,
    partyName: p.partyName || "Customer Payment",
    referenceNumber: p.referenceNumber,
  }));

  // -------------------------------------------------------------
  // 4. OUTSTANDING OVERVIEW (Uses authoritative report service)
  // -------------------------------------------------------------
  const outstandingReport = await getOutstandingReport(db, firmId);

  // -------------------------------------------------------------
  // 5. AGING OVERVIEW (Uses authoritative report service)
  // -------------------------------------------------------------
  const agingReport = await getAgingReport(db, firmId);

  // -------------------------------------------------------------
  // 6. DRIVER VOUCHERS OVERVIEW (Operational only)
  // -------------------------------------------------------------
  const driverVoucherData = await getDriverVouchers(db, firmId, {
    startDate: options.startDate,
    endDate: options.endDate,
    limit: 5,
  });

  return {
    dailyBook: {
      totalEntries: Number(dailyStats?.totalEntries || 0),
      receivedCount: Number(dailyStats?.receivedCount || 0),
      pendingCount: Number(dailyStats?.pendingCount || 0),
    },
    billing: {
      billCount: Number(billStats?.billCount || 0),
      grossFreightTotal: Number(billStats?.grossFreightTotal || 0),
      shortageDebitTotal: Number(billStats?.shortageDebitTotal || 0),
      tdsTotal: Number(billStats?.tdsTotal || 0),
      netPayableTotal: Number(billStats?.netPayableTotal || 0),
      recentBills,
    },
    payments: {
      paymentCount: Number(paymentStats?.paymentCount || 0),
      totalReceipts: Number(paymentStats?.totalReceipts || 0),
      againstBillTotal: Number(paymentStats?.againstBillTotal || 0),
      advanceTotal: Number(paymentStats?.advanceTotal || 0),
      recentPayments,
    },
    outstanding: {
      totalOutstandingAmount: outstandingReport.summary.totalOutstanding,
      totalBills: outstandingReport.summary.totalBillsCount,
      pendingCount: outstandingReport.summary.totalPendingBills,
      partiallyPaidCount: outstandingReport.summary.totalPartiallyPaidBills,
      paidCount: outstandingReport.summary.totalPaidBills,
    },
    aging: {
      totalOutstanding: agingReport.summary.totalOutstanding,
      bucket0to30: agingReport.summary.current + agingReport.summary.days1_30,
      bucket31to60: agingReport.summary.days31_60,
      bucket61to90: agingReport.summary.days61_90,
      bucket91to180: agingReport.summary.days91_180,
      bucket181Plus: agingReport.summary.days181Plus,
    },
    driverVouchers: {
      totalVouchers: driverVoucherData.metrics.totalVouchers,
      totalAdvance: driverVoucherData.metrics.totalAdvance,
      totalCash: driverVoucherData.metrics.totalCash,
      totalDiesel: driverVoucherData.metrics.totalDiesel,
      totalAc: driverVoucherData.metrics.totalAc,
      totalExpense: driverVoucherData.metrics.totalExpense,
      accountingStatus: "PENDING_CONFIRMATION",
      recentVouchers: driverVoucherData.vouchers,
    },
  };
}
