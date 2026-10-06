"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Modal } from "@/components/ui/modal";
import { Button, Badge } from "@/components/ui/primitives";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useFirm } from "@/lib/firm-context";

import Link from "next/link";

interface DriverVoucherDetailModalProps {
  voucher: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DriverVoucherDetailModal({
  voucher,
  open,
  onOpenChange,
}: DriverVoucherDetailModalProps) {
  const { currentFirm } = useFirm();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!voucher) return null;

  const advance = Number(voucher.advance || 0);
  const cash = Number(voucher.cash || 0);
  const diesel = Number(voucher.diesel || 0);
  const ac = Number(voucher.ac || 0);
  const totalExpense = advance + cash + diesel + ac;

  const handlePrint = () => {
    document.body.classList.add("driver-voucher-printing");

    const cleanup = () => {
      document.body.classList.remove("driver-voucher-printing");
      window.removeEventListener("afterprint", cleanup);
    };

    window.addEventListener("afterprint", cleanup);
    window.print();
    setTimeout(cleanup, 1000);
  };

  return (
    <>
      <Modal
        open={open}
        onClose={() => onOpenChange(false)}
        title={`Driver Voucher #${voucher.dailyEntrySrNo}`}
        size="lg"
      >
        <div className="space-y-4 text-[#1A1D20]">
          {/* Status Header */}
          <div className="flex items-center justify-between bg-[#FAF8F5] p-3.5 rounded-xl border border-[#D8D5CE] shadow-xs">
            <div className="text-xs text-[#5F6368]">
              Source: <span className="font-bold text-[#1A1D20]">Generated from Daily Book Entry #{voucher.dailyEntrySrNo}</span>
            </div>
            <Badge variant="warning">
              Pending Confirmation
            </Badge>
          </div>

          {/* Unconfirmed Accounting Notice Banner */}
          <div className="bg-[#FFF4E5] border border-[#ED6C02]/30 rounded-xl p-3.5 text-xs text-[#92400E]">
            <p className="font-bold">Accounting Status: Pending Confirmation</p>
            <p className="text-[#B45309] mt-0.5">
              This voucher is generated from Daily Book Entry #{voucher.dailyEntrySrNo} and is awaiting confirmation. Operational trip advances and driver expenses are tracked here for reference.
            </p>
          </div>

          {/* Key Trip Meta Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#FAF8F5] p-4 rounded-xl border border-[#D8D5CE] text-xs shadow-xs">
            <div>
              <p className="text-[#7A7F85] font-bold uppercase text-[10px] tracking-wider">Voucher Date</p>
              <p className="text-[#1A1D20] font-semibold mt-1">{formatDate(voucher.voucherDate)}</p>
            </div>

            <div>
              <p className="text-[#7A7F85] font-bold uppercase text-[10px] tracking-wider">Truck Number</p>
              <p className="text-[#1A1D20] font-bold mt-1 uppercase font-mono-nums">{voucher.truckNumberRaw || "N/A"}</p>
            </div>

            <div>
              <p className="text-[#7A7F85] font-bold uppercase text-[10px] tracking-wider">From Location</p>
              <p className="text-[#1A1D20] font-medium mt-1">{voucher.fromLocationRaw || "N/A"}</p>
            </div>

            <div>
              <p className="text-[#7A7F85] font-bold uppercase text-[10px] tracking-wider">To Location</p>
              <p className="text-[#1A1D20] font-medium mt-1">{voucher.toLocationRaw || "N/A"}</p>
            </div>
          </div>

          {/* Operational Expense Breakdown */}
          <div className="border border-[#D8D5CE] rounded-xl overflow-hidden bg-white shadow-xs">
            <div className="bg-[#FAF8F5] px-4 py-2.5 font-bold text-xs text-[#5F6368] uppercase tracking-wider border-b border-[#D8D5CE]">
              Operational Trip Advances & Expenses Breakdown
            </div>
            <table className="w-full text-xs border-collapse">
              <tbody className="divide-y divide-[#EFECE6]">
                <tr>
                  <td className="px-4 py-2.5 text-[#5F6368] font-medium">Advance Amount</td>
                  <td className="px-4 py-2.5 text-right font-mono-nums font-bold text-[#1A1D20]">
                    {formatCurrency(advance)}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-[#5F6368] font-medium">Cash Amount</td>
                  <td className="px-4 py-2.5 text-right font-mono-nums font-bold text-[#1A1D20]">
                    {formatCurrency(cash)}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-[#5F6368] font-medium">Diesel Amount</td>
                  <td className="px-4 py-2.5 text-right font-mono-nums font-bold text-[#1A1D20]">
                    {formatCurrency(diesel)}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-[#5F6368] font-medium">A/c Amount</td>
                  <td className="px-4 py-2.5 text-right font-mono-nums font-bold text-[#1A1D20]">
                    {formatCurrency(ac)}
                  </td>
                </tr>
                <tr className="bg-[#FAF8F5] text-[#1A1D20] font-bold border-t border-[#D8D5CE]">
                  <td className="px-4 py-3 text-xs uppercase tracking-wider">TOTAL OPERATIONAL VOUCHER AMOUNT</td>
                  <td className="px-4 py-3 text-right text-sm font-mono-nums font-bold text-[#E05638]">{formatCurrency(totalExpense)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Remarks Section */}
          {voucher.remarks && (
            <div className="bg-white border border-[#D8D5CE] rounded-xl p-3.5 text-xs text-[#5F6368]">
              <p className="text-[#1A1D20] font-bold mb-1">Remarks:</p>
              <p className="italic">{voucher.remarks}</p>
            </div>
          )}

          {/* Footer Metadata */}
          <div className="text-[10px] text-[#7A7F85] flex justify-between pt-2 border-t border-[#EFECE6]">
            <span>Daily Entry Sr No: #{voucher.dailyEntrySrNo || "—"}</span>
            <span>Date: {voucher.voucherDate ? new Date(voucher.voucherDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</span>
          </div>

          {/* Action Controls */}
          <div className="flex items-center justify-between pt-3 border-t border-[#D8D5CE]">
            <p className="text-xs text-[#7A7F85]">Source: Daily Book Entry #{voucher.dailyEntrySrNo}</p>
            <div className="flex items-center gap-2">
              <Link
                href={`/daily-book?edit=${voucher.dailyEntryId}`}
                className="inline-flex items-center justify-center rounded-lg border border-[#D8D5CE] bg-white px-3 py-1.5 text-xs font-semibold text-[#E05638] hover:bg-[#FAF8F5] transition-colors"
              >
                Edit Daily Book
              </Link>
              <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button variant="coral" size="sm" onClick={handlePrint}>
                Print Voucher
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ─── DEDICATED PRINT PORTAL (Mounted directly to body root) ───────── */}
      {mounted && open && createPortal(
        <div id="driver-voucher-print-root" className="text-[#1A1D20] font-sans p-2">
          {/* Document Header */}
          <div className="border-b-2 border-[#1A1D20] pb-3 mb-4 flex justify-between items-start">
            <div>
              <h1 className="text-xl font-bold uppercase tracking-tight text-[#1A1D20]">
                {currentFirm?.name || "TRANSPORT FIRM"}
              </h1>
              {currentFirm?.code && (
                <p className="text-xs font-semibold text-[#5F6368] mt-0.5">
                  Firm Code: <span className="text-[#1A1D20] font-mono-nums">{currentFirm.code}</span>
                </p>
              )}
            </div>
            <div className="text-right">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#1A1D20] bg-[#FAF8F5] px-3 py-1 border border-[#D8D5CE] rounded">
                DRIVER VOUCHER / OPERATIONAL EXPENSE VOUCHER
              </h2>
              <p className="text-xs font-mono-nums font-bold text-[#1A1D20] mt-1.5">
                Voucher / Daily Book No: #{voucher.dailyEntrySrNo}
              </p>
            </div>
          </div>

          {/* Key Operational Meta Grid */}
          <div className="grid grid-cols-2 gap-4 border border-[#D8D5CE] rounded-lg p-3.5 mb-4 text-xs bg-[#FAF8F5]">
            <div className="space-y-1.5">
              <p><span className="font-semibold text-[#5F6368]">Voucher Date:</span> <span className="font-bold">{formatDate(voucher.voucherDate)}</span></p>
              <p><span className="font-semibold text-[#5F6368]">Truck Number:</span> <span className="font-bold font-mono-nums uppercase">{voucher.truckNumberRaw || "—"}</span></p>
              {voucher.dailyEntryPartyName && (
                <p><span className="font-semibold text-[#5F6368]">Party Name:</span> <span>{voucher.dailyEntryPartyName}</span></p>
              )}
            </div>
            <div className="space-y-1.5">
              <p><span className="font-semibold text-[#5F6368]">From Location:</span> <span className="font-medium">{voucher.fromLocationRaw || "—"}</span></p>
              <p><span className="font-semibold text-[#5F6368]">To Location:</span> <span className="font-medium">{voucher.toLocationRaw || "—"}</span></p>
              {voucher.dailyEntryLrNumber && (
                <p><span className="font-semibold text-[#5F6368]">LR Number:</span> <span className="font-mono-nums">{voucher.dailyEntryLrNumber}</span></p>
              )}
            </div>
          </div>

          {/* Expense Breakdown Table */}
          <div className="border border-[#1A1D20] rounded-lg overflow-hidden mb-4">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#1A1D20] text-white uppercase text-[10px] tracking-wider font-bold">
                  <th className="px-4 py-2 text-left">Operational Expense Particulars</th>
                  <th className="px-4 py-2 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8D5CE]">
                <tr>
                  <td className="px-4 py-2.5 font-medium text-[#3C4043]">Advance</td>
                  <td className="px-4 py-2.5 text-right font-mono-nums font-semibold text-[#1A1D20]">{formatCurrency(advance)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium text-[#3C4043]">Cash</td>
                  <td className="px-4 py-2.5 text-right font-mono-nums font-semibold text-[#1A1D20]">{formatCurrency(cash)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium text-[#3C4043]">Diesel</td>
                  <td className="px-4 py-2.5 text-right font-mono-nums font-semibold text-[#1A1D20]">{formatCurrency(diesel)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium text-[#3C4043]">A/c</td>
                  <td className="px-4 py-2.5 text-right font-mono-nums font-semibold text-[#1A1D20]">{formatCurrency(ac)}</td>
                </tr>
                <tr className="bg-[#FAF8F5] border-t-2 border-[#1A1D20] font-bold">
                  <td className="px-4 py-3 uppercase tracking-wider text-xs">TOTAL OPERATIONAL AMOUNT</td>
                  <td className="px-4 py-3 text-right text-sm font-mono-nums font-bold text-[#1A1D20]">{formatCurrency(totalExpense)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Remarks Section (Only rendered if available) */}
          {voucher.remarks && (
            <div className="border border-[#D8D5CE] rounded-lg p-3 mb-4 text-xs bg-white">
              <span className="font-bold text-[#5F6368]">Remarks: </span>
              <span className="italic text-[#1A1D20]">{voucher.remarks}</span>
            </div>
          )}

          {/* Accounting Status Footer Notice */}
          <div className="border border-[#ED6C02]/40 bg-[#FFF4E5] rounded-lg p-2.5 text-[11px] text-[#92400E] flex justify-between items-center">
            <span>Accounting Status: <strong className="font-bold">PENDING CLIENT CONFIRMATION</strong></span>
            <span className="text-[10px] text-[#78350F] font-mono-nums">Daily Book Sr No: #{voucher.dailyEntrySrNo}</span>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

