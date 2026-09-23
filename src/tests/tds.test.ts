import test from "node:test";
import assert from "node:assert/strict";
import { calculateTds } from "../domain/tds";

test("Rule 6F: TDS Calculation on Gross Bill Amount", () => {
  // Gross bill subtotal = ₹100,000
  // TDS percentage = 1%
  // Expected TDS amount = ₹1,000
  const result = calculateTds({
    grossBillAmount: 100000,
    tdsApplicable: true,
    tdsPercentage: 1.0,
    tdsSection: "94C",
  });

  assert.equal(result.tdsBaseAmount, 100000);
  assert.equal(result.tdsPercentage, 1.0);
  assert.equal(result.tdsAmount, 1000);
  assert.equal(result.tdsSection, "94C");
});

test("TDS: Zero TDS when not applicable", () => {
  const result = calculateTds({
    grossBillAmount: 100000,
    tdsApplicable: false,
    tdsPercentage: 1.0,
  });

  assert.equal(result.tdsAmount, 0);
});
