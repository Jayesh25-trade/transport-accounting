import { sql, eq, and, gte, lte, desc } from "drizzle-orm";
import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import { bills, parties, payments } from "../db/schema";
import { MoneyMath } from "../lib/decimal";

export interface OutstandingReportFilter {
  partyId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: "ALL" | "PENDING" | "PARTIALLY_PAID" | "PAID";
}

export interface AgingReportFilter {
  asOfDate?: string;
  partyId?: string;
}

/**
 * Calculates Outstanding Report (Party-wise and Bill-wise).
 * Uses existing bill totals and received payments.
 * Unallocated advance payments are reported separately and NOT subtracted from bill pending amounts.
 */
export async function getOutstandingReport(
  db: NodePgDatabase<any>,
  firmId: string,
  filter: OutstandingReportFilter = {}
) {
  const conditions = [eq(bills.firmId, firmId)];

  if (filter.partyId) {
    conditions.push(eq(bills.partyId, filter.partyId));
  }
  if (filter.dateFrom) {
    conditions.push(gte(bills.billDate, filter.dateFrom));
  }
  if (filter.dateTo) {
    conditions.push(lte(bills.billDate, filter.dateTo));
  }

  const billRows = await db
    .select({
      id: bills.id,
      firmId: bills.firmId,
      partyId: bills.partyId,
      billNumber: bills.billNumber,
      billDate: bills.billDate,
      subtotalFreight: bills.subtotalFreight,
      debitNoteAmount: bills.debitNoteAmount,
      tdsAmount: bills.tdsAmount,
      netBillAmount: bills.netBillAmount,
      receivedAmount: bills.receivedAmount,
      pendingAmount: bills.pendingAmount,
      dbStatus: bills.status,
      partyName: parties.name,
    })
    .from(bills)
    .leftJoin(parties, eq(bills.partyId, parties.id))
    .where(and(...conditions))
    .orderBy(desc(bills.billNumber));

  const mappedBills = billRows.map((b) => {
    const grossBillAmount = Number(b.subtotalFreight || 0);
    const shortageDebit = Number(b.debitNoteAmount || 0);
    const tdsAmount = Number(b.tdsAmount || 0);
    const netBillAmount = Number(b.netBillAmount || 0);
    const receivedAmount = Number(b.receivedAmount || 0);
    const pendingAmount = Number(b.pendingAmount || 0);

    let calculatedStatus: "PENDING" | "PARTIALLY_PAID" | "PAID";
    if (pendingAmount <= 0) {
      calculatedStatus = "PAID";
    } else if (receivedAmount > 0) {
      calculatedStatus = "PARTIALLY_PAID";
    } else {
      calculatedStatus = "PENDING";
    }

    return {
      id: b.id,
      firmId: b.firmId,
      partyId: b.partyId,
      partyName: b.partyName || "Unknown Party",
      billNumber: b.billNumber,
      billDate: b.billDate,
      grossBillAmount,
      shortageDebit,
      tdsAmount,
      netBillAmount,
      receivedAmount,
      pendingAmount,
      status: calculatedStatus,
      dbStatus: b.dbStatus,
    };
  });

  const filteredBills = filter.status && filter.status !== "ALL"
    ? mappedBills.filter((b) => b.status === filter.status)
    : mappedBills;

  let totalOutstanding = 0;
  let totalPendingBills = 0;
  let totalPartiallyPaidBills = 0;
  let totalPaidBills = 0;

  for (const b of filteredBills) {
    if (b.status === "PENDING") totalPendingBills++;
    if (b.status === "PARTIALLY_PAID") totalPartiallyPaidBills++;
    if (b.status === "PAID") totalPaidBills++;

    if (b.pendingAmount > 0) {
      totalOutstanding = MoneyMath.add([totalOutstanding, b.pendingAmount]);
    }
  }

  // Fetch unallocated advance payments
  const advConditions = [
    eq(payments.firmId, firmId),
    eq(payments.paymentType, "ADVANCE"),
  ];
  if (filter.partyId) {
    advConditions.push(eq(payments.partyId, filter.partyId));
  }

  const advanceRows = await db
    .select({
      id: payments.id,
      firmId: payments.firmId,
      partyId: payments.partyId,
      partyName: parties.name,
      paymentDate: payments.paymentDate,
      paymentMode: payments.paymentMode,
      referenceNumber: payments.referenceNumber,
      amount: payments.amount,
      unallocatedAmount: payments.unallocatedAmount,
      isFullyAllocated: payments.isFullyAllocated,
    })
    .from(payments)
    .leftJoin(parties, eq(payments.partyId, parties.id))
    .where(and(...advConditions))
    .orderBy(desc(payments.paymentDate));

  const activeAdvances = advanceRows.filter((a) => Number(a.unallocatedAmount || 0) > 0);

  let totalUnallocatedAdvances = 0;
  for (const adv of activeAdvances) {
    totalUnallocatedAdvances = MoneyMath.add([
      totalUnallocatedAdvances,
      Number(adv.unallocatedAmount || 0),
    ]);
  }

  return {
    bills: filteredBills,
    summary: {
      totalOutstanding,
      totalPendingBills,
      totalPartiallyPaidBills,
      totalPaidBills,
      totalBillsCount: filteredBills.length,
      totalUnallocatedAdvances,
    },
    advances: activeAdvances.map((adv) => ({
      id: adv.id,
      partyId: adv.partyId,
      partyName: adv.partyName || "Unknown Party",
      paymentDate: adv.paymentDate,
      paymentMode: adv.paymentMode,
      referenceNumber: adv.referenceNumber,
      amount: Number(adv.amount || 0),
      unallocatedAmount: Number(adv.unallocatedAmount || 0),
    })),
  };
}

