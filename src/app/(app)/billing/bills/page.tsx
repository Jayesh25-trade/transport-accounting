"use client";

import React, { useState, useMemo, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Search,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button, Badge, EmptyState } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useMasterList } from "@/lib/use-master-list";
import { useApiClient, ApiError } from "@/lib/api-client";
import { useFirm } from "@/lib/firm-context";
import { Modal } from "@/components/ui/modal";
import { formatCurrency, formatDate } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────
interface BillRecord {
  id: string;
  firmId: string;
  partyId: string;
  partyName?: string | null;
  billNumber: number;
  billDate: string;
  totalNWeight: string | number;
  totalRWeight: string | number;
  subtotalFreight: string | number;
  tdsAmount: string | number;
  debitNoteAmount: string | number;
  netBillAmount: string | number;
  receivedAmount: string | number;
  pendingAmount: string | number;
  appliedTdsSection: string | null;
  appliedTdsPercentage: string | number | null;
  appliedFreightBasis: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BillItemRecord {
  id: string;
  billId: string;
  tripId: string;
  tripDate: string;
  truckNumberRaw: string | null;
  lrNumber: string | null;
  fromLocationRaw: string | null;
  toLocationRaw: string | null;
  nWeight: string | number;
  rWeight: string | number;
  appliedRate: string | number;
  appliedFreightBasis: string;
  billedWeight: string | number;
  freight: string | number;
  shortageQtyRaw: string | number;
  shortageAllowanceValue: string | number;
  shortageAllowanceType: string | null;
  shortageRuleType: string | null;
  shortageQtyApplicable: string | number;
  shortageMaterialRate: string | number;
  shortageDebitAmount: string | number;
}

interface TdsEntryRecord {
  id: string;
  tdsSection: string;
  tdsPercentage: string | number;
  tdsBaseAmount: string | number;
  tdsAmount: string | number;
}

interface DebitNoteRecord {
  id: string;
  voucherNumber: string;
  totalShortageQtyApplicable: string | number;
  materialRateApplied: string | number;
  debitAmount: string | number;
}

interface DetailedBillRecord extends BillRecord {
  items: BillItemRecord[];
  tdsEntries: TdsEntryRecord[];
  debitNotes: DebitNoteRecord[];
}

interface MasterParty {
  id: string;
  name: string;
}

function formatTons(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "—";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "—";
  return `${num.toFixed(3)} T`;
}

// ─── Detailed View Modal ──────────────────────────────────────
function BillDetailModal({
  billId,
  onClose,
}: {
  billId: string;
  onClose: () => void;
}) {
  const api = useApiClient();
  const [detail, setDetail] = useState<DetailedBillRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<DetailedBillRecord>(`/api/bills/${billId}`);
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

  if (loading) {
    return (
      <div className="p-8 text-center text-[#7A7F85] text-sm">
        Loading bill details…
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="p-4 bg-[#FDEDED] text-[#D32F2F] rounded-lg text-xs">
        {error || "Bill details not found"}
      </div>
    );
  }

  return (
    <div className="space-y-4 text-[#1A1D20]">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between p-4 rounded-xl bg-[#FAF8F5] border border-[#D8D5CE] shadow-xs">
        <div>
          <span className="text-xs text-[#7A7F85] font-bold uppercase tracking-wider block">
            Bill Invoice #{detail.billNumber}
          </span>
          <h3 className="text-base font-bold text-[#1A1D20] mt-0.5">
            {detail.partyName || "Customer Invoice"}
          </h3>
          <span className="text-xs text-[#5F6368]">Date: {formatDate(detail.billDate)}</span>
        </div>
        <div className="text-right">
          <Badge variant={Number(detail.pendingAmount) === 0 ? "success" : "neutral"}>
            {detail.status}
          </Badge>
          <div className="text-xs font-mono-nums text-[#5F6368] mt-1 font-semibold">
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
                <th className="p-2.5">LR No</th>
                <th className="p-2.5">Route</th>
                <th className="p-2.5 text-right">N-Wt</th>
                <th className="p-2.5 text-right">R-Wt</th>
                <th className="p-2.5 text-right">Rate</th>
                <th className="p-2.5 text-right">Freight</th>
                <th className="p-2.5 text-right">Shortage Debit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFECE6] font-mono-nums">
              {(detail.items || []).map((item) => (
                <tr key={item.id} className="hover:bg-[#FAF8F5] transition-colors">
                  <td className="p-2.5 whitespace-nowrap">{formatDate(item.tripDate)}</td>
                  <td className="p-2.5 font-bold">{item.truckNumberRaw || "—"}</td>
                  <td className="p-2.5">{item.lrNumber || "—"}</td>
                  <td className="p-2.5 font-sans">{item.fromLocationRaw} → {item.toLocationRaw}</td>
                  <td className="p-2.5 text-right">{formatTons(item.nWeight)}</td>
                  <td className="p-2.5 text-right">{formatTons(item.rWeight)}</td>
                  <td className="p-2.5 text-right">₹{item.appliedRate}</td>
                  <td className="p-2.5 text-right font-bold">{formatCurrency(item.freight)}</td>
                  <td className="p-2.5 text-right text-[#D32F2F]">
                    {Number(item.shortageDebitAmount) > 0 ? formatCurrency(item.shortageDebitAmount) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end pt-3 border-t border-[#D8D5CE]">
        <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
          Close
        </button>
      </div>
    </div>
  );
}

// ─── Inner Bills Content Component ────────────────────────────
function BillsPageContent() {
  const searchParams = useSearchParams();
  const justCreated = searchParams.get("created") === "true";
  const { currentFirm } = useFirm();
  const firmIdParam = currentFirm?.id ? `?firmId=${encodeURIComponent(currentFirm.id)}` : "";

  const { data: billsList, loading, error } = useMasterList<BillRecord>({
    endpoint: "/api/bills",
  });
  const { data: parties } = useMasterList<MasterParty>({ endpoint: "/api/parties" });

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [partyFilter, setPartyFilter] = useState("ALL");
  const [viewBillId, setViewBillId] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<string | null>(
    justCreated ? "Bill created successfully!" : null
  );

  useEffect(() => {
    if (justCreated) {
      setTimeout(() => setFeedback(null), 5000);
    }
  }, [justCreated]);

  // Overall statistics
  const stats = useMemo(() => {
    let totalNet = 0;
    let totalPending = 0;
    billsList.forEach((b) => {
      totalNet += Number(b.netBillAmount) || 0;
      totalPending += Number(b.pendingAmount) || 0;
    });
    return { count: billsList.length, totalNet, totalPending };
  }, [billsList]);

  // Client-side filtering
  const filtered = useMemo(() => {
    return billsList.filter((b) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const billNumMatch = String(b.billNumber).includes(q);
        const partyMatch = (b.partyName || "").toLowerCase().includes(q);
        if (!billNumMatch && !partyMatch) return false;
      }

      if (dateFrom && b.billDate < dateFrom) return false;
      if (dateTo && b.billDate > dateTo) return false;

      if (partyFilter !== "ALL" && b.partyId !== partyFilter) return false;

      return true;
    });
  }, [billsList, search, dateFrom, dateTo, partyFilter]);

  const hasActiveFilters = Boolean(search) || Boolean(dateFrom) || Boolean(dateTo) || partyFilter !== "ALL";

  function clearFilters() {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setPartyFilter("ALL");
  }

  const columns: Column<BillRecord>[] = [
    {
      key: "billNumber",
      label: "Bill No",
      render: (b) => (
        <span className="font-mono-nums text-sm font-bold text-[#1A1D20]">
          #{b.billNumber}
        </span>
      ),
    },
    {
      key: "billDate",
      label: "Date",
      render: (b) => <span className="text-xs whitespace-nowrap text-[#5F6368]">{formatDate(b.billDate)}</span>,
    },
    {
      key: "partyName",
      label: "Party (Customer)",
      render: (b) => (
        <span className="font-bold text-xs text-[#E05638]">
          {b.partyName || "—"}
        </span>
      ),
    },
    {
      key: "subtotalFreight",
      label: "Subtotal Freight",
      align: "right",
      render: (b) => (
        <span className="font-mono-nums text-xs font-semibold">{formatCurrency(b.subtotalFreight)}</span>
      ),
    },
    {
      key: "debitNoteAmount",
      label: "Shortage Debit",
      align: "right",
      render: (b) =>
        Number(b.debitNoteAmount) > 0 ? (
          <span className="font-mono-nums text-xs text-[#D32F2F] font-semibold">
            - {formatCurrency(b.debitNoteAmount)}
          </span>
        ) : (
          <span className="text-[#7A7F85] text-xs">—</span>
        ),
    },
    {
      key: "tdsAmount",
      label: "TDS",
      align: "right",
      render: (b) =>
        Number(b.tdsAmount) > 0 ? (
          <span className="font-mono-nums text-xs text-[#0288D1] font-semibold">
            - {formatCurrency(b.tdsAmount)}
          </span>
        ) : (
          <span className="text-[#7A7F85] text-xs">—</span>
        ),
    },
    {
      key: "netBillAmount",
      label: "Net Bill Amount",
      align: "right",
      render: (b) => (
        <span className="font-mono-nums text-xs font-bold text-[#2E7D32]">
          {formatCurrency(b.netBillAmount)}
        </span>
      ),
    },
    {
      key: "pendingAmount",
      label: "Pending",
      align: "right",
      render: (b) => (
        <span className="font-mono-nums text-xs font-semibold text-[#1A1D20]">
          {formatCurrency(b.pendingAmount)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (b) => (
        <Badge variant={Number(b.pendingAmount) === 0 ? "success" : "neutral"}>
          {b.status}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      align: "right",
      render: (b) => {
        const downloadUrl = `/api/bills/${b.id}/pdf${firmIdParam ? firmIdParam + '&download=true' : '?download=true'}`;
        const printUrl = `/api/bills/${b.id}/pdf${firmIdParam}`;

        return (
          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
            <button
              type="button"
              className="rounded-lg border border-[#D8D5CE] bg-white px-2.5 py-1 text-xs font-semibold text-[#1A1D20] hover:bg-[#FAF8F5] transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setViewBillId(b.id);
              }}
              title="View Bill Details"
              id={`bill-view-${b.id}`}
            >
              View
            </button>

            <a
              href={downloadUrl}
              download
              onClick={(e) => e.stopPropagation()}
              className="rounded-lg border border-[#A5D6A7] bg-[#E8F5E9] px-2.5 py-1 text-xs font-semibold text-[#2E7D32] hover:bg-[#C8E6C9] transition-colors"
              title="Download Bill PDF Invoice"
              id={`bill-download-${b.id}`}
            >
              Download PDF
            </a>

            <a
              href={printUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded-lg border border-[#D8D5CE] bg-white px-2.5 py-1 text-xs font-semibold text-[#1A1D20] hover:bg-[#FAF8F5] transition-colors"
              title="Print Bill Invoice"
              id={`bill-pdf-${b.id}`}
            >
              Print
            </a>
          </div>
        );
      },
    },
  ];

  return (
    <div className="animate-fade-in space-y-4 text-[#1A1D20]">
      <PageHeader
        title="Bills"
        subtitle="Customer invoices with automatic per-trip shortage debits & TDS accounting"
        breadcrumbs={[{ label: "Billing" }, { label: "Bills" }]}
        actions={
          <Link href="/billing/new">
            <Button variant="coral" size="sm" id="bills-create-new">
              Create Bill
            </Button>
          </Link>
        }
      />

      {/* Success Feedback Banner */}
      {feedback && (
        <div className="rounded-xl border border-[#A5D6A7] bg-[#E8F5E9] p-3.5 flex items-center justify-between text-xs text-[#2E7D32]">
          <p className="font-semibold">{feedback}</p>
          <button onClick={() => setFeedback(null)} className="text-[#2E7D32] font-bold">
            Close
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="rounded-xl border border-[#D32F2F]/30 bg-[#FDEDED] p-3.5 text-xs text-[#D32F2F]">
          <p>{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-[#D8D5CE] bg-white p-4 shadow-xs">
          <span className="text-[11px] font-bold text-[#7A7F85] uppercase tracking-wider block">
            Total Invoices
          </span>
          <span className="text-2xl font-bold text-[#1A1D20] font-mono-nums mt-1 block">
            {stats.count}
          </span>
        </div>

        <div className="rounded-2xl border border-[#D8D5CE] bg-white p-4 shadow-xs">
          <span className="text-[11px] font-bold text-[#2E7D32] uppercase tracking-wider block">
            Total Billed Net Amount
          </span>
          <span className="text-2xl font-bold text-[#2E7D32] font-mono-nums mt-1 block">
            {formatCurrency(stats.totalNet)}
          </span>
        </div>

        <div className="rounded-2xl border border-[#D8D5CE] bg-white p-4 shadow-xs">
          <span className="text-[11px] font-bold text-[#ED6C02] uppercase tracking-wider block">
            Total Outstanding Pending
          </span>
          <span className="text-2xl font-bold text-[#ED6C02] font-mono-nums mt-1 block">
            {formatCurrency(stats.totalPending)}
          </span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-2xl border border-[#D8D5CE] bg-white p-4 space-y-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7A7F85]" />
            <input
              type="search"
              placeholder="Search bill number, party name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input pl-8 text-xs"
              id="bills-search"
            />
          </div>

          {/* Date From */}
          <div className="w-36">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="form-input text-xs"
              title="From date"
              id="bills-filter-date-from"
            />
          </div>

          {/* Date To */}
          <div className="w-36">
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="form-input text-xs"
              title="To date"
              id="bills-filter-date-to"
            />
          </div>

          {/* Party Filter */}
          <select
            value={partyFilter}
            onChange={(e) => setPartyFilter(e.target.value)}
            className="form-input text-xs w-44"
            id="bills-filter-party"
          >
            <option value="ALL">All Parties</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear Filters
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-[#7A7F85] pt-2 border-t border-[#EFECE6]">
          <span>
            {loading ? "Loading invoices…" : `Showing ${filtered.length} of ${billsList.length} bills`}
          </span>
        </div>
      </div>

      {/* Main Data Table */}
      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        emptyState={
          <EmptyState
            title={hasActiveFilters ? "No bills match your filters" : "No bills generated yet"}
            description={
              hasActiveFilters
                ? "Try adjusting or clearing your search and date filter criteria."
                : "Select received trips and generate your first customer bill invoice."
            }
            action={
              !hasActiveFilters ? (
                <Link href="/billing/new">
                  <Button variant="coral" size="sm">
                    Create Bill
                  </Button>
                </Link>
              ) : (
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Clear Filters
                </Button>
              )
            }
          />
        }
        onRowClick={(b) => setViewBillId(b.id)}
      />

      {/* View Bill Modal */}
      <Modal
        open={Boolean(viewBillId)}
        onClose={() => setViewBillId(null)}
        title="Bill Invoice Details"
        size="lg"
      >
        {viewBillId && (
          <BillDetailModal billId={viewBillId} onClose={() => setViewBillId(null)} />
        )}
      </Modal>
    </div>
  );
}

// ─── Main Export Wrapped in Suspense ──────────────────────────
export default function BillsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[#7A7F85] text-sm">Loading bills…</div>}>
      <BillsPageContent />
    </Suspense>
  );
}
