import { sql, eq, and, inArray } from "drizzle-orm";
import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import { payments, paymentAllocations, bills, parties } from "../db/schema";
import { paymentCreateInputSchema, paymentAllocationInputSchema, type PaymentCreateInput, type PaymentAllocationInput } from "../validators/payment";
import { verifyPartyInFirm, verifyBillInFirm } from "./firm.service";
import { validatePaymentAllocation } from "../domain/payment";
import { postLedgerEntry } from "./ledger.service";
import { recordAuditLog } from "./audit.service";
import { EntityNotFoundError, PaymentAllocationError } from "../lib/errors";

/**
 * Creates a new Payment record (AGAINST_BILL or ADVANCE).
 * Advance payments maintain unallocated balance and are distinguished from against-bill allocations (Rule 9).
 * AGAINST_BILL payments lock the target bill row with SELECT FOR UPDATE and enforce over-allocation protection.
 */
export async function createPayment(
  db: NodePgDatabase<any>,
  rawInput: PaymentCreateInput
) {
  const input = paymentCreateInputSchema.parse(rawInput);

  return await db.transaction(async (tx) => {
    // 1. Verify party firm context
    await verifyPartyInFirm(tx, input.partyId, input.firmId);

    let allocatedBill = null;
    const hasTargetBill = input.paymentType === "AGAINST_BILL" && Boolean(input.billId);

    // 2. If AGAINST_BILL with explicit billId, validate and lock the target bill
    if (hasTargetBill) {
      // Lock bill row with SELECT FOR UPDATE
      const billLockQuery = await tx.execute(
        sql`SELECT id, firm_id, party_id, bill_number, net_bill_amount, received_amount, pending_amount 
            FROM bills 
            WHERE id = ${input.billId} AND firm_id = ${input.firmId} FOR UPDATE`
      );

      if (billLockQuery.rows.length === 0) {
        throw new EntityNotFoundError("Bill", input.billId!);
      }

      allocatedBill = billLockQuery.rows[0];

      // Verify party matches
      if (String(allocatedBill.party_id) !== input.partyId) {
        throw new PaymentAllocationError("Payment party and Bill party must match");
      }

      const netBillAmount = Number(allocatedBill.net_bill_amount || 0);
      const currentPendingAmount = Number(allocatedBill.pending_amount || 0);

      // Check existing allocations for this bill
      const existingAllocationsQuery = await tx.execute(
        sql`SELECT SUM(allocated_amount) as total_allocated FROM payment_allocations WHERE bill_id = ${input.billId}`
      );
      const alreadyAllocated = Number(existingAllocationsQuery.rows[0]?.total_allocated || 0);
      const remainingReceivable = Math.max(0, netBillAmount - alreadyAllocated);

      if (currentPendingAmount <= 0 || remainingReceivable <= 0) {
        throw new PaymentAllocationError("Bill is already fully paid and cannot accept further allocations");
      }

      if (input.amount > remainingReceivable) {
        throw new PaymentAllocationError(
          `Payment allocation amount (₹${input.amount}) cannot exceed remaining bill amount (₹${remainingReceivable.toFixed(2)})`
        );
      }
    }

    // Normalize payment mode for database enum ("BANK_ACCOUNT" -> "BANK_AC")
    const dbPaymentMode = (input.paymentMode === "BANK_ACCOUNT" ? "BANK_AC" : input.paymentMode) as any;

    // 3. Insert Payment
    const [payment] = await tx
      .insert(payments)
      .values({
        firmId: input.firmId,
        partyId: input.partyId,
        paymentDate: input.paymentDate,
        paymentType: input.paymentType,
        paymentMode: dbPaymentMode,
        referenceNumber: input.referenceNumber || null,
        bankName: input.bankName || null,
        amount: input.amount.toString(),
        unallocatedAmount: hasTargetBill ? "0" : input.amount.toString(),
        isFullyAllocated: hasTargetBill,
        remarks: input.remarks || null,
        createdBy: input.userId || null,
      })
      .returning();

    let allocation = null;

    // 4. If AGAINST_BILL with billId, create allocation and update bill
    if (hasTargetBill && allocatedBill) {
      const netBillAmount = Number(allocatedBill.net_bill_amount || 0);
      const currentReceivedAmount = Number(allocatedBill.received_amount || 0);
      const newReceived = currentReceivedAmount + input.amount;
      const newPending = Math.max(0, netBillAmount - newReceived);

      const [alloc] = await tx
        .insert(paymentAllocations)
        .values({
          paymentId: payment.id,
          billId: input.billId!,
          allocatedAmount: input.amount.toString(),
          allocationDate: input.paymentDate,
          remarks: input.remarks || null,
        })
        .returning();

      allocation = alloc;

      await tx
        .update(bills)
        .set({
          receivedAmount: newReceived.toString(),
          pendingAmount: newPending.toString(),
          updatedAt: new Date(),
        })
        .where(eq(bills.id, input.billId!));
    }

    // 5. Post to Ledger (Payment Debit)
    const voucherType = input.paymentMode === "CASH" ? "PAYMENT_CASH" : "PAYMENT_BANK";
    const billRefText = allocatedBill ? ` (Bill #${allocatedBill.bill_number})` : "";
    await postLedgerEntry(tx, {
      firmId: input.firmId,
      partyId: input.partyId,
      transactionDate: input.paymentDate,
      particulars: `Payment Received (${input.paymentType} - ${input.paymentMode}${billRefText} Ref #${input.referenceNumber || "N/A"})`,
      voucherType,
      voucherNumber: input.referenceNumber || (allocatedBill ? String(allocatedBill.bill_number) : undefined),
      entryType: "DEBIT",
      debitAmount: input.amount,
      sourceEntityType: "payments",
      sourceEntityId: payment.id,
      userId: input.userId,
    });

    // 6. Audit Log
    await recordAuditLog(tx, {
      firmId: input.firmId,
      userId: input.userId,
      action: "CREATE",
      entityName: "payments",
      entityId: payment.id,
      newValues: { payment, allocation },
    });

    return payment;
  });
}

