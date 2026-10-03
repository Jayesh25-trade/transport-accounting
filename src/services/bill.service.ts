import { sql, eq, and, inArray } from "drizzle-orm";
import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import { bills, billItems, tdsEntries, debitNotes, trips, dailyEntries, driverVouchers, customerRules, ledgerTransactions, parties, bankAccounts, firmBillSettings } from "../db/schema";
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
        dailyEntryId: trips.dailyEntryId,
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
    const distinctPartyIds = [...new Set(tripRows.map((t) => t.partyId).filter(Boolean) as string[])];

    // Reject mixed-party trip selection
    if (distinctPartyIds.length > 1) {
      throw new DomainValidationError("Selected trips belong to multiple billing parties. Please create separate bills.");
    }

    // Single-party enforcement: effectivePartyId is the trip's partyId when present, otherwise input.partyId
    const effectivePartyId = distinctPartyIds.length === 1 ? distinctPartyIds[0] : input.partyId;

    // Firm isolation check for effective party
    await verifyPartyInFirm(tx, effectivePartyId, input.firmId);

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
      .where(and(eq(customerRules.firmId, input.firmId), eq(customerRules.partyId, effectivePartyId)))
      .limit(1);
    const billPartyRule = billPartyRuleRes.length > 0 ? billPartyRuleRes[0] : null;

    // 4. Calculate per-item freight and shortage debits using TRIP-LEVEL customer rule.
    const preparedItems = tripRows.map((trip) => {
      // Resolve the shortage rule for THIS specific trip's party.
      // If the trip has no party or no rule, fall back to the bill's party rule.
      const tripRule = (trip.partyId ? rulesByPartyId.get(trip.partyId) : null) ?? billPartyRule ?? null;

      const rateToUse = Number(trip.customerRate || trip.rate || 0);
      const freightBasis = tripRule?.freightBasis || "AUTO_SHORTAGE_BASED";

      const shortageRes = calculateShortage({
        nWeight: trip.nWeight ? Number(trip.nWeight) : 0,
        rWeight: trip.rWeight ? Number(trip.rWeight) : 0,
        shortageApplicable: tripRule?.shortageApplicable ?? false,
        allowanceType: tripRule?.shortageAllowanceType,
        allowanceValue: tripRule?.shortageAllowanceValue ? Number(tripRule.shortageAllowanceValue) : 0,
        shortageRuleType: tripRule?.shortageRuleType,
        materialRatePerTon: rateToUse,
      });

      const freightRes = calculateFreight({
        freightBasis,
        rate: rateToUse,
        nWeight: trip.nWeight ? Number(trip.nWeight) : 0,
        rWeight: trip.rWeight ? Number(trip.rWeight) : 0,
        fixedFreightAmount: rateToUse,
        applicableShortageDebit: shortageRes.shortageDebitAmount,
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
        shortageMaterialRate: rateToUse,
        shortageDebitAmount: shortageRes.shortageDebitAmount,
      };
    });

    // 5. Calculate Subtotal Freight
    const subtotalFreight = preparedItems.reduce((sum, item) => sum + item.freight, 0);

    // 6. Calculate Total Shortage Debit
    const totalShortageDebit = preparedItems.reduce((sum, item) => sum + item.shortageDebitAmount, 0);

    // 7. Calculate Amount After Shortage = Gross Freight - Total Shortage Debit
    const amountAfterShortage = Math.max(0, subtotalFreight - totalShortageDebit);

    // 8. Calculate TDS on Amount After Shortage
    const tdsSection = input.appliedTdsSection || billPartyRule?.tdsSection || "94C";
    const tdsPercentage = input.appliedTdsPercentage ?? (billPartyRule?.tdsPercentage ? Number(billPartyRule.tdsPercentage) : 0);
    const tdsApplicable = tdsPercentage > 0;

    const tdsRes = calculateTds({
      grossBillAmount: amountAfterShortage,
      tdsApplicable,
      tdsPercentage,
      tdsSection,
    });

    // 8B. CONFIRMED BUSINESS RULE: Fetch Driver Voucher totals for all trips in this bill.
    //     DV (advance + cash + diesel + ac) is deducted from Net Payable.
    //     We sum them here and snapshot on the bill — same pattern as tds_amount.
    const tripDailyEntryIds = tripRows.map((t) => t.dailyEntryId).filter(Boolean) as string[];
    const dvRows = tripDailyEntryIds.length > 0
      ? await tx
          .select({
            advance: driverVouchers.advance,
            cash: driverVouchers.cash,
            diesel: driverVouchers.diesel,
            ac: driverVouchers.ac,
          })
          .from(driverVouchers)
          .where(inArray(driverVouchers.dailyEntryId, tripDailyEntryIds))
      : [];
    const driverVoucherTotal = dvRows.reduce(
      (sum, dv) =>
        sum +
        Number(dv.advance || 0) +
        Number(dv.cash || 0) +
        Number(dv.diesel || 0) +
        Number(dv.ac || 0),
      0
    );

    // 9. Calculate Bill Totals (including DV deduction)
    const billTotals = calculateBillTotals({
      items: preparedItems,
      tdsAmount: tdsRes.tdsAmount,
      debitNoteAmount: totalShortageDebit,
      receivedAmount: 0,
      driverVoucherTotal,
    });

    // 9. Allocate Sequential Bill Number using FOR UPDATE (Rule 7)
    const billNumber = await getNextBillNumberForFirm(tx, input.firmId);

    // 9B. Resolve Bank Account Snapshot & Firm Bill Settings
    let selectedBankAccountId = input.bankAccountId || null;
    let bankDetailsSnapshot: any = null;

    try {
      if (selectedBankAccountId) {
        const bankRows = await tx
          .select()
          .from(bankAccounts)
          .where(and(eq(bankAccounts.id, selectedBankAccountId), eq(bankAccounts.firmId, input.firmId)))
          .limit(1);
        if (bankRows.length > 0) {
          bankDetailsSnapshot = {
            id: bankRows[0].id,
            accountDisplayName: bankRows[0].accountDisplayName,
            bankName: bankRows[0].bankName,
            accountNumber: bankRows[0].accountNumber,
            ifscCode: bankRows[0].ifscCode,
            branch: bankRows[0].branch || null,
            accountType: bankRows[0].accountType,
            upiId: bankRows[0].upiId || null,
          };
        }
      } else {
        const defaultBankRows = await tx
          .select()
          .from(bankAccounts)
          .where(and(eq(bankAccounts.firmId, input.firmId), eq(bankAccounts.isDefaultForBills, true)))
          .limit(1);
        if (defaultBankRows.length > 0) {
          selectedBankAccountId = defaultBankRows[0].id;
          bankDetailsSnapshot = {
            id: defaultBankRows[0].id,
            accountDisplayName: defaultBankRows[0].accountDisplayName,
            bankName: defaultBankRows[0].bankName,
            accountNumber: defaultBankRows[0].accountNumber,
            ifscCode: defaultBankRows[0].ifscCode,
            branch: defaultBankRows[0].branch || null,
            accountType: defaultBankRows[0].accountType,
            upiId: defaultBankRows[0].upiId || null,
          };
        }
      }
    } catch (_err) {
      // bank_accounts table might not exist in unmigrated DB environments
    }

    let settingsRows: any[] = [];
    try {
      settingsRows = await tx
        .select()
        .from(firmBillSettings)
        .where(eq(firmBillSettings.firmId, input.firmId))
        .limit(1);
    } catch (_err) {
      // firm_bill_settings table might not exist in unmigrated DB environments
    }
    const settings = settingsRows.length > 0 ? settingsRows[0] : null;

    const displayOptionsSnapshot = {
      showBankDetails: input.displayOptions?.showBankDetails ?? settings?.showBankDetails ?? true,
      showPaymentTerms: input.displayOptions?.showPaymentTerms ?? settings?.showPaymentTerms ?? true,
      showDueDate: input.displayOptions?.showDueDate ?? settings?.showDueDate ?? true,
      showAmountInWords: input.displayOptions?.showAmountInWords ?? settings?.showAmountInWords ?? true,
      showRemarks: input.displayOptions?.showRemarks ?? settings?.showRemarks ?? true,
      showTermsAndConditions: input.displayOptions?.showTermsAndConditions ?? settings?.showTermsAndConditions ?? true,
      showAuthorisedSignature: input.displayOptions?.showAuthorisedSignature ?? settings?.showAuthorisedSignature ?? true,
      showVehicleType: input.displayOptions?.showVehicleType ?? settings?.showVehicleType ?? false,
      showGstDetails: input.displayOptions?.showGstDetails ?? settings?.showGstDetails ?? false,
      showReverseCharge: input.displayOptions?.showReverseCharge ?? settings?.showReverseCharge ?? false,
      showPlaceOfSupply: input.displayOptions?.showPlaceOfSupply ?? settings?.showPlaceOfSupply ?? false,
    };

    const paymentTermsVal = input.paymentTerms || settings?.defaultPaymentTerms || "30 Days";
    const termsAndConditionsVal = input.termsAndConditions || settings?.defaultTermsAndConditions || "Payment to be made within 30 days. Subject to local jurisdiction.";

    // 10. Insert Bill record
    const [bill] = await tx
      .insert(bills)
      .values({
        firmId: input.firmId,
        partyId: effectivePartyId,
        billNumber,
        billDate: input.billDate,
        totalNWeight: billTotals.totalNWeight.toString(),
        totalRWeight: billTotals.totalRWeight.toString(),
        subtotalFreight: billTotals.subtotalFreight.toString(),
        tdsAmount: billTotals.tdsAmount.toString(),
        debitNoteAmount: billTotals.debitNoteAmount.toString(),
        driverVoucherTotal: billTotals.driverVoucherTotal.toString(),
        netBillAmount: billTotals.netBillAmount.toString(),
        receivedAmount: "0",
        pendingAmount: billTotals.netBillAmount.toString(),
        appliedTdsSection: tdsSection,
        appliedTdsPercentage: tdsPercentage.toString(),
        appliedFreightBasis: billPartyRule?.freightBasis || "AUTO_SHORTAGE_BASED",
        bankAccountId: selectedBankAccountId,
        bankDetailsSnapshot,
        paymentTerms: paymentTermsVal,
        dueDate: input.dueDate || null,
        termsAndConditions: termsAndConditionsVal,
        displayOptionsSnapshot,
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
        partyId: effectivePartyId,
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
        partyId: effectivePartyId,
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
    const tx1 = await postLedgerEntry(tx, {
      firmId: input.firmId,
      partyId: effectivePartyId,
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
    let currentBalance = Number(tx1.runningBalance);

    // b. TDS Journal (Debit)
    if (billTotals.tdsAmount > 0) {
      const tx2 = await postLedgerEntry(tx, {
        firmId: input.firmId,
        partyId: effectivePartyId,
        transactionDate: input.billDate,
        particulars: `TDS on Contract 94C Journal (Bill #${billNumber})`,
        voucherType: "TDS_JOURNAL",
        voucherNumber: billNumber.toString(),
        entryType: "DEBIT",
        debitAmount: billTotals.tdsAmount,
        sourceEntityType: "tds_entries",
        sourceEntityId: bill.id,
        userId: input.userId,
        overridePreviousBalance: currentBalance,
      });
      currentBalance = Number(tx2.runningBalance);
    }

    // c. Debit Note (Debit)
    if (totalShortageDebit > 0) {
      const tx3 = await postLedgerEntry(tx, {
        firmId: input.firmId,
        partyId: effectivePartyId,
        transactionDate: input.billDate,
        particulars: `Shortage Debit Note RCM (DN-${billNumber})`,
        voucherType: "DEBIT_NOTE_RCM",
        voucherNumber: `DN-${billNumber}`,
        entryType: "DEBIT",
        debitAmount: totalShortageDebit,
        sourceEntityType: "debit_notes",
        sourceEntityId: bill.id,
        userId: input.userId,
        overridePreviousBalance: currentBalance,
      });
      currentBalance = Number(tx3.runningBalance);
    }

    // d. Driver Voucher Deduction (Debit) — CONFIRMED BUSINESS RULE
    if (driverVoucherTotal > 0) {
      await postLedgerEntry(tx, {
        firmId: input.firmId,
        partyId: effectivePartyId,
        transactionDate: input.billDate,
        particulars: `Driver Voucher Deduction (Bill #${billNumber})`,
        voucherType: "DRIVER_VOUCHER_DEDUCTION",
        voucherNumber: billNumber.toString(),
        entryType: "DEBIT",
        debitAmount: driverVoucherTotal,
        sourceEntityType: "bills",
        sourceEntityId: bill.id,
        userId: input.userId,
        overridePreviousBalance: currentBalance,
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
        dailyEntryId: trips.dailyEntryId,
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
      const freightBasis = tripRule?.freightBasis || "AUTO_SHORTAGE_BASED";

      const shortageRes = calculateShortage({
        nWeight: trip.nWeight ? Number(trip.nWeight) : 0,
        rWeight: trip.rWeight ? Number(trip.rWeight) : 0,
        shortageApplicable: tripRule?.shortageApplicable ?? false,
        allowanceType: tripRule?.shortageAllowanceType,
        allowanceValue: tripRule?.shortageAllowanceValue ? Number(tripRule.shortageAllowanceValue) : 0,
        shortageRuleType: tripRule?.shortageRuleType,
        materialRatePerTon: rateToUse,
      });

      const freightRes = calculateFreight({
        freightBasis,
        rate: rateToUse,
        nWeight: trip.nWeight ? Number(trip.nWeight) : 0,
        rWeight: trip.rWeight ? Number(trip.rWeight) : 0,
        fixedFreightAmount: rateToUse,
        applicableShortageDebit: shortageRes.shortageDebitAmount,
      });

      return {
        freight: freightRes.freightAmount,
        shortageDebitAmount: shortageRes.shortageDebitAmount,
        shortageQtyApplicable: shortageRes.applicableShortageQty,
        shortageMaterialRate: rateToUse,
        nWeight: trip.nWeight ? Number(trip.nWeight) : 0,
        rWeight: trip.rWeight ? Number(trip.rWeight) : 0,
      };
    });

    const subtotalFreight = preparedItems.reduce((sum, i) => sum + i.freight, 0);
    const totalShortageDebit = preparedItems.reduce((sum, i) => sum + i.shortageDebitAmount, 0);

    // Calculate Amount After Shortage = Gross Freight - Total Shortage Debit
    const amountAfterShortage = Math.max(0, subtotalFreight - totalShortageDebit);

    const tdsSection = input.appliedTdsSection || editBillPartyRule?.tdsSection || "94C";
    const tdsPercentage = input.appliedTdsPercentage ?? (editBillPartyRule?.tdsPercentage ? Number(editBillPartyRule.tdsPercentage) : 0);

    const tdsRes = calculateTds({
      grossBillAmount: amountAfterShortage,
      tdsApplicable: tdsPercentage > 0,
      tdsPercentage,
      tdsSection,
    });

    // 4B. Fetch Driver Voucher totals for all trips in this bill (per confirmed rule)
    const tripDailyEntryIds = tripRows.map((t) => t.dailyEntryId).filter(Boolean) as string[];
    const dvRows = tripDailyEntryIds.length > 0
      ? await tx
          .select({
            advance: driverVouchers.advance,
            cash: driverVouchers.cash,
            diesel: driverVouchers.diesel,
            ac: driverVouchers.ac,
          })
          .from(driverVouchers)
          .where(inArray(driverVouchers.dailyEntryId, tripDailyEntryIds))
      : [];
    const driverVoucherTotal = dvRows.reduce(
      (sum, dv) =>
        sum +
        Number(dv.advance || 0) +
        Number(dv.cash || 0) +
        Number(dv.diesel || 0) +
        Number(dv.ac || 0),
      0
    );

    const billTotals = calculateBillTotals({
      items: preparedItems,
      tdsAmount: tdsRes.tdsAmount,
      debitNoteAmount: totalShortageDebit,
      receivedAmount: existingReceivedAmount,
      driverVoucherTotal,
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
        driverVoucherTotal: billTotals.driverVoucherTotal.toString(),
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
    const editTx1 = await postLedgerEntry(tx, {
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
    let editCurrentBalance = Number(editTx1.runningBalance);

    // Post updated TDS Journal Debit if applicable
    if (billTotals.tdsAmount > 0) {
      const editTx2 = await postLedgerEntry(tx, {
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
        overridePreviousBalance: editCurrentBalance,
      });
      editCurrentBalance = Number(editTx2.runningBalance);
    }

    // Post updated Shortage Debit Note Debit if applicable
    if (totalShortageDebit > 0) {
      const editTx3 = await postLedgerEntry(tx, {
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
        overridePreviousBalance: editCurrentBalance,
      });
      editCurrentBalance = Number(editTx3.runningBalance);
    }

    // Post updated Driver Voucher Deduction Debit if applicable
    if (billTotals.driverVoucherTotal > 0) {
      await postLedgerEntry(tx, {
        firmId: input.firmId,
        partyId: String(currentBill.party_id),
        transactionDate: input.billDate,
        particulars: `Driver Voucher Deduction (Bill #${currentBill.bill_number} edited)`,
        voucherType: "DRIVER_VOUCHER_DEDUCTION",
        voucherNumber: String(currentBill.bill_number),
        entryType: "DEBIT",
        debitAmount: billTotals.driverVoucherTotal,
        sourceEntityType: "bills",
        sourceEntityId: input.billId,
        userId: input.userId,
        overridePreviousBalance: editCurrentBalance,
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
      dailyEntryId: trips.dailyEntryId,
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

  if (distinctPartyIds.length > 1) {
    throw new DomainValidationError("Selected trips belong to multiple billing parties. Please create separate bills.");
  }
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
    const freightBasis = tripRule?.freightBasis || "AUTO_SHORTAGE_BASED";

    const shortageRes = calculateShortage({
      nWeight: trip.nWeight ? Number(trip.nWeight) : 0,
      rWeight: trip.rWeight ? Number(trip.rWeight) : 0,
      shortageApplicable: tripRule?.shortageApplicable ?? false,
      allowanceType: tripRule?.shortageAllowanceType,
      allowanceValue: tripRule?.shortageAllowanceValue ? Number(tripRule.shortageAllowanceValue) : 0,
      shortageRuleType: tripRule?.shortageRuleType,
      materialRatePerTon: rateToUse,
    });

    const freightRes = calculateFreight({
      freightBasis,
      rate: rateToUse,
      nWeight: trip.nWeight ? Number(trip.nWeight) : 0,
      rWeight: trip.rWeight ? Number(trip.rWeight) : 0,
      fixedFreightAmount: rateToUse,
      applicableShortageDebit: shortageRes.shortageDebitAmount,
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
      shortageMaterialRate: rateToUse,
      shortageDebitAmount: shortageRes.shortageDebitAmount,
    };
  });

  const subtotalFreight = preparedItems.reduce((sum, item) => sum + item.freight, 0);
  const totalShortageDebit = preparedItems.reduce((sum, item) => sum + item.shortageDebitAmount, 0);

  // Calculate Amount After Shortage = Gross Freight - Total Shortage Debit
  const amountAfterShortage = Math.max(0, subtotalFreight - totalShortageDebit);

  const tdsSection = rawInput.appliedTdsSection || billPartyRule?.tdsSection || "94C";
  const tdsPercentage = rawInput.appliedTdsPercentage ?? (billPartyRule?.tdsPercentage ? Number(billPartyRule.tdsPercentage) : 0);

  const tdsRes = calculateTds({
    grossBillAmount: amountAfterShortage,
    tdsApplicable: tdsPercentage > 0,
    tdsPercentage,
    tdsSection,
  });

  // Fetch Driver Voucher totals for preview trips
  const tripDailyEntryIds = tripRows.map((t) => t.dailyEntryId).filter(Boolean) as string[];
  const dvRows = tripDailyEntryIds.length > 0
    ? await db
        .select({
          advance: driverVouchers.advance,
          cash: driverVouchers.cash,
          diesel: driverVouchers.diesel,
          ac: driverVouchers.ac,
        })
        .from(driverVouchers)
        .where(inArray(driverVouchers.dailyEntryId, tripDailyEntryIds))
    : [];
  const driverVoucherTotal = dvRows.reduce(
    (sum, dv) =>
      sum +
      Number(dv.advance || 0) +
      Number(dv.cash || 0) +
      Number(dv.diesel || 0) +
      Number(dv.ac || 0),
    0
  );

  const billTotals = calculateBillTotals({
    items: preparedItems,
    tdsAmount: tdsRes.tdsAmount,
    debitNoteAmount: totalShortageDebit,
    receivedAmount: 0,
    driverVoucherTotal,
  });

  return {
    items: preparedItems,
    subtotalFreight: billTotals.subtotalFreight,
    totalShortageDebit: billTotals.debitNoteAmount,
    tdsSection,
    tdsPercentage,
    tdsAmount: billTotals.tdsAmount,
    driverVoucherTotal: billTotals.driverVoucherTotal,
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
      driverVoucherTotal: bills.driverVoucherTotal,
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
      driverVoucherTotal: bills.driverVoucherTotal,
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

  let items = await db
    .select()
    .from(billItems)
    .where(eq(billItems.billId, billId));

  if (items.length === 0) {
    const linkedTrips = await db
      .select({
        tripId: trips.id,
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
        createdAt: trips.createdAt,
        updatedAt: trips.updatedAt,
      })
      .from(trips)
      .innerJoin(dailyEntries, eq(trips.dailyEntryId, dailyEntries.id))
      .where(eq(trips.billId, billId));

    // Fetch customer rule for the party to calculate per-trip shortage in fallback
    const partyRuleRes = bill.partyId
      ? await db
          .select()
          .from(customerRules)
          .where(and(eq(customerRules.firmId, firmId), eq(customerRules.partyId, bill.partyId)))
          .limit(1)
      : [];
    const partyRule = partyRuleRes.length > 0 ? partyRuleRes[0] : null;

    // Fetch debit note snapshot if present for reconciliation
    const dnsRes = await db
      .select()
      .from(debitNotes)
      .where(eq(debitNotes.billId, billId));
    const debitNote = dnsRes.length > 0 ? dnsRes[0] : null;

    const totalDnAllowance = debitNote?.totalShortageAllowance ? Number(debitNote.totalShortageAllowance) : 0;
    const dnMaterialRate = debitNote?.materialRateApplied ? Number(debitNote.materialRateApplied) : 0;
    const billDebitNoteAmount = Number(bill.debitNoteAmount || 0);

    const tripShortages = linkedTrips.map((t) => {
      const rateToUse = Number(t.customerRate || t.rate || 0);
      const nWt = t.nWeight ? Number(t.nWeight) : 0;
      const rWt = t.rWeight ? Number(t.rWeight) : 0;

      let allowanceVal = partyRule?.shortageAllowanceValue ? Number(partyRule.shortageAllowanceValue) : 0;
      let matRate = partyRule?.materialRatePerTon ? Number(partyRule.materialRatePerTon) : rateToUse;

      if (totalDnAllowance > 0 && linkedTrips.length > 0) {
        allowanceVal = totalDnAllowance / linkedTrips.length;
      }
      if (dnMaterialRate > 0) {
        matRate = dnMaterialRate;
      }

      const shortageRes = calculateShortage({
        nWeight: nWt,
        rWeight: rWt,
        shortageApplicable: partyRule?.shortageApplicable ?? (billDebitNoteAmount > 0),
        allowanceType: partyRule?.shortageAllowanceType || "FIXED_KG",
        allowanceValue: allowanceVal,
        shortageRuleType: partyRule?.shortageRuleType || "EXCESS_ONLY",
        materialRatePerTon: matRate,
      });

      return {
        trip: t,
        rateToUse,
        nWt,
        rWt,
        shortageRes,
        matRate,
        allowanceVal,
      };
    });

    let sumCalculatedShortage = tripShortages.reduce((sum, item) => sum + item.shortageRes.shortageDebitAmount, 0);

    // If sum of calculated shortages differs from stored bill.debitNoteAmount, attribute debit note proportionally to trips with raw shortage
    if (billDebitNoteAmount > 0 && Math.abs(sumCalculatedShortage - billDebitNoteAmount) > 0.01) {
      const rawShortages = tripShortages.map((t) => t.shortageRes.applicableShortageQty || Math.max(0, t.nWt - t.rWt));
      const totalRaw = rawShortages.reduce((sum, q) => sum + q, 0);

      if (totalRaw > 0) {
        tripShortages.forEach((t, idx) => {
          if (rawShortages[idx] > 0) {
            t.shortageRes.shortageDebitAmount = Math.round((rawShortages[idx] / totalRaw) * billDebitNoteAmount * 100) / 100;
          } else {
            t.shortageRes.shortageDebitAmount = 0;
          }
        });
      }
    }

    items = tripShortages.map(({ trip: t, rateToUse, nWt, rWt, shortageRes, matRate, allowanceVal }) => {
      let billedWeight = rWt || nWt;
      const subtotalFreightNum = Number(bill.subtotalFreight || 0);
      if (nWt > 0 && Math.abs(nWt * rateToUse - subtotalFreightNum) < 1) {
        billedWeight = nWt;
      }
      const calculatedFreight = rateToUse * billedWeight;

      return {
        id: t.tripId,
        billId: bill.id,
        tripId: t.tripId,
        srNo: t.srNo,
        tripDate: t.entryDate,
        entryDate: t.entryDate,
        truckNumberRaw: t.truckNumberRaw,
        lrNumber: t.lrNumber,
        fromLocationRaw: t.fromLocationRaw,
        toLocationRaw: t.toLocationRaw,
        nWeight: nWt.toFixed(3),
        rWeight: rWt.toFixed(3),
        appliedRate: rateToUse.toString(),
        rate: rateToUse.toString(),
        appliedFreightBasis: bill.appliedFreightBasis || "AUTO",
        billedWeight: billedWeight.toString(),
        freight: calculatedFreight.toString(),
        shortageQtyRaw: shortageRes.rawShortageQty.toString(),
        shortageAllowanceValue: allowanceVal.toString(),
        shortageAllowanceType: partyRule?.shortageAllowanceType || null,
        shortageRuleType: partyRule?.shortageRuleType || null,
        shortageQtyApplicable: shortageRes.applicableShortageQty.toString(),
        shortageMaterialRate: matRate.toString(),
        shortageDebitAmount: shortageRes.shortageDebitAmount.toString(),
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      } as any;
    });
  }

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

