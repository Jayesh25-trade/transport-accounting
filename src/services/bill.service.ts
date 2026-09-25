import { sql, eq, and, inArray } from "drizzle-orm";
import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import { bills, billItems, tdsEntries, debitNotes, trips, dailyEntries, customerRules, ledgerTransactions, parties } from "../db/schema";
import { billCreateInputSchema, billEditInputSchema, type BillCreateInput, type BillEditInput } from "../validators/bill";
import { verifyPartyInFirm, verifyBillInFirm } from "./firm.service";
import { getNextBillNumberForFirm } from "./sequence.service";
import { calculateFreight } from "../domain/freight";
import { calculateShortage } from "../domain/shortage";
import { calculateTds } from "../domain/tds";
import { calculateBillTotals, validateBillEdit } from "../domain/bill";
import { postLedgerEntry } from "./ledger.service";
import { recordAuditLog } from "./audit.service";
import { EntityNotFoundError, FirmIsolationError, DomainValidationError } from "../lib/errors";

export async function createBill(
  db: NodePgDatabase<any>,
  rawInput: BillCreateInput
) {
  const input = billCreateInputSchema.parse(rawInput);

  return await db.transaction(async (tx) => {
    // 1. Firm isolation check for party
    await verifyPartyInFirm(tx, input.partyId, input.firmId);

    // 2. Fetch selected trips with their daily entries
    const tripRows = await tx
      .select({
        tripId: trips.id,
        firmId: trips.firmId,
        partyId: trips.partyId,
        isReceived: trips.isReceived,
        isBilled: trips.isBilled,
        entryDate: dailyEntries.entryDate,
        truckNumberRaw: dailyEntries.truckNumberRaw,
        lrNumber: dailyEntries.lrNumber,
        fromLocationRaw: dailyEntries.fromLocationRaw,
        toLocationRaw: dailyEntries.toLocationRaw,
        nWeight: dailyEntries.nWeight,
        rWeight: dailyEntries.rWeight,
        customerRate: dailyEntries.customerRate,
        rate: dailyEntries.rate,
      })
      .from(trips)
      .innerJoin(dailyEntries, eq(trips.dailyEntryId, dailyEntries.id))
      .where(and(eq(trips.firmId, input.firmId), inArray(trips.id, input.tripIds)));

    if (tripRows.length !== input.tripIds.length) {
      throw new EntityNotFoundError("Trip", "One or more requested trip IDs were not found");
    }

    // Validate trips: must belong to the firm, be received, and not already billed.
    // NOTE: Trips from DIFFERENT parties may coexist in one bill (customer-wise shortage).
    // Firm isolation is enforced at DB level via composite FKs on trips.firm_id.
    for (const trip of tripRows) {
      if (trip.firmId !== input.firmId) {
        throw new FirmIsolationError(`Trip '${trip.tripId}' does not belong to firm '${input.firmId}'`);
      }
      if (!trip.isReceived) {
        throw new DomainValidationError(`Trip '${trip.tripId}' is not marked as Received and cannot be billed`);
      }
      if (trip.isBilled) {
        throw new DomainValidationError(`Trip '${trip.tripId}' is already billed`);
      }
    }

    // 3. Fetch customer rules for ALL distinct parties appearing in these trips.
    // Rules are keyed by partyId for O(1) per-trip lookup.
    const distinctPartyIds = [...new Set(tripRows.map((t) => t.partyId).filter(Boolean) as string[])];
    const rulesRes = distinctPartyIds.length > 0
      ? await tx
          .select()
          .from(customerRules)
          .where(and(eq(customerRules.firmId, input.firmId), inArray(customerRules.partyId, distinctPartyIds)))
      : [];

    // Map partyId → rule (null if not configured)
    const rulesByPartyId = new Map(rulesRes.map((r) => [r.partyId, r]));

    // Fallback: use the bill's party rule for trips with no partyId set
    const billPartyRuleRes = await tx
      .select()
      .from(customerRules)
      .where(and(eq(customerRules.firmId, input.firmId), eq(customerRules.partyId, input.partyId)))
      .limit(1);
    const billPartyRule = billPartyRuleRes.length > 0 ? billPartyRuleRes[0] : null;

    // 4. Calculate per-item freight and shortage debits using TRIP-LEVEL customer rule.
    const preparedItems = tripRows.map((trip) => {
      // Resolve the shortage rule for THIS specific trip's party.
      // If the trip has no party or no rule, fall back to the bill's party rule.
      const tripRule = (trip.partyId ? rulesByPartyId.get(trip.partyId) : null) ?? billPartyRule ?? null;

      const rateToUse = Number(trip.customerRate || trip.rate || 0);
      const freightBasis = tripRule?.freightBasis || "R_WEIGHT";

      const freightRes = calculateFreight({
        freightBasis,
        rate: rateToUse,
        nWeight: trip.nWeight ? Number(trip.nWeight) : 0,
        rWeight: trip.rWeight ? Number(trip.rWeight) : 0,
      });

      const shortageRes = calculateShortage({
        nWeight: trip.nWeight ? Number(trip.nWeight) : 0,
        rWeight: trip.rWeight ? Number(trip.rWeight) : 0,
        shortageApplicable: tripRule?.shortageApplicable ?? false,
        allowanceType: tripRule?.shortageAllowanceType,
        allowanceValue: tripRule?.shortageAllowanceValue ? Number(tripRule.shortageAllowanceValue) : 0,
        shortageRuleType: tripRule?.shortageRuleType,
        materialRatePerTon: tripRule?.materialRatePerTon ? Number(tripRule.materialRatePerTon) : 0,
      });

      return {
        tripId: trip.tripId,
        tripDate: trip.entryDate,
        truckNumberRaw: trip.truckNumberRaw,
        lrNumber: trip.lrNumber,
        fromLocationRaw: trip.fromLocationRaw,
        toLocationRaw: trip.toLocationRaw,
        nWeight: trip.nWeight ? Number(trip.nWeight) : 0,
        rWeight: trip.rWeight ? Number(trip.rWeight) : 0,
        appliedRate: rateToUse,
        appliedFreightBasis: freightBasis,
        billedWeight: freightRes.billedWeight,
        freight: freightRes.freightAmount,
        shortageQtyRaw: shortageRes.rawShortageQty,
        shortageAllowanceValue: tripRule?.shortageAllowanceValue ? Number(tripRule.shortageAllowanceValue) : 0,
        shortageAllowanceType: tripRule?.shortageAllowanceType || null,
        shortageRuleType: tripRule?.shortageRuleType || null,
        shortageQtyApplicable: shortageRes.applicableShortageQty,
        shortageMaterialRate: tripRule?.materialRatePerTon ? Number(tripRule.materialRatePerTon) : 0,
        shortageDebitAmount: shortageRes.shortageDebitAmount,
      };
    });

    // 5. Calculate Subtotal Freight
    const subtotalFreight = preparedItems.reduce((sum, item) => sum + item.freight, 0);

    // 6. Calculate TDS — TDS is still resolved at bill level using the billing party's rule.
    const tdsSection = input.appliedTdsSection || billPartyRule?.tdsSection || "94C";
    const tdsPercentage = input.appliedTdsPercentage ?? (billPartyRule?.tdsPercentage ? Number(billPartyRule.tdsPercentage) : 0);
    const tdsApplicable = tdsPercentage > 0;

    const tdsRes = calculateTds({
      grossBillAmount: subtotalFreight,
      tdsApplicable,
      tdsPercentage,
      tdsSection,
    });

    // 7. Calculate Total Shortage Debit
    const totalShortageDebit = preparedItems.reduce((sum, item) => sum + item.shortageDebitAmount, 0);

    // 8. Calculate Bill Totals
    const billTotals = calculateBillTotals({
      items: preparedItems,
      tdsAmount: tdsRes.tdsAmount,
      debitNoteAmount: totalShortageDebit,
      receivedAmount: 0,
    });

    // 9. Allocate Sequential Bill Number using FOR UPDATE (Rule 7)
    const billNumber = await getNextBillNumberForFirm(tx, input.firmId);

    // 10. Insert Bill record
    const [bill] = await tx
      .insert(bills)
      .values({
        firmId: input.firmId,
        partyId: input.partyId,
        billNumber,
        billDate: input.billDate,
        totalNWeight: billTotals.totalNWeight.toString(),
        totalRWeight: billTotals.totalRWeight.toString(),
        subtotalFreight: billTotals.subtotalFreight.toString(),
        tdsAmount: billTotals.tdsAmount.toString(),
        debitNoteAmount: billTotals.debitNoteAmount.toString(),
        netBillAmount: billTotals.netBillAmount.toString(),
        receivedAmount: "0",
        pendingAmount: billTotals.netBillAmount.toString(),
        appliedTdsSection: tdsSection,
        appliedTdsPercentage: tdsPercentage.toString(),
        appliedFreightBasis: billPartyRule?.freightBasis || "R_WEIGHT",
        status: "POSTED",
        notes: input.notes || null,
        createdBy: input.userId || null,
      })
      .returning();

    // 11. Insert Bill Items
    for (const item of preparedItems) {
      await tx.insert(billItems).values({
        billId: bill.id,
        tripId: item.tripId,
        tripDate: item.tripDate,
        truckNumberRaw: item.truckNumberRaw,
        lrNumber: item.lrNumber,
        fromLocationRaw: item.fromLocationRaw,
        toLocationRaw: item.toLocationRaw,
        nWeight: item.nWeight.toString(),
        rWeight: item.rWeight.toString(),
        appliedRate: item.appliedRate.toString(),
        appliedFreightBasis: item.appliedFreightBasis,
        billedWeight: item.billedWeight.toString(),
        freight: item.freight.toString(),
        shortageQtyRaw: item.shortageQtyRaw.toString(),
        shortageAllowanceValue: item.shortageAllowanceValue.toString(),
        shortageAllowanceType: item.shortageAllowanceType,
        shortageRuleType: item.shortageRuleType,
        shortageQtyApplicable: item.shortageQtyApplicable.toString(),
        shortageMaterialRate: item.shortageMaterialRate.toString(),
        shortageDebitAmount: item.shortageDebitAmount.toString(),
      });

      // Mark trip as billed
      await tx
        .update(trips)
        .set({ isBilled: true, billId: bill.id, updatedAt: new Date() })
        .where(eq(trips.id, item.tripId));
    }

    // 12. Insert TDS Entry if applicable
    if (tdsRes.tdsAmount > 0) {
      await tx.insert(tdsEntries).values({
        firmId: input.firmId,
        billId: bill.id,
        partyId: input.partyId,
        tdsSection: tdsRes.tdsSection,
        tdsPercentage: tdsRes.tdsPercentage.toString(),
        tdsBaseAmount: tdsRes.tdsBaseAmount.toString(),
        tdsAmount: tdsRes.tdsAmount.toString(),
      });
    }

    // 13. Insert Debit Note if shortage debit exists
    if (totalShortageDebit > 0) {
      // Compute a bill-level summary materialRateApplied:
      // When trips have different material rates (different customer rules),
      // we store a weighted-average rate so the debit note header is meaningful.
      // Individual rates are preserved per-trip in bill_items.shortage_material_rate.
      const totalApplicableQty = preparedItems.reduce((sum, i) => sum + i.shortageQtyApplicable, 0);
      const weightedMaterialRate = totalApplicableQty > 0
        ? preparedItems.reduce((sum, i) => sum + i.shortageMaterialRate * i.shortageQtyApplicable, 0) / totalApplicableQty
        : (preparedItems[0]?.shortageMaterialRate ?? 0);

      await tx.insert(debitNotes).values({
        firmId: input.firmId,
        billId: bill.id,
        partyId: input.partyId,
        voucherNumber: `DN-${billNumber}`,
        voucherDate: input.billDate,
        totalShortageQtyRaw: preparedItems.reduce((sum, i) => sum + i.shortageQtyRaw, 0).toString(),
        totalShortageAllowance: preparedItems.reduce((sum, i) => sum + i.shortageAllowanceValue, 0).toString(),
        totalShortageQtyApplicable: totalApplicableQty.toString(),
        materialRateApplied: weightedMaterialRate.toFixed(4),
        debitAmount: totalShortageDebit.toString(),
        remarks: `Shortage debit for Bill #${billNumber}`,
      });
    }

    // 14. Post Ledger Transactions (Deepraj Accounting Treatment)
    // a. Transportation Charges (Credit)
    await postLedgerEntry(tx, {
      firmId: input.firmId,
      partyId: input.partyId,
      transactionDate: input.billDate,
      particulars: `Transportation Charges RCM (Bill #${billNumber})`,
      voucherType: "TRANSPORTATION_CHARGES_RCM",
      voucherNumber: billNumber.toString(),
      entryType: "CREDIT",
      creditAmount: billTotals.subtotalFreight,
      sourceEntityType: "bills",
      sourceEntityId: bill.id,
      userId: input.userId,
    });

    // b. TDS Journal (Debit)
    if (billTotals.tdsAmount > 0) {
      await postLedgerEntry(tx, {
        firmId: input.firmId,
        partyId: input.partyId,
        transactionDate: input.billDate,
        particulars: `TDS on Contract 94C Journal (Bill #${billNumber})`,
        voucherType: "TDS_JOURNAL",
        voucherNumber: billNumber.toString(),
        entryType: "DEBIT",
        debitAmount: billTotals.tdsAmount,
        sourceEntityType: "tds_entries",
        sourceEntityId: bill.id,
        userId: input.userId,
      });
    }

    // c. Debit Note (Debit)
    if (totalShortageDebit > 0) {
      await postLedgerEntry(tx, {
        firmId: input.firmId,
        partyId: input.partyId,
        transactionDate: input.billDate,
        particulars: `Shortage Debit Note RCM (DN-${billNumber})`,
        voucherType: "DEBIT_NOTE_RCM",
        voucherNumber: `DN-${billNumber}`,
        entryType: "DEBIT",
        debitAmount: totalShortageDebit,
        sourceEntityType: "debit_notes",
        sourceEntityId: bill.id,
        userId: input.userId,
      });
    }

    // 15. Audit Log
    await recordAuditLog(tx, {
      firmId: input.firmId,
      userId: input.userId,
      action: "CREATE",
      entityName: "bills",
      entityId: bill.id,
      newValues: bill,
    });

    return bill;
  });
}