/**
 * Allocates an Against Bill payment against a specific Bill.
 * Enforces Rule 9:
 *   - Lock bill row with SELECT FOR UPDATE.
 *   - Lock payment row with SELECT FOR UPDATE.
 *   - Calculates already allocated amount on bill.
 *   - Validates no over-allocation via `validatePaymentAllocation`.
 *   - Updates payment_allocations, payments.unallocated_amount, bills.received_amount, bills.pending_amount.
 */
export async function allocatePaymentToBill(
  db: NodePgDatabase<any>,
  rawInput: PaymentAllocationInput
) {
  const input = paymentAllocationInputSchema.parse(rawInput);

  return await db.transaction(async (tx) => {
    // 1. Lock payment row with SELECT FOR UPDATE
    const paymentLockQuery = await tx.execute(
      sql`SELECT id, firm_id, party_id, amount, unallocated_amount, is_fully_allocated 
          FROM payments 
          WHERE id = ${input.paymentId} AND firm_id = ${input.firmId} FOR UPDATE`
    );

    if (paymentLockQuery.rows.length === 0) {
      throw new EntityNotFoundError("Payment", input.paymentId);
    }
    const currentPayment = paymentLockQuery.rows[0];
    const paymentUnallocated = Number(currentPayment.unallocated_amount || 0);

    // 2. Lock bill row with SELECT FOR UPDATE
    const billLockQuery = await tx.execute(
      sql`SELECT id, firm_id, party_id, net_bill_amount, received_amount, pending_amount 
          FROM bills 
          WHERE id = ${input.billId} AND firm_id = ${input.firmId} FOR UPDATE`
    );

    if (billLockQuery.rows.length === 0) {
      throw new EntityNotFoundError("Bill", input.billId);
    }
    const currentBill = billLockQuery.rows[0];
    const netBillAmount = Number(currentBill.net_bill_amount || 0);

    // 3. Verify party context matching
    if (String(currentPayment.party_id) !== String(currentBill.party_id)) {
      throw new PaymentAllocationError("Payment party and Bill party must match");
    }

    // 4. Calculate existing allocations for this bill
    const existingAllocationsQuery = await tx.execute(
      sql`SELECT SUM(allocated_amount) as total_allocated FROM payment_allocations WHERE bill_id = ${input.billId}`
    );
    const alreadyAllocated = Number(existingAllocationsQuery.rows[0]?.total_allocated || 0);

    // 5. Validate allocation using pure domain math
    const validationResult = validatePaymentAllocation({
      netBillAmount,
      alreadyAllocatedAmount: alreadyAllocated,
      requestedAllocationAmount: input.allocatedAmount,
      paymentUnallocatedAmount: paymentUnallocated,
    });

    // 6. Insert payment_allocation record
    const [allocation] = await tx
      .insert(paymentAllocations)
      .values({
        paymentId: input.paymentId,
        billId: input.billId,
        allocatedAmount: validationResult.allowedAllocationAmount.toString(),
        allocationDate: input.allocationDate,
        remarks: input.remarks || null,
      })
      .returning();

    // 7. Update Payment unallocated amount and status
    await tx
      .update(payments)
      .set({
        unallocatedAmount: validationResult.newPaymentUnallocatedAmount.toString(),
        isFullyAllocated: validationResult.isFullyAllocated,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, input.paymentId));

    // 8. Update Bill received amount and pending amount
    await tx
      .update(bills)
      .set({
        receivedAmount: validationResult.newBillAllocatedTotal.toString(),
        pendingAmount: validationResult.newBillPendingAmount.toString(),
        updatedAt: new Date(),
      })
      .where(eq(bills.id, input.billId));

    // 9. Audit Log
    await recordAuditLog(tx, {
      firmId: input.firmId,
      action: "CREATE",
      entityName: "payment_allocations",
      entityId: allocation.id,
      newValues: { allocation, validationResult },
    });

    return allocation;
  });
}

