"use client";

import React, { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard, StatCardSkeleton } from "@/components/ui/stat-card";
import { Badge, Button } from "@/components/ui/primitives";
import { BillDetailModal } from "@/components/bills/bill-detail-modal";
import { useApiClient } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  BarChart3,
  Calendar,
  Eye,
  Filter,
  Printer,
  RotateCcw,
  Users,
  FileText,
} from "lucide-react";

interface PartyOption {
  id: string;
  name: string;
}

interface AgingReportData {
  asOfDate: string;
  summary: {
    current: number;
    days1_30: number;
    days31_60: number;
    days61_90: number;
    days91_180: number;
    days181Plus: number;
    totalOutstanding: number;
  };
  partyBreakdown: Array<{
    partyId: string;
    partyName: string;
    current: number;
    days1_30: number;
    days31_60: number;
    days61_90: number;
    days91_180: number;
    days181Plus: number;
    totalOutstanding: number;
    billCount: number;
  }>;
  billDetails: Array<{
    id: string;
    partyId: string;
    partyName: string;
    billNumber: number;
    billDate: string;
    netBillAmount: number;
    receivedAmount: number;
    pendingAmount: number;
    ageInDays: number;
    bucket: "Current" | "1–30 Days" | "31–60 Days" | "61–90 Days" | "91–180 Days" | "181+ Days";
  }>;
}

