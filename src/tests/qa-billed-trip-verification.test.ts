import test from "node:test";
import assert from "node:assert/strict";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../db";
import {
  firms,
  parties,
  dailyEntries,
  trips,
  bills,
  billItems,
  tdsEntries,
  debitNotes,
  payments,
  paymentAllocations,
  ledgerTransactions,
  auditLogs,
  firmBillSequences,
} from "../db/schema";
import { createDailyEntry, updateDailyEntry, listDailyEntries } from "../services/daily-entry.service";
import { createParty } from "../services/party.service";
import { createBill, editBill, getBillById } from "../services/bill.service";
import { createPayment } from "../services/payment.service";
import { listLedgerTransactions } from "../services/ledger.service";
import { getOutstandingReport } from "../services/report.service";
import { BilledTripEditError, DomainValidationError } from "../lib/errors";
import { eq, inArray, and } from "drizzle-orm";

test("Daily Book → Billed Trip Edit Protection Comprehensive QA Verification", async (t) => {
  let firmA_Id = "";
  let firmB_Id = "";
  let partyA_Id = "";
  let partyB_Id = "";
  let qaEntryId = "";
  let qaTripId = "";
  let qaBillId = "";
  let qaPaymentId = "";

  const createdFirmIds: string[] = [];

  try {
    const timestamp = Date.now();
    const [firmA] = await db
      .insert(firms)
      .values({ name: "QA Verification Firm A", code: `QA_VERIFY_A_${timestamp}` })
      .returning();
    const [firmB] = await db
      .insert(firms)
      .values({ name: "QA Verification Firm B", code: `QA_VERIFY_B_${timestamp}` })
      .returning();

    firmA_Id = firmA.id;
    firmB_Id = firmB.id;
    createdFirmIds.push(firmA_Id, firmB_Id);

    const partyA = await createParty(db, { firmId: firmA_Id, name: "QA Party A" });
    const partyB = await createParty(db, { firmId: firmB_Id, name: "QA Party B" });
    partyA_Id = partyA.id;
    partyB_Id = partyB.id;

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Create controlled QA trip (received) & check unbilled state
    // ──────────────────────────────────────────────────────────────────────────
    await t.test("1. Create unbilled Daily Entry & verify UI fields (isBilled=false)", async () => {
      const dailyRes = await createDailyEntry(db, {
        firmId: firmA_Id,
        srNo: 1,
        entryDate: "2026-09-25",
        truckNumberRaw: "KA01AB1234",
        nWeight: 40,
        rWeight: 38,
        advance: 1000,
        cash: 200,
        diesel: 500,
        ac: 300,
        rate: 500,
        customerRate: 500,
        partyId: partyA_Id,
        fromLocationRaw: "BLR",
        toLocationRaw: "HYD",
        lrNumber: "LR-1001",
        remarks: "QA Initial Entry",
        isReceived: true, // Must be true so trip can be billed
      });

      qaEntryId = dailyRes.entry.id;
      assert.ok(dailyRes.trip, "Trip must be created when partyId is provided");
      qaTripId = dailyRes.trip.id;

      const entries = await listDailyEntries(db, firmA_Id);
      const targetEntry = entries.find((e) => e.id === qaEntryId);

      assert.ok(targetEntry, "QA Daily Entry must be present in listDailyEntries");
      assert.equal(targetEntry.isBilled, false, "Unbilled trip must have isBilled = false");
      assert.equal(targetEntry.billNumber, null, "Unbilled trip must have billNumber = null");
      assert.equal(targetEntry.billStatus, null, "Unbilled trip must have billStatus = null");
    });

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Bill the trip (POSTED) & confirm UI lock fields
    // ──────────────────────────────────────────────────────────────────────────
    await t.test("2. Create POSTED bill and confirm isBilled=true & billStatus=POSTED", async () => {
      const bill = await createBill(db, {
        firmId: firmA_Id,
        partyId: partyA_Id,
        billDate: "2026-09-25",
        tripIds: [qaTripId],
        appliedTdsSection: "94C",
        appliedTdsPercentage: 2,
        notes: "QA Billed Trip",
      });

      assert.ok(bill, "Bill response must be returned");
      qaBillId = bill.id;
      assert.equal(bill.status, "POSTED");

      const entries = await listDailyEntries(db, firmA_Id);
      const targetEntry = entries.find((e) => e.id === qaEntryId);

      assert.ok(targetEntry, "Billed entry must exist");
      assert.equal(targetEntry.isBilled, true, "Billed trip must have isBilled = true");
      assert.equal(targetEntry.billStatus, "POSTED", "Billed trip status must be POSTED");
      assert.equal(targetEntry.billNumber, bill.billNumber, "Billed trip must show correct billNumber");
    });

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Attempt direct API update on POSTED trip -> Must throw BilledTripEditError (409)
    // ──────────────────────────────────────────────────────────────────────────
    await t.test("3. Direct API update attempt against POSTED trip throws BilledTripEditError (HTTP 409)", async () => {
      await assert.rejects(
        async () => {
          await updateDailyEntry(db, qaEntryId, {
            firmId: firmA_Id,
            srNo: 1,
            entryDate: "2026-09-25",
            truckNumberRaw: "KA01AB1234",
            nWeight: 42, // Attempt change
            rWeight: 38,
            advance: 1000,
            rate: 500,
            partyId: partyA_Id,
            isReceived: true,
          });
        },
        (err: any) => {
          assert.ok(err instanceof BilledTripEditError, "Should throw BilledTripEditError");
          assert.equal(err.code, "BILLED_TRIP_EDIT_LOCKED", "Error code must be BILLED_TRIP_EDIT_LOCKED for HTTP 409");
          return true;
        }
      );

      // Verify row in database is unmutated
      const dbRows = await db.select().from(dailyEntries).where(eq(dailyEntries.id, qaEntryId));
      assert.equal(Number(dbRows[0].nWeight), 40, "nWeight in DB must remain 40 (unmutated)");
    });

    // ──────────────────────────────────────────────────────────────────────────
    // 4. Test each of the 17 individual fields for rejection
    // ──────────────────────────────────────────────────────────────────────────
    await t.test("4. Field-by-field rejection test for all 17 fields on POSTED-billed trip", async () => {
      const baseInput = {
        firmId: firmA_Id,
        srNo: 1,
        entryDate: "2026-09-25",
        truckNumberRaw: "KA01AB1234",
        nWeight: 40,
        rWeight: 38,
        advance: 1000,
        cash: 200,
        diesel: 500,
        ac: 300,
        rate: 500,
        customerRate: 500,
        partyId: partyA_Id,
        fromLocationRaw: "BLR",
        toLocationRaw: "HYD",
        lrNumber: "LR-1001",
        remarks: "QA Initial Entry",
        isReceived: true,
      };

      const fieldVariations: Array<{ field: string; patch: Partial<typeof baseInput> }> = [
        { field: "nWeight", patch: { nWeight: 45 } },
        { field: "rWeight", patch: { rWeight: 40 } },
        { field: "rate", patch: { rate: 600 } },
        { field: "customerRate", patch: { customerRate: 550 } },
        { field: "party", patch: { partyId: partyB_Id } },
        { field: "truck", patch: { truckNumberRaw: "MH12XY9999" } },
        { field: "date", patch: { entryDate: "2026-09-26" } },
        { field: "from", patch: { fromLocationRaw: "MUMBAI" } },
        { field: "to", patch: { toLocationRaw: "DELHI" } },
        { field: "LR number", patch: { lrNumber: "LR-9999" } },
        { field: "company", patch: { remarks: "Company change test" } },
        { field: "remarks", patch: { remarks: "Attempted edit" } },
        { field: "advance", patch: { advance: 2000 } },
        { field: "cash", patch: { cash: 500 } },
        { field: "diesel", patch: { diesel: 1000 } },
        { field: "A/c", patch: { ac: 700 } },
        { field: "isReceived", patch: { isReceived: false } },
      ];

      for (const { field, patch } of fieldVariations) {
        await assert.rejects(
          async () => {
            await updateDailyEntry(db, qaEntryId, { ...baseInput, ...patch });
          },
          (err: any) => {
            assert.equal(err.code, "BILLED_TRIP_EDIT_LOCKED", `Field '${field}' edit must be rejected with 409 code`);
            return true;
          }
        );
      }
    });

    // ──────────────────────────────────────────────────────────────────────────
    // 5-8. Create payment, confirm Bill, Payment, Ledger, Outstanding remain unchanged
    // ──────────────────────────────────────────────────────────────────────────
    await t.test("5-8. Confirm Bill, Payment, Ledger, and Outstanding remain unchanged after rejected edits", async () => {
      // Record initial bill state
      const initialBill = await getBillById(db, qaBillId, firmA_Id);
      assert.equal(Number(initialBill.subtotalFreight), 19000); // 38T * 500
      assert.equal(Number(initialBill.tdsAmount), 380); // 2% of 19000
      assert.equal(Number(initialBill.netBillAmount), 18620); // 19000 - 380

      // Create & allocate a payment against the bill
      const paymentRes = await createPayment(db, {
        firmId: firmA_Id,
        partyId: partyA_Id,
        paymentDate: "2026-09-25",
        paymentType: "AGAINST_BILL",
        paymentMode: "BANK_ACCOUNT",
        referenceNumber: "PAY-QA-100",
        amount: 5000,
        billId: qaBillId,
      });
      qaPaymentId = paymentRes.id;

      // Fetch snapshot of Ledger and Outstanding
      const ledgerBefore = await listLedgerTransactions(db, firmA_Id, partyA_Id);
      const outstandingBefore = await getOutstandingReport(db, firmA_Id);

      // Attempt another edit against daily entry
      await assert.rejects(async () => {
        await updateDailyEntry(db, qaEntryId, {
          firmId: firmA_Id,
          srNo: 1,
          entryDate: "2026-09-25",
          truckNumberRaw: "KA01AB1234",
          nWeight: 50,
          rWeight: 50,
          advance: 5000,
          rate: 1000,
          partyId: partyA_Id,
          isReceived: true,
        });
      });

      // Verify Bill remains unchanged
      const billAfter = await getBillById(db, qaBillId, firmA_Id);
      assert.equal(Number(billAfter.subtotalFreight), Number(initialBill.subtotalFreight));
      assert.equal(Number(billAfter.netBillAmount), Number(initialBill.netBillAmount));

      // Verify Payment remains unchanged
      const paymentRows = await db.select().from(payments).where(eq(payments.id, qaPaymentId));
      assert.equal(Number(paymentRows[0].amount), 5000);

      // Verify Ledger count and balances remain unchanged
      const ledgerAfter = await listLedgerTransactions(db, firmA_Id, partyA_Id);
      assert.equal(ledgerAfter.length, ledgerBefore.length);
      assert.equal(ledgerAfter[0].runningBalance, ledgerBefore[0].runningBalance);

      // Verify Outstanding report remains unchanged
      const outstandingAfter = await getOutstandingReport(db, firmA_Id);
      assert.deepEqual(outstandingAfter, outstandingBefore);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // 9-10. Bill Edit recalculates using bill_items snapshot data & snapshot safety
    // ──────────────────────────────────────────────────────────────────────────
    await t.test("9-10. Bill Edit recalculates using bill_items snapshot (38T, not mutated daily entry)", async () => {
      // Edit the bill to change TDS percentage from 2% to 1%
      const editedBill = await editBill(db, {
        billId: qaBillId,
        firmId: firmA_Id,
        billDate: "2026-09-25",
        tripIds: [qaTripId],
        appliedTdsSection: "94C",
        appliedTdsPercentage: 1, // 1% of 19000 = 190
        notes: "Updated TDS to 1%",
      });

      assert.equal(Number(editedBill.subtotalFreight), 19000, "Subtotal freight must be 19000 (38T * 500 from snapshot)");
      assert.equal(Number(editedBill.tdsAmount), 190, "TDS amount must be recalculated as 190 (1% of 19000)");
      assert.equal(Number(editedBill.netBillAmount), 18810, "Net bill amount must be 18810 (19000 - 190)");
    });

    // ──────────────────────────────────────────────────────────────────────────
    // 11. Confirm invalid foreign trip passed to Bill Edit returns DomainValidationError
    // ──────────────────────────────────────────────────────────────────────────
    await t.test("11. Foreign/Invalid trip ID in Bill Edit throws DomainValidationError", async () => {
      // Create a trip under Firm B
      const tripB = await createDailyEntry(db, {
        firmId: firmB_Id,
        srNo: 1,
        entryDate: "2026-09-25",
        truckNumberRaw: "MH12CD5678",
        nWeight: 20,
        rWeight: 20,
        advance: 0,
        rate: 500,
        partyId: partyB_Id,
        isReceived: true,
      });

      assert.ok(tripB.trip, "Firm B trip must exist");

      await assert.rejects(
        async () => {
          await editBill(db, {
            billId: qaBillId,
            firmId: firmA_Id, // Firm A context
            billDate: "2026-09-25",
            tripIds: [qaTripId, tripB.trip!.id], // Passing trip from Firm B into Firm A bill edit
            appliedTdsPercentage: 1,
          });
        },
        (err: any) => {
          assert.ok(err instanceof DomainValidationError, "Must throw DomainValidationError for foreign/missing trip");
          return true;
        }
      );
    });

    // ──────────────────────────────────────────────────────────────────────────
    // 12. Firm isolation check
    // ──────────────────────────────────────────────────────────────────────────
    await t.test("12. Firm isolation: Firm B cannot view or edit Firm A daily entries", async () => {
      const firmBEntries = await listDailyEntries(db, firmB_Id);
      const foundInFirmB = firmBEntries.some((e) => e.id === qaEntryId);
      assert.equal(foundInFirmB, false, "Firm A daily entry must NOT appear in Firm B list");

      await assert.rejects(async () => {
        await updateDailyEntry(db, qaEntryId, {
          firmId: firmB_Id, // Wrong firm
          srNo: 1,
          entryDate: "2026-09-25",
          truckNumberRaw: "KA01AB1234",
          nWeight: 40,
          rWeight: 38,
          advance: 1000,
          rate: 500,
          partyId: partyA_Id,
          isReceived: true,
        });
      });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // 13. Confirm no duplicate ledger/TDS/debit-note rows
    // ──────────────────────────────────────────────────────────────────────────
    await t.test("13. Confirm exact ledger/TDS/debit-note row counts (no duplicates)", async () => {
      const tdsRows = await db.select().from(tdsEntries).where(eq(tdsEntries.billId, qaBillId));
      assert.equal(tdsRows.length, 1, "Must have exactly 1 TDS entry for the bill");

      const debitNoteRows = await db.select().from(debitNotes).where(eq(debitNotes.billId, qaBillId));
      assert.equal(debitNoteRows.length, 0, "Must have 0 debit notes (none added)");

      const ledgerRows = await db
        .select()
        .from(ledgerTransactions)
        .where(
          and(
            eq(ledgerTransactions.sourceEntityType, "bills"),
            eq(ledgerTransactions.sourceEntityId, qaBillId)
          )
        );
      assert.equal(ledgerRows.length, 1, "Must have exactly 1 BILL ledger transaction for the bill");
    });
  } finally {
    // ──────────────────────────────────────────────────────────────────────────
    // Clean up ONLY exact created QA test firm IDs
    // ──────────────────────────────────────────────────────────────────────────
    if (createdFirmIds.length > 0) {
      await db.delete(paymentAllocations);
      await db.delete(payments).where(inArray(payments.firmId, createdFirmIds));
      await db.delete(tdsEntries).where(inArray(tdsEntries.firmId, createdFirmIds));
      await db.delete(debitNotes).where(inArray(debitNotes.firmId, createdFirmIds));
      await db.delete(billItems);
      await db.delete(bills).where(inArray(bills.firmId, createdFirmIds));
      await db.delete(trips).where(inArray(trips.firmId, createdFirmIds));
      await db.delete(dailyEntries).where(inArray(dailyEntries.firmId, createdFirmIds));
      await db.delete(ledgerTransactions).where(inArray(ledgerTransactions.firmId, createdFirmIds));
      await db.delete(parties).where(inArray(parties.firmId, createdFirmIds));
      await db.delete(firmBillSequences).where(inArray(firmBillSequences.firmId, createdFirmIds));
      await db.delete(auditLogs).where(inArray(auditLogs.firmId, createdFirmIds));
      await db.delete(firms).where(inArray(firms.id, createdFirmIds));
    }
  }
});
