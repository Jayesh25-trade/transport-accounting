"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Info,
  SlidersHorizontal,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  Undo2,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button, Badge, EmptyState, Panel } from "@/components/ui/primitives";
import { TableShell, Th, Td } from "@/components/ui/data-table";
import { useMasterList, useMasterMutation } from "@/lib/use-master-list";
import { useFirm } from "@/lib/firm-context";
import { Modal, Field } from "@/components/ui/modal";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
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

  // Billing status
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

// ─── Formatting Helpers ────────────────────────────────────────
function formatNumber(val: number | string | null | undefined, decimals = 3): string {
  if (val === null || val === undefined || val === "") return "—";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "—";
  return num.toFixed(decimals);
}

function toTitleCase(str: string | null | undefined): string {
  if (!str) return "—";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

type SortField = "srNo" | "entryDate" | "truckNumber" | "lrNumber" | "partyName" | "nWeight" | "rWeight" | "shortage" | "customerRate" | "amount" | "isReceived";
type SortOrder = "asc" | "desc";

// ─── Status Badge Component (Single-line Pill) ────────────────
function StatusBadge({
  isReceived,
  isBilled,
  billNumber,
  onToggle,
}: {
  isReceived: boolean;
  isBilled?: boolean | null;
  billNumber?: number | null;
  onToggle?: () => void;
}) {
  if (isBilled) {
    return (
      <span
        tabIndex={0}
        aria-label={`Locked: Billed in Bill #${billNumber || ""}`}
        title={`Locked: Billed in Bill #${billNumber || ""}`}
        className="status-badge-pill bg-[#FAF8F5] text-[#5F6368] border border-[#D8D5CE] cursor-not-allowed opacity-90"
      >
        <Lock size={12} className="text-amber-700 shrink-0" />
        <span>{isReceived ? "Received" : "Pending"}</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle?.();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.stopPropagation();
          e.preventDefault();
          onToggle?.();
        }
      }}
      title={isReceived ? "Billable · Click to mark Pending" : "Unbillable · Click to mark Received"}
      aria-label={isReceived ? "Mark status as Pending" : "Mark status as Received"}
      className={cn(
        "status-badge-pill cursor-pointer hover:scale-[1.03] active:scale-[0.98]",
        isReceived
          ? "bg-emerald-50 text-emerald-800 border border-emerald-200/80 hover:bg-emerald-100/60"
          : "bg-amber-50 text-amber-800 border border-amber-200/80 hover:bg-amber-100/60"
      )}
    >
      <span
        className={cn(
          "size-2 rounded-full shrink-0",
          isReceived ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
        )}
      />
      <span>{isReceived ? "Received" : "Pending"}</span>
    </button>
  );
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
  submitLabel = "Save Trip",
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

  const finalSubmitLabel = submitLabel === "Save entry" ? "Save Trip" : submitLabel;

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-4 text-xs">
      {/* Row 1 */}
      <Field label="Sr No" required error={errors.srNo}>
        <input
          type="number"
          min="1"
          step="1"
          value={form.srNo}
          onChange={(e) => set("srNo", e.target.value)}
          placeholder="e.g. 1"
          className="form-input font-mono font-medium h-10 rounded-xl px-3 py-2 border border-[#D8D5CE] focus:outline-none focus:ring-2 focus:ring-[#E05638]/40 focus:border-[#E05638]"
          id="daily-form-srno"
        />
      </Field>

      <Field label="Date" required error={errors.entryDate}>
        <input
          type="date"
          value={form.entryDate}
          onChange={(e) => set("entryDate", e.target.value)}
          className="form-input h-10 rounded-xl px-3 py-2 border border-[#D8D5CE] focus:outline-none focus:ring-2 focus:ring-[#E05638]/40 focus:border-[#E05638]"
          id="daily-form-date"
        />
      </Field>

      <Field label="Truck No (select from list)">
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
          className="form-input h-10 rounded-xl px-3 py-2 border border-[#D8D5CE] font-normal text-[#1A1D20] focus:outline-none focus:ring-2 focus:ring-[#E05638]/40 focus:border-[#E05638]"
          id="daily-form-truck-select"
        >
          <option value="">Select truck</option>
          {trucks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.truckNumber}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Truck No (type manually)" hint="Use this if the truck is not in the list">
        <input
          type="text"
          value={form.truckNumberRaw}
          onChange={(e) => set("truckNumberRaw", e.target.value)}
          placeholder="e.g. MH06BW0111"
          className="form-input uppercase font-mono placeholder:normal-case h-10 rounded-xl px-3 py-2 border border-[#D8D5CE] focus:outline-none focus:ring-2 focus:ring-[#E05638]/40 focus:border-[#E05638]"
          id="daily-form-truck-raw"
        />
      </Field>

      {/* Row 2 */}
      <Field label="LR No" error={errors.lrNumber}>
        <input
          type="text"
          value={form.lrNumber}
          onChange={(e) => set("lrNumber", e.target.value)}
          placeholder="e.g. LR-9082"
          className="form-input font-mono h-10 rounded-xl px-3 py-2 border border-[#D8D5CE] focus:outline-none focus:ring-2 focus:ring-[#E05638]/40 focus:border-[#E05638]"
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
          className="form-input font-normal text-[#1A1D20] h-10 rounded-xl px-3 py-2 border border-[#D8D5CE] focus:outline-none focus:ring-2 focus:ring-[#E05638]/40 focus:border-[#E05638]"
          id="daily-form-party-select"
        >
          <option value="">Select billing customer</option>
          {parties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Party Name (type manually)" hint="Or type the customer name">
        <input
          type="text"
          value={form.partyNameRaw}
          onChange={(e) => set("partyNameRaw", e.target.value)}
          placeholder="e.g. Sample Traders"
          className="form-input font-sans h-10 rounded-xl px-3 py-2 border border-[#D8D5CE] focus:outline-none focus:ring-2 focus:ring-[#E05638]/40 focus:border-[#E05638]"
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
          className="form-input font-normal text-[#1A1D20] h-10 rounded-xl px-3 py-2 border border-[#D8D5CE] focus:outline-none focus:ring-2 focus:ring-[#E05638]/40 focus:border-[#E05638]"
          id="daily-form-company-select"
        >
          <option value="">Select loading company</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      {/* Row 3 */}
      <Field label="Company Name (type manually)" hint="Or type the company name">
        <input
          type="text"
          value={form.companyNameRaw}
          onChange={(e) => set("companyNameRaw", e.target.value)}
          placeholder="e.g. Sample Industries"
          className="form-input font-sans h-10 rounded-xl px-3 py-2 border border-[#D8D5CE] focus:outline-none focus:ring-2 focus:ring-[#E05638]/40 focus:border-[#E05638]"
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
          className="form-input font-normal text-[#1A1D20] h-10 rounded-xl px-3 py-2 border border-[#D8D5CE] focus:outline-none focus:ring-2 focus:ring-[#E05638]/40 focus:border-[#E05638]"
          id="daily-form-from-select"
        >
          <option value="">Select from location</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="From Location (type manually)">
        <input
          type="text"
          value={form.fromLocationRaw}
          onChange={(e) => set("fromLocationRaw", e.target.value)}
          placeholder="e.g. Mumbai Port"
          className="form-input font-sans h-10 rounded-xl px-3 py-2 border border-[#D8D5CE] focus:outline-none focus:ring-2 focus:ring-[#E05638]/40 focus:border-[#E05638]"
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
          className="form-input font-normal text-[#1A1D20] h-10 rounded-xl px-3 py-2 border border-[#D8D5CE] focus:outline-none focus:ring-2 focus:ring-[#E05638]/40 focus:border-[#E05638]"
          id="daily-form-to-select"
        >
          <option value="">Select to location</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </Field>

      {/* Row 4 */}
      <Field label="To Location (type manually)">
        <input
          type="text"
          value={form.toLocationRaw}
          onChange={(e) => set("toLocationRaw", e.target.value)}
          placeholder="e.g. Pune Factory"
          className="form-input font-sans h-10 rounded-xl px-3 py-2 border border-[#D8D5CE] focus:outline-none focus:ring-2 focus:ring-[#E05638]/40 focus:border-[#E05638]"
          id="daily-form-to-raw"
        />
      </Field>

      <Field label="N-Weight (T)" hint="Loaded / challan weight (T)" error={errors.nWeight}>
        <input
          type="number"
          step="0.001"
          min="0"
          value={form.nWeight}
          onChange={(e) => set("nWeight", e.target.value)}
          placeholder="e.g. 40.000"
          className="form-input font-mono font-medium h-10 rounded-xl px-3 py-2 border border-[#D8D5CE] focus:outline-none focus:ring-2 focus:ring-[#E05638]/40 focus:border-[#E05638]"
          id="daily-form-nweight"
        />
      </Field>

      <Field label="R-Weight (T)" hint="Weight received at unloading (T)" error={errors.rWeight}>
        <input
          type="number"
          step="0.001"
          min="0"
          value={form.rWeight}
          onChange={(e) => set("rWeight", e.target.value)}
          placeholder="e.g. 39.500"
          className="form-input font-mono font-medium h-10 rounded-xl px-3 py-2 border border-[#D8D5CE] focus:outline-none focus:ring-2 focus:ring-[#E05638]/40 focus:border-[#E05638]"
          id="daily-form-rweight"
        />
      </Field>

      <Field label="Customer Rate (₹)" error={errors.customerRate}>
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.customerRate}
          onChange={(e) => set("customerRate", e.target.value)}
          placeholder="e.g. 4500"
          className="form-input font-mono h-10 rounded-xl px-3 py-2 border border-[#D8D5CE] focus:outline-none focus:ring-2 focus:ring-[#E05638]/40 focus:border-[#E05638]"
          id="daily-form-custrate"
        />
      </Field>

      {/* Row 5 */}
      <Field label="Driver Rate (₹)" error={errors.rate}>
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.rate}
          onChange={(e) => set("rate", e.target.value)}
          placeholder="e.g. 4000"
          className="form-input font-mono h-10 rounded-xl px-3 py-2 border border-[#D8D5CE] focus:outline-none focus:ring-2 focus:ring-[#E05638]/40 focus:border-[#E05638]"
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
          className="form-input font-mono h-10 rounded-xl px-3 py-2 border border-[#D8D5CE] focus:outline-none focus:ring-2 focus:ring-[#E05638]/40 focus:border-[#E05638]"
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
          className="form-input font-mono h-10 rounded-xl px-3 py-2 border border-[#D8D5CE] focus:outline-none focus:ring-2 focus:ring-[#E05638]/40 focus:border-[#E05638]"
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
          className="form-input font-mono h-10 rounded-xl px-3 py-2 border border-[#D8D5CE] focus:outline-none focus:ring-2 focus:ring-[#E05638]/40 focus:border-[#E05638]"
          id="daily-form-diesel"
        />
      </Field>

      {/* Row 6 */}
      <Field label="A/c (₹)">
        <input
          type="number"
          step="1"
          min="0"
          value={form.ac}
          onChange={(e) => set("ac", e.target.value)}
          placeholder="0"
          className="form-input font-mono h-10 rounded-xl px-3 py-2 border border-[#D8D5CE] focus:outline-none focus:ring-2 focus:ring-[#E05638]/40 focus:border-[#E05638]"
          id="daily-form-ac"
        />
      </Field>

      <Field label="POCH Status" hint="Received = Billable · Pending = Unbillable">
        <select
          value={form.isReceived ? "RECEIVED" : "PENDING"}
          onChange={(e) => set("isReceived", e.target.value === "RECEIVED")}
          className="form-input font-normal text-[#1A1D20] h-10 rounded-xl px-3 py-2 border border-[#D8D5CE] focus:outline-none focus:ring-2 focus:ring-[#E05638]/40 focus:border-[#E05638]"
          id="daily-form-status"
        >
          <option value="PENDING">Pending — Unbillable</option>
          <option value="RECEIVED">Received — Billable</option>
        </select>
      </Field>

      <div className="xl:col-span-2">
        <Field label="Remarks">
          <input
            type="text"
            value={form.remarks}
            onChange={(e) => set("remarks", e.target.value)}
            placeholder="Optional note"
            className="form-input font-sans h-10 rounded-xl px-3 py-2 border border-[#D8D5CE] focus:outline-none focus:ring-2 focus:ring-[#E05638]/40 focus:border-[#E05638]"
            id="daily-form-remarks"
          />
        </Field>
      </div>

      {error && (
        <div className="md:col-span-2 xl:col-span-4 rounded-xl bg-red-50 border border-red-200 p-3">
          <p className="text-xs text-red-600 font-semibold">{error}</p>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2 md:col-span-2 xl:col-span-4">
        <Button type="submit" variant="primary" disabled={loading} className="h-10 px-6 rounded-xl font-semibold">
          {loading ? "Saving..." : finalSubmitLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading} className="h-10 px-6 rounded-xl border border-[#D8D5CE] bg-white text-[#1A1D20] hover:bg-[#FAF8F5]">
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ─── Trip Detail Modal ────────────────────────────────────────
function TripDetailModal({
  entry,
  onClose,
}: {
  entry: DailyEntryRecord;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const truckText = entry.truckNumber || entry.truckNumberRaw || "—";
  const partyText = entry.partyName || entry.partyNameRaw || "—";
  const companyText = entry.companyName || entry.companyNameRaw || "—";
  const fromText = toTitleCase(entry.fromLocationName || entry.fromLocationRaw);
  const toText = toTitleCase(entry.toLocationName || entry.toLocationRaw);

  const nWt = entry.nWeight !== null && entry.nWeight !== undefined ? Number(entry.nWeight) : 0;
  const rWt = entry.rWeight !== null && entry.rWeight !== undefined ? Number(entry.rWeight) : 0;
  const shortage = Math.max(0, nWt - rWt);
  const rate = entry.customerRate !== null && entry.customerRate !== undefined ? Number(entry.customerRate) : 0;
  const amount = rate * rWt;

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1D20]/60 p-4 backdrop-blur-xs overflow-y-auto animate-fade-in" onClick={onClose}>
      <div className="max-h-[calc(100vh-2rem)] sm:max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#D8D5CE] bg-white p-6 shadow-xl space-y-5 my-auto shrink-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-[#EFECE6] pb-4">
          <div>
            <div className="text-[11px] font-bold tracking-widest text-[#E05638] uppercase">
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
              <Lock size={14} className="text-amber-600 shrink-0" />
              Billed in Bill #{entry.billNumber ?? entry.billId} — Editing Locked
            </span>
            <Badge variant="warning">BILLED</Badge>
          </div>
        )}

        {/* Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl border border-[#D8D5CE] bg-white p-3.5 space-y-1">
            <span className="text-[10px] font-bold text-[#7A7F85] uppercase tracking-wider block">Billing Customer</span>
            <span className="font-bold text-[#1A1D20] text-sm block">{partyText}</span>
          </div>

          <div className="rounded-xl border border-[#D8D5CE] bg-white p-3.5 space-y-1">
            <span className="text-[10px] font-bold text-[#7A7F85] uppercase tracking-wider block">Loading Site Company</span>
            <span className="font-semibold text-[#5F6368] text-sm block">{companyText}</span>
          </div>

          <div className="rounded-xl border border-[#D8D5CE] bg-white p-3.5 space-y-1">
            <span className="text-[10px] font-bold text-[#7A7F85] uppercase tracking-wider block">N-Weight (Loaded)</span>
            <span className="font-mono font-bold text-[#1A1D20] text-sm block">{formatNumber(nWt)} T</span>
          </div>

          <div className="rounded-xl border border-[#D8D5CE] bg-white p-3.5 space-y-1">
            <span className="text-[10px] font-bold text-[#7A7F85] uppercase tracking-wider block">R-Weight (Unloaded)</span>
            <span className="font-mono font-bold text-[#1A1D20] text-sm block">{formatNumber(rWt)} T</span>
          </div>

          <div className="rounded-xl border border-[#D8D5CE] bg-white p-3.5 space-y-1">
            <span className="text-[10px] font-bold text-[#7A7F85] uppercase tracking-wider block">Shortage (N − R)</span>
            <span className={cn("font-mono font-bold text-sm block", shortage > 0 ? "text-red-600" : "text-[#7A7F85]")}>
              {shortage > 0 ? `${formatNumber(shortage)} T` : "—"}
            </span>
          </div>

          <div className="rounded-xl border border-[#D8D5CE] bg-white p-3.5 space-y-1">
            <span className="text-[10px] font-bold text-[#7A7F85] uppercase tracking-wider block">Customer Rate & Total Freight</span>
            <span className="font-mono font-bold text-[#1A1D20] text-sm block">
              {formatCurrency(rate)}/T · Total {formatCurrency(amount)}
            </span>
          </div>
        </div>

        {/* Operational Expenses */}
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
    </div>,
    document.body
  );
}

