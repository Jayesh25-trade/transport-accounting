"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Calculator,
  Search,
  CheckCircle2,
  Clock,
  ArrowLeft,
  AlertCircle,
  Scale,
  DollarSign,
  Check,
  X,
  Building2,
  Users,
  Truck as TruckIcon,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button, Badge, EmptyState } from "@/components/ui/primitives";
import { useMasterList } from "@/lib/use-master-list";
import { useApiClient, ApiError } from "@/lib/api-client";
import { useFirm } from "@/lib/firm-context";
import { Modal, Field, FormGrid } from "@/components/ui/modal";
import { formatCurrency, formatDate } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────
interface TripRecord {
  id: string;
  firmId: string;
  dailyEntryId: string;
  partyId: string | null;
  isReceived: boolean;
  isBilled: boolean;
  billId: string | null;
  srNo: number;
  entryDate: string;
  truckId: string | null;
  truckNumberRaw: string | null;
  lrNumber: string | null;
  fromLocationId: string | null;
  fromLocationRaw: string | null;
  toLocationId: string | null;
  toLocationRaw: string | null;
  nWeight: string | number | null;
  rWeight: string | number | null;
  rate: string | number | null;
  customerRate: string | number | null;
  companyId: string | null;
  companyNameRaw: string | null;
  partyNameRaw: string | null;
  remarks: string | null;

  // Joined names
  partyName?: string | null;
  companyName?: string | null;
  truckNumber?: string | null;
  fromLocationName?: string | null;
  toLocationName?: string | null;
}

interface MasterParty {
  id: string;
  name: string;
}

interface MasterCompany {
  id: string;
  name: string;
}

interface MasterTruck {
  id: string;
  truckNumber: string;
}

interface CustomerRule {
  partyId: string;
  freightBasis: string;
  shortageApplicable: boolean;
  shortageAllowanceType: string | null;
  shortageAllowanceValue: string | null;
  shortageRuleType: string | null;
  materialRatePerTon: string | null;
  tdsApplicable: boolean;
  tdsSection: string | null;
  tdsPercentage: string | null;
}

interface PreviewItem {
  tripId: string;
  srNo: number;
  tripDate: string;
  truckNumberRaw: string | null;
  lrNumber: string | null;
  fromLocationRaw: string | null;
  toLocationRaw: string | null;
  nWeight: number;
  rWeight: number;
  appliedRate: number;
  appliedFreightBasis: string;
  billedWeight: number;
  freight: number;
  shortageQtyRaw: number;
  shortageAllowanceValue: number;
  shortageAllowanceType: string | null;
  shortageRuleType: string | null;
  shortageQtyApplicable: number;
  shortageMaterialRate: number;
  shortageDebitAmount: number;
}

interface BillPreviewResult {
  items: PreviewItem[];
  subtotalFreight: number;
  totalShortageDebit: number;
  tdsSection: string;
  tdsPercentage: number;
  tdsAmount: number;
  netBillAmount: number;
  totalNWeight: number;
  totalRWeight: number;
}

function formatTons(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "—";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "—";
  return `${num.toFixed(3)} T`;
}

