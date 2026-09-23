"use client";

import React, { useState, useMemo } from "react";
import {
  Plus,
  Search,
  Pencil,
  Eye,
  BookOpen,
  CheckCircle2,
  Clock,
  Truck as TruckIcon,
  X,
  Users,
  Scale,
  DollarSign,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button, Badge, EmptyState } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useMasterList, useMasterMutation } from "@/lib/use-master-list";
import { useFirm } from "@/lib/firm-context";
import { Modal, Field, FormGrid, FormActions } from "@/components/ui/modal";
import { formatCurrency, formatDate } from "@/lib/utils";

// ─── Types (matching DB schema & API response) ────────────────
export interface DailyEntryRecord {
  id: string;
  firmId: string;
  srNo: number;
  entryDate: string; // YYYY-MM-DD
  truckId: string | null;
  truckNumberRaw: string | null;
  lrNumber: string | null;
  fromLocationId: string | null;
  fromLocationRaw: string | null;
  toLocationId: string | null;
  toLocationRaw: string | null;
  nWeight: string | number | null;
  rWeight: string | number | null;
  advance: string | number | null;
  rate: string | number | null;
  cash: string | number | null;
  diesel: string | number | null;
  ac: string | number | null;
  companyId: string | null;
  companyNameRaw: string | null;
  partyId: string | null;
  partyNameRaw: string | null;
  customerRate: string | number | null;
  isReceived: boolean;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;

  // Joined master names from API
  partyName?: string | null;
  companyName?: string | null;
  truckNumber?: string | null;
  fromLocationName?: string | null;
  toLocationName?: string | null;
}

export interface MasterParty {
  id: string;
  name: string;
  isActive?: boolean;
}

export interface MasterCompany {
  id: string;
  name: string;
  isActive?: boolean;
}

export interface MasterTruck {
  id: string;
  truckNumber: string;
  isActive?: boolean;
}

export interface MasterLocation {
  id: string;
  name: string;
  isActive?: boolean;
}

interface FormState {
  srNo: string;
  entryDate: string;
  truckId: string;
  truckNumberRaw: string;
  lrNumber: string;
  fromLocationId: string;
  fromLocationRaw: string;
  toLocationId: string;
  toLocationRaw: string;
  nWeight: string;
  rWeight: string;
  advance: string;
  rate: string;
  cash: string;
  diesel: string;
  ac: string;
  companyId: string;
  companyNameRaw: string;
  partyId: string;
  partyNameRaw: string;
  customerRate: string;
  isReceived: boolean;
  remarks: string;
}

const getTodayString = () => new Date().toISOString().split("T")[0];

const createInitialFormState = (suggestedSrNo: number = 1): FormState => ({
  srNo: suggestedSrNo.toString(),
  entryDate: getTodayString(),
  truckId: "",
  truckNumberRaw: "",
  lrNumber: "",
  fromLocationId: "",
  fromLocationRaw: "",
  toLocationId: "",
  toLocationRaw: "",
  nWeight: "",
  rWeight: "",
  advance: "",
  rate: "",
  cash: "",
  diesel: "",
  ac: "",
  companyId: "",
  companyNameRaw: "",
  partyId: "",
  partyNameRaw: "",
  customerRate: "",
  isReceived: false,
  remarks: "",
});

function recordToFormState(rec: DailyEntryRecord): FormState {
  return {
    srNo: rec.srNo?.toString() ?? "1",
    entryDate: rec.entryDate ? rec.entryDate.split("T")[0] : getTodayString(),
    truckId: rec.truckId ?? "",
    truckNumberRaw: rec.truckNumberRaw ?? "",
    lrNumber: rec.lrNumber ?? "",
    fromLocationId: rec.fromLocationId ?? "",
    fromLocationRaw: rec.fromLocationRaw ?? "",
    toLocationId: rec.toLocationId ?? "",
    toLocationRaw: rec.toLocationRaw ?? "",
    nWeight: rec.nWeight !== null && rec.nWeight !== undefined ? String(rec.nWeight) : "",
    rWeight: rec.rWeight !== null && rec.rWeight !== undefined ? String(rec.rWeight) : "",
    advance: rec.advance !== null && rec.advance !== undefined ? String(rec.advance) : "",
    rate: rec.rate !== null && rec.rate !== undefined ? String(rec.rate) : "",
    cash: rec.cash !== null && rec.cash !== undefined ? String(rec.cash) : "",
    diesel: rec.diesel !== null && rec.diesel !== undefined ? String(rec.diesel) : "",
    ac: rec.ac !== null && rec.ac !== undefined ? String(rec.ac) : "",
    companyId: rec.companyId ?? "",
    companyNameRaw: rec.companyNameRaw ?? "",
    partyId: rec.partyId ?? "",
    partyNameRaw: rec.partyNameRaw ?? "",
    customerRate: rec.customerRate !== null && rec.customerRate !== undefined ? String(rec.customerRate) : "",
    isReceived: Boolean(rec.isReceived),
    remarks: rec.remarks ?? "",
  };
}

