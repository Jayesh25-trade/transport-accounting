"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useFirm } from "@/lib/firm-context";
import { formatCurrency, formatDate, formatStatusLabel, formatVoucherTypeLabel, cn } from "@/lib/utils";
import {
  TrendingUp,
  FileText,
  CreditCard,
  BookOpen,
  AlertCircle,
  RefreshCw,
  Calendar,
  ArrowUpRight,
  Filter,
  Info,
  Plus,
  FilePlus,
} from "lucide-react";

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

// ─── Header Component ─────────────────────────────────────────
function DashboardHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <div className="mb-1 text-xs font-semibold text-[#5F6368] uppercase tracking-wider">
            {eyebrow}
          </div>
        )}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1A1D20]">
          {title}
        </h1>
        {description && (
          <div className="mt-1 flex items-center gap-1.5 text-xs text-[#5F6368]">
            <Info size={14} className="text-[#E05638] shrink-0" />
            <span>{description}</span>
          </div>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  hint,
  tagLabel,
}: {
  label: string;
  value: string;
  hint?: string;
  tagLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-[#D8D5CE] bg-white p-5 shadow-xs flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold tracking-wider uppercase text-[#7A7F85]">
            {label}
          </span>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border border-[#D8D5CE] bg-[#FAF8F5] text-[#1A1D20]">
            {tagLabel}
          </span>
        </div>
        <div className="font-mono mt-3 text-2xl sm:text-3xl font-bold text-[#1A1D20] font-mono-nums">
          {value}
        </div>
      </div>
      {hint && (
        <div className="mt-3 text-xs font-medium text-[#5F6368] border-t border-[#EFECE6] pt-2.5">
          {hint}
        </div>
      )}
    </div>
  );
}

// ─── Section Card Wrapper ─────────────────────────────────────
function CardPanel({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-[#D8D5CE] bg-white p-5 shadow-xs h-full flex flex-col justify-between", className)}>
      <div>
        {(title || subtitle || action) && (
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-[#EFECE6] pb-3">
            <div>
              {title && <h2 className="text-base font-bold text-[#1A1D20]">{title}</h2>}
              {subtitle && <p className="mt-0.5 text-xs text-[#5F6368]">{subtitle}</p>}
            </div>
            {action}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

// ─── Table / Details Row ──────────────────────────────────────
function KeyValueRow({
  label,
  value,
  isDeduction,
  isTotal,
}: {
  label: string;
  value: string;
  isDeduction?: boolean;
  isTotal?: boolean;
}) {
  if (isTotal) {
    return (
      <div className="flex items-center justify-between border-t-2 border-[#D8D5CE] pt-3 mt-1">
        <dt className="text-sm font-bold text-[#1A1D20]">{label}</dt>
        <dd className="font-mono text-lg font-bold text-[#1A1D20] font-mono-nums">{value}</dd>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between text-xs py-1">
      <dt className="text-[#5F6368]">{label}</dt>
      <dd className={cn("font-mono font-medium font-mono-nums", isDeduction ? "text-[#1A1D20]" : "text-[#1A1D20]")}>
        {value}
      </dd>
    </div>
  );
}

// ─── Aging Bar Row ────────────────────────────────────────────
function AgingBarRow({
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
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs font-medium">
        <span className="text-[#5F6368]">{label}</span>
        <span className="font-mono font-mono-nums text-[#1A1D20] font-semibold">{formatCurrency(amount)}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[#EFECE6]">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            isDanger ? "bg-[#D32F2F]" : "bg-[#E05638]"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// ─── Main Dashboard Page Component ────────────────────────────
export default function DashboardPage() {
  const { currentFirm } = useFirm();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Period Filters
  const [periodPreset, setPeriodPreset] = useState<"all" | "today" | "month" | "fy" | "custom">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const currentDateStr = mounted ? formatDate(new Date()) : "";

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto text-[#1A1D20]">
      {/* Page Header */}
      <DashboardHeader
        eyebrow={`${currentDateStr} · ${currentFirm?.name || "Active Firm"}`}
        title={
          <>
            Books for <span className="text-[#E05638]">{currentFirm?.name || "Active Firm"}</span>
          </>
        }
        description="Management summary. All figures below belong only to the active firm."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/daily-book">
              <button
                type="button"
                className="btn btn-secondary text-xs h-9 px-4 rounded-xl flex items-center gap-1.5"
              >
                <Plus size={14} /> Add trip
              </button>
            </Link>
            <Link href="/billing/new">
              <button
                type="button"
                className="btn btn-primary text-xs h-9 px-4 rounded-xl flex items-center gap-1.5"
              >
                <FilePlus size={14} /> Create bill
              </button>
            </Link>
            <button
              type="button"
              onClick={fetchDashboardData}
              disabled={loading}
              aria-label="Refresh dashboard data"
              title="Refresh dashboard data"
              className="btn btn-ghost text-xs size-9 p-0 rounded-xl border border-[#D8D5CE] bg-white flex items-center justify-center text-[#5F6368] hover:text-[#1A1D20] disabled:opacity-40"
            >
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            </button>
          </div>
        }
      />

      {/* Period Filter Toolbar */}
      <div className="rounded-2xl border border-[#D8D5CE] bg-white p-4 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-[#1A1D20] flex items-center gap-1.5 mr-1">
            <Filter size={14} className="text-[#E05638]" /> Period:
          </span>

          <button
            type="button"
            onClick={() => handlePresetChange("all")}
            className={cn(
              "h-8 px-3.5 rounded-lg text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-[#E05638]/40",
              periodPreset === "all"
                ? "bg-[#1A1D20] text-white shadow-xs"
                : "bg-[#FAF8F5] text-[#5F6368] border border-[#D8D5CE] hover:text-[#1A1D20]"
            )}
          >
            All Time
          </button>

          <button
            type="button"
            onClick={() => handlePresetChange("today")}
            className={cn(
              "h-8 px-3.5 rounded-lg text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-[#E05638]/40",
              periodPreset === "today"
                ? "bg-[#1A1D20] text-white shadow-xs"
                : "bg-[#FAF8F5] text-[#5F6368] border border-[#D8D5CE] hover:text-[#1A1D20]"
            )}
          >
            Today
          </button>

          <button
            type="button"
            onClick={() => handlePresetChange("month")}
            className={cn(
              "h-8 px-3.5 rounded-lg text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-[#E05638]/40",
              periodPreset === "month"
                ? "bg-[#1A1D20] text-white shadow-xs"
                : "bg-[#FAF8F5] text-[#5F6368] border border-[#D8D5CE] hover:text-[#1A1D20]"
            )}
          >
            This Month
          </button>

          <button
            type="button"
            onClick={() => handlePresetChange("fy")}
            className={cn(
              "h-8 px-3.5 rounded-lg text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-[#E05638]/40",
              periodPreset === "fy"
                ? "bg-[#1A1D20] text-white shadow-xs"
                : "bg-[#FAF8F5] text-[#5F6368] border border-[#D8D5CE] hover:text-[#1A1D20]"
            )}
          >
            This FY (2026-27)
          </button>
        </div>

        {/* Custom Date Range Inputs with Visual Labels */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-[#7A7F85] shrink-0" />
            <span className="text-xs font-medium text-[#5F6368]">From</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPeriodPreset("custom");
              }}
              className="h-8 px-2.5 rounded-lg border border-[#D8D5CE] bg-[#FAF8F5] text-xs font-medium text-[#1A1D20] focus:outline-none focus:ring-2 focus:ring-[#E05638]/40"
            />
            <span className="text-xs font-medium text-[#5F6368]">To</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPeriodPreset("custom");
              }}
              className="h-8 px-2.5 rounded-lg border border-[#D8D5CE] bg-[#FAF8F5] text-xs font-medium text-[#1A1D20] focus:outline-none focus:ring-2 focus:ring-[#E05638]/40"
            />
          </div>
        </div>
      </div>

      {/* KPI Section (Top Row of 4 Equal Cards) */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Outstanding"
          value={formatCurrency(data?.outstanding?.totalOutstandingAmount || 0)}
          hint={`${data?.outstanding?.totalBills || 0} open bills`}
          tagLabel="Outstanding"
        />
        <KpiCard
          label="Net Billed Revenue"
          value={formatCurrency(data?.billing?.netPayableTotal || 0)}
          hint={`${data?.billing?.billCount || 0} bills posted`}
          tagLabel="Revenue"
        />
        <KpiCard
          label="Payment Receipts"
          value={formatCurrency(data?.payments?.totalReceipts || 0)}
          hint={`${data?.payments?.paymentCount || 0} receipts`}
          tagLabel="Receipts"
        />
        <KpiCard
          label="Daily Book Trips"
          value={String(data?.dailyBook?.totalEntries || 0)}
          hint={`${data?.dailyBook?.receivedCount || 0} received · ${data?.dailyBook?.pendingCount || 0} pending`}
          tagLabel="Operational"
        />
      </div>

      {/* Middle Row Section (Billing Breakdown, Payments, Aging) */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Billing Breakdown */}
        <CardPanel title="Billing breakdown">
          <dl className="space-y-2.5 text-xs">
            <KeyValueRow label="Gross Freight" value={formatCurrency(data?.billing?.grossFreightTotal || 0)} />
            <KeyValueRow
              label="Less: Shortage Debit Notes"
              value={`− ${formatCurrency(data?.billing?.shortageDebitTotal || 0)}`}
              isDeduction
            />
            <KeyValueRow
              label="Less: TDS Withheld"
              value={`− ${formatCurrency(data?.billing?.tdsTotal || 0)}`}
              isDeduction
            />
            <KeyValueRow
              label="Net Bill Amount"
              value={formatCurrency(data?.billing?.netPayableTotal || 0)}
              isTotal
            />
          </dl>
        </CardPanel>

        {/* Payments Summary */}
        <CardPanel title="Payments">
          <dl className="space-y-3 text-xs">
            <KeyValueRow label="Total Received" value={formatCurrency(data?.payments?.totalReceipts || 0)} />
            <KeyValueRow label="Against-Bill Payments" value={formatCurrency(data?.payments?.againstBillTotal || 0)} />
            <KeyValueRow label="Advance Payments" value={formatCurrency(data?.payments?.advanceTotal || 0)} />

            <div className="pt-2 border-t border-[#EFECE6] space-y-1.5">
              <div className="text-xs font-semibold text-[#1A1D20]">Bill Settlements</div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200/80 text-xs font-semibold">
                  {data?.outstanding?.pendingCount || 0} Pending
                </span>
                <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-800 border border-blue-200/80 text-xs font-semibold">
                  {data?.outstanding?.partiallyPaidCount || 0} Partial
                </span>
                <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-xs font-semibold">
                  {data?.outstanding?.paidCount || 0} Paid
                </span>
              </div>
            </div>

            <p className="text-xs text-[#5F6368] leading-relaxed pt-1">
              Production bill settlements and receipt allocations from active firm records.
            </p>
          </dl>
        </CardPanel>

        {/* Aging Analysis */}
        <CardPanel
          title="Aging"
          subtitle="Outstanding by age of bill"
          action={
            <Link href="/reports/aging" className="text-xs font-semibold text-[#E05638] hover:underline flex items-center gap-0.5">
              Report <ArrowUpRight size={14} />
            </Link>
          }
        >
          <div className="space-y-3 pt-1">
            <AgingBarRow label="0 – 30 Days" amount={data?.aging?.bucket0to30 || 0} max={agingMax} />
            <AgingBarRow label="31 – 60 Days" amount={data?.aging?.bucket31to60 || 0} max={agingMax} />
            <AgingBarRow label="61 – 90 Days" amount={data?.aging?.bucket61to90 || 0} max={agingMax} />
            <AgingBarRow label="91 – 180 Days" amount={data?.aging?.bucket91to180 || 0} max={agingMax} />
            <AgingBarRow label="181+ Days" amount={data?.aging?.bucket181Plus || 0} max={agingMax} isDanger />
          </div>
        </CardPanel>
      </div>

      {/* Driver Voucher Summary Section */}
      <CardPanel
        title="Driver voucher summary"
        subtitle="Operational Voucher — Accounting Treatment Pending Confirmation"
        action={
          <Link href="/driver-vouchers" className="text-xs font-semibold text-[#E05638] hover:underline flex items-center gap-0.5">
            Vouchers <ArrowUpRight size={14} />
          </Link>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-[#D8D5CE] bg-white p-4 shadow-xs space-y-1">
            <div className="text-xs font-bold text-[#7A7F85] uppercase tracking-wider">Advance</div>
            <div className="font-mono text-xl font-bold text-[#1A1D20] font-mono-nums">{formatCurrency(data?.driverVouchers?.totalAdvance || 0)}</div>
          </div>

          <div className="rounded-xl border border-[#D8D5CE] bg-white p-4 shadow-xs space-y-1">
            <div className="text-xs font-bold text-[#7A7F85] uppercase tracking-wider">Cash</div>
            <div className="font-mono text-xl font-bold text-[#1A1D20] font-mono-nums">{formatCurrency(data?.driverVouchers?.totalCash || 0)}</div>
          </div>

          <div className="rounded-xl border border-[#D8D5CE] bg-white p-4 shadow-xs space-y-1">
            <div className="text-xs font-bold text-[#7A7F85] uppercase tracking-wider">Diesel</div>
            <div className="font-mono text-xl font-bold text-[#1A1D20] font-mono-nums">{formatCurrency(data?.driverVouchers?.totalDiesel || 0)}</div>
          </div>

          <div className="rounded-xl border border-[#D8D5CE] bg-white p-4 shadow-xs space-y-1">
            <div className="text-xs font-bold text-[#7A7F85] uppercase tracking-wider">A/C</div>
            <div className="font-mono text-xl font-bold text-[#1A1D20] font-mono-nums">{formatCurrency(data?.driverVouchers?.totalAc || 0)}</div>
          </div>

          <div className="rounded-xl border border-[#D8D5CE] bg-[#FAF8F5] p-4 shadow-xs space-y-1">
            <div className="text-xs font-bold text-[#E05638] uppercase tracking-wider">Total Operational</div>
            <div className="font-mono text-xl font-bold text-[#1A1D20] font-mono-nums">{formatCurrency(data?.driverVouchers?.totalExpense || 0)}</div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-[#D8D5CE] bg-[#FAF8F5] p-3 flex items-center gap-2 text-xs text-[#5F6368]">
          <Info size={15} className="text-[#E05638] shrink-0" />
          <span>
            These operational amounts are not posted to the accounting ledger. Status:{" "}
            <span className="font-bold text-[#1A1D20]">PENDING CONFIRMATION</span>.
          </span>
        </div>
      </CardPanel>

      {/* Recent Activity Grid (Recent Bills & Recent Payments) */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Bills */}
        <CardPanel
          title="Recent Bills"
          subtitle="Latest invoices generated for this firm"
          action={
            <Link href="/billing/bills" className="text-xs font-semibold text-[#E05638] hover:underline">
              View All →
            </Link>
          }
        >
          {data?.billing?.recentBills && data.billing.recentBills.length > 0 ? (
            <div className="divide-y divide-[#EFECE6] text-xs">
              {data.billing.recentBills.map((b) => (
                <div key={b.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-[#1A1D20]">Bill #{b.billNumber}</p>
                    <p className="text-[#5F6368] text-xs mt-0.5">{b.partyName} • {formatDate(b.billDate)}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <span className="block font-bold text-[#1A1D20] font-mono text-sm font-mono-nums">
                      {formatCurrency(Number(b.netBillAmount || 0))}
                    </span>
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-[#1A1D20] text-white">
                      {formatStatusLabel(b.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-[#7A7F85] text-xs">
              No bills recorded yet.
            </div>
          )}
        </CardPanel>

        {/* Recent Payments */}
        <CardPanel
          title="Recent Payment Receipts"
          subtitle="Latest receipts recorded for this firm"
          action={
            <Link href="/payments" className="text-xs font-semibold text-[#E05638] hover:underline">
              View All →
            </Link>
          }
        >
          {data?.payments?.recentPayments && data.payments.recentPayments.length > 0 ? (
            <div className="divide-y divide-[#EFECE6] text-xs">
              {data.payments.recentPayments.map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-[#1A1D20]">{p.partyName}</p>
                    <p className="text-[#5F6368] text-xs mt-0.5">
                      {formatDate(p.paymentDate)} • {formatVoucherTypeLabel(p.paymentMode)} ({formatVoucherTypeLabel(p.paymentType)})
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="block font-bold text-[#1A1D20] font-mono text-sm font-mono-nums">
                      {formatCurrency(Number(p.amount || 0))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-[#7A7F85] text-xs">
              No payments recorded yet.
            </div>
          )}
        </CardPanel>
      </div>
    </div>
  );
}