/**
 * Edit an existing bill.
 * Enforces Rule 8:
 *   - Uses `SELECT FOR UPDATE` on bill row.
 *   - Checks `newNetBillAmount >= receivedAmount`. If lower, throws `BillEditValidationError`.
 *   - Updates bill totals, TDS, and debit note.
 */
export async function editBill(
  db: NodePgDatabase<any>,
  rawInput: BillEditInput
) {
  const input = billEditInputSchema.parse(rawInput);

  return await db.transaction(async (tx) => {
    // 1. Lock bill row with SELECT FOR UPDATE
    const billLockQuery = await tx.execute(
      sql`SELECT id, firm_id, party_id, bill_number, received_amount, status 
          FROM bills 
          WHERE id = ${input.billId} AND firm_id = ${input.firmId} FOR UPDATE`
    );

    if (billLockQuery.rows.length === 0) {
      throw new EntityNotFoundError("Bill", input.billId);
    }

    const currentBill = billLockQuery.rows[0];
    const existingReceivedAmount = Number(currentBill.received_amount || 0);

    // 2. Fetch trip details from bill_items snapshot (NOT from live daily_entries).
    //    bill_items captures the authoritative state at the time the bill was originally
    //    created/posted. Using daily_entries directly would allow a mutated Daily Book
    //    entry to silently change the recalculation baseline — which is the bug we fix here.
    //
    //    For editBill() the recalculation is re-done from the snapshotted weights/rates.
    //    The customer rule (shortage, TDS) is still resolved live — this is intentional:
    //    if a rule was corrected it should be applied on bill re-edit.
    const tripRows = await tx
      .select({
        tripId: trips.id,
        firmId: trips.firmId,
        partyId: trips.partyId,
        isReceived: trips.isReceived,
        // Use snapshot values from bill_items — NOT mutable daily_entries columns
        nWeight: billItems.nWeight,
        rWeight: billItems.rWeight,
        appliedRate: billItems.appliedRate,
        // customerRate / rate fallback: use the snapshotted appliedRate
        // (bill_items.appliedRate already resolved customerRate ?? rate at creation time)
      })
      .from(trips)
      .innerJoin(billItems, and(eq(billItems.tripId, trips.id), eq(billItems.billId, input.billId)))
      .where(and(eq(trips.firmId, input.firmId), inArray(trips.id, input.tripIds)));

    // Validate: all requested tripIds must be present in bill_items for this bill.
    // If a tripId is missing from bill_items it means the caller is trying to add
    // a foreign trip to a bill that doesn't own it — this is an invalid edit.
    if (tripRows.length !== input.tripIds.length) {
      throw new DomainValidationError(
        `One or more requested trip IDs are not part of bill ${input.billId}. ` +
        `Bill Edit can only recalculate trips already linked to this bill.`
      );
    }

    // 3. Fetch customer rules for ALL distinct parties in these trips (per-trip rule resolution)
    const editDistinctPartyIds = [...new Set(tripRows.map((t) => t.partyId).filter(Boolean) as string[])];
    const editRulesRes = editDistinctPartyIds.length > 0
      ? await tx
          .select()
          .from(customerRules)
          .where(and(eq(customerRules.firmId, input.firmId), inArray(customerRules.partyId, editDistinctPartyIds)))
      : [];
    const editRulesByPartyId = new Map(editRulesRes.map((r) => [r.partyId, r]));

    // Fallback: bill's own party rule for trips with no partyId
    const editBillPartyRuleRes = await tx
      .select()
      .from(customerRules)
      .where(and(eq(customerRules.firmId, input.firmId), eq(customerRules.partyId, String(currentBill.party_id))))
      .limit(1);
    const editBillPartyRule = editBillPartyRuleRes.length > 0 ? editBillPartyRuleRes[0] : null;

    // 4. Calculate per-item freight and shortage using TRIP-LEVEL customer rule
    const preparedItems = tripRows.map((trip) => {
      const tripRule = (trip.partyId ? editRulesByPartyId.get(trip.partyId) : null) ?? editBillPartyRule ?? null;

      // Use the snapshotted appliedRate from bill_items as the rate basis.
      // This is the rate that was used at billing time (resolved from customerRate ?? rate).
      const rateToUse = Number(trip.appliedRate || 0);
      const freightBasis = tripRule?.freightBasis || "R_WEIGHT";

      const freightRes = calculateFreight({
        freightBasis,
        rate: rateToUse,
        nWeight: trip.nWeight ? Number(trip.nWeight) : 0,
        rWeight: trip.rWeight ? Number(trip.rWeight) : 0,
      });

      const shortageRes = calculateShortage({
        nWeight: trip.nWeight ? Number(trip.nWeight) : 0,
        rWeight: trip.rWeight ? Number(trip.rWeight) : 0,
        shortageApplicable: tripRule?.shortageApplicable ?? false,
        allowanceType: tripRule?.shortageAllowanceType,
        allowanceValue: tripRule?.shortageAllowanceValue ? Number(tripRule.shortageAllowanceValue) : 0,
        shortageRuleType: tripRule?.shortageRuleType,
        materialRatePerTon: tripRule?.materialRatePerTon ? Number(tripRule.materialRatePerTon) : 0,
      });

      return {
        freight: freightRes.freightAmount,
        shortageDebitAmount: shortageRes.shortageDebitAmount,
        shortageQtyApplicable: shortageRes.applicableShortageQty,
        shortageMaterialRate: tripRule?.materialRatePerTon ? Number(tripRule.materialRatePerTon) : 0,
        nWeight: trip.nWeight ? Number(trip.nWeight) : 0,
        rWeight: trip.rWeight ? Number(trip.rWeight) : 0,
      };
    });

    const subtotalFreight = preparedItems.reduce((sum, i) => sum + i.freight, 0);
    const totalShortageDebit = preparedItems.reduce((sum, i) => sum + i.shortageDebitAmount, 0);

    const tdsSection = input.appliedTdsSection || editBillPartyRule?.tdsSection || "94C";
    const tdsPercentage = input.appliedTdsPercentage ?? (editBillPartyRule?.tdsPercentage ? Number(editBillPartyRule.tdsPercentage) : 0);

    const tdsRes = calculateTds({
      grossBillAmount: subtotalFreight,
      tdsApplicable: tdsPercentage > 0,
      tdsPercentage,
      tdsSection,
    });

    const billTotals = calculateBillTotals({
      items: preparedItems,
      tdsAmount: tdsRes.tdsAmount,
      debitNoteAmount: totalShortageDebit,
      receivedAmount: existingReceivedAmount,
    });

    // 5. VALIDATE BILL EDIT INTEGRITY (Rule 8)
    // Cannot lower bill net amount below already received payment amount
    validateBillEdit(existingReceivedAmount, billTotals.netBillAmount);

    // 6. Update Bill record
    const [updatedBill] = await tx
      .update(bills)
      .set({
        billDate: input.billDate,
        totalNWeight: billTotals.totalNWeight.toString(),
        totalRWeight: billTotals.totalRWeight.toString(),
        subtotalFreight: billTotals.subtotalFreight.toString(),
        tdsAmount: billTotals.tdsAmount.toString(),
        debitNoteAmount: billTotals.debitNoteAmount.toString(),
        netBillAmount: billTotals.netBillAmount.toString(),
        pendingAmount: billTotals.pendingAmount.toString(),
        appliedTdsSection: tdsSection,
        appliedTdsPercentage: tdsPercentage.toString(),
        notes: input.notes || null,
        updatedBy: input.userId || null,
        updatedAt: new Date(),
      })
      .where(eq(bills.id, input.billId))
      .returning();

    // 7. Reconcile TDS Entries
    await tx.delete(tdsEntries).where(eq(tdsEntries.billId, input.billId));
    if (billTotals.tdsAmount > 0) {
      await tx.insert(tdsEntries).values({
        firmId: input.firmId,
        billId: input.billId,
        partyId: String(currentBill.party_id),
        tdsSection: tdsRes.tdsSection,
        tdsPercentage: tdsRes.tdsPercentage.toString(),
        tdsBaseAmount: tdsRes.tdsBaseAmount.toString(),
        tdsAmount: tdsRes.tdsAmount.toString(),
      });
    }

    // 8. Reconcile Debit Notes
    await tx.delete(debitNotes).where(eq(debitNotes.billId, input.billId));
    if (totalShortageDebit > 0) {
      const editTotalApplicableQty = preparedItems.reduce((sum, i) => sum + i.shortageQtyApplicable, 0);
      const editWeightedMaterialRate = editTotalApplicableQty > 0
        ? preparedItems.reduce((sum, i) => sum + i.shortageMaterialRate * i.shortageQtyApplicable, 0) / editTotalApplicableQty
        : (preparedItems[0]?.shortageMaterialRate ?? 0);

      await tx.insert(debitNotes).values({
        firmId: input.firmId,
        billId: input.billId,
        partyId: String(currentBill.party_id),
        voucherNumber: `DN-${currentBill.bill_number}`,
        voucherDate: input.billDate,
        totalShortageQtyRaw: preparedItems.reduce((sum, i) => sum + Math.max(0, i.nWeight - i.rWeight), 0).toString(),
        totalShortageAllowance: "0",
        totalShortageQtyApplicable: editTotalApplicableQty.toString(),
        materialRateApplied: editWeightedMaterialRate.toFixed(4),
        debitAmount: totalShortageDebit.toString(),
        remarks: `Shortage debit for Bill #${currentBill.bill_number} (edited)`,
      });
    }

    // 9. Reconcile Ledger Transactions
    await tx.delete(ledgerTransactions).where(
      and(
        eq(ledgerTransactions.firmId, input.firmId),
        eq(ledgerTransactions.partyId, String(currentBill.party_id)),
        eq(ledgerTransactions.voucherNumber, String(currentBill.bill_number))
      )
    );

    // Post updated Transportation Charges Credit
    await postLedgerEntry(tx, {
      firmId: input.firmId,
      partyId: String(currentBill.party_id),
      transactionDate: input.billDate,
      particulars: `Transportation Charges RCM (Bill #${currentBill.bill_number} edited)`,
      voucherType: "TRANSPORTATION_CHARGES_RCM",
      voucherNumber: String(currentBill.bill_number),
      entryType: "CREDIT",
      creditAmount: billTotals.subtotalFreight,
      sourceEntityType: "bills",
      sourceEntityId: input.billId,
      userId: input.userId,
    });

    // Post updated TDS Journal Debit if applicable
    if (billTotals.tdsAmount > 0) {
      await postLedgerEntry(tx, {
        firmId: input.firmId,
        partyId: String(currentBill.party_id),
        transactionDate: input.billDate,
        particulars: `TDS on Contract 94C Journal (Bill #${currentBill.bill_number} edited)`,
        voucherType: "TDS_JOURNAL",
        voucherNumber: String(currentBill.bill_number),
        entryType: "DEBIT",
        debitAmount: billTotals.tdsAmount,
        sourceEntityType: "tds_entries",
        sourceEntityId: input.billId,
        userId: input.userId,
      });
    }

    // Post updated Shortage Debit Note Debit if applicable
    if (totalShortageDebit > 0) {
      await postLedgerEntry(tx, {
        firmId: input.firmId,
        partyId: String(currentBill.party_id),
        transactionDate: input.billDate,
        particulars: `Shortage Debit Note RCM (DN-${currentBill.bill_number} edited)`,
        voucherType: "DEBIT_NOTE_RCM",
        voucherNumber: `DN-${currentBill.bill_number}`,
        entryType: "DEBIT",
        debitAmount: totalShortageDebit,
        sourceEntityType: "debit_notes",
        sourceEntityId: input.billId,
        userId: input.userId,
      });
    }

    // 10. Audit Log
    await recordAuditLog(tx, {
      firmId: input.firmId,
      userId: input.userId,
      action: "UPDATE",
      entityName: "bills",
      entityId: input.billId,
      oldValues: currentBill,
      newValues: updatedBill,
    });

    return updatedBill;
  });
}

