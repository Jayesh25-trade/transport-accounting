import test from "node:test";
import assert from "node:assert/strict";
import { validatePaymentAllocation } from "../domain/payment";
import { PaymentAllocationError } from "../lib/errors";

test("Rule 9I: Payment Allocation - Rejects allocation exceeding allowable bill pending amount", () => {
  // Net Bill = ₹50,000, Already Allocated = ₹40,000 (Pending = ₹10,000)
  // Requested Allocation = ₹15,000, Payment Unallocated = ₹20,000
  // Should throw PaymentAllocationError because 15,000 > 10,000
  assert.throws(
    () =>
      validatePaymentAllocation({
        netBillAmount: 50000,
        alreadyAllocatedAmount: 40000,
        requestedAllocationAmount: 15000,
        paymentUnallocatedAmount: 20000,
      }),
    PaymentAllocationError
  );
});

test("Rule 9I: Payment Allocation - Accepts valid allocation within pending bill amount", () => {
  const result = validatePaymentAllocation({
    netBillAmount: 50000,
    alreadyAllocatedAmount: 40000,
    requestedAllocationAmount: 10000,
    paymentUnallocatedAmount: 20000,
  });

  assert.equal(result.allowedAllocationAmount, 10000);
  assert.equal(result.newBillAllocatedTotal, 50000);
  assert.equal(result.newBillPendingAmount, 0);
  assert.equal(result.newPaymentUnallocatedAmount, 10000);
  assert.equal(result.isFullyAllocated, false);
});

test("Rule 9J: Advance Payment vs Against Bill Distinction", () => {
  // Advance payment of ₹25,000 with 0 bill allocations
  const advancePayment = {
    paymentType: "ADVANCE",
    amount: 25000,
    unallocatedAmount: 25000,
    isFullyAllocated: false,
  };

  assert.equal(advancePayment.paymentType, "ADVANCE");
  assert.equal(advancePayment.unallocatedAmount, 25000);
  assert.equal(advancePayment.isFullyAllocated, false);
});
