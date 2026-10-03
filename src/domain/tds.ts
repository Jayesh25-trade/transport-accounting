import { MoneyMath, RateMath } from "../lib/decimal";
import { DomainValidationError } from "../lib/errors";

export interface TdscalculationInput {
  grossBillAmount: number | string;  // Amount After Shortage (Subtotal Freight - Shortage Debit)
  tdsApplicable: boolean;
  tdsPercentage?: number | string | null;
  tdsSection?: string | null;
}

export interface TdscalculationResult {
  tdsBaseAmount: number;     // Amount on which TDS is calculated (Amount After Shortage)
  tdsPercentage: number;     // Applied TDS percentage (e.g. 1.00%, 2.00%)
  tdsAmount: number;         // TDS Amount = TDS Base × (TDS% / 100)
  tdsSection: string;        // e.g. "94C"
}

/**
 * Pure domain utility for TDS calculation on Amount After Shortage.
 * Authoritative Business Rule:
 *   - Amount After Shortage = Gross Freight - Shortage Debit
 *   - TDS Base = Amount After Shortage
 *   - TDS Amount = TDS Base × (TDS Percentage / 100)
 *   - Configurable percentage per Party/Bill (e.g. 1%, 2%).
 */
export function calculateTds(input: TdscalculationInput): TdscalculationResult {
  const rawBaseAmount = MoneyMath.round(input.grossBillAmount ?? 0);
  const tdsBaseAmount = Math.max(0, rawBaseAmount);

  if (!input.tdsApplicable || tdsBaseAmount <= 0) {
    return {
      tdsBaseAmount,
      tdsPercentage: input.tdsApplicable ? RateMath.round(input.tdsPercentage ?? 0) : 0,
      tdsAmount: 0,
      tdsSection: input.tdsSection || "94C",
    };
  }

  const tdsPercentage = RateMath.round(input.tdsPercentage ?? 0);
  if (tdsPercentage < 0 || tdsPercentage > 100) {
    throw new DomainValidationError("TDS percentage must be between 0 and 100");
  }

  // Formula: TDS Base Amount × (TDS Percentage / 100)
  const tdsAmount = MoneyMath.round((tdsBaseAmount * tdsPercentage) / 100);

  return {
    tdsBaseAmount,
    tdsPercentage,
    tdsAmount,
    tdsSection: input.tdsSection || "94C",
  };
}
