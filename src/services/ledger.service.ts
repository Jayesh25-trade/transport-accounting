import { eq, and, desc, sql } from "drizzle-orm";
import { type PgTransaction } from "drizzle-orm/pg-core";
import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import { ledgerTransactions, openingBalances } from "../db/schema";
import { calculateLedgerRunningBalance, getStandardEntryTypeForVoucher, type LedgerVoucherType, type LedgerEntryType } from "../domain/ledger";
import { MoneyMath } from "../lib/decimal";

export interface PostLedgerEntryInput {
  firmId: string;
  partyId: string;
  transactionDate: string;
  particulars: string;
  voucherType: LedgerVoucherType;
  voucherNumber?: string | null;
  entryType?: LedgerEntryType | null;
  debitAmount?: number | string | null;
  creditAmount?: number | string | null;
  sourceEntityType?: string | null;
  sourceEntityId?: string | null;
  notes?: string | null;
  userId?: string | null;
}

/**
 * Gets the current running balance for a party within a firm.
 * Evaluates opening balance + all existing ledger transactions.
 */
export async function getLatestLedgerRunningBalance(
  tx: PgTransaction<any, any, any> | NodePgDatabase<any>,
  firmId: string,
  partyId: string
): Promise<number> {
  // Get latest transaction by date/created_at
  const latestTx = await tx
    .select({ runningBalance: ledgerTransactions.runningBalance })
    .from(ledgerTransactions)
    .where(and(eq(ledgerTransactions.firmId, firmId), eq(ledgerTransactions.partyId, partyId)))
    .orderBy(desc(ledgerTransactions.transactionDate), desc(ledgerTransactions.createdAt))
    .limit(1);

  if (latestTx.length > 0) {
    return Number(latestTx[0].runningBalance || 0);
  }

  // If no transactions exist, check opening balance for current active period
  const obRes = await tx
    .select({ amount: openingBalances.amount, balanceType: openingBalances.balanceType })
    .from(openingBalances)
    .where(and(eq(openingBalances.firmId, firmId), eq(openingBalances.partyId, partyId)))
    .orderBy(desc(openingBalances.effectiveDate))
    .limit(1);

  if (obRes.length > 0) {
    const obAmount = Number(obRes[0].amount || 0);
    return obRes[0].balanceType === "CREDIT" ? obAmount : -obAmount;
  }

  return 0;
}

/**
 * Service to post a new ledger transaction and update running balance atomically.
 */
export async function postLedgerEntry(
  tx: PgTransaction<any, any, any>,
  input: PostLedgerEntryInput
) {
  const previousBalance = await getLatestLedgerRunningBalance(tx, input.firmId, input.partyId);

  const entryType = input.entryType || getStandardEntryTypeForVoucher(input.voucherType);
  const debitAmount = MoneyMath.round(input.debitAmount ?? 0);
  const creditAmount = MoneyMath.round(input.creditAmount ?? 0);

  const newRunningBalance = calculateLedgerRunningBalance(
    previousBalance,
    entryType,
    debitAmount,
    creditAmount
  );

  const [posted] = await tx
    .insert(ledgerTransactions)
    .values({
      firmId: input.firmId,
      partyId: input.partyId,
      transactionDate: input.transactionDate,
      particulars: input.particulars,
      voucherType: input.voucherType,
      voucherNumber: input.voucherNumber || null,
      entryType,
      debitAmount: debitAmount.toString(),
      creditAmount: creditAmount.toString(),
      runningBalance: newRunningBalance.toString(),
      sourceEntityType: input.sourceEntityType || null,
      sourceEntityId: input.sourceEntityId || null,
      notes: input.notes || null,
      createdBy: input.userId || null,
    })
    .returning();

  return posted;
}

export interface LedgerFilters {
  dateFrom?: string;
  dateTo?: string;
  voucherType?: string;
  entryType?: string;
  search?: string;
}

export async function listLedgerTransactions(
  db: NodePgDatabase<any>,
  firmId: string,
  partyId: string,
  filters?: LedgerFilters
) {
  // Enforce firm context isolation
  const { verifyPartyInFirm } = await import("./firm.service");
  await verifyPartyInFirm(db, partyId, firmId);

  const conditions = [
    eq(ledgerTransactions.firmId, firmId),
    eq(ledgerTransactions.partyId, partyId),
  ];

  if (filters?.dateFrom) {
    conditions.push(sql`${ledgerTransactions.transactionDate} >= ${filters.dateFrom}`);
  }
  if (filters?.dateTo) {
    conditions.push(sql`${ledgerTransactions.transactionDate} <= ${filters.dateTo}`);
  }
  if (filters?.voucherType) {
    conditions.push(eq(ledgerTransactions.voucherType, filters.voucherType as any));
  }
  if (filters?.entryType) {
    conditions.push(eq(ledgerTransactions.entryType, filters.entryType as any));
  }
  if (filters?.search) {
    const term = `%${filters.search}%`;
    conditions.push(
      sql`(${ledgerTransactions.particulars} ILIKE ${term} OR ${ledgerTransactions.voucherNumber} ILIKE ${term})`
    );
  }

  return await db
    .select()
    .from(ledgerTransactions)
    .where(and(...conditions))
    .orderBy(ledgerTransactions.transactionDate, ledgerTransactions.createdAt);
}

