import { MoneyMath } from "../lib/decimal";
import { PaymentAllocationError, DomainValidationError } from "../lib/errors";

export type PaymentType = "AGAINST_BILL" | "ADVANCE";
export type PaymentMode = "CASH" | "BANK_AC" | "CHEQUE" | "UTR" | "NEFT" | "RTGS" | "UPI" | "OTHER";

export interface ValidatePaymentAllocationInput {
  netBillAmount: number | string;
  alreadyAllocatedAmount: number | string; // Total allocated across all existing payment_allocations for this bill
  requestedAllocationAmount: number | string;
  paymentUnallocatedAmount: number | string;
}

export interface ValidatePaymentAllocationResult {
  allowedAllocationAmount: number;
  newBillAllocatedTotal: number;
  newBillPendingAmount: number;
  newPaymentUnallocatedAmount: number;
  isFullyAllocated: boolean;
}

/**
 * Pure domain utility to validate and calculate payment allocations.
 * Enforces Rule 9:
 *   - Prevents over-allocation: total allocations for a bill cannot exceed net_bill_amount.
 *   - Prevents allocating more than available payment unallocated_amount.
 */
export function validatePaymentAllocation(
  input: ValidatePaymentAllocationInput
): ValidatePaymentAllocationResult {
  const netBillAmount = MoneyMath.round(input.netBillAmount);
  const alreadyAllocated = MoneyMath.round(input.alreadyAllocatedAmount);
  const requested = MoneyMath.round(input.requestedAllocationAmount);
  const paymentUnallocated = MoneyMath.round(input.paymentUnallocatedAmount);

  if (requested <= 0) {
    throw new DomainValidationError("Allocation amount must be greater than 0");
  }

  // Maximum allocation allowed on this bill
  const maxBillAllocatable = MoneyMath.subtract(netBillAmount, alreadyAllocated);

  if (maxBillAllocatable <= 0) {
    throw new PaymentAllocationError(
      `Bill is already fully settled. (Net: ₹${netBillAmount.toFixed(2)}, Allocated: ₹${alreadyAllocated.toFixed(2)})`
    );
  }

  if (requested > maxBillAllocatable) {
    throw new PaymentAllocationError(
      `Requested allocation (₹${requested.toFixed(2)}) exceeds allowable bill pending amount (₹${maxBillAllocatable.toFixed(2)})`
    );
  }

  if (requested > paymentUnallocated) {
    throw new PaymentAllocationError(
      `Requested allocation (₹${requested.toFixed(2)}) exceeds available payment balance (₹${paymentUnallocated.toFixed(2)})`
    );
  }

  const allowedAllocationAmount = requested;
  const newBillAllocatedTotal = MoneyMath.add([alreadyAllocated, allowedAllocationAmount]);
  const newBillPendingAmount = MoneyMath.subtract(netBillAmount, newBillAllocatedTotal);
  const newPaymentUnallocatedAmount = MoneyMath.subtract(paymentUnallocated, allowedAllocationAmount);
  const isFullyAllocated = newPaymentUnallocatedAmount === 0;

  return {
    allowedAllocationAmount,
    newBillAllocatedTotal,
    newBillPendingAmount,
    newPaymentUnallocatedAmount,
    isFullyAllocated,
  };
}
