"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useFirm } from "@/lib/firm-context";
import { PageHeader } from "@/components/ui/page-header";
import { Button, Badge } from "@/components/ui/primitives";
import {
  Search,
  RefreshCw,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { DriverVoucherDetailModal } from "@/components/driver-vouchers/driver-voucher-detail-modal";

import Link from "next/link";

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
    <div className="space-y-6 text-[#1A1D20]">
      {/* Header */}
      <PageHeader
        title="Driver Vouchers"
        subtitle="Advances and expense vouchers raised from Daily Book trips."
        actions={
          <button
            type="button"
            onClick={fetchVouchers}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8D5CE] bg-white px-3.5 py-2 text-xs font-semibold text-[#1A1D20] shadow-xs hover:bg-[#FAF8F5] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-[#FDEDED] border border-[#D32F2F]/30 flex items-center justify-between text-[#D32F2F] text-xs">
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={fetchVouchers}>
            Retry
          </Button>
        </div>
      )}

      {/* Notice Banner */}
      <div className="bg-[#FAF8F5] border border-[#D8D5CE] rounded-xl p-4 text-xs text-[#5F6368]">
        These vouchers track operational trip advances and driver expenses (Advance, Cash, Diesel, A/C) generated automatically from Daily Book trips. They are maintained for operational reference while accounting treatment remains pending.
      </div>

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <div className="bg-white border border-[#D8D5CE] rounded-xl p-3.5 shadow-xs">
          <p className="text-[11px] font-bold text-[#7A7F85] uppercase tracking-wider">Total Vouchers</p>
          <p className="text-xl font-bold text-[#1A1D20] font-mono-nums mt-1">{metrics.totalVouchers}</p>
        </div>

        <div className="bg-white border border-[#D8D5CE] rounded-xl p-3.5 shadow-xs">
          <p className="text-[11px] font-bold text-[#7A7F85] uppercase tracking-wider">Total Advance</p>
          <p className="text-sm font-bold text-[#1A1D20] font-mono-nums mt-1">{formatCurrency(metrics.totalAdvance)}</p>
        </div>

        <div className="bg-white border border-[#D8D5CE] rounded-xl p-3.5 shadow-xs">
          <p className="text-[11px] font-bold text-[#7A7F85] uppercase tracking-wider">Total Cash</p>
          <p className="text-sm font-bold text-[#1A1D20] font-mono-nums mt-1">{formatCurrency(metrics.totalCash)}</p>
        </div>

        <div className="bg-white border border-[#D8D5CE] rounded-xl p-3.5 shadow-xs">
          <p className="text-[11px] font-bold text-[#7A7F85] uppercase tracking-wider">Total Diesel</p>
          <p className="text-sm font-bold text-[#1A1D20] font-mono-nums mt-1">{formatCurrency(metrics.totalDiesel)}</p>
        </div>

        <div className="bg-white border border-[#D8D5CE] rounded-xl p-3.5 shadow-xs">
          <p className="text-[11px] font-bold text-[#7A7F85] uppercase tracking-wider">Total A/c</p>
          <p className="text-sm font-bold text-[#1A1D20] font-mono-nums mt-1">{formatCurrency(metrics.totalAc)}</p>
        </div>

        <div className="bg-[#FAF8F5] border border-[#D8D5CE] rounded-xl p-3.5 shadow-xs">
          <p className="text-[11px] font-bold text-[#7A7F85] uppercase tracking-wider">Total Operational</p>
          <p className="text-sm font-bold text-[#1A1D20] font-mono-nums mt-1">{formatCurrency(metrics.totalExpense)}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-[#D8D5CE] rounded-xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#7A7F85]" />
            <input
              type="text"
              placeholder="Search truck, route, remarks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input search-input text-xs"
            />
          </div>

          {/* Truck Filter */}
          <div>
            <input
              type="text"
              placeholder="Filter by Truck No..."
              value={truckFilter}
              onChange={(e) => setTruckFilter(e.target.value)}
              className="form-input text-xs"
            />
          </div>

          {/* Start Date */}
          <div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="form-input text-xs"
              title="Start date"
            />
          </div>

          {/* End Date */}
          <div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="form-input text-xs"
              title="End date"
            />
          </div>
        </div>

        {(search || startDate || endDate || truckFilter) && (
          <div className="flex justify-end pt-1">
            <button onClick={handleClearFilters} className="text-xs text-[#5F6368] hover:text-[#1A1D20] underline">
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Vouchers Table */}
      <div className="bg-white border border-[#D8D5CE] rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-[#1A1D20] border-collapse">
            <thead className="bg-[#FAF8F5] text-[#5F6368] font-semibold border-b border-[#D8D5CE] uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3 text-center">Trip SR No.</th>
                <th className="px-4 py-3">Voucher Date</th>
                <th className="px-4 py-3">Truck No</th>
                <th className="px-4 py-3">Route (From → To)</th>
                <th className="px-4 py-3 text-right">Advance (₹)</th>
                <th className="px-4 py-3 text-right">Cash (₹)</th>
                <th className="px-4 py-3 text-right">Diesel (₹)</th>
                <th className="px-4 py-3 text-right">A/c (₹)</th>
                <th className="px-4 py-3 text-right font-bold">Total (₹)</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFECE6]">
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-[#7A7F85]">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-[#E05638]" />
                    Loading driver vouchers...
                  </td>
                </tr>
              ) : vouchers.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-[#7A7F85]">
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
                    <tr key={item.id} className="hover:bg-[#FAF8F5] transition-colors">
                      <td className="px-4 py-3 text-center font-mono-nums font-bold text-[#E05638]">
                        #{item.dailyEntrySrNo}
                      </td>
                      <td className="px-4 py-3 font-mono-nums text-[#1A1D20]">{formatDate(item.voucherDate)}</td>
                      <td className="px-4 py-3 font-bold uppercase text-[#1A1D20] font-mono-nums">
                        {item.truckNumberRaw || "-"}
                      </td>
                      <td className="px-4 py-3 text-[#5F6368]">
                        {item.fromLocationRaw || "-"} → {item.toLocationRaw || "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono-nums text-[#1A1D20]">
                        {adv > 0 ? formatCurrency(adv) : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono-nums text-[#1A1D20]">
                        {csh > 0 ? formatCurrency(csh) : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono-nums text-[#1A1D20]">
                        {dsl > 0 ? formatCurrency(dsl) : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono-nums text-[#1A1D20]">
                        {acVal > 0 ? formatCurrency(acVal) : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono-nums font-bold text-[#1A1D20]">
                        {formatCurrency(total)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="warning" title={`Generated from Daily Book Entry #${item.dailyEntrySrNo}`}>
                          Pending Confirmation
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleViewVoucher(item)}
                            className="rounded-lg border border-[#D8D5CE] bg-white px-2.5 py-1 text-xs font-semibold text-[#1A1D20] hover:bg-[#FAF8F5] transition-colors"
                          >
                            View
                          </button>
                          <Link
                            href={`/daily-book?edit=${item.dailyEntryId}`}
                            className="rounded-lg border border-[#D8D5CE] bg-white px-2.5 py-1 text-xs font-semibold text-[#E05638] hover:bg-[#FAF8F5] transition-colors"
                          >
                            Edit Daily Book
                          </Link>
                        </div>
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
