"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useFirm } from "@/lib/firm-context";
import { PageHeader } from "@/components/ui/page-header";
import { Button, Badge } from "@/components/ui/primitives";
import {
  BookOpen,
  FileText,
  CreditCard,
  Clock,
  BarChart3,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Calendar,
  CheckCircle2,
  DollarSign,
  Truck,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface DashboardData {
  dailyBook: {
    totalEntries: number;
    receivedCount: number;
    pendingCount: number;
  };
  billing: {
    billCount: number;
    grossFreightTotal: number;
    shortageDebitTotal: number;
    tdsTotal: number;
    netPayableTotal: number;
    recentBills: Array<{
      id: string;
      billNumber: string;
      billDate: string;
      partyName: string;
      netBillAmount: string;
      status: string;
    }>;
  };
  payments: {
    paymentCount: number;
    totalReceipts: number;
    againstBillTotal: number;
    advanceTotal: number;
    recentPayments: Array<{
      id: string;
      paymentDate: string;
      paymentType: string;
      paymentMode: string;
      amount: string;
      partyName: string;
      referenceNumber: string | null;
    }>;
  };
  outstanding: {
    totalOutstandingAmount: number;
    totalBills: number;
    pendingCount: number;
    partiallyPaidCount: number;
    paidCount: number;
  };
  aging: {
    totalOutstanding: number;
    bucket0to30: number;
    bucket31to60: number;
    bucket61to90: number;
    bucket91to180: number;
    bucket181Plus: number;
  };
  driverVouchers: {
    totalVouchers: number;
    totalAdvance: number;
    totalCash: number;
    totalDiesel: number;
    totalAc: number;
    totalExpense: number;
    accountingStatus: string;
    recentVouchers: any[];
  };
}

export default function DashboardPage() {
  const { currentFirm } = useFirm();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // Period Filters
  const [periodPreset, setPeriodPreset] = useState<"all" | "today" | "month" | "fy" | "custom">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchDashboardData = useCallback(async () => {
    if (!currentFirm) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(`/api/dashboard/overview?${params.toString()}`, {
        headers: { "x-firm-id": currentFirm.id },
      });

      if (res.ok) {
        const overview = await res.json();
        setData(overview);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard overview:", err);
    } finally {
      setLoading(false);
    }
  }, [currentFirm, startDate, endDate]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Preset Date Handlers
  const handlePresetChange = (preset: "all" | "today" | "month" | "fy") => {
    setPeriodPreset(preset);
    const now = new Date();

    if (preset === "all") {
      setStartDate("");
      setEndDate("");
    } else if (preset === "today") {
      const todayStr = now.toISOString().split("T")[0];
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const todayStr = now.toISOString().split("T")[0];
      setStartDate(firstDay);
      setEndDate(todayStr);
    } else if (preset === "fy") {
      // Indian Financial Year (April 1 to March 31)
      const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      setStartDate(`${year}-04-01`);
      setEndDate(`${year + 1}-03-31`);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Header */}
      <PageHeader
        title="Management Dashboard"
        subtitle="Authoritative Read-Only Overview for Active Transport Firm"
        actions={
          <Button variant="secondary" size="sm" onClick={fetchDashboardData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Overview
          </Button>
        }
      />

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded p-3 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-500 font-semibold mr-1 flex items-center gap-1">
            <FilterIcon /> Period:
          </span>
          <button
            onClick={() => handlePresetChange("all")}
            className={`px-3 py-1.5 rounded font-medium transition-colors ${
              periodPreset === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            All Time
          </button>
          <button
            onClick={() => handlePresetChange("today")}
            className={`px-3 py-1.5 rounded font-medium transition-colors ${
              periodPreset === "today" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Today
          </button>
          <button
            onClick={() => handlePresetChange("month")}
            className={`px-3 py-1.5 rounded font-medium transition-colors ${
              periodPreset === "month" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => handlePresetChange("fy")}
            className={`px-3 py-1.5 rounded font-medium transition-colors ${
              periodPreset === "fy" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            This FY (2026-27)
          </button>
        </div>

        {/* Custom Range */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPeriodPreset("custom");
              }}
              className="px-2 py-1 border border-slate-300 rounded text-xs"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPeriodPreset("custom");
              }}
              className="px-2 py-1 border border-slate-300 rounded text-xs"
            />
          </div>
        </div>
      </div>

      {/* Main Stats Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Outstanding Card */}
        <div className="bg-white border border-slate-200 rounded p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Outstanding</p>
              <p className="text-2xl font-bold text-slate-900 font-mono mt-1">
                {formatCurrency(data?.outstanding.totalOutstandingAmount || 0)}
              </p>
            </div>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>{data?.outstanding.totalBills || 0} Bills Pending Settlement</span>
            <Link href="/reports/outstanding" className="text-blue-600 hover:underline flex items-center gap-0.5">
              Report <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Total Billing Net Revenue */}
        <div className="bg-white border border-slate-200 rounded p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Billed Revenue</p>
              <p className="text-2xl font-bold text-blue-700 font-mono mt-1">
                {formatCurrency(data?.billing.netPayableTotal || 0)}
              </p>
            </div>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>{data?.billing.billCount || 0} Invoice Bills Created</span>
            <Link href="/billing/bills" className="text-blue-600 hover:underline flex items-center gap-0.5">
              Bills List <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Total Payment Receipts */}
        <div className="bg-white border border-slate-200 rounded p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Payment Receipts</p>
              <p className="text-2xl font-bold text-emerald-700 font-mono mt-1">
                {formatCurrency(data?.payments.totalReceipts || 0)}
              </p>
            </div>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Against-Bill: {formatCurrency(data?.payments.againstBillTotal || 0)}</span>
            <Link href="/payments" className="text-blue-600 hover:underline flex items-center gap-0.5">
              Payments <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Daily Trips Count */}
        <div className="bg-white border border-slate-200 rounded p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Daily Book Trips</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{data?.dailyBook.totalEntries || 0}</p>
            </div>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-emerald-700 font-medium">Received: {data?.dailyBook.receivedCount || 0}</span>
            <span className="text-amber-700 font-medium">Pending: {data?.dailyBook.pendingCount || 0}</span>
          </div>
        </div>
      </div>

      {/* Grid Row 2: Billing & Outstanding Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Billing Calculations Breakdown */}
        <div className="bg-white border border-slate-200 rounded p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              Authoritative Billing & Revenue Breakdown
            </h2>
            <Badge variant="neutral">{data?.billing.billCount || 0} Bills</Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 border border-slate-200 p-3 rounded">
              <p className="text-slate-500 font-medium">Gross Freight Subtotal</p>
              <p className="text-sm font-bold text-slate-900 font-mono mt-1">
                {formatCurrency(data?.billing.grossFreightTotal || 0)}
              </p>
            </div>

            <div className="bg-red-50 border border-red-200 p-3 rounded">
              <p className="text-red-700 font-medium">Less: Shortage Debit Notes</p>
              <p className="text-sm font-bold text-red-900 font-mono mt-1">
                - {formatCurrency(data?.billing.shortageDebitTotal || 0)}
              </p>
            </div>

            <div className="bg-purple-50 border border-purple-200 p-3 rounded">
              <p className="text-purple-700 font-medium">Less: TDS Withheld</p>
              <p className="text-sm font-bold text-purple-900 font-mono mt-1">
                - {formatCurrency(data?.billing.tdsTotal || 0)}
              </p>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded">
              <p className="text-emerald-800 font-medium">Net Bill Amount Payable</p>
              <p className="text-sm font-extrabold text-emerald-900 font-mono mt-1">
                {formatCurrency(data?.billing.netPayableTotal || 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Payments & Receipts Summary */}
        <div className="bg-white border border-slate-200 rounded p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              Payment Receipts Breakdown
            </h2>
            <Badge variant="success">{data?.payments.paymentCount || 0} Transactions</Badge>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded col-span-3 sm:col-span-1">
              <p className="text-emerald-800 font-medium">Total Received</p>
              <p className="text-base font-bold text-emerald-950 font-mono mt-1">
                {formatCurrency(data?.payments.totalReceipts || 0)}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3 rounded col-span-3 sm:col-span-1">
              <p className="text-slate-600 font-medium">Against Bill Payments</p>
              <p className="text-sm font-bold text-slate-900 font-mono mt-1">
                {formatCurrency(data?.payments.againstBillTotal || 0)}
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 p-3 rounded col-span-3 sm:col-span-1">
              <p className="text-blue-700 font-medium">Advance Payments</p>
              <p className="text-sm font-bold text-blue-900 font-mono mt-1">
                {formatCurrency(data?.payments.advanceTotal || 0)}
              </p>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded border border-slate-100 flex items-center justify-between">
            <span>Bill Settlement Statuses:</span>
            <span className="font-semibold text-slate-800">
              {data?.outstanding.pendingCount || 0} Pending | {data?.outstanding.partiallyPaidCount || 0} Partial | {data?.outstanding.paidCount || 0} Fully Paid
            </span>
          </div>
        </div>
      </div>

      {/* Customer Accounts Aging Analysis */}
      <div className="bg-white border border-slate-200 rounded p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              Customer Accounts Aging Analysis
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Authoritative bill aging breakdown across 5 standard time buckets</p>
          </div>
          <Link href="/reports/aging" className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-0.5">
            Full Aging Report <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div className="bg-emerald-50 border border-emerald-200 p-3 rounded text-center">
            <p className="text-emerald-800 font-semibold">0 – 30 Days</p>
            <p className="text-sm font-bold text-emerald-950 font-mono mt-1">
              {formatCurrency(data?.aging.bucket0to30 || 0)}
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 p-3 rounded text-center">
            <p className="text-blue-800 font-semibold">31 – 60 Days</p>
            <p className="text-sm font-bold text-blue-950 font-mono mt-1">
              {formatCurrency(data?.aging.bucket31to60 || 0)}
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 p-3 rounded text-center">
            <p className="text-amber-800 font-semibold">61 – 90 Days</p>
            <p className="text-sm font-bold text-amber-950 font-mono mt-1">
              {formatCurrency(data?.aging.bucket61to90 || 0)}
            </p>
          </div>

          <div className="bg-orange-50 border border-orange-200 p-3 rounded text-center">
            <p className="text-orange-800 font-semibold">91 – 180 Days</p>
            <p className="text-sm font-bold text-orange-950 font-mono mt-1">
              {formatCurrency(data?.aging.bucket91to180 || 0)}
            </p>
          </div>

          <div className="bg-red-50 border border-red-200 p-3 rounded text-center col-span-2 sm:col-span-1">
            <p className="text-red-800 font-semibold">181+ Days</p>
            <p className="text-sm font-extrabold text-red-950 font-mono mt-1">
              {formatCurrency(data?.aging.bucket181Plus || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Driver Vouchers Operational Expense Breakdown */}
      <div className="bg-white border border-slate-200 rounded p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Driver Vouchers Operational Expense Breakdown
            </h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
              PENDING CONFIRMATION
            </span>
          </div>
          <Link href="/driver-vouchers" className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-0.5">
            Driver Vouchers Page <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-900 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Operational Data Only:</span> Driver Voucher totals are displayed as operational advances and expenses. Accounting Dr/Cr treatment is pending client confirmation; these amounts are **not included** in ledger/accounting expense postings.
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs">
          <div className="bg-slate-50 border border-slate-200 p-3 rounded">
            <p className="text-slate-500 font-medium">Vouchers Count</p>
            <p className="text-sm font-bold text-slate-900 mt-1">{data?.driverVouchers.totalVouchers || 0}</p>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3 rounded">
            <p className="text-slate-500 font-medium">Advance</p>
            <p className="text-sm font-bold text-slate-900 font-mono mt-1">
              {formatCurrency(data?.driverVouchers.totalAdvance || 0)}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3 rounded">
            <p className="text-slate-500 font-medium">Cash</p>
            <p className="text-sm font-bold text-slate-900 font-mono mt-1">
              {formatCurrency(data?.driverVouchers.totalCash || 0)}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3 rounded">
            <p className="text-slate-500 font-medium">Diesel</p>
            <p className="text-sm font-bold text-slate-900 font-mono mt-1">
              {formatCurrency(data?.driverVouchers.totalDiesel || 0)}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3 rounded">
            <p className="text-slate-500 font-medium">A/c</p>
            <p className="text-sm font-bold text-slate-900 font-mono mt-1">
              {formatCurrency(data?.driverVouchers.totalAc || 0)}
            </p>
          </div>

          <div className="bg-amber-100/50 border border-amber-300 p-3 rounded font-bold col-span-2 sm:col-span-1">
            <p className="text-amber-900 font-semibold">Total Operational</p>
            <p className="text-sm font-extrabold text-amber-950 font-mono mt-1">
              {formatCurrency(data?.driverVouchers.totalExpense || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Grid Row 3: Recent Bills & Payments Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Bills */}
        <div className="bg-white border border-slate-200 rounded p-4 shadow-sm">
          <div className="flex items-center justify-between border-b pb-3 mb-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Recent Bills</h3>
            <Link href="/billing/bills" className="text-xs text-blue-600 hover:underline">View All →</Link>
          </div>
          {data?.billing.recentBills && data.billing.recentBills.length > 0 ? (
            <div className="divide-y divide-slate-100 text-xs">
              {data.billing.recentBills.map((b) => (
                <div key={b.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">#{b.billNumber}</p>
                    <p className="text-slate-500 text-[11px]">{b.partyName} • {formatDate(b.billDate)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-slate-900">{formatCurrency(b.netBillAmount)}</p>
                    <Badge variant={b.status === "PAID" ? "success" : b.status === "PARTIALLY_PAID" ? "warning" : "neutral"}>
                      {b.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400 text-xs">
              No bills recorded yet.
            </div>
          )}
        </div>

        {/* Recent Payments */}
        <div className="bg-white border border-slate-200 rounded p-4 shadow-sm">
          <div className="flex items-center justify-between border-b pb-3 mb-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Recent Payment Receipts</h3>
            <Link href="/payments" className="text-xs text-blue-600 hover:underline">View All →</Link>
          </div>
          {data?.payments.recentPayments && data.payments.recentPayments.length > 0 ? (
            <div className="divide-y divide-slate-100 text-xs">
              {data.payments.recentPayments.map((p) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{p.partyName}</p>
                    <p className="text-slate-500 text-[11px]">
                      {formatDate(p.paymentDate)} • {p.paymentMode} ({p.paymentType})
                    </p>
                  </div>
                  <div className="text-right font-mono font-bold text-emerald-700">
                    + {formatCurrency(p.amount)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400 text-xs">
              No payments recorded yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  );
}
