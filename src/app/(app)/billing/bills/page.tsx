"use client";

import React, { useState, useMemo, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Search,
  Eye,
  FileText,
  CheckCircle2,
  X,
  Scale,
  DollarSign,
  Printer,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button, Badge, EmptyState } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useMasterList } from "@/lib/use-master-list";
import { useApiClient, ApiError } from "@/lib/api-client";
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
      <div className="p-8 text-center text-gray-400 text-sm">
        Loading bill details…
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-lg text-xs">
        {error || "Bill details not found"}
      </div>
    );
  }

  return (
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
          <Badge variant={Number(detail.pendingAmount) === 0 ? "success" : "neutral"}>
            {detail.status}
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
                <th className="p-2">LR No</th>
                <th className="p-2">Route</th>
                <th className="p-2 text-right">N-Wt</th>
                <th className="p-2 text-right">R-Wt</th>
                <th className="p-2 text-right">Rate</th>
                <th className="p-2 text-right">Freight</th>
                <th className="p-2 text-right">Shortage Debit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-mono">
              {(detail.items || []).map((item) => (
                <tr key={item.id}>
                  <td className="p-2 whitespace-nowrap">{formatDate(item.tripDate)}</td>
                  <td className="p-2 font-semibold">{item.truckNumberRaw || "—"}</td>
                  <td className="p-2">{item.lrNumber || "—"}</td>
                  <td className="p-2 font-sans">{item.fromLocationRaw} → {item.toLocationRaw}</td>
                  <td className="p-2 text-right">{formatTons(item.nWeight)}</td>
                  <td className="p-2 text-right">{formatTons(item.rWeight)}</td>
                  <td className="p-2 text-right">₹{item.appliedRate}</td>
                  <td className="p-2 text-right font-semibold">{formatCurrency(item.freight)}</td>
                  <td className="p-2 text-right text-red-600">
                    {Number(item.shortageDebitAmount) > 0 ? formatCurrency(item.shortageDebitAmount) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Accounting Postings Summary */}
      <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl text-xs space-y-1">
        <span className="font-semibold text-gray-700 dark:text-gray-300 block">
          Ledger & Audit Integration
        </span>
        <p className="text-gray-500">
          Transportation Charges Credited: <code>{formatCurrency(detail.subtotalFreight)}</code> | Debit Note: <code>{formatCurrency(detail.debitNoteAmount)}</code> | TDS: <code>{formatCurrency(detail.tdsAmount)}</code>
        </p>
      </div>

      <div className="flex justify-end pt-2">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}

// ─── Inner Bills Content Component ────────────────────────────
function BillsPageContent() {
  const searchParams = useSearchParams();
  const justCreated = searchParams.get("created") === "true";

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
        <span className="font-mono text-sm font-black text-gray-900 dark:text-gray-100">
          #{b.billNumber}
        </span>
      ),
    },
    {
      key: "billDate",
      label: "Date",
      render: (b) => <span className="text-xs whitespace-nowrap">{formatDate(b.billDate)}</span>,
    },
    {
      key: "partyName",
      label: "Party (Customer)",
      render: (b) => (
        <span className="font-semibold text-xs text-primary-600 dark:text-primary-400">
          {b.partyName || "—"}
        </span>
      ),
    },
    {
      key: "subtotalFreight",
      label: "Subtotal Freight",
      align: "right",
      render: (b) => (
        <span className="font-mono text-xs">{formatCurrency(b.subtotalFreight)}</span>
      ),
    },
    {
      key: "debitNoteAmount",
      label: "Shortage Debit",
      align: "right",
      render: (b) =>
        Number(b.debitNoteAmount) > 0 ? (
          <span className="font-mono text-xs text-red-600 dark:text-red-400">
            - {formatCurrency(b.debitNoteAmount)}
          </span>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        ),
    },
    {
      key: "tdsAmount",
      label: "TDS",
      align: "right",
      render: (b) =>
        Number(b.tdsAmount) > 0 ? (
          <span className="font-mono text-xs text-purple-600 dark:text-purple-400">
            - {formatCurrency(b.tdsAmount)}
          </span>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        ),
    },
    {
      key: "netBillAmount",
      label: "Net Bill Amount",
      align: "right",
      render: (b) => (
        <span className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-400">
          {formatCurrency(b.netBillAmount)}
        </span>
      ),
    },
    {
      key: "pendingAmount",
      label: "Pending",
      align: "right",
      render: (b) => (
        <span className="font-mono text-xs font-medium text-gray-700 dark:text-gray-300">
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
      label: "",
      render: (b) => (
        <div className="flex items-center gap-1">
          <button
            className="btn btn-ghost btn-xs text-primary-600 hover:text-primary-800"
            onClick={(e) => {
              e.stopPropagation();
              setViewBillId(b.id);
            }}
            title="View Bill Details"
            id={`bill-view-${b.id}`}
          >
            <Eye size={14} />
          </button>
          <a
            href={`/api/bills/${b.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="btn btn-ghost btn-xs text-indigo-600 hover:text-indigo-800"
            title="Generate & Print PDF"
            id={`bill-pdf-${b.id}`}
          >
            <Printer size={14} />
          </a>
        </div>
      ),
    },
  ];

  return (
    <div className="animate-fade-in space-y-4">
      <PageHeader
        title="Bills"
        subtitle="Customer invoices with automatic per-trip shortage debits & TDS accounting"
        breadcrumbs={[{ label: "Billing" }, { label: "Bills" }]}
        actions={
          <Link href="/billing/new">
            <Button variant="primary" size="sm" icon={Plus} id="bills-create-new">
              Create Bill
            </Button>
          </Link>
        }
      />

      {/* Success Feedback Banner */}
      {feedback && (
        <div className="card border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              {feedback}
            </p>
          </div>
          <button onClick={() => setFeedback(null)} className="text-emerald-600 text-xs">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="card border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-3">
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="card p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              Total Invoices
            </span>
            <span className="text-2xl font-black text-gray-900 dark:text-gray-100 font-mono">
              {stats.count}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-950/50 flex items-center justify-center text-primary-600">
            <FileText size={18} />
          </div>
        </div>

        <div className="card p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
              Total Billed Net Amount
            </span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {formatCurrency(stats.totalNet)}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600">
            <DollarSign size={18} />
          </div>
        </div>

        <div className="card p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
              Total Outstanding Pending
            </span>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
              {formatCurrency(stats.totalPending)}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600">
            <Scale size={18} />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card p-3.5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
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
            <Button variant="ghost" size="sm" onClick={clearFilters} icon={X}>
              Clear Filters
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-800">
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
            icon={FileText}
            title={hasActiveFilters ? "No bills match your filters" : "No bills generated yet"}
            description={
              hasActiveFilters
                ? "Try adjusting or clearing your search and date filter criteria."
                : "Select received trips and generate your first customer bill invoice."
            }
            action={
              !hasActiveFilters ? (
                <Link href="/billing/new">
                  <Button variant="primary" size="sm" icon={Plus}>
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
    <Suspense fallback={<div className="p-8 text-center text-gray-400 text-sm">Loading bills…</div>}>
      <BillsPageContent />
    </Suspense>
  );
}
