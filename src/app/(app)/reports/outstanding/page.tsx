"use client";

import React, { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard, StatCardSkeleton } from "@/components/ui/stat-card";
import { Badge, Button } from "@/components/ui/primitives";
import { BillDetailModal } from "@/components/bills/bill-detail-modal";
import { useApiClient } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  FileText,
  IndianRupee,
  CreditCard,
  Clock,
  Printer,
  Eye,
  Filter,
  RotateCcw,
} from "lucide-react";

interface PartyOption {
  id: string;
  name: string;
}

interface OutstandingReportData {
  bills: Array<{
    id: string;
    firmId: string;
    partyId: string;
    partyName: string;
    billNumber: number;
    billDate: string;
    grossBillAmount: number;
    shortageDebit: number;
    tdsAmount: number;
    netBillAmount: number;
    receivedAmount: number;
    pendingAmount: number;
    status: "PENDING" | "PARTIALLY_PAID" | "PAID";
  }>;
  summary: {
    totalOutstanding: number;
    totalPendingBills: number;
    totalPartiallyPaidBills: number;
    totalPaidBills: number;
    totalBillsCount: number;
    totalUnallocatedAdvances: number;
  };
  advances: Array<{
    id: string;
    partyId: string;
    partyName: string;
    paymentDate: string;
    paymentMode: string;
    referenceNumber?: string;
    amount: number;
    unallocatedAmount: number;
  }>;
}

