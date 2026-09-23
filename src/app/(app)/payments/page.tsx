"use client";

import React, { useState, useMemo } from "react";
import {
  Plus,
  Search,
  Eye,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  X,
  Building2,
  Users,
  DollarSign,
  FileText,
  Clock,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button, Badge, EmptyState } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useMasterList, useMasterMutation } from "@/lib/use-master-list";
import { useApiClient, ApiError } from "@/lib/api-client";
import { useFirm } from "@/lib/firm-context";
import { Modal, Field, FormGrid, FormActions } from "@/components/ui/modal";
import { formatCurrency, formatDate } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────
interface PaymentAllocationRecord {
  id: string;
  paymentId: string;
  billId: string;
  allocatedAmount: string | number;
  allocationDate: string;
  billNumber?: number | null;
  billDate?: string | null;
  netBillAmount?: string | number | null;
  pendingAmount?: string | number | null;
}

interface PaymentRecord {
  id: string;
  firmId: string;
  partyId: string;
  partyName?: string | null;
  paymentDate: string;
  paymentType: "AGAINST_BILL" | "ADVANCE";
  paymentMode: string;
  referenceNumber: string | null;
  bankName: string | null;
  amount: string | number;
  unallocatedAmount: string | number;
  isFullyAllocated: boolean;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
  allocations?: PaymentAllocationRecord[];
}

interface MasterParty {
  id: string;
  name: string;
}