export async function previewBillCalculation(
  db: NodePgDatabase<any>,
  rawInput: {
    firmId: string;
    partyId: string;
    tripIds: string[];
    appliedTdsSection?: string;
    appliedTdsPercentage?: number;
  }
) {
  const firmId = rawInput.firmId;
  const partyId = rawInput.partyId;
  const tripIds = rawInput.tripIds || [];

  if (tripIds.length === 0) {
    return {
      items: [],
      subtotalFreight: 0,
      totalShortageDebit: 0,
      tdsSection: "94C",
      tdsPercentage: 0,
      tdsAmount: 0,
      netBillAmount: 0,
      totalNWeight: 0,
      totalRWeight: 0,
    };
  }

  // 1. Fetch trip rows
  const tripRows = await db
    .select({
      tripId: trips.id,
      firmId: trips.firmId,
      partyId: trips.partyId,
      isReceived: trips.isReceived,
      isBilled: trips.isBilled,
      srNo: dailyEntries.srNo,
      entryDate: dailyEntries.entryDate,
      truckNumberRaw: dailyEntries.truckNumberRaw,
      lrNumber: dailyEntries.lrNumber,
      fromLocationRaw: dailyEntries.fromLocationRaw,
      toLocationRaw: dailyEntries.toLocationRaw,
      nWeight: dailyEntries.nWeight,
      rWeight: dailyEntries.rWeight,
      customerRate: dailyEntries.customerRate,
      rate: dailyEntries.rate,
      partyNameRaw: dailyEntries.partyNameRaw,
    })
    .from(trips)
    .innerJoin(dailyEntries, eq(trips.dailyEntryId, dailyEntries.id))
    .where(and(eq(trips.firmId, firmId), inArray(trips.id, tripIds)));

  // 2. Fetch customer rules for distinct parties in these trips
  const distinctPartyIds = [...new Set(tripRows.map((t) => t.partyId).filter(Boolean) as string[])];
  const rulesRes = distinctPartyIds.length > 0
    ? await db
        .select()
        .from(customerRules)
        .where(and(eq(customerRules.firmId, firmId), inArray(customerRules.partyId, distinctPartyIds)))
    : [];
  const rulesByPartyId = new Map(rulesRes.map((r) => [r.partyId, r]));

  // Fallback: bill's party rule
  const billPartyRuleRes = partyId
    ? await db
        .select()
        .from(customerRules)
        .where(and(eq(customerRules.firmId, firmId), eq(customerRules.partyId, partyId)))
        .limit(1)
    : [];
  const billPartyRule = billPartyRuleRes.length > 0 ? billPartyRuleRes[0] : null;

  // 3. Calculate per-item freight and shortage using per-trip customer rule
  const preparedItems = tripRows.map((trip) => {
    const tripRule = (trip.partyId ? rulesByPartyId.get(trip.partyId) : null) ?? billPartyRule ?? null;

    const rateToUse = Number(trip.customerRate || trip.rate || 0);
    const freightBasis = tripRule?.freightBasis || "R_WEIGHT";

    const freightRes = calculateFreight({
      freightBasis,
      rate: rateToUse,
      nWeight: trip.nWeight ? Number(trip.nWeight) : 0,
      rWeight: trip.rWeight ? Number(trip.rWeight) : 0,
    });

    const shortageRes = calculateShortage({
      nWeight: trip.nWeight ? Number(trip.nWeight) : 0,
      rWeight: trip.rWeight ? Number(trip.rWeight) : 0,
      shortageApplicable: tripRule?.shortageApplicable ?? false,
      allowanceType: tripRule?.shortageAllowanceType,
      allowanceValue: tripRule?.shortageAllowanceValue ? Number(tripRule.shortageAllowanceValue) : 0,
      shortageRuleType: tripRule?.shortageRuleType,
      materialRatePerTon: tripRule?.materialRatePerTon ? Number(tripRule.materialRatePerTon) : 0,
    });

    return {
      tripId: trip.tripId,
      srNo: trip.srNo,
      tripDate: trip.entryDate,
      truckNumberRaw: trip.truckNumberRaw,
      lrNumber: trip.lrNumber,
      fromLocationRaw: trip.fromLocationRaw,
      toLocationRaw: trip.toLocationRaw,
      nWeight: trip.nWeight ? Number(trip.nWeight) : 0,
      rWeight: trip.rWeight ? Number(trip.rWeight) : 0,
      appliedRate: rateToUse,
      appliedFreightBasis: freightBasis,
      billedWeight: freightRes.billedWeight,
      freight: freightRes.freightAmount,
      shortageQtyRaw: shortageRes.rawShortageQty,
      shortageAllowanceValue: tripRule?.shortageAllowanceValue ? Number(tripRule.shortageAllowanceValue) : 0,
      shortageAllowanceType: tripRule?.shortageAllowanceType || null,
      shortageRuleType: tripRule?.shortageRuleType || null,
      shortageQtyApplicable: shortageRes.applicableShortageQty,
      shortageMaterialRate: tripRule?.materialRatePerTon ? Number(tripRule.materialRatePerTon) : 0,
      shortageDebitAmount: shortageRes.shortageDebitAmount,
    };
  });

  const subtotalFreight = preparedItems.reduce((sum, item) => sum + item.freight, 0);
  const totalShortageDebit = preparedItems.reduce((sum, item) => sum + item.shortageDebitAmount, 0);

  const tdsSection = rawInput.appliedTdsSection || billPartyRule?.tdsSection || "94C";
  const tdsPercentage = rawInput.appliedTdsPercentage ?? (billPartyRule?.tdsPercentage ? Number(billPartyRule.tdsPercentage) : 0);

  const tdsRes = calculateTds({
    grossBillAmount: subtotalFreight,
    tdsApplicable: tdsPercentage > 0,
    tdsPercentage,
    tdsSection,
  });

  const billTotals = calculateBillTotals({
    items: preparedItems,
    tdsAmount: tdsRes.tdsAmount,
    debitNoteAmount: totalShortageDebit,
    receivedAmount: 0,
  });

  return {
    items: preparedItems,
    subtotalFreight: billTotals.subtotalFreight,
    totalShortageDebit: billTotals.debitNoteAmount,
    tdsSection,
    tdsPercentage,
    tdsAmount: billTotals.tdsAmount,
    netBillAmount: billTotals.netBillAmount,
    totalNWeight: billTotals.totalNWeight,
    totalRWeight: billTotals.totalRWeight,
  };
}