export default function NewBillPage() {
  const router = useRouter();
  const api = useApiClient();
  const { currentFirm, loading: firmLoading } = useFirm();

  // Load trips and masters
  const { data: allTrips, loading: tripsLoading, refresh: refreshTrips } = useMasterList<TripRecord>({
    endpoint: "/api/trips",
  });
  const { data: parties } = useMasterList<MasterParty>({ endpoint: "/api/parties" });
  const { data: companies } = useMasterList<MasterCompany>({ endpoint: "/api/companies" });
  const { data: trucks } = useMasterList<MasterTruck>({ endpoint: "/api/trucks" });

  // Form / Selection State
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [billDate, setBillDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [selectedTripIds, setSelectedTripIds] = useState<Set<string>>(new Set());

  // Filters
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [partyFilter, setPartyFilter] = useState("ALL");
  const [companyFilter, setCompanyFilter] = useState("ALL");
  const [truckFilter, setTruckFilter] = useState("ALL");

  // TDS Override State
  const [tdsSection, setTdsSection] = useState("94C");
  const [tdsPercentage, setTdsPercentage] = useState<string>("1.0");

  // Preview Modal / Creation State
  const [calculating, setCalculating] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<BillPreviewResult | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Filter unbilled trips only for billing selection
  const unbilledTrips = useMemo(() => {
    return allTrips.filter((t) => !t.isBilled);
  }, [allTrips]);

  // Apply filters to unbilled trips
  const filteredTrips = useMemo(() => {
    return unbilledTrips.filter((t) => {
      // 1. Search Query
      if (search.trim()) {
        const q = search.toLowerCase();
        const truckMatch = (t.truckNumber || t.truckNumberRaw || "").toLowerCase().includes(q);
        const partyMatch = (t.partyName || t.partyNameRaw || "").toLowerCase().includes(q);
        const companyMatch = (t.companyName || t.companyNameRaw || "").toLowerCase().includes(q);
        const lrMatch = (t.lrNumber || "").toLowerCase().includes(q);
        const fromMatch = (t.fromLocationName || t.fromLocationRaw || "").toLowerCase().includes(q);
        const toMatch = (t.toLocationName || t.toLocationRaw || "").toLowerCase().includes(q);
        const srMatch = String(t.srNo).includes(q);
        if (!truckMatch && !partyMatch && !companyMatch && !lrMatch && !fromMatch && !toMatch && !srMatch) {
          return false;
        }
      }

      // 2. Date Range
      if (dateFrom && t.entryDate < dateFrom) return false;
      if (dateTo && t.entryDate > dateTo) return false;

      // 3. Party Filter
      if (partyFilter !== "ALL" && t.partyId !== partyFilter) return false;

      // 4. Company Filter
      if (companyFilter !== "ALL" && t.companyId !== companyFilter) return false;

      // 5. Truck Filter
      if (truckFilter !== "ALL" && t.truckId !== truckFilter) return false;

      return true;
    });
  }, [unbilledTrips, search, dateFrom, dateTo, partyFilter, companyFilter, truckFilter]);

  // Count selectable (RECEIVED) vs unselectable (PENDING) in filtered list
  const { eligibleCount, pendingCount } = useMemo(() => {
    let eligible = 0;
    let pending = 0;
    filteredTrips.forEach((t) => {
      if (t.isReceived) eligible++;
      else pending++;
    });
    return { eligibleCount: eligible, pendingCount: pending };
  }, [filteredTrips]);

  // Auto-detect billing party if all selected trips belong to single party
  useEffect(() => {
    if (selectedTripIds.size > 0) {
      const selectedTrips = unbilledTrips.filter((t) => selectedTripIds.has(t.id));
      const partyIds = new Set(selectedTrips.map((t) => t.partyId).filter(Boolean));
      if (partyIds.size === 1) {
        const singleParty = Array.from(partyIds)[0] as string;
        if (!selectedPartyId) {
          setSelectedPartyId(singleParty);
        }
      }
    }
  }, [selectedTripIds, unbilledTrips]);

  // Handle selection toggles
  function toggleTripSelection(tripId: string, isReceived: boolean) {
    if (!isReceived) return; // Prevent selecting PENDING trips
    setSelectedTripIds((prev) => {
      const next = new Set(prev);
      if (next.has(tripId)) next.delete(tripId);
      else next.add(tripId);
      return next;
    });
  }

  function handleSelectAllEligible() {
    const next = new Set(selectedTripIds);
    filteredTrips.forEach((t) => {
      if (t.isReceived) next.add(t.id);
    });
    setSelectedTripIds(next);
  }

  function handleClearSelection() {
    setSelectedTripIds(new Set());
  }

  // Execute backend calculation preview
  async function handleCalculatePreview() {
    if (selectedTripIds.size === 0) {
      setPreviewError("Please select at least one received trip for billing.");
      return;
    }
    if (!selectedPartyId) {
      setPreviewError("Please select the Billing Party (Main Customer).");
      return;
    }

    setCalculating(true);
    setPreviewError(null);
    try {
      const payload = {
        partyId: selectedPartyId,
        tripIds: Array.from(selectedTripIds),
        appliedTdsSection: tdsSection,
        appliedTdsPercentage: Number(tdsPercentage) || 0,
      };

      const result = await api.post<BillPreviewResult>("/api/bills/preview", payload);
      setPreviewData(result);
      setShowPreviewModal(true);
    } catch (err: any) {
      setPreviewError(err instanceof ApiError ? err.message : "Failed to calculate bill preview.");
    } finally {
      setCalculating(false);
    }
  }

  // Create Bill in Backend
  async function handleConfirmCreateBill() {
    if (!previewData || selectedTripIds.size === 0 || !selectedPartyId) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        partyId: selectedPartyId,
        billDate,
        tripIds: Array.from(selectedTripIds),
        appliedTdsSection: tdsSection,
        appliedTdsPercentage: Number(tdsPercentage) || 0,
      };

      await api.post("/api/bills", payload);
      setShowPreviewModal(false);
      router.push("/billing/bills?created=true");
    } catch (err: any) {
      setSubmitError(err instanceof ApiError ? err.message : "Failed to create bill.");
    } finally {
      setSubmitting(false);
    }
  }

  // Selected totals for bottom status bar
  const selectedSummary = useMemo(() => {
    const selectedTrips = unbilledTrips.filter((t) => selectedTripIds.has(t.id));
    let nWt = 0;
    let rWt = 0;
    selectedTrips.forEach((t) => {
      nWt += Number(t.nWeight) || 0;
      rWt += Number(t.rWeight) || 0;
    });
    return { count: selectedTrips.length, nWt, rWt };
  }, [selectedTripIds, unbilledTrips]);

  return (
    <div className="animate-fade-in space-y-4 pb-20">
      <PageHeader
        title="Create Bill"
        subtitle="Generate a new customer invoice from received trips"
        breadcrumbs={[
          { label: "Billing", href: "/billing/bills" },
          { label: "Create Bill" },
        ]}
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={ArrowLeft}
            onClick={() => router.push("/billing/bills")}
          >
            Back to Bills
          </Button>
        }
      />

      {/* Top Configuration Card */}
      <div className="card p-4 border-primary-200 dark:border-primary-900/40 bg-primary-50/20 dark:bg-primary-950/10 space-y-3">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-primary-600 dark:text-primary-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
            Bill Invoice Setup
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Billing Party (Main Customer)" required hint="The party responsible for paying this invoice">
            <select
              value={selectedPartyId}
              onChange={(e) => setSelectedPartyId(e.target.value)}
              className="form-input font-medium"
              id="bill-setup-party"
            >
              <option value="">-- Select Billing Party --</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Bill Date" required>
            <input
              type="date"
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
              className="form-input"
              id="bill-setup-date"
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="TDS Section" hint="e.g. 94C">
              <input
                type="text"
                value={tdsSection}
                onChange={(e) => setTdsSection(e.target.value)}
                placeholder="94C"
                className="form-input uppercase font-mono"
                id="bill-setup-tds-section"
              />
            </Field>

            <Field label="TDS %" hint="e.g. 1.0">
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={tdsPercentage}
                  onChange={(e) => setTdsPercentage(e.target.value)}
                  placeholder="1.0"
                  className="form-input font-mono pr-8"
                  id="bill-setup-tds-pct"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                  %
                </span>
              </div>
            </Field>
          </div>
        </div>

        {/* Informational Customer-wise shortage note */}
        <div className="flex items-center gap-2 text-xs text-primary-700 dark:text-primary-300 pt-1 border-t border-primary-100 dark:border-primary-900/30">
          <ShieldCheck size={14} className="flex-shrink-0 text-primary-600" />
          <span>
            <strong>Multi-Customer Support:</strong> Selected trips belonging to different loading parties will have their shortage rules resolved per-customer by the backend automatically.
          </span>
        </div>
      </div>

      {/* Error banner */}
      {previewError && (
        <div className="card border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-600 dark:text-red-400" />
            <p className="text-xs text-red-600 dark:text-red-400">{previewError}</p>
          </div>
          <button onClick={() => setPreviewError(null)} className="text-red-500">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="card p-3.5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Search truck, party, company, LR, route…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input pl-8 text-xs"
              id="bill-trips-search"
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
              id="bill-trips-date-from"
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
              id="bill-trips-date-to"
            />
          </div>

          {/* Party Filter */}
          <select
            value={partyFilter}
            onChange={(e) => setPartyFilter(e.target.value)}
            className="form-input text-xs w-40"
            id="bill-trips-filter-party"
          >
            <option value="ALL">All Trip Parties</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Company Filter */}
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="form-input text-xs w-40"
            id="bill-trips-filter-company"
          >
            <option value="ALL">All Companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Truck Filter */}
          <select
            value={truckFilter}
            onChange={(e) => setTruckFilter(e.target.value)}
            className="form-input text-xs w-36"
            id="bill-trips-filter-truck"
          >
            <option value="ALL">All Trucks</option>
            {trucks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.truckNumber}
              </option>
            ))}
          </select>
        </div>

        {/* Selection Actions & Eligibility Counts */}
        <div className="flex flex-wrap items-center justify-between text-xs pt-2 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSelectAllEligible}
              disabled={eligibleCount === 0}
              id="bill-select-all"
            >
              Select All Eligible ({eligibleCount})
            </Button>
            {selectedTripIds.size > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClearSelection}>
                Clear Selection
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3 text-gray-500">
            <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={13} /> {eligibleCount} Received (Billable)
            </span>
            {pendingCount > 0 && (
              <span className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                <Clock size={13} /> {pendingCount} Pending (Unbillable)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Trips Selection Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="p-3 w-10 text-center">Select</th>
              <th className="p-3">Sr No</th>
              <th className="p-3">Date</th>
              <th className="p-3">Truck No</th>
              <th className="p-3">Route</th>
              <th className="p-3 text-right">N-Wt</th>
              <th className="p-3 text-right">R-Wt</th>
              <th className="p-3">Party</th>
              <th className="p-3">Company</th>
              <th className="p-3 text-right">Rate</th>
              <th className="p-3 text-center">POCH Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {tripsLoading ? (
              <tr>
                <td colSpan={11} className="p-8 text-center text-gray-400">
                  Loading trips…
                </td>
              </tr>
            ) : filteredTrips.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-8 text-center">
                  <EmptyState
                    icon={FileText}
                    title="No unbilled trips available"
                    description="Record trips in the Daily Book and mark them as RECEIVED to bill them."
                  />
                </td>
              </tr>
            ) : (
              filteredTrips.map((t) => {
                const isSelected = selectedTripIds.has(t.id);
                const isEligible = t.isReceived;
                const truckText = t.truckNumber || t.truckNumberRaw || "—";
                const partyText = t.partyName || t.partyNameRaw || "—";
                const companyText = t.companyName || t.companyNameRaw || "—";
                const fromText = t.fromLocationName || t.fromLocationRaw || "—";
                const toText = t.toLocationName || t.toLocationRaw || "—";

                return (
                  <tr
                    key={t.id}
                    onClick={() => toggleTripSelection(t.id, isEligible)}
                    className={`transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-primary-50/50 dark:bg-primary-950/20"
                        : !isEligible
                        ? "opacity-60 bg-gray-50/30 dark:bg-gray-900/10 cursor-not-allowed"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800/40"
                    }`}
                  >
                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!isEligible}
                        onChange={() => toggleTripSelection(t.id, isEligible)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:opacity-40"
                        id={`trip-checkbox-${t.id}`}
                      />
                    </td>
                    <td className="p-3 font-mono font-semibold text-gray-500">#{t.srNo}</td>
                    <td className="p-3 whitespace-nowrap">{formatDate(t.entryDate)}</td>
                    <td className="p-3 font-mono font-semibold text-gray-900 dark:text-gray-100">
                      {truckText}
                    </td>
                    <td className="p-3 text-gray-600 dark:text-gray-400">
                      {fromText} → {toText}
                    </td>
                    <td className="p-3 text-right font-mono">{formatTons(t.nWeight)}</td>
                    <td className="p-3 text-right font-mono">{formatTons(t.rWeight)}</td>
                    <td className="p-3 font-medium text-primary-600 dark:text-primary-400">
                      {partyText}
                    </td>
                    <td className="p-3 text-gray-600 dark:text-gray-400">{companyText}</td>
                    <td className="p-3 text-right font-mono">
                      {formatCurrency(t.customerRate || t.rate || 0)}
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant={t.isReceived ? "success" : "warning"}>
                        {t.isReceived ? "RECEIVED" : "PENDING"}
                      </Badge>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Floating Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-200 dark:border-gray-800 p-3 shadow-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-xs text-gray-400 block font-semibold uppercase">
                Selected Trips
              </span>
              <span className="text-lg font-black font-mono text-primary-600 dark:text-primary-400">
                {selectedSummary.count} {selectedSummary.count === 1 ? "Trip" : "Trips"}
              </span>
            </div>
            <div className="h-8 w-px bg-gray-200 dark:bg-gray-700" />
            <div>
              <span className="text-xs text-gray-400 block font-semibold uppercase">
                Total Weight
              </span>
              <span className="text-sm font-bold font-mono text-gray-800 dark:text-gray-200">
                N: {selectedSummary.nWt.toFixed(3)} T | R: {selectedSummary.rWt.toFixed(3)} T
              </span>
            </div>
          </div>

          <Button
            variant="primary"
            size="md"
            icon={Calculator}
            onClick={handleCalculatePreview}
            disabled={selectedTripIds.size === 0 || !selectedPartyId || calculating}
            id="bill-calculate-btn"
          >
            {calculating ? "Calculating Preview…" : "CALCULATE BILL PREVIEW"}
          </Button>
        </div>
      </div>

      {/* Bill Preview Modal */}
      <Modal
        open={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title="Bill Calculation Preview (Authoritative Backend Calculations)"
        size="lg"
      >
        {previewData && (
          <div className="space-y-4">
            {/* Financial Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
                <span className="text-[10px] font-bold text-gray-400 uppercase block">Subtotal Freight</span>
                <span className="text-sm font-black font-mono text-gray-900 dark:text-gray-100">
                  {formatCurrency(previewData.subtotalFreight)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                <span className="text-[10px] font-bold text-red-500 uppercase block">Shortage Debit Note</span>
                <span className="text-sm font-black font-mono text-red-600 dark:text-red-400">
                  - {formatCurrency(previewData.totalShortageDebit)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                <span className="text-[10px] font-bold text-purple-500 uppercase block">TDS ({previewData.tdsPercentage}%)</span>
                <span className="text-sm font-black font-mono text-purple-600 dark:text-purple-400">
                  - {formatCurrency(previewData.tdsAmount)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700">
                <span className="text-[10px] font-bold text-emerald-600 uppercase block">NET BILL AMOUNT</span>
                <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(previewData.netBillAmount)}
                </span>
              </div>
            </div>

            {/* Bill Header Info */}
            <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl text-xs flex justify-between items-center">
              <div>
                <span className="text-gray-400 block">Billing Customer</span>
                <span className="font-bold text-sm text-primary-600 dark:text-primary-400">
                  {parties.find((p) => p.id === selectedPartyId)?.name || "Selected Party"}
                </span>
              </div>
              <div className="text-right">
                <span className="text-gray-400 block">Bill Date & Sequential No</span>
                <span className="font-mono font-semibold">{formatDate(billDate)} (Auto-assigned on save)</span>
              </div>
            </div>

            {/* Items Table */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-gray-100 dark:bg-gray-800 font-semibold uppercase text-gray-500 sticky top-0">
                  <tr>
                    <th className="p-2">#</th>
                    <th className="p-2">Truck</th>
                    <th className="p-2">Route</th>
                    <th className="p-2 text-right">N-Wt</th>
                    <th className="p-2 text-right">R-Wt</th>
                    <th className="p-2 text-right">Rate</th>
                    <th className="p-2 text-right">Freight</th>
                    <th className="p-2 text-right">Shortage</th>
                    <th className="p-2 text-right">Debit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-mono">
                  {previewData.items.map((item) => (
                    <tr key={item.tripId}>
                      <td className="p-2 font-semibold">#{item.srNo}</td>
                      <td className="p-2">{item.truckNumberRaw || "—"}</td>
                      <td className="p-2 font-sans">{item.fromLocationRaw} → {item.toLocationRaw}</td>
                      <td className="p-2 text-right">{item.nWeight.toFixed(3)} T</td>
                      <td className="p-2 text-right">{item.rWeight.toFixed(3)} T</td>
                      <td className="p-2 text-right">₹{item.appliedRate}</td>
                      <td className="p-2 text-right font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrency(item.freight)}
                      </td>
                      <td className="p-2 text-right text-amber-600">
                        {item.shortageQtyApplicable.toFixed(3)} T
                      </td>
                      <td className="p-2 text-right font-semibold text-red-600">
                        {item.shortageDebitAmount > 0 ? formatCurrency(item.shortageDebitAmount) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {submitError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs">
                {submitError}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowPreviewModal(false)}
                disabled={submitting}
              >
                Back to Selection
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Check}
                onClick={handleConfirmCreateBill}
                disabled={submitting}
                id="bill-confirm-create-btn"
              >
                {submitting ? "Creating Transactional Bill…" : "CONFIRM & CREATE BILL"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
