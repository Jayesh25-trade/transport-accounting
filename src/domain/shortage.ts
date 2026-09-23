import { WeightMath, MoneyMath, RateMath, roundToScale } from "../lib/decimal";
import { DomainValidationError } from "../lib/errors";

export type ShortageAllowanceType = "PERCENTAGE" | "FIXED_KG";
export type ShortageRuleType = "EXCESS_ONLY" | "FULL_SHORTAGE";

export interface ShortageCalculationInput {
  nWeight: number | string;
  rWeight: number | string;
  shortageApplicable: boolean;
  allowanceType?: ShortageAllowanceType | null;
  allowanceValue?: number | string | null;
  shortageRuleType?: ShortageRuleType | null;
  materialRatePerTon?: number | string | null;
}

export interface ShortageCalculationResult {
  rawShortageQty: number;          // N-Weight - R-Weight (min 0)
  allowanceQty: number;            // Calculated allowance threshold in Tons
  applicableShortageQty: number;   // Quantity eligible for debit
  shortageDebitAmount: number;     // applicableShortageQty * materialRatePerTon (in ₹)
}

/**
 * Pure domain utility for Shortage calculation.
 * Enforces Rule 4:
 *   - Shortage Quantity = N-Weight - R-Weight
 *   - EXCESS_ONLY: Debits only the portion exceeding the allowance threshold.
 *   - FULL_SHORTAGE: Debits the entire shortage quantity if the threshold is breached.
 *   - Shortage debit valuation uses MATERIAL RATE (NOT Freight Rate).
 */
export function calculateShortage(input: ShortageCalculationInput): ShortageCalculationResult {
  const nWeight = WeightMath.round(input.nWeight ?? 0);
  const rWeight = WeightMath.round(input.rWeight ?? 0);

  if (nWeight < 0 || rWeight < 0) {
    throw new DomainValidationError("Weights cannot be negative");
  }

  // Raw shortage quantity
  const rawShortageQty = Math.max(0, WeightMath.subtract(nWeight, rWeight));

  if (!input.shortageApplicable || rawShortageQty <= 0) {
    return {
      rawShortageQty,
      allowanceQty: 0,
      applicableShortageQty: 0,
      shortageDebitAmount: 0,
    };
  }

  const allowanceVal = roundToScale(input.allowanceValue ?? 0, 4);
  let allowanceQty = 0;

  if (input.allowanceType === "PERCENTAGE") {
    allowanceQty = WeightMath.round((nWeight * allowanceVal) / 100);
  } else if (input.allowanceType === "FIXED_KG") {
    // Allowance value is provided in MT (e.g. 0.500 MT = 500 KG)
    allowanceQty = WeightMath.round(allowanceVal);
  }

  let applicableShortageQty = 0;

  if (rawShortageQty > allowanceQty) {
    if (input.shortageRuleType === "EXCESS_ONLY") {
      applicableShortageQty = WeightMath.subtract(rawShortageQty, allowanceQty);
    } else if (input.shortageRuleType === "FULL_SHORTAGE") {
      applicableShortageQty = rawShortageQty;
    } else {
      // Default to EXCESS_ONLY if unconfigured
      applicableShortageQty = WeightMath.subtract(rawShortageQty, allowanceQty);
    }
  }

  const materialRate = RateMath.round(input.materialRatePerTon ?? 0);
  const shortageDebitAmount = MoneyMath.multiply(applicableShortageQty, materialRate);

  return {
    rawShortageQty,
    allowanceQty,
    applicableShortageQty,
    shortageDebitAmount,
  };
}