// ─── Helpers ──────────────────────────────────────────────────
function formatTons(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "—";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "—";
  return `${num.toFixed(3)} T`;
}

function formatMoney(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "" || Number(val) === 0) return "—";
  return formatCurrency(val);
}

// ─── Entry Form Component ─────────────────────────────────────
interface DailyEntryFormProps {
  initial?: FormState;
  parties: MasterParty[];
  companies: MasterCompany[];
  trucks: MasterTruck[];
  locations: MasterLocation[];
  onSubmit: (data: Record<string, any>) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  error: string | null;
  submitLabel?: string;
}

function DailyEntryForm({
  initial,
  parties,
  companies,
  trucks,
  locations,
  onSubmit,
  onCancel,
  loading,
  error,
  submitLabel = "Save Entry",
}: DailyEntryFormProps) {
  const [form, setForm] = useState<FormState>(initial || createInitialFormState());
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  function set(field: keyof FormState, value: any) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate(): boolean {
    const errs: typeof errors = {};
    if (!form.srNo || isNaN(Number(form.srNo)) || Number(form.srNo) <= 0) {
      errs.srNo = "Sr No must be a positive integer";
    }
    if (!form.entryDate || !/^\d{4}-\d{2}-\d{2}$/.test(form.entryDate)) {
      errs.entryDate = "Valid date (YYYY-MM-DD) is required";
    }
    if (form.nWeight && (isNaN(Number(form.nWeight)) || Number(form.nWeight) < 0)) {
      errs.nWeight = "N-Weight cannot be negative";
    }
    if (form.rWeight && (isNaN(Number(form.rWeight)) || Number(form.rWeight) < 0)) {
      errs.rWeight = "R-Weight cannot be negative";
    }
    if (form.advance && (isNaN(Number(form.advance)) || Number(form.advance) < 0)) {
      errs.advance = "Advance cannot be negative";
    }
    if (form.rate && (isNaN(Number(form.rate)) || Number(form.rate) < 0)) {
      errs.rate = "Rate cannot be negative";
    }
    if (form.customerRate && (isNaN(Number(form.customerRate)) || Number(form.customerRate) < 0)) {
      errs.customerRate = "Customer rate cannot be negative";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const payload: Record<string, any> = {
      srNo: Number(form.srNo),
      entryDate: form.entryDate,
      truckId: form.truckId || null,
      truckNumberRaw: form.truckNumberRaw || null,
      lrNumber: form.lrNumber || null,
      fromLocationId: form.fromLocationId || null,
      fromLocationRaw: form.fromLocationRaw || null,
      toLocationId: form.toLocationId || null,
      toLocationRaw: form.toLocationRaw || null,
      nWeight: form.nWeight !== "" ? Number(form.nWeight) : null,
      rWeight: form.rWeight !== "" ? Number(form.rWeight) : null,
      advance: form.advance !== "" ? Number(form.advance) : null,
      rate: form.rate !== "" ? Number(form.rate) : null,
      cash: form.cash !== "" ? Number(form.cash) : null,
      diesel: form.diesel !== "" ? Number(form.diesel) : null,
      ac: form.ac !== "" ? Number(form.ac) : null,
      companyId: form.companyId || null,
      companyNameRaw: form.companyNameRaw || null,
      partyId: form.partyId || null,
      partyNameRaw: form.partyNameRaw || null,
      customerRate: form.customerRate !== "" ? Number(form.customerRate) : null,
      isReceived: Boolean(form.isReceived),
      remarks: form.remarks || null,
    };

    onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {/* 1. TRIP INFORMATION */}
      <div className="border border-gray-100 dark:border-gray-800 rounded-xl p-4 bg-gray-50/50 dark:bg-gray-900/30">
        <div className="flex items-center gap-2 mb-3">
          <TruckIcon size={16} className="text-primary-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Trip Information
          </h3>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Sr No" required error={errors.srNo}>
              <input
                type="number"
                min="1"
                step="1"
                value={form.srNo}
                onChange={(e) => set("srNo", e.target.value)}
                placeholder="e.g. 1"
                className="form-input font-mono font-medium"
                id="daily-form-srno"
              />
            </Field>
            <Field label="Date" required error={errors.entryDate}>
              <input
                type="date"
                value={form.entryDate}
                onChange={(e) => set("entryDate", e.target.value)}
                className="form-input"
                id="daily-form-date"
              />
            </Field>
            <Field label="LR No" error={errors.lrNumber}>
              <input
                type="text"
                value={form.lrNumber}
                onChange={(e) => set("lrNumber", e.target.value)}
                placeholder="e.g. LR-9082"
                className="form-input font-mono"
                id="daily-form-lrno"
              />
            </Field>
          </div>

          <FormGrid cols={2}>
            <Field label="Truck No (Master)" hint="Select registered truck or enter custom below">
              <select
                value={form.truckId}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  set("truckId", selectedId);
                  if (selectedId) {
                    const found = trucks.find((t) => t.id === selectedId);
                    if (found) set("truckNumberRaw", found.truckNumber);
                  }
                }}
                className="form-input"
                id="daily-form-truck-select"
              >
                <option value="">-- Select Truck Master --</option>
                {trucks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.truckNumber}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Truck No (Raw Text)" hint="Used if truck not in master list">
              <input
                type="text"
                value={form.truckNumberRaw}
                onChange={(e) => set("truckNumberRaw", e.target.value)}
                placeholder="e.g. MH06BW0111"
                className="form-input uppercase font-mono"
                id="daily-form-truck-raw"
              />
            </Field>
          </FormGrid>

          <FormGrid cols={2}>
            <Field label="From Location">
              <div className="space-y-1.5">
                <select
                  value={form.fromLocationId}
                  onChange={(e) => {
                    const selId = e.target.value;
                    set("fromLocationId", selId);
                    if (selId) {
                      const loc = locations.find((l) => l.id === selId);
                      if (loc) set("fromLocationRaw", loc.name);
                    }
                  }}
                  className="form-input"
                  id="daily-form-from-select"
                >
                  <option value="">-- Select From Location --</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={form.fromLocationRaw}
                  onChange={(e) => set("fromLocationRaw", e.target.value)}
                  placeholder="Or enter location name..."
                  className="form-input text-xs"
                  id="daily-form-from-raw"
                />
              </div>
            </Field>

            <Field label="To Location">
              <div className="space-y-1.5">
                <select
                  value={form.toLocationId}
                  onChange={(e) => {
                    const selId = e.target.value;
                    set("toLocationId", selId);
                    if (selId) {
                      const loc = locations.find((l) => l.id === selId);
                      if (loc) set("toLocationRaw", loc.name);
                    }
                  }}
                  className="form-input"
                  id="daily-form-to-select"
                >
                  <option value="">-- Select To Location --</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={form.toLocationRaw}
                  onChange={(e) => set("toLocationRaw", e.target.value)}
                  placeholder="Or enter location name..."
                  className="form-input text-xs"
                  id="daily-form-to-raw"
                />
              </div>
            </Field>
          </FormGrid>
        </div>
      </div>

      {/* 2. WEIGHT */}
      <div className="border border-gray-100 dark:border-gray-800 rounded-xl p-4 bg-gray-50/50 dark:bg-gray-900/30">
        <div className="flex items-center gap-2 mb-3">
          <Scale size={16} className="text-blue-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Weight Details (in Metric Tons)
          </h3>
        </div>
        <FormGrid cols={2}>
          <Field label="N-Weight (Loading Wt)" error={errors.nWeight} hint="Net / Loading weight in Metric Tons (MT)">
            <div className="relative">
              <input
                type="number"
                step="0.001"
                min="0"
                value={form.nWeight}
                onChange={(e) => set("nWeight", e.target.value)}
                placeholder="e.g. 40.500"
                className="form-input font-mono pr-12"
                id="daily-form-nweight"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold pointer-events-none">
                MT
              </span>
            </div>
          </Field>

          <Field label="R-Weight (Unloading Wt)" error={errors.rWeight} hint="Received / Unloading weight in Metric Tons (MT)">
            <div className="relative">
              <input
                type="number"
                step="0.001"
                min="0"
                value={form.rWeight}
                onChange={(e) => set("rWeight", e.target.value)}
                placeholder="e.g. 40.100"
                className="form-input font-mono pr-12"
                id="daily-form-rweight"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold pointer-events-none">
                MT
              </span>
            </div>
          </Field>
        </FormGrid>
      </div>

      {/* 3. FINANCIAL / DAILY BOOK */}
      <div className="border border-gray-100 dark:border-gray-800 rounded-xl p-4 bg-gray-50/50 dark:bg-gray-900/30">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign size={16} className="text-emerald-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Financial / Daily Book Expenses
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Driver Rate (₹)" error={errors.rate} hint="Operational freight rate">
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.rate}
              onChange={(e) => set("rate", e.target.value)}
              placeholder="e.g. 1200"
              className="form-input font-mono"
              id="daily-form-rate"
            />
          </Field>
          <Field label="Advance (₹)" error={errors.advance} hint="Advance paid to driver">
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.advance}
              onChange={(e) => set("advance", e.target.value)}
              placeholder="e.g. 5000"
              className="form-input font-mono"
              id="daily-form-advance"
            />
          </Field>
          <Field label="Cash (₹)" error={errors.cash}>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.cash}
              onChange={(e) => set("cash", e.target.value)}
              placeholder="e.g. 1000"
              className="form-input font-mono"
              id="daily-form-cash"
            />
          </Field>
        </div>

        <div className="mt-3">
          <FormGrid cols={2}>
            <Field label="Diesel (₹)" error={errors.diesel}>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.diesel}
                onChange={(e) => set("diesel", e.target.value)}
                placeholder="e.g. 3000"
                className="form-input font-mono"
                id="daily-form-diesel"
              />
            </Field>
            <Field label="A/c (₹)" error={errors.ac} hint="Account adjustment amount">
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.ac}
                onChange={(e) => set("ac", e.target.value)}
                placeholder="e.g. 500"
                className="form-input font-mono"
                id="daily-form-ac"
              />
            </Field>
          </FormGrid>
        </div>
      </div>

      {/* 4. PARTY / COMPANY */}
      <div className="border border-gray-100 dark:border-gray-800 rounded-xl p-4 bg-gray-50/50 dark:bg-gray-900/30">
        <div className="flex items-center gap-2 mb-3">
          <Users size={16} className="text-purple-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Party & Company (Strictly Separate Entities)
          </h3>
        </div>

        <FormGrid cols={2}>
          <Field
            label="Party Name (Billing Customer)"
            hint="The actual customer who gets billed and pays"
          >
            <div className="space-y-1.5">
              <select
                value={form.partyId}
                onChange={(e) => {
                  const selId = e.target.value;
                  set("partyId", selId);
                  if (selId) {
                    const p = parties.find((item) => item.id === selId);
                    if (p) set("partyNameRaw", p.name);
                  }
                }}
                className="form-input font-medium"
                id="daily-form-party-select"
              >
                <option value="">-- Select Billing Customer --</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={form.partyNameRaw}
                onChange={(e) => set("partyNameRaw", e.target.value)}
                placeholder="Or enter party name text..."
                className="form-input text-xs"
                id="daily-form-party-raw"
              />
            </div>
          </Field>

          <Field
            label="Company Name (Loading Site)"
            hint="Dispatch / loading site location record"
          >
            <div className="space-y-1.5">
              <select
                value={form.companyId}
                onChange={(e) => {
                  const selId = e.target.value;
                  set("companyId", selId);
                  if (selId) {
                    const c = companies.find((item) => item.id === selId);
                    if (c) set("companyNameRaw", c.name);
                  }
                }}
                className="form-input font-medium"
                id="daily-form-company-select"
              >
                <option value="">-- Select Loading Company --</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={form.companyNameRaw}
                onChange={(e) => set("companyNameRaw", e.target.value)}
                placeholder="Or enter company name text..."
                className="form-input text-xs"
                id="daily-form-company-raw"
              />
            </div>
          </Field>
        </FormGrid>

        <div className="mt-3">
          <FormGrid cols={1}>
            <Field label="Customer Rate / Final Rate (₹)" error={errors.customerRate} hint="Rate used when calculating freight on customer bill">
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.customerRate}
                onChange={(e) => set("customerRate", e.target.value)}
                placeholder="e.g. 1500"
                className="form-input font-mono font-semibold"
                id="daily-form-customer-rate"
              />
            </Field>
          </FormGrid>
        </div>
      </div>

      {/* 5. POCH STATUS & REMARKS */}
      <div className="border border-gray-100 dark:border-gray-800 rounded-xl p-4 bg-gray-50/50 dark:bg-gray-900/30">
        <div className="flex items-center justify-between gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 block mb-1">
              POCH Status (Received / Pending)
            </label>
            <p className="text-xs text-gray-500">
              Only trips marked as <span className="font-semibold text-emerald-600 dark:text-emerald-400">RECEIVED</span> will be eligible for customer billing.
            </p>
          </div>
          <button
            type="button"
            onClick={() => set("isReceived", !form.isReceived)}
            id="daily-form-status-toggle"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${
              form.isReceived
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 shadow-sm"
                : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 shadow-sm"
            }`}
          >
            {form.isReceived ? (
              <>
                <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                <span>RECEIVED</span>
              </>
            ) : (
              <>
                <Clock size={16} className="text-amber-600 dark:text-amber-400" />
                <span>PENDING</span>
              </>
            )}
          </button>
        </div>

        <div className="mt-4">
          <Field label="Remarks / Notes" error={errors.remarks}>
            <textarea
              value={form.remarks}
              onChange={(e) => set("remarks", e.target.value)}
              placeholder="Operational remarks, driver info, loading details..."
              className="form-input min-h-[64px] resize-y"
              rows={2}
              id="daily-form-remarks"
            />
          </Field>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <FormActions onCancel={onCancel} loading={loading} submitLabel={submitLabel} />
    </form>
  );
}

// ─── View Entry Details Modal ─────────────────────────────────
function DailyEntryViewModal({
  entry,
  onClose,
}: {
  entry: DailyEntryRecord;
  onClose: () => void;
}) {
  const truckText = entry.truckNumber || entry.truckNumberRaw || "—";
  const partyText = entry.partyName || entry.partyNameRaw || "—";
  const companyText = entry.companyName || entry.companyNameRaw || "—";
  const fromText = entry.fromLocationName || entry.fromLocationRaw || "—";
  const toText = entry.toLocationName || entry.toLocationRaw || "—";

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
        <div>
          <span className="text-xs text-gray-400 font-medium">Sr No #{entry.srNo}</span>
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
            {truckText}
          </h3>
          <span className="text-xs text-gray-500">{formatDate(entry.entryDate)}</span>
        </div>
        <Badge variant={entry.isReceived ? "success" : "warning"}>
          {entry.isReceived ? "RECEIVED (Billable)" : "PENDING (Operational)"}
        </Badge>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="card p-3 space-y-1.5">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Route & Logistics
          </span>
          <div>
            <span className="text-xs text-gray-500 block">From → To</span>
            <span className="font-medium">{fromText} → {toText}</span>
          </div>
          <div>
            <span className="text-xs text-gray-500 block">LR Number</span>
            <span className="font-mono text-xs">{entry.lrNumber || "—"}</span>
          </div>
        </div>

        <div className="card p-3 space-y-1.5">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Party vs Company
          </span>
          <div>
            <span className="text-xs text-gray-500 block">Billing Party</span>
            <span className="font-semibold text-primary-600 dark:text-primary-400">{partyText}</span>
          </div>
          <div>
            <span className="text-xs text-gray-500 block">Loading Company</span>
            <span className="font-medium text-gray-700 dark:text-gray-300">{companyText}</span>
          </div>
        </div>

        <div className="card p-3 space-y-1.5">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Weights (Metric Tons)
          </span>
          <div className="flex justify-between">
            <span className="text-gray-500 text-xs">N-Weight:</span>
            <span className="font-mono font-medium">{formatTons(entry.nWeight)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 text-xs">R-Weight:</span>
            <span className="font-mono font-medium">{formatTons(entry.rWeight)}</span>
          </div>
        </div>

        <div className="card p-3 space-y-1.5">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Financial & Rates
          </span>
          <div className="flex justify-between">
            <span className="text-gray-500 text-xs">Driver Rate:</span>
            <span className="font-mono">{formatMoney(entry.rate)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 text-xs">Customer Rate:</span>
            <span className="font-mono font-semibold text-emerald-600">{formatMoney(entry.customerRate)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 text-xs">Advance Paid:</span>
            <span className="font-mono">{formatMoney(entry.advance)}</span>
          </div>
        </div>
      </div>

      {/* Driver Voucher notice */}
      <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 p-3">
        <p className="text-xs text-indigo-700 dark:text-indigo-300">
          <strong>Driver Voucher Status:</strong> Synchronized (<code>PENDING_CONFIRMATION</code>). No automatic ledger postings created yet.
        </p>
      </div>

      {entry.remarks && (
        <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg text-xs text-gray-600 dark:text-gray-300">
          <strong>Remarks:</strong> {entry.remarks}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}

// ─── Main Daily Book Page ──────────────────────────────────────
export default function DailyBookPage() {
  const { currentFirm, loading: firmLoading } = useFirm();

  // Load entries and master lists
  const {
    data: entries,
    loading,
    error,
    refresh,
  } = useMasterList<DailyEntryRecord>({
    endpoint: "/api/daily-entries",
  });
  const { submitting, submitError, create, update } = useMasterMutation("/api/daily-entries");

  const { data: parties } = useMasterList<MasterParty>({ endpoint: "/api/parties" });
  const { data: companies } = useMasterList<MasterCompany>({ endpoint: "/api/companies" });
  const { data: trucks } = useMasterList<MasterTruck>({ endpoint: "/api/trucks" });
  const { data: locations } = useMasterList<MasterLocation>({ endpoint: "/api/locations" });

  // UI State
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [partyFilter, setPartyFilter] = useState("ALL");
  const [companyFilter, setCompanyFilter] = useState("ALL");
  const [truckFilter, setTruckFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "RECEIVED" | "PENDING">("ALL");

  const [modal, setModal] = useState<
    | { mode: "create" }
    | { mode: "edit"; entry: DailyEntryRecord }
    | { mode: "view"; entry: DailyEntryRecord }
    | null
  >(null);

  const [feedback, setFeedback] = useState<string | null>(null);

  // Compute maximum Sr No for new entry auto-suggestion
  const suggestedSrNo = useMemo(() => {
    if (!entries || entries.length === 0) return 1;
    const maxSr = Math.max(...entries.map((e) => Number(e.srNo) || 0));
    return maxSr + 1;
  }, [entries]);

  // Overall Statistics for Summary Cards
  const stats = useMemo(() => {
    const total = entries.length;
    const received = entries.filter((e) => e.isReceived).length;
    const pending = total - received;

    let totalNWeight = 0;
    let totalRWeight = 0;
    entries.forEach((e) => {
      totalNWeight += Number(e.nWeight) || 0;
      totalRWeight += Number(e.rWeight) || 0;
    });

    return { total, received, pending, totalNWeight, totalRWeight };
  }, [entries]);

  // Client-side Filtered Entries
  const filtered = useMemo(() => {
    return entries.filter((e) => {
      // 1. Search Query
      if (search.trim()) {
        const q = search.toLowerCase();
        const truckMatch = (e.truckNumber || e.truckNumberRaw || "").toLowerCase().includes(q);
        const partyMatch = (e.partyName || e.partyNameRaw || "").toLowerCase().includes(q);
        const companyMatch = (e.companyName || e.companyNameRaw || "").toLowerCase().includes(q);
        const lrMatch = (e.lrNumber || "").toLowerCase().includes(q);
        const fromMatch = (e.fromLocationName || e.fromLocationRaw || "").toLowerCase().includes(q);
        const toMatch = (e.toLocationName || e.toLocationRaw || "").toLowerCase().includes(q);
        const srMatch = String(e.srNo).includes(q);
        if (!truckMatch && !partyMatch && !companyMatch && !lrMatch && !fromMatch && !toMatch && !srMatch) {
          return false;
        }
      }

      // 2. Status Filter
      if (statusFilter === "RECEIVED" && !e.isReceived) return false;
      if (statusFilter === "PENDING" && e.isReceived) return false;

      // 3. Date Range
      if (dateFrom && e.entryDate < dateFrom) return false;
      if (dateTo && e.entryDate > dateTo) return false;

      // 4. Party Filter
      if (partyFilter !== "ALL" && e.partyId !== partyFilter) return false;

      // 5. Company Filter
      if (companyFilter !== "ALL" && e.companyId !== companyFilter) return false;

      // 6. Truck Filter
      if (truckFilter !== "ALL" && e.truckId !== truckFilter) return false;

      return true;
    });
  }, [entries, search, statusFilter, dateFrom, dateTo, partyFilter, companyFilter, truckFilter]);

  const hasActiveFilters =
    Boolean(search) ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    partyFilter !== "ALL" ||
    companyFilter !== "ALL" ||
    truckFilter !== "ALL" ||
    statusFilter !== "ALL";

  function clearFilters() {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setPartyFilter("ALL");
    setCompanyFilter("ALL");
    setTruckFilter("ALL");
    setStatusFilter("ALL");
  }

  async function handleCreate(payload: Record<string, any>) {
    const ok = await create(payload);
    if (ok) {
      setModal(null);
      setFeedback("Daily Entry created successfully!");
      setTimeout(() => setFeedback(null), 4000);
      refresh();
    }
  }

  async function handleUpdate(id: string, payload: Record<string, any>) {
    const ok = await update(id, payload);
    if (ok) {
      setModal(null);
      setFeedback("Daily Entry updated successfully!");
      setTimeout(() => setFeedback(null), 4000);
      refresh();
    }
  }

  const columns: Column<DailyEntryRecord>[] = [
    {
      key: "srNo",
      label: "Sr No",
      render: (e) => <span className="font-mono text-xs font-semibold text-gray-500">#{e.srNo}</span>,
    },
    {
      key: "entryDate",
      label: "Date",
      render: (e) => <span className="text-xs whitespace-nowrap">{formatDate(e.entryDate)}</span>,
    },
    {
      key: "truckNumber",
      label: "Truck No",
      render: (e) => (
        <div>
          <span className="font-mono font-semibold text-sm text-gray-900 dark:text-gray-100">
            {e.truckNumber || e.truckNumberRaw || "—"}
          </span>
          {e.lrNumber && (
            <div className="text-[11px] font-mono text-gray-400">LR: {e.lrNumber}</div>
          )}
        </div>
      ),
    },
    {
      key: "route",
      label: "From → To",
      render: (e) => {
        const from = e.fromLocationName || e.fromLocationRaw || "—";
        const to = e.toLocationName || e.toLocationRaw || "—";
        return (
          <span className="text-xs text-gray-600 dark:text-gray-300">
            {from} → {to}
          </span>
        );
      },
    },
    {
      key: "weights",
      label: "N-Wt / R-Wt",
      align: "right",
      render: (e) => (
        <div className="text-right">
          <div className="font-mono text-xs text-gray-800 dark:text-gray-200">
            N: {formatTons(e.nWeight)}
          </div>
          <div className="font-mono text-[11px] text-gray-500">
            R: {formatTons(e.rWeight)}
          </div>
        </div>
      ),
    },
    {
      key: "partyName",
      label: "Party (Billing)",
      render: (e) => {
        const partyName = e.partyName || e.partyNameRaw;
        return partyName ? (
          <span className="font-medium text-xs text-primary-600 dark:text-primary-400">
            {partyName}
          </span>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        );
      },
    },
    {
      key: "companyName",
      label: "Company (Site)",
      render: (e) => {
        const companyName = e.companyName || e.companyNameRaw;
        return companyName ? (
          <span className="text-xs text-gray-600 dark:text-gray-300">{companyName}</span>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        );
      },
    },
    {
      key: "rates",
      label: "Cust Rate",
      align: "right",
      render: (e) =>
        e.customerRate ? (
          <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(e.customerRate)}
          </span>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        ),
    },
    {
      key: "isReceived",
      label: "POCH Status",
      render: (e) => (
        <Badge variant={e.isReceived ? "success" : "warning"}>
          {e.isReceived ? "RECEIVED" : "PENDING"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (e) => (
        <div className="flex items-center justify-end gap-1">
          <button
            className="btn btn-ghost btn-xs text-gray-500 hover:text-gray-800"
            onClick={(ev) => {
              ev.stopPropagation();
              setModal({ mode: "view", entry: e });
            }}
            title="View details"
            id={`daily-view-${e.id}`}
          >
            <Eye size={13} />
          </button>
          <button
            className="btn btn-ghost btn-xs text-primary-600 hover:text-primary-800"
            onClick={(ev) => {
              ev.stopPropagation();
              setModal({ mode: "edit", entry: e });
            }}
            title="Edit entry"
            id={`daily-edit-${e.id}`}
          >
            <Pencil size={13} />
          </button>
        </div>
      ),
    },
  ];

  const editRecord = modal?.mode === "edit" ? modal.entry : null;
  const viewRecord = modal?.mode === "view" ? modal.entry : null;

  return (
    <div className="animate-fade-in space-y-4">
      <PageHeader
        title="Daily Book"
        subtitle="Roznamcha — operational trip entries strictly scoped per firm"
        breadcrumbs={[{ label: "Daily Book" }]}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => setModal({ mode: "create" })}
            id="daily-book-new-entry"
            disabled={firmLoading || !currentFirm}
          >
            New Entry
          </Button>
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Total Trips */}
        <button
          onClick={() => setStatusFilter("ALL")}
          className={`card p-3.5 flex items-center justify-between text-left transition-all border ${
            statusFilter === "ALL"
              ? "ring-2 ring-primary-500 border-primary-300 dark:border-primary-700"
              : "hover:border-gray-300"
          }`}
        >
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              Total Trips
            </span>
            <span className="text-2xl font-black text-gray-900 dark:text-gray-100 font-mono">
              {stats.total}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600">
            <BookOpen size={18} />
          </div>
        </button>

        {/* Received Trips */}
        <button
          onClick={() => setStatusFilter("RECEIVED")}
          className={`card p-3.5 flex items-center justify-between text-left transition-all border ${
            statusFilter === "RECEIVED"
              ? "ring-2 ring-emerald-500 border-emerald-300 dark:border-emerald-700"
              : "hover:border-gray-300"
          }`}
        >
          <div>
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
              Received (Billable)
            </span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {stats.received}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 size={18} />
          </div>
        </button>

        {/* Pending Trips */}
        <button
          onClick={() => setStatusFilter("PENDING")}
          className={`card p-3.5 flex items-center justify-between text-left transition-all border ${
            statusFilter === "PENDING"
              ? "ring-2 ring-amber-500 border-amber-300 dark:border-amber-700"
              : "hover:border-gray-300"
          }`}
        >
          <div>
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
              Pending (POCH)
            </span>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
              {stats.pending}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600">
            <Clock size={18} />
          </div>
        </button>

        {/* Total Weights */}
        <div className="card p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              Total Weight (MT)
            </span>
            <span className="text-sm font-bold font-mono text-gray-800 dark:text-gray-200">
              N: {stats.totalNWeight.toFixed(2)} T
            </span>
            <div className="text-xs font-mono text-gray-500">
              R: {stats.totalRWeight.toFixed(2)} T
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600">
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
              placeholder="Search truck, party, company, LR, route…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input pl-8 text-xs"
              id="daily-book-search"
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
              id="daily-filter-date-from"
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
              id="daily-filter-date-to"
            />
          </div>

          {/* Party Filter */}
          <select
            value={partyFilter}
            onChange={(e) => setPartyFilter(e.target.value)}
            className="form-input text-xs w-40"
            id="daily-filter-party"
          >
            <option value="ALL">All Parties</option>
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
            id="daily-filter-company"
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
            id="daily-filter-truck"
          >
            <option value="ALL">All Trucks</option>
            {trucks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.truckNumber}
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
            {loading ? "Loading entries…" : `Showing ${filtered.length} of ${entries.length} daily entries`}
          </span>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            <span>Received = Billable</span>
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 ml-2" />
            <span>Pending = Unbillable</span>
          </div>
        </div>
      </div>

      {/* Main Data Table */}
      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        emptyState={
          <EmptyState
            icon={BookOpen}
            title={hasActiveFilters ? "No daily entries match your filters" : "No daily entries yet"}
            description={
              hasActiveFilters
                ? "Try adjusting or clearing your search and filter criteria."
                : "Record your first daily operational trip entry to get started."
            }
            action={
              !hasActiveFilters ? (
                <Button
                  variant="primary"
                  size="sm"
                  icon={Plus}
                  onClick={() => setModal({ mode: "create" })}
                >
                  New Entry
                </Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Clear Filters
                </Button>
              )
            }
          />
        }
        onRowClick={(e) => setModal({ mode: "view", entry: e })}
      />

      {/* Create Modal */}
      <Modal
        open={modal?.mode === "create"}
        onClose={() => setModal(null)}
        title={`New Daily Book Entry (Sr No #${suggestedSrNo})`}
        size="lg"
      >
        <DailyEntryForm
          initial={createInitialFormState(suggestedSrNo)}
          parties={parties}
          companies={companies}
          trucks={trucks}
          locations={locations}
          onSubmit={handleCreate}
          onCancel={() => setModal(null)}
          loading={submitting}
          error={submitError}
          submitLabel="Save Entry"
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={modal?.mode === "edit"}
        onClose={() => setModal(null)}
        title={`Edit Daily Entry — Sr No #${editRecord?.srNo ?? ""}`}
        size="lg"
      >
        {editRecord && (
          <DailyEntryForm
            initial={recordToFormState(editRecord)}
            parties={parties}
            companies={companies}
            trucks={trucks}
            locations={locations}
            onSubmit={(data) => handleUpdate(editRecord.id, data)}
            onCancel={() => setModal(null)}
            loading={submitting}
            error={submitError}
            submitLabel="Update Entry"
          />
        )}
      </Modal>

      {/* View Modal */}
      <Modal
        open={modal?.mode === "view"}
        onClose={() => setModal(null)}
        title={`Daily Trip Detail — Sr No #${viewRecord?.srNo ?? ""}`}
        size="lg"
      >
        {viewRecord && <DailyEntryViewModal entry={viewRecord} onClose={() => setModal(null)} />}
      </Modal>
    </div>
  );
}
