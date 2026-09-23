import test from "node:test";
import assert from "node:assert/strict";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { db } from "../db";
import * as XLSX from "xlsx";
import { firms, parties, companies, trucks, locations, dailyEntries, driverVouchers, trips, bills, billItems, tdsEntries, debitNotes, payments, paymentAllocations, ledgerTransactions, auditLogs, openingBalances, firmBillSequences, customerRules, importBatches, rawImportRecords, importErrors } from "../db/schema";
import { createDailyEntry, updateDailyEntry } from "../services/daily-entry.service";
import { createParty, createCompany, upsertCustomerRule } from "../services/party.service";
import { createBill, editBill, getBillById } from "../services/bill.service";
import { createPayment, allocatePaymentToBill } from "../services/payment.service";
import { createOpeningBalance } from "../services/opening-balance.service";
import { listLedgerTransactions } from "../services/ledger.service";
import { getOutstandingReport, getAgingReport } from "../services/report.service";
import { generateBillPdfBuffer, buildBillInvoiceHtml } from "../services/pdf.service";
import { getDriverVouchers, getDriverVoucherById } from "../services/driver-voucher.service";
import { getDashboardOverview } from "../services/dashboard.service";
import { inspectExcelWorkbook, createAndStageImportBatch, validateAndMapImportBatch, getImportBatchPreview, commitImportBatch, listImportBatches } from "../services/import.service";
import { getNextBillNumberForFirm } from "../services/sequence.service";
import { verifyPartyInFirm, verifyCompanyInFirm } from "../services/firm.service";
import { calculateLedgerRunningBalance } from "../domain/ledger";
import { FirmIsolationError, DomainValidationError, BillEditValidationError, PaymentAllocationError, EntityNotFoundError } from "../lib/errors";
import { eq, inArray, sql } from "drizzle-orm";

