import { eq, and } from "drizzle-orm";
import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import { bankAccounts } from "../db/schema";
import {
  bankAccountCreateSchema,
  bankAccountUpdateSchema,
  type BankAccountCreateInput,
  type BankAccountUpdateInput,
} from "../validators/bank-account";
import { EntityNotFoundError, FirmIsolationError } from "../lib/errors";

export async function listBankAccounts(
  db: NodePgDatabase<any>,
  firmId: string,
  includeInactive = false
) {
  if (includeInactive) {
    return await db
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.firmId, firmId));
  }
  return await db
    .select()
    .from(bankAccounts)
    .where(and(eq(bankAccounts.firmId, firmId), eq(bankAccounts.isActive, true)));
}

export async function getBankAccountById(
  db: NodePgDatabase<any>,
  id: string,
  firmId: string
) {
  const rows = await db
    .select()
    .from(bankAccounts)
    .where(and(eq(bankAccounts.id, id), eq(bankAccounts.firmId, firmId)))
    .limit(1);

  if (rows.length === 0) {
    throw new EntityNotFoundError("Bank Account", id);
  }
  return rows[0];
}

export async function createBankAccount(
  db: NodePgDatabase<any>,
  firmId: string,
  rawInput: BankAccountCreateInput
) {
  const input = bankAccountCreateSchema.parse(rawInput);

  return await db.transaction(async (tx) => {
    // If setting as default for bills, un-default existing bank accounts for this firm
    if (input.isDefaultForBills) {
      await tx
        .update(bankAccounts)
        .set({ isDefaultForBills: false, updatedAt: new Date() })
        .where(eq(bankAccounts.firmId, firmId));
    }

    const [created] = await tx
      .insert(bankAccounts)
      .values({
        ...input,
        firmId,
      })
      .returning();

    return created;
  });
}

export async function updateBankAccount(
  db: NodePgDatabase<any>,
  id: string,
  firmId: string,
  rawInput: BankAccountUpdateInput
) {
  const input = bankAccountUpdateSchema.parse(rawInput);

  return await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(bankAccounts)
      .where(and(eq(bankAccounts.id, id), eq(bankAccounts.firmId, firmId)))
      .limit(1);

    if (existing.length === 0) {
      throw new EntityNotFoundError("Bank Account", id);
    }

    if (input.isDefaultForBills) {
      await tx
        .update(bankAccounts)
        .set({ isDefaultForBills: false, updatedAt: new Date() })
        .where(eq(bankAccounts.firmId, firmId));
    }

    const [updated] = await tx
      .update(bankAccounts)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(and(eq(bankAccounts.id, id), eq(bankAccounts.firmId, firmId)))
      .returning();

    return updated;
  });
}

export async function setDefaultBankAccount(
  db: NodePgDatabase<any>,
  id: string,
  firmId: string
) {
  return await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(bankAccounts)
      .where(and(eq(bankAccounts.id, id), eq(bankAccounts.firmId, firmId)))
      .limit(1);

    if (existing.length === 0) {
      throw new EntityNotFoundError("Bank Account", id);
    }

    await tx
      .update(bankAccounts)
      .set({ isDefaultForBills: false, updatedAt: new Date() })
      .where(eq(bankAccounts.firmId, firmId));

    const [updated] = await tx
      .update(bankAccounts)
      .set({ isDefaultForBills: true, isActive: true, updatedAt: new Date() })
      .where(and(eq(bankAccounts.id, id), eq(bankAccounts.firmId, firmId)))
      .returning();

    return updated;
  });
}
