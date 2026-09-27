"use client";

import React, { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/primitives";
import { useApiClient, ApiError } from "@/lib/api-client";
import { useFirm } from "@/lib/firm-context";
import { formatCurrency, formatDate } from "@/lib/utils";

interface BillDetailModalProps {
  billId: string | null;
  onClose: () => void;
}

export function BillDetailModal({ billId, onClose }: BillDetailModalProps) {
  const api = useApiClient();
  const { currentFirm } = useFirm();
  const firmIdParam = currentFirm?.id ? `?firmId=${encodeURIComponent(currentFirm.id)}` : "";
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!billId) return;
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<any>(`/api/bills/${billId}`);
        if (mounted) setDetail(res);
      } catch (err: any) {
        if (mounted) setError(err instanceof ApiError ? err.message : "Failed to load bill details");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [api, billId]);

  if (!billId) return null;

  return (
    <Modal open={Boolean(billId)} onClose={onClose} title={detail ? `Bill Invoice #${detail.billNumber}` : "Bill Details"} size="lg">
      {loading ? (
        <div className="p-8 text-center text-[#7A7F85] text-sm">Loading bill details…</div>
      ) : error || !detail ? (
        <div className="p-4 bg-[#FDEDED] text-[#D32F2F] rounded-lg text-xs">{error || "Bill details not found"}</div>
      ) : (
        <div className="space-y-4 text-[#1A1D20]">
          {/* Top Banner */}
          <div className="flex flex-wrap items-center justify-between p-4 rounded-xl bg-[#FAF8F5] border border-[#D8D5CE] shadow-xs">
            <div>
              <span className="text-xs text-[#7A7F85] font-bold uppercase tracking-wider block">
                Bill Invoice #{detail.billNumber}
              </span>
              <h3 className="text-lg font-bold text-[#1A1D20] mt-0.5">
                {detail.partyName || "Customer Invoice"}
              </h3>
              <span className="text-xs text-[#5F6368]">Date: {formatDate(detail.billDate)}</span>
            </div>
            <div className="text-right">
              <Badge variant={Number(detail.pendingAmount) === 0 ? "success" : Number(detail.receivedAmount) > 0 ? "warning" : "neutral"}>
                {Number(detail.pendingAmount) === 0 ? "PAID" : Number(detail.receivedAmount) > 0 ? "PARTIALLY_PAID" : "PENDING"}
              </Badge>
              <div className="text-xs font-mono-nums text-[#5F6368] mt-1.5 font-semibold">
                Pending: {formatCurrency(detail.pendingAmount)}
              </div>
            </div>
          </div>

          {/* Totals Breakdown Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="rounded-xl border border-[#D8D5CE] bg-white p-3.5 shadow-xs">
              <span className="text-[#7A7F85] font-bold block uppercase text-[10px] tracking-wider">Subtotal Freight</span>
              <span className="font-mono-nums font-bold text-sm text-[#1A1D20] mt-1 block">
                {formatCurrency(detail.subtotalFreight)}
              </span>
            </div>

            <div className="rounded-xl border border-[#D8D5CE] bg-white p-3.5 shadow-xs">
              <span className="text-[#D32F2F] font-bold block uppercase text-[10px] tracking-wider">Shortage Debit Note</span>
              <span className="font-mono-nums font-bold text-sm text-[#D32F2F] mt-1 block">
                - {formatCurrency(detail.debitNoteAmount)}
              </span>
            </div>

            <div className="rounded-xl border border-[#D8D5CE] bg-white p-3.5 shadow-xs">
              <span className="text-[#0288D1] font-bold block uppercase text-[10px] tracking-wider">
                TDS ({detail.appliedTdsPercentage ?? 0}%)
              </span>
              <span className="font-mono-nums font-bold text-sm text-[#0288D1] mt-1 block">
                - {formatCurrency(detail.tdsAmount)}
              </span>
            </div>

            <div className="rounded-xl border border-[#A5D6A7] bg-[#E8F5E9] p-3.5 shadow-xs">
              <span className="text-[#2E7D32] font-bold block uppercase text-[10px] tracking-wider">Net Bill Amount</span>
              <span className="font-mono-nums font-black text-sm text-[#2E7D32] mt-1 block">
                {formatCurrency(detail.netBillAmount)}
              </span>
            </div>
          </div>

          {/* Bill Items Table */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#5F6368] mb-2">
              Billed Trips ({detail.items?.length || 0})
            </h4>
            <div className="border border-[#D8D5CE] rounded-xl overflow-hidden max-h-[260px] overflow-y-auto bg-white shadow-xs">
              <table className="w-full text-left text-[11.5px] border-collapse">
                <thead className="bg-[#FAF8F5] border-b border-[#D8D5CE] font-semibold uppercase text-[#5F6368] sticky top-0">
                  <tr>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Truck</th>
                    <th className="p-2.5">Route</th>
                    <th className="p-2.5 text-right">R-Wt</th>
                    <th className="p-2.5 text-right">Freight</th>
                    <th className="p-2.5 text-right">Shortage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFECE6]">
                  {detail.items?.map((item: any) => (
                    <tr key={item.id} className="hover:bg-[#FAF8F5] transition-colors">
                      <td className="p-2.5 whitespace-nowrap">{formatDate(item.entryDate)}</td>
                      <td className="p-2.5 font-bold font-mono-nums">{item.truckNumber}</td>
                      <td className="p-2.5 text-[#5F6368]">
                        {item.fromLocation || "-"} → {item.toLocation || "-"}
                      </td>
                      <td className="p-2.5 text-right font-mono-nums">{Number(item.rWeight || 0).toFixed(3)}</td>
                      <td className="p-2.5 text-right font-mono-nums font-bold">{formatCurrency(item.freight)}</td>
                      <td className="p-2.5 text-right font-mono-nums text-[#D32F2F]">
                        {Number(item.shortageDebitAmount) > 0 ? `- ${formatCurrency(item.shortageDebitAmount)}` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[#D8D5CE]">
            <div className="flex items-center gap-2">
              <a
                href={`/api/bills/${detail.id}/pdf${firmIdParam}${firmIdParam ? "&" : "?"}download=true`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
              >
                Download PDF
              </a>
              <a
                href={`/api/bills/${detail.id}/pdf${firmIdParam}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-coral btn-sm"
              >
                Print Bill
              </a>
            </div>
            <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
              Close
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
