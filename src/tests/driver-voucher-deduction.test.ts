import test from "node:test";
import assert from "node:assert/strict";
import { calculateBillTotals } from "../domain/bill";
import { getStandardEntryTypeForVoucher } from "../domain/ledger";
import { buildBillInvoiceHtml } from "../services/pdf.service";
import {
  createBill,
  editBill,
  previewBillCalculation,
  getBillById,
} from "../services/bill.service";
import { createDailyEntry } from "../services/daily-entry.service";
import { createPayment } from "../services/payment.service";
import { listLedgerTransactions } from "../services/ledger.service";
import { db } from "../db";
import {
  firms,
  parties,
  dailyEntries,
  driverVouchers,
  trips,
  bills,
  billItems,
  tdsEntries,
  debitNotes,
  payments,
  paymentAllocations,
  ledgerTransactions,
  customerRules,
  firmBillSequences,
} from "../db/schema";
import { eq, sql } from "drizzle-orm";

test("LOCKED BUSINESS RULE: Driver Voucher Deduction Comprehensive Verification", async (t) => {
  // Test isolation IDs (valid UUID v4 format)
  const firmId = "a0000000-0000-4000-8000-000000000001";
  const partyId = "b0000000-0000-4000-8000-000000000002";
  let testTripId = "";
  let testBillId = "";

  const cleanup = async () => {
    await db.delete(paymentAllocations);
    await db.delete(payments).where(eq(payments.firmId, firmId));
    await db.delete(ledgerTransactions).where(eq(ledgerTransactions.firmId, firmId));
    await db.delete(tdsEntries).where(eq(tdsEntries.firmId, firmId));
    await db.delete(debitNotes).where(eq(debitNotes.firmId, firmId));
    await db.delete(billItems);
    await db.delete(bills).where(eq(bills.firmId, firmId));
    await db.delete(trips).where(eq(trips.firmId, firmId));
    await db.delete(driverVouchers).where(eq(driverVouchers.firmId, firmId));
    await db.delete(dailyEntries).where(eq(dailyEntries.firmId, firmId));
    await db.delete(customerRules).where(eq(customerRules.firmId, firmId));
    await db.delete(parties).where(eq(parties.firmId, firmId));
    await db.delete(firmBillSequences).where(eq(firmBillSequences.firmId, firmId));
    await db.delete(firms).where(eq(firms.id, firmId));
  };

  // Setup test environment
  t.before(async () => {
    try {
      await db.execute(sql`ALTER TYPE "public"."freight_basis" ADD VALUE IF NOT EXISTS 'AUTO_SHORTAGE_BASED';`);
    } catch (_e) {}
    // Cleanup any pre-existing test data
    await cleanup();

    // Insert test firm
    await db.insert(firms).values({
      id: firmId,
      name: "TEST TRANSPORT CO",
      code: "TTC",
    });

    // Insert test party
    await db.insert(parties).values({
      id: partyId,
      firmId,
      name: "TEST CUSTOMER PVT LTD",
    });

    // Configure Customer Rule: 2% TDS, FIXED or R_WEIGHT freight basis
    await db.insert(customerRules).values({
      firmId,
      partyId,
      freightBasis: "FIXED",
      shortageApplicable: false,
      tdsPercentage: "2.00",
      tdsSection: "94C",
    });

    try {
      // Create Daily Entry with Driver Voucher amounts:
      // Advance = ₹500, Cash = ₹200, Diesel = ₹300, A/c = ₹0 -> Total = ₹1,000
      const entryRes = await createDailyEntry(db, {
        firmId,
        srNo: 9991,
        entryDate: "2026-10-01",
        truckNumberRaw: "MH12DV1000",
        lrNumber: "LR-DV-100",
        fromLocationRaw: "MUMBAI",
        toLocationRaw: "PUNE",
        nWeight: 20,
        rWeight: 20,
        rate: 100000,
        customerRate: 100000,
        advance: 500,
        cash: 200,
        diesel: 300,
        ac: 0,
        partyId,
        isReceived: true,
      });

      testTripId = entryRes.trip!.id;
    } catch (err: any) {
      console.error("SETUP ERROR IN T.BEFORE:", err);
      throw err;
    }
  });

  t.after(async () => {
    await cleanup();
  });

  // 1. Pure Domain Math Test (Client-Confirmed Example)
  await t.test("1. Domain Math: Confirmed Client Calculation Example", () => {
    // Gross Freight = ₹1,00,000, Shortage = ₹0, TDS @ 2% = ₹2,000, Driver Voucher = ₹1,000
    const totals = calculateBillTotals({
      items: [{ freight: 100000, shortageDebitAmount: 0 }],
      tdsAmount: 2000,
      debitNoteAmount: 0,
      driverVoucherTotal: 1000,
      receivedAmount: 0,
    });

    assert.equal(totals.subtotalFreight, 100000, "Gross freight must be 100,000");
    assert.equal(totals.totalShortageDebit, 0, "Shortage debit must be 0");
    assert.equal(totals.tdsAmount, 2000, "TDS must be 2,000");
    assert.equal(totals.driverVoucherTotal, 1000, "Driver voucher total must be 1,000");
    assert.equal(totals.netBillAmount, 97000, "Final Payable MUST be ₹97,000");
    assert.equal(totals.pendingAmount, 97000, "Pending amount MUST be ₹97,000");
  });

  // 2. Domain Ledger Voucher Type Mapping Test
  await t.test("2. Domain Ledger: DRIVER_VOUCHER_DEDUCTION maps to DEBIT", () => {
    assert.equal(
      getStandardEntryTypeForVoucher("DRIVER_VOUCHER_DEDUCTION"),
      "DEBIT",
      "DRIVER_VOUCHER_DEDUCTION must map to DEBIT in ledger"
    );
  });

  // 3. previewBillCalculation Service Test
  await t.test("3. previewBillCalculation: Calculates DV total and Net Payable correctly", async () => {
    const preview = await previewBillCalculation(db, {
      firmId,
      partyId,
      tripIds: [testTripId],
    });

    assert.equal(preview.subtotalFreight, 100000);
    assert.equal(preview.tdsAmount, 2000);
    assert.equal(preview.driverVoucherTotal, 1000, "Preview MUST include driverVoucherTotal = 1,000");
    assert.equal(preview.netBillAmount, 97000, "Preview Net Bill Amount MUST be ₹97,000");
  });

  // 4. createBill Service & Ledger Test
  await t.test("4. createBill: Snapshots DV total and posts DRIVER_VOUCHER_DEDUCTION to ledger", async () => {
    const bill = await createBill(db, {
      firmId,
      partyId,
      billDate: "2026-10-01",
      tripIds: [testTripId],
    });

    testBillId = bill.id;

    assert.equal(Number(bill.subtotalFreight), 100000);
    assert.equal(Number(bill.tdsAmount), 2000);
    assert.equal(Number(bill.driverVoucherTotal), 1000, "Bill driverVoucherTotal MUST be 1,000");
    assert.equal(Number(bill.netBillAmount), 97000, "Bill netBillAmount MUST be 97,000");
    assert.equal(Number(bill.pendingAmount), 97000, "Bill pendingAmount MUST be 97,000");

    // Verify Party Ledger postings
    const transactions = await listLedgerTransactions(db, firmId, partyId);

    // Should have 3 entries for this bill:
    // 1. TRANSPORTATION_CHARGES_RCM (CREDIT ₹1,00,000)
    // 2. TDS_JOURNAL (DEBIT ₹2,000)
    // 3. DRIVER_VOUCHER_DEDUCTION (DEBIT ₹1,000)
    const freightEntry = transactions.find(
      (t) => t.voucherType === "TRANSPORTATION_CHARGES_RCM"
    );
    const tdsEntry = transactions.find((t) => t.voucherType === "TDS_JOURNAL");
    const dvEntry = transactions.find(
      (t) => t.voucherType === "DRIVER_VOUCHER_DEDUCTION"
    );

    assert.ok(freightEntry, "Ledger MUST have TRANSPORTATION_CHARGES_RCM entry");
    assert.equal(Number(freightEntry!.creditAmount), 100000);

    assert.ok(tdsEntry, "Ledger MUST have TDS_JOURNAL entry");
    assert.equal(Number(tdsEntry!.debitAmount), 2000);

    assert.ok(dvEntry, "Ledger MUST have DRIVER_VOUCHER_DEDUCTION entry");
    assert.equal(Number(dvEntry!.debitAmount), 1000, "DV ledger debit MUST be 1,000");

    // Ledger running balance should be: 0 + 100000 (Cr) - 2000 (Dr) - 1000 (Dr) = 97000
    const closingBalance = Number(transactions[transactions.length - 1].runningBalance);
    assert.equal(closingBalance, 97000, "Ledger closing balance MUST be 97,000");
  });

  // 5. editBill Service & Ledger Reconciliation Test
  await t.test("5. editBill: Re-calculates DV total and preserves DRIVER_VOUCHER_DEDUCTION in ledger", async () => {
    const editedBill = await editBill(db, {
      firmId,
      billId: testBillId,
      billDate: "2026-10-02",
      tripIds: [testTripId],
    });

    assert.equal(Number(editedBill.driverVoucherTotal), 1000, "Edited bill driverVoucherTotal MUST be 1,000");
    assert.equal(Number(editedBill.netBillAmount), 97000, "Edited bill netBillAmount MUST be 97,000");

    // Check ledger reconciliation
    const transactions = await listLedgerTransactions(db, firmId, partyId);
    const dvEntry = transactions.find(
      (t) => t.voucherType === "DRIVER_VOUCHER_DEDUCTION"
    );
    assert.ok(dvEntry, "Edited bill MUST retain DRIVER_VOUCHER_DEDUCTION in ledger");
    assert.equal(Number(dvEntry!.debitAmount), 1000);

    const closingBalance = Number(transactions[transactions.length - 1].runningBalance);
    assert.equal(closingBalance, 97000);
  });

  // 6. PDF HTML Builder Test
  await t.test("6. PDF HTML: Account Summary includes Less Driver Voucher and trip table BALANCE is freight", async () => {
    const billDetail = await getBillById(db, testBillId, firmId);
    const html = buildBillInvoiceHtml(billDetail, { name: "TEST TRANSPORT CO" });

    // Verify 12-column trip table BALANCE column is 1,00,000.00 (Freight - Shortage)
    assert.ok(html.includes("1,00,000.00"), "HTML MUST contain 1,00,000.00 for trip balance");

    // Verify Account Summary table includes Less: Driver Voucher Total
    assert.ok(html.includes("Less: Driver Voucher Total"), "PDF HTML MUST include Less: Driver Voucher Total");
    assert.ok(html.includes("- 1,000.00"), "PDF HTML MUST render - 1,000.00 for DV deduction");
    assert.ok(html.includes("97,000.00"), "PDF HTML MUST render NET PAYABLE as 97,000.00");
  });

  // 7. Payment Allocation Test Against Net Payable
  await t.test("7. Payment Allocation: Operates safely against netBillAmount ₹97,000", async () => {
    // Attempting to allocate ₹98,000 against ₹97,000 bill MUST be rejected
    await assert.rejects(
      async () => {
        await createPayment(db, {
          firmId,
          partyId,
          paymentDate: "2026-10-02",
          paymentType: "AGAINST_BILL",
          paymentMode: "BANK_ACCOUNT",
          amount: 98000,
          billId: testBillId,
        });
      },
      (err: any) => err.message.includes("cannot exceed remaining bill amount"),
      "Over-allocation against ₹97,000 net payable MUST be blocked"
    );

    // Valid payment of ₹97,000 succeeds and fully settles bill
    const payment = await createPayment(db, {
      firmId,
      partyId,
      paymentDate: "2026-10-02",
      paymentType: "AGAINST_BILL",
      paymentMode: "BANK_ACCOUNT",
      amount: 97000,
      billId: testBillId,
    });

    assert.ok(payment.id);

    const updatedBill = await getBillById(db, testBillId, firmId);
    assert.equal(Number(updatedBill.receivedAmount), 97000);
    assert.equal(Number(updatedBill.pendingAmount), 0, "Bill is fully settled at ₹97,000");
  });

  // 8. AUTO_SHORTAGE_BASED Case A (No Applicable Shortage -> Billed Freight = N-Weight × Rate)
  await t.test("8. AUTO_SHORTAGE_BASED Case A: No applicable shortage -> N-Weight × Rate (Shiv Sai #9003 example)", async () => {
    const autoPartyId = "c0000000-0000-4000-8000-000000000003";

    await db.insert(parties).values({
      id: autoPartyId,
      firmId,
      name: "SHIV SAI TRADERS (AUTO FREIGHT)",
    });

    // Customer Rule: AUTO_SHORTAGE_BASED, 300 KG FIXED_KG allowance, EXCESS_ONLY, material rate ₹1,000/T, 2% TDS
    await db.insert(customerRules).values({
      firmId,
      partyId: autoPartyId,
      freightBasis: "AUTO_SHORTAGE_BASED",
      shortageApplicable: true,
      shortageAllowanceType: "FIXED_KG",
      shortageAllowanceValue: "300.00", // 300 KG = 0.3 T allowance
      shortageRuleType: "EXCESS_ONLY",
      materialRatePerTon: "1000.00",
      tdsApplicable: true,
      tdsPercentage: "2.00",
      tdsSection: "94C",
    });

    // Daily Entry: N = 25 T, R = 24.8 T (Physical loss = 0.2 T = 200 KG <= 300 KG allowance -> Applicable shortage = ₹0)
    // Rate = ₹4,000/T. Driver Voucher = ₹500 adv + ₹200 cash + ₹300 diesel = ₹1,000.
    const entryRes = await createDailyEntry(db, {
      firmId,
      srNo: 9003,
      entryDate: "2026-10-02",
      truckNumberRaw: "MH12SS9003",
      nWeight: 25.0,
      rWeight: 24.8,
      rate: 4000,
      customerRate: 4000,
      advance: 500,
      cash: 200,
      diesel: 300,
      ac: 0,
      partyId: autoPartyId,
      isReceived: true,
    });

    const tripId = entryRes.trip!.id;

    // Test preview calculation
    const preview = await previewBillCalculation(db, {
      firmId,
      partyId: autoPartyId,
      tripIds: [tripId],
    });

    assert.equal(preview.totalShortageDebit, 0, "Shortage debit must be 0 (200 KG <= 300 KG)");
    assert.equal(preview.subtotalFreight, 100000, "Gross Freight MUST = 25 T × ₹4,000 = ₹1,00,000 (using N-Weight)");
    assert.equal(preview.tdsAmount, 2000, "TDS @ 2% of ₹1,00,000 MUST = ₹2,000");
    assert.equal(preview.driverVoucherTotal, 1000, "Driver voucher total MUST = ₹1,000");
    assert.equal(preview.netBillAmount, 97000, "Final Payable MUST = ₹97,000");

    // Test bill creation
    const bill = await createBill(db, {
      firmId,
      partyId: autoPartyId,
      billDate: "2026-10-02",
      tripIds: [tripId],
    });

    assert.equal(Number(bill.subtotalFreight), 100000);
    assert.equal(Number(bill.debitNoteAmount), 0);
    assert.equal(Number(bill.tdsAmount), 2000);
    assert.equal(Number(bill.driverVoucherTotal), 1000);
    assert.equal(Number(bill.netBillAmount), 97000);

    // Verify trip balance remains Freight - Shortage = 100000 - 0 = 100000
    const fetchedBill = await getBillById(db, bill.id, firmId);
    const itemBalance = Number(fetchedBill.items[0].freight) - Number(fetchedBill.items[0].shortageDebitAmount);
    assert.equal(itemBalance, 100000, "Trip table BALANCE MUST equal ₹1,00,000 (Freight - Shortage)");
  });

  // 9. AUTO_SHORTAGE_BASED Case B (Applicable Shortage > 0 -> Billed Freight = R-Weight × Rate)
  await t.test("9. AUTO_SHORTAGE_BASED Case B: Applicable shortage > 0 -> R-Weight × Rate", async () => {
    const autoPartyId2 = "d0000000-0000-4000-8000-000000000004";

    await db.insert(parties).values({
      id: autoPartyId2,
      firmId,
      name: "AUTO FREIGHT CUSTOMER B",
    });

    await db.insert(customerRules).values({
      firmId,
      partyId: autoPartyId2,
      freightBasis: "AUTO_SHORTAGE_BASED",
      shortageApplicable: true,
      shortageAllowanceType: "FIXED_KG",
      shortageAllowanceValue: "300.00", // 300 KG allowance
      shortageRuleType: "EXCESS_ONLY",
      materialRatePerTon: "1000.00",
      tdsApplicable: true,
      tdsPercentage: "2.00",
      tdsSection: "94C",
    });

    // Daily Entry: N = 25 T, R = 24.5 T (Physical loss = 0.5 T = 500 KG > 300 KG allowance)
    // Excess shortage = 200 KG = 0.2 T. Material Rate = ₹1,000/T -> Shortage Debit = 0.2 × 1000 = ₹200 > 0.
    // Billed Freight MUST use R-Weight (24.5 T × ₹4,000 = ₹98,000).
    const entryRes = await createDailyEntry(db, {
      firmId,
      srNo: 9004,
      entryDate: "2026-10-02",
      truckNumberRaw: "MH12SS9004",
      nWeight: 25.0,
      rWeight: 24.5,
      rate: 4000,
      customerRate: 4000,
      advance: 500,
      cash: 200,
      diesel: 300,
      ac: 0,
      partyId: autoPartyId2,
      isReceived: true,
    });

    const tripId = entryRes.trip!.id;

    const preview = await previewBillCalculation(db, {
      firmId,
      partyId: autoPartyId2,
      tripIds: [tripId],
    });

    assert.equal(preview.totalShortageDebit, 200, "Applicable shortage debit MUST = ₹200");
    assert.equal(preview.subtotalFreight, 98000, "Gross Freight MUST = 24.5 T × ₹4,000 = ₹98,000 (using R-Weight)");
    assert.equal(preview.tdsAmount, 1956, "TDS @ 2% of ₹97,800 MUST = ₹1,956");
    assert.equal(preview.driverVoucherTotal, 1000, "Driver voucher total MUST = ₹1,000");
    assert.equal(preview.netBillAmount, 94844, "Final Payable MUST = 97800 - 1956 - 1000 = ₹94,844");

    const bill = await createBill(db, {
      firmId,
      partyId: autoPartyId2,
      billDate: "2026-10-02",
      tripIds: [tripId],
    });

    assert.equal(Number(bill.subtotalFreight), 98000);
    assert.equal(Number(bill.debitNoteAmount), 200);
    assert.equal(Number(bill.tdsAmount), 1956);
    assert.equal(Number(bill.driverVoucherTotal), 1000);
    assert.equal(Number(bill.netBillAmount), 94844);
  });

  // 10. Verify R_WEIGHT, N_WEIGHT, and FIXED Behavior Unchanged
  await t.test("10. Verification: Existing R_WEIGHT, N_WEIGHT, and FIXED behavior remains unchanged", async () => {
    const fixedPartyId = "e0000000-0000-4000-8000-000000000005";

    await db.insert(parties).values({
      id: fixedPartyId,
      firmId,
      name: "CONTROL PARTY VERIFICATION",
    });

    // Test R_WEIGHT
    await db.insert(customerRules).values({
      firmId,
      partyId: fixedPartyId,
      freightBasis: "R_WEIGHT",
      shortageApplicable: false,
    });

    const entryR = await createDailyEntry(db, {
      firmId,
      srNo: 9005,
      entryDate: "2026-10-02",
      truckNumberRaw: "MH12CTRL01",
      nWeight: 30.0,
      rWeight: 29.5,
      rate: 1000,
      partyId: fixedPartyId,
      isReceived: true,
    });

    const previewR = await previewBillCalculation(db, {
      firmId,
      partyId: fixedPartyId,
      tripIds: [entryR.trip!.id],
    });

    assert.equal(previewR.subtotalFreight, 29500, "R_WEIGHT MUST continue using R-Weight (29.5 * 1000 = 29,500)");

    // Test N_WEIGHT
    await db.update(customerRules)
      .set({ freightBasis: "N_WEIGHT" })
      .where(eq(customerRules.partyId, fixedPartyId));

    const previewN = await previewBillCalculation(db, {
      firmId,
      partyId: fixedPartyId,
      tripIds: [entryR.trip!.id],
    });

    assert.equal(previewN.subtotalFreight, 30000, "N_WEIGHT MUST continue using N-Weight (30.0 * 1000 = 30,000)");

    // Test FIXED
    await db.update(customerRules)
      .set({ freightBasis: "FIXED" })
      .where(eq(customerRules.partyId, fixedPartyId));

    const previewF = await previewBillCalculation(db, {
      firmId,
      partyId: fixedPartyId,
      tripIds: [entryR.trip!.id],
    });

    assert.equal(previewF.subtotalFreight, 1000, "FIXED MUST continue using fixed amount (1,000)");
  });
});