export async function listBills(db: NodePgDatabase<any>, firmId: string) {
  return await db
    .select({
      id: bills.id,
      firmId: bills.firmId,
      partyId: bills.partyId,
      billNumber: bills.billNumber,
      billDate: bills.billDate,
      totalNWeight: bills.totalNWeight,
      totalRWeight: bills.totalRWeight,
      subtotalFreight: bills.subtotalFreight,
      tdsAmount: bills.tdsAmount,
      debitNoteAmount: bills.debitNoteAmount,
      netBillAmount: bills.netBillAmount,
      receivedAmount: bills.receivedAmount,
      pendingAmount: bills.pendingAmount,
      appliedTdsSection: bills.appliedTdsSection,
      appliedTdsPercentage: bills.appliedTdsPercentage,
      appliedFreightBasis: bills.appliedFreightBasis,
      status: bills.status,
      notes: bills.notes,
      createdAt: bills.createdAt,
      updatedAt: bills.updatedAt,
      partyName: parties.name,
    })
    .from(bills)
    .leftJoin(parties, eq(bills.partyId, parties.id))
    .where(eq(bills.firmId, firmId))
    .orderBy(sql`${bills.billNumber} DESC`);
}

export async function getBillById(db: NodePgDatabase<any>, billId: string, firmId: string) {
  await verifyBillInFirm(db, billId, firmId);

  const billRows = await db
    .select({
      id: bills.id,
      firmId: bills.firmId,
      partyId: bills.partyId,
      billNumber: bills.billNumber,
      billDate: bills.billDate,
      totalNWeight: bills.totalNWeight,
      totalRWeight: bills.totalRWeight,
      subtotalFreight: bills.subtotalFreight,
      tdsAmount: bills.tdsAmount,
      debitNoteAmount: bills.debitNoteAmount,
      netBillAmount: bills.netBillAmount,
      receivedAmount: bills.receivedAmount,
      pendingAmount: bills.pendingAmount,
      appliedTdsSection: bills.appliedTdsSection,
      appliedTdsPercentage: bills.appliedTdsPercentage,
      appliedFreightBasis: bills.appliedFreightBasis,
      status: bills.status,
      notes: bills.notes,
      createdAt: bills.createdAt,
      updatedAt: bills.updatedAt,
      partyName: parties.name,
    })
    .from(bills)
    .leftJoin(parties, eq(bills.partyId, parties.id))
    .where(and(eq(bills.id, billId), eq(bills.firmId, firmId)))
    .limit(1);

  if (billRows.length === 0) throw new EntityNotFoundError("Bill", billId);
  const bill = billRows[0];

  const items = await db
    .select()
    .from(billItems)
    .where(eq(billItems.billId, billId));

  const tds = await db
    .select()
    .from(tdsEntries)
    .where(eq(tdsEntries.billId, billId));

  const dns = await db
    .select()
    .from(debitNotes)
    .where(eq(debitNotes.billId, billId));

  return { ...bill, items, tdsEntries: tds, debitNotes: dns };
}

