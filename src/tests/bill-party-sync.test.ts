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
import { DomainValidationError } from "../lib/errors";
import { inArray, sql, eq } from "drizzle-orm";

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

test("Bill Party Synchronization & Mixed-Party Rejection Regression Test Suite", async (t) => {
  const PREFIX = `TEST_PARTYSYNC_${Date.now()}`;
  let firmId = "";

  try {
    await cleanTestFirms("TEST_PARTYSYNC_");

    const firm = await makeFirm(`${PREFIX}_F1`, "Firm Test Party Sync");
    firmId = firm.id;

    const partyA = await createParty(db, { firmId, name: "Party A (Customer A)" });
    const partyB = await createParty(db, { firmId, name: "Party B (Customer B)" });

    await upsertCustomerRule(db, {
      firmId,
      partyId: partyA.id,
      freightBasis: "AUTO_SHORTAGE_BASED",
      shortageApplicable: true,
      shortageAllowanceType: "FIXED_KG",
      shortageAllowanceValue: 0.1,
      shortageRuleType: "EXCESS_ONLY",
      tdsApplicable: true,
      tdsSection: "94C",
      tdsPercentage: 1.0,
    });

    await upsertCustomerRule(db, {
      firmId,
      partyId: partyB.id,
      freightBasis: "AUTO_SHORTAGE_BASED",
      shortageApplicable: true,
      shortageAllowanceType: "FIXED_KG",
      shortageAllowanceValue: 0.1,
      shortageRuleType: "EXCESS_ONLY",
      tdsApplicable: true,
      tdsSection: "94C",
      tdsPercentage: 1.0,
    });

    let srno = 800;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST A: Single-Party Synchronization (Trip Party = Party A, Input Party = Party B)
    // ─────────────────────────────────────────────────────────────────────────
    await t.test("TEST A: Bill party MUST match the party of the selected Daily Book trip", async () => {
      const entryA = await createDailyEntry(db, {
        firmId,
        srNo: ++srno,
        entryDate: "2026-10-02",
        truckNumberRaw: "MH04XY1001",
        nWeight: 40,
        rWeight: 39,
        customerRate: 4000,
        partyId: partyA.id, // Trip belongs to Party A
        isReceived: true,
      });

      // Even if frontend passed Party B ID, backend MUST use Party A ID!
      const bill = await createBill(db, {
        firmId,
        partyId: partyB.id, // Mismatched input party
        billDate: "2026-10-02",
        tripIds: [entryA.trip!.id],
      });

      assert.equal(bill.partyId, partyA.id, "Bill partyId must match trip's party (Party A)");

      // Check Debit Note
      const dNotes = await db.select().from(debitNotes).where(eq(debitNotes.billId, bill.id));
      if (dNotes.length > 0) {
        assert.equal(dNotes[0].partyId, partyA.id, "Debit Note partyId must match Party A");
      }

      // Check Ledger Transactions
      const ledgerTxns = await db.select().from(ledgerTransactions).where(eq(ledgerTransactions.sourceEntityId, bill.id));
      assert.ok(ledgerTxns.length > 0, "Ledger transactions created");
      for (const lt of ledgerTxns) {
        assert.equal(lt.partyId, partyA.id, `Ledger transaction ${lt.voucherType} must be posted to Party A`);
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST C: Mixed-Party Trip Selection Rejection
    // ─────────────────────────────────────────────────────────────────────────
    await t.test("TEST C: Bill creation must reject mixed-party trip selection", async () => {
      const entryA = await createDailyEntry(db, {
        firmId,
        srNo: ++srno,
        entryDate: "2026-10-02",
        truckNumberRaw: "MH04XY2001",
        nWeight: 40,
        rWeight: 39,
        customerRate: 4000,
        partyId: partyA.id,
        isReceived: true,
      });

      const entryB = await createDailyEntry(db, {
        firmId,
        srNo: ++srno,
        entryDate: "2026-10-02",
        truckNumberRaw: "MH04XY2002",
        nWeight: 30,
        rWeight: 29,
        customerRate: 4500,
        partyId: partyB.id,
        isReceived: true,
      });

      // Attempt creating a bill with trips from Party A and Party B -> Must throw DomainValidationError
      await assert.rejects(
        async () => {
          await createBill(db, {
            firmId,
            partyId: partyA.id,
            billDate: "2026-10-02",
            tripIds: [entryA.trip!.id, entryB.trip!.id],
          });
        },
        (err: any) => {
          assert.ok(err instanceof DomainValidationError, "Must throw DomainValidationError for mixed-party billing");
          assert.ok(
            err.message.includes("multiple billing parties"),
            "Error message must indicate mixed billing parties"
          );
          return true;
        }
      );
    });

  } finally {
    if (firmId) {
      await cleanTestFirms("TEST_PARTYSYNC_");
    }
  }
});
