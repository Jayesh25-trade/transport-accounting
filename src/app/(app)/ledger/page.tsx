"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  BookOpen,
  Search,
  Eye,
  Users,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  AlertCircle,
  Scale,
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
      render: (tx) => <span className="font-mono text-xs font-semibold">{formatDate(tx.transactionDate)}</span>,
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
        <span className="font-mono text-xs font-medium text-gray-700 dark:text-gray-300">
          {tx.voucherNumber || "—"}
        </span>
      ),
    },
    {
      key: "particulars",
      label: "Particulars",
      render: (tx) => (
        <div className="max-w-md">
          <p className="text-xs font-medium text-gray-900 dark:text-gray-100">{tx.particulars}</p>
          {tx.notes && <p className="text-[11px] text-gray-500 italic mt-0.5">{tx.notes}</p>}
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
          <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(dr)}
          </span>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
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
          <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
            {formatCurrency(cr)}
          </span>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
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
              className={`font-mono text-xs font-extrabold ${
                isCr ? "text-blue-700 dark:text-blue-300" : "text-emerald-700 dark:text-emerald-300"
              }`}
            >
              {formatCurrency(Math.abs(bal))}
            </span>
            <span className="text-[10px] ml-1 font-bold text-gray-500">{isCr ? "Cr" : "Dr"}</span>
          </div>
        );
      },
    },
    {
      key: "actions",
      label: "Action",
      align: "right",
      render: (tx) => (
        <Button
          variant="ghost"
          size="sm"
          icon={Eye}
          onClick={() => setViewTx(tx)}
          title="View Transaction Details"
        >
          Details
        </Button>
      ),
    },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Customer Ledger Statement"
        subtitle={`Official accounting ledger for ${currentFirm?.name || "Active Firm"}`}
        breadcrumbs={[{ label: "Ledger", href: "/ledger" }]}
      />

      {/* Error Alert */}
      {fetchError && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 flex items-center gap-3 text-red-700 dark:text-red-300">
          <AlertCircle size={20} className="flex-shrink-0 text-red-500" />
          <p className="text-sm font-medium">{fetchError}</p>
        </div>
      )}

      {/* Customer / Party Selection Card */}
      <div className="card p-5 bg-white dark:bg-gray-900 shadow-sm border border-gray-200 dark:border-gray-800">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
              <Users size={14} className="text-primary-500" /> Select Customer / Party <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedPartyId}
              onChange={(e) => setSelectedPartyId(e.target.value)}
              className="w-full h-11 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 text-sm font-semibold text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:outline-none"
            >
              <option value="">-- Choose Party to View Ledger Statement --</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.city ? `(${p.city})` : ""} {p.gstin ? `— GST: ${p.gstin}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              className="w-full h-11 justify-center font-semibold"
              onClick={fetchLedger}
              disabled={!selectedPartyId || loadingLedger}
              icon={BookOpen}
            >
              {loadingLedger ? "Refreshing..." : "Refresh Statement"}
            </Button>
          </div>
        </div>
      </div>

      {/* When NO Party Selected: Clear Empty State */}
      {!selectedPartyId && (
        <div className="card py-16 px-6 text-center bg-white dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-800">
          <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-950/40 flex items-center justify-center mx-auto mb-4 text-primary-600">
            <Users size={32} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
            No Customer Selected
          </h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
            Please select a customer from the dropdown above to load their official party ledger statement, opening balance, and running balance history.
          </p>
        </div>
      )}

      {/* When Party Selected: Show Summary Cards, Filter Toolbar, and Ledger Table */}
      {selectedPartyId && selectedParty && (
        <>
          {/* Party Header Banner & Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Opening Balance Card */}
            <div className="card p-4 bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-900 dark:to-gray-800/50 border border-gray-200 dark:border-gray-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                Opening Balance
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black font-mono text-gray-900 dark:text-gray-100">
                  {formatCurrency(summaryMetrics.obAmount)}
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  {summaryMetrics.obType}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                Effective: {openingBalance ? formatDate(openingBalance.effectiveDate) : "Period Start"}
              </p>
            </div>

            {/* Total Credits (Bills) */}
            <div className="card p-4 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 dark:from-blue-950/20 dark:to-indigo-950/10 border border-blue-100 dark:border-blue-900/30">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block mb-1 flex items-center justify-between">
                Total Billed (Credits) <ArrowUpRight size={14} className="text-blue-500" />
              </span>
              <span className="text-xl font-black font-mono text-blue-700 dark:text-blue-300 block">
                {formatCurrency(summaryMetrics.totalCredits)}
              </span>
              <p className="text-[11px] text-blue-600/80 dark:text-blue-400/80 mt-1">
                Freight & Debit Notes (Cr)
              </p>
            </div>

            {/* Total Debits (Payments & TDS) */}
            <div className="card p-4 bg-gradient-to-br from-emerald-50/50 to-teal-50/30 dark:from-emerald-950/20 dark:to-teal-950/10 border border-emerald-100 dark:border-emerald-900/30">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block mb-1 flex items-center justify-between">
                Total Paid / Received (Debits) <ArrowDownLeft size={14} className="text-emerald-500" />
              </span>
              <span className="text-xl font-black font-mono text-emerald-700 dark:text-emerald-300 block">
                {formatCurrency(summaryMetrics.totalDebits)}
              </span>
              <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-1">
                Receipts, Cash & TDS (Dr)
              </p>
            </div>

            {/* Current Running Balance */}
            <div className="card p-4 bg-gradient-to-br from-purple-50/50 to-pink-50/30 dark:from-purple-950/20 dark:to-pink-950/10 border border-purple-200 dark:border-purple-900/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 block mb-1 flex items-center justify-between">
                Net Outstanding Balance <Scale size={14} className="text-purple-600" />
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black font-mono text-purple-900 dark:text-purple-100">
                  {formatCurrency(Math.abs(summaryMetrics.currentBalance))}
                </span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded ${
                    summaryMetrics.currentBalance >= 0
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
                  }`}
                >
                  {summaryMetrics.currentBalance >= 0 ? "Cr (Receivable)" : "Dr (Surplus)"}
                </span>
              </div>
              <p className="text-[11px] text-purple-600/80 dark:text-purple-400/80 mt-1">
                OB + Credits - Debits
              </p>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div className="card p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-gray-400" />
                <span className="text-xs font-bold uppercase text-gray-700 dark:text-gray-300">
                  Statement Filters
                </span>
              </div>

              {/* Date Presets */}
              <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg text-xs font-semibold">
                <button
                  onClick={() => handlePresetChange("ALL_TIME")}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    activePreset === "ALL_TIME"
                      ? "bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-xs"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
                  }`}
                >
                  All Time
                </button>
                <button
                  onClick={() => handlePresetChange("THIS_MONTH")}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    activePreset === "THIS_MONTH"
                      ? "bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-xs"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
                  }`}
                >
                  This Month
                </button>
                <button
                  onClick={() => handlePresetChange("THIS_FY")}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    activePreset === "THIS_FY"
                      ? "bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-xs"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
                  }`}
                >
                  This FY
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              {/* Date From */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1">Date From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setActivePreset("CUSTOM");
                  }}
                  className="w-full h-9 px-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-xs font-semibold"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1">Date To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setActivePreset("CUSTOM");
                  }}
                  className="w-full h-9 px-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-xs font-semibold"
                />
              </div>

              {/* Voucher Type */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1">Voucher Type</label>
                <select
                  value={voucherTypeFilter}
                  onChange={(e) => setVoucherTypeFilter(e.target.value)}
                  className="w-full h-9 px-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-xs font-semibold"
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
                <label className="block text-[11px] font-bold text-gray-500 mb-1">Entry Side</label>
                <select
                  value={entryTypeFilter}
                  onChange={(e) => setEntryTypeFilter(e.target.value)}
                  className="w-full h-9 px-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-xs font-semibold"
                >
                  <option value="ALL">All Entries (Cr & Dr)</option>
                  <option value="CREDIT">Credits Only (Bills)</option>
                  <option value="DEBIT">Debits Only (Payments/TDS)</option>
                </select>
              </div>

              {/* Search Particulars / Ref */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1">Search Ref / Text</label>
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search particulars..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-9 pl-8 pr-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-xs font-medium"
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
              <div className="flex flex-col items-center py-10 text-gray-400 text-sm">
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
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-gray-400 block">Party / Customer</span>
                <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  {selectedParty?.name}
                </h4>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase text-gray-400 block">Transaction Date</span>
                <span className="font-mono text-xs font-bold text-gray-900 dark:text-gray-100">
                  {formatDate(viewTx.transactionDate)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="card p-3 space-y-1">
                <span className="text-gray-400 font-bold uppercase text-[10px]">Voucher Details</span>
                <div>
                  <span className="text-gray-500 block">Voucher Type:</span>
                  <div className="mt-1">{renderVoucherBadge(viewTx.voucherType)}</div>
                </div>
                <div className="pt-1">
                  <span className="text-gray-500 block">Voucher / Ref No:</span>
                  <span className="font-mono font-bold text-gray-800 dark:text-gray-200">
                    {viewTx.voucherNumber || "—"}
                  </span>
                </div>
              </div>

              <div className="card p-3 space-y-1">
                <span className="text-gray-400 font-bold uppercase text-[10px]">Financial Impact</span>
                <div>
                  <span className="text-gray-500 block">Entry Type:</span>
                  <span
                    className={`font-bold uppercase text-xs ${
                      viewTx.entryType === "CREDIT" ? "text-blue-600" : "text-emerald-600"
                    }`}
                  >
                    {viewTx.entryType}
                  </span>
                </div>
                <div className="pt-1">
                  <span className="text-gray-500 block">Amount:</span>
                  <span className="font-mono text-sm font-black text-gray-900 dark:text-gray-100">
                    {formatCurrency(
                      viewTx.entryType === "CREDIT"
                        ? Number(viewTx.creditAmount || 0)
                        : Number(viewTx.debitAmount || 0)
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="card p-3 text-xs space-y-1">
              <span className="text-gray-400 font-bold uppercase text-[10px]">Particulars / Narrative</span>
              <p className="font-medium text-gray-800 dark:text-gray-200">{viewTx.particulars}</p>
              {viewTx.notes && <p className="text-gray-500 italic mt-1">{viewTx.notes}</p>}
            </div>

            <div className="card p-3 text-xs space-y-2 bg-gray-50 dark:bg-gray-800/50">
              <span className="text-gray-400 font-bold uppercase text-[10px]">Audit & Traceability</span>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div>
                  <span className="text-gray-500 block">Source Entity Type:</span>
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    {viewTx.sourceEntityType || "system_ledger"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block">Source Entity ID:</span>
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    {viewTx.sourceEntityId || "N/A"}
                  </span>
                </div>
              </div>
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between text-[11px] font-mono">
                <span className="text-gray-500">Post-Transaction Running Balance:</span>
                <span className="font-black text-purple-700 dark:text-purple-300">
                  {formatCurrency(Math.abs(Number(viewTx.runningBalance || 0)))}{" "}
                  {Number(viewTx.runningBalance || 0) >= 0 ? "Cr" : "Dr"}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-3 mt-3 border-t border-gray-100 dark:border-gray-800">
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
