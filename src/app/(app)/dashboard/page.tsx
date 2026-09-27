"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useFirm } from "@/lib/firm-context";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
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

// ─── Visual UI Primitives matching Lovable ui-kit ─────────────

function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-5">
      <div>
        {eyebrow && (
          <div className="mb-2 text-[11px] font-semibold tracking-[0.22em] text-coral uppercase">
            {eyebrow}
          </div>
        )}
        <h1 className="font-display text-4xl leading-[0.95] font-bold md:text-5xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[15px] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}

function KpiCard({
  label,
  value,
  hint,
  tone = "outline",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "ink" | "coral" | "sun" | "outline";
}) {
  const badgeClasses = {
    coral: "bg-red-50 text-red-700 border-red-200",
    ink: "bg-slate-100 text-slate-800 border-slate-200",
    sun: "bg-amber-50 text-amber-800 border-amber-200",
    outline: "bg-emerald-50 text-emerald-800 border-emerald-200",
  } as const;

  return (
    <div className="rounded-2xl border border-[#D8D5CE] bg-white p-5 md:p-6 shadow-xs flex flex-col justify-between transition-all hover:border-[#9E9A91]">
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold tracking-wider uppercase text-[#7A7F85]">
            {label}
          </span>
          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", badgeClasses[tone])}>
            {tone === "coral" ? "Outstanding" : tone === "ink" ? "Revenue" : tone === "sun" ? "Receipts" : "Operational"}
          </span>
        </div>
        <div className="font-mono mt-2.5 text-2xl md:text-3xl font-bold text-[#1A1D20] tnum">
          {value}
        </div>
      </div>
      {hint && (
        <div className="mt-2 text-xs font-medium text-[#5F6368] border-t border-[#EFECE6] pt-2">
          {hint}
        </div>
      )}
    </div>
  );
}

function Panel({
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
    <section className={cn("rounded-2xl border border-[#D8D5CE] bg-white p-5 md:p-6 shadow-xs", className)}>
      {(title || subtitle || action) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[#EFECE6] pb-3">
          <div>
            {title && <h2 className="font-display text-lg font-bold text-[#1A1D20]">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-[#5F6368]">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function Button({
  variant = "ink",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "ink" | "coral" | "turq" | "outline";
}) {
  const variants = {
    ink: "bg-ink text-ink-foreground hover:bg-ink/85",
    coral: "bg-coral text-coral-foreground hover:bg-coral/90",
    turq: "bg-turq text-ink hover:bg-turq/85",
    outline: "border-2 border-ink bg-transparent text-ink hover:bg-ink/5",
  } as const;
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        variants[variant],
        className
      )}
    >
      {children}
    </button>
  );
}

type BadgeTone = "received" | "pending" | "paid" | "partial" | "posted" | "neutral" | "warn";

const toneClass: Record<BadgeTone, string> = {
  received: "bg-turq/30 text-ink",
  paid: "bg-turq/30 text-ink",
  pending: "bg-sun/45 text-ink",
  partial: "bg-blue/20 text-ink",
  posted: "bg-ink text-ink-foreground",
  warn: "bg-rose/30 text-ink",
  neutral: "bg-ink/10 text-ink",
};

function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        toneClass[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

function MiniStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 shadow-xs flex flex-col justify-between transition-all",
        highlight
          ? "border-[#E05638] bg-[#FAF8F5] text-[#1A1D20]"
          : "border-[#D8D5CE] bg-white text-[#1A1D20]"
      )}
    >
      <div className={cn("text-[10px] font-bold tracking-wider uppercase", highlight ? "text-[#E05638]" : "text-[#7A7F85]")}>
        {label}
      </div>
      <div className="font-mono mt-1.5 text-xl font-bold text-[#1A1D20] tnum">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold tnum">{value}</dd>
    </div>
  );
}