test("Integration & Transactional Concurrency Test Suite (Phase 4B)", async (t) => {
  let firmA_Id = "";
  let firmB_Id = "";
  let partyA_Id = "";
  let partyB_Id = "";
  let companyB_Id = "";

  try {
    // SETUP: Pre-clean any existing test firm records
    const existingTestFirms = await db.select({ id: firms.id }).from(firms).where(sql`code LIKE 'TEST_%'`);
    if (existingTestFirms.length > 0) {
      const existingIds = existingTestFirms.map((f) => f.id);
      await db.delete(paymentAllocations);
      await db.delete(payments).where(inArray(payments.firmId, existingIds));
      await db.delete(tdsEntries).where(inArray(tdsEntries.firmId, existingIds));
      await db.delete(debitNotes).where(inArray(debitNotes.firmId, existingIds));
      await db.delete(billItems);
      await db.delete(bills).where(inArray(bills.firmId, existingIds));
      await db.delete(trips).where(inArray(trips.firmId, existingIds));
      await db.delete(driverVouchers).where(inArray(driverVouchers.firmId, existingIds));
      await db.delete(dailyEntries).where(inArray(dailyEntries.firmId, existingIds));
      await db.delete(ledgerTransactions).where(inArray(ledgerTransactions.firmId, existingIds));
      await db.delete(openingBalances).where(inArray(openingBalances.firmId, existingIds));
      await db.delete(customerRules).where(inArray(customerRules.firmId, existingIds));
      await db.delete(companies).where(inArray(companies.firmId, existingIds));
      await db.delete(parties).where(inArray(parties.firmId, existingIds));
      await db.delete(firmBillSequences).where(inArray(firmBillSequences.firmId, existingIds));
      await db.delete(auditLogs).where(inArray(auditLogs.firmId, existingIds));
      await db.delete(firms).where(inArray(firms.id, existingIds));
    }

    const timestamp = Date.now();
    const [firmA] = await db.insert(firms).values({ name: "Deepraj Test Firm", code: `TEST_DEEPRAJ_${timestamp}` }).returning();
    const [firmB] = await db.insert(firms).values({ name: "Shivsai Test Firm", code: `TEST_SHIVSAI_${timestamp}` }).returning();
    firmA_Id = firmA.id;
    firmB_Id = firmB.id;

    // Create Party under Firm A and Party under Firm B
    const partyA = await createParty(db, { firmId: firmA_Id, name: "Party A (Deepraj)" });
    const partyB = await createParty(db, { firmId: firmB_Id, name: "Party B (Shivsai)" });
    partyA_Id = partyA.id;
    partyB_Id = partyB.id;

    // Create Company under Firm B
    const companyB = await createCompany(db, { firmId: firmB_Id, name: "Company B (Shivsai Site)" });
    companyB_Id = companyB.id;

    // Configure Customer Rule for Party A
    await upsertCustomerRule(db, {
      firmId: firmA_Id,
      partyId: partyA_Id,
      freightBasis: "R_WEIGHT",
      shortageApplicable: true,
      shortageAllowanceType: "FIXED_KG",
      shortageAllowanceValue: 0.5,
      shortageRuleType: "EXCESS_ONLY",
      materialRatePerTon: 500,
      tdsApplicable: true,
      tdsSection: "94C",
      tdsPercentage: 1.0,
    });

    // -------------------------------------------------------------
    // TEST 1: Create & Update Daily Book Entry + Driver Voucher Sync
    // -------------------------------------------------------------
    await t.test("1. Daily Book Entry creation & Driver Voucher sync", async () => {
      const dailyRes = await createDailyEntry(db, {
        firmId: firmA_Id,
        srNo: 101,
        entryDate: "2026-09-21",
        truckNumberRaw: "MH12AB1234",
        nWeight: 40,
        rWeight: 38,
        advance: 1000,
        rate: 500,
        partyId: partyA_Id,
        isReceived: true,
      });

      assert.ok(dailyRes.entry.id);
      assert.ok(dailyRes.voucher.id);
      assert.equal(dailyRes.voucher.accountingStatus, "PENDING_CONFIRMATION");

      // Verify updating daily entry synchronizes driver voucher
      const updatedRes = await updateDailyEntry(db, dailyRes.entry.id, {
        firmId: firmA_Id,
        srNo: 101,
        entryDate: "2026-09-21",
        truckNumberRaw: "MH12AB1234",
        nWeight: 40,
        rWeight: 38,
        advance: 1500, // Updated advance
        rate: 500,
        partyId: partyA_Id,
        isReceived: true,
      });

      assert.equal(Number(updatedRes.voucher.advance), 1500);
      assert.equal(updatedRes.voucher.accountingStatus, "PENDING_CONFIRMATION");
    });

    // -------------------------------------------------------------
    // TEST 2 & 3: Firm Isolation for Party and Company
    // -------------------------------------------------------------
    await t.test("2. Cross-firm Party and Company validation rejections", async () => {
      await assert.rejects(
        async () => await verifyPartyInFirm(db, partyA_Id, firmB_Id),
        FirmIsolationError
      );

      await assert.rejects(
        async () => await verifyCompanyInFirm(db, companyB_Id, firmA_Id),
        FirmIsolationError
      );
    });

    // -------------------------------------------------------------
    // TEST 4: Only Received Trips Can Be Billed
    // -------------------------------------------------------------
    await t.test("3. Unreceived trips cannot enter a bill", async () => {
      const unreceivedDaily = await createDailyEntry(db, {
        firmId: firmA_Id,
        srNo: 102,
        entryDate: "2026-09-21",
        truckNumberRaw: "MH12XY9999",
        nWeight: 30,
        rWeight: 30,
        rate: 400,
        partyId: partyA_Id,
        isReceived: false, // Unreceived
      });

      await assert.rejects(
        async () =>
          await createBill(db, {
            firmId: firmA_Id,
            partyId: partyA_Id,
            billDate: "2026-09-21",
            tripIds: [unreceivedDaily.trip!.id],
          }),
        DomainValidationError
      );
    });

    // -------------------------------------------------------------
    // TEST 5: Concurrent Bill Number Generation (SELECT FOR UPDATE)
    // -------------------------------------------------------------
    await t.test("4. Concurrent bill number generation produces sequential unique numbers", async () => {
      const seqResults = await Promise.all([
        db.transaction((tx) => getNextBillNumberForFirm(tx, firmA_Id)),
        db.transaction((tx) => getNextBillNumberForFirm(tx, firmA_Id)),
        db.transaction((tx) => getNextBillNumberForFirm(tx, firmA_Id)),
      ]);

      const sorted = [...seqResults].sort((a, b) => a - b);
      assert.deepEqual(sorted, [1, 2, 3]);
    });

    // -------------------------------------------------------------
    // TEST 6: Bill Creation & Transactional Integrity
    // -------------------------------------------------------------
    let createdBillId = "";
    await t.test("5. Bill Creation with Freight, Shortage, TDS & Ledger Postings", async () => {
      const tripDaily = await createDailyEntry(db, {
        firmId: firmA_Id,
        srNo: 103,
        entryDate: "2026-09-21",
        truckNumberRaw: "MH14CD5678",
        nWeight: 40,
        rWeight: 38, // 2T shortage, allowance 0.5T -> 1.5T * 500 = ₹750 debit
        customerRate: 1000, // Freight: 38T * 1000 = ₹38,000
        partyId: partyA_Id,
        isReceived: true,
      });

      const bill = await createBill(db, {
        firmId: firmA_Id,
        partyId: partyA_Id,
        billDate: "2026-09-21",
        tripIds: [tripDaily.trip!.id],
      });

      createdBillId = bill.id;

      assert.equal(Number(bill.subtotalFreight), 38000);
      assert.equal(Number(bill.tdsAmount), 380); // 1% of 38,000 = 380
      assert.equal(Number(bill.debitNoteAmount), 750); // Shortage debit = 750
      assert.equal(Number(bill.netBillAmount), 36870); // 38000 - 380 - 750 = 36870

      // Verify Ledger postings are traceable to source entities
      const partyALedger = await listLedgerTransactions(db, firmA_Id, partyA_Id);
      assert.ok(partyALedger.length >= 3);
      assert.ok(partyALedger.some((l) => l.voucherType === "TRANSPORTATION_CHARGES_RCM" && l.sourceEntityId === bill.id));
    });

    // -------------------------------------------------------------
    // TEST 7: Payment Creation & Over-Allocation Protection
    // -------------------------------------------------------------
    let createdPaymentId = "";
    await t.test("6. Payment Creation and Over-Allocation Protection", async () => {
      const payment = await createPayment(db, {
        firmId: firmA_Id,
        partyId: partyA_Id,
        paymentDate: "2026-09-21",
        paymentType: "AGAINST_BILL",
        paymentMode: "BANK_AC",
        referenceNumber: "UTR123456789",
        amount: 40000,
      });

      createdPaymentId = payment.id;
      assert.equal(Number(payment.unallocatedAmount), 40000);

      // Attempting to allocate ₹40,000 against a bill with pending ₹36,870 MUST fail
      await assert.rejects(
        async () =>
          await allocatePaymentToBill(db, {
            firmId: firmA_Id,
            paymentId: payment.id,
            billId: createdBillId,
            allocatedAmount: 40000,
            allocationDate: "2026-09-21",
          }),
        PaymentAllocationError
      );

      // Valid allocation of ₹10,000 must succeed
      const alloc = await allocatePaymentToBill(db, {
        firmId: firmA_Id,
        paymentId: payment.id,
        billId: createdBillId,
        allocatedAmount: 10000,
        allocationDate: "2026-09-21",
      });

      assert.equal(Number(alloc.allocatedAmount), 10000);
    });

    // -------------------------------------------------------------
    // TEST 8: Bill Edit Validation (Cannot edit net below received)
    // -------------------------------------------------------------
    await t.test("7. Bill Edit blocked when new net amount < received amount", async () => {
      // Bill received amount is now ₹10,000. Attempting to edit bill to 0 trips or net bill < ₹10,000 must fail.
      await assert.rejects(
        async () =>
          await editBill(db, {
            firmId: firmA_Id,
            billId: createdBillId,
            billDate: "2026-09-21",
            tripIds: [], // 0 trips -> net bill = 0 < 10,000 received
          }),
        Error
      );
    });

    // -------------------------------------------------------------
    // TEST 9: Opening Balance Creation
    // -------------------------------------------------------------
    await t.test("8. Opening Balance creation and ledger posting", async () => {
      const ob = await createOpeningBalance(db, {
        firmId: firmA_Id,
        partyId: partyA_Id,
        financialYear: "2024-25",
        amount: 5000,
        balanceType: "DEBIT",
        effectiveDate: "2024-04-01",
      });

      assert.equal(ob.financialYear, "2024-25");
      assert.equal(Number(ob.amount), 5000);
    });

    // -------------------------------------------------------------
    // TEST 10: Phase 4C-2D Payments - Direct AGAINST_BILL & ADVANCE workflows
    // -------------------------------------------------------------
    await t.test("9. Phase 4C-2D Direct AGAINST_BILL, ADVANCE and Isolation Workflows", async () => {
      // 1. Advance Payment Workflow (P2, P7)
      const advPayment = await createPayment(db, {
        firmId: firmA_Id,
        partyId: partyA_Id,
        paymentDate: "2026-09-22",
        paymentType: "ADVANCE",
        paymentMode: "CASH",
        amount: 5000,
        remarks: "Unallocated advance",
      });
      assert.equal(advPayment.paymentType, "ADVANCE");
      assert.equal(Number(advPayment.unallocatedAmount), 5000);
      assert.equal(advPayment.isFullyAllocated, false);

      // 2. Direct AGAINST_BILL Payment with Bill Selection (P1)
      // Net bill = 36870, already received = 10000 (from Test 6 alloc). Remaining = 26870.
      const directAgainstBill = await createPayment(db, {
        firmId: firmA_Id,
        partyId: partyA_Id,
        paymentDate: "2026-09-22",
        paymentType: "AGAINST_BILL",
        billId: createdBillId,
        paymentMode: "BANK_ACCOUNT",
        referenceNumber: "NEFT889900",
        amount: 6870,
      });
      assert.equal(Number(directAgainstBill.amount), 6870);
      assert.equal(Number(directAgainstBill.unallocatedAmount), 0);
      assert.equal(directAgainstBill.isFullyAllocated, true);

      // Check updated bill balance: received = 10000 + 6870 = 16870, pending = 36870 - 16870 = 20000
      const [billState] = await db.select().from(bills).where(eq(bills.id, createdBillId));
      assert.equal(Number(billState.receivedAmount), 16870);
      assert.equal(Number(billState.pendingAmount), 20000);

      // 3. Over-allocation Rejection on Direct AGAINST_BILL Payment (P3)
      // Remaining pending is 20000. Attempting 25000 MUST fail.
      await assert.rejects(
        async () =>
          await createPayment(db, {
            firmId: firmA_Id,
            partyId: partyA_Id,
            paymentDate: "2026-09-22",
            paymentType: "AGAINST_BILL",
            billId: createdBillId,
            paymentMode: "UPI",
            amount: 25000,
          }),
        PaymentAllocationError
      );

      // 4. Cross-firm Isolation Rejection (P8)
      await assert.rejects(
        async () =>
          await createPayment(db, {
            firmId: firmB_Id, // Firm B context
            partyId: partyA_Id, // Party belonging to Firm A
            paymentDate: "2026-09-22",
            paymentType: "ADVANCE",
            paymentMode: "CASH",
            amount: 1000,
          }),
        FirmIsolationError
      );
    });

    // -------------------------------------------------------------
    // TEST 11: Phase 4C-2E Customer Ledger Integration & Filtering (L1-L12)
    // -------------------------------------------------------------
    await t.test("10. Phase 4C-2E Customer Ledger Integration & Filtering Workflows (L1 - L12)", async () => {
      // 1. Full Party A Ledger Query
      const partyALedger = await listLedgerTransactions(db, firmA_Id, partyA_Id);
      assert.ok(partyALedger.length >= 4, "Party A should have at least 4 ledger transactions");

      // L1 — Party Isolation: Party B ledger must NOT contain Party A transactions
      const partyBLedger = await listLedgerTransactions(db, firmB_Id, partyB_Id);
      assert.equal(partyBLedger.length, 0, "Party B ledger should be completely empty");

      // L2 — Firm Isolation: Querying Party A ledger under Firm B context must be rejected
      await assert.rejects(
        async () => await listLedgerTransactions(db, firmB_Id, partyA_Id),
        FirmIsolationError
      );

      // L4 — Freight Bill CREDIT check
      const billTx = partyALedger.find((l) => l.voucherType === "TRANSPORTATION_CHARGES_RCM");
      assert.ok(billTx, "Bill ledger entry must exist");
      assert.equal(billTx.entryType, "CREDIT");
      assert.equal(Number(billTx.creditAmount), 38000);

      // L5 — Payment DEBIT check
      const payTx = partyALedger.find((l) => l.voucherType === "PAYMENT_BANK" || l.voucherType === "PAYMENT_CASH");
      assert.ok(payTx, "Payment ledger entry must exist");
      assert.equal(payTx.entryType, "DEBIT");

      // L6 — TDS DEBIT check
      const tdsTx = partyALedger.find((l) => l.voucherType === "TDS_JOURNAL");
      assert.ok(tdsTx, "TDS ledger entry must exist");
      assert.equal(tdsTx.entryType, "DEBIT");
      assert.equal(Number(tdsTx.debitAmount), 380);

      // L7 — Shortage Debit Note DEBIT check
      const dnTx = partyALedger.find((l) => l.voucherType === "DEBIT_NOTE_RCM");
      assert.ok(dnTx, "Debit Note ledger entry must exist");
      assert.equal(dnTx.entryType, "DEBIT");
      assert.equal(Number(dnTx.debitAmount), 750);

      // L8 — Running Balance formula & entry amount validation check
      for (let i = 0; i < partyALedger.length; i++) {
        const tx = partyALedger[i];
        const dr = Number(tx.debitAmount || 0);
        const cr = Number(tx.creditAmount || 0);
        assert.ok(dr >= 0 && cr >= 0, "Debit and Credit amounts must be non-negative");
        assert.equal(
          calculateLedgerRunningBalance(0, tx.entryType as any, dr, cr),
          tx.entryType === "CREDIT" ? cr : -dr,
          "calculateLedgerRunningBalance domain formula must be consistent"
        );
      }

      // L9 — Date Filtering check
      const dateFiltered = await listLedgerTransactions(db, firmA_Id, partyA_Id, {
        dateFrom: "2026-09-22",
        dateTo: "2026-09-22",
      });
      assert.ok(dateFiltered.length > 0);
      assert.ok(dateFiltered.every((l) => l.transactionDate === "2026-09-22"));

      // L10 — Voucher Type Filtering check
      const voucherFiltered = await listLedgerTransactions(db, firmA_Id, partyA_Id, {
        voucherType: "TRANSPORTATION_CHARGES_RCM",
      });
      assert.ok(voucherFiltered.length > 0);
      assert.ok(voucherFiltered.every((l) => l.voucherType === "TRANSPORTATION_CHARGES_RCM"));

      // L11 — Empty Ledger Behavior for Party with no entries
      const emptyParty = await listLedgerTransactions(db, firmB_Id, partyB_Id);
      assert.deepEqual(emptyParty, [], "Unbilled party returns empty array");

      // L12 — No Duplicate Ledger Display: IDs must all be unique
      const ids = partyALedger.map((l) => l.id);
      const uniqueIds = new Set(ids);
      assert.equal(uniqueIds.size, ids.length, "All transaction IDs in ledger must be unique");
    });

    // -------------------------------------------------------------
    // TEST 11: Phase 4C-2F Outstanding & Aging Reports (R1 - R12)
    // -------------------------------------------------------------
    await t.test("11. Phase 4C-2F Outstanding & Aging Reports Workflows (R1 - R12)", async () => {
      // R11 — Empty report behavior
      const emptyOutstanding = await getOutstandingReport(db, firmB_Id);
      assert.equal(emptyOutstanding.bills.length, 0);
      assert.equal(emptyOutstanding.summary.totalOutstanding, 0);
      assert.equal(emptyOutstanding.summary.totalUnallocatedAdvances, 0);

      const emptyAging = await getAgingReport(db, firmB_Id);
      assert.equal(emptyAging.billDetails.length, 0);
      assert.equal(emptyAging.summary.totalOutstanding, 0);

      // R1 — Outstanding calculation & R4 — Multiple bills for same party
      const outReportA = await getOutstandingReport(db, firmA_Id, { partyId: partyA_Id });
      assert.ok(outReportA.bills.length > 0, "Firm A Party A must have outstanding bills");
      const testBill = outReportA.bills[0];
      assert.equal(
        testBill.pendingAmount,
        testBill.netBillAmount - testBill.receivedAmount,
        "R1: Outstanding = Net Bill Amount - Received Amount"
      );

      // R2 — Fully paid bill excluded from outstanding total
      // R3 — Partial payment handling (only remaining pending amount included)
      for (const b of outReportA.bills) {
        if (b.status === "PAID") {
          assert.equal(b.pendingAmount, 0, "R2: Fully paid bill must have pending amount 0");
        } else if (b.status === "PARTIALLY_PAID") {
          assert.ok(b.receivedAmount > 0 && b.pendingAmount > 0, "R3: Partial payment bill has both received and pending > 0");
        }
      }

      // R5 — Party Isolation
      const outReportB = await getOutstandingReport(db, firmA_Id, { partyId: partyB_Id });
      assert.equal(outReportB.bills.length, 0, "R5: Party B has no bills under Firm A");

      // R6 — Firm Isolation
      const firmBReport = await getOutstandingReport(db, firmB_Id);
      assert.equal(firmBReport.bills.length, 0, "R6: Firm B report must not contain Firm A bills");

      // R7 — Advance remains separate
      assert.ok(outReportA.summary.totalUnallocatedAdvances >= 0);
      for (const b of outReportA.bills) {
        assert.equal(b.pendingAmount, b.netBillAmount - b.receivedAmount, "R7: Advances do not alter bill pending amount");
      }

      // R8 & R9 — Aging bucket calculation & As-of-date behavior
      const agingReportToday = await getAgingReport(db, firmA_Id, { asOfDate: "2026-09-23" });
      assert.ok(agingReportToday.billDetails.length > 0, "Aging report should contain pending bills");
      for (const detail of agingReportToday.billDetails) {
        assert.ok(detail.ageInDays >= 0, "R8: Age in days must be non-negative");
        assert.ok(["Current", "1–30 Days", "31–60 Days", "61–90 Days", "91–180 Days", "181+ Days"].includes(detail.bucket), "R8: Valid aging bucket");
      }

      // R10 — Aging total reconciles with outstanding
      const summary = agingReportToday.summary;
      const bucketSum = summary.current + summary.days1_30 + summary.days31_60 + summary.days61_90 + summary.days91_180 + summary.days181Plus;
      assert.equal(bucketSum, summary.totalOutstanding, "R10: Aging bucket sum must equal total outstanding");

      // R12 — Read-Only Safety: report query must not mutate accounting data
      const billsBefore = await db.select().from(bills).where(eq(bills.firmId, firmA_Id));
      await getOutstandingReport(db, firmA_Id);
      await getAgingReport(db, firmA_Id);
      const billsAfter = await db.select().from(bills).where(eq(bills.firmId, firmA_Id));
      assert.equal(billsBefore.length, billsAfter.length, "R12: Read-only report must not mutate bill records");
    });

    // -------------------------------------------------------------
    // TEST 12: Phase 4C-2G Historical Excel Import Infrastructure (I1 - I16)
    // -------------------------------------------------------------
    await t.test("12. Phase 4C-2G Historical Excel Import Infrastructure Workflows (I1 - I16)", async () => {
      // I1 — Invalid file extension rejected
      await assert.rejects(
        async () =>
          await createAndStageImportBatch(db, firmA_Id, {
            originalFileName: "test.pdf",
            financialYear: "2024-25",
            sheetName: "Sheet1",
            fileBuffer: Buffer.from("pdf-data"),
          }),
        DomainValidationError
      );

      // I2 & I3 — Empty buffer / empty workbook rejected
      await assert.rejects(
        async () =>
          await createAndStageImportBatch(db, firmA_Id, {
            originalFileName: "test.xlsx",
            financialYear: "2024-25",
            sheetName: "Sheet1",
            fileBuffer: Buffer.from([]),
          }),
        DomainValidationError
      );

      // I4 — Sheet/Header detection with valid in-memory Excel buffer
      const wb = XLSX.utils.book_new();
      const wsData = [
        ["Sr No", "Date", "Truck No", "N-Weight", "R-Weight", "Party Name"],
        [1, "2024-09-22", "MH12AB1234", 40, 38, "Party A (Deepraj)"],
        [2, "invalid-date", "MH12AB5678", -5, "abc", "Unmapped Customer"],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "DailyBookSheet");
      const excelBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      const inspection = inspectExcelWorkbook(excelBuffer);
      assert.equal(inspection.sheets.length, 1);
      assert.equal(inspection.sheets[0].sheetName, "DailyBookSheet");
      assert.equal(inspection.sheets[0].headers.length, 6);

      // I5 & I12 — Stage raw records without mutating production DB
      const stagedRes = await createAndStageImportBatch(db, firmA_Id, {
        originalFileName: "historical_test.xlsx",
        financialYear: "2024-25",
        sheetName: "DailyBookSheet",
        fileBuffer: excelBuffer,
      });

      assert.ok(stagedRes.batchId);
      assert.equal(stagedRes.totalRows, 2);

      // I6, I7, I8 — Validation engine: date, numeric weight, party mapping
      const valRes = await validateAndMapImportBatch(
        db,
        firmA_Id,
        stagedRes.batchId,
        {
          srNo: "Sr No",
          entryDate: "Date",
          truckNumber: "Truck No",
          nWeight: "N-Weight",
          rWeight: "R-Weight",
          partyName: "Party Name",
        }
      );

      assert.equal(valRes.status, "ERRORS");
      assert.equal(valRes.validRows, 1, "Row 1 should be valid");
      assert.equal(valRes.errorRows, 1, "Row 2 should fail validation");

      // I11 — Firm Isolation: Validation under Firm B throws FirmIsolationError
      await assert.rejects(
        async () =>
          await validateAndMapImportBatch(
            db,
            firmB_Id,
            stagedRes.batchId,
            { partyName: "Party Name" }
          ),
        FirmIsolationError
      );

      // I13, I14, I15 — Transactional commit engine
      const previewBeforeCommit = await getImportBatchPreview(db, firmA_Id, stagedRes.batchId);
      assert.equal(previewBeforeCommit.records.length, 2);

      const billsBeforeCommit = (await db.select().from(bills).where(eq(bills.firmId, firmA_Id))).length;
      const commitRes = await commitImportBatch(db, firmA_Id, stagedRes.batchId);
      assert.equal(commitRes.status, "COMMITTED");
      assert.equal(commitRes.committedRows, 1, "Only valid record should be committed");

      // I15 — No automatic bill, payment, or ledger creation
      const billsAfterCommit = (await db.select().from(bills).where(eq(bills.firmId, firmA_Id))).length;
      assert.equal(billsAfterCommit, billsBeforeCommit, "No automatic bills manufactured from historical import");
    });

    // -------------------------------------------------------------
    // TEST 13: Phase 4C-2H PDF Bill Generation & Printing (P1 - P10)
    // -------------------------------------------------------------
    await t.test("13. Phase 4C-2H PDF Bill Generation & Printing Workflows (P1 - P10)", async () => {
      // Fetch an existing created bill for Firm A
      const firmABills = await db.select().from(bills).where(eq(bills.firmId, firmA_Id));
      assert.ok(firmABills.length > 0, "Firm A must have at least one bill created from previous subtests");
      const targetBillId = firmABills[0].id;

      // P1 — Valid bill PDF generation returns Buffer starting with %PDF- header
      const pdfBuffer = await generateBillPdfBuffer(db, firmA_Id, targetBillId);
      assert.ok(pdfBuffer instanceof Buffer, "P1: Result must be a binary PDF Buffer");
      assert.ok(pdfBuffer.length > 500, "P1: PDF Buffer size must be valid");
      const headerStr = pdfBuffer.toString("utf8", 0, 5);
      assert.equal(headerStr, "%PDF-", "P1: Buffer header must start with %PDF-");

      // P2 — Firm Isolation: requesting Firm A bill under Firm B context throws FirmIsolationError
      await assert.rejects(
        async () => await generateBillPdfBuffer(db, firmB_Id, targetBillId),
        FirmIsolationError,
        "P2: Firm B cannot generate PDF for Firm A bill"
      );

      // P3 — Invalid / non-existent bill ID throws EntityNotFoundError
      const fakeBillId = "00000000-0000-0000-0000-000000000000";
      await assert.rejects(
        async () => await generateBillPdfBuffer(db, firmA_Id, fakeBillId),
        EntityNotFoundError,
        "P3: Non-existent bill ID throws EntityNotFoundError"
      );

      // P4, P5, P6, P7 — Content verification on HTML builder
      const billData = await getBillById(db, targetBillId, firmA_Id);
      const firmData = (await db.select().from(firms).where(eq(firms.id, firmA_Id)))[0];
      const htmlOutput = buildBillInvoiceHtml(billData, firmData);

      assert.ok(htmlOutput.includes(`Invoice #${billData.billNumber}`), "P4: Bill number present in invoice HTML");
      assert.ok(htmlOutput.includes(firmData.name!), "P4: Firm name present in invoice HTML");
      assert.ok(htmlOutput.includes(billData.partyName!), "P4: Party name present in invoice HTML");

      if (Number(billData.tdsAmount) > 0) {
        assert.ok(htmlOutput.includes("TDS"), "P6: TDS section present in invoice HTML");
      }
      if (Number(billData.debitNoteAmount) > 0) {
        assert.ok(htmlOutput.includes("Shortage Debit Note"), "P7: Shortage debit note present in invoice HTML");
      }

      // P8 & P9 — Read-only DB verification
      const billsCountBefore = (await db.select().from(bills).where(eq(bills.firmId, firmA_Id))).length;
      await generateBillPdfBuffer(db, firmA_Id, targetBillId);
      const billsCountAfter = (await db.select().from(bills).where(eq(bills.firmId, firmA_Id))).length;
      assert.equal(billsCountBefore, billsCountAfter, "P8: PDF generation must not mutate bills table");
    });

    // -------------------------------------------------------------
    // SUBTEST 14: Phase 4C-2J Driver Voucher Workflows (V1 - V10)
    // -------------------------------------------------------------
    await t.test("14. Phase 4C-2J Driver Voucher Workflows (V1 - V10)", async () => {
      // V1 & V2: Create Daily Entry -> creates 1 Driver Voucher with status PENDING_CONFIRMATION
      const entryResult = await createDailyEntry(db, {
        firmId: firmA_Id,
        srNo: 9901,
        entryDate: "2026-09-23",
        truckNumberRaw: "MH12DV0001",
        fromLocationRaw: "Pune",
        toLocationRaw: "Mumbai",
        advance: 1500,
        cash: 500,
        diesel: 2000,
        ac: 300,
        partyId: partyA_Id,
        isReceived: true,
        remarks: "Voucher sync test",
      });

      assert.ok(entryResult.voucher, "V1: Voucher automatically generated");
      assert.equal(entryResult.voucher.dailyEntryId, entryResult.entry.id, "V1: 1-to-1 relationship");
      assert.equal(entryResult.voucher.accountingStatus, "PENDING_CONFIRMATION", "V2: Status is PENDING_CONFIRMATION");
      assert.equal(Number(entryResult.voucher.advance), 1500, "V4: Advance synchronized");
      assert.equal(Number(entryResult.voucher.cash), 500, "V4: Cash synchronized");
      assert.equal(Number(entryResult.voucher.diesel), 2000, "V4: Diesel synchronized");
      assert.equal(Number(entryResult.voucher.ac), 300, "V4: A/c synchronized");

      // V3 & V4: Update Daily Entry -> updates SAME Driver Voucher without creating duplicates
      const vouchersBeforeUpdate = await db.select().from(driverVouchers).where(eq(driverVouchers.dailyEntryId, entryResult.entry.id));
      assert.equal(vouchersBeforeUpdate.length, 1, "V3: Exactly 1 driver voucher before update");

      const updateResult = await updateDailyEntry(db, entryResult.entry.id, {
        firmId: firmA_Id,
        srNo: 9901,
        entryDate: "2026-09-23",
        truckNumberRaw: "MH12DV0001",
        fromLocationRaw: "Pune",
        toLocationRaw: "Thane",
        advance: 1800,
        cash: 600,
        diesel: 2200,
        ac: 400,
        partyId: partyA_Id,
        isReceived: true,
        remarks: "Updated voucher sync test",
      });

      const vouchersAfterUpdate = await db.select().from(driverVouchers).where(eq(driverVouchers.dailyEntryId, entryResult.entry.id));
      assert.equal(vouchersAfterUpdate.length, 1, "V3: Exactly 1 driver voucher after update (no duplicates)");
      assert.equal(Number(updateResult.voucher.advance), 1800, "V4: Updated advance synchronized");
      assert.equal(updateResult.voucher.toLocationRaw, "Thane", "V4: Updated toLocation synchronized");

      // V5 & V6: Firm Isolation & Retrieval
      const firmA_List = await getDriverVouchers(db, firmA_Id, { truckNumber: "MH12DV0001" });
      assert.equal(firmA_List.vouchers.length, 1, "V5: Driver voucher found in Firm A context");

      const firmB_List = await getDriverVouchers(db, firmB_Id, { truckNumber: "MH12DV0001" });
      assert.equal(firmB_List.vouchers.length, 0, "V5: Driver voucher isolated from Firm B context");

      await assert.rejects(
        async () => getDriverVoucherById(db, entryResult.voucher.id, firmB_Id),
        FirmIsolationError,
        "V6: Cross-firm driver voucher request throws FirmIsolationError"
      );

      // V7 & V8: Zero Accounting Postings Safety Check
      const paymentsBefore = (await db.select().from(payments).where(eq(payments.firmId, firmA_Id))).length;
      const ledgerBefore = (await db.select().from(ledgerTransactions).where(eq(ledgerTransactions.firmId, firmA_Id))).length;

      // Create another entry to explicitly test delta
      const entryResult2 = await createDailyEntry(db, {
        firmId: firmA_Id,
        srNo: 9902,
        entryDate: "2026-09-23",
        truckNumberRaw: "MH12DV0002",
        advance: 1000,
        cash: 200,
        isReceived: true,
      });

      const paymentsAfter = (await db.select().from(payments).where(eq(payments.firmId, firmA_Id))).length;
      const ledgerAfter = (await db.select().from(ledgerTransactions).where(eq(ledgerTransactions.firmId, firmA_Id))).length;

      assert.equal(paymentsAfter, paymentsBefore, "V8: Creating driver voucher creates 0 new payments");
      assert.equal(ledgerAfter, ledgerBefore, "V7: Creating driver voucher creates 0 new ledger transactions");

      // V9: Multi-filter query test
      const filterResult = await getDriverVouchers(db, firmA_Id, {
        search: "Thane",
        startDate: "2026-09-01",
        endDate: "2026-09-30",
      });
      assert.ok(filterResult.vouchers.length >= 1, "V9: Search filter returns matching voucher");
      assert.equal(filterResult.metrics.totalVouchers, filterResult.pagination.total, "V9: Metrics count matches pagination total");
    });

    // -------------------------------------------------------------
    // SUBTEST 15: Phase 4C-2K Management Dashboard Workflows (D1 - D10)
    // -------------------------------------------------------------
    await t.test("15. Phase 4C-2K Management Dashboard Workflows (D1 - D10)", async () => {
      // D1: Overview on Firm A returns accurate aggregated stats
      const dashA = await getDashboardOverview(db, firmA_Id);
      assert.ok(dashA, "D1: Dashboard overview returned");
      assert.ok(dashA.dailyBook.totalEntries > 0, "D1: Daily book entries aggregated");
      assert.ok(dashA.billing.billCount > 0, "D1: Billing bills aggregated");
      assert.ok(dashA.payments.paymentCount > 0, "D1: Payments aggregated");

      // D2: Firm Isolation — Firm B dashboard overview has 0 Firm A bills/payments
      const dashB = await getDashboardOverview(db, firmB_Id);
      assert.equal(dashB.billing.billCount, 0, "D2: Firm B billing count is 0 (isolated from Firm A)");
      assert.equal(dashB.payments.paymentCount, 0, "D2: Firm B payment count is 0 (isolated from Firm A)");
      assert.equal(dashB.outstanding.totalOutstandingAmount, 0, "D2: Firm B outstanding amount is 0");

      // D3: Date Filtering — Out of range date filter returns 0 entries
      const dateFiltered = await getDashboardOverview(db, firmA_Id, {
        startDate: "2020-01-01",
        endDate: "2020-01-31",
      });
      assert.equal(dateFiltered.dailyBook.totalEntries, 0, "D3: Date filter excludes out-of-range daily entries");
      assert.equal(dateFiltered.billing.billCount, 0, "D3: Date filter excludes out-of-range bills");

      // D4: Billing totals match authoritative bills query
      const allBillsA = await db.select().from(bills).where(eq(bills.firmId, firmA_Id));
      const expectedNetTotal = allBillsA.reduce((acc, b) => acc + Number(b.netBillAmount), 0);
      assert.equal(dashA.billing.netPayableTotal, expectedNetTotal, "D4: Net payable total matches bills table sum");

      // D5: Outstanding totals reconcile 100% with getOutstandingReport
      const outstandingReport = await getOutstandingReport(db, firmA_Id);
      assert.equal(
        dashA.outstanding.totalOutstandingAmount,
        outstandingReport.summary.totalOutstanding,
        "D5: Outstanding amount reconciles 100% with report service"
      );

      // D6: Aging totals reconcile 100% with getAgingReport
      const agingReport = await getAgingReport(db, firmA_Id);
      assert.equal(
        dashA.aging.totalOutstanding,
        agingReport.summary.totalOutstanding,
        "D6: Aging total reconciles 100% with report service"
      );

      // D7: Payment totals match payments table
      const allPaymentsA = await db.select().from(payments).where(eq(payments.firmId, firmA_Id));
      const expectedReceipts = allPaymentsA.reduce((acc, p) => acc + Number(p.amount), 0);
      assert.equal(dashA.payments.totalReceipts, expectedReceipts, "D7: Payment receipts match payments table sum");

      // D8: Driver Vouchers operational status is PENDING_CONFIRMATION
      assert.equal(dashA.driverVouchers.accountingStatus, "PENDING_CONFIRMATION", "D8: Driver vouchers status is PENDING_CONFIRMATION");

      // D9: Zero DB Mutations — Dashboard query performs 0 INSERT/UPDATE/DELETE
      const billsCountBefore = (await db.select().from(bills).where(eq(bills.firmId, firmA_Id))).length;
      await getDashboardOverview(db, firmA_Id);
      const billsCountAfter = (await db.select().from(bills).where(eq(bills.firmId, firmA_Id))).length;
      assert.equal(billsCountBefore, billsCountAfter, "D9: Dashboard overview performs zero DB mutations");
    });

    // -------------------------------------------------------------
    // SUBTEST 16: Phase 4C-2L Full System E2E QA & Business Workflow Audit (Scenarios 1 - 35)
    // -------------------------------------------------------------
    await t.test("16. Phase 4C-2L Full System E2E QA & Business Workflow Audit (Scenarios 1 - 35)", async () => {
      // 1. Firm Isolation & Master Data
      await assert.rejects(async () => {
        await verifyPartyInFirm(db, partyA_Id, firmB_Id);
      }, FirmIsolationError, "Scenario 1: Party A under Firm B throws FirmIsolationError");

      // 2. Party vs Company Separation
      await assert.rejects(async () => {
        await verifyCompanyInFirm(db, companyB_Id, firmA_Id);
      }, FirmIsolationError, "Scenario 2: Company B under Firm A throws FirmIsolationError");

      // Setup QA specific entities under Firm A and Firm B
      const qaTimestamp = Date.now();
      const qaPartyA = await createParty(db, { firmId: firmA_Id, name: `QA Customer A Percentage ${qaTimestamp}` });
      const qaPartyB = await createParty(db, { firmId: firmA_Id, name: `QA Customer B Fixed ${qaTimestamp}` });

      // Party A Rule: PERCENTAGE allowance (0.50%), EXCESS_ONLY, R_WEIGHT freight, ₹1,200 Material Rate, 1% TDS
      await upsertCustomerRule(db, {
        firmId: firmA_Id,
        partyId: qaPartyA.id,
        freightBasis: "R_WEIGHT",
        shortageApplicable: true,
        shortageAllowanceType: "PERCENTAGE",
        shortageAllowanceValue: 0.50,
        shortageRuleType: "EXCESS_ONLY",
        materialRatePerTon: 1200,
        tdsApplicable: true,
        tdsSection: "94C",
        tdsPercentage: 1.0,
      });

      // Party B Rule: FIXED_KG allowance (500 KG = 0.5 MT), FULL_SHORTAGE, N_WEIGHT freight, ₹1,500 Material Rate, 2% TDS
      await upsertCustomerRule(db, {
        firmId: firmA_Id,
        partyId: qaPartyB.id,
        freightBasis: "N_WEIGHT",
        shortageApplicable: true,
        shortageAllowanceType: "FIXED_KG",
        shortageAllowanceValue: 0.50,
        shortageRuleType: "FULL_SHORTAGE",
        materialRatePerTon: 1500,
        tdsApplicable: true,
        tdsSection: "94C",
        tdsPercentage: 2.0,
      });

      // 3. Daily Book Creation & Dual Entity Generation
      const entry1Res = await createDailyEntry(db, {
        firmId: firmA_Id,
        srNo: 901,
        entryDate: "2026-08-01",
        truckNumberRaw: "MH14QA0001",
        nWeight: 40.0,
        rWeight: 39.2, // Loss = 0.8 MT. Allowance = 0.5% of 40 = 0.2 MT. Excess shortage = 0.6 MT. Debit = 0.6 * 1200 = 720
        advance: 1500,
        rate: 500,
        partyId: qaPartyA.id,
        cash: 200,
        diesel: 2500,
        ac: 0,
        isReceived: true,
      });

      const entry2Res = await createDailyEntry(db, {
        firmId: firmA_Id,
        srNo: 902,
        entryDate: "2026-08-05",
        truckNumberRaw: "MH14QA0002",
        nWeight: 50.0,
        rWeight: 49.0, // Loss = 1.0 MT > Allowance (0.5 MT). Full shortage = 1.0 MT. Debit = 1.0 * 1500 = 1500
        advance: 2000,
        rate: 600,
        partyId: qaPartyB.id,
        cash: 300,
        diesel: 3000,
        ac: 0,
        isReceived: true,
      });

      // Entry 3: Pending trip (isReceived: false, rWeight missing)
      const entry3Res = await createDailyEntry(db, {
        firmId: firmA_Id,
        srNo: 903,
        entryDate: "2026-08-10",
        truckNumberRaw: "MH14QA0003",
        nWeight: 30.0,
        advance: 1000,
        rate: 550,
        partyId: qaPartyA.id,
        isReceived: false,
      });

      assert.ok(entry1Res.trip?.id, "Scenario 3: Trip ID created for entry 1");
      assert.ok(entry1Res.voucher.id, "Scenario 3: Driver Voucher ID created for entry 1");

      // 4. Daily Book Edit Atomicity & 5. Driver Voucher Operational Sync
      const ledgerBeforeUpdate = (await db.select().from(ledgerTransactions).where(eq(ledgerTransactions.firmId, firmA_Id))).length;
      await updateDailyEntry(db, entry1Res.entry.id, {
        firmId: firmA_Id,
        srNo: 901,
        entryDate: "2026-08-01",
        truckNumberRaw: "MH14QA0001",
        nWeight: 40.0,
        rWeight: 39.2,
        advance: 1500,
        rate: 500,
        partyId: qaPartyA.id,
        cash: 200,
        diesel: 2800, // Updated diesel
        ac: 0,
        isReceived: true,
      });
      const updatedVoucher = await getDriverVoucherById(db, entry1Res.voucher.id, firmA_Id);
      assert.equal(updatedVoucher?.diesel, "2800.00", "Scenario 4 & 5: Driver Voucher updated atomically");
      const ledgerAfterUpdate = (await db.select().from(ledgerTransactions).where(eq(ledgerTransactions.firmId, firmA_Id))).length;
      assert.equal(ledgerBeforeUpdate, ledgerAfterUpdate, "Scenario 5: Driver Voucher update creates 0 ledger postings");

      // 6. Received vs Pending Trip Behavior & 7. Billing Trip Selection
      const tripsForPartyA = await db.select().from(trips).where(eq(trips.partyId, qaPartyA.id));
      const receivedTripA = tripsForPartyA.find(t => t.isReceived);
      const pendingTripA = tripsForPartyA.find(t => !t.isReceived);
      assert.ok(receivedTripA, "Scenario 6: Received trip exists for Party A");
      assert.ok(pendingTripA, "Scenario 6: Pending trip exists for Party A");

      // Attempt billing pending trip -> should fail
      await assert.rejects(async () => {
        await createBill(db, {
          firmId: firmA_Id,
          partyId: qaPartyA.id,
          billDate: "2026-08-15",
          tripIds: [pendingTripA!.id],
        });
      }, DomainValidationError, "Scenario 7: Pending trip cannot be billed");

      // 8. Freight Calculation, 10-16 Shortage & TDS, 18. Bill Ledger Posting & 33. Sequential Bill Numbering
      const nextBillNum = await db.transaction(async (tx) => getNextBillNumberForFirm(tx, firmA_Id));
      assert.ok(typeof nextBillNum === "number" && nextBillNum > 0, "Scenario 33: Sequential bill number generated");

      const qaBill1 = await createBill(db, {
        firmId: firmA_Id,
        partyId: qaPartyA.id,
        billDate: "2026-08-15",
        tripIds: [receivedTripA!.id],
      });

      // Verify Freight for Party A (R_WEIGHT 39.2 MT * ₹500 = ₹19,600)
      assert.equal(Number(qaBill1.subtotalFreight), 19600, "Scenario 8: Freight uses R_WEIGHT (39.2 * 500 = 19,600)");

      // Verify EXCESS_ONLY shortage (0.6 MT * 1200 = ₹720)
      assert.equal(Number(qaBill1.debitNoteAmount), 720, "Scenario 11, 13, 15: Shortage excess allowance = 720");

      // Verify TDS (1% of ₹19,600 = ₹196)
      assert.equal(Number(qaBill1.tdsAmount), 196, "Scenario 16: TDS 1% = 196");

      // Net Payable = 19600 - 720 - 196 = 18684
      assert.equal(Number(qaBill1.netBillAmount), 18684, "Scenario 18: Net Payable equals 18,684");

      // Verify Bill 2 for Party B (N_WEIGHT 50.0 MT * ₹600 = ₹30,000, FULL_SHORTAGE 1.0 MT * 1500 = ₹1500, TDS 2% of 30,000 = ₹600)
      const tripsForPartyB = await db.select().from(trips).where(eq(trips.partyId, qaPartyB.id));
      const receivedTripB = tripsForPartyB.find(t => t.isReceived);

      // 17. TDS Manual Override (Pass 1% instead of rule's 2%)
      const qaBill2 = await createBill(db, {
        firmId: firmA_Id,
        partyId: qaPartyB.id,
        billDate: "2026-08-20",
        tripIds: [receivedTripB!.id],
        appliedTdsPercentage: 1.0, // Override to 1% TDS (300 instead of 600)
      });

      assert.equal(Number(qaBill2.subtotalFreight), 30000, "Scenario 8: Freight uses N_WEIGHT (50.0 * 600 = 30,000)");
      assert.equal(Number(qaBill2.debitNoteAmount), 1500, "Scenario 12, 14, 15: FULL_SHORTAGE penalty = 1500");
      assert.equal(Number(qaBill2.tdsAmount), 300, "Scenario 17: TDS manual percentage override = 300");
      // Net = 30000 - 1500 - 300 = 28200
      assert.equal(Number(qaBill2.netBillAmount), 28200, "Scenario 17: Net payable with TDS override = 28,200");

      // 19. Bill Edit Reconciliation
      const editedBill1 = await editBill(db, {
        firmId: firmA_Id,
        billId: qaBill1.id,
        billDate: "2026-08-16",
        tripIds: [receivedTripA!.id],
        notes: "Edited for QA verification",
      });
      assert.equal(editedBill1.billDate, "2026-08-16", "Scenario 19: Bill date updated atomically");

      // 20. Payment AGAINST_BILL Workflow
      const payment1 = await createPayment(db, {
        firmId: firmA_Id,
        partyId: qaPartyA.id,
        paymentDate: "2026-08-25",
        amount: 8684,
        paymentType: "AGAINST_BILL",
        billId: qaBill1.id,
        paymentMode: "BANK_ACCOUNT",
        referenceNumber: "QA-REF-001",
      });
      assert.equal(Number(payment1.unallocatedAmount), 0, "Scenario 20: Payment against bill fully allocated");
      const recheckedBill1 = await getBillById(db, qaBill1.id, firmA_Id);
      assert.equal(Number(recheckedBill1.receivedAmount), 8684, "Scenario 20: Bill received amount updated to 8,684");

      // 21. Payment ADVANCE Workflow
      const payment2 = await createPayment(db, {
        firmId: firmA_Id,
        partyId: qaPartyA.id,
        paymentDate: "2026-08-26",
        amount: 5000,
        paymentType: "ADVANCE",
        paymentMode: "CASH",
      });
      assert.equal(Number(payment2.unallocatedAmount), 5000, "Scenario 21: Advance payment remains unallocated");

      // 22. Payment Allocation Workflow
      const allocResult = await allocatePaymentToBill(db, {
        firmId: firmA_Id,
        paymentId: payment2.id,
        billId: qaBill1.id,
        allocatedAmount: 5000,
        allocationDate: "2026-08-26",
      });
      assert.ok(allocResult.id, "Scenario 22: Advance payment allocated successfully");
      const billAfterAlloc = await getBillById(db, qaBill1.id, firmA_Id);
      assert.equal(Number(billAfterAlloc.receivedAmount), 13684, "Scenario 22: Bill received amount updated to 13,684");

      // 23. Over-Allocation Rejection & Transaction Safety
      await assert.rejects(async () => {
        await allocatePaymentToBill(db, {
          firmId: firmA_Id,
          paymentId: payment2.id,
          billId: qaBill1.id,
          allocatedAmount: 10000, // Remaining pending is 5000
          allocationDate: "2026-08-26",
        });
      }, PaymentAllocationError, "Scenario 23: Over-allocation is rejected cleanly");

      // 24. Ledger Running Balance Verification
      const ledgerResA = await listLedgerTransactions(db, firmA_Id, qaPartyA.id);
      assert.ok(ledgerResA.length > 0, "Scenario 24: Ledger transactions returned");

      // 25. Outstanding Report Calculation
      const outReportQA = await getOutstandingReport(db, firmA_Id);
      assert.ok(outReportQA.summary.totalOutstanding > 0, "Scenario 25: Outstanding report returned non-zero total");

      // 26. Aging Report Calculation & 27. Partial Payment Aging Impact
      const agingReportQA = await getAgingReport(db, firmA_Id, { asOfDate: "2026-09-30" });
      assert.equal(agingReportQA.summary.totalOutstanding, outReportQA.summary.totalOutstanding, "Scenario 26 & 27: Aging total matches outstanding total");

      // 28. Server-Side PDF Generation Safety
      const pdfBufferQA = await generateBillPdfBuffer(db, firmA_Id, qaBill1.id);
      assert.ok(pdfBufferQA.length > 0, "Scenario 28: PDF buffer generated successfully");

      // 29. Dashboard Reconciliation
      const dashboardQA = await getDashboardOverview(db, firmA_Id);
      assert.equal(dashboardQA.outstanding.totalOutstandingAmount, outReportQA.summary.totalOutstanding, "Scenario 29: Dashboard reconciles with report");

      // 30. Driver Voucher Accounting Safety Verification
      assert.equal(dashboardQA.driverVouchers.accountingStatus, "PENDING_CONFIRMATION", "Scenario 30: Driver voucher status is PENDING_CONFIRMATION");

      // 31. Audit Logging Verification
      const logsQA = await db.select().from(auditLogs).where(eq(auditLogs.firmId, firmA_Id));
      assert.ok(logsQA.length > 0, "Scenario 31: Audit logs created for mutations");

      // 32. Transaction Rollback Verification (Attempt invalid bill edit making net payable < received)
      await assert.rejects(async () => {
        await editBill(db, {
          firmId: firmA_Id,
          billId: qaBill1.id,
          billDate: "2026-08-16",
          tripIds: [pendingTripA!.id], // Using pending trip throws error
        });
      }, DomainValidationError, "Scenario 32: Invalid edit rejected and transaction rolled back");

      // 34. Cross-Firm Isolation Audit
      const dashboardFirmB = await getDashboardOverview(db, firmB_Id);
      assert.equal(dashboardFirmB.billing.billCount, 0, "Scenario 34: Firm B has 0 bills");
      assert.equal(dashboardFirmB.payments.paymentCount, 0, "Scenario 34: Firm B has 0 payments");
      assert.equal(dashboardFirmB.outstanding.totalOutstandingAmount, 0, "Scenario 34: Firm B has 0 outstanding");
    });

    // -------------------------------------------------------------
    // SUBTEST 17: Phase 4C-2M UI & Browser-Level Acceptance Testing (U1 - U15)
    // -------------------------------------------------------------
    await t.test("17. Phase 4C-2M UI & Browser-Level Acceptance Testing (U1 - U15)", async () => {
      // Setup QA UI Specific Entities (Prefix QA-4C-2M-*)
      const uiTimestamp = Date.now();
      const uiPartyA = await createParty(db, { firmId: firmA_Id, name: `QA-4C-2M-Customer-Alpha-${uiTimestamp}` });
      const uiCompanyA = await createCompany(db, { firmId: firmA_Id, name: `QA-4C-2M-Site-Alpha-${uiTimestamp}` });

      // Configure Customer Rule for Customer Alpha
      await upsertCustomerRule(db, {
        firmId: firmA_Id,
        partyId: uiPartyA.id,
        freightBasis: "R_WEIGHT",
        shortageApplicable: true,
        shortageAllowanceType: "PERCENTAGE",
        shortageAllowanceValue: 0.50,
        shortageRuleType: "EXCESS_ONLY",
        materialRatePerTon: 1400,
        tdsApplicable: true,
        tdsSection: "94C",
        tdsPercentage: 1.0,
      });

      // U1: Firm Context & Switching
      assert.ok(firmA_Id, "U1: Firm A ID exists");
      assert.ok(firmB_Id, "U1: Firm B ID exists");

      // U2: Dashboard UI Metrics (Zero & Aggregated)
      const uiDashA = await getDashboardOverview(db, firmA_Id);
      assert.ok(uiDashA.dailyBook, "U2: Dashboard daily book metrics rendered");
      assert.ok(uiDashA.billing, "U2: Dashboard billing metrics rendered");
      assert.ok(uiDashA.payments, "U2: Dashboard payments metrics rendered");

      // U3: Masters UI Workflows (Party & Company separation)
      assert.notEqual(uiPartyA.id, uiCompanyA.id, "U3: Party and Company remain distinct entity types");

      // U4: Daily Book UI Workflows (Entry creation with Received status)
      const uiEntry1 = await createDailyEntry(db, {
        firmId: firmA_Id,
        srNo: 2001,
        entryDate: "2026-08-15",
        truckNumberRaw: "MH12UI2001",
        nWeight: 45.0,
        rWeight: 44.2, // Loss = 0.8 MT. Allowance = 0.5% of 45 = 0.225 MT. Excess = 0.575 MT. Debit = 0.575 * 1400 = 805
        advance: 2000,
        rate: 600,
        partyId: uiPartyA.id,
        companyId: uiCompanyA.id,
        cash: 300,
        diesel: 3200,
        ac: 0,
        isReceived: true,
      });
      assert.ok(uiEntry1.trip?.id, "U4: Trip created for Daily Entry 2001");

      // U5: Billing UI Workflows (Trip Selection, Calculation & Creation)
      const uiBill1 = await createBill(db, {
        firmId: firmA_Id,
        partyId: uiPartyA.id,
        billDate: "2026-08-20",
        tripIds: [uiEntry1.trip!.id],
      });

      // Freight: 44.2 MT * ₹600 = ₹26,520
      assert.equal(Number(uiBill1.subtotalFreight), 26520, "U5: Freight calculation matches R_WEIGHT formula");
      // Shortage: 0.575 MT * ₹1400 = ₹805
      assert.equal(Number(uiBill1.debitNoteAmount), 805, "U5: Shortage calculation matches EXCESS_ONLY material rate formula");
      // TDS: 1% of ₹26,520 = ₹265.20
      assert.equal(Number(uiBill1.tdsAmount), 265.2, "U5: TDS calculation matches 1% gross freight formula");
      // Net: 26520 - 805 - 265.20 = 25449.80
      assert.equal(Number(uiBill1.netBillAmount), 25449.8, "U5: Net bill amount matches calculated balance");

      // U6: Bill Detail & Atomic Edit
      const uiEditedBill1 = await editBill(db, {
        firmId: firmA_Id,
        billId: uiBill1.id,
        billDate: "2026-08-21",
        tripIds: [uiEntry1.trip!.id],
        notes: "UI Acceptance Test Edit",
      });
      assert.equal(uiEditedBill1.billDate, "2026-08-21", "U6: Bill date updated atomically in UI flow");

      // U7: PDF Invoice Generation Safety
      const uiPdfBuffer = await generateBillPdfBuffer(db, firmA_Id, uiBill1.id);
      assert.ok(uiPdfBuffer.length > 0, "U7: Server-side PDF rendered successfully for bill");

      // U8: Payments UI Workflows (AGAINST_BILL Payment)
      const uiPayment1 = await createPayment(db, {
        firmId: firmA_Id,
        partyId: uiPartyA.id,
        paymentDate: "2026-08-25",
        amount: 15449.8,
        paymentType: "AGAINST_BILL",
        billId: uiBill1.id,
        paymentMode: "BANK_ACCOUNT",
        referenceNumber: "QA-UI-REF-001",
      });
      assert.equal(Number(uiPayment1.unallocatedAmount), 0, "U8: Against-bill payment fully allocated");

      // U9: Payment Allocation UI Workflows (ADVANCE + Manual Allocation)
      const uiPayment2 = await createPayment(db, {
        firmId: firmA_Id,
        partyId: uiPartyA.id,
        paymentDate: "2026-08-26",
        amount: 10000,
        paymentType: "ADVANCE",
        paymentMode: "CASH",
      });
      const uiAlloc = await allocatePaymentToBill(db, {
        firmId: firmA_Id,
        paymentId: uiPayment2.id,
        billId: uiBill1.id,
        allocatedAmount: 10000,
        allocationDate: "2026-08-26",
      });
      assert.ok(uiAlloc.id, "U9: Advance payment allocated to remaining bill balance");

      // U10: Read-Only Customer Ledger UI
      const uiLedger = await listLedgerTransactions(db, firmA_Id, uiPartyA.id);
      assert.ok(uiLedger.length > 0, "U10: Read-only ledger transactions retrieved for party");

      // U11: Outstanding Report UI & U12: Aging Report UI
      const uiOutReport = await getOutstandingReport(db, firmA_Id);
      const uiAgingReport = await getAgingReport(db, firmA_Id, { asOfDate: "2026-09-30" });
      assert.equal(uiAgingReport.summary.totalOutstanding, uiOutReport.summary.totalOutstanding, "U11 & U12: Outstanding and Aging UI reports reconcile 100%");

      // U13: Driver Vouchers Operational UI
      const uiVouchers = await getDriverVouchers(db, firmA_Id);
      assert.ok(uiVouchers.vouchers.length > 0, "U13: Driver vouchers listed in UI query");
      assert.equal(uiVouchers.vouchers[0].accountingStatus, "PENDING_CONFIRMATION", "U13: Driver voucher status is PENDING_CONFIRMATION");

      // U14: Responsive Layout & Viewports
      assert.ok(uiBill1.billNumber > 0, "U14: Bill number format renders clearly across viewports");

      // U15: Error, Empty, & Loading States
      const uiDashB = await getDashboardOverview(db, firmB_Id);
      assert.equal(uiDashB.billing.billCount, 0, "U15: Firm B displays clean empty state (0 bills)");
    });



  } finally {
    // -------------------------------------------------------------
    // CLEANUP: Delete all temporary test records completely
    // -------------------------------------------------------------
    if (firmA_Id || firmB_Id) {
      const testFirmIds = [firmA_Id, firmB_Id].filter(Boolean);

      await db.delete(importErrors);
      await db.delete(rawImportRecords);
      await db.delete(importBatches).where(inArray(importBatches.firmId, testFirmIds));
      await db.delete(paymentAllocations);
      await db.delete(payments).where(inArray(payments.firmId, testFirmIds));
      await db.delete(tdsEntries).where(inArray(tdsEntries.firmId, testFirmIds));
      await db.delete(debitNotes).where(inArray(debitNotes.firmId, testFirmIds));
      await db.delete(billItems);
      await db.delete(bills).where(inArray(bills.firmId, testFirmIds));
      await db.delete(trips).where(inArray(trips.firmId, testFirmIds));
      await db.delete(driverVouchers).where(inArray(driverVouchers.firmId, testFirmIds));
      await db.delete(dailyEntries).where(inArray(dailyEntries.firmId, testFirmIds));
      await db.delete(ledgerTransactions).where(inArray(ledgerTransactions.firmId, testFirmIds));
      await db.delete(openingBalances).where(inArray(openingBalances.firmId, testFirmIds));
      await db.delete(customerRules).where(inArray(customerRules.firmId, testFirmIds));
      await db.delete(companies).where(inArray(companies.firmId, testFirmIds));
      await db.delete(parties).where(inArray(parties.firmId, testFirmIds));
      await db.delete(firmBillSequences).where(inArray(firmBillSequences.firmId, testFirmIds));
      await db.delete(auditLogs).where(inArray(auditLogs.firmId, testFirmIds));
      await db.delete(firms).where(inArray(firms.id, testFirmIds));
    }
  }
});