export default function OutstandingReportPage() {
  const api = useApiClient();

  const [parties, setParties] = useState<PartyOption[]>([]);
  const [partyId, setPartyId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const [data, setData] = useState<OutstandingReportData | null>(null);
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

  // Fetch Outstanding Report Data
  const fetchReport = useCallback(async () => {
    if (!api.ready) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (partyId) query.set("partyId", partyId);
      if (dateFrom) query.set("dateFrom", dateFrom);
      if (dateTo) query.set("dateTo", dateTo);
      if (statusFilter && statusFilter !== "ALL") query.set("status", statusFilter);

      const res = await api.get<OutstandingReportData>(
        `/api/reports/outstanding?${query.toString()}`
      );
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load outstanding report");
    } finally {
      setLoading(false);
    }
  }, [api, partyId, dateFrom, dateTo, statusFilter]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleResetFilters = () => {
    setPartyId("");
    setDateFrom("");
    setDateTo("");
    setStatusFilter("ALL");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fade-in print:p-0 pb-20 text-[#1A1D20]">
      {/* Header */}
      <PageHeader
        title="Outstanding Report"
        subtitle="Customer-wise unpaid bills and unallocated advances"
        breadcrumbs={[{ label: "Reports" }, { label: "Outstanding" }]}
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
            <span>Report Filters</span>
          </div>
          {(partyId || dateFrom || dateTo || statusFilter !== "ALL") && (
            <button
              onClick={handleResetFilters}
              className="text-xs text-[#E05638] hover:underline flex items-center gap-1 font-semibold"
            >
              <RotateCcw size={12} /> Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
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
            <label className="block text-[11px] font-bold text-[#5F6368] uppercase tracking-wider mb-1">Bill Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="form-input w-full font-medium text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#5F6368] uppercase tracking-wider mb-1">Bill Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="form-input w-full font-medium text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#5F6368] uppercase tracking-wider mb-1">Bill Payment Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-input w-full font-medium text-xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending (Unpaid)</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="PAID">Fully Paid</option>
            </select>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              label="Total Outstanding"
              value={formatCurrency(data?.summary.totalOutstanding ?? 0)}
              sub="Uncollected bill balance"
              icon={IndianRupee}
              iconColor="#E05638"
              className="bg-[#FAF8F5] border-[#E05638]/40"
            />
            <StatCard
              label="Unallocated Advances"
              value={formatCurrency(data?.summary.totalUnallocatedAdvances ?? 0)}
              sub="Customer advances on account"
              icon={CreditCard}
              iconColor="#8b5cf6"
            />
            <StatCard
              label="Unpaid Pending Bills"
              value={data?.summary.totalPendingBills ?? 0}
              sub="Zero payment received"
              icon={FileText}
              iconColor="#f59e0b"
            />
            <StatCard
              label="Partially Paid Bills"
              value={data?.summary.totalPartiallyPaidBills ?? 0}
              sub="Partial payments received"
              icon={Clock}
              iconColor="#3b82f6"
            />
          </>
        )}
      </div>

      {/* Main Table */}
      <div className="rounded-2xl border border-[#D8D5CE] bg-white overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[#EFECE6] bg-[#FAF8F5] flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#1A1D20] flex items-center gap-2 uppercase tracking-wider">
            <FileText size={15} className="text-[#E05638]" />
            Outstanding Bills ({data?.bills.length ?? 0})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[900px]">
            <thead className="bg-[#FAF8F5] border-b border-[#D8D5CE] font-bold text-[#5F6368] uppercase text-[11px] tracking-wider">
              <tr>
                <th className="p-3">Party Name</th>
                <th className="p-3">Bill No</th>
                <th className="p-3">Bill Date</th>
                <th className="p-3 text-right">Gross amount</th>
                <th className="p-3 text-right">Shortage</th>
                <th className="p-3 text-right">TDS</th>
                <th className="p-3 text-right">Net Bill</th>
                <th className="p-3 text-right">Received</th>
                <th className="p-3 text-right font-bold text-[#1A1D20]">Outstanding</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center print:hidden">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFECE6]">
              {loading ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-[#7A7F85]">
                    Loading outstanding report…
                  </td>
                </tr>
              ) : !data?.bills.length ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-[#7A7F85]">
                    No outstanding bills match the selected filters.
                  </td>
                </tr>
              ) : (
                data.bills.map((b) => (
                  <tr key={b.id} className="hover:bg-[#FAF8F5]/80 transition-colors">
                    <td className="p-3 font-bold text-[#1A1D20]">
                      {b.partyName}
                    </td>
                    <td className="p-3 font-mono-nums font-bold text-[#E05638]">
                      #{b.billNumber}
                    </td>
                    <td className="p-3 whitespace-nowrap text-[#5F6368]">{formatDate(b.billDate)}</td>
                    <td className="p-3 text-right font-mono-nums font-medium">{formatCurrency(b.grossBillAmount)}</td>
                    <td className="p-3 text-right font-mono-nums text-red-600 font-semibold">
                      {b.shortageDebit > 0 ? `- ${formatCurrency(b.shortageDebit)}` : "—"}
                    </td>
                    <td className="p-3 text-right font-mono-nums text-amber-700 font-semibold">
                      {b.tdsAmount > 0 ? `- ${formatCurrency(b.tdsAmount)}` : "—"}
                    </td>
                    <td className="p-3 text-right font-mono-nums font-medium">{formatCurrency(b.netBillAmount)}</td>
                    <td className="p-3 text-right font-mono-nums text-emerald-700 font-semibold">
                      {formatCurrency(b.receivedAmount)}
                    </td>
                    <td className="p-3 text-right font-mono-nums font-bold text-red-600">
                      {formatCurrency(b.pendingAmount)}
                    </td>
                    <td className="p-3 text-center">
                      <Badge
                        variant={
                          b.status === "PAID"
                            ? "success"
                            : b.status === "PARTIALLY_PAID"
                            ? "warning"
                            : "danger"
                        }
                      >
                        {b.status}
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

      {/* Separate Advance Summary Section */}
      {Boolean(data?.advances.length) && (
        <div className="rounded-2xl border border-[#D8D5CE] bg-white overflow-hidden shadow-xs">
          <div className="p-4 border-b border-[#EFECE6] bg-purple-50/50">
            <h3 className="text-xs font-bold text-purple-900 flex items-center gap-2 uppercase tracking-wider">
              <CreditCard size={15} className="text-purple-600" />
              Unallocated Customer Advances ({data?.advances.length})
            </h3>
            <p className="text-[11px] text-purple-700 mt-0.5">
              Advances remain unallocated and separate from individual bill outstanding balances.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead className="bg-[#FAF8F5] border-b border-[#D8D5CE] font-bold text-[#5F6368] uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="p-3">Party Name</th>
                  <th className="p-3">Payment Date</th>
                  <th className="p-3">Mode</th>
                  <th className="p-3">Ref / Cheque No</th>
                  <th className="p-3 text-right">Total Payment</th>
                  <th className="p-3 text-right font-bold text-purple-900">Unallocated Advance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFECE6]">
                {data?.advances.map((adv) => (
                  <tr key={adv.id} className="hover:bg-[#FAF8F5]/80 transition-colors">
                    <td className="p-3 font-bold text-[#1A1D20]">
                      {adv.partyName}
                    </td>
                    <td className="p-3 text-[#5F6368]">{formatDate(adv.paymentDate)}</td>
                    <td className="p-3">
                      <Badge variant="neutral">{adv.paymentMode}</Badge>
                    </td>
                    <td className="p-3 font-mono-nums text-[#7A7F85]">{adv.referenceNumber || "—"}</td>
                    <td className="p-3 text-right font-mono-nums">{formatCurrency(adv.amount)}</td>
                    <td className="p-3 text-right font-mono-nums font-bold text-purple-700">
                      {formatCurrency(adv.unallocatedAmount)}
                    </td>
                  </tr>
                ))}
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
