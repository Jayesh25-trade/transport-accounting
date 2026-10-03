"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Modal, Field, FormGrid, FormActions } from "@/components/ui/modal";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useApiClient, ApiError } from "@/lib/api-client";
import { MoneyMath } from "@/lib/decimal";

export interface PendingBillOption {
  id: string;
  partyId: string;
  partyName?: string | null;
  billNumber: number;
  billDate: string;
  netBillAmount: string | number;
  receivedAmount: string | number;
  pendingAmount: string | number;
  status: string;
}

export interface PaymentForAllocation {
  id: string;
  partyId: string;
  partyName?: string | null;
  paymentDate: string;
  paymentType: "ADVANCE" | "AGAINST_BILL";
  paymentMode: string;
  amount: string | number;
  unallocatedAmount: string | number;
  isFullyAllocated: boolean;
  remarks: string | null;
}

interface AllocateAdvanceModalProps {
  open: boolean;
  onClose: () => void;
  payment: PaymentForAllocation | null;
  bills: PendingBillOption[];
  onSuccess: (message: string) => void;
}

const getTodayString = () => new Date().toISOString().split("T")[0];

export function AllocateAdvanceModal({
  open,
  onClose,
  payment,
  bills,
  onSuccess,
}: AllocateAdvanceModalProps) {
  const api = useApiClient();

  // Form fields
  const [selectedBillId, setSelectedBillId] = useState("");
  const [allocationAmount, setAllocationAmount] = useState("");
  const [allocationDate, setAllocationDate] = useState(getTodayString());
  const [remarks, setRemarks] = useState("");

  // Step state: "INPUT" | "CONFIRM"
  const [step, setStep] = useState<"INPUT" | "CONFIRM">("INPUT");

  // Status & Errors
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset modal state when payment changes or opens
  useEffect(() => {
    if (open) {
      setSelectedBillId("");
      setAllocationAmount("");
      setAllocationDate(getTodayString());
      setRemarks("");
      setStep("INPUT");
      setError(null);
    }
  }, [open, payment?.id]);

  // Compute available unallocated advance
  const availableAdvance = useMemo(() => {
    if (!payment) return 0;
    return Number(payment.unallocatedAmount) || 0;
  }, [payment]);

  const originalAdvance = useMemo(() => {
    if (!payment) return 0;
    return Number(payment.amount) || 0;
  }, [payment]);

  const alreadyAllocated = useMemo(() => {
    return Math.max(0, MoneyMath.subtract(originalAdvance, availableAdvance));
  }, [originalAdvance, availableAdvance]);

  // Filter bills strictly for the SAME party with pendingAmount > 0
  const eligibleBills = useMemo(() => {
    if (!payment?.partyId) return [];
    return bills.filter(
      (b) => b.partyId === payment.partyId && Number(b.pendingAmount) > 0
    );
  }, [bills, payment?.partyId]);

  // Selected target bill
  const selectedBill = useMemo(() => {
    if (!selectedBillId) return null;
    return eligibleBills.find((b) => b.id === selectedBillId) || null;
  }, [eligibleBills, selectedBillId]);

  const selectedBillPending = useMemo(() => {
    if (!selectedBill) return 0;
    return Number(selectedBill.pendingAmount) || 0;
  }, [selectedBill]);

  // Maximum allocatable: min(availableAdvance, selectedBillPending)
  const maxAllocatable = useMemo(() => {
    if (!selectedBill) return availableAdvance;
    return Math.min(availableAdvance, selectedBillPending);
  }, [availableAdvance, selectedBillPending, selectedBill]);

  // Handle Review Click (Input -> Confirm)
  function handleReview(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedBillId || !selectedBill) {
      setError("Please select a target pending bill for allocation.");
      return;
    }

    if (!allocationDate || !/^\d{4}-\d{2}-\d{2}$/.test(allocationDate)) {
      setError("Please enter a valid allocation date (YYYY-MM-DD).");
      return;
    }

    const amt = Number(allocationAmount);
    if (!allocationAmount || isNaN(amt) || amt <= 0) {
      setError("Allocation amount must be greater than ₹0.");
      return;
    }

    if (amt > availableAdvance) {
      setError(
        `Allocation amount cannot exceed the available advance of ${formatCurrency(availableAdvance)}.`
      );
      return;
    }

    if (amt > selectedBillPending) {
      setError(
        `Allocation amount cannot exceed the bill's pending amount of ${formatCurrency(selectedBillPending)}.`
      );
      return;
    }

    setStep("CONFIRM");
  }

  // Submit Allocation to API
  async function handleConfirmAllocation() {
    if (!payment || !selectedBill) return;

    setSubmitting(true);
    setError(null);

    const amt = Number(allocationAmount);

    try {
      await api.post("/api/payments/allocations", {
        paymentId: payment.id,
        billId: selectedBill.id,
        allocatedAmount: amt,
        allocationDate: allocationDate,
        remarks: remarks || null,
      });

      const successMsg = `Advance of ${formatCurrency(amt)} allocated successfully to Bill #${selectedBill.billNumber}.`;
      onSuccess(successMsg);
      onClose();
    } catch (err: any) {
      setError(
        err instanceof ApiError ? err.message : "Failed to allocate advance payment."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!payment) return null;

  // After allocation calculations for confirmation preview
  const numericAmt = Number(allocationAmount) || 0;
  const newBillPending = Math.max(0, MoneyMath.subtract(selectedBillPending, numericAmt));
  const newAdvanceRemaining = Math.max(0, MoneyMath.subtract(availableAdvance, numericAmt));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Allocate Advance Payment"
      size="lg"
    >
      <div className="space-y-4 text-[#1A1D20]">
        {/* Top Summary Card */}
        <div className="p-3.5 bg-[#FAF8F5] rounded-xl border border-[#D8D5CE] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5F6368]">
              Customer / Party
            </span>
            <span className="text-xs font-bold text-[#E05638]">
              {payment.partyName || "Customer Advance"}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#EFECE6] text-xs">
            <div>
              <span className="text-[#7A7F85] block font-bold uppercase text-[10px]">
                Original Advance
              </span>
              <span className="font-mono-nums font-bold text-[#1A1D20]">
                {formatCurrency(originalAdvance)}
              </span>
            </div>
            <div>
              <span className="text-[#7A7F85] block font-bold uppercase text-[10px]">
                Already Allocated
              </span>
              <span className="font-mono-nums font-bold text-[#2E7D32]">
                {formatCurrency(alreadyAllocated)}
              </span>
            </div>
            <div>
              <span className="text-[#7A7F85] block font-bold uppercase text-[10px]">
                Available to Allocate
              </span>
              <span className="font-mono-nums font-bold text-[#0288D1]">
                {formatCurrency(availableAdvance)}
              </span>
            </div>
          </div>
        </div>

        {/* Form Error Banner */}
        {error && (
          <div className="p-3.5 bg-[#FDEDED] border border-[#D32F2F]/30 text-[#D32F2F] rounded-xl text-xs">
            {error}
          </div>
        )}

        {step === "INPUT" ? (
          <form onSubmit={handleReview} noValidate className="space-y-4">
            {/* Target Bill Selector */}
            <Field
              label="Target bill"
              hint={
                eligibleBills.length === 0
                  ? "No pending bills found for this customer."
                  : `Select from ${eligibleBills.length} pending bill(s) for this customer`
              }
            >
              <select
                value={selectedBillId}
                onChange={(e) => {
                  setSelectedBillId(e.target.value);
                  setError(null);
                }}
                disabled={eligibleBills.length === 0}
                className="form-input font-medium"
                id="allocate-advance-bill-select"
              >
                <option value="">-- Select Pending Bill --</option>
                {eligibleBills.map((b) => (
                  <option key={b.id} value={b.id}>
                    Bill #{b.billNumber} ({formatDate(b.billDate)}) — Pending: {formatCurrency(b.pendingAmount)}
                  </option>
                ))}
              </select>
            </Field>

            {/* Selected Bill Live Details Box */}
            {selectedBill && (
              <div className="p-3 bg-white rounded-xl border border-[#D8D5CE] text-xs grid grid-cols-3 gap-2">
                <div>
                  <span className="text-[#7A7F85] block font-bold uppercase text-[10px]">Net Bill Amount</span>
                  <span className="font-mono-nums font-bold">{formatCurrency(selectedBill.netBillAmount)}</span>
                </div>
                <div>
                  <span className="text-[#7A7F85] block font-bold uppercase text-[10px]">Received</span>
                  <span className="font-mono-nums font-bold text-[#2E7D32]">{formatCurrency(selectedBill.receivedAmount)}</span>
                </div>
                <div>
                  <span className="text-[#7A7F85] block font-bold uppercase text-[10px]">CURRENT PENDING</span>
                  <span className="font-mono-nums font-bold text-[#ED6C02]">{formatCurrency(selectedBill.pendingAmount)}</span>
                </div>
              </div>
            )}

            <FormGrid cols={2}>
              <Field
                label="Allocation amount (₹)"
                hint={`Maximum allocatable: ${formatCurrency(maxAllocatable)}`}
              >
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={maxAllocatable}
                  value={allocationAmount}
                  onChange={(e) => {
                    setAllocationAmount(e.target.value);
                    setError(null);
                  }}
                  placeholder={`e.g. ${maxAllocatable}`}
                  className="form-input font-mono-nums font-semibold"
                  id="allocate-advance-amount-input"
                  disabled={!selectedBill}
                />
              </Field>

              <Field label="Allocation date">
                <input
                  type="date"
                  value={allocationDate}
                  onChange={(e) => setAllocationDate(e.target.value)}
                  className="form-input"
                  id="allocate-advance-date-input"
                />
              </Field>
            </FormGrid>

            <Field label="Remarks / Notes (optional)">
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional allocation notes..."
                className="form-input min-h-[50px] resize-y text-xs"
                rows={2}
                id="allocate-advance-remarks-input"
              />
            </Field>

            <FormActions
              onCancel={onClose}
              submitLabel="Review Allocation"
            />
          </form>
        ) : (
          /* Step 2: Confirmation Preview State */
          <div className="space-y-4">
            <div className="p-4 bg-[#E1F5FE] border border-[#0288D1]/30 rounded-xl space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0288D1] block">
                Confirm Advance Allocation
              </span>

              <div className="text-xs text-[#1A1D20] space-y-1">
                <p>
                  Allocate <strong className="text-[#0288D1] font-mono-nums font-bold">{formatCurrency(numericAmt)}</strong> from this advance to:
                </p>
                <div className="p-2.5 bg-white rounded-lg border border-[#D8D5CE] font-mono-nums mt-1 space-y-1">
                  <div className="font-bold text-xs text-[#1A1D20]">
                    Bill #{selectedBill?.billNumber} ({formatDate(selectedBill?.billDate || "")})
                  </div>
                  <div className="text-xs text-[#5F6368]">
                    Current Pending: <span className="font-bold text-[#ED6C02]">{formatCurrency(selectedBillPending)}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-white rounded-lg border border-[#D8D5CE] grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[#7A7F85] block font-bold uppercase text-[10px]">New Bill Pending</span>
                  <span className="font-mono-nums font-bold text-[#2E7D32]">
                    {formatCurrency(newBillPending)}
                  </span>
                </div>
                <div>
                  <span className="text-[#7A7F85] block font-bold uppercase text-[10px]">Advance Remaining</span>
                  <span className="font-mono-nums font-bold text-[#0288D1]">
                    {formatCurrency(newAdvanceRemaining)}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-[#FAF8F5] border border-[#D8D5CE] rounded-xl text-[11px] text-[#5F6368]">
              <strong>Accounting Note:</strong> No new receipt or ledger transaction will be created. The bill's pending balance will be reduced against the existing advance payment voucher.
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                className="btn btn-secondary text-xs"
                onClick={() => setStep("INPUT")}
                disabled={submitting}
              >
                Back to Edit
              </button>

              <button
                type="button"
                className="btn btn-primary bg-[#0288D1] hover:bg-[#0277BD] text-xs text-white"
                onClick={handleConfirmAllocation}
                disabled={submitting}
                id="allocate-advance-confirm-btn"
              >
                {submitting ? "Allocating…" : "Confirm Allocation"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
