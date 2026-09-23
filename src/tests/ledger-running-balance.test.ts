import test from "node:test";
import assert from "node:assert/strict";
import { calculateLedgerRunningBalance, getStandardEntryTypeForVoucher } from "../domain/ledger";

test("Rule 10L: Ledger Running Balance Formula (Opening + Credits - Debits)", () => {
  // Deepraj Party Ledger Rule:
  // Opening Balance = ₹10,000 (Debit) -> represented as -10,000 or initial 0
  // Freight Bill posted (Credit) = ₹50,000 -> Running Balance: 0 + 50,000 = 50,000
  // Payment Received (Debit) = ₹20,000 -> Running Balance: 50,000 - 20,000 = 30,000
  // TDS Deducted (Debit) = ₹500 -> Running Balance: 30,000 - 500 = 29,500
  let running = 0;

  // 1. Post Freight Bill (Credit)
  running = calculateLedgerRunningBalance(running, "CREDIT", 0, 50000);
  assert.equal(running, 50000);

  // 2. Post Payment Received (Debit)
  running = calculateLedgerRunningBalance(running, "DEBIT", 20000, 0);
  assert.equal(running, 30000);

  // 3. Post TDS Journal (Debit)
  running = calculateLedgerRunningBalance(running, "DEBIT", 500, 0);
  assert.equal(running, 29500);
});

test("Rule 10: Standard Voucher Entry Type Mappings", () => {
  assert.equal(getStandardEntryTypeForVoucher("TRANSPORTATION_CHARGES_RCM"), "CREDIT");
  assert.equal(getStandardEntryTypeForVoucher("DEBIT_NOTE_RCM"), "DEBIT");
  assert.equal(getStandardEntryTypeForVoucher("TDS_JOURNAL"), "DEBIT");
  assert.equal(getStandardEntryTypeForVoucher("PAYMENT_BANK"), "DEBIT");
  assert.equal(getStandardEntryTypeForVoucher("PAYMENT_CASH"), "DEBIT");
});
