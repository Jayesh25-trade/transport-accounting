"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Pencil,
  Eye,
  CheckCircle2,
  X,
  Lock,
  ArrowUpRight,
  Filter,
  Calendar,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button, Badge, EmptyState, Panel } from "@/components/ui/primitives";
import { TableShell, Th, Td } from "@/components/ui/data-table";
import { useMasterList, useMasterMutation } from "@/lib/use-master-list";
import { useFirm } from "@/lib/firm-context";
import { Modal, Field, FormGrid } from "@/components/ui/modal";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useApiClient } from "@/lib/api-client";

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

  // Billing status — returned by API (joined from trips + bills)
  isBilled?: boolean | null;
  billId?: string | null;
  billNumber?: number | null;
  billStatus?: string | null;
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

function StatusBadge({ status }: { status: "RECEIVED" | "PENDING" }) {
  if (status === "RECEIVED") {
    return (
      <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700 border border-teal-200">
        Received — Billable
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 border border-amber-200">
      Pending — Unbillable
    </span>
  );
}

// ─── Entry Form Component (Matches Lovable visual form) ──────
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
  submitLabel = "Save entry",
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
    <form onSubmit={handleSubmit} noValidate className="grid gap-4 md:grid-cols-3 xl:grid-cols-4 text-xs">
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

      <Field label="Truck No (Master)">
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

      <Field label="Truck No (Raw Text)" hint="If truck not in master list">
        <input
          type="text"
          value={form.truckNumberRaw}
          onChange={(e) => set("truckNumberRaw", e.target.value)}
          placeholder="e.g. MH06BW0111"
          className="form-input uppercase font-mono"
          id="daily-form-truck-raw"
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

      <Field label="Party (Billing Customer)">
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
      </Field>

      <Field label="Party Name (Raw Text)" hint="Or type custom customer name">
        <input
          type="text"
          value={form.partyNameRaw}
          onChange={(e) => set("partyNameRaw", e.target.value)}
          placeholder="e.g. Fairway Dream"
          className="form-input"
          id="daily-form-party-raw"
        />
      </Field>

      <Field label="Company (Loading Site)">
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
      </Field>

      <Field label="Company Name (Raw Text)" hint="Or type site company">
        <input
          type="text"
          value={form.companyNameRaw}
          onChange={(e) => set("companyNameRaw", e.target.value)}
          placeholder="e.g. Parle Industries"
          className="form-input"
          id="daily-form-company-raw"
        />
      </Field>

      <Field label="From Location">
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
      </Field>

      <Field label="From Raw Text">
        <input
          type="text"
          value={form.fromLocationRaw}
          onChange={(e) => set("fromLocationRaw", e.target.value)}
          placeholder="e.g. Mumbai Port"
          className="form-input text-xs"
          id="daily-form-from-raw"
        />
      </Field>

      <Field label="To Location">
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
      </Field>

      <Field label="To Raw Text">
        <input
          type="text"
          value={form.toLocationRaw}
          onChange={(e) => set("toLocationRaw", e.target.value)}
          placeholder="e.g. Pune Factory"
          className="form-input text-xs"
          id="daily-form-to-raw"
        />
      </Field>

      <Field label="N-Weight (T)" hint="Loaded / challan weight in MT" error={errors.nWeight}>
        <input
          type="number"
          step="0.001"
          min="0"
          value={form.nWeight}
          onChange={(e) => set("nWeight", e.target.value)}
          placeholder="40.000"
          className="form-input font-mono font-medium"
          id="daily-form-nweight"
        />
      </Field>

      <Field label="R-Weight (T)" hint="Unloading received weight in MT" error={errors.rWeight}>
        <input
          type="number"
          step="0.001"
          min="0"
          value={form.rWeight}
          onChange={(e) => set("rWeight", e.target.value)}
          placeholder="39.500"
          className="form-input font-mono font-medium"
          id="daily-form-rweight"
        />
      </Field>

      <Field label="Customer / Final Rate (₹)" error={errors.customerRate}>
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.customerRate}
          onChange={(e) => set("customerRate", e.target.value)}
          placeholder="e.g. 520"
          className="form-input font-mono"
          id="daily-form-custrate"
        />
      </Field>

      <Field label="Driver Rate (₹)" error={errors.rate}>
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.rate}
          onChange={(e) => set("rate", e.target.value)}
          placeholder="e.g. 450"
          className="form-input font-mono"
          id="daily-form-rate"
        />
      </Field>

      <Field label="Advance (₹)" error={errors.advance}>
        <input
          type="number"
          step="1"
          min="0"
          value={form.advance}
          onChange={(e) => set("advance", e.target.value)}
          placeholder="0"
          className="form-input font-mono"
          id="daily-form-advance"
        />
      </Field>

      <Field label="Cash (₹)">
        <input
          type="number"
          step="1"
          min="0"
          value={form.cash}
          onChange={(e) => set("cash", e.target.value)}
          placeholder="0"
          className="form-input font-mono"
          id="daily-form-cash"
        />
      </Field>

      <Field label="Diesel (₹)">
        <input
          type="number"
          step="1"
          min="0"
          value={form.diesel}
          onChange={(e) => set("diesel", e.target.value)}
          placeholder="0"
          className="form-input font-mono"
          id="daily-form-diesel"
        />
      </Field>

      <Field label="A/c (₹)">
        <input
          type="number"
          step="1"
          min="0"
          value={form.ac}
          onChange={(e) => set("ac", e.target.value)}
          placeholder="0"
          className="form-input font-mono"
          id="daily-form-ac"
        />
      </Field>

      <Field label="POCH Status" hint="Received = Billable · Pending = Unbillable">
        <select
          value={form.isReceived ? "RECEIVED" : "PENDING"}
          onChange={(e) => set("isReceived", e.target.value === "RECEIVED")}
          className="form-input font-semibold"
          id="daily-form-status"
        >
          <option value="PENDING">Pending — Unbillable</option>
          <option value="RECEIVED">Received — Billable</option>
        </select>
      </Field>

      <Field label="Remarks">
        <input
          type="text"
          value={form.remarks}
          onChange={(e) => set("remarks", e.target.value)}
          placeholder="Optional note"
          className="form-input"
          id="daily-form-remarks"
        />
      </Field>

      {error && (
        <div className="md:col-span-3 xl:col-span-4 rounded-lg bg-red-50 border border-red-200 p-3">
          <p className="text-xs text-red-600 font-semibold">{error}</p>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2 md:col-span-3 xl:col-span-4">
        <Button type="submit" variant="coral" disabled={loading}>
          {loading ? "Saving..." : submitLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ─── Trip Detail Modal (Matches Lovable TripDetail) ───────────
function TripDetailModal({
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

  const nWt = entry.nWeight !== null && entry.nWeight !== undefined ? Number(entry.nWeight) : 0;
  const rWt = entry.rWeight !== null && entry.rWeight !== undefined ? Number(entry.rWeight) : 0;
  const shortage = Math.max(0, nWt - rWt);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1D20]/60 p-4 animate-fade-in my-auto">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#D8D5CE] bg-white p-6 shadow-xl space-y-5">
        <div className="flex items-start justify-between gap-4 border-b border-[#EFECE6] pb-4">
          <div>
            <div className="text-[11px] font-bold tracking-widest text-coral uppercase">
              Trip Detail — Sr No #{entry.srNo}
            </div>
            <h3 className="font-display text-2xl font-bold text-[#1A1D20] mt-0.5">
              {truckText} · {entry.lrNumber ? `LR #${entry.lrNumber}` : "No LR"}
            </h3>
            <p className="text-xs text-[#5F6368] mt-0.5">
              {formatDate(entry.entryDate)} · {fromText} → {toText}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-[#7A7F85] hover:bg-[#FAF8F5] transition-colors"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Lock Banner if Billed */}
        {entry.isBilled && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex items-center justify-between text-xs text-amber-800">
            <span className="font-semibold flex items-center gap-1.5">
              <Lock size={14} className="text-amber-600" />
              Billed in Bill #{entry.billNumber ?? entry.billId} — Editing Locked
            </span>
            <Badge variant="warning">BILLED</Badge>
          </div>
        )}

        {/* Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl border border-[#D8D5CE] bg-white p-3.5 space-y-1">
            <span className="text-[10px] font-bold text-[#7A7F85] uppercase tracking-wider block">Billing Customer</span>
            <span className="font-bold text-[#E05638] text-sm block">{partyText}</span>
          </div>

          <div className="rounded-xl border border-[#D8D5CE] bg-white p-3.5 space-y-1">
            <span className="text-[10px] font-bold text-[#7A7F85] uppercase tracking-wider block">Loading Site Company</span>
            <span className="font-semibold text-[#1A1D20] text-sm block">{companyText}</span>
          </div>

          <div className="rounded-xl border border-[#D8D5CE] bg-white p-3.5 space-y-1">
            <span className="text-[10px] font-bold text-[#7A7F85] uppercase tracking-wider block">N-Weight (Loaded)</span>
            <span className="font-mono font-bold text-[#1A1D20] text-sm block">{formatTons(entry.nWeight)}</span>
          </div>

          <div className="rounded-xl border border-[#D8D5CE] bg-white p-3.5 space-y-1">
            <span className="text-[10px] font-bold text-[#7A7F85] uppercase tracking-wider block">R-Weight (Unloaded)</span>
            <span className="font-mono font-bold text-[#1A1D20] text-sm block">{formatTons(entry.rWeight)}</span>
          </div>

          <div className="rounded-xl border border-[#D8D5CE] bg-white p-3.5 space-y-1">
            <span className="text-[10px] font-bold text-[#7A7F85] uppercase tracking-wider block">Shortage (N − R)</span>
            <span className="font-mono font-bold text-red-600 text-sm block">{formatTons(shortage)}</span>
          </div>

          <div className="rounded-xl border border-[#D8D5CE] bg-white p-3.5 space-y-1">
            <span className="text-[10px] font-bold text-[#7A7F85] uppercase tracking-wider block">Customer Rate</span>
            <span className="font-mono font-bold text-emerald-700 text-sm block">{formatCurrency(entry.customerRate ?? 0)}</span>
          </div>
        </div>

        {/* Operational Driver Voucher Box */}
        <div className="rounded-xl bg-[#1A1D20] p-4 text-white space-y-2">
          <div className="text-[10px] font-bold tracking-widest text-[#7A7F85] uppercase">
            Driver Voucher (Operational Expenses)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
            <div>Advance: <span className="font-bold">{formatCurrency(entry.advance ?? 0)}</span></div>
            <div>Cash: <span className="font-bold">{formatCurrency(entry.cash ?? 0)}</span></div>
            <div>Diesel: <span className="font-bold">{formatCurrency(entry.diesel ?? 0)}</span></div>
            <div>A/c: <span className="font-bold">{formatCurrency(entry.ac ?? 0)}</span></div>
          </div>
          <p className="text-[11px] text-gray-400">Status: Synchronized 1-to-1 with Driver Voucher ledger.</p>
        </div>

        {entry.remarks && (
          <div className="rounded-xl border border-[#D8D5CE] bg-[#FAF8F5] p-3 text-xs text-[#5F6368]">
            <strong className="text-[#1A1D20]">Remarks:</strong> {entry.remarks}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="ink" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Daily Book Page Component ───────────────────────────
export default function DailyBookPage() {
  const { currentFirm, loading: firmLoading } = useFirm();
  const api = useApiClient();

  const { data: entries, loading, error, refresh } = useMasterList<DailyEntryRecord>({
    endpoint: "/api/daily-entries",
  });
  const { submitting, submitError, create, update } = useMasterMutation("/api/daily-entries");

  // Master lists
  const { data: parties } = useMasterList<MasterParty>({ endpoint: "/api/parties" });
  const { data: companies } = useMasterList<MasterCompany>({ endpoint: "/api/companies" });
  const { data: trucks } = useMasterList<MasterTruck>({ endpoint: "/api/trucks" });
  const { data: locations } = useMasterList<MasterLocation>({ endpoint: "/api/locations" });

  // State
  const [showForm, setShowForm] = useState(false);
  const [q, setQ] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [partyId, setPartyId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [truckId, setTruckId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [suggestedSrNo, setSuggestedSrNo] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [detailEntry, setDetailEntry] = useState<DailyEntryRecord | null>(null);
  const [editEntry, setEditEntry] = useState<DailyEntryRecord | null>(null);

  // Fetch Next Sr No
  const fetchNextSrNo = useCallback(async () => {
    if (!currentFirm) return;
    try {
      const res = await api.get<{ nextSrNo: number }>("/api/daily-entries/next-sr-no");
      if (res && res.nextSrNo) {
        setSuggestedSrNo(res.nextSrNo);
      }
    } catch (err) {
      console.error("Failed to fetch next Sr No", err);
    }
  }, [currentFirm, api]);

  useEffect(() => {
    fetchNextSrNo();
  }, [fetchNextSrNo]);

  // Filtered entries list
  const filteredRows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return entries
      .filter((e) => (partyId ? e.partyId === partyId : true))
      .filter((e) => (companyId ? e.companyId === companyId : true))
      .filter((e) => (truckId ? e.truckId === truckId : true))
      .filter((e) => {
        if (!statusFilter) return true;
        if (statusFilter === "RECEIVED") return e.isReceived;
        if (statusFilter === "PENDING") return !e.isReceived;
        return true;
      })
      .filter((e) => (fromDate ? e.entryDate >= fromDate : true))
      .filter((e) => (toDate ? e.entryDate <= toDate : true))
      .filter((e) => {
        if (!needle) return true;
        const haystack = [
          e.srNo,
          e.lrNumber,
          e.truckNumber,
          e.truckNumberRaw,
          e.partyName,
          e.partyNameRaw,
          e.companyName,
          e.companyNameRaw,
          e.fromLocationName,
          e.fromLocationRaw,
          e.toLocationName,
          e.toLocationRaw,
          e.remarks,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      })
      .sort((a, b) => b.srNo - a.srNo);
  }, [entries, q, fromDate, toDate, partyId, companyId, truckId, statusFilter]);

  // Status Badge Toggle Handler
  async function handleStatusToggle(entry: DailyEntryRecord) {
    if (entry.isBilled) return; // Prevent toggle if billed
    try {
      const newStatus = !entry.isReceived;
      const ok = await update(entry.id, { isReceived: newStatus });
      if (ok) {
        setFeedback(`Entry #${entry.srNo} status updated to ${newStatus ? "RECEIVED (Billable)" : "PENDING (Unbillable)"}`);
        refresh();
      }
    } catch (err: any) {
      console.error("Failed to update status", err);
    }
  }

  // Create Submit
  async function handleCreateSubmit(payload: Record<string, any>) {
    const ok = await create(payload);
    if (ok) {
      setShowForm(false);
      setFeedback(`Daily trip entry #${payload.srNo} recorded successfully.`);
      fetchNextSrNo();
      refresh();
    }
  }

  // Edit Submit
  async function handleEditSubmit(id: string, payload: Record<string, any>) {
    const ok = await update(id, payload);
    if (ok) {
      setEditEntry(null);
      setFeedback(`Daily trip entry #${payload.srNo} updated successfully.`);
      refresh();
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header matching Lovable header */}
      <PageHeader
        eyebrow="Operations"
        title={
          <>
            Daily Book — <span className="text-coral">Roznamcha</span>
          </>
        }
        description="Manual operational entries. Values you type here are never auto-overwritten."
        actions={
          <Button
            variant="coral"
            onClick={() => setShowForm((v) => !v)}
            id="daily-book-new-entry"
            disabled={firmLoading || !currentFirm}
          >
            {showForm ? "Close entry form" : "＋ New trip"}
          </Button>
        }
      />

      {/* Success Feedback Banner */}
      {feedback && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <p className="text-xs font-semibold text-emerald-800">{feedback}</p>
          </div>
          <button onClick={() => setFeedback(null)} className="text-emerald-600 hover:text-emerald-900 text-xs">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Expandable New Trip Form Panel */}
      {showForm && (
        <Panel className="mb-6" title="New daily entry" subtitle="Fast entry — tab through the fields.">
          <DailyEntryForm
            initial={createInitialFormState(suggestedSrNo)}
            parties={parties}
            companies={companies}
            trucks={trucks}
            locations={locations}
            onSubmit={handleCreateSubmit}
            onCancel={() => setShowForm(false)}
            loading={submitting}
            error={submitError}
            submitLabel="Save entry"
          />
        </Panel>
      )}

      {/* Main Entries Section */}
      <Panel
        title="Entries"
        subtitle={`${filteredRows.length} of ${entries.length} trips shown`}
      >
        {/* Filter Toolbar matching Lovable filter grid */}
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 text-xs">
          <input
            className="form-input"
            placeholder="Search LR, route, truck, party…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <div className="flex gap-2">
            <input
              type="date"
              className="form-input flex-1"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              title="From Date"
            />
            <input
              type="date"
              className="form-input flex-1"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              title="To Date"
            />
          </div>

          <select className="form-input" value={partyId} onChange={(e) => setPartyId(e.target.value)}>
            <option value="">All parties</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <select className="form-input" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">All companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select className="form-input" value={truckId} onChange={(e) => setTruckId(e.target.value)}>
            <option value="">All trucks</option>
            {trucks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.truckNumber}
              </option>
            ))}
          </select>

          <select className="form-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Received & Pending</option>
            <option value="RECEIVED">Received — Billable</option>
            <option value="PENDING">Pending — Unbillable</option>
          </select>

          {(q || fromDate || toDate || partyId || companyId || truckId || statusFilter) && (
            <button
              onClick={() => {
                setQ("");
                setFromDate("");
                setToDate("");
                setPartyId("");
                setCompanyId("");
                setTruckId("");
                setStatusFilter("");
              }}
              className="text-xs text-coral hover:underline flex items-center gap-1 font-semibold"
            >
              <RotateCcw size={12} /> Reset Filters
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-[#7A7F85]">Loading daily entries...</div>
        ) : filteredRows.length === 0 ? (
          <EmptyState
            title="No entries match these filters"
            description="Clear a filter, or add today's first trip to the Daily Book."
            action={
              <Button variant="coral" onClick={() => setShowForm(true)}>
                ＋ New trip
              </Button>
            }
          />
        ) : (
          <>
            {/* Desktop Table matching Lovable TableShell */}
            <div className="hidden md:block overflow-x-auto">
              <TableShell>
                <thead>
                  <tr className="border-b border-[#D8D5CE] bg-[#FAF8F5] text-[11px] font-bold uppercase tracking-wider text-[#5F6368]">
                    <Th>Sr</Th>
                    <Th>Date</Th>
                    <Th>Truck</Th>
                    <Th>LR No</Th>
                    <Th>Route</Th>
                    <Th align="right">N-Wt</Th>
                    <Th align="right">R-Wt</Th>
                    <Th align="right">Shortage</Th>
                    <Th>Party (Billing)</Th>
                    <Th>Company (Site)</Th>
                    <Th align="right">Rate</Th>
                    <Th align="center">Status</Th>
                    <Th align="center">Action</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFECE6] text-xs">
                  {filteredRows.map((e) => {
                    const truckText = e.truckNumber || e.truckNumberRaw || "—";
                    const partyText = e.partyName || e.partyNameRaw || "—";
                    const companyText = e.companyName || e.companyNameRaw || "—";
                    const fromText = e.fromLocationName || e.fromLocationRaw || "—";
                    const toText = e.toLocationName || e.toLocationRaw || "—";

                    const nWt = e.nWeight !== null && e.nWeight !== undefined ? Number(e.nWeight) : 0;
                    const rWt = e.rWeight !== null && e.rWeight !== undefined ? Number(e.rWeight) : 0;
                    const shortage = Math.max(0, nWt - rWt);

                    return (
                      <tr key={e.id} className="hover:bg-[#FAF8F5] transition-colors">
                        <Td className="text-[#7A7F85] font-mono">{e.srNo}</Td>
                        <Td className="font-semibold text-[#1A1D20] whitespace-nowrap">{formatDate(e.entryDate)}</Td>
                        <Td className="font-bold text-[#1A1D20] font-mono">{truckText}</Td>
                        <Td className="font-mono text-[#5F6368]">{e.lrNumber || "—"}</Td>
                        <Td className="text-[#5F6368]">{fromText} → {toText}</Td>
                        <Td align="right" className="font-mono">{formatTons(e.nWeight)}</Td>
                        <Td align="right" className="font-mono">{formatTons(e.rWeight)}</Td>
                        <Td align="right" className="font-mono text-red-600">{shortage > 0 ? formatTons(shortage) : "—"}</Td>
                        <Td className="font-bold text-[#E05638]">{partyText}</Td>
                        <Td className="text-[#5F6368]">{companyText}</Td>
                        <Td align="right" className="font-mono font-bold text-emerald-700">{formatCurrency(e.customerRate ?? 0)}</Td>
                        <Td align="center">
                          <button
                            type="button"
                            onClick={() => handleStatusToggle(e)}
                            disabled={Boolean(e.isBilled)}
                            className="cursor-pointer hover:opacity-85 disabled:opacity-60 disabled:cursor-not-allowed"
                            title={e.isBilled ? "Status locked (Billed)" : "Click to toggle Received/Pending status"}
                          >
                            <StatusBadge status={e.isReceived ? "RECEIVED" : "PENDING"} />
                          </button>
                        </Td>
                        <Td align="center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setDetailEntry(e)}
                              className="rounded-full border border-[#D8D5CE] px-3 py-1 text-xs font-semibold text-[#1A1D20] hover:bg-[#1A1D20] hover:text-white transition-colors"
                            >
                              View
                            </button>
                            {e.isBilled ? (
                              <span className="p-1 text-amber-600" title={`Billed in Bill #${e.billNumber ?? ""}`}>
                                <Lock size={14} />
                              </span>
                            ) : (
                              <button
                                onClick={() => setEditEntry(e)}
                                className="rounded-full p-1 text-[#5F6368] hover:bg-[#FAF8F5] transition-colors"
                                title="Edit entry"
                              >
                                <Pencil size={14} />
                              </button>
                            )}
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableShell>
              <p className="mt-3 text-xs text-[#7A7F85]">
                Tip: click a status badge to toggle between Received (Billable) and Pending (Unbillable).
              </p>
            </div>

            {/* Mobile Cards Stack matching Lovable mobile layout */}
            <div className="grid gap-3 md:hidden">
              {filteredRows.map((e) => {
                const truckText = e.truckNumber || e.truckNumberRaw || "—";
                const partyText = e.partyName || e.partyNameRaw || "—";
                const companyText = e.companyName || e.companyNameRaw || "—";
                const fromText = e.fromLocationName || e.fromLocationRaw || "—";
                const toText = e.toLocationName || e.toLocationRaw || "—";

                return (
                  <button
                    key={e.id}
                    onClick={() => setDetailEntry(e)}
                    className="rounded-2xl border border-[#D8D5CE] bg-white p-4 text-left shadow-xs hover:border-[#9E9A91] transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-base font-bold text-[#1A1D20]">{truckText}</span>
                      <StatusBadge status={e.isReceived ? "RECEIVED" : "PENDING"} />
                    </div>
                    <div className="mt-1.5 text-xs text-[#5F6368]">
                      {formatDate(e.entryDate)} · {e.lrNumber ? `LR #${e.lrNumber}` : "No LR"} · {fromText} → {toText}
                    </div>
                    <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs border-t border-[#EFECE6] pt-2">
                      <span>N {formatTons(e.nWeight)}</span>
                      <span>R {formatTons(e.rWeight)}</span>
                      <span className="col-span-2 font-bold text-[#E05638]">{partyText}</span>
                      <span className="col-span-2 text-[#5F6368]">{companyText}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </Panel>

      {/* Trip Detail Modal Dialog */}
      {detailEntry && (
        <TripDetailModal entry={detailEntry} onClose={() => setDetailEntry(null)} />
      )}

      {/* Edit Entry Modal Dialog */}
      {editEntry && (
        <Modal
          open={Boolean(editEntry)}
          onClose={() => setEditEntry(null)}
          title={`Edit Daily Entry (Sr No #${editEntry.srNo})`}
          size="lg"
        >
          {editEntry.isBilled ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-2">
              <p className="font-bold flex items-center gap-1.5">
                <Lock size={14} className="text-amber-600" />
                Editing Locked (Billed Entry)
              </p>
              <p>
                This trip is already linked to Bill #{editEntry.billNumber ?? editEntry.billId}. Billed entries are locked to maintain accounting integrity.
              </p>
              <Button variant="secondary" size="sm" onClick={() => setEditEntry(null)}>
                Close
              </Button>
            </div>
          ) : (
            <DailyEntryForm
              initial={recordToFormState(editEntry)}
              parties={parties}
              companies={companies}
              trucks={trucks}
              locations={locations}
              onSubmit={(payload) => handleEditSubmit(editEntry.id, payload)}
              onCancel={() => setEditEntry(null)}
              loading={submitting}
              error={submitError}
              submitLabel="Save Changes"
            />
          )}
        </Modal>
      )}
    </div>
  );
}
