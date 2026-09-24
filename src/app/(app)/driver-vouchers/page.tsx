"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useFirm } from "@/lib/firm-context";
import { PageHeader } from "@/components/ui/page-header";
import { Button, Badge } from "@/components/ui/primitives";
import {
  FileText,
  Search,
  RefreshCw,
  Eye,
  Calendar,
  Truck,
  AlertCircle,
  Clock,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { DriverVoucherDetailModal } from "@/components/driver-vouchers/driver-voucher-detail-modal";

interface DriverVoucherItem {
  id: string;
  firmId: string;
  dailyEntryId: string;
  voucherDate: string;
  advance: string | null;
  cash: string | null;
  diesel: string | null;
  ac: string | null;
  truckNumberRaw: string | null;
  fromLocationRaw: string | null;
  toLocationRaw: string | null;
  remarks: string | null;
  accountingStatus: "PENDING_CONFIRMATION" | "CONFIRMED";
  dailyEntrySrNo: number;
  dailyEntryLrNumber: string | null;
}

interface Metrics {
  totalVouchers: number;
  totalAdvance: number;
  totalCash: number;
  totalDiesel: number;
  totalAc: number;
  totalExpense: number;
}

export default function DriverVouchersPage() {
  const { currentFirm } = useFirm();

  const [vouchers, setVouchers] = useState<DriverVoucherItem[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    totalVouchers: 0,
    totalAdvance: 0,
    totalCash: 0,
    totalDiesel: 0,
    totalAc: 0,
    totalExpense: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [truckFilter, setTruckFilter] = useState("");

  // Modal selection
  const [selectedVoucher, setSelectedVoucher] = useState<DriverVoucherItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchVouchers = useCallback(async () => {
    if (!currentFirm) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (truckFilter) params.set("truckNumber", truckFilter);

      const res = await fetch(`/api/driver-vouchers?${params.toString()}`, {
        headers: { "x-firm-id": currentFirm.id },
      });
      const data = await res.json();
      if (res.ok && data.success !== false) {
        setVouchers(data.vouchers || []);
        setMetrics(
          data.metrics || {
            totalVouchers: 0,
            totalAdvance: 0,
            totalCash: 0,
            totalDiesel: 0,
            totalAc: 0,
            totalExpense: 0,
          }
        );
      } else {
        throw new Error(data.error?.message || "Failed to load driver vouchers");
      }
    } catch (err: any) {
      console.error("Failed to fetch driver vouchers:", err);
      setError(err?.message || "Failed to load driver vouchers");
    } finally {
      setLoading(false);
    }
  }, [currentFirm, search, startDate, endDate, truckFilter]);

  useEffect(() => {
    fetchVouchers();
  }, [fetchVouchers]);

  const handleClearFilters = () => {
    setSearch("");
    setStartDate("");
    setEndDate("");
    setTruckFilter("");
  };

  const handleViewVoucher = (voucher: DriverVoucherItem) => {
    setSelectedVoucher(voucher);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Driver Vouchers"
        subtitle="Operational trip advances & driver expense vouchers (Accounting Status: PENDING CONFIRMATION)"
        actions={
          <Button variant="secondary" size="sm" onClick={fetchVouchers} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between text-red-700 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={fetchVouchers}>
            Retry
          </Button>
        </div>
      )}

      {/* Notice Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded p-3.5 text-xs text-amber-900 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-amber-950">Read-Only Accounting Status (Pending Confirmation):</span> Driver Vouchers are automatically synchronized 1-to-1 from Daily Book entries. In accordance with client specifications, accounting Dr/Cr treatment is pending confirmation and **no ledger postings or payment entries** have been generated.
        </div>
      </div>

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200 rounded p-3 shadow-sm">
          <p className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-blue-500" /> Total Vouchers
          </p>
          <p className="text-lg font-bold text-slate-900 mt-1">{metrics.totalVouchers}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded p-3 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total Advance</p>
          <p className="text-sm font-bold text-slate-900 font-mono mt-1">{formatCurrency(metrics.totalAdvance)}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded p-3 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total Cash</p>
          <p className="text-sm font-bold text-slate-900 font-mono mt-1">{formatCurrency(metrics.totalCash)}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded p-3 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total Diesel</p>
          <p className="text-sm font-bold text-slate-900 font-mono mt-1">{formatCurrency(metrics.totalDiesel)}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded p-3 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total A/c</p>
          <p className="text-sm font-bold text-slate-900 font-mono mt-1">{formatCurrency(metrics.totalAc)}</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded p-3 shadow-sm">
          <p className="text-xs font-semibold text-blue-700">Total Operational</p>
          <p className="text-sm font-extrabold text-blue-900 font-mono mt-1">{formatCurrency(metrics.totalExpense)}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search truck, route, remarks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Truck Filter */}
          <div className="relative">
            <Truck className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by Truck No..."
              value={truckFilter}
              onChange={(e) => setTruckFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Start Date */}
          <div className="relative">
            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* End Date */}
          <div className="relative">
            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {(search || startDate || endDate || truckFilter) && (
          <div className="flex justify-end pt-1">
            <button onClick={handleClearFilters} className="text-xs text-slate-500 hover:text-slate-800 underline">
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Vouchers Table */}
      <div className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-700">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3 text-center">Daily Entry #</th>
                <th className="px-4 py-3">Voucher Date</th>
                <th className="px-4 py-3">Truck No</th>
                <th className="px-4 py-3">Route (From → To)</th>
                <th className="px-4 py-3 text-right">Advance (₹)</th>
                <th className="px-4 py-3 text-right">Cash (₹)</th>
                <th className="px-4 py-3 text-right">Diesel (₹)</th>
                <th className="px-4 py-3 text-right">A/c (₹)</th>
                <th className="px-4 py-3 text-right font-bold">Total (₹)</th>
                <th className="px-4 py-3 text-center">Accounting Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading driver vouchers...
                  </td>
                </tr>
              ) : vouchers.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                    No driver vouchers found matching filter criteria.
                  </td>
                </tr>
              ) : (
                vouchers.map((item) => {
                  const adv = Number(item.advance || 0);
                  const csh = Number(item.cash || 0);
                  const dsl = Number(item.diesel || 0);
                  const acVal = Number(item.ac || 0);
                  const total = adv + csh + dsl + acVal;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-center font-mono font-bold text-blue-600">
                        #{item.dailyEntrySrNo}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-900">{formatDate(item.voucherDate)}</td>
                      <td className="px-4 py-3 font-semibold uppercase text-slate-900">
                        {item.truckNumberRaw || "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {item.fromLocationRaw || "-"} → {item.toLocationRaw || "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-900">
                        {adv > 0 ? formatCurrency(adv) : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-900">
                        {csh > 0 ? formatCurrency(csh) : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-900">
                        {dsl > 0 ? formatCurrency(dsl) : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-900">
                        {acVal > 0 ? formatCurrency(acVal) : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(total)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="warning">
                          PENDING CONFIRMATION
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewVoucher(item)}
                          className="h-7 px-2 text-xs text-blue-600 hover:text-blue-800"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" /> View
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View & Print Modal */}
      <DriverVoucherDetailModal
        voucher={selectedVoucher}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </div>
  );
}