// ─── Dashboard Component ──────────────────────────────────────

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
    <>
      {/* Header */}
      <PageHeader
        eyebrow={`${currentDateStr} · ${currentFirm?.name || "Active Firm"}`}
        title={
          <>
            Books for <span className="text-coral">{currentFirm?.name || "Active Firm"}</span>
          </>
        }
        description="Management summary. All figures below belong only to the active firm."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/daily-book">
              <Button variant="ink">Add trip</Button>
            </Link>
            <Link href="/billing/new">
              <Button variant="coral">Create bill</Button>
            </Link>
            <button
              type="button"
              onClick={fetchDashboardData}
              disabled={loading}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border-2 border-ink px-4 py-2.5 text-xs font-semibold text-ink hover:bg-ink/5 disabled:opacity-40"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        }
      />

      {/* Period Filter Toolbar */}
      <div className="mb-6 card-flat p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-muted-foreground font-semibold mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Period:
          </span>
          <button
            type="button"
            onClick={() => handlePresetChange("all")}
            className={`px-3 py-1.5 rounded-full font-semibold transition-colors ${
              periodPreset === "all"
                ? "bg-coral text-coral-foreground"
                : "bg-ink/8 text-ink hover:bg-ink/15"
            }`}
          >
            All Time
          </button>
          <button
            type="button"
            onClick={() => handlePresetChange("today")}
            className={`px-3 py-1.5 rounded-full font-semibold transition-colors ${
              periodPreset === "today"
                ? "bg-coral text-coral-foreground"
                : "bg-ink/8 text-ink hover:bg-ink/15"
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => handlePresetChange("month")}
            className={`px-3 py-1.5 rounded-full font-semibold transition-colors ${
              periodPreset === "month"
                ? "bg-coral text-coral-foreground"
                : "bg-ink/8 text-ink hover:bg-ink/15"
            }`}
          >
            This Month
          </button>
          <button
            type="button"
            onClick={() => handlePresetChange("fy")}
            className={`px-3 py-1.5 rounded-full font-semibold transition-colors ${
              periodPreset === "fy"
                ? "bg-coral text-coral-foreground"
                : "bg-ink/8 text-ink hover:bg-ink/15"
            }`}
          >
            This FY (2026-27)
          </button>
        </div>

        {/* Custom Date Inputs */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPeriodPreset("custom");
              }}
              className="px-2.5 py-1 rounded-xl border-2 border-ink/20 bg-white dark:bg-gray-900 text-xs font-medium focus:border-ink outline-none"
            />
            <span className="text-muted-foreground">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPeriodPreset("custom");
              }}
              className="px-2.5 py-1 rounded-xl border-2 border-ink/20 bg-white dark:bg-gray-900 text-xs font-medium focus:border-ink outline-none"
            />
          </div>
        </div>
      </div>

      {/* KPI Section (4 KpiCards) */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          tone="coral"
          label="Total Outstanding"
          value={formatCurrency(data?.outstanding?.totalOutstandingAmount || 0)}
          hint={`${data?.outstanding?.totalBills || 0} open bills`}
        />
        <KpiCard
          tone="ink"
          label="Net Billed Revenue"
          value={formatCurrency(data?.billing?.netPayableTotal || 0)}
          hint={`${data?.billing?.billCount || 0} bills posted`}
        />
        <KpiCard
          tone="sun"
          label="Payment Receipts"
          value={formatCurrency(data?.payments?.totalReceipts || 0)}
          hint={`${data?.payments?.paymentCount || 0} receipts`}
        />
        <KpiCard
          tone="outline"
          label="Daily Book Trips"
          value={String(data?.dailyBook?.totalEntries || 0)}
          hint={`${data?.dailyBook?.receivedCount || 0} received · ${data?.dailyBook?.pendingCount || 0} pending`}
        />
      </div>

      {/* Breakdown Section (Billing, Payments, Aging) */}
      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        {/* Billing Breakdown */}
        <Panel title="Billing breakdown">
          <dl className="space-y-3 text-sm">
            <Row label="Gross Freight" value={formatCurrency(data?.billing?.grossFreightTotal || 0)} />
            <Row
              label="Less: Shortage Debit Notes"
              value={`− ${formatCurrency(data?.billing?.shortageDebitTotal || 0)}`}
            />
            <Row
              label="Less: TDS Withheld"
              value={`− ${formatCurrency(data?.billing?.tdsTotal || 0)}`}
            />
            <div className="flex items-center justify-between border-t-2 border-dashed border-ink/20 pt-3">
              <dt className="font-semibold">Net Bill Amount</dt>
              <dd className="font-display text-xl font-bold tnum">
                {formatCurrency(data?.billing?.netPayableTotal || 0)}
              </dd>
            </div>
          </dl>
        </Panel>

        {/* Payments Summary */}
        <Panel title="Payments">
          <dl className="space-y-3 text-sm">
            <Row label="Total Received" value={formatCurrency(data?.payments?.totalReceipts || 0)} />
            <Row label="Against-Bill Payments" value={formatCurrency(data?.payments?.againstBillTotal || 0)} />
            <Row label="Advance Payments" value={formatCurrency(data?.payments?.advanceTotal || 0)} />
            <div className="flex items-center justify-between rounded-2xl bg-sun/35 px-4 py-3">
              <dt className="text-sm font-semibold">Bill Settlements</dt>
              <dd className="font-semibold tnum text-xs">
                {data?.outstanding?.pendingCount || 0} Pending · {data?.outstanding?.partiallyPaidCount || 0} Partial · {data?.outstanding?.paidCount || 0} Paid
              </dd>
            </div>
            <p className="text-xs text-muted-foreground">
              Production bill settlements and receipt allocations from active firm records.
            </p>
          </dl>
        </Panel>

        {/* Aging Analysis */}
        <Panel
          title="Aging"
          subtitle="Outstanding by age of bill"
          action={
            <Link href="/reports/aging" className="text-xs font-semibold text-coral hover:underline flex items-center gap-0.5">
              Report <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          }
        >
          <div className="space-y-3">
            <AgingBar label="0 – 30 Days" amount={data?.aging?.bucket0to30 || 0} max={agingMax} />
            <AgingBar label="31 – 60 Days" amount={data?.aging?.bucket31to60 || 0} max={agingMax} />
            <AgingBar label="61 – 90 Days" amount={data?.aging?.bucket61to90 || 0} max={agingMax} />
            <AgingBar label="91 – 180 Days" amount={data?.aging?.bucket91to180 || 0} max={agingMax} />
            <AgingBar label="181+ Days" amount={data?.aging?.bucket181Plus || 0} max={agingMax} isDanger />
          </div>
        </Panel>
      </div>

      {/* Driver Voucher Operational Summary */}
      <Panel
        className="mb-8"
        title="Driver voucher summary"
        subtitle="Operational Voucher — Accounting Treatment Pending Confirmation"
        action={
          <Link href="/driver-vouchers" className="text-xs font-semibold text-coral hover:underline flex items-center gap-0.5">
            Vouchers <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <MiniStat label="Advance" value={formatCurrency(data?.driverVouchers?.totalAdvance || 0)} />
          <MiniStat label="Cash" value={formatCurrency(data?.driverVouchers?.totalCash || 0)} />
          <MiniStat label="Diesel" value={formatCurrency(data?.driverVouchers?.totalDiesel || 0)} />
          <MiniStat label="A/c" value={formatCurrency(data?.driverVouchers?.totalAc || 0)} />
          <MiniStat label="Total operational" value={formatCurrency(data?.driverVouchers?.totalExpense || 0)} highlight />
        </div>
        <p className="mt-4 text-xs text-muted-foreground flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 inline" />
          <span>
            These operational amounts are not posted to the accounting ledger. Status:{" "}
            <span className="font-semibold text-ink">PENDING CONFIRMATION</span>.
          </span>
        </p>
      </Panel>

      {/* Recent Activity Grid (Recent Bills & Recent Payments) */}
      <div className="mb-8 grid gap-6 lg:grid-cols-2">
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
            <div className="divide-y divide-ink/10 text-xs">
              {data.billing.recentBills.map((b) => (
                <div key={b.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-ink">Bill #{b.billNumber}</p>
                    <p className="text-muted-foreground text-[11px]">{b.partyName} • {formatDate(b.billDate)}</p>
                  </div>
                  <div className="text-right">
                    <span className="block font-bold text-ink font-display text-sm tnum">
                      {formatCurrency(Number(b.netBillAmount || 0))}
                    </span>
                    <Badge tone={b.status === "PAID" ? "received" : b.status === "PARTIALLY_PAID" ? "pending" : "neutral"}>
                      {b.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-xs">
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
            <div className="divide-y divide-ink/10 text-xs">
              {data.payments.recentPayments.map((p) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-ink">{p.partyName}</p>
                    <p className="text-muted-foreground text-[11px]">
                      {formatDate(p.paymentDate)} • {p.paymentMode} ({p.paymentType})
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="block font-bold text-ink font-display text-sm tnum">
                      {formatCurrency(Number(p.amount || 0))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-xs">
              No payments recorded yet.
            </div>
          )}
        </Panel>
      </div>
    </>
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
      <div className="mb-1 flex items-center justify-between text-xs font-semibold">
        <span className="text-muted-foreground">{label}</span>
        <span className="tnum">{formatCurrency(amount)}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-ink/10">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isDanger ? "bg-rose-500" : "bg-coral"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
