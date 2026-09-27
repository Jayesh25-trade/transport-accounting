"use client";

import React from "react";
import { Modal } from "@/components/ui/modal";
import { Button, Badge } from "@/components/ui/primitives";
import { formatCurrency, formatDate } from "@/lib/utils";

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
  if (!voucher) return null;

  const advance = Number(voucher.advance || 0);
  const cash = Number(voucher.cash || 0);
  const diesel = Number(voucher.diesel || 0);
  const ac = Number(voucher.ac || 0);
  const totalExpense = advance + cash + diesel + ac;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title={`Driver Voucher #${voucher.dailyEntrySrNo || voucher.id.substring(0, 8)}`}
      size="lg"
    >
      <div className="space-y-4 text-[#1A1D20]">
        {/* Status Header */}
        <div className="flex items-center justify-between bg-[#FAF8F5] p-3.5 rounded-xl border border-[#D8D5CE] shadow-xs">
          <div className="text-xs text-[#5F6368]">
            Source Daily Book Entry: <span className="font-bold text-[#1A1D20]">#{voucher.dailyEntrySrNo}</span>
          </div>
          <Badge variant="warning">
            PENDING CONFIRMATION
          </Badge>
        </div>

        {/* Unconfirmed Accounting Notice Banner */}
        <div className="bg-[#FFF4E5] border border-[#ED6C02]/30 rounded-xl p-3.5 text-xs text-[#92400E]">
          <p className="font-bold">Accounting Status: Pending Client Confirmation</p>
          <p className="text-[#B45309] mt-0.5">
            This driver voucher represents operational trip advances and driver expenses. No ledger journal entries or payment postings have been posted.
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
          <span>Daily Entry ID: {voucher.dailyEntryId}</span>
          <span>Voucher ID: {voucher.id}</span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-3 border-t border-[#D8D5CE]">
          <p className="text-xs text-[#7A7F85]">Read-Only Operational View</p>
          <div className="flex items-center gap-2">
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
  );
}
