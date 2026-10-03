"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Search,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button, Badge } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useMasterList } from "@/lib/use-master-list";
import { useApiClient, ApiError } from "@/lib/api-client";
import { useFirm } from "@/lib/firm-context";
import { Modal } from "@/components/ui/modal";
import { formatCurrency, formatDate } from "@/lib/utils";

// ─── Interfaces ────────────────────────────────────────────────
interface PartyRecord {
  id: string;
  firmId: string;
  name: string;
  city?: string | null;
  gstin?: string | null;
  phone?: string | null;
}

interface OpeningBalanceRecord {
  id: string;
  firmId: string;
  partyId: string;
  financialYear: string;
  amount: string | number;
  balanceType: "CREDIT" | "DEBIT";
  effectiveDate: string;
  notes?: string | null;
}

interface LedgerTransactionRecord {
  id: string;
  firmId: string;
  partyId: string;
  transactionDate: string;
  particulars: string;
  voucherType: string;
  voucherNumber?: string | null;
  entryType: "DEBIT" | "CREDIT";
  debitAmount: string | number;
  creditAmount: string | number;
  runningBalance: string | number;
  sourceEntityType?: string | null;
  sourceEntityId?: string | null;
  notes?: string | null;
  createdAt?: string;
}

export default function LedgerPage() {
  const api = useApiClient();
  const { currentFirm } = useFirm();

  // Master parties list for current active firm
  const { data: parties } = useMasterList<PartyRecord>({
    endpoint: "/api/parties",
  });

  // State
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [voucherTypeFilter, setVoucherTypeFilter] = useState<string>("ALL");
  const [entryTypeFilter, setEntryTypeFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activePreset, setActivePreset] = useState<string>("ALL_TIME");

  // Fetched data
  const [ledgerEntries, setLedgerEntries] = useState<LedgerTransactionRecord[]>([]);
  const [openingBalance, setOpeningBalance] = useState<OpeningBalanceRecord | null>(null);
  const [loadingLedger, setLoadingLedger] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Detail Modal
  const [viewTx, setViewTx] = useState<LedgerTransactionRecord | null>(null);

  // Selected party object
  const selectedParty = useMemo(() => {
    return parties.find((p) => p.id === selectedPartyId) || null;
  }, [parties, selectedPartyId]);

  // Fetch Ledger data when party or date filters change
  const fetchLedger = useCallback(async () => {
    if (!api.ready || !selectedPartyId) {
      setLedgerEntries((prev) => (prev.length > 0 ? [] : prev));
      setOpeningBalance((prev) => (prev !== null ? null : prev));
      return;
    }

    setLoadingLedger(true);
    setFetchError(null);

    try {
      // 1. Fetch opening balance for party
      const obList = await api.get<OpeningBalanceRecord[]>("/api/opening-balances");
      const partyOB = obList.find((ob) => ob.partyId === selectedPartyId) || null;
      setOpeningBalance(partyOB);

      // 2. Build query parameters for backend
      const params = new URLSearchParams({ partyId: selectedPartyId });
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);
      if (voucherTypeFilter !== "ALL") params.append("voucherType", voucherTypeFilter);
      if (entryTypeFilter !== "ALL") params.append("entryType", entryTypeFilter);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());

      const txs = await api.get<LedgerTransactionRecord[]>(`/api/ledger?${params.toString()}`);
      setLedgerEntries(txs);
    } catch (err: any) {
      setFetchError(err instanceof ApiError ? err.message : "Failed to load customer ledger");
    } finally {
      setLoadingLedger(false);
    }
  }, [api.ready, api.firmUuid, selectedPartyId, dateFrom, dateTo, voucherTypeFilter, entryTypeFilter, searchQuery]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  // Date Presets Handler
  const handlePresetChange = (preset: string) => {
    setActivePreset(preset);
    const today = new Date();
    const yyyy = today.getFullYear();

    if (preset === "ALL_TIME") {
      setDateFrom("");
      setDateTo("");
    } else if (preset === "THIS_MONTH") {
      const firstDay = new Date(yyyy, today.getMonth(), 1).toISOString().split("T")[0];
      const lastDay = new Date(yyyy, today.getMonth() + 1, 0).toISOString().split("T")[0];
      setDateFrom(firstDay);
      setDateTo(lastDay);
    } else if (preset === "THIS_FY") {
      // Indian Financial Year: April 1 to March 31
      const startYear = today.getMonth() >= 3 ? yyyy : yyyy - 1;
      setDateFrom(`${startYear}-04-01`);
      setDateTo(`${startYear + 1}-03-31`);
    }
  };

  // Summary Metrics Calculations
  const summaryMetrics = useMemo(() => {
    let totalCredits = 0; // Bills
    let totalDebits = 0;  // Payments / TDS / Debit Notes

    ledgerEntries.forEach((tx) => {
      totalCredits += Number(tx.creditAmount || 0);
      totalDebits += Number(tx.debitAmount || 0);
    });

    const obAmount = openingBalance ? Number(openingBalance.amount || 0) : 0;
    const obType = openingBalance?.balanceType || "CREDIT";
    const initialObVal = obType === "CREDIT" ? obAmount : -obAmount;

    // Running Balance = Opening Balance + Credits - Debits
    const latestTx = ledgerEntries.length > 0 ? ledgerEntries[ledgerEntries.length - 1] : null;
    const currentBalance = latestTx
      ? Number(latestTx.runningBalance || 0)
      : initialObVal;

    return {
      obAmount,
      obType,
      totalCredits,
      totalDebits,
      currentBalance,
    };
  }, [ledgerEntries, openingBalance]);

  // Voucher Type Label & Badge Styling
  const renderVoucherBadge = (type: string) => {
    switch (type) {
      case "TRANSPORTATION_CHARGES_RCM":
        return <Badge variant="info">Freight Bill (Cr)</Badge>;
      case "DEBIT_NOTE_RCM":
        return <Badge variant="warning">Debit Note (Dr)</Badge>;
      case "TDS_JOURNAL":
        return <Badge variant="neutral">TDS (Dr)</Badge>;
      case "PAYMENT_CASH":
        return <Badge variant="success">Cash Received (Dr)</Badge>;
      case "PAYMENT_BANK":
        return <Badge variant="success">Bank Receipt (Dr)</Badge>;
      case "OPENING_BALANCE":
        return <Badge variant="neutral">Opening Balance</Badge>;
      case "ADVANCE_RECEIPT":
        return <Badge variant="success">Advance Received (Dr)</Badge>;
      default:
        return <Badge variant="neutral">{type}</Badge>;
    }
  };

  // Table Columns
  const columns: Column<LedgerTransactionRecord>[] = [
    {
      key: "transactionDate",
      label: "Date",
      render: (tx) => <span className="font-mono-nums text-xs font-semibold">{formatDate(tx.transactionDate)}</span>,
    },
    {
      key: "voucherType",
      label: "Voucher Type",
      render: (tx) => renderVoucherBadge(tx.voucherType),
    },
    {
      key: "voucherNumber",
      label: "Voucher / Ref No",
      render: (tx) => (
        <span className="font-mono-nums text-xs font-semibold text-[#1A1D20]">
          {tx.voucherNumber || "—"}
        </span>
      ),
    },
    {
      key: "particulars",
      label: "Particulars",
      render: (tx) => (
        <div className="max-w-md">
          <p className="text-xs font-medium text-[#1A1D20]">{tx.particulars}</p>
          {tx.notes && <p className="text-[11px] text-[#7A7F85] italic mt-0.5">{tx.notes}</p>}
        </div>
      ),
    },
    {
      key: "debitAmount",
      label: "Debit (Dr ₹)",
      align: "right",
      render: (tx) => {
        const dr = Number(tx.debitAmount || 0);
        return dr > 0 ? (
          <span className="font-mono-nums text-xs font-bold text-[#2E7D32]">
            {formatCurrency(dr)}
          </span>
        ) : (
          <span className="text-[#7A7F85] text-xs">—</span>
        );
      },
    },
    {
      key: "creditAmount",
      label: "Credit (Cr ₹)",
      align: "right",
      render: (tx) => {
        const cr = Number(tx.creditAmount || 0);
        return cr > 0 ? (
          <span className="font-mono-nums text-xs font-bold text-[#0288D1]">
            {formatCurrency(cr)}
          </span>
        ) : (
          <span className="text-[#7A7F85] text-xs">—</span>
        );
      },
    },
    {
      key: "runningBalance",
      label: "Running Balance (₹)",
      align: "right",
      render: (tx) => {
        const bal = Number(tx.runningBalance || 0);
        const isCr = bal >= 0;
        return (
          <div className="text-right">
            <span
              className={`font-mono-nums text-xs font-bold ${
                isCr ? "text-[#0288D1]" : "text-[#2E7D32]"
              }`}
            >
              {formatCurrency(Math.abs(bal))}
            </span>
            <span className="text-[10px] ml-1 font-bold text-[#7A7F85]">{isCr ? "Cr" : "Dr"}</span>
          </div>
        );
      },
    },
    {
      key: "actions",
      label: "Action",
      align: "right",
      render: (tx) => (
        <button
          type="button"
          className="rounded-lg border border-[#D8D5CE] bg-white px-2.5 py-1 text-xs font-semibold text-[#1A1D20] hover:bg-[#FAF8F5] transition-colors"
          onClick={() => setViewTx(tx)}
          title="View Transaction Details"
        >
          Details
        </button>
      ),
    },
  ];

  return (
    <div className="animate-fade-in space-y-6 text-[#1A1D20]">
      {/* Page Header */}
      <PageHeader
        title="Customer Ledger Statement"
        subtitle={`Official accounting ledger for ${currentFirm?.name || "Active Firm"}`}
        breadcrumbs={[{ label: "Ledger", href: "/ledger" }]}
        actions={
          selectedPartyId ? (
            <div className="flex items-center gap-2">
              <a
                href={`/api/ledger/pdf?firmId=${currentFirm?.id || ""}&partyId=${selectedPartyId}&dateFrom=${dateFrom || ""}&dateTo=${dateTo || ""}&voucherType=${voucherTypeFilter !== "ALL" ? voucherTypeFilter : ""}&entryType=${entryTypeFilter !== "ALL" ? entryTypeFilter : ""}&search=${encodeURIComponent(searchQuery)}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary text-xs"
                id="ledger-print-pdf"
              >
                Print PDF
              </a>
              <a
                href={`/api/ledger/pdf?firmId=${currentFirm?.id || ""}&partyId=${selectedPartyId}&dateFrom=${dateFrom || ""}&dateTo=${dateTo || ""}&voucherType=${voucherTypeFilter !== "ALL" ? voucherTypeFilter : ""}&entryType=${entryTypeFilter !== "ALL" ? entryTypeFilter : ""}&search=${encodeURIComponent(searchQuery)}&download=true`}
                className="btn btn-primary text-xs"
                id="ledger-download-pdf"
              >
                Export PDF
              </a>
            </div>
          ) : undefined
        }
      />

      {/* Error Alert */}
      {fetchError && (
        <div className="p-4 rounded-xl bg-[#FDEDED] border border-[#D32F2F]/30 text-[#D32F2F] text-xs">
          <p className="font-semibold">{fetchError}</p>
        </div>
      )}

      {/* Customer / Party Selection Card */}
      <div className="rounded-2xl border border-[#D8D5CE] bg-white p-5 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#5F6368] mb-2">
              Select Customer / Party <span className="text-[#D32F2F]">*</span>
            </label>
            <select
              value={selectedPartyId}
              onChange={(e) => setSelectedPartyId(e.target.value)}
              className="form-input font-semibold text-sm h-11"
            >
              <option value="">-- Choose Party to View Ledger Statement --</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.city ? `(${p.city})` : ""} {p.gstin ? `— GST: ${p.gstin}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Button
              variant="coral"
              className="w-full h-11 justify-center font-semibold text-xs"
              onClick={fetchLedger}
              disabled={!selectedPartyId || loadingLedger}
            >
              {loadingLedger ? "Refreshing..." : "Refresh Statement"}
            </Button>
          </div>
        </div>
      </div>

      {/* When NO Party Selected: Clear Empty State */}
      {!selectedPartyId && (
        <div className="rounded-2xl border border-dashed border-[#D8D5CE] bg-[#FAF8F5] py-16 px-6 text-center">
          <h3 className="text-base font-bold text-[#1A1D20] mb-1">
            No Customer Selected
          </h3>
          <p className="text-xs text-[#5F6368] max-w-md mx-auto">
            Please select a customer from the dropdown above to load their official party ledger statement, opening balance, and running balance history.
          </p>
        </div>
      )}

      {/* When Party Selected: Show Summary Cards, Filter Toolbar, and Ledger Table */}
      {selectedPartyId && selectedParty && (
        <>
          {/* Party Header Banner & Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* Opening Balance Card */}
            <div className="rounded-2xl border border-[#D8D5CE] bg-white p-4 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A7F85] block mb-1">
                Opening Balance
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono-nums text-[#1A1D20]">
                  {formatCurrency(summaryMetrics.obAmount)}
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#FAF8F5] border border-[#D8D5CE] text-[#5F6368]">
                  {summaryMetrics.obType}
                </span>
              </div>
              <p className="text-[11px] text-[#7A7F85] mt-1">
                Effective: {openingBalance ? formatDate(openingBalance.effectiveDate) : "Period Start"}
              </p>
            </div>

            {/* Total Credits (Bills) */}
            <div className="rounded-2xl border border-[#D8D5CE] bg-white p-4 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#0288D1] block mb-1">
                Total Billed (Credits)
              </span>
              <span className="text-xl font-bold font-mono-nums text-[#0288D1] block">
                {formatCurrency(summaryMetrics.totalCredits)}
              </span>
              <p className="text-[11px] text-[#7A7F85] mt-1">
                Freight & Debit Notes (Cr)
              </p>
            </div>

            {/* Total Debits (Payments & TDS) */}
            <div className="rounded-2xl border border-[#D8D5CE] bg-white p-4 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#2E7D32] block mb-1">
                Total Paid / Received (Debits)
              </span>
              <span className="text-xl font-bold font-mono-nums text-[#2E7D32] block">
                {formatCurrency(summaryMetrics.totalDebits)}
              </span>
              <p className="text-[11px] text-[#7A7F85] mt-1">
                Receipts, Cash & TDS (Dr)
              </p>
            </div>

            {/* Current Running Balance */}
            <div className="rounded-2xl border border-[#D8D5CE] bg-white p-4 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#E05638] block mb-1">
                Net Outstanding Balance
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono-nums text-[#1A1D20]">
                  {formatCurrency(Math.abs(summaryMetrics.currentBalance))}
                </span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded border ${
                    summaryMetrics.currentBalance >= 0
                      ? "bg-[#E1F5FE] text-[#0288D1] border-[#81D4FA]"
                      : "bg-[#E8F5E9] text-[#2E7D32] border-[#A5D6A7]"
                  }`}
                >
                  {summaryMetrics.currentBalance >= 0 ? "Cr (Receivable)" : "Dr (Surplus)"}
                </span>
              </div>
              <p className="text-[11px] text-[#7A7F85] mt-1">
                OB + Credits - Debits
              </p>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div className="rounded-2xl border border-[#D8D5CE] bg-white p-4 space-y-3 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EFECE6] pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#5F6368]">
                Statement Filters
              </span>

              {/* Date Presets */}
              <div className="flex items-center gap-1.5 bg-[#FAF8F5] p-1 rounded-lg text-xs font-semibold border border-[#D8D5CE]">
                <button
                  onClick={() => handlePresetChange("ALL_TIME")}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    activePreset === "ALL_TIME"
                      ? "bg-[#E05638] text-white shadow-xs"
                      : "text-[#5F6368] hover:text-[#1A1D20]"
                  }`}
                >
                  All Time
                </button>
                <button
                  onClick={() => handlePresetChange("THIS_MONTH")}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    activePreset === "THIS_MONTH"
                      ? "bg-[#E05638] text-white shadow-xs"
                      : "text-[#5F6368] hover:text-[#1A1D20]"
                  }`}
                >
                  This Month
                </button>
                <button
                  onClick={() => handlePresetChange("THIS_FY")}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    activePreset === "THIS_FY"
                      ? "bg-[#E05638] text-white shadow-xs"
                      : "text-[#5F6368] hover:text-[#1A1D20]"
                  }`}
                >
                  This FY
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              {/* Date From */}
              <div>
                <label className="block text-[11px] font-bold text-[#5F6368] mb-1 uppercase tracking-wider">Date From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setActivePreset("CUSTOM");
                  }}
                  className="form-input text-xs"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="block text-[11px] font-bold text-[#5F6368] mb-1 uppercase tracking-wider">Date To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setActivePreset("CUSTOM");
                  }}
                  className="form-input text-xs"
                />
              </div>

              {/* Voucher Type */}
              <div>
                <label className="block text-[11px] font-bold text-[#5F6368] mb-1 uppercase tracking-wider">Voucher Type</label>
                <select
                  value={voucherTypeFilter}
                  onChange={(e) => setVoucherTypeFilter(e.target.value)}
                  className="form-input text-xs"
                >
                  <option value="ALL">All Voucher Types</option>
                  <option value="TRANSPORTATION_CHARGES_RCM">Freight Bills (Cr)</option>
                  <option value="PAYMENT_CASH">Cash Payments (Dr)</option>
                  <option value="PAYMENT_BANK">Bank Receipts (Dr)</option>
                  <option value="DEBIT_NOTE_RCM">Debit Notes (Dr)</option>
                  <option value="TDS_JOURNAL">TDS Entries (Dr)</option>
                  <option value="OPENING_BALANCE">Opening Balance</option>
                </select>
              </div>

              {/* Entry Type */}
              <div>
                <label className="block text-[11px] font-bold text-[#5F6368] mb-1 uppercase tracking-wider">Entry Side</label>
                <select
                  value={entryTypeFilter}
                  onChange={(e) => setEntryTypeFilter(e.target.value)}
                  className="form-input text-xs"
                >
                  <option value="ALL">All Entries (Cr & Dr)</option>
                  <option value="CREDIT">Credits Only (Bills)</option>
                  <option value="DEBIT">Debits Only (Payments/TDS)</option>
                </select>
              </div>

              {/* Search Particulars / Ref */}
              <div>
                <label className="block text-[11px] font-bold text-[#5F6368] mb-1 uppercase tracking-wider">Search Ref / Text</label>
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-2.5 text-[#7A7F85]" />
                  <input
                    type="text"
                    placeholder="Search particulars..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="form-input pl-8 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Ledger Transactions Table */}
          <DataTable
            columns={columns}
            data={ledgerEntries}
            loading={loadingLedger}
            emptyState={
              <div className="flex flex-col items-center py-10 text-[#7A7F85] text-sm">
                No ledger transactions match the selected party and date range.
              </div>
            }
          />
        </>
      )}

      {/* Read-Only Transaction Voucher Detail Modal */}
      {viewTx && (
        <Modal
          open={Boolean(viewTx)}
          onClose={() => setViewTx(null)}
          title="Ledger Transaction Voucher Details"
          size="lg"
        >
          <div className="space-y-4 text-[#1A1D20]">
            <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#D8D5CE] flex items-center justify-between shadow-xs">
              <div>
                <span className="text-[10px] font-bold uppercase text-[#7A7F85]">Party / Customer</span>
                <h4 className="text-base font-bold text-[#1A1D20] mt-0.5">
                  {selectedParty?.name}
                </h4>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase text-[#7A7F85]">Transaction Date</span>
                <span className="font-mono-nums text-xs font-bold text-[#1A1D20] block mt-0.5">
                  {formatDate(viewTx.transactionDate)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-[#D8D5CE] bg-white p-3.5 space-y-1 shadow-xs">
                <span className="text-[#7A7F85] font-bold uppercase text-[10px]">Voucher Details</span>
                <div>
                  <span className="text-[#5F6368] block">Voucher Type:</span>
                  <div className="mt-1">{renderVoucherBadge(viewTx.voucherType)}</div>
                </div>
                <div className="pt-1">
                  <span className="text-[#5F6368] block">Voucher / Ref No:</span>
                  <span className="font-mono-nums font-bold text-[#1A1D20]">
                    {viewTx.voucherNumber || "—"}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-[#D8D5CE] bg-white p-3.5 space-y-1 shadow-xs">
                <span className="text-[#7A7F85] font-bold uppercase text-[10px]">Financial Impact</span>
                <div>
                  <span className="text-[#5F6368] block">Entry Type:</span>
                  <span
                    className={`font-bold uppercase text-xs ${
                      viewTx.entryType === "CREDIT" ? "text-[#0288D1]" : "text-[#2E7D32]"
                    }`}
                  >
                    {viewTx.entryType}
                  </span>
                </div>
                <div className="pt-1">
                  <span className="text-[#5F6368] block">Amount:</span>
                  <span className="font-mono-nums text-sm font-bold text-[#1A1D20]">
                    {formatCurrency(
                      viewTx.entryType === "CREDIT"
                        ? Number(viewTx.creditAmount || 0)
                        : Number(viewTx.debitAmount || 0)
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#D8D5CE] bg-white p-3.5 text-xs space-y-1 shadow-xs">
              <span className="text-[#7A7F85] font-bold uppercase text-[10px]">Particulars / Narrative</span>
              <p className="font-medium text-[#1A1D20]">{viewTx.particulars}</p>
              {viewTx.notes && <p className="text-[#7A7F85] italic mt-1">{viewTx.notes}</p>}
            </div>

            <div className="rounded-xl border border-[#D8D5CE] bg-[#FAF8F5] p-3.5 text-xs space-y-2 shadow-xs">
              <span className="text-[#7A7F85] font-bold uppercase text-[10px]">Audit & Traceability</span>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono-nums">
                <div>
                  <span className="text-[#7A7F85] block">Source Entity Type:</span>
                  <span className="font-semibold text-[#1A1D20]">
                    {viewTx.sourceEntityType || "system_ledger"}
                  </span>
                </div>
                <div>
                  <span className="text-[#7A7F85] block">Reference Tag:</span>
                  <span className="font-semibold text-[#1A1D20]">
                    {viewTx.sourceEntityId ? `REF-${viewTx.sourceEntityId.slice(0, 8).toUpperCase()}` : "N/A"}
                  </span>
                </div>
              </div>
              <div className="pt-2 border-t border-[#D8D5CE] flex justify-between text-[11px] font-mono-nums">
                <span className="text-[#5F6368]">Post-Transaction Running Balance:</span>
                <span className="font-bold text-[#E05638]">
                  {formatCurrency(Math.abs(Number(viewTx.runningBalance || 0)))}{" "}
                  {Number(viewTx.runningBalance || 0) >= 0 ? "Cr" : "Dr"}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-3 mt-3 border-t border-[#D8D5CE]">
              <Button variant="secondary" onClick={() => setViewTx(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
