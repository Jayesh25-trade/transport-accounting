import { MoneyMath, WeightMath } from "../lib/decimal";
import { BillEditValidationError } from "../lib/errors";

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
  // CONFIRMED BUSINESS RULE: Driver Voucher (advance+cash+diesel+ac) deducted from final payable.
  driverVoucherTotal?: number | string | null;
}

export interface BillTotalsResult {
  totalNWeight: number;
  totalRWeight: number;
  subtotalFreight: number;
  totalShortageDebit: number;
  tdsAmount: number;
  debitNoteAmount: number;
  driverVoucherTotal: number; // CONFIRMED: DV deduction snapshotted on bill
  netBillAmount: number;      // Gross - Shortage - TDS - DriverVoucher
  receivedAmount: number;
  pendingAmount: number;      // netBillAmount - receivedAmount
}

/**
 * Calculates complete bill totals and validates outstanding balance integrity.
 *
 * CONFIRMED CALCULATION FLOW (client confirmed):
 *   1. subtotalFreight = SUM(trip freight)                    [based on freight basis]
 *   2. totalShortageDebit = SUM(trip shortage debit)          [customer rule]
 *   3. amountAfterShortage = subtotalFreight - totalShortageDebit
 *   4. tdsAmount = amountAfterShortage × tds%                 [on shortage-reduced base]
 *   5. driverVoucherTotal = SUM(advance + cash + diesel + ac) [per trip]
 *   6. netBillAmount = subtotalFreight - totalShortageDebit - tdsAmount - driverVoucherTotal
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
  // CONFIRMED: Driver Voucher deduction from net payable
  const driverVoucherTotal = MoneyMath.round(input.driverVoucherTotal ?? 0);

  // CONFIRMED FORMULA: Net = Gross - Shortage - TDS - DriverVoucher
  // Clamp to 0 if total deductions exceed gross freight.
  const netBillAmount = Math.max(
    0,
    MoneyMath.subtract(
      subtotalFreight,
      MoneyMath.add([tdsAmount, debitNoteAmount, driverVoucherTotal])
    )
  );

  // Pending Amount = Net Bill Amount - Received Amount
  const pendingAmount = MoneyMath.subtract(netBillAmount, receivedAmount);

  return {
    totalNWeight,
    totalRWeight,
    subtotalFreight,
    totalShortageDebit,
    tdsAmount,
    debitNoteAmount,
    driverVoucherTotal,
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