export async function listPayments(db: NodePgDatabase<any>, firmId: string) {
  const paymentRows = await db
    .select({
      id: payments.id,
      firmId: payments.firmId,
      partyId: payments.partyId,
      paymentDate: payments.paymentDate,
      paymentType: payments.paymentType,
      paymentMode: payments.paymentMode,
      referenceNumber: payments.referenceNumber,
      bankName: payments.bankName,
      amount: payments.amount,
      unallocatedAmount: payments.unallocatedAmount,
      isFullyAllocated: payments.isFullyAllocated,
      remarks: payments.remarks,
      createdAt: payments.createdAt,
      updatedAt: payments.updatedAt,
      partyName: parties.name,
    })
    .from(payments)
    .leftJoin(parties, eq(payments.partyId, parties.id))
    .where(eq(payments.firmId, firmId))
    .orderBy(sql`${payments.createdAt} DESC`);

  const paymentIds = paymentRows.map((p) => p.id);
  const allocationsRes = paymentIds.length > 0
    ? await db
        .select({
          id: paymentAllocations.id,
          paymentId: paymentAllocations.paymentId,
          billId: paymentAllocations.billId,
          allocatedAmount: paymentAllocations.allocatedAmount,
          allocationDate: paymentAllocations.allocationDate,
          billNumber: bills.billNumber,
        })
        .from(paymentAllocations)
        .leftJoin(bills, eq(paymentAllocations.billId, bills.id))
        .where(inArray(paymentAllocations.paymentId, paymentIds))
    : [];

  const allocsMap = new Map<string, any[]>();
  allocationsRes.forEach((a) => {
    const list = allocsMap.get(a.paymentId) || [];
    list.push(a);
    allocsMap.set(a.paymentId, list);
  });

  return paymentRows.map((p) => ({
    ...p,
    allocations: allocsMap.get(p.id) || [],
  }));
}

export async function getPaymentById(db: NodePgDatabase<any>, paymentId: string, firmId: string) {
  const paymentRows = await db
    .select({
      id: payments.id,
      firmId: payments.firmId,
      partyId: payments.partyId,
      paymentDate: payments.paymentDate,
      paymentType: payments.paymentType,
      paymentMode: payments.paymentMode,
      referenceNumber: payments.referenceNumber,
      bankName: payments.bankName,
      amount: payments.amount,
      unallocatedAmount: payments.unallocatedAmount,
      isFullyAllocated: payments.isFullyAllocated,
      remarks: payments.remarks,
      createdAt: payments.createdAt,
      updatedAt: payments.updatedAt,
      partyName: parties.name,
    })
    .from(payments)
    .leftJoin(parties, eq(payments.partyId, parties.id))
    .where(and(eq(payments.id, paymentId), eq(payments.firmId, firmId)))
    .limit(1);

  if (paymentRows.length === 0) throw new EntityNotFoundError("Payment", paymentId);
  const payment = paymentRows[0];

  const allocationsRes = await db
    .select({
      id: paymentAllocations.id,
      paymentId: paymentAllocations.paymentId,
      billId: paymentAllocations.billId,
      allocatedAmount: paymentAllocations.allocatedAmount,
      allocationDate: paymentAllocations.allocationDate,
      billNumber: bills.billNumber,
      billDate: bills.billDate,
      netBillAmount: bills.netBillAmount,
      pendingAmount: bills.pendingAmount,
    })
    .from(paymentAllocations)
    .leftJoin(bills, eq(paymentAllocations.billId, bills.id))
    .where(eq(paymentAllocations.paymentId, paymentId));

  return { ...payment, allocations: allocationsRes };
}

