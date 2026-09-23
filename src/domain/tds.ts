import { MoneyMath, RateMath } from "../lib/decimal";
import { DomainValidationError } from "../lib/errors";

export interface TdscalculationInput {
  grossBillAmount: number | string;  // Subtotal Freight (before TDS deduction)
  tdsApplicable: boolean;
  tdsPercentage?: number | string | null;
  tdsSection?: string | null;
}

export interface TdscalculationResult {
  tdsBaseAmount: number;     // Amount on which TDS is calculated (Gross Bill Subtotal)
  tdsPercentage: number;     // Applied TDS percentage (e.g. 1.00%)
  tdsAmount: number;         // TDS Amount = Gross × (TDS% / 100)
  tdsSection: string;        // e.g. "94C"
}

/**
 * Pure domain utility for TDS calculation on Gross Bill Subtotal.
 * Enforces Rule 6:
 *   - TDS Amount = Gross Subtotal Freight × (TDS Percentage / 100)
 *   - Configurable percentage per Party/Bill (e.g. 1%, 2%).
 */
export function calculateTds(input: TdscalculationInput): TdscalculationResult {
  const grossBillAmount = MoneyMath.round(input.grossBillAmount ?? 0);

  if (grossBillAmount < 0) {
    throw new DomainValidationError("Gross bill amount cannot be negative for TDS calculation");
  }

  if (!input.tdsApplicable) {
    return {
      tdsBaseAmount: grossBillAmount,
      tdsPercentage: 0,
      tdsAmount: 0,
      tdsSection: input.tdsSection || "",
    };
  }

  const tdsPercentage = RateMath.round(input.tdsPercentage ?? 0);
  if (tdsPercentage < 0 || tdsPercentage > 100) {
    throw new DomainValidationError("TDS percentage must be between 0 and 100");
  }

  // Formula: Gross Bill Amount × (TDS Percentage / 100)
  const tdsAmount = MoneyMath.round((grossBillAmount * tdsPercentage) / 100);

  return {
    tdsBaseAmount: grossBillAmount,
    tdsPercentage,
    tdsAmount,
    tdsSection: input.tdsSection || "94C",
  };
}
