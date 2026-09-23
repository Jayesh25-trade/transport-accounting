import test from "node:test";
import assert from "node:assert/strict";
import { validateBillEdit, calculateBillTotals } from "../domain/bill";
import { BillEditValidationError } from "../lib/errors";

test("Rule 8H: Bill Edit Validation - Rejects edit when new net amount is lower than received amount", () => {
  const existingReceived = 5000;
  const newNet = 4000;

  assert.throws(
    () => validateBillEdit(existingReceived, newNet),
    BillEditValidationError
  );
});

test("Rule 8H: Bill Edit Validation - Allows edit when new net amount >= received amount", () => {
  const existingReceived = 5000;
  const newNet = 6000;

  assert.doesNotThrow(() => validateBillEdit(existingReceived, newNet));
});

test("Bill Totals Calculation - Subtotal, TDS, Debit Note, Net Bill, Pending", () => {
  const totals = calculateBillTotals({
    items: [
      { freight: 50000, shortageDebitAmount: 1000, nWeight: 20, rWeight: 19.5 },
      { freight: 50000, shortageDebitAmount: 0, nWeight: 20, rWeight: 20 },
    ],
    tdsAmount: 1000,
    debitNoteAmount: 1000,
    receivedAmount: 20000,
  });

  assert.equal(totals.subtotalFreight, 100000);
  assert.equal(totals.tdsAmount, 1000);
  assert.equal(totals.debitNoteAmount, 1000);
  assert.equal(totals.netBillAmount, 98000); // 100000 - 1000 - 1000
  assert.equal(totals.receivedAmount, 20000);
  assert.equal(totals.pendingAmount, 78000);  // 98000 - 20000
});