export default function AgingReportPage() {
  const api = useApiClient();

  const [parties, setParties] = useState<PartyOption[]>([]);
  const [asOfDate, setAsOfDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [partyId, setPartyId] = useState<string>("");
  const [viewMode, setViewMode] = useState<"party" | "bill">("party");

  const [data, setData] = useState<AgingReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewBillId, setViewBillId] = useState<string | null>(null);

  // Fetch Parties for Filter
  useEffect(() => {
    async function loadParties() {
      try {
        const res = await api.get<PartyOption[]>("/api/parties");
        setParties(res);
      } catch (err) {
        console.error("Failed to load parties", err);
      }
    }
    loadParties();
  }, [api]);

  // Fetch Aging Report Data
  const fetchReport = useCallback(async () => {
    if (!api.ready) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (asOfDate) query.set("asOfDate", asOfDate);
      if (partyId) query.set("partyId", partyId);

      const res = await api.get<AgingReportData>(
        `/api/reports/aging?${query.toString()}`
      );
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load aging report");
    } finally {
      setLoading(false);
    }
  }, [api, asOfDate, partyId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleResetFilters = () => {
    setAsOfDate(new Date().toISOString().split("T")[0]);
    setPartyId("");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fade-in print:p-0 pb-20 text-[#1A1D20]">
      {/* Header */}
      <PageHeader
        title="Aging Analysis Report"
        subtitle="Customer outstanding balances grouped by age buckets"
        breadcrumbs={[{ label: "Reports" }, { label: "Aging Analysis" }]}
        actions={
          <div className="flex items-center gap-2 print:hidden">
            <Button variant="secondary" size="sm" icon={Printer} onClick={handlePrint}>
              Print
            </Button>
          </div>
        }
      />

      {/* Filters Bar */}
      <div className="rounded-2xl border border-[#D8D5CE] bg-white p-4 space-y-3 shadow-xs print:hidden">
        <div className="flex items-center justify-between border-b border-[#EFECE6] pb-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#1A1D20]">
            <Filter size={14} className="text-[#E05638]" />
            <span>Aging Parameters</span>
          </div>
          {(partyId || asOfDate !== new Date().toISOString().split("T")[0]) && (
            <button
              onClick={handleResetFilters}
              className="text-xs text-[#E05638] hover:underline flex items-center gap-1 font-semibold"
            >
              <RotateCcw size={12} /> Reset to Today
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-[#5F6368] uppercase tracking-wider mb-1">
              As Of Date (Aging Reference)
            </label>
            <div className="relative">
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="form-input w-full pr-8 font-medium text-xs"
              />
              <Calendar
                size={14}
                className="absolute right-2.5 top-2.5 text-[#7A7F85] pointer-events-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#5F6368] uppercase tracking-wider mb-1">Customer / Party</label>
            <select
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
              className="form-input w-full font-medium text-xs"
            >
              <option value="">All Parties</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#5F6368] uppercase tracking-wider mb-1">View Breakdown</label>
            <div className="flex bg-[#FAF8F5] p-1 rounded-xl border border-[#D8D5CE]">
              <button
                type="button"
                onClick={() => setViewMode("party")}
                className={`flex-1 text-xs py-1.5 px-3 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 ${
                  viewMode === "party"
                    ? "bg-white text-[#E05638] shadow-xs border border-[#D8D5CE]"
                    : "text-[#5F6368] hover:text-[#1A1D20]"
                }`}
              >
                <Users size={13} /> Party Summary
              </button>
              <button
                type="button"
                onClick={() => setViewMode("bill")}
                className={`flex-1 text-xs py-1.5 px-3 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 ${
                  viewMode === "bill"
                    ? "bg-white text-[#E05638] shadow-xs border border-[#D8D5CE]"
                    : "text-[#5F6368] hover:text-[#1A1D20]"
                }`}
              >
                <FileText size={13} /> Bill Details
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-3.5 bg-red-50 text-red-700 rounded-xl text-xs border border-red-200 flex items-center justify-between">
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={fetchReport}>
            Retry
          </Button>
        </div>
      )}

      {/* Aging Bucket Stat Cards (Responsive Grid prevents any number truncation) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-3">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              label="Current (0d)"
              value={formatCurrency(data?.summary.current ?? 0)}
              iconColor="#10b981"
            />
            <StatCard
              label="1–30 Days"
              value={formatCurrency(data?.summary.days1_30 ?? 0)}
              iconColor="#3b82f6"
            />
            <StatCard
              label="31–60 Days"
              value={formatCurrency(data?.summary.days31_60 ?? 0)}
              iconColor="#6366f1"
            />
            <StatCard
              label="61–90 Days"
              value={formatCurrency(data?.summary.days61_90 ?? 0)}
              iconColor="#f59e0b"
            />
            <StatCard
              label="91–180 Days"
              value={formatCurrency(data?.summary.days91_180 ?? 0)}
              iconColor="#f97316"
            />
            <StatCard
              label="181+ Days"
              value={formatCurrency(data?.summary.days181Plus ?? 0)}
              iconColor="#ef4444"
            />
            <StatCard
              label="Total Outstanding"
              value={formatCurrency(data?.summary.totalOutstanding ?? 0)}
              iconColor="#E05638"
              className="bg-[#FAF8F5] border-[#E05638]/40 shadow-xs"
            />
          </>
        )}
      </div>

      {/* Data Table View */}
      {viewMode === "party" ? (
        /* Party-Wise Summary Table */
        <div className="rounded-2xl border border-[#D8D5CE] bg-white overflow-hidden shadow-xs">
          <div className="p-4 border-b border-[#EFECE6] bg-[#FAF8F5] flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-[#1A1D20] flex items-center gap-2 uppercase tracking-wider">
              <Users size={15} className="text-[#E05638]" />
              Party-Wise Aging Breakdown ({data?.partyBreakdown.length ?? 0} Parties)
            </h3>
            <span className="text-xs text-[#7A7F85]">
              As Of Date: {data?.asOfDate ? formatDate(data.asOfDate) : "-"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[900px]">
              <thead className="bg-[#FAF8F5] border-b border-[#D8D5CE] font-bold text-[#5F6368] uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="p-3">Party Name</th>
                  <th className="p-3 text-center">Bills</th>
                  <th className="p-3 text-right">Current</th>
                  <th className="p-3 text-right">1–30 Days</th>
                  <th className="p-3 text-right">31–60 Days</th>
                  <th className="p-3 text-right">61–90 Days</th>
                  <th className="p-3 text-right">91–180 Days</th>
                  <th className="p-3 text-right">181+ Days</th>
                  <th className="p-3 text-right font-bold text-[#1A1D20]">Total Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFECE6]">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-[#7A7F85]">
                      Loading aging analysis…
                    </td>
                  </tr>
                ) : !data?.partyBreakdown.length ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-[#7A7F85]">
                      No pending bills found as of {data?.asOfDate}.
                    </td>
                  </tr>
                ) : (
                  <>
                    {data.partyBreakdown.map((row) => (
                      <tr key={row.partyId} className="hover:bg-[#FAF8F5]/80 transition-colors">
                        <td className="p-3 font-bold text-[#1A1D20]">
                          {row.partyName}
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="neutral">{row.billCount}</Badge>
                        </td>
                        <td className="p-3 text-right font-mono-nums font-semibold text-emerald-700">
                          {row.current > 0 ? formatCurrency(row.current) : "—"}
                        </td>
                        <td className="p-3 text-right font-mono-nums font-semibold text-blue-700">
                          {row.days1_30 > 0 ? formatCurrency(row.days1_30) : "—"}
                        </td>
                        <td className="p-3 text-right font-mono-nums font-semibold text-indigo-700">
                          {row.days31_60 > 0 ? formatCurrency(row.days31_60) : "—"}
                        </td>
                        <td className="p-3 text-right font-mono-nums font-semibold text-amber-700">
                          {row.days61_90 > 0 ? formatCurrency(row.days61_90) : "—"}
                        </td>
                        <td className="p-3 text-right font-mono-nums font-semibold text-orange-700">
                          {row.days91_180 > 0 ? formatCurrency(row.days91_180) : "—"}
                        </td>
                        <td className="p-3 text-right font-mono-nums font-semibold text-red-700">
                          {row.days181Plus > 0 ? formatCurrency(row.days181Plus) : "—"}
                        </td>
                        <td className="p-3 text-right font-mono-nums font-bold text-[#1A1D20] bg-[#FAF8F5]">
                          {formatCurrency(row.totalOutstanding)}
                        </td>
                      </tr>
                    ))}
                    {/* Summary Total Footer Row */}
                    <tr className="bg-[#EFECE6]/80 font-bold border-t-2 border-[#D8D5CE]">
                      <td className="p-3 uppercase text-[#1A1D20] font-bold">Total</td>
                      <td className="p-3 text-center">{data.billDetails.length}</td>
                      <td className="p-3 text-right font-mono-nums text-emerald-800">
                        {formatCurrency(data.summary.current)}
                      </td>
                      <td className="p-3 text-right font-mono-nums text-blue-800">
                        {formatCurrency(data.summary.days1_30)}
                      </td>
                      <td className="p-3 text-right font-mono-nums text-indigo-800">
                        {formatCurrency(data.summary.days31_60)}
                      </td>
                      <td className="p-3 text-right font-mono-nums text-amber-800">
                        {formatCurrency(data.summary.days61_90)}
                      </td>
                      <td className="p-3 text-right font-mono-nums text-orange-800">
                        {formatCurrency(data.summary.days91_180)}
                      </td>
                      <td className="p-3 text-right font-mono-nums text-red-800">
                        {formatCurrency(data.summary.days181Plus)}
                      </td>
                      <td className="p-3 text-right font-mono-nums font-bold text-[#E05638] text-sm">
                        {formatCurrency(data.summary.totalOutstanding)}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Bill-Wise Detail Aging Table */
        <div className="rounded-2xl border border-[#D8D5CE] bg-white overflow-hidden shadow-xs">
          <div className="p-4 border-b border-[#EFECE6] bg-[#FAF8F5] flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-[#1A1D20] flex items-center gap-2 uppercase tracking-wider">
              <FileText size={15} className="text-[#E05638]" />
              Bill-Wise Aging Details ({data?.billDetails.length ?? 0} Bills)
            </h3>
            <span className="text-xs text-[#7A7F85]">
              Reference: Bill Date relative to As-Of Date
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[900px]">
              <thead className="bg-[#FAF8F5] border-b border-[#D8D5CE] font-bold text-[#5F6368] uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="p-3">Party Name</th>
                  <th className="p-3">Bill No</th>
                  <th className="p-3">Bill Date</th>
                  <th className="p-3 text-right">Net Bill</th>
                  <th className="p-3 text-right">Received</th>
                  <th className="p-3 text-right">Outstanding</th>
                  <th className="p-3 text-center">Age (Days)</th>
                  <th className="p-3 text-center">Aging Bucket</th>
                  <th className="p-3 text-center print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFECE6]">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-[#7A7F85]">
                      Loading bill aging details…
                    </td>
                  </tr>
                ) : !data?.billDetails.length ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-[#7A7F85]">
                      No pending bills found as of {data?.asOfDate}.
                    </td>
                  </tr>
                ) : (
                  data.billDetails.map((b) => (
                    <tr key={b.id} className="hover:bg-[#FAF8F5]/80 transition-colors">
                      <td className="p-3 font-bold text-[#1A1D20]">
                        {b.partyName}
                      </td>
                      <td className="p-3 font-mono-nums font-bold text-[#E05638]">
                        #{b.billNumber}
                      </td>
                      <td className="p-3 whitespace-nowrap text-[#5F6368]">{formatDate(b.billDate)}</td>
                      <td className="p-3 text-right font-mono-nums font-medium">{formatCurrency(b.netBillAmount)}</td>
                      <td className="p-3 text-right font-mono-nums text-emerald-700 font-semibold">
                        {formatCurrency(b.receivedAmount)}
                      </td>
                      <td className="p-3 text-right font-mono-nums font-bold text-red-600">
                        {formatCurrency(b.pendingAmount)}
                      </td>
                      <td className="p-3 text-center font-mono-nums font-bold">{b.ageInDays}d</td>
                      <td className="p-3 text-center">
                        <Badge
                          variant={
                            b.bucket === "Current"
                              ? "success"
                              : b.bucket === "1–30 Days"
                              ? "info"
                              : b.bucket === "31–60 Days"
                              ? "neutral"
                              : b.bucket === "61–90 Days"
                              ? "warning"
                              : "danger"
                          }
                        >
                          {b.bucket}
                        </Badge>
                      </td>
                      <td className="p-3 text-center print:hidden">
                        <button
                          onClick={() => setViewBillId(b.id)}
                          className="rounded-lg border border-[#D8D5CE] px-2.5 py-1 text-xs font-semibold text-[#1A1D20] hover:bg-[#FAF8F5]"
                          title="View Bill Details"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bill Detail Modal */}
      <BillDetailModal billId={viewBillId} onClose={() => setViewBillId(null)} />
    </div>
  );
}
