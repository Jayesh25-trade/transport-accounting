import { WeightMath, MoneyMath, RateMath } from "../lib/decimal";
import { DomainValidationError } from "../lib/errors";

export type FreightBasis = "R_WEIGHT" | "N_WEIGHT" | "FIXED";

export interface FreightCalculationInput {
  freightBasis: FreightBasis;
  rate: number | string;
  nWeight?: number | string | null;
  rWeight?: number | string | null;
  fixedFreightAmount?: number | string | null;
}

export interface FreightCalculationResult {
  billedWeight: number;    // Weight used for freight calculation (0 for FIXED)
  rateApplied: number;     // Rate applied per ton
  freightAmount: number;   // Calculated gross freight amount (in ₹)
}

/**
 * Pure domain abstraction for Freight Calculation.
 * Supports configurable basis per party/trip:
 *   - R_WEIGHT: Billed Freight = R-Weight × Rate
 *   - N_WEIGHT: Billed Freight = N-Weight × Rate
 *   - FIXED: Billed Freight = Fixed Amount
 */
export function calculateFreight(input: FreightCalculationInput): FreightCalculationResult {
  const rateApplied = RateMath.round(input.rate ?? 0);
  const nWeight = WeightMath.round(input.nWeight ?? 0);
  const rWeight = WeightMath.round(input.rWeight ?? 0);

  if (rateApplied < 0) {
    throw new DomainValidationError("Freight rate cannot be negative");
  }

  switch (input.freightBasis) {
    case "R_WEIGHT": {
      const billedWeight = rWeight;
      const freightAmount = MoneyMath.multiply(billedWeight, rateApplied);
      return { billedWeight, rateApplied, freightAmount };
    }
    case "N_WEIGHT": {
      const billedWeight = nWeight;
      const freightAmount = MoneyMath.multiply(billedWeight, rateApplied);
      return { billedWeight, rateApplied, freightAmount };
    }
    case "FIXED": {
      const fixedAmount = MoneyMath.round(input.fixedFreightAmount ?? 0);
      return { billedWeight: 0, rateApplied, freightAmount: fixedAmount };
    }
    default:
      throw new DomainValidationError(`Unsupported freight basis '${input.freightBasis}'`);
  }
}
