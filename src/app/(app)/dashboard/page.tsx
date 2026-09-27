"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useFirm } from "@/lib/firm-context";
import { PageHeader } from "@/components/ui/page-header";
import { Button, Badge, Panel } from "@/components/ui/primitives";
import { StatCard } from "@/components/ui/stat-card";
import { MoneyDisplay } from "@/components/ui/format-display";
import { TableShell, Th, Td } from "@/components/ui/data-table";
import {
  BookOpen,
  FileText,
  CreditCard,
  Clock,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Calendar,
  Truck,
  ArrowUpRight,
  Filter,
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
        setData(overview.data || overview);
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

  const agingMax = Math.max(
    1,
    data?.aging?.bucket0to30 || 0,
    data?.aging?.bucket31to60 || 0,
    data?.aging?.bucket61to90 || 0,
    data?.aging?.bucket91to180 || 0,
    data?.aging?.bucket181Plus || 0
  );

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Header */}
      <PageHeader
        eyebrow={`${formatDate(new Date().toISOString())} · ${currentFirm?.name || "Active Firm"}`}
        title={
          <>
            Books for <span className="text-coral">{currentFirm?.name || "Active Firm"}</span>
          </>
        }
        description="Management summary. All figures below belong only to the active firm."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/daily-book">
              <Button variant="ink" size="sm">
                📒 Add trip
              </Button>
            </Link>
            <Link href="/billing/new">
              <Button variant="coral" size="sm">
                🧾 Create bill
              </Button>
            </Link>
            <Button variant="secondary" size="sm" onClick={fetchDashboardData} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Filter Toolbar */}
      <div className="panel p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-gray-500 font-semibold mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Period:
          </span>
          <button
            onClick={() => handlePresetChange("all")}
            className={`px-3 py-1.5 rounded-full font-medium transition-colors ${
              periodPreset === "all"
                ? "bg-coral text-coral-foreground font-semibold"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
            }`}
          >
            All Time
          </button>
          <button
            onClick={() => handlePresetChange("today")}
            className={`px-3 py-1.5 rounded-full font-medium transition-colors ${
              periodPreset === "today"
                ? "bg-coral text-coral-foreground font-semibold"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
            }`}
          >
            Today
          </button>
          <button
            onClick={() => handlePresetChange("month")}
            className={`px-3 py-1.5 rounded-full font-medium transition-colors ${
              periodPreset === "month"
                ? "bg-coral text-coral-foreground font-semibold"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => handlePresetChange("fy")}
            className={`px-3 py-1.5 rounded-full font-medium transition-colors ${
              periodPreset === "fy"
                ? "bg-coral text-coral-foreground font-semibold"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
            }`}
          >
            This FY (2026-27)
          </button>
        </div>

        {/* Custom Range */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPeriodPreset("custom");
              }}
              className="px-2 py-1 border border-gray-300 rounded-lg text-xs dark:bg-gray-900 dark:border-gray-700"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPeriodPreset("custom");
              }}
              className="px-2 py-1 border border-gray-300 rounded-lg text-xs dark:bg-gray-900 dark:border-gray-700"
            />
          </div>
        </div>
      </div>

      {/* Main Stats Summary Row (4 StatCards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          tone="coral"
          label="Total Outstanding"
          value={formatCurrency(data?.outstanding?.totalOutstandingAmount || 0)}
          hint={`${data?.outstanding?.totalBills || 0} open bills`}
          icon={TrendingUp}
          iconColor="#ff5e3a"
        />
        <StatCard
          tone="ink"
          label="Net Billed Revenue"
          value={formatCurrency(data?.billing?.netPayableTotal || 0)}
          hint={`${data?.billing?.billCount || 0} bills posted`}
          icon={FileText}
          iconColor="#1a1d20"
        />
        <StatCard
          tone="sun"
          label="Payment Receipts"
          value={formatCurrency(data?.payments?.totalReceipts || 0)}
          hint={`${data?.payments?.paymentCount || 0} receipts`}
          icon={CreditCard}
          iconColor="#f59e0b"
        />
        <StatCard
          tone="turq"
          label="Daily Book Trips"
          value={String(data?.dailyBook?.totalEntries || 0)}
          hint={`${data?.dailyBook?.receivedCount || 0} received · ${data?.dailyBook?.pendingCount || 0} pending`}
          icon={BookOpen}
          iconColor="#45d4b2"
        />
      </div>

      {/* Grid Row 2: Billing, Payments, and Aging Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Billing Breakdown */}
        <Panel title="Billing breakdown">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
              <span>Gross Freight</span>
              <MoneyDisplay amount={data?.billing?.grossFreightTotal || 0} />
            </div>
            <div className="flex items-center justify-between text-red-600 dark:text-red-400">
              <span>Less: Shortage Debit Notes</span>
              <span>− <MoneyDisplay amount={data?.billing?.shortageDebitTotal || 0} className="text-red-600 dark:text-red-400" /></span>
            </div>
            <div className="flex items-center justify-between text-purple-600 dark:text-purple-400">
              <span>Less: TDS Withheld</span>
              <span>− <MoneyDisplay amount={data?.billing?.tdsTotal || 0} className="text-purple-600 dark:text-purple-400" /></span>
            </div>
            <div className="flex items-center justify-between border-t-2 border-dashed border-gray-200 dark:border-gray-800 pt-3">
              <span className="font-semibold text-gray-900 dark:text-white">Net Bill Amount</span>
              <MoneyDisplay amount={data?.billing?.netPayableTotal || 0} className="text-xl text-emerald-600 dark:text-emerald-400 font-bold" />
            </div>
          </div>
        </Panel>

        {/* Payments Summary */}
        <Panel title="Payments">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
              <span>Total Received</span>
              <MoneyDisplay amount={data?.payments?.totalReceipts || 0} />
            </div>
            <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
              <span>Against-Bill Payments</span>
              <MoneyDisplay amount={data?.payments?.againstBillTotal || 0} />
            </div>
            <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
              <span>Advance Payments</span>
              <MoneyDisplay amount={data?.payments?.advanceTotal || 0} />
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-sun-light dark:bg-amber-950/40 px-4 py-3">
              <span className="text-xs font-semibold text-gray-800 dark:text-amber-200">Bill Settlements</span>
              <span className="text-xs font-semibold tnum text-gray-900 dark:text-white">
                {data?.outstanding?.pendingCount || 0} Pending · {data?.outstanding?.partiallyPaidCount || 0} Partial · {data?.outstanding?.paidCount || 0} Paid
              </span>
            </div>
          </div>
        </Panel>

        {/* Aging Analysis */}
        <Panel
          title="Aging"
          subtitle="Outstanding by age of bill"
          action={
            <Link href="/reports/aging" className="text-xs font-semibold text-coral hover:underline flex items-center gap-0.5">
              Report <ArrowUpRight className="w-3 h-3" />
            </Link>
          }
        >
          <div className="space-y-3 text-xs">
            <AgingBar label="0 – 30 Days" amount={data?.aging?.bucket0to30 || 0} max={agingMax} />
            <AgingBar label="31 – 60 Days" amount={data?.aging?.bucket31to60 || 0} max={agingMax} />
            <AgingBar label="61 – 90 Days" amount={data?.aging?.bucket61to90 || 0} max={agingMax} />
            <AgingBar label="91 – 180 Days" amount={data?.aging?.bucket91to180 || 0} max={agingMax} />
            <AgingBar label="181+ Days" amount={data?.aging?.bucket181Plus || 0} max={agingMax} isDanger />
          </div>
        </Panel>
      </div>

      {/* Driver Vouchers Operational Summary */}
      <Panel
        title="Driver voucher summary"
        subtitle="Operational Voucher — Accounting Treatment Pending Confirmation"
        action={
          <Link href="/driver-vouchers" className="text-xs font-semibold text-coral hover:underline flex items-center gap-0.5">
            Vouchers <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
          <MiniStat label="Advance" value={data?.driverVouchers?.totalAdvance || 0} />
          <MiniStat label="Cash" value={data?.driverVouchers?.totalCash || 0} />
          <MiniStat label="Diesel" value={data?.driverVouchers?.totalDiesel || 0} />
          <MiniStat label="A/c" value={data?.driverVouchers?.totalAc || 0} />
          <MiniStat label="Total Operational" value={data?.driverVouchers?.totalExpense || 0} highlight />
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          <span>
            These operational amounts are not posted to the accounting ledger. Status:{" "}
            <Badge tone="pending">PENDING CONFIRMATION</Badge>
          </span>
        </div>
      </Panel>

      {/* Grid Row 3: Recent Bills & Recent Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Bills */}
        <Panel
          title="Recent Bills"
          subtitle="Latest invoices generated for this firm"
          action={
            <Link href="/billing/bills" className="text-xs font-semibold text-coral hover:underline">
              View All →
            </Link>
          }
        >
          {data?.billing?.recentBills && data.billing.recentBills.length > 0 ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
              {data.billing.recentBills.map((b) => (
                <div key={b.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">Bill #{b.billNumber}</p>
                    <p className="text-gray-500 text-[11px]">{b.partyName} • {formatDate(b.billDate)}</p>
                  </div>
                  <div className="text-right">
                    <MoneyDisplay amount={Number(b.netBillAmount || 0)} className="block font-bold text-gray-900 dark:text-white" />
                    <Badge tone={b.status === "PAID" ? "posted" : b.status === "PARTIALLY_PAID" ? "pending" : "neutral"}>
                      {b.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-400 text-xs">
              No bills recorded yet.
            </div>
          )}
        </Panel>

        {/* Recent Payments */}
        <Panel
          title="Recent Payment Receipts"
          subtitle="Latest receipts recorded for this firm"
          action={
            <Link href="/payments" className="text-xs font-semibold text-coral hover:underline">
              View All →
            </Link>
          }
        >
          {data?.payments?.recentPayments && data.payments.recentPayments.length > 0 ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
              {data.payments.recentPayments.map((p) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{p.partyName}</p>
                    <p className="text-gray-500 text-[11px]">
                      {formatDate(p.paymentDate)} • {p.paymentMode} ({p.paymentType})
                    </p>
                  </div>
                  <div className="text-right">
                    <MoneyDisplay amount={Number(p.amount || 0)} className="font-bold text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-400 text-xs">
              No payments recorded yet.
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function AgingBar({
  label,
  amount,
  max,
  isDanger,
}: {
  label: string;
  amount: number;
  max: number;
  isDanger?: boolean;
}) {
  const percentage = Math.min(100, Math.max(0, (amount / max) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between font-semibold">
        <span className="text-gray-500">{label}</span>
        <MoneyDisplay amount={amount} />
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isDanger ? "bg-red-500" : "bg-coral"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? "rounded-2xl bg-ink p-3.5 text-white"
          : "rounded-2xl border-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5"
      }
    >
      <div className="text-[10px] font-semibold tracking-wider uppercase opacity-70">{label}</div>
      <div className="mt-1">
        <MoneyDisplay amount={value} className={highlight ? "text-lg text-white" : "text-lg text-gray-900 dark:text-white"} />
      </div>
    </div>
  );
}
