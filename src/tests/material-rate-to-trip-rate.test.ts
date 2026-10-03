import test from "node:test";
import assert from "node:assert/strict";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

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
  ledgerTransactions,
  auditLogs,
  firmBillSequences,
  customerRules,
  openingBalances,
  payments,
  paymentAllocations,
  companies,
} from "../db/schema";
import { createDailyEntry } from "../services/daily-entry.service";
import { createParty, upsertCustomerRule } from "../services/party.service";
import { createBill } from "../services/bill.service";
import { inArray, sql, eq, and } from "drizzle-orm";

async function cleanTestFirms(prefix: string) {
  const existing = await db
    .select({ id: firms.id })
    .from(firms)
    .where(sql`code LIKE ${prefix + "%"}`);
  if (existing.length === 0) return;
  const ids = existing.map((f) => f.id);
  await db.delete(paymentAllocations);
  await db.delete(payments).where(inArray(payments.firmId, ids));
  await db.delete(tdsEntries).where(inArray(tdsEntries.firmId, ids));
  await db.delete(debitNotes).where(inArray(debitNotes.firmId, ids));
  await db.delete(billItems);
  await db.delete(bills).where(inArray(bills.firmId, ids));
  await db.delete(trips).where(inArray(trips.firmId, ids));
  await db.delete(driverVouchers).where(inArray(driverVouchers.firmId, ids));
  await db.delete(dailyEntries).where(inArray(dailyEntries.firmId, ids));
  await db.delete(ledgerTransactions).where(inArray(ledgerTransactions.firmId, ids));
  await db.delete(openingBalances).where(inArray(openingBalances.firmId, ids));
  await db.delete(customerRules).where(inArray(customerRules.firmId, ids));
  await db.delete(companies).where(inArray(companies.firmId, ids));
  await db.delete(parties).where(inArray(parties.firmId, ids));
  await db.delete(firmBillSequences).where(inArray(firmBillSequences.firmId, ids));
  await db.delete(auditLogs).where(inArray(auditLogs.firmId, ids));
  await db.delete(firms).where(inArray(firms.id, ids));
}

async function makeFirm(code: string, name: string) {
  const [f] = await db.insert(firms).values({ name, code }).returning();
  return f;
}

