import test from "node:test";
import assert from "node:assert/strict";
import { calculateTds } from "../domain/tds";

test("Authoritative Rule 7: TDS Calculation on Amount After Shortage", () => {
  // Gross Freight = ₹120,000, Shortage = ₹5,000 -> Amount After Shortage = ₹115,000
  // TDS percentage = 1%
  // Expected TDS amount = ₹1,150
  const result = calculateTds({
    grossBillAmount: 115000, // Amount After Shortage (TDS Base)
    tdsApplicable: true,
    tdsPercentage: 1.0,
    tdsSection: "94C",
  });

  assert.equal(result.tdsBaseAmount, 115000);
  assert.equal(result.tdsPercentage, 1.0);
  assert.equal(result.tdsAmount, 1150);
  assert.equal(result.tdsSection, "94C");
});

test("TDS: Zero TDS when not applicable", () => {
  const result = calculateTds({
    grossBillAmount: 115000,
    tdsApplicable: false,
    tdsPercentage: 1.0,
  });

  assert.equal(result.tdsAmount, 0);
});

test("TDS: Zero TDS when Amount After Shortage is zero or negative", () => {
  const result = calculateTds({
    grossBillAmount: -1300,
    tdsApplicable: true,
    tdsPercentage: 2.0,
  });

  assert.equal(result.tdsBaseAmount, 0);
  assert.equal(result.tdsAmount, 0);
});

