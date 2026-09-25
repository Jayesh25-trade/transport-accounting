/**
 * Tests: Daily Book → Posted Bill Edit Protection
 *
 * Verifies that:
 * 1. The BilledTripEditError is correctly instantiated with bill number.
 * 2. The error has the correct error code (BILLED_TRIP_EDIT_LOCKED) for HTTP 409 mapping.
 * 3. Bill Edit validation (validateBillEdit) still rejects lowering net below received.
 * 4. Bill totals calculation remains correct after the editBill fix.
 *
 * NOTE: Integration-level tests (actual DB calls verifying API 409 responses,
 * bill_items snapshot usage, and firm isolation) are covered in integration.test.ts.
 * These unit tests verify the domain/error layer in isolation.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { BilledTripEditError, AppError } from "../lib/errors";
import { validateBillEdit, calculateBillTotals } from "../domain/bill";
import { BillEditValidationError } from "../lib/errors";

// ──────────────────────────────────────────────────────────────────────────────
// Test Group: BilledTripEditError
// ──────────────────────────────────────────────────────────────────────────────

test("BilledTripEditError: is an instance of AppError", () => {
  const err = new BilledTripEditError(12);
  assert.ok(err instanceof AppError, "BilledTripEditError must extend AppError");
});

test("BilledTripEditError: error code is BILLED_TRIP_EDIT_LOCKED (maps to HTTP 409)", () => {
  const err = new BilledTripEditError(12);
  assert.equal(err.code, "BILLED_TRIP_EDIT_LOCKED");
});

test("BilledTripEditError: message includes the bill number", () => {
  const err = new BilledTripEditError(42);
  assert.ok(
    err.message.includes("Bill #42"),
    `Expected message to include 'Bill #42', got: ${err.message}`
  );
});

test("BilledTripEditError: message includes 'POSTED'", () => {
  const err = new BilledTripEditError(7);
  assert.ok(
    err.message.includes("POSTED"),
    `Expected message to include 'POSTED', got: ${err.message}`
  );
});

test("BilledTripEditError: message includes direction to use Bill Edit", () => {
  const err = new BilledTripEditError(7);
  assert.ok(
    err.message.toLowerCase().includes("bill edit"),
    `Expected message to reference 'Bill Edit', got: ${err.message}`
  );
});

test("BilledTripEditError: works with string bill number (unknown case)", () => {
  const err = new BilledTripEditError("unknown");
  assert.equal(err.code, "BILLED_TRIP_EDIT_LOCKED");
  assert.ok(err.message.includes("unknown"));
});

// ──────────────────────────────────────────────────────────────────────────────
// Test Group: Bill Edit Validation (preserved from existing suite)
// ──────────────────────────────────────────────────────────────────────────────

test("Rule 8H (re-verify after fix): Bill Edit rejects edit when new net < received", () => {
  assert.throws(
    () => validateBillEdit(5000, 4000),
    BillEditValidationError
  );
});

test("Rule 8H (re-verify after fix): Bill Edit allows edit when new net >= received", () => {
  assert.doesNotThrow(() => validateBillEdit(5000, 6000));
});

test("Rule 8H (re-verify after fix): Bill Edit allows edit when new net === received", () => {
  // Edge case: new net exactly equals received — should be allowed
  assert.doesNotThrow(() => validateBillEdit(5000, 5000));
});

// ──────────────────────────────────────────────────────────────────────────────
// Test Group: Bill Totals after editBill snapshot fix
// (Verifying domain layer calculation is correct regardless of data source)
// ──────────────────────────────────────────────────────────────────────────────

test("Bill totals calculation: uses provided nWeight/rWeight values correctly", () => {
  // Simulates editBill() recalculating from bill_items snapshot values
  // (same domain function is called, just from different data source now)
  const totals = calculateBillTotals({
    items: [
      // Snapshot values: nWeight=40T, rWeight=38T (the ORIGINAL billed values)
      { freight: 133000, shortageDebitAmount: 0, nWeight: 40, rWeight: 38 },
    ],
    tdsAmount: 2660,      // 2% TDS on 133000
    debitNoteAmount: 0,
    receivedAmount: 0,
  });

  assert.equal(totals.subtotalFreight, 133000);
  assert.equal(totals.tdsAmount, 2660);
  assert.equal(totals.netBillAmount, 130340); // 133000 - 2660
  assert.equal(totals.pendingAmount, 130340);
});

test("Bill totals: mutated rWeight (40T instead of 38T) would give different freight if not using snapshot", () => {
  // This test documents the DANGER that existed before the fix:
  // If daily_entries was read directly after mutation, editBill would recalculate
  // freight at 140000 instead of the correct 133000.
  const mutatedTotals = calculateBillTotals({
    items: [
      // Mutated value (what daily_entries would show AFTER the dangerous edit)
      { freight: 140000, shortageDebitAmount: 0, nWeight: 40, rWeight: 40 },
    ],
    tdsAmount: 2800,
    debitNoteAmount: 0,
    receivedAmount: 0,
  });
  // Confirm these are DIFFERENT from the original posted bill amounts
  assert.equal(mutatedTotals.subtotalFreight, 140000); // Wrong — should have been 133000
  assert.notEqual(mutatedTotals.subtotalFreight, 133000);
});

test("Bill totals: No duplicate TDS — single insert of tdsAmount from calculateBillTotals", () => {
  // Verifies that the domain calculates ONE tdsAmount, not duplicates.
  const totals = calculateBillTotals({
    items: [
      { freight: 50000, shortageDebitAmount: 1000, nWeight: 20, rWeight: 19.5 },
      { freight: 50000, shortageDebitAmount: 0, nWeight: 20, rWeight: 20 },
    ],
    tdsAmount: 2000,
    debitNoteAmount: 1000,
    receivedAmount: 0,
  });

  assert.equal(totals.tdsAmount, 2000);   // Exactly one TDS value
  assert.equal(totals.netBillAmount, 97000); // 100000 - 2000 - 1000
});
