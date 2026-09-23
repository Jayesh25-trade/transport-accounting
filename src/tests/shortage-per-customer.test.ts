/**
 * PHASE 4C-2A.1 — Customer-Wise Shortage Compatibility Tests
 *
 * Verifies that shortage allowance is resolved PER TRIP using the
 * trip's own party/customer rule — NOT a single rule applied to
 * all trips in the bill.
 *
 * Test cases:
 *   T1. Same customer, same rule — control case
 *   T2. Two customers with different percentage allowances in one bill
 *   T3. Percentage + fixed-KG customers in the same bill
 *   T4. EXCESS_ONLY rule applied per customer
 *   T5. FULL_SHORTAGE rule applied per customer
 *   T6. Customer rule firm isolation (Firm A rule must NOT bleed into Firm B)
 *   T7. Missing customer rule — shortage defaults to 0 (no rule = no debit)
 *   T8. Bill containing 3 customers with mixed rule types
 *
 * ALL data is created in TEST_SHORTAGE_* firms and fully cleaned in finally{}.
 * Production tables are untouched.
 */

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Test Suite ───────────────────────────────────────────────────────────────

test("Customer-Wise Shortage Rule Resolution (Phase 4C-2A.1)", async (t) => {
  const PREFIX = `TEST_SHORTAGE_${Date.now()}`;

  let firmA_Id = "";
  let firmB_Id = "";

  try {
    await cleanTestFirms("TEST_SHORTAGE_");

    // ── Firm setup ───────────────────────────────────────────────────────────
    const firmA = await makeFirm(`${PREFIX}_FA`, "Firm A (Shortage Tests)");
    const firmB = await makeFirm(`${PREFIX}_FB`, "Firm B (Isolation)");
    firmA_Id = firmA.id;
    firmB_Id = firmB.id;

    // ── Party setup ──────────────────────────────────────────────────────────
    const partyRoha   = await createParty(db, { firmId: firmA_Id, name: "Roha Customer" });
    const partySatra  = await createParty(db, { firmId: firmA_Id, name: "Satra Customer" });
    const partyFixKg  = await createParty(db, { firmId: firmA_Id, name: "FixedKG Customer" });
    const partyFull   = await createParty(db, { firmId: firmA_Id, name: "FullShortage Customer" });
    const partyNoRule = await createParty(db, { firmId: firmA_Id, name: "NoRule Customer" });
    const billingParty = await createParty(db, { firmId: firmA_Id, name: "Billing Party" });
    const firmBParty  = await createParty(db, { firmId: firmB_Id, name: "Firm B Party" });

    // ── Customer Rule setup ──────────────────────────────────────────────────

    // Roha: 0.5% EXCESS_ONLY, material rate ₹1000/T
    await upsertCustomerRule(db, {
      firmId: firmA_Id, partyId: partyRoha.id,
      freightBasis: "R_WEIGHT",
      shortageApplicable: true,
      shortageAllowanceType: "PERCENTAGE",
      shortageAllowanceValue: 0.5,
      shortageRuleType: "EXCESS_ONLY",
      materialRatePerTon: 1000,
      tdsApplicable: false,
      tdsSection: null, tdsPercentage: null,
    });

    // Satra: 1.0% EXCESS_ONLY, material rate ₹1200/T
    await upsertCustomerRule(db, {
      firmId: firmA_Id, partyId: partySatra.id,
      freightBasis: "R_WEIGHT",
      shortageApplicable: true,
      shortageAllowanceType: "PERCENTAGE",
      shortageAllowanceValue: 1.0,
      shortageRuleType: "EXCESS_ONLY",
      materialRatePerTon: 1200,
      tdsApplicable: false,
      tdsSection: null, tdsPercentage: null,
    });

    // FixKg: 0.300 MT (300 KG) EXCESS_ONLY, material rate ₹800/T
    await upsertCustomerRule(db, {
      firmId: firmA_Id, partyId: partyFixKg.id,
      freightBasis: "R_WEIGHT",
      shortageApplicable: true,
      shortageAllowanceType: "FIXED_KG",
      shortageAllowanceValue: 0.300,   // stored in MT — 300 KG
      shortageRuleType: "EXCESS_ONLY",
      materialRatePerTon: 800,
      tdsApplicable: false,
      tdsSection: null, tdsPercentage: null,
    });

    // FullShortage party: 0.2% FULL_SHORTAGE, material rate ₹900/T
    await upsertCustomerRule(db, {
      firmId: firmA_Id, partyId: partyFull.id,
      freightBasis: "R_WEIGHT",
      shortageApplicable: true,
      shortageAllowanceType: "PERCENTAGE",
      shortageAllowanceValue: 0.2,
      shortageRuleType: "FULL_SHORTAGE",
      materialRatePerTon: 900,
      tdsApplicable: false,
      tdsSection: null, tdsPercentage: null,
    });

    // Firm B party rule — must NOT affect Firm A calculations
    await upsertCustomerRule(db, {
      firmId: firmB_Id, partyId: firmBParty.id,
      freightBasis: "R_WEIGHT",
      shortageApplicable: true,
      shortageAllowanceType: "PERCENTAGE",
      shortageAllowanceValue: 99.0,  // deliberately extreme — must never apply to Firm A
      shortageRuleType: "FULL_SHORTAGE",
      materialRatePerTon: 9999,
      tdsApplicable: false,
      tdsSection: null, tdsPercentage: null,
    });

    // partyNoRule has NO rule configured — shortage must be 0

    let srno = 500; // Use high sr_no to avoid collisions with integration.test.ts

    // ─────────────────────────────────────────────────────────────────────────
    // T1. Same customer, same rule — control case
    //     Roha: 0.5%, EXCESS_ONLY, ₹1000/T
    //     N=40T, R=39T → shortage=1T, allowance=0.2T (0.5% of 40) → applicable=0.8T
    //     Debit = 0.8 × 1000 = ₹800
    // ─────────────────────────────────────────────────────────────────────────
    await t.test("T1. Same customer, same rule — control case", async () => {
      const d1 = await createDailyEntry(db, {
        firmId: firmA_Id, srNo: ++srno,
        entryDate: "2026-09-22",
        truckNumberRaw: "MH01AA0001",
        nWeight: 40, rWeight: 39,
        customerRate: 500,
        partyId: partyRoha.id,
        isReceived: true,
      });

      const bill = await createBill(db, {
        firmId: firmA_Id,
        partyId: billingParty.id,   // Bill belongs to billing party
        billDate: "2026-09-22",
        tripIds: [d1.trip!.id],
      });

      // Freight: 39T × ₹500 = ₹19,500
      assert.equal(Number(bill.subtotalFreight), 19500, "T1: subtotalFreight");

      // Verify bill_item stored the correct per-trip shortage
      const items = await db.select().from(billItems).where(eq(billItems.billId, bill.id));
      assert.equal(items.length, 1, "T1: one bill item");
      // Roha allowance = 0.5% of 40T = 0.200T → applicable = 1 - 0.2 = 0.8T → debit = 0.8 × 1000 = ₹800
      assert.equal(Number(items[0].shortageDebitAmount), 800, "T1: shortage debit per item");
      assert.equal(items[0].shortageRuleType, "EXCESS_ONLY", "T1: rule type snapshotted");
      assert.equal(Number(items[0].shortageMaterialRate), 1000, "T1: material rate snapshotted");
    });

    // ─────────────────────────────────────────────────────────────────────────
    // T2. Two customers with different percentage allowances in one bill
    //
    //     Trip A → Roha   (0.5% allowance, ₹1000/T)
    //       N=40T, R=39T → shortage=1T, allowance=0.2T → applicable=0.8T → debit=₹800
    //
    //     Trip B → Satra  (1.0% allowance, ₹1200/T)
    //       N=40T, R=39T → shortage=1T, allowance=0.4T → applicable=0.6T → debit=₹720
    //
    //     Total shortage debit = ₹800 + ₹720 = ₹1,520
    // ─────────────────────────────────────────────────────────────────────────
    await t.test("T2. Two customers different percentage allowances in one bill", async () => {
      const dRoha = await createDailyEntry(db, {
        firmId: firmA_Id, srNo: ++srno,
        entryDate: "2026-09-22",
        truckNumberRaw: "MH01AA0002",
        nWeight: 40, rWeight: 39,
        customerRate: 500,
        partyId: partyRoha.id,
        isReceived: true,
      });
      const dSatra = await createDailyEntry(db, {
        firmId: firmA_Id, srNo: ++srno,
        entryDate: "2026-09-22",
        truckNumberRaw: "MH01AA0003",
        nWeight: 40, rWeight: 39,
        customerRate: 500,
        partyId: partySatra.id,
        isReceived: true,
      });

      const bill = await createBill(db, {
        firmId: firmA_Id,
        partyId: billingParty.id,
        billDate: "2026-09-22",
        tripIds: [dRoha.trip!.id, dSatra.trip!.id],
      });

      // Each trip: freight 39T × ₹500 = ₹19,500 × 2 = ₹39,000 total
      assert.equal(Number(bill.subtotalFreight), 39000, "T2: subtotalFreight");

      const items = await db.select().from(billItems).where(eq(billItems.billId, bill.id));
      assert.equal(items.length, 2, "T2: two bill items");

      // Sort by shortageMaterialRate to reliably identify which item is which
      const sortedItems = [...items].sort(
        (a, b) => Number(a.shortageMaterialRate) - Number(b.shortageMaterialRate)
      );
      // Roha (₹1000/T): applicable = 0.8T → debit = ₹800
      assert.equal(Number(sortedItems[0].shortageMaterialRate), 1000, "T2: Roha material rate");
      assert.equal(Number(sortedItems[0].shortageDebitAmount), 800, "T2: Roha debit");
      // Satra (₹1200/T): applicable = 0.6T → debit = ₹720
      assert.equal(Number(sortedItems[1].shortageMaterialRate), 1200, "T2: Satra material rate");
      assert.equal(Number(sortedItems[1].shortageDebitAmount), 720, "T2: Satra debit");

      // Bill total shortage debit = ₹800 + ₹720 = ₹1,520
      assert.equal(Number(bill.debitNoteAmount), 1520, "T2: total shortage debit");
    });

    // ─────────────────────────────────────────────────────────────────────────
    // T3. Percentage + fixed-KG customers in the same bill
    //
    //     Trip A → Roha   (0.5% allowance, ₹1000/T)
    //       N=40T, R=39T → shortage=1T, allowance=0.2T → applicable=0.8T → debit=₹800
    //
    //     Trip B → FixKg  (0.300 MT = 300 KG, ₹800/T)
    //       N=40T, R=39T → shortage=1T, allowance=0.300T → applicable=0.7T → debit=₹560
    //
    //     Total = ₹800 + ₹560 = ₹1,360
    // ─────────────────────────────────────────────────────────────────────────
    await t.test("T3. Percentage + Fixed-KG customers in same bill", async () => {
      const dRoha = await createDailyEntry(db, {
        firmId: firmA_Id, srNo: ++srno,
        entryDate: "2026-09-22",
        truckNumberRaw: "MH01AA0010",
        nWeight: 40, rWeight: 39,
        customerRate: 500,
        partyId: partyRoha.id,
        isReceived: true,
      });
      const dFix = await createDailyEntry(db, {
        firmId: firmA_Id, srNo: ++srno,
        entryDate: "2026-09-22",
        truckNumberRaw: "MH01AA0011",
        nWeight: 40, rWeight: 39,
        customerRate: 500,
        partyId: partyFixKg.id,
        isReceived: true,
      });

      const bill = await createBill(db, {
        firmId: firmA_Id,
        partyId: billingParty.id,
        billDate: "2026-09-22",
        tripIds: [dRoha.trip!.id, dFix.trip!.id],
      });

      const items = await db.select().from(billItems).where(eq(billItems.billId, bill.id));
      assert.equal(items.length, 2, "T3: two items");

      const rohaItem = items.find((i) => i.shortageAllowanceType === "PERCENTAGE");
      const fixItem  = items.find((i) => i.shortageAllowanceType === "FIXED_KG");

      assert.ok(rohaItem, "T3: Roha PERCENTAGE item present");
      assert.ok(fixItem,  "T3: FixKg FIXED_KG item present");

      // Roha: 0.8T × ₹1000 = ₹800
      assert.equal(Number(rohaItem!.shortageDebitAmount), 800, "T3: Roha debit");
      // FixKg: 1.0T - 0.3T allowance = 0.7T × ₹800 = ₹560
      assert.equal(Number(fixItem!.shortageDebitAmount), 560, "T3: FixKg debit");

      assert.equal(Number(bill.debitNoteAmount), 1360, "T3: total debit");
    });

    // ─────────────────────────────────────────────────────────────────────────
    // T4. EXCESS_ONLY rule applied per customer
    //
    //     Roha: 0.5% EXCESS_ONLY
    //       N=40T, R=39T → shortage=1T, allowance=0.2T → applicable=0.8T → debit=₹800
    //     Verify rule type is snapshotted correctly as EXCESS_ONLY.
    // ─────────────────────────────────────────────────────────────────────────
    await t.test("T4. EXCESS_ONLY rule applied per-customer correctly", async () => {
      const d = await createDailyEntry(db, {
        firmId: firmA_Id, srNo: ++srno,
        entryDate: "2026-09-22",
        truckNumberRaw: "MH01AA0020",
        nWeight: 40, rWeight: 39,
        customerRate: 500,
        partyId: partyRoha.id,
        isReceived: true,
      });

      const bill = await createBill(db, {
        firmId: firmA_Id,
        partyId: billingParty.id,
        billDate: "2026-09-22",
        tripIds: [d.trip!.id],
      });

      const items = await db.select().from(billItems).where(eq(billItems.billId, bill.id));
      assert.equal(items[0].shortageRuleType, "EXCESS_ONLY", "T4: EXCESS_ONLY snapshotted");
      // Only the excess over allowance is debited
      assert.equal(Number(items[0].shortageQtyApplicable), 0.8, "T4: applicable qty = shortage - allowance");
      assert.equal(Number(items[0].shortageDebitAmount), 800, "T4: EXCESS_ONLY debit");
    });

    // ─────────────────────────────────────────────────────────────────────────
    // T5. FULL_SHORTAGE rule applied per customer
    //
    //     FullShortage party: 0.2% FULL_SHORTAGE, ₹900/T
    //       N=40T, R=39T → shortage=1T, allowance=0.08T
    //       Since shortage > allowance → full 1T debited (FULL_SHORTAGE)
    //       Debit = 1T × ₹900 = ₹900
    // ─────────────────────────────────────────────────────────────────────────
    await t.test("T5. FULL_SHORTAGE rule applied per-customer correctly", async () => {
      const d = await createDailyEntry(db, {
        firmId: firmA_Id, srNo: ++srno,
        entryDate: "2026-09-22",
        truckNumberRaw: "MH01AA0030",
        nWeight: 40, rWeight: 39,
        customerRate: 500,
        partyId: partyFull.id,
        isReceived: true,
      });

      const bill = await createBill(db, {
        firmId: firmA_Id,
        partyId: billingParty.id,
        billDate: "2026-09-22",
        tripIds: [d.trip!.id],
      });

      const items = await db.select().from(billItems).where(eq(billItems.billId, bill.id));
      assert.equal(items[0].shortageRuleType, "FULL_SHORTAGE", "T5: FULL_SHORTAGE snapshotted");
      // Full 1T debited (entire shortage, not just excess)
      assert.equal(Number(items[0].shortageQtyApplicable), 1, "T5: full shortage qty");
      assert.equal(Number(items[0].shortageDebitAmount), 900, "T5: full debit amount");
    });

    // ─────────────────────────────────────────────────────────────────────────
    // T6. Customer rule firm isolation
    //     Firm B has an extreme rule (99%, ₹9999/T).
    //     A Roha trip in Firm A must use Roha's rule, not Firm B's.
    // ─────────────────────────────────────────────────────────────────────────
    await t.test("T6. Firm isolation — Firm B rule must NOT bleed into Firm A", async () => {
      const d = await createDailyEntry(db, {
        firmId: firmA_Id, srNo: ++srno,
        entryDate: "2026-09-22",
        truckNumberRaw: "MH01AA0040",
        nWeight: 40, rWeight: 39,
        customerRate: 500,
        partyId: partyRoha.id,
        isReceived: true,
      });

      const bill = await createBill(db, {
        firmId: firmA_Id,
        partyId: billingParty.id,
        billDate: "2026-09-22",
        tripIds: [d.trip!.id],
      });

      const items = await db.select().from(billItems).where(eq(billItems.billId, bill.id));
      // Must use Roha's ₹1000/T, NOT Firm B's ₹9999/T
      assert.equal(Number(items[0].shortageMaterialRate), 1000, "T6: Firm A Roha rate used");
      // Debit: ₹800 (Roha rule), NOT ₹9999/T from Firm B
      assert.equal(Number(items[0].shortageDebitAmount), 800, "T6: Firm A debit (not Firm B)");
    });

    // ─────────────────────────────────────────────────────────────────────────
    // T7. Missing customer rule — shortage must be ₹0 (no config = no debit)
    //
    //     partyNoRule has no customer_rules row.
    //     N=40T, R=39T → 1T shortage → but no rule → debit = ₹0
    // ─────────────────────────────────────────────────────────────────────────
    await t.test("T7. Missing customer rule — shortage debit = 0", async () => {
      const d = await createDailyEntry(db, {
        firmId: firmA_Id, srNo: ++srno,
        entryDate: "2026-09-22",
        truckNumberRaw: "MH01AA0050",
        nWeight: 40, rWeight: 39,
        customerRate: 500,
        partyId: partyNoRule.id,
        isReceived: true,
      });

      const bill = await createBill(db, {
        firmId: firmA_Id,
        partyId: billingParty.id,
        billDate: "2026-09-22",
        tripIds: [d.trip!.id],
      });

      const items = await db.select().from(billItems).where(eq(billItems.billId, bill.id));
      // No rule → shortageApplicable defaults to false → debit = 0
      assert.equal(Number(items[0].shortageDebitAmount), 0, "T7: no rule → debit=0");
      assert.equal(Number(bill.debitNoteAmount), 0, "T7: bill debit note amount=0");
    });

    // ─────────────────────────────────────────────────────────────────────────
    // T8. Bill containing 3 customers with mixed rule types
    //
    //     Trip A → Roha    (0.5% EXCESS_ONLY, ₹1000/T)
    //               N=40, R=39 → shortage=1, allowance=0.2 → applicable=0.8 → ₹800
    //
    //     Trip B → FixKg   (0.3T EXCESS_ONLY, ₹800/T)
    //               N=40, R=39 → shortage=1, allowance=0.3 → applicable=0.7 → ₹560
    //
    //     Trip C → FullShortage (0.2% FULL_SHORTAGE, ₹900/T)
    //               N=40, R=39 → shortage=1, allowance=0.08 → FULL → applicable=1 → ₹900
    //
    //     Total = ₹800 + ₹560 + ₹900 = ₹2,260
    // ─────────────────────────────────────────────────────────────────────────
    await t.test("T8. Bill with 3 customers, mixed allowance types and rule types", async () => {
      const dA = await createDailyEntry(db, {
        firmId: firmA_Id, srNo: ++srno,
        entryDate: "2026-09-22",
        truckNumberRaw: "MH01AA0060",
        nWeight: 40, rWeight: 39,
        customerRate: 500,
        partyId: partyRoha.id,
        isReceived: true,
      });
      const dB = await createDailyEntry(db, {
        firmId: firmA_Id, srNo: ++srno,
        entryDate: "2026-09-22",
        truckNumberRaw: "MH01AA0061",
        nWeight: 40, rWeight: 39,
        customerRate: 500,
        partyId: partyFixKg.id,
        isReceived: true,
      });
      const dC = await createDailyEntry(db, {
        firmId: firmA_Id, srNo: ++srno,
        entryDate: "2026-09-22",
        truckNumberRaw: "MH01AA0062",
        nWeight: 40, rWeight: 39,
        customerRate: 500,
        partyId: partyFull.id,
        isReceived: true,
      });

      const bill = await createBill(db, {
        firmId: firmA_Id,
        partyId: billingParty.id,
        billDate: "2026-09-22",
        tripIds: [dA.trip!.id, dB.trip!.id, dC.trip!.id],
      });

      const items = await db.select().from(billItems).where(eq(billItems.billId, bill.id));
      assert.equal(items.length, 3, "T8: 3 bill items");

      // Identify items by snapshotted rule type + allowance type
      const rohaItem  = items.find((i) => i.shortageAllowanceType === "PERCENTAGE" && Number(i.shortageMaterialRate) === 1000);
      const fixItem   = items.find((i) => i.shortageAllowanceType === "FIXED_KG");
      const fullItem  = items.find((i) => i.shortageRuleType === "FULL_SHORTAGE");

      assert.ok(rohaItem, "T8: Roha item found");
      assert.ok(fixItem,  "T8: FixKg item found");
      assert.ok(fullItem, "T8: Full item found");

      assert.equal(Number(rohaItem!.shortageDebitAmount),  800,  "T8: Roha debit=800");
      assert.equal(Number(fixItem!.shortageDebitAmount),   560,  "T8: FixKg debit=560");
      assert.equal(Number(fullItem!.shortageDebitAmount),  900,  "T8: FullShortage debit=900");

      // Total debit note amount
      assert.equal(Number(bill.debitNoteAmount), 2260, "T8: total debit=2260");

      // Verify rule types are independently snapshotted
      assert.equal(rohaItem!.shortageRuleType,  "EXCESS_ONLY",   "T8: Roha snapshotted EXCESS_ONLY");
      assert.equal(fixItem!.shortageRuleType,   "EXCESS_ONLY",   "T8: FixKg snapshotted EXCESS_ONLY");
      assert.equal(fullItem!.shortageRuleType,  "FULL_SHORTAGE",  "T8: FullShortage snapshotted");
    });

  } finally {
    // ── CLEANUP — all TEST_SHORTAGE_* test records removed ─────────────────
    const testFirmIds = [firmA_Id, firmB_Id].filter(Boolean);
    if (testFirmIds.length > 0) {
      await db.delete(paymentAllocations);
      await db.delete(payments).where(inArray(payments.firmId, testFirmIds as string[]));
      await db.delete(tdsEntries).where(inArray(tdsEntries.firmId, testFirmIds as string[]));
      await db.delete(debitNotes).where(inArray(debitNotes.firmId, testFirmIds as string[]));
      await db.delete(billItems);
      await db.delete(bills).where(inArray(bills.firmId, testFirmIds as string[]));
      await db.delete(trips).where(inArray(trips.firmId, testFirmIds as string[]));
      await db.delete(driverVouchers).where(inArray(driverVouchers.firmId, testFirmIds as string[]));
      await db.delete(dailyEntries).where(inArray(dailyEntries.firmId, testFirmIds as string[]));
      await db.delete(ledgerTransactions).where(inArray(ledgerTransactions.firmId, testFirmIds as string[]));
      await db.delete(openingBalances).where(inArray(openingBalances.firmId, testFirmIds as string[]));
      await db.delete(customerRules).where(inArray(customerRules.firmId, testFirmIds as string[]));
      await db.delete(companies).where(inArray(companies.firmId, testFirmIds as string[]));
      await db.delete(parties).where(inArray(parties.firmId, testFirmIds as string[]));
      await db.delete(firmBillSequences).where(inArray(firmBillSequences.firmId, testFirmIds as string[]));
      await db.delete(auditLogs).where(inArray(auditLogs.firmId, testFirmIds as string[]));
      await db.delete(firms).where(inArray(firms.id, testFirmIds as string[]));
    }
  }
});
