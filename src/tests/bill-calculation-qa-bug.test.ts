import test from "node:test";
import assert from "node:assert/strict";
import { calculateFreight } from "../domain/freight";
import { calculateShortage } from "../domain/shortage";
import { calculateTds } from "../domain/tds";
import { calculateBillTotals } from "../domain/bill";

test("Part 1: Controlled Manual-QA Billing Calculation Verification", () => {
  // QA Demo Party 01 Scenario:
  // N-Weight = 30.000 T, R-Weight = 29.500 T
  // Customer Rate = ₹1,200
  // Freight Basis = FIXED PER TRIP
  // Shortage Rule = FULL_SHORTAGE
  // Allowance Type = FIXED_KG (300 KG)
  // Material Rate = ₹5,000/T
  // TDS Section = 94C, Rate = 2%

  const nWeight = 30.0;
  const rWeight = 29.5;
  const rateToUse = 1200;
  const freightBasis = "FIXED";

  // 1. Freight Calculation
  const freightRes = calculateFreight({
    freightBasis,
    rate: rateToUse,
    nWeight,
    rWeight,
    fixedFreightAmount: rateToUse,
  });

  assert.equal(freightRes.freightAmount, 1200, "Subtotal Freight must be ₹1,200 for FIXED PER TRIP");

  // 2. Shortage Calculation
  const shortageRes = calculateShortage({
    nWeight,
    rWeight,
    shortageApplicable: true,
    allowanceType: "FIXED_KG",
    allowanceValue: 300, // 300 KG
    shortageRuleType: "FULL_SHORTAGE",
    materialRatePerTon: 5000,
  });

  assert.equal(shortageRes.rawShortageQty, 0.5, "Raw shortage must be 0.500 T (500 KG)");
  assert.equal(shortageRes.allowanceQty, 0.3, "Allowance threshold must be 0.300 T (300 KG)");
  assert.equal(shortageRes.applicableShortageQty, 0.5, "Applicable shortage under FULL_SHORTAGE must be 0.500 T");
  assert.equal(shortageRes.shortageDebitAmount, 2500, "Shortage debit must be 0.500 T × ₹5,000 = ₹2,500");

  // 3. TDS Calculation on Amount After Shortage: Gross Freight (₹1,200) - Shortage Debit (₹2,500) = -₹1,300 -> TDS Base = 0
  const amountAfterShortage = Math.max(0, freightRes.freightAmount - shortageRes.shortageDebitAmount);
  const tdsRes = calculateTds({
    grossBillAmount: amountAfterShortage,
    tdsApplicable: true,
    tdsPercentage: 2,
    tdsSection: "94C",
  });

  assert.equal(tdsRes.tdsBaseAmount, 0, "TDS Base must be 0 when shortage exceeds freight");
  assert.equal(tdsRes.tdsAmount, 0, "TDS must be ₹0.00");

  // 4. Net Bill Totals: Gross Freight - Shortage Debit - TDS
  const totals = calculateBillTotals({
    items: [
      {
        nWeight,
        rWeight,
        freight: freightRes.freightAmount,
        shortageDebitAmount: shortageRes.shortageDebitAmount,
      },
    ],
    tdsAmount: tdsRes.tdsAmount,
    debitNoteAmount: shortageRes.shortageDebitAmount,
    receivedAmount: 0,
  });

  assert.equal(totals.subtotalFreight, 1200, "Subtotal freight must be 1200");
  assert.equal(totals.debitNoteAmount, 2500, "Debit note amount must be 2500");
  assert.equal(totals.tdsAmount, 0, "TDS amount must be 0");
  assert.equal(totals.netBillAmount, 0, "Net bill amount must be ₹0.00 when deductions exceed gross freight");
});
