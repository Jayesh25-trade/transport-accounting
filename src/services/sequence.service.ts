import { sql, eq } from "drizzle-orm";
import { type PgTransaction } from "drizzle-orm/pg-core";
import { firmBillSequences } from "../db/schema";
import { ConcurrencyError } from "../lib/errors";

/**
 * Concurrency-safe, firm-scoped bill number sequence allocator.
 * Enforces Rule 7:
 *   - Bill numbers are sequential per firm (e.g. Deepraj: 1, 2, 3... Shivsai: 1, 2, 3...).
 *   - Uses `SELECT FOR UPDATE` row locking on `firm_bill_sequences` inside a transaction.
 *   - Avoids race conditions and duplicate bill numbers under concurrent requests.
 *   - Never uses `MAX(bill_number) + 1`.
 */
export async function getNextBillNumberForFirm(
  tx: PgTransaction<any, any, any>,
  firmId: string
): Promise<number> {
  // 1. Acquire row-level lock on the firm's sequence record
  const lockQuery = await tx.execute(
    sql`SELECT id, last_bill_number FROM firm_bill_sequences WHERE firm_id = ${firmId} FOR UPDATE`
  );

  let currentLastNumber = 0;

  if (lockQuery.rows.length === 0) {
    // Initialize sequence row for firm if not yet created
    await tx.insert(firmBillSequences).values({
      firmId,
      lastBillNumber: 0,
    });

    // Re-lock
    const reLockQuery = await tx.execute(
      sql`SELECT id, last_bill_number FROM firm_bill_sequences WHERE firm_id = ${firmId} FOR UPDATE`
    );

    if (reLockQuery.rows.length === 0) {
      throw new ConcurrencyError(`Failed to initialize bill sequence for firm '${firmId}'`);
    }

    currentLastNumber = Number(reLockQuery.rows[0].last_bill_number || 0);
  } else {
    currentLastNumber = Number(lockQuery.rows[0].last_bill_number || 0);
  }

  const nextNumber = currentLastNumber + 1;

  // Update sequence with new last_bill_number
  await tx
    .update(firmBillSequences)
    .set({
      lastBillNumber: nextNumber,
      updatedAt: new Date(),
    })
    .where(eq(firmBillSequences.firmId, firmId));

  return nextNumber;
}
