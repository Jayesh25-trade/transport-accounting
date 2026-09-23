import { eq, and } from "drizzle-orm";
import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import { openingBalances } from "../db/schema";
import { openingBalanceInputSchema, type OpeningBalanceInput } from "../validators/opening-balance";
import { verifyPartyInFirm } from "./firm.service";
import { postLedgerEntry } from "./ledger.service";
import { recordAuditLog } from "./audit.service";

export async function createOpeningBalance(
  db: NodePgDatabase<any>,
  rawInput: OpeningBalanceInput
) {
  const input = openingBalanceInputSchema.parse(rawInput);

  return await db.transaction(async (tx) => {
    // 1. Verify party in firm context
    await verifyPartyInFirm(tx, input.partyId, input.firmId);

    // 2. Insert opening_balances record
    const [ob] = await tx
      .insert(openingBalances)
      .values({
        firmId: input.firmId,
        partyId: input.partyId,
        financialYear: input.financialYear,
        amount: input.amount.toString(),
        balanceType: input.balanceType,
        effectiveDate: input.effectiveDate,
        notes: input.notes || null,
        createdBy: input.userId || null,
      })
      .returning();

    // 3. Post to Ledger
    const debitAmount = input.balanceType === "DEBIT" ? input.amount : 0;
    const creditAmount = input.balanceType === "CREDIT" ? input.amount : 0;

    await postLedgerEntry(tx, {
      firmId: input.firmId,
      partyId: input.partyId,
      transactionDate: input.effectiveDate,
      particulars: `Opening Balance (${input.financialYear})`,
      voucherType: "OPENING_BALANCE",
      entryType: input.balanceType,
      debitAmount,
      creditAmount,
      sourceEntityType: "opening_balances",
      sourceEntityId: ob.id,
      userId: input.userId,
    });

    // 4. Audit Log
    await recordAuditLog(tx, {
      firmId: input.firmId,
      userId: input.userId,
      action: "CREATE",
      entityName: "opening_balances",
      entityId: ob.id,
      newValues: ob,
    });

    return ob;
  });
}

export async function listOpeningBalances(db: NodePgDatabase<any>, firmId: string) {
  return await db.select().from(openingBalances).where(eq(openingBalances.firmId, firmId));
}