/**
 * Calculates Aging Report based on outstanding bill amounts relative to an As-Of Date.
 * Aging buckets:
 * - Current (0 days)
 * - 1–30 Days
 * - 31–60 Days
 * - 61–90 Days
 * - 91–180 Days
 * - 181+ Days
 *
 * Excludes fully paid bills (pendingAmount == 0).
 * Partially paid bills age ONLY their remaining pending amount.
 */
export async function getAgingReport(
  db: NodePgDatabase<any>,
  firmId: string,
  filter: AgingReportFilter = {}
) {
  const asOfDateStr = filter.asOfDate || new Date().toISOString().split("T")[0];
  const asOfTime = new Date(asOfDateStr + "T00:00:00Z").getTime();

  const conditions = [
    eq(bills.firmId, firmId),
    lte(bills.billDate, asOfDateStr),
    sql`${bills.pendingAmount} > 0`,
  ];

  if (filter.partyId) {
    conditions.push(eq(bills.partyId, filter.partyId));
  }

  const billRows = await db
    .select({
      id: bills.id,
      firmId: bills.firmId,
      partyId: bills.partyId,
      billNumber: bills.billNumber,
      billDate: bills.billDate,
      netBillAmount: bills.netBillAmount,
      receivedAmount: bills.receivedAmount,
      pendingAmount: bills.pendingAmount,
      partyName: parties.name,
    })
    .from(bills)
    .leftJoin(parties, eq(bills.partyId, parties.id))
    .where(and(...conditions))
    .orderBy(bills.billDate);

  let summaryCurrent = 0;
  let summaryDays1_30 = 0;
  let summaryDays31_60 = 0;
  let summaryDays61_90 = 0;
  let summaryDays91_180 = 0;
  let summaryDays181Plus = 0;
  let totalOutstanding = 0;

  const partyBucketMap = new Map<string, {
    partyId: string;
    partyName: string;
    current: number;
    days1_30: number;
    days31_60: number;
    days61_90: number;
    days91_180: number;
    days181Plus: number;
    totalOutstanding: number;
    billCount: number;
  }>();

  const billDetails = billRows.map((b) => {
    const billTime = new Date(b.billDate + "T00:00:00Z").getTime();
    const diffMs = asOfTime - billTime;
    const ageInDays = Math.max(0, Math.floor(diffMs / (86400 * 1000)));

    const pendingAmount = Number(b.pendingAmount || 0);
    const netBillAmount = Number(b.netBillAmount || 0);
    const receivedAmount = Number(b.receivedAmount || 0);

    let bucket: "Current" | "1–30 Days" | "31–60 Days" | "61–90 Days" | "91–180 Days" | "181+ Days";
    if (ageInDays <= 0) {
      bucket = "Current";
      summaryCurrent = MoneyMath.add([summaryCurrent, pendingAmount]);
    } else if (ageInDays <= 30) {
      bucket = "1–30 Days";
      summaryDays1_30 = MoneyMath.add([summaryDays1_30, pendingAmount]);
    } else if (ageInDays <= 60) {
      bucket = "31–60 Days";
      summaryDays31_60 = MoneyMath.add([summaryDays31_60, pendingAmount]);
    } else if (ageInDays <= 90) {
      bucket = "61–90 Days";
      summaryDays61_90 = MoneyMath.add([summaryDays61_90, pendingAmount]);
    } else if (ageInDays <= 180) {
      bucket = "91–180 Days";
      summaryDays91_180 = MoneyMath.add([summaryDays91_180, pendingAmount]);
    } else {
      bucket = "181+ Days";
      summaryDays181Plus = MoneyMath.add([summaryDays181Plus, pendingAmount]);
    }

    totalOutstanding = MoneyMath.add([totalOutstanding, pendingAmount]);

    const partyName = b.partyName || "Unknown Party";
    let partyObj = partyBucketMap.get(b.partyId);
    if (!partyObj) {
      partyObj = {
        partyId: b.partyId,
        partyName,
        current: 0,
        days1_30: 0,
        days31_60: 0,
        days61_90: 0,
        days91_180: 0,
        days181Plus: 0,
        totalOutstanding: 0,
        billCount: 0,
      };
      partyBucketMap.set(b.partyId, partyObj);
    }

    partyObj.billCount += 1;
    partyObj.totalOutstanding = MoneyMath.add([partyObj.totalOutstanding, pendingAmount]);

    if (bucket === "Current") partyObj.current = MoneyMath.add([partyObj.current, pendingAmount]);
    else if (bucket === "1–30 Days") partyObj.days1_30 = MoneyMath.add([partyObj.days1_30, pendingAmount]);
    else if (bucket === "31–60 Days") partyObj.days31_60 = MoneyMath.add([partyObj.days31_60, pendingAmount]);
    else if (bucket === "61–90 Days") partyObj.days61_90 = MoneyMath.add([partyObj.days61_90, pendingAmount]);
    else if (bucket === "91–180 Days") partyObj.days91_180 = MoneyMath.add([partyObj.days91_180, pendingAmount]);
    else partyObj.days181Plus = MoneyMath.add([partyObj.days181Plus, pendingAmount]);

    return {
      id: b.id,
      partyId: b.partyId,
      partyName,
      billNumber: b.billNumber,
      billDate: b.billDate,
      netBillAmount,
      receivedAmount,
      pendingAmount,
      ageInDays,
      bucket,
    };
  });

  return {
    asOfDate: asOfDateStr,
    summary: {
      current: summaryCurrent,
      days1_30: summaryDays1_30,
      days31_60: summaryDays31_60,
      days61_90: summaryDays61_90,
      days91_180: summaryDays91_180,
      days181Plus: summaryDays181Plus,
      totalOutstanding,
    },
    partyBreakdown: Array.from(partyBucketMap.values()),
    billDetails,
  };
}
