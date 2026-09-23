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
    <div className="space-y-6 animate-fade-in print:p-0">
      {/* Header */}
      <PageHeader
        title="Aging Analysis Report"
        subtitle="Categorised outstanding bill balances by age relative to As-Of Date"
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
      <div className="card p-4 space-y-3 print:hidden">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
            <Filter size={14} className="text-gray-400" />
            <span>Aging Parameters</span>
          </div>
          {(partyId || asOfDate !== new Date().toISOString().split("T")[0]) && (
            <button
              onClick={handleResetFilters}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
            >
              <RotateCcw size={12} /> Reset to Today
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-gray-500 font-medium mb-1">
              As Of Date (Aging Reference)
            </label>
            <div className="relative">
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="form-input w-full pr-8"
              />
              <Calendar
                size={14}
                className="absolute right-2.5 top-2.5 text-gray-400 pointer-events-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-500 font-medium mb-1">Customer / Party</label>
            <select
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
              className="form-input w-full"
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
            <label className="block text-gray-500 font-medium mb-1">View Breakdown</label>
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setViewMode("party")}
                className={`flex-1 text-xs py-1 px-2 rounded-md font-medium transition-colors flex items-center justify-center gap-1.5 ${
                  viewMode === "party"
                    ? "bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Users size={13} /> Party Summary
              </button>
              <button
                type="button"
                onClick={() => setViewMode("bill")}
                className={`flex-1 text-xs py-1 px-2 rounded-md font-medium transition-colors flex items-center justify-center gap-1.5 ${
                  viewMode === "bill"
                    ? "bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
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
        <div className="p-4 bg-red-50 text-red-600 rounded-xl text-xs border border-red-200">
          {error}
        </div>
      )}

      {/* Aging Bucket Stat Cards (6 Buckets + Total Reconciled) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
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
              label="Total Reconciled"
              value={formatCurrency(data?.summary.totalOutstanding ?? 0)}
              iconColor="#8b5cf6"
              className="bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800"
            />
          </>
        )}
      </div>

      {/* Data Table View */}
      {viewMode === "party" ? (
        /* Party-Wise Summary Table */
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Users size={16} className="text-indigo-500" />
              Party-Wise Aging Breakdown ({data?.partyBreakdown.length ?? 0} Parties)
            </h3>
            <span className="text-xs text-gray-400">
              As Of Date: {data?.asOfDate ? formatDate(data.asOfDate) : "-"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800/80 font-semibold uppercase text-gray-500 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="p-3">Party Name</th>
                  <th className="p-3 text-center">Bills</th>
                  <th className="p-3 text-right">Current</th>
                  <th className="p-3 text-right">1–30 Days</th>
                  <th className="p-3 text-right">31–60 Days</th>
                  <th className="p-3 text-right">61–90 Days</th>
                  <th className="p-3 text-right">91–180 Days</th>
                  <th className="p-3 text-right">181+ Days</th>
                  <th className="p-3 text-right font-bold">Total Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-gray-400">
                      Loading aging analysis…
                    </td>
                  </tr>
                ) : !data?.partyBreakdown.length ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-gray-400">
                      No pending bills found as of {data?.asOfDate}.
                    </td>
                  </tr>
                ) : (
                  <>
                    {data.partyBreakdown.map((row) => (
                      <tr key={row.partyId} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                        <td className="p-3 font-semibold text-gray-900 dark:text-gray-100">
                          {row.partyName}
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="neutral">{row.billCount}</Badge>
                        </td>
                        <td className="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                          {row.current > 0 ? formatCurrency(row.current) : "-"}
                        </td>
                        <td className="p-3 text-right font-mono text-blue-600 dark:text-blue-400">
                          {row.days1_30 > 0 ? formatCurrency(row.days1_30) : "-"}
                        </td>
                        <td className="p-3 text-right font-mono text-indigo-600 dark:text-indigo-400">
                          {row.days31_60 > 0 ? formatCurrency(row.days31_60) : "-"}
                        </td>
                        <td className="p-3 text-right font-mono text-amber-600 dark:text-amber-400">
                          {row.days61_90 > 0 ? formatCurrency(row.days61_90) : "-"}
                        </td>
                        <td className="p-3 text-right font-mono text-orange-600 dark:text-orange-400">
                          {row.days91_180 > 0 ? formatCurrency(row.days91_180) : "-"}
                        </td>
                        <td className="p-3 text-right font-mono text-red-600 dark:text-red-400">
                          {row.days181Plus > 0 ? formatCurrency(row.days181Plus) : "-"}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-gray-900 dark:text-gray-100 bg-gray-50/50 dark:bg-gray-800/30">
                          {formatCurrency(row.totalOutstanding)}
                        </td>
                      </tr>
                    ))}
                    {/* Summary Total Footer Row */}
                    <tr className="bg-gray-100/70 dark:bg-gray-800/90 font-bold border-t-2 border-gray-200 dark:border-gray-700">
                      <td className="p-3 uppercase text-gray-700 dark:text-gray-300">Total</td>
                      <td className="p-3 text-center">{data.billDetails.length}</td>
                      <td className="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(data.summary.current)}
                      </td>
                      <td className="p-3 text-right font-mono text-blue-600 dark:text-blue-400">
                        {formatCurrency(data.summary.days1_30)}
                      </td>
                      <td className="p-3 text-right font-mono text-indigo-600 dark:text-indigo-400">
                        {formatCurrency(data.summary.days31_60)}
                      </td>
                      <td className="p-3 text-right font-mono text-amber-600 dark:text-amber-400">
                        {formatCurrency(data.summary.days61_90)}
                      </td>
                      <td className="p-3 text-right font-mono text-orange-600 dark:text-orange-400">
                        {formatCurrency(data.summary.days91_180)}
                      </td>
                      <td className="p-3 text-right font-mono text-red-600 dark:text-red-400">
                        {formatCurrency(data.summary.days181Plus)}
                      </td>
                      <td className="p-3 text-right font-mono text-indigo-700 dark:text-indigo-300">
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
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <FileText size={16} className="text-indigo-500" />
              Bill-Wise Aging Details ({data?.billDetails.length ?? 0} Bills)
            </h3>
            <span className="text-xs text-gray-400">
              Reference: Bill Date relative to As-Of Date
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800/80 font-semibold uppercase text-gray-500 border-b border-gray-100 dark:border-gray-800">
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
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-gray-400">
                      Loading bill aging details…
                    </td>
                  </tr>
                ) : !data?.billDetails.length ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-gray-400">
                      No pending bills found as of {data?.asOfDate}.
                    </td>
                  </tr>
                ) : (
                  data.billDetails.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                      <td className="p-3 font-semibold text-gray-900 dark:text-gray-100">
                        {b.partyName}
                      </td>
                      <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        #{b.billNumber}
                      </td>
                      <td className="p-3 whitespace-nowrap text-gray-500">{formatDate(b.billDate)}</td>
                      <td className="p-3 text-right font-mono">{formatCurrency(b.netBillAmount)}</td>
                      <td className="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(b.receivedAmount)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-red-600 dark:text-red-400">
                        {formatCurrency(b.pendingAmount)}
                      </td>
                      <td className="p-3 text-center font-mono font-bold">{b.ageInDays}d</td>
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
                          className="btn btn-ghost btn-xs text-indigo-600 dark:text-indigo-400"
                          title="View Bill Details"
                        >
                          <Eye size={14} /> View
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
