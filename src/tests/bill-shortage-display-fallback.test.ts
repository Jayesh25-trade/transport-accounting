import assert from "node:assert/strict";
import test from "node:test";
import { generateBillInvoiceHtml } from "../lib/pdf-bill-template";

test("Bill SHORT column & row balance reconciliation tests", async (t) => {
  await t.test("SHORT column shows YES when shortageDebitAmount > 0 and NO when 0", () => {
    const mockBill = {
      billNumber: 1,
      billDate: "2026-10-02",
      partyName: "QA Final Test Customer",
      subtotalFreight: 195200,
      debitNoteAmount: 700,
      netBillAmount: 184310,
      items: [
        {
          entryDate: "2026-10-02",
          truckNumber: "MH04AB1234",
          lrNumber: "LR-100",
          fromLocation: "QA FINAL ORIGIN",
          toLocation: "QA FINAL DESTINATION",
          nWeight: 25.0,
          rWeight: 24.8,
          rate: 4000,
          freight: 99200,
          shortageDebitAmount: 0,
        },
        {
          entryDate: "2026-10-02",
          truckNumber: "MH04AB1234",
          lrNumber: "LR-200",
          fromLocation: "QA FINAL ORIGIN",
          toLocation: "QA FINAL DESTINATION",
          nWeight: 25.0,
          rWeight: 24.0,
          rate: 4000,
          freight: 96000,
          shortageDebitAmount: 700,
        },
      ],
    };

    const html = generateBillInvoiceHtml(mockBill, { name: "DEEPRAJ TRANSPORT" });

    // Assert SHORT column values
    assert.match(html, /<td class="col-short cell-num">NO<\/td>/);
    assert.match(html, /<td class="col-short cell-num">YES<\/td>/);
    assert.doesNotMatch(html, /<td class="col-short cell-num">—<\/td>/);

    // Assert row balances: Trip 1 = 99,200.00, Trip 2 = 95,300.00
    assert.match(html, /<td class="col-bal cell-num bold">99,200\.00<\/td>/);
    assert.match(html, /<td class="col-bal cell-num bold">95,300\.00<\/td>/);
    assert.match(html, /<td class="col-bal cell-num bold">1,94,500\.00<\/td>/);
  });

  await t.test("Row math reconciles: SUM(freight) - SUM(shortage) = SUM(balance)", () => {
    const items = [
      { freight: 100000, shortageDebitAmount: 500 },
      { freight: 80000, shortageDebitAmount: 0 },
      { freight: 60000, shortageDebitAmount: 1200 },
    ];

    const sumFreight = items.reduce((sum, i) => sum + i.freight, 0);
    const sumShortage = items.reduce((sum, i) => sum + i.shortageDebitAmount, 0);
    const rowBalances = items.map((i) => i.freight - i.shortageDebitAmount);
    const sumBalances = rowBalances.reduce((sum, b) => sum + b, 0);

    assert.equal(sumFreight, 240000);
    assert.equal(sumShortage, 1700);
    assert.equal(sumBalances, 238300);
    assert.equal(sumFreight - sumShortage, sumBalances);
  });
});