interface BillRecord {
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

interface AddPaymentFormData {
  paymentType: "AGAINST_BILL" | "ADVANCE";
  partyId: string;
  billId: string;
  paymentDate: string;
  paymentMode: string;
  amount: string;
  referenceNumber: string;
  bankName: string;
  remarks: string;
}

const getTodayString = () => new Date().toISOString().split("T")[0];

const INITIAL_FORM: AddPaymentFormData = {
  paymentType: "AGAINST_BILL",
  partyId: "",
  billId: "",
  paymentDate: getTodayString(),
  paymentMode: "BANK_ACCOUNT",
  amount: "",
  referenceNumber: "",
  bankName: "",
  remarks: "",
};

// ─── Main Payments Register Page ──────────────────────────────
export default function PaymentsPage() {
  const api = useApiClient();
  const { currentFirm, loading: firmLoading } = useFirm();

  // Load Payments, Parties, and Bills
  const {
    data: paymentsList,
    loading: paymentsLoading,
    error: paymentsError,
    refresh: refreshPayments,
  } = useMasterList<PaymentRecord>({
    endpoint: "/api/payments",
  });

  const { data: parties } = useMasterList<MasterParty>({ endpoint: "/api/parties" });
  const { data: billsList, refresh: refreshBills } = useMasterList<BillRecord>({ endpoint: "/api/bills" });

  // Filters
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [partyFilter, setPartyFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "AGAINST_BILL" | "ADVANCE">("ALL");
  const [modeFilter, setModeFilter] = useState("ALL");

  // Modals & Forms
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewPayment, setViewPayment] = useState<PaymentRecord | null>(null);

  const [form, setForm] = useState<AddPaymentFormData>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof AddPaymentFormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Compute pending bills for the selected party when adding an Against Bill payment
  const pendingBillsForSelectedParty = useMemo(() => {
    if (!form.partyId) return [];
    return billsList.filter(
      (b) => b.partyId === form.partyId && Number(b.pendingAmount) > 0
    );
  }, [billsList, form.partyId]);

  // Selected bill details for live calculation box in form
  const selectedBill = useMemo(() => {
    if (!form.billId) return null;
    return billsList.find((b) => b.id === form.billId) || null;
  }, [billsList, form.billId]);

  const selectedBillStats = useMemo(() => {
    if (!selectedBill) return null;
    const net = Number(selectedBill.netBillAmount) || 0;
    const received = Number(selectedBill.receivedAmount) || 0;
    const pending = Math.max(0, net - received);
    return { net, received, pending };
  }, [selectedBill]);

  // Handle Form Change
  function setFormField(field: keyof AddPaymentFormData, value: any) {
    setForm((f) => {
      const next = { ...f, [field]: value };
      if (field === "partyId") {
        next.billId = ""; // Reset selected bill when party changes
      }
      if (field === "paymentType" && value === "ADVANCE") {
        next.billId = ""; // Clear bill selection if Advance
      }
      return next;
    });
    setFormErrors((e) => ({ ...e, [field]: undefined }));
  }

  // Form Validation
  function validateForm(): boolean {
    const errs: typeof formErrors = {};
    if (!form.partyId) errs.partyId = "Party selection is required";
    if (!form.paymentDate || !/^\d{4}-\d{2}-\d{2}$/.test(form.paymentDate)) {
      errs.paymentDate = "Valid date (YYYY-MM-DD) is required";
    }

    const amt = Number(form.amount);
    if (!form.amount || isNaN(amt) || amt <= 0) {
      errs.amount = "Payment amount must be greater than ₹0";
    }

    if (form.paymentType === "AGAINST_BILL") {
      if (!form.billId) {
        errs.billId = "Bill selection is required for Against Bill payments";
      } else if (selectedBillStats) {
        if (selectedBillStats.pending <= 0) {
          errs.billId = "Selected bill is already fully paid";
        } else if (amt > selectedBillStats.pending) {
          errs.amount = `Payment amount (₹${amt}) cannot exceed remaining bill balance (₹${selectedBillStats.pending.toFixed(2)})`;
        }
      }
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // Submit Payment Creation
  async function handleSubmitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: Record<string, any> = {
        partyId: form.partyId,
        paymentDate: form.paymentDate,
        paymentType: form.paymentType,
        paymentMode: form.paymentMode,
        referenceNumber: form.referenceNumber || null,
        bankName: form.bankName || null,
        amount: Number(form.amount),
        billId: form.paymentType === "AGAINST_BILL" ? form.billId : undefined,
        remarks: form.remarks || null,
      };

      await api.post("/api/payments", payload);

      setShowAddModal(false);
      setForm(INITIAL_FORM);
      setFeedback("Payment recorded successfully!");
      setTimeout(() => setFeedback(null), 4000);
      refreshPayments();
      refreshBills();
    } catch (err: any) {
      setSubmitError(err instanceof ApiError ? err.message : "Failed to record payment.");
    } finally {
      setSubmitting(false);
    }
  }

  // Summary statistics for cards
  const stats = useMemo(() => {
    let totalCount = paymentsList.length;
    let totalAmount = 0;
    let againstBillCount = 0;
    let againstBillAmount = 0;
    let advanceCount = 0;
    let advanceAmount = 0;

    paymentsList.forEach((p) => {
      const amt = Number(p.amount) || 0;
      totalAmount += amt;
      if (p.paymentType === "AGAINST_BILL") {
        againstBillCount++;
        againstBillAmount += amt;
      } else {
        advanceCount++;
        advanceAmount += amt;
      }
    });

    return {
      totalCount,
      totalAmount,
      againstBillCount,
      againstBillAmount,
      advanceCount,
      advanceAmount,
    };
  }, [paymentsList]);

  // Client-side filtering
  const filtered = useMemo(() => {
    return paymentsList.filter((p) => {
      // 1. Search Query
      if (search.trim()) {
        const q = search.toLowerCase();
        const partyMatch = (p.partyName || "").toLowerCase().includes(q);
        const refMatch = (p.referenceNumber || "").toLowerCase().includes(q);
        const bankMatch = (p.bankName || "").toLowerCase().includes(q);
        const remarksMatch = (p.remarks || "").toLowerCase().includes(q);
        if (!partyMatch && !refMatch && !bankMatch && !remarksMatch) return false;
      }

      // 2. Date Range
      if (dateFrom && p.paymentDate < dateFrom) return false;
      if (dateTo && p.paymentDate > dateTo) return false;

      // 3. Party Filter
      if (partyFilter !== "ALL" && p.partyId !== partyFilter) return false;

      // 4. Payment Type Filter
      if (typeFilter !== "ALL" && p.paymentType !== typeFilter) return false;

      // 5. Payment Mode Filter
      if (modeFilter !== "ALL" && p.paymentMode !== modeFilter) return false;

      return true;
    });
  }, [paymentsList, search, dateFrom, dateTo, partyFilter, typeFilter, modeFilter]);

  const hasActiveFilters =
    Boolean(search) ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    partyFilter !== "ALL" ||
    typeFilter !== "ALL" ||
    modeFilter !== "ALL";

  function clearFilters() {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setPartyFilter("ALL");
    setTypeFilter("ALL");
    setModeFilter("ALL");
  }

  const columns: Column<PaymentRecord>[] = [
    {
      key: "paymentDate",
      label: "Date",
      render: (p) => <span className="text-xs whitespace-nowrap">{formatDate(p.paymentDate)}</span>,
    },
    {
      key: "partyName",
      label: "Party (Customer)",
      render: (p) => (
        <span className="font-semibold text-xs text-primary-600 dark:text-primary-400">
          {p.partyName || "—"}
        </span>
      ),
    },
    {
      key: "paymentType",
      label: "Type",
      render: (p) => (
        <Badge variant={p.paymentType === "AGAINST_BILL" ? "info" : "neutral"}>
          {p.paymentType === "AGAINST_BILL" ? "AGAINST BILL" : "ADVANCE (Unallocated)"}
        </Badge>
      ),
    },
    {
      key: "paymentMode",
      label: "Mode",
      render: (p) => <span className="font-mono text-xs font-semibold">{p.paymentMode}</span>,
    },
    {
      key: "referenceNumber",
      label: "Reference / UTR",
      render: (p) => (
        <span className="font-mono text-xs text-gray-500">
          {p.referenceNumber || (p.bankName ? `Bank: ${p.bankName}` : "—")}
        </span>
      ),
    },
    {
      key: "allocations",
      label: "Bill Ref",
      render: (p) => {
        if (p.paymentType === "ADVANCE") {
          return <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">Unallocated Advance</span>;
        }
        if (p.allocations && p.allocations.length > 0) {
          const billNums = p.allocations
            .map((a) => (a.billNumber ? `#${a.billNumber}` : null))
            .filter(Boolean);
          return <span className="font-mono text-xs font-bold text-gray-800 dark:text-gray-200">Bill {billNums.join(", ") || "Allocated"}</span>;
        }
        return <span className="text-xs text-gray-400">Against Bill</span>;
      },
    },
    {
      key: "amount",
      label: "Amount",
      align: "right",
      render: (p) => (
        <span className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-400">
          {formatCurrency(p.amount)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (p) => (
        <button
          className="btn btn-ghost btn-xs text-primary-600 hover:text-primary-800"
          onClick={(e) => {
            e.stopPropagation();
            setViewPayment(p);
          }}
          title="View Payment Voucher"
          id={`payment-view-${p.id}`}
        >
          <Eye size={14} />
        </button>
      ),
    },
  ];

  return (
    <div className="animate-fade-in space-y-4">
      <PageHeader
        title="Payments"
        subtitle="Customer payment vouchers & bill allocations — firm-scoped"
        breadcrumbs={[{ label: "Payments" }]}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => setShowAddModal(true)}
            id="payments-new"
            disabled={firmLoading || !currentFirm}
          >
            Add Payment
          </Button>
        }
      />

      {/* Success Feedback Banner */}
      {feedback && (
        <div className="card border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              {feedback}
            </p>
          </div>
          <button onClick={() => setFeedback(null)} className="text-emerald-600 text-xs">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {paymentsError && (
        <div className="card border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-3">
          <p className="text-xs text-red-600 dark:text-red-400">{paymentsError}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="card p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              Total Receipts
            </span>
            <span className="text-2xl font-black text-gray-900 dark:text-gray-100 font-mono">
              {formatCurrency(stats.totalAmount)}
            </span>
            <span className="text-xs text-gray-500 block">{stats.totalCount} payment vouchers</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-950/50 flex items-center justify-center text-primary-600">
            <CreditCard size={18} />
          </div>
        </div>

        <div className="card p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
              Against Bill Receipts
            </span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {formatCurrency(stats.againstBillAmount)}
            </span>
            <span className="text-xs text-gray-500 block">{stats.againstBillCount} bill allocations</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600">
            <DollarSign size={18} />
          </div>
        </div>

        <div className="card p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider block">
              Advance Receipts (Unallocated)
            </span>
            <span className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono">
              {formatCurrency(stats.advanceAmount)}
            </span>
            <span className="text-xs text-gray-500 block">{stats.advanceCount} advance vouchers</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600">
            <Clock size={18} />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card p-3.5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Search party, UTR, reference, remarks…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input pl-8 text-xs"
              id="payments-search"
            />
          </div>

          {/* Date From */}
          <div className="w-36">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="form-input text-xs"
              title="From date"
              id="payments-filter-date-from"
            />
          </div>

          {/* Date To */}
          <div className="w-36">
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="form-input text-xs"
              title="To date"
              id="payments-filter-date-to"
            />
          </div>

          {/* Party Filter */}
          <select
            value={partyFilter}
            onChange={(e) => setPartyFilter(e.target.value)}
            className="form-input text-xs w-40"
            id="payments-filter-party"
          >
            <option value="ALL">All Parties</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="form-input text-xs w-36"
            id="payments-filter-type"
          >
            <option value="ALL">All Types</option>
            <option value="AGAINST_BILL">AGAINST BILL</option>
            <option value="ADVANCE">ADVANCE</option>
          </select>

          {/* Mode Filter */}
          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
            className="form-input text-xs w-32"
            id="payments-filter-mode"
          >
            <option value="ALL">All Modes</option>
            <option value="CASH">CASH</option>
            <option value="BANK_ACCOUNT">BANK ACCOUNT</option>
            <option value="CHEQUE">CHEQUE</option>
            <option value="UTR">UTR</option>
            <option value="NEFT">NEFT</option>
            <option value="RTGS">RTGS</option>
            <option value="UPI">UPI</option>
          </select>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} icon={X}>
              Clear Filters
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-800">
          <span>
            {paymentsLoading ? "Loading payments…" : `Showing ${filtered.length} of ${paymentsList.length} payment records`}
          </span>
        </div>
      </div>

      {/* Main Data Table */}
      <DataTable
        columns={columns}
        data={filtered}
        loading={paymentsLoading}
        emptyState={
          <EmptyState
            icon={CreditCard}
            title={hasActiveFilters ? "No payments match your filters" : "No payment vouchers recorded yet"}
            description={
              hasActiveFilters
                ? "Try adjusting or clearing your search and filter criteria."
                : "Record your first customer payment voucher to update customer ledgers and bill balances."
            }
            action={
              !hasActiveFilters ? (
                <Button
                  variant="primary"
                  size="sm"
                  icon={Plus}
                  onClick={() => setShowAddModal(true)}
                >
                  Add Payment
                </Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Clear Filters
                </Button>
              )
            }
          />
        }
        onRowClick={(p) => setViewPayment(p)}
      />

      {/* Add Payment Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Customer Payment Voucher"
        size="lg"
      >
        <form onSubmit={handleSubmitPayment} noValidate className="space-y-4">
          {/* Payment Type Switcher */}
          <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-200 dark:border-gray-700">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 block mb-2">
              Payment Voucher Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormField("paymentType", "AGAINST_BILL")}
                className={`p-3 rounded-lg border text-left transition-all ${
                  form.paymentType === "AGAINST_BILL"
                    ? "bg-primary-50 dark:bg-primary-950/40 border-primary-500 text-primary-700 dark:text-primary-300 ring-2 ring-primary-500/20"
                    : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600"
                }`}
                id="payment-type-against-bill"
              >
                <div className="font-bold text-xs">AGAINST BILL</div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  Allocates payment to a specific pending customer bill
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormField("paymentType", "ADVANCE")}
                className={`p-3 rounded-lg border text-left transition-all ${
                  form.paymentType === "ADVANCE"
                    ? "bg-purple-50 dark:bg-purple-950/40 border-purple-500 text-purple-700 dark:text-purple-300 ring-2 ring-purple-500/20"
                    : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600"
                }`}
                id="payment-type-advance"
              >
                <div className="font-bold text-xs">ADVANCE (Unallocated)</div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  Records unallocated advance payment against party ledger
                </div>
              </button>
            </div>
          </div>

          <FormGrid cols={2}>
            <Field label="Billing Customer (Party)" required error={formErrors.partyId}>
              <select
                value={form.partyId}
                onChange={(e) => setFormField("partyId", e.target.value)}
                className="form-input font-medium"
                id="payment-form-party"
              >
                <option value="">-- Select Customer --</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Payment Date" required error={formErrors.paymentDate}>
              <input
                type="date"
                value={form.paymentDate}
                onChange={(e) => setFormField("paymentDate", e.target.value)}
                className="form-input"
                id="payment-form-date"
              />
            </Field>
          </FormGrid>

          {/* Conditional Bill Selection for AGAINST_BILL */}
          {form.paymentType === "AGAINST_BILL" && (
            <div className="p-3 bg-blue-50/40 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-900/40 space-y-3">
              <Field
                label="Select Target Bill"
                required
                error={formErrors.billId}
                hint={
                  !form.partyId
                    ? "Please select a customer first"
                    : pendingBillsForSelectedParty.length === 0
                    ? "No pending bills found for this customer"
                    : "Select from customer's pending bills"
                }
              >
                <select
                  value={form.billId}
                  onChange={(e) => setFormField("billId", e.target.value)}
                  disabled={!form.partyId || pendingBillsForSelectedParty.length === 0}
                  className="form-input font-medium"
                  id="payment-form-bill-select"
                >
                  <option value="">-- Select Pending Bill --</option>
                  {pendingBillsForSelectedParty.map((b) => (
                    <option key={b.id} value={b.id}>
                      Bill #{b.billNumber} ({formatDate(b.billDate)}) — Pending: {formatCurrency(b.pendingAmount)}
                    </option>
                  ))}
                </select>
              </Field>

              {/* Live Selected Bill Calculation Box */}
              {selectedBillStats && (
                <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-800 text-xs grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-gray-400 block font-semibold uppercase text-[10px]">Net Bill Amount</span>
                    <span className="font-mono font-bold">{formatCurrency(selectedBillStats.net)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block font-semibold uppercase text-[10px]">Already Received</span>
                    <span className="font-mono font-semibold text-emerald-600">{formatCurrency(selectedBillStats.received)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block font-semibold uppercase text-[10px]">REMAINING PENDING</span>
                    <span className="font-mono font-bold text-amber-600">{formatCurrency(selectedBillStats.pending)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Advance Info Banner */}
          {form.paymentType === "ADVANCE" && (
            <div className="p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl text-xs text-purple-700 dark:text-purple-300">
              <strong>Unallocated Advance Notice:</strong> This payment will be credited to the customer's account without allocating it to any specific bill. It will remain marked as <code>Unallocated Advance</code>.
            </div>
          )}

          <FormGrid cols={2}>
            <Field label="Payment Amount (₹)" required error={formErrors.amount}>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={form.amount}
                onChange={(e) => setFormField("amount", e.target.value)}
                placeholder="e.g. 15000"
                className="form-input font-mono font-semibold"
                id="payment-form-amount"
              />
            </Field>

            <Field label="Payment Mode" required error={formErrors.paymentMode}>
              <select
                value={form.paymentMode}
                onChange={(e) => setFormField("paymentMode", e.target.value)}
                className="form-input font-medium"
                id="payment-form-mode"
              >
                <option value="BANK_ACCOUNT">BANK ACCOUNT</option>
                <option value="CASH">CASH</option>
                <option value="CHEQUE">CHEQUE</option>
                <option value="UTR">UTR / ONLINE</option>
                <option value="NEFT">NEFT</option>
                <option value="RTGS">RTGS</option>
                <option value="UPI">UPI</option>
              </select>
            </Field>
          </FormGrid>

          <FormGrid cols={2}>
            <Field label="Reference / Cheque / UTR No" error={formErrors.referenceNumber}>
              <input
                type="text"
                value={form.referenceNumber}
                onChange={(e) => setFormField("referenceNumber", e.target.value)}
                placeholder="e.g. UTR-90812345"
                className="form-input font-mono"
                id="payment-form-ref"
              />
            </Field>

            <Field label="Bank Name" error={formErrors.bankName}>
              <input
                type="text"
                value={form.bankName}
                onChange={(e) => setFormField("bankName", e.target.value)}
                placeholder="e.g. HDFC Bank"
                className="form-input text-xs"
                id="payment-form-bank"
              />
            </Field>
          </FormGrid>

          <Field label="Remarks / Notes" error={formErrors.remarks}>
            <textarea
              value={form.remarks}
              onChange={(e) => setFormField("remarks", e.target.value)}
              placeholder="Operational payment remarks..."
              className="form-input min-h-[56px] resize-y text-xs"
              rows={2}
              id="payment-form-remarks"
            />
          </Field>

          {submitError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs">
              {submitError}
            </div>
          )}

          <FormActions
            onCancel={() => setShowAddModal(false)}
            loading={submitting}
            submitLabel="Save Payment Voucher"
          />
        </form>
      </Modal>

      {/* View Payment Modal */}
      <Modal
        open={Boolean(viewPayment)}
        onClose={() => setViewPayment(null)}
        title="Payment Voucher Details"
        size="md"
      >
        {viewPayment && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <div>
                <span className="text-xs text-gray-400 block font-semibold uppercase">
                  {viewPayment.paymentType === "AGAINST_BILL" ? "Against Bill Payment" : "Unallocated Advance"}
                </span>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  {viewPayment.partyName || "Customer Payment"}
                </h3>
                <span className="text-xs text-gray-500">{formatDate(viewPayment.paymentDate)}</span>
              </div>

              <div className="text-right">
                <span className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 block">
                  {formatCurrency(viewPayment.amount)}
                </span>
                <Badge variant={viewPayment.paymentType === "AGAINST_BILL" ? "info" : "neutral"}>
                  {viewPayment.paymentMode}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="card p-3 space-y-1">
                <span className="text-gray-400 font-bold uppercase text-[10px]">Reference Info</span>
                <div>
                  <span className="text-gray-500 block">Ref / UTR:</span>
                  <span className="font-mono font-semibold">{viewPayment.referenceNumber || "—"}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Bank Name:</span>
                  <span>{viewPayment.bankName || "—"}</span>
                </div>
              </div>

              <div className="card p-3 space-y-1">
                <span className="text-gray-400 font-bold uppercase text-[10px]">Allocation Status</span>
                <div>
                  <span className="text-gray-500 block">Status:</span>
                  <span className="font-semibold">
                    {viewPayment.isFullyAllocated ? "Fully Allocated" : "Unallocated"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block">Unallocated Balance:</span>
                  <span className="font-mono font-semibold text-purple-600">
                    {formatCurrency(viewPayment.unallocatedAmount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Allocation breakdown */}
            {viewPayment.allocations && viewPayment.allocations.length > 0 && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-3 bg-gray-50/50 dark:bg-gray-800/30">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-2">
                  Allocated Bill Invoice
                </span>
                {viewPayment.allocations.map((a) => (
                  <div key={a.id} className="flex justify-between items-center text-xs font-mono">
                    <span>Bill {a.billNumber ? `#${a.billNumber}` : a.billId}</span>
                    <span className="font-bold text-emerald-600">{formatCurrency(a.allocatedAmount)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Ledger entry notice */}
            <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl text-xs text-gray-500">
              <strong>Ledger Posting:</strong> Posted as DEBIT entry under <code>{viewPayment.paymentMode === "CASH" ? "PAYMENT_CASH" : "PAYMENT_BANK"}</code>.
            </div>

            {viewPayment.remarks && (
              <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl text-xs text-gray-600 dark:text-gray-300">
                <strong>Remarks:</strong> {viewPayment.remarks}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="secondary" size="sm" onClick={() => setViewPayment(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
