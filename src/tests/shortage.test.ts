import test from "node:test";
import assert from "node:assert/strict";
import { calculateShortage } from "../domain/shortage";

test("Rule 4D: Shortage Excess-Only Calculation", () => {
  // N = 40T, R = 38T, raw shortage = 2T
  // allowance = 0.5T, material rate = ₹500/T
  // Expected debit qty: 2 - 0.5 = 1.5T
  // Expected debit amount: 1.5 * 500 = ₹750
  const result = calculateShortage({
    nWeight: 40,
    rWeight: 38,
    shortageApplicable: true,
    allowanceType: "FIXED_KG",
    allowanceValue: 0.5,
    shortageRuleType: "EXCESS_ONLY",
    materialRatePerTon: 500,
  });

  assert.equal(result.rawShortageQty, 2.0);
  assert.equal(result.allowanceQty, 0.5);
  assert.equal(result.applicableShortageQty, 1.5);
  assert.equal(result.shortageDebitAmount, 750.0);
});

test("Rule 4E: Shortage Full-Shortage Calculation", () => {
  // N = 40T, R = 38T, raw shortage = 2T
  // allowance = 0.5T, material rate = ₹500/T
  // Because 2T > 0.5T allowance, entire 2T is debited.
  // Expected debit amount: 2 * 500 = ₹1,000
  const result = calculateShortage({
    nWeight: 40,
    rWeight: 38,
    shortageApplicable: true,
    allowanceType: "FIXED_KG",
    allowanceValue: 0.5,
    shortageRuleType: "FULL_SHORTAGE",
    materialRatePerTon: 500,
  });

  assert.equal(result.rawShortageQty, 2.0);
  assert.equal(result.allowanceQty, 0.5);
  assert.equal(result.applicableShortageQty, 2.0);
  assert.equal(result.shortageDebitAmount, 1000.0);
});

test("Shortage: No shortage when R-Weight >= N-Weight", () => {
  const result = calculateShortage({
    nWeight: 40,
    rWeight: 40.5,
    shortageApplicable: true,
    allowanceType: "FIXED_KG",
    allowanceValue: 0.5,
    shortageRuleType: "EXCESS_ONLY",
    materialRatePerTon: 500,
  });

  assert.equal(result.rawShortageQty, 0);
  assert.equal(result.applicableShortageQty, 0);
  assert.equal(result.shortageDebitAmount, 0);
});
