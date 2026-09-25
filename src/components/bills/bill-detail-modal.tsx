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
        <div className="p-8 text-center text-gray-400 text-sm">Loading bill details…</div>
      ) : error || !detail ? (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg text-xs">{error || "Bill details not found"}</div>
      ) : (
        <div className="space-y-4">
          {/* Top Banner */}
          <div className="flex flex-wrap items-center justify-between p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
            <div>
              <span className="text-xs text-gray-400 font-medium block">
                Bill Invoice #{detail.billNumber}
              </span>
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                {detail.partyName || "Customer Invoice"}
              </h3>
              <span className="text-xs text-gray-500">Date: {formatDate(detail.billDate)}</span>
            </div>
            <div className="text-right">
              <Badge variant={Number(detail.pendingAmount) === 0 ? "success" : Number(detail.receivedAmount) > 0 ? "warning" : "neutral"}>
                {Number(detail.pendingAmount) === 0 ? "PAID" : Number(detail.receivedAmount) > 0 ? "PARTIALLY_PAID" : "PENDING"}
              </Badge>
              <div className="text-xs font-mono text-gray-500 mt-1">
                Pending: {formatCurrency(detail.pendingAmount)}
              </div>
            </div>
          </div>

          {/* Totals Breakdown Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="card p-3">
              <span className="text-gray-400 font-bold block uppercase text-[10px]">Subtotal Freight</span>
              <span className="font-mono font-bold text-sm text-gray-900 dark:text-gray-100">
                {formatCurrency(detail.subtotalFreight)}
              </span>
            </div>

            <div className="card p-3">
              <span className="text-red-500 font-bold block uppercase text-[10px]">Shortage Debit Note</span>
              <span className="font-mono font-bold text-sm text-red-600 dark:text-red-400">
                - {formatCurrency(detail.debitNoteAmount)}
              </span>
            </div>

            <div className="card p-3">
              <span className="text-purple-500 font-bold block uppercase text-[10px]">
                TDS ({detail.appliedTdsPercentage ?? 0}%)
              </span>
              <span className="font-mono font-bold text-sm text-purple-600 dark:text-purple-400">
                - {formatCurrency(detail.tdsAmount)}
              </span>
            </div>

            <div className="card p-3 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800">
              <span className="text-emerald-600 font-bold block uppercase text-[10px]">Net Bill Amount</span>
              <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                {formatCurrency(detail.netBillAmount)}
              </span>
            </div>
          </div>

          {/* Bill Items Table */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              Billed Trips ({detail.items?.length || 0})
            </h4>
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden max-h-[260px] overflow-y-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-gray-50 dark:bg-gray-800/80 font-semibold uppercase text-gray-500 sticky top-0">
                  <tr>
                    <th className="p-2">Date</th>
                    <th className="p-2">Truck</th>
                    <th className="p-2">Route</th>
                    <th className="p-2 text-right">R-Wt</th>
                    <th className="p-2 text-right">Freight</th>
                    <th className="p-2 text-right">Shortage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {detail.items?.map((item: any) => (
                    <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                      <td className="p-2 whitespace-nowrap">{formatDate(item.entryDate)}</td>
                      <td className="p-2 font-medium">{item.truckNumber}</td>
                      <td className="p-2 text-gray-500">
                        {item.fromLocation || "-"} → {item.toLocation || "-"}
                      </td>
                      <td className="p-2 text-right font-mono">{Number(item.rWeight || 0).toFixed(3)}</td>
                      <td className="p-2 text-right font-mono font-medium">{formatCurrency(item.freight)}</td>
                      <td className="p-2 text-right font-mono text-red-500">
                        {Number(item.shortageDebitAmount) > 0 ? `- ${formatCurrency(item.shortageDebitAmount)}` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
            <a
              href={`/api/bills/${detail.id}/pdf${firmIdParam}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-sm inline-flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Generate & Print PDF
            </a>
            <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
              Close
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