// ─── Main Daily Book Page Component ───────────────────────────
import { generateDailyBookExport, DailyBookExportRow } from "@/lib/daily-book-pdf";
import { Loader2, ChevronDown } from "lucide-react";

export default function DailyBookPage() {
  const { currentFirm, loading: firmLoading } = useFirm();
  const api = useApiClient();

  const { data: entries, loading, error, refresh } = useMasterList<DailyEntryRecord>({
    endpoint: "/api/daily-entries",
  });
  const { submitting, submitError, create, update, remove } = useMasterMutation("/api/daily-entries");

  // Master lists
  const { data: parties } = useMasterList<MasterParty>({ endpoint: "/api/parties" });
  const { data: companies } = useMasterList<MasterCompany>({ endpoint: "/api/companies" });
  const { data: trucks } = useMasterList<MasterTruck>({ endpoint: "/api/trucks" });
  const { data: locations } = useMasterList<MasterLocation>({ endpoint: "/api/locations" });

  // State Filters
  const [showForm, setShowForm] = useState(false);
  const [q, setQ] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [partyId, setPartyId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [truckId, setTruckId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Sorting state
  const [sortField, setSortField] = useState<SortField>("srNo");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Pagination state
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Toast & Undo Notification state
  const [toast, setToast] = useState<{
    message: string;
    entry: DailyEntryRecord;
    prevStatus: boolean;
  } | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Export / Print State & Toast
  const [isExporting, setIsExporting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [actionNotice, setActionNotice] = useState<{ message: string; isError?: boolean } | null>(null);

  const [suggestedSrNo, setSuggestedSrNo] = useState(1);
  const [detailEntry, setDetailEntry] = useState<DailyEntryRecord | null>(null);
  const [editEntry, setEditEntry] = useState<DailyEntryRecord | null>(null);
  const [deleteConfirmEntry, setDeleteConfirmEntry] = useState<DailyEntryRecord | null>(null);

  async function handleDeleteSubmit(entry: DailyEntryRecord) {
    if (entry.isBilled) return;
    const ok = await remove(entry.id);
    if (ok) {
      setDeleteConfirmEntry(null);
      showActionNotice(`Trip Sr No #${entry.srNo} deleted successfully.`);
      refresh();
    } else {
      showActionNotice("Failed to delete trip. Please try again.", true);
    }
  }

  // Close export menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function showActionNotice(message: string, isError = false) {
    setActionNotice({ message, isError });
    setTimeout(() => setActionNotice(null), 4000);
  }

  // Keyboard shortcut 'N' for New Trip
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        (e.key === "n" || e.key === "N") &&
        !["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement).tagName) &&
        !e.metaKey &&
        !e.ctrlKey
      ) {
        e.preventDefault();
        setShowForm((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [q, fromDate, toDate, partyId, companyId, truckId, statusFilter]);

  // Sort toggle handler
  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  }

  // Filtered & Sorted Entries
  const filteredRows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let result = entries
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
      });

    // Client-side Sort
    result.sort((a, b) => {
      let valA: any = a[sortField as keyof DailyEntryRecord];
      let valB: any = b[sortField as keyof DailyEntryRecord];

      if (sortField === "shortage") {
        valA = Math.max(0, (Number(a.nWeight) || 0) - (Number(a.rWeight) || 0));
        valB = Math.max(0, (Number(b.nWeight) || 0) - (Number(b.rWeight) || 0));
      } else if (sortField === "partyName") {
        valA = (a.partyName || a.partyNameRaw || "").toLowerCase();
        valB = (b.partyName || b.partyNameRaw || "").toLowerCase();
      } else if (sortField === "truckNumber") {
        valA = (a.truckNumber || a.truckNumberRaw || "").toLowerCase();
        valB = (b.truckNumber || b.truckNumberRaw || "").toLowerCase();
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [entries, q, fromDate, toDate, partyId, companyId, truckId, statusFilter, sortField, sortOrder]);

  // Paginated Rows
  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  // Totals for filtered rows
  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, e) => {
        const n = Number(e.nWeight) || 0;
        const r = Number(e.rWeight) || 0;
        const shortage = Math.max(0, n - r);
        const rate = Number(e.customerRate) || 0;
        const amount = rate * r;

        acc.totalN += n;
        acc.totalR += r;
        acc.totalShortage += shortage;
        acc.totalAmount += amount;
        return acc;
      },
      { totalN: 0, totalR: 0, totalShortage: 0, totalAmount: 0 }
    );
  }, [filteredRows]);

  // Status Toggle with Toast / Undo
  async function handleStatusToggle(entry: DailyEntryRecord) {
    if (entry.isBilled) return;
    const prevStatus = entry.isReceived;
    const newStatus = !prevStatus;

    const ok = await update(entry.id, { isReceived: newStatus });
    if (ok) {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);

      setToast({
        message: `Marked entry #${entry.srNo} as ${newStatus ? "Received" : "Pending"}.`,
        entry,
        prevStatus,
      });

      toastTimerRef.current = setTimeout(() => {
        setToast(null);
      }, 5000);

      refresh();
    }
  }

  // Undo status toggle action
  async function handleUndoToast() {
    if (!toast) return;
    const { entry, prevStatus } = toast;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(null);

    const ok = await update(entry.id, { isReceived: prevStatus });
    if (ok) {
      refresh();
    }
  }

  // Export & Print Handler
  async function handleExportAction(actionType: "download-pdf" | "print-pdf" | "download-excel") {
    if (filteredRows.length === 0) return;
    setExportMenuOpen(false);

    if (actionType === "print-pdf") {
      setIsPrinting(true);
    } else {
      setIsExporting(true);
    }

    try {
      const exportRows: DailyBookExportRow[] = filteredRows.map((e, index) => {
        const n = e.nWeight !== null && e.nWeight !== undefined ? Number(e.nWeight) : 0;
        const r = e.rWeight !== null && e.rWeight !== undefined ? Number(e.rWeight) : 0;
        const shortage = Math.max(0, n - r);
        const rate = e.customerRate !== null && e.customerRate !== undefined ? Number(e.customerRate) : 0;

        return {
          srNo: e.srNo ?? (index + 1),
          entryDate: e.entryDate ? e.entryDate.split("T")[0] : getTodayString(),
          truckNumber: e.truckNumber || e.truckNumberRaw || "—",
          lrNumber: e.lrNumber || "—",
          fromLocation: e.fromLocationName || e.fromLocationRaw || "—",
          toLocation: e.toLocationName || e.toLocationRaw || "—",
          nWeight: n,
          rWeight: r,
          shortage: shortage,
          partyName: e.partyName || e.partyNameRaw || "—",
          companyName: e.companyName || e.companyNameRaw || "—",
          rate: rate,
          isReceived: Boolean(e.isReceived),
        };
      });

      const partyObj = parties.find((p) => p.id === partyId);
      const companyObj = companies.find((c) => c.id === companyId);
      const truckObj = trucks.find((t) => t.id === truckId);

      await generateDailyBookExport({
        firmName: currentFirm?.name || "DEEPRAJ TRANSPORT",
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        partyFilterName: partyObj ? partyObj.name : undefined,
        companyFilterName: companyObj ? companyObj.name : undefined,
        truckFilterName: truckObj ? truckObj.truckNumber : undefined,
        statusFilterName: statusFilter || undefined,
        rows: exportRows,
        actionType: actionType,
      });

      if (actionType === "download-pdf") {
        showActionNotice("PDF downloaded");
      } else if (actionType === "download-excel") {
        showActionNotice("Excel downloaded");
      }
    } catch (err) {
      console.error("Export failed:", err);
      showActionNotice("Could not generate report. Please try again.", true);
    } finally {
      setIsExporting(false);
      setIsPrinting(false);
    }
  }

  // Submit Handlers
  async function handleCreateSubmit(payload: Record<string, any>) {
    const ok = await create(payload);
    if (ok) {
      setShowForm(false);
      fetchNextSrNo();
      refresh();
    }
  }

  async function handleEditSubmit(id: string, payload: Record<string, any>) {
    const ok = await update(id, payload);
    if (ok) {
      setEditEntry(null);
      refresh();
    }
  }

  return (
    <div className="space-y-5 animate-fade-in text-[#1A1D20]">
      {/* Page Header */}
      <PageHeader
        eyebrow="OPERATIONS"
        title={
          <>
            Daily Book — <span className="text-[#E05638]">Roznamcha</span>
          </>
        }
        description={
          <span className="flex items-center gap-1.5 text-xs text-[#5F6368]">
            <Info size={14} className="text-[#7A7F85] shrink-0" />
            Manual operational entries. Values typed here are never auto-overwritten.
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="coral"
              onClick={() => setShowForm((v) => !v)}
              id="daily-book-new-entry"
              disabled={firmLoading || !currentFirm}
              title="New Trip (Shortcut: N)"
              className="h-10 px-4 rounded-xl font-semibold shadow-xs transition-transform active:scale-98"
            >
              <Plus size={16} />
              {showForm ? "Close Form" : "+ New Trip"}
            </Button>
          </div>
        }
      />

      {/* Expandable New Trip Form Panel */}
      {showForm && (
        <Panel className="mb-5" title="New Daily Entry" subtitle="Fast entry — tab through fields.">
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
            submitLabel="Save Entry"
          />
        </Panel>
      )}

      {/* Main Entries Panel */}
      <div className="rounded-2xl border border-[#D8D5CE] bg-white p-4 sm:p-5 shadow-xs space-y-4">
        {/* Filter Controls Grid */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7 gap-3 items-end text-xs">
            {/* Search Input */}
            <div className="sm:col-span-2 md:col-span-1 2xl:col-span-1 space-y-1">
              <label className="text-[11px] font-semibold text-[#5F6368] uppercase tracking-wider block">Search</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A7F85]" />
                <input
                  className="form-input search-input h-10 rounded-xl text-sm border-[#D8D5CE] focus:border-[#E05638] focus:ring-2 focus:ring-[#E05638]/20"
                  placeholder="Search LR, route, truck, party…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>

            {/* From Date */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[#5F6368] uppercase tracking-wider block">From Date</label>
              <input
                type="date"
                className="form-input h-10 rounded-xl text-sm border-[#D8D5CE] focus:border-[#E05638] focus:ring-2 focus:ring-[#E05638]/20"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>

            {/* To Date */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[#5F6368] uppercase tracking-wider block">To Date</label>
              <input
                type="date"
                className="form-input h-10 rounded-xl text-sm border-[#D8D5CE] focus:border-[#E05638] focus:ring-2 focus:ring-[#E05638]/20"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>

            {/* Party Select */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[#5F6368] uppercase tracking-wider block">Party (Billing)</label>
              <select
                className="form-input h-10 rounded-xl text-sm border-[#D8D5CE] focus:border-[#E05638] focus:ring-2 focus:ring-[#E05638]/20"
                value={partyId}
                onChange={(e) => setPartyId(e.target.value)}
              >
                <option value="">All Parties</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Company Select */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[#5F6368] uppercase tracking-wider block">Company (Site)</label>
              <select
                className="form-input h-10 rounded-xl text-sm border-[#D8D5CE] focus:border-[#E05638] focus:ring-2 focus:ring-[#E05638]/20"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
              >
                <option value="">All Companies</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Truck Select */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[#5F6368] uppercase tracking-wider block">Truck</label>
              <select
                className="form-input h-10 rounded-xl text-sm border-[#D8D5CE] focus:border-[#E05638] focus:ring-2 focus:ring-[#E05638]/20"
                value={truckId}
                onChange={(e) => setTruckId(e.target.value)}
              >
                <option value="">All Trucks</option>
                {trucks.map((t) => (
                  <option key={t.id} value={t.id}>{t.truckNumber}</option>
                ))}
              </select>
            </div>

            {/* Status Select */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[#5F6368] uppercase tracking-wider block">Status</label>
              <select
                className="form-input h-10 rounded-xl text-sm border-[#D8D5CE] focus:border-[#E05638] focus:ring-2 focus:ring-[#E05638]/20"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="RECEIVED">Received</option>
                <option value="PENDING">Pending</option>
              </select>
            </div>
          </div>

          {/* Toolbar & Active Chips */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#EFECE6] text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-[#1A1D20] text-xs">
                Showing {filteredRows.length} of {entries.length} trips
              </span>

              {partyId && (
                <span className="inline-flex items-center gap-1 rounded-md bg-[#FAF8F5] border border-[#D8D5CE] px-2 py-0.5 text-[11px] font-medium text-[#1A1D20]">
                  Party: {parties.find((p) => p.id === partyId)?.name}
                  <button onClick={() => setPartyId("")} className="hover:text-[#E05638]"><X size={12} /></button>
                </span>
              )}

              {statusFilter && (
                <span className="inline-flex items-center gap-1 rounded-md bg-[#FAF8F5] border border-[#D8D5CE] px-2 py-0.5 text-[11px] font-medium text-[#1A1D20]">
                  Status: {statusFilter}
                  <button onClick={() => setStatusFilter("")} className="hover:text-[#E05638]"><X size={12} /></button>
                </span>
              )}

              {(q || fromDate || toDate || partyId || companyId || truckId || statusFilter) && (
                <button
                  onClick={() => {
                    setQ(""); setFromDate(""); setToDate(""); setPartyId(""); setCompanyId(""); setTruckId(""); setStatusFilter("");
                  }}
                  className="text-xs text-[#E05638] hover:underline flex items-center gap-1 font-semibold ml-2"
                >
                  <RotateCcw size={12} /> Reset Filters
                </button>
              )}
            </div>

            {/* Export & Print Toolbar Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Export Button & Menu */}
              <div className="relative" ref={exportMenuRef}>
                <button
                  type="button"
                  disabled={filteredRows.length === 0 || isExporting}
                  onClick={() => setExportMenuOpen((v) => !v)}
                  title={filteredRows.length === 0 ? "No trips to export" : "Export trips"}
                  aria-label="Export options menu"
                  aria-expanded={exportMenuOpen}
                  className="h-10 px-3.5 rounded-xl border border-[#D8D5CE] bg-white text-[#1A1D20] font-semibold text-xs hover:bg-[#FAF8F5] transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed outline-none focus-visible:ring-2 focus-visible:ring-[#E05638]"
                >
                  {isExporting ? (
                    <Loader2 size={14} className="animate-spin text-[#E05638]" />
                  ) : (
                    <Download size={14} className="text-[#5F6368]" />
                  )}
                  <span>{isExporting ? "Generating…" : "Export"}</span>
                  <ChevronDown size={13} className="text-[#7A7F85]" />
                </button>

                {exportMenuOpen && (
                  <div className="absolute right-0 mt-1 w-44 z-30 rounded-xl border border-[#D8D5CE] bg-white p-1.5 shadow-lg animate-fade-in text-xs font-medium text-[#1A1D20]">
                    <button
                      type="button"
                      onClick={() => handleExportAction("download-pdf")}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#FAF8F5] flex items-center gap-2 transition-colors"
                    >
                      <Download size={13} className="text-[#E05638]" />
                      Download PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportAction("download-excel")}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#FAF8F5] flex items-center gap-2 transition-colors"
                    >
                      <Download size={13} className="text-emerald-600" />
                      Download Excel (.xlsx)
                    </button>
                  </div>
                )}
              </div>

              {/* Print Button */}
              <button
                type="button"
                disabled={filteredRows.length === 0 || isPrinting}
                onClick={() => handleExportAction("print-pdf")}
                title={filteredRows.length === 0 ? "No trips to export" : "Print report"}
                aria-label="Print report"
                className="h-10 px-3.5 rounded-xl border border-[#D8D5CE] bg-white text-[#1A1D20] font-semibold text-xs hover:bg-[#FAF8F5] transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed outline-none focus-visible:ring-2 focus-visible:ring-[#E05638]"
              >
                {isPrinting ? (
                  <Loader2 size={14} className="animate-spin text-[#E05638]" />
                ) : (
                  <Printer size={14} className="text-[#5F6368]" />
                )}
                <span>{isPrinting ? "Printing…" : "Print"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Loading Skeleton */}
        {loading ? (
          <div className="space-y-2 py-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 w-full skeleton rounded-xl" />
            ))}
          </div>
        ) : filteredRows.length === 0 ? (
          <EmptyState
            title="No entries match these filters"
            description="Clear a filter, or add today's first trip to the Daily Book."
            action={
              <Button
                variant="coral"
                onClick={() => {
                  setQ(""); setFromDate(""); setToDate(""); setPartyId(""); setCompanyId(""); setTruckId(""); setStatusFilter("");
                }}
              >
                Clear Filters
              </Button>
            }
          />
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-[#D8D5CE] shadow-2xs scrollbar-thin">
              <table className="w-full border-collapse text-xs table-fixed min-w-[1610px]">
                <colgroup>
                  <col style={{ width: "50px" }} />
                  <col style={{ width: "120px" }} />
                  <col style={{ width: "130px" }} />
                  <col style={{ width: "110px" }} />
                  <col style={{ width: "200px" }} />
                  <col style={{ width: "90px" }} />
                  <col style={{ width: "90px" }} />
                  <col style={{ width: "110px" }} />
                  <col style={{ width: "170px" }} />
                  <col style={{ width: "170px" }} />
                  <col style={{ width: "110px" }} />
                  <col style={{ width: "120px" }} />
                  <col style={{ width: "130px" }} />
                </colgroup>
                <thead>
                  <tr className="sticky top-0 z-10 border-b border-[#D8D5CE] bg-[#FAF8F5] text-[11px] font-semibold uppercase tracking-[0.04em] text-[#5F6368] select-none h-11">
                    <th className="px-3 py-3 text-center whitespace-nowrap overflow-hidden text-ellipsis">
                      <button onClick={() => handleSort("srNo")} className="group flex items-center justify-center gap-1 mx-auto hover:text-[#1A1D20] outline-none">
                        SR {sortField === "srNo" ? (sortOrder === "asc" ? <ArrowUp size={12} className="text-[#E05638]" /> : <ArrowDown size={12} className="text-[#E05638]" />) : <ArrowUpDown size={11} className="opacity-0 group-hover:opacity-60 transition-opacity" />}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-left whitespace-nowrap overflow-hidden text-ellipsis">
                      <button onClick={() => handleSort("entryDate")} className="group flex items-center gap-1 hover:text-[#1A1D20] outline-none">
                        DATE {sortField === "entryDate" ? (sortOrder === "asc" ? <ArrowUp size={12} className="text-[#E05638]" /> : <ArrowDown size={12} className="text-[#E05638]" />) : <ArrowUpDown size={11} className="opacity-0 group-hover:opacity-60 transition-opacity" />}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-left whitespace-nowrap overflow-hidden text-ellipsis">
                      <button onClick={() => handleSort("truckNumber")} className="group flex items-center gap-1 hover:text-[#1A1D20] outline-none">
                        TRUCK {sortField === "truckNumber" ? (sortOrder === "asc" ? <ArrowUp size={12} className="text-[#E05638]" /> : <ArrowDown size={12} className="text-[#E05638]" />) : <ArrowUpDown size={11} className="opacity-0 group-hover:opacity-60 transition-opacity" />}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-left whitespace-nowrap overflow-hidden text-ellipsis">
                      <button onClick={() => handleSort("lrNumber")} className="group flex items-center gap-1 hover:text-[#1A1D20] outline-none">
                        LR NO {sortField === "lrNumber" ? (sortOrder === "asc" ? <ArrowUp size={12} className="text-[#E05638]" /> : <ArrowDown size={12} className="text-[#E05638]" />) : <ArrowUpDown size={11} className="opacity-0 group-hover:opacity-60 transition-opacity" />}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-left whitespace-nowrap overflow-hidden text-ellipsis">ROUTE</th>
                    <th className="px-3 py-3 text-right whitespace-nowrap overflow-hidden text-ellipsis">
                      <button onClick={() => handleSort("nWeight")} className="group flex items-center justify-end gap-1 ml-auto hover:text-[#1A1D20] outline-none">
                        N-WT (T) {sortField === "nWeight" ? (sortOrder === "asc" ? <ArrowUp size={12} className="text-[#E05638]" /> : <ArrowDown size={12} className="text-[#E05638]" />) : <ArrowUpDown size={11} className="opacity-0 group-hover:opacity-60 transition-opacity" />}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-right whitespace-nowrap overflow-hidden text-ellipsis">
                      <button onClick={() => handleSort("rWeight")} className="group flex items-center justify-end gap-1 ml-auto hover:text-[#1A1D20] outline-none">
                        R-WT (T) {sortField === "rWeight" ? (sortOrder === "asc" ? <ArrowUp size={12} className="text-[#E05638]" /> : <ArrowDown size={12} className="text-[#E05638]" />) : <ArrowUpDown size={11} className="opacity-0 group-hover:opacity-60 transition-opacity" />}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-right whitespace-nowrap overflow-hidden text-ellipsis">
                      <button onClick={() => handleSort("shortage")} className="group flex items-center justify-end gap-1 ml-auto hover:text-[#1A1D20] outline-none">
                        SHORTAGE (T) {sortField === "shortage" ? (sortOrder === "asc" ? <ArrowUp size={12} className="text-[#E05638]" /> : <ArrowDown size={12} className="text-[#E05638]" />) : <ArrowUpDown size={11} className="opacity-0 group-hover:opacity-60 transition-opacity" />}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-left whitespace-nowrap overflow-hidden text-ellipsis">
                      <button onClick={() => handleSort("partyName")} className="group flex items-center gap-1 hover:text-[#1A1D20] outline-none">
                        PARTY (BILLING) {sortField === "partyName" ? (sortOrder === "asc" ? <ArrowUp size={12} className="text-[#E05638]" /> : <ArrowDown size={12} className="text-[#E05638]" />) : <ArrowUpDown size={11} className="opacity-0 group-hover:opacity-60 transition-opacity" />}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-left whitespace-nowrap overflow-hidden text-ellipsis">COMPANY (SITE)</th>
                    <th className="px-3 py-3 text-right whitespace-nowrap overflow-hidden text-ellipsis">
                      <button onClick={() => handleSort("customerRate")} className="group flex items-center justify-end gap-1 ml-auto hover:text-[#1A1D20] outline-none">
                        RATE (₹/T) {sortField === "customerRate" ? (sortOrder === "asc" ? <ArrowUp size={12} className="text-[#E05638]" /> : <ArrowDown size={12} className="text-[#E05638]" />) : <ArrowUpDown size={11} className="opacity-0 group-hover:opacity-60 transition-opacity" />}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-center whitespace-nowrap overflow-hidden text-ellipsis">
                      <button onClick={() => handleSort("isReceived")} className="group flex items-center justify-center gap-1 mx-auto hover:text-[#1A1D20] outline-none">
                        STATUS {sortField === "isReceived" ? (sortOrder === "asc" ? <ArrowUp size={12} className="text-[#E05638]" /> : <ArrowDown size={12} className="text-[#E05638]" />) : <ArrowUpDown size={11} className="opacity-0 group-hover:opacity-60 transition-opacity" />}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-center whitespace-nowrap overflow-hidden text-ellipsis">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFECE6] text-xs">
                  {paginatedRows.map((e) => {
                    const truckText = e.truckNumber || e.truckNumberRaw || "—";
                    const partyText = e.partyName || e.partyNameRaw || "—";
                    const companyText = e.companyName || e.companyNameRaw || "—";
                    const fromText = e.fromLocationName || e.fromLocationRaw || "—";
                    const toText = e.toLocationName || e.toLocationRaw || "—";

                    const nWt = e.nWeight !== null && e.nWeight !== undefined ? Number(e.nWeight) : 0;
                    const rWt = e.rWeight !== null && e.rWeight !== undefined ? Number(e.rWeight) : 0;
                    const shortage = Math.max(0, nWt - rWt);
                    const shortagePct = nWt > 0 ? (shortage / nWt) * 100 : 0;
                    const rate = e.customerRate !== null && e.customerRate !== undefined ? Number(e.customerRate) : 0;

                    return (
                      <tr
                        key={e.id}
                        onClick={() => setDetailEntry(e)}
                        className="hover:bg-[#FAF8F5] transition-colors cursor-pointer even:bg-[#FAF8F5]/30 h-[64px] border-b border-[#EFECE6]"
                      >
                        <td className="px-3 py-3 text-center font-mono text-[#7A7F85] text-xs align-middle">{e.srNo}</td>
                        <td className="px-3 py-3 text-left font-normal text-xs text-[#1A1D20] whitespace-nowrap align-middle">{formatDate(e.entryDate)}</td>
                        <td className="px-3 py-3 text-left font-mono text-xs font-normal text-[#1A1D20] whitespace-nowrap align-middle">{truckText}</td>
                        <td className="px-3 py-3 text-left font-mono text-xs font-normal text-[#1A1D20] whitespace-nowrap align-middle">{e.lrNumber || "—"}</td>
                        <td className="px-3 py-3 text-left align-middle" title={`${fromText} → ${toText}`}>
                          <div className="truncate font-medium text-xs text-[#1A1D20]">{fromText}</div>
                          <div className="truncate text-[11px] text-[#7A7F85]">→ {toText}</div>
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-xs font-normal text-[#1A1D20] whitespace-nowrap align-middle">{formatNumber(e.nWeight)}</td>
                        <td className="px-3 py-3 text-right font-mono text-xs font-normal text-[#1A1D20] whitespace-nowrap align-middle">{formatNumber(e.rWeight)}</td>
                        <td className="px-3 py-3 text-right font-mono text-xs whitespace-nowrap align-middle">
                          {shortage > 0 ? (
                            <div>
                              <span className="text-red-600 font-semibold">{formatNumber(shortage)}</span>
                              <div className="text-[10px] text-[#7A7F85] font-sans font-medium">{shortagePct.toFixed(1)}%</div>
                            </div>
                          ) : (
                            <span className="text-[#7A7F85]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-left font-medium text-xs text-[#1A1D20] whitespace-nowrap truncate align-middle" title={partyText}>
                          {e.partyId ? (
                            <Link
                              href={`/ledger?partyId=${e.partyId}`}
                              onClick={(event) => event.stopPropagation()}
                              className="hover:underline hover:text-[#E05638]"
                              title="View Party Ledger"
                            >
                              {partyText}
                            </Link>
                          ) : (
                            partyText
                          )}
                        </td>
                        <td className="px-3 py-3 text-left text-[#5F6368] text-xs font-normal whitespace-nowrap truncate align-middle" title={companyText}>
                          {companyText}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-xs font-medium text-[#1A1D20] whitespace-nowrap align-middle">
                          {formatCurrency(rate)}
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap align-middle">
                          <StatusBadge
                            isReceived={e.isReceived}
                            isBilled={e.isBilled}
                            billNumber={e.billNumber}
                            onToggle={() => handleStatusToggle(e)}
                          />
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap align-middle" onClick={(event) => event.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setDetailEntry(e)}
                              className="btn btn-secondary text-xs h-8 px-2.5 font-semibold rounded-lg border border-[#D8D5CE] hover:bg-[#FAF8F5] transition-colors"
                              aria-label={`View entry #${e.srNo}`}
                            >
                              View
                            </button>
                            {e.isBilled ? (
                              <span
                                className="size-8 flex items-center justify-center rounded-lg bg-amber-50/80 text-amber-700 border border-amber-200/60 cursor-not-allowed"
                                title={`Locked: Billed in Bill #${e.billNumber || ""}`}
                                aria-label="Locked: already billed"
                              >
                                <Lock size={16} />
                              </span>
                            ) : (
                              <>
                                <button
                                  onClick={() => setEditEntry(e)}
                                  className="size-8 flex items-center justify-center rounded-lg text-[#5F6368] hover:bg-[#EFECE6] hover:text-[#1A1D20] transition-colors"
                                  title="Edit trip"
                                  aria-label="Edit trip"
                                >
                                  <Pencil size={16} />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmEntry(e)}
                                  className="size-8 flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                                  title="Delete trip"
                                  aria-label="Delete trip"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Totals Footer Row */}
                <tfoot>
                  <tr className="border-t-2 border-[#D8D5CE] bg-[#FAF8F5] font-bold text-xs text-[#1A1D20] h-14">
                    <td className="px-3 py-3 align-middle" />
                    <td colSpan={4} className="px-3 py-3 text-left uppercase tracking-wider text-[11px] font-bold text-[#1A1D20] align-middle">
                      TOTAL ({filteredRows.length} TRIPS)
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-sm font-bold text-[#1A1D20] align-middle">
                      {totals.totalN.toFixed(3)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-sm font-bold text-[#1A1D20] align-middle">
                      {totals.totalR.toFixed(3)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-sm font-bold text-red-600 align-middle">
                      {totals.totalShortage > 0 ? totals.totalShortage.toFixed(3) : "—"}
                    </td>
                    <td className="px-3 py-3 align-middle" />
                    <td className="px-3 py-3 align-middle" />
                    <td className="px-3 py-3 align-middle" />
                    <td className="px-3 py-3 align-middle" />
                    <td className="px-3 py-3 align-middle" />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 text-xs text-[#5F6368]">
              <div className="flex items-center gap-2 whitespace-nowrap">
                <span className="font-medium text-[#5F6368]">Page size:</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                  className="form-input py-1 px-2.5 h-8 text-xs rounded-lg border-[#D8D5CE] focus:border-[#E05638] focus:ring-2 focus:ring-[#E05638]/20 focus:outline-none"
                >
                  <option value={10}>10 per page</option>
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                </select>
              </div>

              <div className="flex items-center gap-3 font-medium whitespace-nowrap">
                <span>Page {currentPage} of {totalPages}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="btn btn-secondary size-8 p-0 rounded-lg border border-[#D8D5CE] flex items-center justify-center disabled:opacity-40"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="btn btn-secondary size-8 p-0 rounded-lg border border-[#D8D5CE] flex items-center justify-center disabled:opacity-40"
                    aria-label="Next page"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile Card List View (<768px) */}
            <div className="grid gap-3 md:hidden">
              {paginatedRows.map((e) => {
                const truckText = e.truckNumber || e.truckNumberRaw || "—";
                const partyText = e.partyName || e.partyNameRaw || "—";
                const companyText = e.companyName || e.companyNameRaw || "—";
                const fromText = e.fromLocationName || e.fromLocationRaw || "—";
                const toText = e.toLocationName || e.toLocationRaw || "—";

                const nWt = e.nWeight !== null && e.nWeight !== undefined ? Number(e.nWeight) : 0;
                const rWt = e.rWeight !== null && e.rWeight !== undefined ? Number(e.rWeight) : 0;
                const shortage = Math.max(0, nWt - rWt);
                const rate = Number(e.customerRate) || 0;
                const amount = rate * rWt;

                return (
                  <div
                    key={e.id}
                    onClick={() => setDetailEntry(e)}
                    className="rounded-2xl border border-[#D8D5CE] bg-white p-4 text-left shadow-xs hover:border-[#9E9A91] transition-all space-y-2 cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-bold text-[#1A1D20]">
                        #{e.srNo} · {truckText}
                      </span>
                      <StatusBadge
                        isReceived={e.isReceived}
                        isBilled={e.isBilled}
                        billNumber={e.billNumber}
                        onToggle={() => handleStatusToggle(e)}
                      />
                    </div>

                    <div className="text-xs text-[#5F6368]">
                      {formatDate(e.entryDate)} · {e.lrNumber ? `LR #${e.lrNumber}` : "No LR"} · {fromText} → {toText}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs border-t border-[#EFECE6] pt-2">
                      <div><span className="text-[#7A7F85]">N-WT:</span> <span className="font-mono font-medium">{formatNumber(nWt)} T</span></div>
                      <div><span className="text-[#7A7F85]">R-WT:</span> <span className="font-mono font-medium">{formatNumber(rWt)} T</span></div>
                      <div><span className="text-[#7A7F85]">Shortage:</span> <span className={cn("font-mono font-medium", shortage > 0 ? "text-red-600" : "text-[#7A7F85]")}>{shortage > 0 ? `${formatNumber(shortage)} T` : "—"}</span></div>
                      <div><span className="text-[#7A7F85]">Rate:</span> <span className="font-mono font-medium text-[#1A1D20]">{formatCurrency(rate)}</span></div>
                      <div className="col-span-2 flex items-center justify-between">
                        <div><span className="text-[#7A7F85]">Party:</span> <span className="font-medium text-[#1A1D20]">{partyText}</span></div>
                        {!e.isBilled && (
                          <div className="flex items-center gap-2" onClick={(evt) => evt.stopPropagation()}>
                            <button
                              onClick={() => setEditEntry(e)}
                              className="text-xs text-[#5F6368] hover:text-[#1A1D20] flex items-center gap-1 font-medium"
                            >
                              <Pencil size={12} /> Edit
                            </button>
                            <button
                              onClick={() => setDeleteConfirmEntry(e)}
                              className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1 font-medium"
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Action Notification Toast (PDF / Excel / Error) */}
      {actionNotice && (
        <div className={cn(
          "fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-xl px-4 py-3 text-xs text-white shadow-2xl animate-fade-in font-medium",
          actionNotice.isError ? "bg-red-600" : "bg-[#1A1D20]"
        )}>
          <span>{actionNotice.message}</span>
        </div>
      )}

      {/* Floating Status Toast Notification with Undo */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-xl border border-[#1A1D20] bg-[#1A1D20] px-4 py-3 text-xs text-white shadow-2xl animate-fade-in font-medium">
          <span>{toast.message}</span>
          <button
            onClick={handleUndoToast}
            className="flex items-center gap-1 font-bold text-[#E05638] hover:underline ml-2"
          >
            <Undo2 size={13} /> Undo
          </button>
        </div>
      )}

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
                This trip is linked to Bill #{editEntry.billNumber ?? editEntry.billId}. Billed entries are locked to maintain accounting integrity.
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

      {/* Delete Confirmation Modal Dialog */}
      {deleteConfirmEntry && (
        <Modal
          open={Boolean(deleteConfirmEntry)}
          onClose={() => setDeleteConfirmEntry(null)}
          title={`Delete Daily Entry (Sr No #${deleteConfirmEntry.srNo})`}
          size="sm"
        >
          <div className="space-y-4 text-xs">
            <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 text-red-800 flex items-start gap-3">
              <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-sm text-red-900">Are you sure you want to delete this trip?</p>
                <p className="text-xs text-red-700">
                  Trip Sr No #{deleteConfirmEntry.srNo} · {deleteConfirmEntry.truckNumber || deleteConfirmEntry.truckNumberRaw || "—"} {deleteConfirmEntry.lrNumber ? `· LR #${deleteConfirmEntry.lrNumber}` : ""}
                </p>
                <p className="text-[11px] text-red-600 font-medium pt-1">
                  This will remove the operational entry and its synchronized driver voucher. This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#EFECE6]">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDeleteConfirmEntry(null)}
                disabled={submitting}
                className="h-10 px-4 rounded-xl text-xs border border-[#D8D5CE]"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="coral"
                onClick={() => handleDeleteSubmit(deleteConfirmEntry)}
                disabled={submitting}
                className="h-10 px-5 rounded-xl text-xs bg-red-600 hover:bg-red-700 text-white font-semibold shadow-xs"
              >
                {submitting ? "Deleting…" : "Delete Trip"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