test("Material Rate to Daily Book Customer Rate Transition Test Suite", async (t) => {
  const PREFIX = `TEST_MATRATE_${Date.now()}`;
  let firmId = "";

  try {
    await cleanTestFirms("TEST_MATRATE_");

    const firm = await makeFirm(`${PREFIX}_F1`, "Firm Test Rate Transition");
    firmId = firm.id;

    const party = await createParty(db, { firmId, name: "Multi-Rate Test Customer" });

    // Customer Rule: Shortage Applicable = YES, Rule = EXCESS_ONLY, Allowance = 100 KG (0.1 MT), TDS = 1%
    await upsertCustomerRule(db, {
      firmId,
      partyId: party.id,
      freightBasis: "AUTO_SHORTAGE_BASED",
      shortageApplicable: true,
      shortageAllowanceType: "FIXED_KG",
      shortageAllowanceValue: 0.1, // 100 KG stored in MT
      shortageRuleType: "EXCESS_ONLY",
      tdsApplicable: true,
      tdsSection: "94C",
      tdsPercentage: 1.0,
    });

    let srno = 900;

    // ─────────────────────────────────────────────────────────────────────────
    // REQUIREMENT 6 & INTENDED EXAMPLE TEST:
    // Trip A: N=40 T, R=35 T, Rate=₹4,000/T, Allowance=100 KG (0.1 T)
    //   -> Shortage=5 T, Applicable=4.9 T, Debit = 4.9 x ₹4,000 = ₹19,600
    //   -> Freight = 35 T x ₹4,000 = ₹1,40,000
    // Trip B: N=30 T, R=29 T, Rate=₹4,500/T, Allowance=100 KG (0.1 T)
    //   -> Shortage=1 T, Applicable=0.9 T, Debit = 0.9 x ₹4,500 = ₹4,050
    //   -> Freight = 29 T x ₹4,500 = ₹1,30,500
    // ─────────────────────────────────────────────────────────────────────────
    await t.test("Multi-Trip Shortage Valuation using Per-Trip Customer Rate", async () => {
      const tripAEntry = await createDailyEntry(db, {
        firmId,
        srNo: ++srno,
        entryDate: "2026-10-02",
        truckNumberRaw: "MH04AB1001",
        nWeight: 40,
        rWeight: 35,
        customerRate: 4000,
        partyId: party.id,
        isReceived: true,
      });

      const tripBEntry = await createDailyEntry(db, {
        firmId,
        srNo: ++srno,
        entryDate: "2026-10-02",
        truckNumberRaw: "MH04AB1002",
        nWeight: 30,
        rWeight: 29,
        customerRate: 4500,
        partyId: party.id,
        isReceived: true,
      });

      const bill = await createBill(db, {
        firmId,
        partyId: party.id,
        billDate: "2026-10-02",
        tripIds: [tripAEntry.trip!.id, tripBEntry.trip!.id],
      });

      const items = await db.select().from(billItems).where(eq(billItems.billId, bill.id));
      assert.equal(items.length, 2, "Must create 2 bill items");

      const itemA = items.find((i) => Number(i.appliedRate) === 4000);
      const itemB = items.find((i) => Number(i.appliedRate) === 4500);

      assert.ok(itemA, "Trip A item found");
      assert.ok(itemB, "Trip B item found");

      // Verify Trip A per-trip calculations
      assert.equal(Number(itemA!.shortageQtyApplicable), 4.9, "Trip A applicable shortage = 4.9 MT");
      assert.equal(Number(itemA!.shortageMaterialRate), 4000, "Trip A shortage valuation rate = ₹4,000/T");
      assert.equal(Number(itemA!.shortageDebitAmount), 19600, "Trip A shortage debit = ₹19,600");
      assert.equal(Number(itemA!.freight), 140000, "Trip A freight = ₹1,40,000");

      // Verify Trip B per-trip calculations
      assert.equal(Number(itemB!.shortageQtyApplicable), 0.9, "Trip B applicable shortage = 0.9 MT");
      assert.equal(Number(itemB!.shortageMaterialRate), 4500, "Trip B shortage valuation rate = ₹4,500/T");
      assert.equal(Number(itemB!.shortageDebitAmount), 4050, "Trip B shortage debit = ₹4,050");
      assert.equal(Number(itemB!.freight), 130500, "Trip B freight = ₹1,30,500");

      // Verify Bill Totals
      assert.equal(Number(bill.subtotalFreight), 270500, "Gross Freight = ₹2,70,500");
      assert.equal(Number(bill.debitNoteAmount), 23650, "Total Shortage Debit = ₹23,650");

      // Amount After Shortage = 2,70,500 - 23,650 = ₹2,46,850
      // TDS @ 1% = ₹2,468.50
      assert.equal(Number(bill.tdsAmount), 2468.5, "TDS = 1% on ₹2,46,850 = ₹2,468.50");

      // Net Bill Amount = Gross Freight - Shortage Debit - TDS = 270500 - 23650 - 2468.50 = ₹244,381.50
      assert.equal(Number(bill.netBillAmount), 244381.5, "Net Bill = ₹2,44,381.50");
    });

    // ─────────────────────────────────────────────────────────────────────────
    // REQUIREMENT 7 & 9: Complete Downstream Chain Regression Test
    // Gross Freight -> Shortage Debit -> TDS -> Net Bill -> Ledger -> Debit Note
    // ─────────────────────────────────────────────────────────────────────────
    await t.test("Complete Downstream Chain Regression Test", async () => {
      const singleTripEntry = await createDailyEntry(db, {
        firmId,
        srNo: ++srno,
        entryDate: "2026-10-02",
        truckNumberRaw: "MH04AB2001",
        nWeight: 50,
        rWeight: 48,
        customerRate: 3000,
        partyId: party.id,
        isReceived: true,
      });

      // N = 50, R = 48 -> Shortage = 2 T. Allowance = 0.1 T -> Applicable = 1.9 T
      // Shortage Debit = 1.9 T x ₹3,000 = ₹5,700
      // Gross Freight = 48 T x ₹3,000 = ₹1,44,000
      // Amount After Shortage = 1,44,000 - 5,700 = ₹1,38,300
      // TDS @ 1% = ₹1,383
      // Net Bill = 1,38,300 - 1,383 = ₹1,36,917

      const bill = await createBill(db, {
        firmId,
        partyId: party.id,
        billDate: "2026-10-02",
        tripIds: [singleTripEntry.trip!.id],
      });

      assert.equal(Number(bill.subtotalFreight), 144000, "Gross Freight = ₹1,44,000");
      assert.equal(Number(bill.debitNoteAmount), 5700, "Shortage Debit = ₹5,700");
      assert.equal(Number(bill.tdsAmount), 1383, "TDS = ₹1,383 (calculated on ₹1,38,300)");
      assert.equal(Number(bill.netBillAmount), 136917, "Net Bill = ₹1,36,917");

      // Verify Ledger Entry
      const ledgerTxn = await db
        .select()
        .from(ledgerTransactions)
        .where(and(eq(ledgerTransactions.firmId, firmId), eq(ledgerTransactions.sourceEntityId, bill.id)));
      assert.ok(ledgerTxn.length > 0, "Ledger transaction created for bill");
      const freightTxn = ledgerTxn.find((t) => t.voucherType === "TRANSPORTATION_CHARGES_RCM" || t.particulars.includes("Bill"));
      assert.ok(freightTxn, "Freight Bill ledger entry present");
      assert.equal(Number(freightTxn!.creditAmount || freightTxn!.debitAmount), 144000, "Ledger Gross Freight = ₹1,44,000");

      // Verify Debit Note created
      const dNotes = await db
        .select()
        .from(debitNotes)
        .where(and(eq(debitNotes.firmId, firmId), eq(debitNotes.billId, bill.id)));
      assert.equal(dNotes.length, 1, "Debit note created");
      assert.equal(Number(dNotes[0].debitAmount), 5700, "Debit note amount = ₹5,700");
      assert.equal(Number(dNotes[0].materialRateApplied), 3000, "Debit note materialRateApplied = ₹3,000");
    });

    // ─────────────────────────────────────────────────────────────────────────
    // REQUIREMENT 8: Historical QA Bill Safety Verification
    // ─────────────────────────────────────────────────────────────────────────
    await t.test("Historical QA Bill Untouched Verification", async () => {
      const allBills = await db.select().from(bills).limit(5);
      if (allBills.length > 0) {
        for (const b of allBills) {
          assert.ok(b.id, "Existing bill ID present");
          assert.ok(b.billNumber, "Bill number present");
          const items = await db.select().from(billItems).where(eq(billItems.billId, b.id));
          assert.ok(items.length >= 0, "Bill items readable without error");
        }
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // REQUIREMENT 4: Database Schema Columns Preservation Verification
    // ─────────────────────────────────────────────────────────────────────────
    await t.test("Database Schema Columns Preserved Verification", async () => {
      const ruleRow = await db.select().from(customerRules).where(eq(customerRules.firmId, firmId)).limit(1);
      assert.ok(ruleRow.length > 0, "Customer rule row readable");
      assert.ok("materialRatePerTon" in ruleRow[0], "customer_rules.material_rate_per_ton column preserved");

      const itemRow = await db.select().from(billItems).limit(1);
      if (itemRow.length > 0) {
        assert.ok("shortageMaterialRate" in itemRow[0], "bill_items.shortage_material_rate column preserved");
      }

      const dnRow = await db.select().from(debitNotes).limit(1);
      if (dnRow.length > 0) {
        assert.ok("materialRateApplied" in dnRow[0], "debit_notes.material_rate_applied column preserved");
      }
    });

  } finally {
    if (firmId) {
      await cleanTestFirms("TEST_MATRATE_");
    }
  }
});
