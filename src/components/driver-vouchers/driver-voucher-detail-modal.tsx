"use client";

import React from "react";
import { Modal } from "@/components/ui/modal";
import { Button, Badge } from "@/components/ui/primitives";
import { Printer, AlertCircle, Truck, MapPin, Calendar, FileText } from "lucide-react";
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
      <div className="space-y-6 text-slate-800">
        {/* Status Header */}
        <div className="flex items-center justify-between bg-slate-50 p-3 rounded border border-slate-200">
          <div className="text-xs text-slate-600">
            Source Daily Book Entry: <span className="font-bold text-slate-900">#{voucher.dailyEntrySrNo}</span>
          </div>
          <Badge variant="warning">
            PENDING CONFIRMATION
          </Badge>
        </div>

        {/* Unconfirmed Accounting Notice Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-900 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Accounting Status: Pending Client Confirmation</p>
            <p className="text-amber-800 mt-0.5">
              This driver voucher represents operational trip advances and driver expenses. No ledger journal entries or payment postings have been posted.
            </p>
          </div>
        </div>

        {/* Key Trip Meta Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded border border-slate-200 text-xs">
          <div>
            <p className="text-slate-500 font-medium flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> Voucher Date
            </p>
            <p className="text-slate-900 font-semibold mt-0.5">{formatDate(voucher.voucherDate)}</p>
          </div>

          <div>
            <p className="text-slate-500 font-medium flex items-center gap-1">
              <Truck className="w-3.5 h-3.5 text-slate-400" /> Truck Number
            </p>
            <p className="text-slate-900 font-bold mt-0.5 uppercase">{voucher.truckNumberRaw || "N/A"}</p>
          </div>

          <div>
            <p className="text-slate-500 font-medium flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" /> From Location
            </p>
            <p className="text-slate-900 font-medium mt-0.5">{voucher.fromLocationRaw || "N/A"}</p>
          </div>

          <div>
            <p className="text-slate-500 font-medium flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" /> To Location
            </p>
            <p className="text-slate-900 font-medium mt-0.5">{voucher.toLocationRaw || "N/A"}</p>
          </div>
        </div>

        {/* Operational Expense Breakdown */}
        <div className="border border-slate-200 rounded overflow-hidden">
          <div className="bg-slate-100 px-4 py-2.5 font-semibold text-xs text-slate-700 border-b border-slate-200">
            Operational Trip Advances & Expenses Breakdown
          </div>
          <table className="w-full text-xs">
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="px-4 py-2.5 text-slate-600 font-medium">Advance Amount</td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900">
                  {formatCurrency(advance)}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 text-slate-600 font-medium">Cash Amount</td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900">
                  {formatCurrency(cash)}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 text-slate-600 font-medium">Diesel Amount</td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900">
                  {formatCurrency(diesel)}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 text-slate-600 font-medium">A/c Amount</td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900">
                  {formatCurrency(ac)}
                </td>
              </tr>
              <tr className="bg-slate-900 text-white font-bold">
                <td className="px-4 py-3 text-sm">TOTAL OPERATIONAL VOUCHER AMOUNT</td>
                <td className="px-4 py-3 text-right text-sm font-mono">{formatCurrency(totalExpense)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Remarks Section */}
        {voucher.remarks && (
          <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs">
            <p className="text-slate-500 font-medium mb-1">Remarks:</p>
            <p className="text-slate-800 italic">{voucher.remarks}</p>
          </div>
        )}

        {/* Footer Metadata */}
        <div className="text-[10px] text-slate-400 flex justify-between pt-2 border-t border-slate-100">
          <span>Daily Entry ID: {voucher.dailyEntryId}</span>
          <span>Voucher ID: {voucher.id}</span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <p className="text-xs text-slate-500">Read-Only Operational View</p>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button variant="primary" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-1.5" />
              Print Voucher
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
