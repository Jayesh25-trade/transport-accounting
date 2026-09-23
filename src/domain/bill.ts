import { MoneyMath, WeightMath } from "../lib/decimal";
import { BillEditValidationError, DomainValidationError } from "../lib/errors";

export interface BillItemSummaryInput {
  freight: number | string;
  shortageDebitAmount: number | string;
  nWeight?: number | string | null;
  rWeight?: number | string | null;
}

export interface BillTotalsInput {
  items: BillItemSummaryInput[];
  tdsAmount: number | string;
  debitNoteAmount?: number | string | null;
  receivedAmount?: number | string | null;
}

export interface BillTotalsResult {
  totalNWeight: number;
  totalRWeight: number;
  subtotalFreight: number;
  totalShortageDebit: number;
  tdsAmount: number;
  debitNoteAmount: number;
  netBillAmount: number;     // subtotalFreight - tdsAmount - debitNoteAmount (or shortage debit)
  receivedAmount: number;
  pendingAmount: number;    // netBillAmount - receivedAmount
}

/**
 * Calculates complete bill totals and validates outstanding balance integrity.
 */
export function calculateBillTotals(input: BillTotalsInput): BillTotalsResult {
  let totalNWeight = 0;
  let totalRWeight = 0;
  let subtotalFreight = 0;
  let totalShortageDebit = 0;

  for (const item of input.items) {
    totalNWeight = WeightMath.add([totalNWeight, item.nWeight ?? 0]);
    totalRWeight = WeightMath.add([totalRWeight, item.rWeight ?? 0]);
    subtotalFreight = MoneyMath.add([subtotalFreight, item.freight]);
    totalShortageDebit = MoneyMath.add([totalShortageDebit, item.shortageDebitAmount]);
  }

  const tdsAmount = MoneyMath.round(input.tdsAmount);
  // Debit note amount is either explicitly provided or derived from total shortage debits
  const debitNoteAmount = MoneyMath.round(input.debitNoteAmount ?? totalShortageDebit);
  const receivedAmount = MoneyMath.round(input.receivedAmount ?? 0);

  // Net Bill Amount = Subtotal Freight - TDS Amount - Debit Note Amount
  const netBillAmount = MoneyMath.subtract(
    subtotalFreight,
    MoneyMath.add([tdsAmount, debitNoteAmount])
  );

  if (netBillAmount < 0) {
    throw new DomainValidationError("Net bill amount cannot be negative");
  }

  // Pending Amount = Net Bill Amount - Received Amount
  const pendingAmount = MoneyMath.subtract(netBillAmount, receivedAmount);

  return {
    totalNWeight,
    totalRWeight,
    subtotalFreight,
    totalShortageDebit,
    tdsAmount,
    debitNoteAmount,
    netBillAmount,
    receivedAmount,
    pendingAmount,
  };
}

/**
 * Validates whether a bill edit is allowed against already received payments.
 * Enforces Rule 8:
 *   - If new net bill amount < already received amount, block the edit with BillEditValidationError.
 */
export function validateBillEdit(existingReceivedAmount: number | string, newNetBillAmount: number | string): void {
  const received = MoneyMath.round(existingReceivedAmount);
  const newNet = MoneyMath.round(newNetBillAmount);

  if (newNet < received) {
    throw new BillEditValidationError(
      `Cannot edit bill: new net amount (₹${newNet.toFixed(2)}) is less than already received payment amount (₹${received.toFixed(2)}).`
    );
  }
}
