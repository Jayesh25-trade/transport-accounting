"use client";

import React, { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useApiClient, ApiError } from "@/lib/api-client";
import { useFirm } from "@/lib/firm-context";
import { BillDocumentView } from "./bill-document-view";

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

  const titleText = detail
    ? `Bill #${detail.billNumber} · ${detail.partyName || "Customer Invoice"}`
    : "Bill Invoice Preview";

  const downloadUrl = detail
    ? `/api/bills/${detail.id}/pdf${firmIdParam}${firmIdParam ? "&" : "?"}download=true`
    : "#";
  const printUrl = detail ? `/api/bills/${detail.id}/pdf${firmIdParam}` : "#";

  return (
    <Modal open={Boolean(billId)} onClose={onClose} title={titleText} size="xl">
      {loading ? (
        <div className="p-12 text-center text-[#6B7280] text-sm">Loading bill invoice preview…</div>
      ) : error || !detail ? (
        <div className="p-4 bg-[#FDEDED] text-[#D32F2F] rounded-lg text-xs">
          {error || "Bill details not found"}
        </div>
      ) : (
        <div className="flex flex-col max-h-[85vh]">
          {/* Action Bar Header */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-[#E5E7EB] bg-white sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <a
                href={downloadUrl}
                download
                className="btn btn-secondary btn-sm"
                title="Download Bill PDF Invoice"
                id={`modal-bill-download-${detail.id}`}
              >
                Download PDF
              </a>
              <a
                href={printUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-coral btn-sm"
                title="Print Bill Invoice"
                id={`modal-bill-print-${detail.id}`}
              >
                Print
              </a>
            </div>
          </div>

          {/* Light Grey Surround containing A4 sheet preview */}
          <div className="bg-[#F3F4F6] p-4 sm:p-6 overflow-y-auto max-h-[78vh]">
            <BillDocumentView bill={detail} />
          </div>
        </div>
      )}
    </Modal>
  );
}
