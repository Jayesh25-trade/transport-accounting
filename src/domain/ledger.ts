import { MoneyMath } from "../lib/decimal";
import { DomainValidationError } from "../lib/errors";

export type LedgerEntryType = "DEBIT" | "CREDIT";
export type LedgerVoucherType =
  | "OPENING_BALANCE"
  | "TRANSPORTATION_CHARGES_RCM"
  | "DEBIT_NOTE_RCM"
  | "TDS_JOURNAL"
  | "PAYMENT_BANK"
  | "PAYMENT_CASH"
  | "ADVANCE_RECEIPT"
  | "ADJUSTMENT";

export interface LedgerTransactionInput {
  entryType: LedgerEntryType;
  debitAmount: number | string;
  creditAmount: number | string;
}

/**
 * Pure domain calculation for Ledger Running Balance following confirmed Deepraj ledger treatment:
 *   Running Balance = Previous Balance + Credit Amount - Debit Amount
 *
 * (For customer/party accounts, transportation freight bills are CREDITED to the account,
 *  and payments / TDS / debit notes are DEBITED to settle the account.)
 */
export function calculateLedgerRunningBalance(
  previousBalance: number | string,
  entryType: LedgerEntryType,
  debitAmount: number | string,
  creditAmount: number | string
): number {
  const prev = MoneyMath.round(previousBalance);
  const dr = MoneyMath.round(debitAmount);
  const cr = MoneyMath.round(creditAmount);

  if (dr < 0 || cr < 0) {
    throw new DomainValidationError("Debit and credit amounts cannot be negative");
  }

  if (entryType === "CREDIT") {
    return MoneyMath.add([prev, cr]);
  } else {
    return MoneyMath.subtract(prev, dr);
  }
}

/**
 * Standard Deepraj voucher type to default entry type mapping:
 *   - TRANSPORTATION_CHARGES_RCM (Freight Bill) -> CREDIT
 *   - DEBIT_NOTE_RCM (Shortage Debit) -> DEBIT
 *   - TDS_JOURNAL (TDS deduction) -> DEBIT
 *   - PAYMENT_BANK / PAYMENT_CASH -> DEBIT
 */
export function getStandardEntryTypeForVoucher(voucherType: LedgerVoucherType): LedgerEntryType {
  switch (voucherType) {
    case "TRANSPORTATION_CHARGES_RCM":
      return "CREDIT";
    case "DEBIT_NOTE_RCM":
    case "TDS_JOURNAL":
    case "PAYMENT_BANK":
    case "PAYMENT_CASH":
      return "DEBIT";
    case "OPENING_BALANCE":
    case "ADVANCE_RECEIPT":
    case "ADJUSTMENT":
      return "DEBIT"; // Default, though configurable by user
    default:
      return "DEBIT";
  }
}
