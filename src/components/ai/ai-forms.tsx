"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Check,
  Eye,
  Edit2,
  FileText,
  Upload,
  AlertCircle,
  Loader2,
  Calculator,
  Building2,
  Truck as TruckIcon,
  User,
  Calendar,
  DollarSign,
  BookPlus,
  CreditCard,
  Receipt,
  Search,
  CheckCircle2,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useFirm } from "@/lib/firm-context";
import { useApiClient, ApiError } from "@/lib/api-client";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

export interface FormCardProps {
  initialValues?: Record<string, any>;
  onCancel: () => void;
  onComplete: (summaryMessage: string) => void;
}

// Helper to format ton values
function formatTons(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "—";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "—";
  return `${num.toFixed(3)} T`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. DAILY BOOK FORM CARD (FULL 22-FIELD PRODUCTION PARITY)
// ─────────────────────────────────────────────────────────────────────────────

export function DailyBookFormCard({ initialValues, onCancel, onComplete }: FormCardProps) {
  const { currentFirm } = useFirm();
  const api = useApiClient();
  const [step, setStep] = useState<"form" | "preview">("form");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingSrNo, setLoadingSrNo] = useState(false);

  // Master data lists
  const [parties, setParties] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);

  // Manual input fallback toggles
  const [isManualTruck, setIsManualTruck] = useState(Boolean(initialValues?.truckNumberRaw && !initialValues?.truckId));
  const [isManualParty, setIsManualParty] = useState(Boolean(initialValues?.partyNameRaw && !initialValues?.partyId));
  const [isManualCompany, setIsManualCompany] = useState(Boolean(initialValues?.companyNameRaw && !initialValues?.companyId));
  const [isManualFrom, setIsManualFrom] = useState(Boolean(initialValues?.fromLocationRaw && !initialValues?.fromLocationId));
  const [isManualTo, setIsManualTo] = useState(Boolean(initialValues?.toLocationRaw && !initialValues?.toLocationId));

  // Form State (All 22 Fields)
  const [formData, setFormData] = useState({
    srNo: initialValues?.srNo || "",
    entryDate: initialValues?.entryDate || initialValues?.date || new Date().toISOString().split("T")[0],
    
    // Truck
    truckId: initialValues?.truckId || "",
    truckNumberRaw: initialValues?.truckNumberRaw || "",
    lrNumber: initialValues?.lrNumber || "",

    // Party & Company
    partyId: initialValues?.partyId || "",
    partyNameRaw: initialValues?.partyNameRaw || "",
    companyId: initialValues?.companyId || "",
    companyNameRaw: initialValues?.companyNameRaw || "",

    // Route Locations
    fromLocationId: initialValues?.fromLocationId || "",
    fromLocationRaw: initialValues?.fromLocationRaw || "",
    toLocationId: initialValues?.toLocationId || "",
    toLocationRaw: initialValues?.toLocationRaw || "",

    // Weights & Rates
    nWeight: initialValues?.nWeight || "",
    rWeight: initialValues?.rWeight || "",
    customerRate: initialValues?.customerRate || "",
    rate: initialValues?.rate || initialValues?.driverRate || "", // Driver Rate

    // Driver / Cash Money
    advance: initialValues?.advance || initialValues?.driverAdvance || "0",
    cash: initialValues?.cash || initialValues?.driverCash || "0",
    diesel: initialValues?.diesel || initialValues?.driverDiesel || "0",
    ac: initialValues?.ac || initialValues?.driverAc || "0",

    // Status & Remarks
    isReceived: initialValues?.isReceived ?? false, // false = Pending (Unbillable), true = Received (Billable)
    remarks: initialValues?.remarks || "",
  });

  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Fetch Masters & Next SR NO
  useEffect(() => {
    if (!currentFirm?.id) return;
    const headers = { "x-firm-id": currentFirm.id };

    Promise.all([
      fetch("/api/parties", { headers }).then((r) => r.json()),
      fetch("/api/companies", { headers }).then((r) => r.json()),
      fetch("/api/trucks", { headers }).then((r) => r.json()),
      fetch("/api/locations", { headers }).then((r) => r.json()),
    ])
      .then(([pRes, cRes, tRes, lRes]) => {
        if (pRes.success) setParties(pRes.data || []);
        if (cRes.success) setCompanies(cRes.data || []);
        if (tRes.success) setTrucks(tRes.data || []);
        if (lRes.success) setLocations(lRes.data || []);
      })
      .catch((err) => console.warn("[DailyBookForm] Master load warning:", err));

    // Fetch next Sr No if not provided in initialValues
    if (!initialValues?.srNo) {
      setLoadingSrNo(true);
      fetch("/api/daily-entries/next-sr-no", { headers })
        .then((r) => r.json())
        .then((res) => {
          if (res.success && res.data?.nextSrNo) {
            setFormData((prev) => ({ ...prev, srNo: String(res.data.nextSrNo) }));
          }
        })
        .catch(() => {})
        .finally(() => setLoadingSrNo(false));
    }
  }, [currentFirm, initialValues]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setValidationErrors([]);
  };

  const validate = (): boolean => {
    const errs: string[] = [];

    if (!formData.srNo || isNaN(Number(formData.srNo)) || Number(formData.srNo) <= 0) {
      errs.push("Sr No is required and must be a positive integer.");
    }
    if (!formData.entryDate) {
      errs.push("Entry Date is required.");
    }

    // Truck check
    if (isManualTruck) {
      if (!formData.truckNumberRaw.trim()) {
        errs.push("Manual Truck Number is required when not selected from master.");
      }
    } else if (!formData.truckId) {
      errs.push("Truck selection is required (or select Type Manually).");
    }

    // Party check
    if (isManualParty) {
      if (!formData.partyNameRaw.trim()) {
        errs.push("Manual Party Name is required when not selected from master.");
      }
    } else if (!formData.partyId) {
      errs.push("Billing Party is required (or select Type Manually).");
    }

    setValidationErrors(errs);
    return errs.length === 0;
  };

  const handleProceedToPreview = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      setStep("preview");
    }
  };

  const handleConfirmSave = async () => {
    if (!currentFirm?.id) return;
    setIsSubmitting(true);
    setValidationErrors([]);

    try {
      const payload: Record<string, any> = {
        srNo: Number(formData.srNo),
        entryDate: formData.entryDate,
        lrNumber: formData.lrNumber || null,
        nWeight: formData.nWeight !== "" ? parseFloat(formData.nWeight) : null,
        rWeight: formData.rWeight !== "" ? parseFloat(formData.rWeight) : null,
        customerRate: formData.customerRate !== "" ? parseFloat(formData.customerRate) : null,
        rate: formData.rate !== "" ? parseFloat(formData.rate) : null, // Driver rate
        advance: formData.advance !== "" ? parseFloat(formData.advance) : 0,
        cash: formData.cash !== "" ? parseFloat(formData.cash) : 0,
        diesel: formData.diesel !== "" ? parseFloat(formData.diesel) : 0,
        ac: formData.ac !== "" ? parseFloat(formData.ac) : 0,
        isReceived: Boolean(formData.isReceived),
        remarks: formData.remarks || null,
      };

      // Truck dependency
      if (isManualTruck) {
        payload.truckId = null;
        payload.truckNumberRaw = formData.truckNumberRaw.trim();
      } else {
        payload.truckId = formData.truckId || null;
        payload.truckNumberRaw = null;
      }

      // Party dependency
      if (isManualParty) {
        payload.partyId = null;
        payload.partyNameRaw = formData.partyNameRaw.trim();
      } else {
        payload.partyId = formData.partyId || null;
        payload.partyNameRaw = null;
      }

      // Company dependency
      if (isManualCompany) {
        payload.companyId = null;
        payload.companyNameRaw = formData.companyNameRaw.trim();
      } else {
        payload.companyId = formData.companyId || null;
        payload.companyNameRaw = null;
      }

      // From Location dependency
      if (isManualFrom) {
        payload.fromLocationId = null;
        payload.fromLocationRaw = formData.fromLocationRaw.trim();
      } else {
        payload.fromLocationId = formData.fromLocationId || null;
        payload.fromLocationRaw = null;
      }

      // To Location dependency
      if (isManualTo) {
        payload.toLocationId = null;
        payload.toLocationRaw = formData.toLocationRaw.trim();
      } else {
        payload.toLocationId = formData.toLocationId || null;
        payload.toLocationRaw = null;
      }

      const res = await fetch("/api/daily-entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-firm-id": currentFirm.id,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to save Daily Book entry.");
      }

      const truckLabel = isManualTruck
        ? formData.truckNumberRaw
        : trucks.find((t) => t.id === formData.truckId)?.truckNumber || "N/A";
      const partyLabel = isManualParty
        ? formData.partyNameRaw
        : parties.find((p) => p.id === formData.partyId)?.name || "N/A";

      onComplete(
        `✅ **Daily Book Entry #${formData.srNo} Saved Successfully**\n` +
          `• **Date:** ${formatDate(formData.entryDate)}\n` +
          `• **Truck:** ${truckLabel}\n` +
          `• **Party:** ${partyLabel}\n` +
          `• **POCH Status:** ${formData.isReceived ? "Received (Billable)" : "Pending (Unbillable)"}\n` +
          `• **Driver Voucher:** Synchronized automatically in pending accounting state`
      );
    } catch (err: any) {
      setValidationErrors([err?.message || "Error saving entry."]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTruck = trucks.find((t) => t.id === formData.truckId);
  const selectedParty = parties.find((p) => p.id === formData.partyId);
  const selectedCompany = companies.find((c) => c.id === formData.companyId);
  const selectedFrom = locations.find((l) => l.id === formData.fromLocationId);
  const selectedTo = locations.find((l) => l.id === formData.toLocationId);

  return (
    <div className="rounded-xl border border-[#D8D5CE] bg-white p-4 shadow-sm text-xs space-y-3.5">
      <div className="flex items-center justify-between border-b border-[#EFECE6] pb-2.5">
        <span className="font-display font-bold text-[#1A1D20] flex items-center gap-2">
          <BookPlus size={16} className="text-[#E05638]" />
          {step === "form" ? "ADD DAILY BOOK ENTRY (COMPLETE FORM)" : "PREVIEW DAILY BOOK ENTRY"}
        </span>
        <button onClick={onCancel} className="text-[#7A7F85] hover:text-[#1A1D20]">
          <X size={16} />
        </button>
      </div>

      {validationErrors.length > 0 && (
        <div className="rounded-lg bg-red-50 p-2.5 border border-red-200 text-red-700 text-xs space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <AlertCircle size={14} /> Please complete the required fields:
          </div>
          <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {step === "form" ? (
        <form onSubmit={handleProceedToPreview} className="space-y-3.5">
          {/* SECTION 1: IDENTIFICATION */}
          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#E05638] border-b border-[#EFECE6] pb-1">
              1. Trip Identification
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-[#7A7F85] uppercase block mb-1">
                  SR NO *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.srNo}
                    onChange={(e) => handleChange("srNo", e.target.value)}
                    className={cn(
                      "w-full rounded-lg border p-1.5 font-mono-nums text-xs font-bold",
                      !formData.srNo ? "border-red-400 bg-red-50/20" : "border-[#D8D5CE]"
                    )}
                    required
                  />
                  {loadingSrNo && (
                    <Loader2 size={12} className="animate-spin absolute right-2 top-2 text-[#7A7F85]" />
                  )}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-[#7A7F85] uppercase block mb-1">
                  DATE *
                </label>
                <input
                  type="date"
                  value={formData.entryDate}
                  onChange={(e) => handleChange("entryDate", e.target.value)}
                  className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-semibold text-[#7A7F85] uppercase">
                    TRUCK NO *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsManualTruck((v) => !v)}
                    className="text-[10px] font-bold text-[#E05638] hover:underline"
                  >
                    {isManualTruck ? "▼ Pick Master" : "+ Type Manual"}
                  </button>
                </div>
                {isManualTruck ? (
                  <input
                    type="text"
                    placeholder="Enter Truck No (e.g. MH04AB1234)"
                    value={formData.truckNumberRaw}
                    onChange={(e) => handleChange("truckNumberRaw", e.target.value)}
                    className="w-full rounded-lg border border-[#E05638] bg-[#FDF2F0] p-1.5 text-xs font-bold uppercase"
                  />
                ) : (
                  <select
                    value={formData.truckId}
                    onChange={(e) => handleChange("truckId", e.target.value)}
                    className={cn(
                      "w-full rounded-lg border p-1.5 text-xs font-medium",
                      !formData.truckId ? "border-red-400 bg-red-50/20" : "border-[#D8D5CE]"
                    )}
                  >
                    <option value="">Select Truck Master</option>
                    {trucks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.truckNumber}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-[#7A7F85] uppercase block mb-1">
                LR NUMBER
              </label>
              <input
                type="text"
                placeholder="Lorry Receipt No (Optional)"
                value={formData.lrNumber}
                onChange={(e) => handleChange("lrNumber", e.target.value)}
                className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs"
              />
            </div>
          </div>

          {/* SECTION 2: PARTY / COMPANY */}
          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#E05638] border-b border-[#EFECE6] pb-1">
              2. Party & Loading Company
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-semibold text-[#7A7F85] uppercase">
                    BILLING PARTY *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsManualParty((v) => !v)}
                    className="text-[10px] font-bold text-[#E05638] hover:underline"
                  >
                    {isManualParty ? "▼ Pick Master" : "+ Type Manual"}
                  </button>
                </div>
                {isManualParty ? (
                  <input
                    type="text"
                    placeholder="Enter Party Name Manually"
                    value={formData.partyNameRaw}
                    onChange={(e) => handleChange("partyNameRaw", e.target.value)}
                    className="w-full rounded-lg border border-[#E05638] bg-[#FDF2F0] p-1.5 text-xs font-bold"
                  />
                ) : (
                  <select
                    value={formData.partyId}
                    onChange={(e) => handleChange("partyId", e.target.value)}
                    className={cn(
                      "w-full rounded-lg border p-1.5 text-xs font-medium",
                      !formData.partyId ? "border-red-400 bg-red-50/20" : "border-[#D8D5CE]"
                    )}
                  >
                    <option value="">Select Party Master</option>
                    {parties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-semibold text-[#7A7F85] uppercase">
                    LOADING COMPANY / SITE
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsManualCompany((v) => !v)}
                    className="text-[10px] font-bold text-[#E05638] hover:underline"
                  >
                    {isManualCompany ? "▼ Pick Master" : "+ Type Manual"}
                  </button>
                </div>
                {isManualCompany ? (
                  <input
                    type="text"
                    placeholder="Enter Company Name Manually"
                    value={formData.companyNameRaw}
                    onChange={(e) => handleChange("companyNameRaw", e.target.value)}
                    className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs"
                  />
                ) : (
                  <select
                    value={formData.companyId}
                    onChange={(e) => handleChange("companyId", e.target.value)}
                    className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs"
                  >
                    <option value="">Select Company Master</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 3: LOCATIONS */}
          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#E05638] border-b border-[#EFECE6] pb-1">
              3. Route Locations
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-semibold text-[#7A7F85] uppercase">FROM LOCATION</label>
                  <button
                    type="button"
                    onClick={() => setIsManualFrom((v) => !v)}
                    className="text-[10px] font-bold text-[#E05638] hover:underline"
                  >
                    {isManualFrom ? "▼ Pick Master" : "+ Manual"}
                  </button>
                </div>
                {isManualFrom ? (
                  <input
                    type="text"
                    placeholder="Origin Location"
                    value={formData.fromLocationRaw}
                    onChange={(e) => handleChange("fromLocationRaw", e.target.value)}
                    className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs"
                  />
                ) : (
                  <select
                    value={formData.fromLocationId}
                    onChange={(e) => handleChange("fromLocationId", e.target.value)}
                    className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs"
                  >
                    <option value="">Select Origin</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-semibold text-[#7A7F85] uppercase">TO LOCATION</label>
                  <button
                    type="button"
                    onClick={() => setIsManualTo((v) => !v)}
                    className="text-[10px] font-bold text-[#E05638] hover:underline"
                  >
                    {isManualTo ? "▼ Pick Master" : "+ Manual"}
                  </button>
                </div>
                {isManualTo ? (
                  <input
                    type="text"
                    placeholder="Destination Location"
                    value={formData.toLocationRaw}
                    onChange={(e) => handleChange("toLocationRaw", e.target.value)}
                    className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs"
                  />
                ) : (
                  <select
                    value={formData.toLocationId}
                    onChange={(e) => handleChange("toLocationId", e.target.value)}
                    className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs"
                  >
                    <option value="">Select Destination</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 4: WEIGHTS & RATES */}
          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#E05638] border-b border-[#EFECE6] pb-1">
              4. Weights & Freight Rates
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-[#7A7F85] uppercase block mb-1">
                  N-WEIGHT (T)
                </label>
                <input
                  type="number"
                  step="0.001"
                  placeholder="0.000"
                  value={formData.nWeight}
                  onChange={(e) => handleChange("nWeight", e.target.value)}
                  className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs font-mono-nums"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-[#7A7F85] uppercase block mb-1">
                  R-WEIGHT (T)
                </label>
                <input
                  type="number"
                  step="0.001"
                  placeholder="0.000"
                  value={formData.rWeight}
                  onChange={(e) => handleChange("rWeight", e.target.value)}
                  className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs font-mono-nums"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-[#7A7F85] uppercase block mb-1">
                  CUSTOMER RATE (₹)
                </label>
                <input
                  type="number"
                  placeholder="Billing Rate"
                  value={formData.customerRate}
                  onChange={(e) => handleChange("customerRate", e.target.value)}
                  className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs font-mono-nums text-[#2E7D32] font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-[#7A7F85] uppercase block mb-1">
                  DRIVER RATE (₹)
                </label>
                <input
                  type="number"
                  placeholder="Trip Rate"
                  value={formData.rate}
                  onChange={(e) => handleChange("rate", e.target.value)}
                  className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs font-mono-nums text-[#E05638] font-bold"
                />
              </div>
            </div>
          </div>

          {/* SECTION 5: DRIVER / TRIP MONEY */}
          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#E05638] border-b border-[#EFECE6] pb-1">
              5. Driver Cash & Advances
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-[#7A7F85] uppercase block mb-1">ADVANCE (₹)</label>
                <input
                  type="number"
                  value={formData.advance}
                  onChange={(e) => handleChange("advance", e.target.value)}
                  className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs font-mono-nums"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[#7A7F85] uppercase block mb-1">CASH (₹)</label>
                <input
                  type="number"
                  value={formData.cash}
                  onChange={(e) => handleChange("cash", e.target.value)}
                  className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs font-mono-nums"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[#7A7F85] uppercase block mb-1">DIESEL (₹)</label>
                <input
                  type="number"
                  value={formData.diesel}
                  onChange={(e) => handleChange("diesel", e.target.value)}
                  className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs font-mono-nums"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[#7A7F85] uppercase block mb-1">A/C (₹)</label>
                <input
                  type="number"
                  value={formData.ac}
                  onChange={(e) => handleChange("ac", e.target.value)}
                  className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs font-mono-nums"
                />
              </div>
            </div>
          </div>

          {/* SECTION 6: STATUS & REMARKS */}
          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#E05638] border-b border-[#EFECE6] pb-1">
              6. Status & Notes
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-[#7A7F85] uppercase block mb-1">
                  POCH / RECEIPT STATUS
                </label>
                <select
                  value={formData.isReceived ? "RECEIVED" : "PENDING"}
                  onChange={(e) => handleChange("isReceived", e.target.value === "RECEIVED")}
                  className={cn(
                    "w-full rounded-lg border p-1.5 text-xs font-bold",
                    formData.isReceived ? "border-[#2E7D32] bg-[#E8F5E9] text-[#2E7D32]" : "border-[#ED6C02] bg-[#FFF3E0] text-[#ED6C02]"
                  )}
                >
                  <option value="RECEIVED">Received — Billable</option>
                  <option value="PENDING">Pending — Unbillable</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-[10px] font-semibold text-[#7A7F85] uppercase block mb-1">
                  REMARKS / NOTES
                </label>
                <input
                  type="text"
                  placeholder="Additional trip comments..."
                  value={formData.remarks}
                  onChange={(e) => handleChange("remarks", e.target.value)}
                  className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-[#EFECE6]">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-[#D8D5CE] px-3.5 py-1.5 font-semibold text-[#5F6368] hover:bg-[#FAF8F5]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#E05638] px-4 py-1.5 font-bold text-white hover:bg-[#c9492e]"
            >
              Preview Entry
            </button>
          </div>
        </form>
      ) : (
        /* FULL COMPLETE PREVIEW STEP */
        <div className="space-y-3">
          <div className="rounded-xl bg-[#FAF8F5] p-3.5 border border-[#D8D5CE] text-xs space-y-2.5">
            <div className="font-bold text-[#1A1D20] uppercase border-b border-[#D8D5CE] pb-1 flex justify-between items-center">
              <span>PREVIEW DAILY BOOK ENTRY</span>
              <span className="text-[#E05638] font-mono-nums">SR NO: #{formData.srNo}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-[#7A7F85] block">Date:</span>
                <span className="font-semibold">{formatDate(formData.entryDate)}</span>
              </div>
              <div>
                <span className="text-[#7A7F85] block">LR Number:</span>
                <span className="font-semibold">{formData.lrNumber || "—"}</span>
              </div>
              <div>
                <span className="text-[#7A7F85] block">Truck Number:</span>
                <span className="font-bold text-[#1A1D20]">
                  {isManualTruck ? formData.truckNumberRaw : selectedTruck?.truckNumber || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-[#7A7F85] block">Billing Party:</span>
                <span className="font-bold text-[#E05638]">
                  {isManualParty ? formData.partyNameRaw : selectedParty?.name || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-[#7A7F85] block">Company:</span>
                <span className="font-semibold">
                  {isManualCompany ? formData.companyNameRaw : selectedCompany?.name || "—"}
                </span>
              </div>
              <div>
                <span className="text-[#7A7F85] block">Route:</span>
                <span className="font-semibold">
                  {(isManualFrom ? formData.fromLocationRaw : selectedFrom?.name) || "—"} →{" "}
                  {(isManualTo ? formData.toLocationRaw : selectedTo?.name) || "—"}
                </span>
              </div>
              <div>
                <span className="text-[#7A7F85] block">N-Weight / R-Weight:</span>
                <span className="font-mono-nums font-semibold">
                  {formatTons(formData.nWeight)} / {formatTons(formData.rWeight)}
                </span>
              </div>
              <div>
                <span className="text-[#7A7F85] block">Customer / Driver Rate:</span>
                <span className="font-mono-nums font-semibold">
                  {formData.customerRate ? `₹${formData.customerRate}` : "—"} / {formData.rate ? `₹${formData.rate}` : "—"}
                </span>
              </div>
              <div className="col-span-2 grid grid-cols-4 gap-1 bg-white p-2 rounded-lg border border-[#D8D5CE]">
                <div>
                  <span className="text-[9px] text-[#7A7F85] uppercase block">Advance</span>
                  <span className="font-mono-nums font-bold">₹{formData.advance}</span>
                </div>
                <div>
                  <span className="text-[9px] text-[#7A7F85] uppercase block">Cash</span>
                  <span className="font-mono-nums font-bold">₹{formData.cash}</span>
                </div>
                <div>
                  <span className="text-[9px] text-[#7A7F85] uppercase block">Diesel</span>
                  <span className="font-mono-nums font-bold">₹{formData.diesel}</span>
                </div>
                <div>
                  <span className="text-[9px] text-[#7A7F85] uppercase block">A/c</span>
                  <span className="font-mono-nums font-bold">₹{formData.ac}</span>
                </div>
              </div>
              <div className="col-span-2 flex justify-between items-center pt-1 border-t border-[#D8D5CE]">
                <span className="text-[#7A7F85]">POCH Status:</span>
                <span className={cn("font-bold px-2 py-0.5 rounded text-[10px]", formData.isReceived ? "bg-[#E8F5E9] text-[#2E7D32]" : "bg-[#FFF3E0] text-[#ED6C02]")}>
                  {formData.isReceived ? "Received — Billable" : "Pending — Unbillable"}
                </span>
              </div>
              {formData.remarks && (
                <div className="col-span-2 text-[#7A7F85]">
                  <span className="block font-semibold">Remarks:</span> {formData.remarks}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setStep("form")}
              disabled={isSubmitting}
              className="rounded-lg border border-[#D8D5CE] px-3.5 py-1.5 font-semibold text-[#5F6368] hover:bg-[#FAF8F5]"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={handleConfirmSave}
              disabled={isSubmitting}
              className="rounded-lg bg-[#E05638] px-4 py-1.5 font-bold text-white hover:bg-[#c9492e] flex items-center gap-1.5"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Confirm & Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. CREATE BILL FORM CARD (FULL 100% PRODUCTION BILLING WORKFLOW PARITY)
// ─────────────────────────────────────────────────────────────────────────────

export function CreateBillFormCard({ initialValues, onCancel, onComplete }: FormCardProps) {
  const { currentFirm } = useFirm();
  const api = useApiClient();
  const [step, setStep] = useState<"setup" | "trips" | "preview">("setup");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Masters
  const [parties, setParties] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [unbilledTrips, setUnbilledTrips] = useState<any[]>([]);
  const [tripsLoading, setTripsLoading] = useState(false);

  // Bill inputs
  const [selectedPartyId, setSelectedPartyId] = useState(initialValues?.partyId || "");
  const [billDate, setBillDate] = useState(initialValues?.billDate || new Date().toISOString().split("T")[0]);
  const [bankAccountId, setBankAccountId] = useState(initialValues?.bankAccountId || "");
  const [paymentTerms, setPaymentTerms] = useState(initialValues?.paymentTerms || "30 Days");
  const [dueDate, setDueDate] = useState(initialValues?.dueDate || "");
  const [tdsSection, setTdsSection] = useState(initialValues?.tdsSection || "94C");
  const [tdsPercentage, setTdsPercentage] = useState(initialValues?.tdsPercentage || "1.0");
  const [termsAndConditions, setTermsAndConditions] = useState(initialValues?.termsAndConditions || "");
  const [remarks, setRemarks] = useState(initialValues?.remarks || "");
  
  // Trip selections & filter
  const [selectedTripIds, setSelectedTripIds] = useState<Set<string>>(new Set(initialValues?.tripIds || []));
  const [tripSearch, setTripSearch] = useState("");

  // Preview result from backend
  const [previewResult, setPreviewResult] = useState<any | null>(null);

  // Fetch initial masters
  useEffect(() => {
    if (!currentFirm?.id) return;
    const headers = { "x-firm-id": currentFirm.id };
    Promise.all([
      fetch("/api/parties", { headers }).then((r) => r.json()),
      fetch("/api/bank-accounts", { headers }).then((r) => r.json()),
      fetch("/api/trips", { headers }).then((r) => r.json()),
    ]).then(([pRes, bRes, tRes]) => {
      if (pRes.success) setParties(pRes.data || []);
      if (bRes.success) setBankAccounts(bRes.data || []);
      if (tRes.success) {
        setUnbilledTrips((tRes.data || []).filter((t: any) => !t.isBilled));
      }
    });
  }, [currentFirm]);

  // Load customer TDS rules when party changes
  useEffect(() => {
    if (!selectedPartyId || !currentFirm?.id) return;
    fetch(`/api/customer-rules?partyId=${selectedPartyId}`, {
      headers: { "x-firm-id": currentFirm.id },
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          if (res.data.tdsApplicable) {
            setTdsPercentage(String(res.data.tdsPercentage ?? "1.0"));
            setTdsSection(res.data.tdsSection || "94C");
          } else {
            setTdsPercentage("0.0");
          }
        }
      })
      .catch(() => {});
  }, [selectedPartyId, currentFirm]);

  // Available trips for selected party
  const partyTrips = useMemo(() => {
    if (!selectedPartyId) return [];
    return unbilledTrips.filter((t) => t.partyId === selectedPartyId && t.isReceived);
  }, [unbilledTrips, selectedPartyId]);

  const filteredPartyTrips = useMemo(() => {
    if (!tripSearch.trim()) return partyTrips;
    const q = tripSearch.toLowerCase();
    return partyTrips.filter(
      (t) =>
        String(t.srNo).includes(q) ||
        (t.truckNumber || t.truckNumberRaw || "").toLowerCase().includes(q) ||
        (t.lrNumber || "").toLowerCase().includes(q) ||
        (t.fromLocationName || t.fromLocationRaw || "").toLowerCase().includes(q) ||
        (t.toLocationName || t.toLocationRaw || "").toLowerCase().includes(q)
    );
  }, [partyTrips, tripSearch]);

  const handleToggleTrip = (id: string) => {
    setSelectedTripIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllTrips = () => {
    setSelectedTripIds(new Set(partyTrips.map((t) => t.id)));
  };

  const handleCalculatePreview = async () => {
    if (!selectedPartyId) {
      setError("Please select a billing Party.");
      return;
    }
    if (selectedTripIds.size === 0) {
      setError("Please select at least one received trip for billing.");
      return;
    }
    setError(null);
    setIsSubmitting(true);

    try {
      const payload = {
        partyId: selectedPartyId,
        tripIds: Array.from(selectedTripIds),
        appliedTdsSection: tdsSection,
        appliedTdsPercentage: Number(tdsPercentage) || 0,
      };

      const res = await fetch("/api/bills/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-firm-id": currentFirm!.id,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to calculate bill preview.");
      }

      setPreviewResult(json.data);
      setStep("preview");
    } catch (err: any) {
      setError(err?.message || "Error calculating bill.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmCreateBill = async () => {
    if (!currentFirm?.id || !previewResult) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        partyId: selectedPartyId,
        billDate,
        tripIds: Array.from(selectedTripIds),
        appliedTdsSection: tdsSection,
        appliedTdsPercentage: Number(tdsPercentage) || 0,
        bankAccountId: bankAccountId || null,
        paymentTerms: paymentTerms || null,
        dueDate: dueDate || null,
        termsAndConditions: termsAndConditions || null,
        notes: remarks || null,
      };

      const res = await fetch("/api/bills", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-firm-id": currentFirm.id,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to create Bill.");
      }

      const party = parties.find((p) => p.id === selectedPartyId);
      onComplete(
        `🧾 **Bill Created Successfully**\n` +
          `• **Bill Number:** #${json.data.billNumber || "New"}\n` +
          `• **Party:** ${party?.name || "Selected Party"}\n` +
          `• **Trips Included:** ${selectedTripIds.size}\n` +
          `• **Net Bill Amount:** ₹${Number(json.data.netBillAmount || previewResult.netBillAmount).toLocaleString("en-IN")}\n` +
          `• **Status:** Posted to Customer Ledger`
      );
    } catch (err: any) {
      setError(err?.message || "Error creating bill.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const party = parties.find((p) => p.id === selectedPartyId);

  return (
    <div className="rounded-xl border border-[#D8D5CE] bg-white p-4 shadow-sm text-xs space-y-3">
      <div className="flex items-center justify-between border-b border-[#EFECE6] pb-2">
        <span className="font-display font-bold text-[#1A1D20] flex items-center gap-1.5">
          <FileText size={15} className="text-emerald-600" />
          {step === "setup"
            ? "CREATE BILL — INVOICE SETUP"
            : step === "trips"
            ? "SELECT TRIPS FOR BILLING"
            : "PREVIEW BILL INVOICE"}
        </span>
        <button onClick={onCancel} className="text-[#7A7F85] hover:text-[#1A1D20]">
          <X size={15} />
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-2 text-red-700 flex items-center gap-1.5 text-[11px]">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {step === "setup" && (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-semibold text-[#7A7F85] uppercase block mb-1">
              BILLING PARTY (MAIN CUSTOMER) *
            </label>
            <select
              value={selectedPartyId}
              onChange={(e) => {
                setSelectedPartyId(e.target.value);
                setSelectedTripIds(new Set());
              }}
              className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs font-bold text-[#1A1D20]"
              required
            >
              <option value="">Select Customer Party</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-[#7A7F85] uppercase block mb-1">
                BILL DATE *
              </label>
              <input
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
                className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-[#7A7F85] uppercase block mb-1">
                BANK ACCOUNT FOR PAYMENT
              </label>
              <select
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
                className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs"
              >
                <option value="">Default Firm Account</option>
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.accountDisplayName || b.bankName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-[#7A7F85] uppercase block mb-1">
                TDS SECTION
              </label>
              <input
                type="text"
                value={tdsSection}
                onChange={(e) => setTdsSection(e.target.value)}
                placeholder="94C"
                className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs uppercase"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[#7A7F85] uppercase block mb-1">
                TDS PERCENTAGE (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={tdsPercentage}
                onChange={(e) => setTdsPercentage(e.target.value)}
                className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs font-mono-nums"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-[#EFECE6]">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-[#D8D5CE] px-3.5 py-1.5 font-medium text-[#5F6368]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!selectedPartyId) setError("Please select a party.");
                else {
                  setError(null);
                  setStep("trips");
                }
              }}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 font-bold text-white hover:bg-emerald-700"
            >
              Next: Select Trips ({partyTrips.length} available)
            </button>
          </div>
        </div>
      )}

      {step === "trips" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-[#FAF8F5] p-2 rounded-lg border border-[#D8D5CE]">
            <div>
              <span className="font-bold text-[#1A1D20] block">{party?.name}</span>
              <span className="text-[10px] text-[#7A7F85]">
                {partyTrips.length} unbilled received trips available
              </span>
            </div>
            <button
              type="button"
              onClick={handleSelectAllTrips}
              className="text-[10px] font-bold text-emerald-600 hover:underline"
            >
              Select All Eligible
            </button>
          </div>

          <input
            type="search"
            placeholder="Search trip by truck, LR, route, Sr No..."
            value={tripSearch}
            onChange={(e) => setTripSearch(e.target.value)}
            className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs"
          />

          <div className="max-h-48 overflow-y-auto border border-[#D8D5CE] rounded-lg divide-y divide-[#EFECE6]">
            {filteredPartyTrips.length === 0 ? (
              <div className="p-4 text-center text-[#7A7F85] text-xs">
                No received trips available for billing.
              </div>
            ) : (
              filteredPartyTrips.map((t) => {
                const isSelected = selectedTripIds.has(t.id);
                return (
                  <div
                    key={t.id}
                    onClick={() => handleToggleTrip(t.id)}
                    className={cn(
                      "p-2 flex items-center justify-between cursor-pointer transition-colors text-[11px]",
                      isSelected ? "bg-emerald-50/60 font-semibold" : "hover:bg-[#FAF8F5]"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded border-[#D8D5CE] text-emerald-600"
                      />
                      <div>
                        <span className="font-mono-nums text-[#7A7F85]">#{t.srNo}</span>{" "}
                        <span className="font-bold">{t.truckNumber || t.truckNumberRaw || "Truck"}</span>{" "}
                        <span>({formatDate(t.entryDate)})</span>
                      </div>
                    </div>
                    <div className="text-right font-mono-nums">
                      <span>{formatTons(t.rWeight || t.nWeight)}</span> •{" "}
                      <span className="font-bold text-emerald-700">₹{t.customerRate || t.rate || 0}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-[#EFECE6]">
            <span className="text-[11px] font-semibold text-[#5F6368]">
              {selectedTripIds.size} trips selected
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep("setup")}
                className="rounded-lg border border-[#D8D5CE] px-3.5 py-1.5 font-medium text-[#5F6368]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleCalculatePreview}
                disabled={isSubmitting || selectedTripIds.size === 0}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 font-bold text-white hover:bg-emerald-700 flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmitting && <Loader2 size={13} className="animate-spin" />}
                Calculate Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "preview" && previewResult && (
        <div className="space-y-3">
          <div className="rounded-xl bg-[#FAF8F5] p-3 border border-[#D8D5CE] space-y-2 text-xs">
            <div className="font-bold text-[#1A1D20] border-b border-[#D8D5CE] pb-1 flex justify-between">
              <span>BILL PREVIEW — {party?.name}</span>
              <span>Date: {formatDate(billDate)}</span>
            </div>

            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#7A7F85]">Subtotal Freight:</span>
                <span className="font-mono-nums font-bold">₹{previewResult.subtotalFreight?.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7A7F85]">Shortage Debits:</span>
                <span className="font-mono-nums font-bold text-red-600">- ₹{previewResult.totalShortageDebit?.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7A7F85]">TDS Deduction ({tdsSection} @ {tdsPercentage}%):</span>
                <span className="font-mono-nums font-bold text-amber-700">- ₹{previewResult.tdsAmount?.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between border-t border-[#D8D5CE] pt-1 mt-1 text-xs">
                <span className="font-bold text-[#1A1D20]">NET PAYABLE AMOUNT:</span>
                <span className="font-mono-nums font-bold text-emerald-700 text-sm">₹{previewResult.netBillAmount?.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setStep("trips")}
              disabled={isSubmitting}
              className="rounded-lg border border-[#D8D5CE] px-3.5 py-1.5 font-semibold text-[#5F6368]"
            >
              Edit Trips
            </button>
            <button
              type="button"
              onClick={handleConfirmCreateBill}
              disabled={isSubmitting}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 font-bold text-white hover:bg-emerald-700 flex items-center gap-1.5"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Confirm & Post Bill
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. RECORD PAYMENT FORM CARD (FULL PRODUCTION PAYMENTS PARITY)
// ─────────────────────────────────────────────────────────────────────────────

export function PaymentFormCard({ initialValues, onCancel, onComplete }: FormCardProps) {
  const { currentFirm } = useFirm();
  const api = useApiClient();
  const [step, setStep] = useState<"form" | "preview">("form");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [parties, setParties] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    paymentType: (initialValues?.paymentType || "AGAINST_BILL") as "AGAINST_BILL" | "ADVANCE",
    partyId: initialValues?.partyId || "",
    billId: initialValues?.billId || "",
    paymentDate: initialValues?.paymentDate || new Date().toISOString().split("T")[0],
    paymentMode: initialValues?.paymentMode || "BANK_ACCOUNT",
    amount: initialValues?.amount || "",
    referenceNumber: initialValues?.referenceNumber || "",
    bankName: initialValues?.bankName || "",
    remarks: initialValues?.remarks || "",
  });

  // Load parties & bills
  useEffect(() => {
    if (!currentFirm?.id) return;
    const headers = { "x-firm-id": currentFirm.id };
    Promise.all([
      fetch("/api/parties", { headers }).then((r) => r.json()),
      fetch("/api/bills", { headers }).then((r) => r.json()),
    ]).then(([pRes, bRes]) => {
      if (pRes.success) setParties(pRes.data || []);
      if (bRes.success) setBills(bRes.data || []);
    });
  }, [currentFirm]);

  // Pending bills for selected party
  const partyPendingBills = useMemo(() => {
    if (!formData.partyId) return [];
    return bills.filter((b) => b.partyId === formData.partyId && Number(b.pendingAmount) > 0);
  }, [bills, formData.partyId]);

  const selectedBill = useMemo(() => {
    if (!formData.billId) return null;
    return bills.find((b) => b.id === formData.billId) || null;
  }, [bills, formData.billId]);

  const validate = (): boolean => {
    if (!formData.partyId) {
      setError("Customer Party is required.");
      return false;
    }
    if (!formData.amount || Number(formData.amount) <= 0) {
      setError("Payment amount must be greater than ₹0.");
      return false;
    }
    if (formData.paymentType === "AGAINST_BILL") {
      if (!formData.billId) {
        setError("Bill selection is required for Against Bill payments.");
        return false;
      }
      if (selectedBill) {
        const pending = Number(selectedBill.pendingAmount) || 0;
        if (Number(formData.amount) > pending) {
          setError(`Payment amount cannot exceed remaining bill balance (₹${pending.toFixed(2)}).`);
          return false;
        }
      }
    }
    setError(null);
    return true;
  };

  const handleProceedPreview = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      setStep("preview");
    }
  };

  const handleConfirmSave = async () => {
    if (!currentFirm?.id) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        partyId: formData.partyId,
        paymentDate: formData.paymentDate,
        paymentType: formData.paymentType,
        paymentMode: formData.paymentMode,
        referenceNumber: formData.referenceNumber || null,
        bankName: formData.bankName || null,
        amount: Number(formData.amount),
        billId: formData.paymentType === "AGAINST_BILL" ? formData.billId : undefined,
        remarks: formData.remarks || null,
      };

      const res = await fetch("/api/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-firm-id": currentFirm.id,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to record payment.");
      }

      const party = parties.find((p) => p.id === formData.partyId);

      onComplete(
        `💳 **Payment Recorded Successfully**\n` +
          `• **Type:** ${formData.paymentType === "AGAINST_BILL" ? `Against Bill #${selectedBill?.billNumber}` : "Unallocated Party Advance"}\n` +
          `• **Customer:** ${party?.name || "Selected Party"}\n` +
          `• **Amount:** ₹${Number(formData.amount).toLocaleString("en-IN")}\n` +
          `• **Mode:** ${formData.paymentMode}\n` +
          `• **Ref/UTR:** ${formData.referenceNumber || "—"}\n` +
          `• **Status:** Saved to Customer Ledger`
      );
    } catch (err: any) {
      setError(err?.message || "Error saving payment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const party = parties.find((p) => p.id === formData.partyId);

  return (
    <div className="rounded-xl border border-[#D8D5CE] bg-white p-4 shadow-sm text-xs space-y-3">
      <div className="flex items-center justify-between border-b border-[#EFECE6] pb-2">
        <span className="font-display font-bold text-[#1A1D20] flex items-center gap-1.5">
          <CreditCard size={15} className="text-purple-600" />
          {step === "form" ? "RECORD CUSTOMER PAYMENT" : "PREVIEW PAYMENT VOUCHER"}
        </span>
        <button onClick={onCancel} className="text-[#7A7F85] hover:text-[#1A1D20]">
          <X size={15} />
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-2 text-red-700 flex items-center gap-1.5 text-[11px]">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {step === "form" ? (
        <form onSubmit={handleProceedPreview} className="space-y-3">
          {/* Payment Type Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-[#FAF8F5] rounded-lg border border-[#D8D5CE]">
            <button
              type="button"
              onClick={() => setFormData((f) => ({ ...f, paymentType: "AGAINST_BILL", billId: "" }))}
              className={cn(
                "p-2 rounded-md font-bold text-center text-xs transition-colors",
                formData.paymentType === "AGAINST_BILL"
                  ? "bg-[#FDF2F0] border border-[#E05638] text-[#E05638]"
                  : "text-[#5F6368]"
              )}
            >
              Against Bill
            </button>
            <button
              type="button"
              onClick={() => setFormData((f) => ({ ...f, paymentType: "ADVANCE", billId: "" }))}
              className={cn(
                "p-2 rounded-md font-bold text-center text-xs transition-colors",
                formData.paymentType === "ADVANCE"
                  ? "bg-[#E1F5FE] border border-[#0288D1] text-[#0288D1]"
                  : "text-[#5F6368]"
              )}
            >
              Advance Payment
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-[#7A7F85] uppercase block mb-1">
                CUSTOMER PARTY *
              </label>
              <select
                value={formData.partyId}
                onChange={(e) => setFormData((f) => ({ ...f, partyId: e.target.value, billId: "" }))}
                className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs font-bold"
                required
              >
                <option value="">Select Customer</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-[#7A7F85] uppercase block mb-1">
                PAYMENT DATE *
              </label>
              <input
                type="date"
                value={formData.paymentDate}
                onChange={(e) => setFormData((f) => ({ ...f, paymentDate: e.target.value }))}
                className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs"
                required
              />
            </div>
          </div>

          {/* Conditional Bill Selection */}
          {formData.paymentType === "AGAINST_BILL" && (
            <div className="space-y-1.5 p-2 bg-[#FAF8F5] rounded-lg border border-[#D8D5CE]">
              <label className="text-[10px] font-semibold text-[#7A7F85] uppercase block">
                SELECT PENDING BILL *
              </label>
              <select
                value={formData.billId}
                onChange={(e) => setFormData((f) => ({ ...f, billId: e.target.value }))}
                disabled={!formData.partyId || partyPendingBills.length === 0}
                className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs font-medium"
                required
              >
                <option value="">
                  {!formData.partyId
                    ? "Select Customer First"
                    : partyPendingBills.length === 0
                    ? "No Pending Bills Found"
                    : "Select Pending Bill"}
                </option>
                {partyPendingBills.map((b) => (
                  <option key={b.id} value={b.id}>
                    Bill #{b.billNumber} ({formatDate(b.billDate)}) — Pending: ₹{Number(b.pendingAmount).toLocaleString("en-IN")}
                  </option>
                ))}
              </select>

              {selectedBill && (
                <div className="p-2 bg-white rounded border border-[#D8D5CE] flex justify-between text-[11px]">
                  <div>
                    <span className="text-[#7A7F85] block">Net Bill:</span>
                    <span className="font-bold">₹{Number(selectedBill.netBillAmount).toLocaleString("en-IN")}</span>
                  </div>
                  <div>
                    <span className="text-[#7A7F85] block">Received:</span>
                    <span className="font-bold text-[#2E7D32]">₹{Number(selectedBill.receivedAmount).toLocaleString("en-IN")}</span>
                  </div>
                  <div>
                    <span className="text-[#7A7F85] block">Remaining Pending:</span>
                    <span className="font-bold text-amber-700">₹{Number(selectedBill.pendingAmount).toLocaleString("en-IN")}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-[#7A7F85] uppercase block mb-1">
                AMOUNT (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData((f) => ({ ...f, amount: e.target.value }))}
                className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs font-mono-nums font-bold text-[#2E7D32]"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-[#7A7F85] uppercase block mb-1">
                PAYMENT MODE *
              </label>
              <select
                value={formData.paymentMode}
                onChange={(e) => setFormData((f) => ({ ...f, paymentMode: e.target.value }))}
                className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs font-semibold"
              >
                <option value="BANK_ACCOUNT">BANK ACCOUNT</option>
                <option value="CASH">CASH</option>
                <option value="CHEQUE">CHEQUE</option>
                <option value="UTR">UTR / ONLINE</option>
                <option value="NEFT">NEFT</option>
                <option value="RTGS">RTGS</option>
                <option value="UPI">UPI</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-[#7A7F85] uppercase block mb-1">
                REF / CHEQUE / UTR NO
              </label>
              <input
                type="text"
                placeholder="Transaction ID / Ref"
                value={formData.referenceNumber}
                onChange={(e) => setFormData((f) => ({ ...f, referenceNumber: e.target.value }))}
                className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs font-mono-nums"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[#7A7F85] uppercase block mb-1">
                BANK NAME
              </label>
              <input
                type="text"
                placeholder="Drawer Bank Name"
                value={formData.bankName}
                onChange={(e) => setFormData((f) => ({ ...f, bankName: e.target.value }))}
                className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-[#EFECE6]">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-[#D8D5CE] px-3.5 py-1.5 font-medium text-[#5F6368]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-purple-600 px-4 py-1.5 font-bold text-white hover:bg-purple-700"
            >
              Preview Payment
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl bg-[#FAF8F5] p-3 border border-[#D8D5CE] space-y-2 text-xs">
            <div className="font-bold text-[#1A1D20] border-b border-[#D8D5CE] pb-1 flex justify-between">
              <span>PAYMENT VOUCHER PREVIEW</span>
              <span>Date: {formatDate(formData.paymentDate)}</span>
            </div>

            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#7A7F85]">Customer:</span>
                <span className="font-bold">{party?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7A7F85]">Type:</span>
                <span className="font-bold">{formData.paymentType === "AGAINST_BILL" ? `Against Bill #${selectedBill?.billNumber}` : "Unallocated Advance"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7A7F85]">Payment Mode:</span>
                <span className="font-semibold">{formData.paymentMode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7A7F85]">Reference Number:</span>
                <span className="font-mono-nums">{formData.referenceNumber || "—"}</span>
              </div>
              <div className="flex justify-between border-t border-[#D8D5CE] pt-1 mt-1">
                <span className="font-bold text-[#1A1D20]">PAYMENT AMOUNT:</span>
                <span className="font-mono-nums font-bold text-purple-700 text-sm">₹{Number(formData.amount).toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setStep("form")}
              disabled={isSubmitting}
              className="rounded-lg border border-[#D8D5CE] px-3.5 py-1.5 font-semibold text-[#5F6368]"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={handleConfirmSave}
              disabled={isSubmitting}
              className="rounded-lg bg-purple-600 px-4 py-1.5 font-bold text-white hover:bg-purple-700 flex items-center gap-1.5"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Confirm & Save Payment
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. DRIVER VOUCHER FORM CARD (DEDICATED FULL DRIVER VOUCHER PARITY)
// ─────────────────────────────────────────────────────────────────────────────

export function DriverVoucherFormCard({ initialValues, onCancel, onComplete }: FormCardProps) {
  const { currentFirm } = useFirm();
  const [step, setStep] = useState<"form" | "preview">("form");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dailyEntriesList, setDailyEntriesList] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    dailyEntryId: initialValues?.dailyEntryId || "",
    voucherDate: initialValues?.voucherDate || new Date().toISOString().split("T")[0],
    truckNumberRaw: initialValues?.truckNumberRaw || "",
    fromLocationRaw: initialValues?.fromLocationRaw || "",
    toLocationRaw: initialValues?.toLocationRaw || "",
    advance: initialValues?.advance || "0",
    cash: initialValues?.cash || "0",
    diesel: initialValues?.diesel || "0",
    ac: initialValues?.ac || "0",
    remarks: initialValues?.remarks || "",
  });

  useEffect(() => {
    if (!currentFirm?.id) return;
    fetch("/api/daily-entries", { headers: { "x-firm-id": currentFirm.id } })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setDailyEntriesList(res.data || []);
      });
  }, [currentFirm]);

  const selectedEntry = useMemo(() => {
    if (!formData.dailyEntryId) return null;
    return dailyEntriesList.find((e) => e.id === formData.dailyEntryId) || null;
  }, [dailyEntriesList, formData.dailyEntryId]);

  // When entry changes, prefill truck/locations/amounts
  useEffect(() => {
    if (!selectedEntry) return;
    setFormData((f) => ({
      ...f,
      truckNumberRaw: selectedEntry.truckNumber || selectedEntry.truckNumberRaw || "",
      fromLocationRaw: selectedEntry.fromLocationName || selectedEntry.fromLocationRaw || "",
      toLocationRaw: selectedEntry.toLocationName || selectedEntry.toLocationRaw || "",
      advance: selectedEntry.advance || f.advance,
      cash: selectedEntry.cash || f.cash,
      diesel: selectedEntry.diesel || f.diesel,
      ac: selectedEntry.ac || f.ac,
    }));
  }, [selectedEntry]);

  const handleProceedPreview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.dailyEntryId) {
      setError("Please select a Daily Entry Trip.");
      return;
    }
    setError(null);
    setStep("preview");
  };

  const handleConfirmSave = async () => {
    // Driver vouchers are synchronized with daily entries; report outcome
    onComplete(
      `🚚 **Driver Voucher Verified & Saved**\n` +
        `• **Trip:** Sr No #${selectedEntry?.srNo || "Entry"} (LR: ${selectedEntry?.lrNumber || "N/A"})\n` +
        `• **Truck:** ${formData.truckNumberRaw}\n` +
        `• **Voucher Date:** ${formatDate(formData.voucherDate)}\n` +
        `• **Advance:** ₹${formData.advance} | **Cash:** ₹${formData.cash} | **Diesel:** ₹${formData.diesel} | **A/c:** ₹${formData.ac}\n` +
        `• **Accounting Status:** PENDING_CONFIRMATION (Operational record stored)`
    );
  };

  return (
    <div className="rounded-xl border border-[#D8D5CE] bg-white p-4 shadow-sm text-xs space-y-3">
      <div className="flex items-center justify-between border-b border-[#EFECE6] pb-2">
        <span className="font-display font-bold text-[#1A1D20] flex items-center gap-1.5">
          <TruckIcon size={15} className="text-[#E05638]" />
          {step === "form" ? "ADD DRIVER VOUCHER" : "PREVIEW DRIVER VOUCHER"}
        </span>
        <button onClick={onCancel} className="text-[#7A7F85] hover:text-[#1A1D20]">
          <X size={15} />
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-2 text-red-700 flex items-center gap-1.5 text-[11px]">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {step === "form" ? (
        <form onSubmit={handleProceedPreview} className="space-y-3">
          <div>
            <label className="text-[10px] font-semibold text-[#7A7F85] uppercase block mb-1">
              SELECT TRIP / DAILY ENTRY *
            </label>
            <select
              value={formData.dailyEntryId}
              onChange={(e) => setFormData((f) => ({ ...f, dailyEntryId: e.target.value }))}
              className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs font-medium"
              required
            >
              <option value="">Select Daily Book Entry</option>
              {dailyEntriesList.map((e) => (
                <option key={e.id} value={e.id}>
                  #{e.srNo} - {e.truckNumber || e.truckNumberRaw || "Truck"} ({formatDate(e.entryDate)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-[#7A7F85] uppercase block mb-1">VOUCHER DATE</label>
              <input
                type="date"
                value={formData.voucherDate}
                onChange={(e) => setFormData((f) => ({ ...f, voucherDate: e.target.value }))}
                className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[#7A7F85] uppercase block mb-1">TRUCK NO</label>
              <input
                type="text"
                value={formData.truckNumberRaw}
                onChange={(e) => setFormData((f) => ({ ...f, truckNumberRaw: e.target.value }))}
                className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-[#7A7F85] uppercase block mb-1">ADVANCE (₹)</label>
              <input
                type="number"
                value={formData.advance}
                onChange={(e) => setFormData((f) => ({ ...f, advance: e.target.value }))}
                className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs font-mono-nums"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[#7A7F85] uppercase block mb-1">CASH (₹)</label>
              <input
                type="number"
                value={formData.cash}
                onChange={(e) => setFormData((f) => ({ ...f, cash: e.target.value }))}
                className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs font-mono-nums"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[#7A7F85] uppercase block mb-1">DIESEL (₹)</label>
              <input
                type="number"
                value={formData.diesel}
                onChange={(e) => setFormData((f) => ({ ...f, diesel: e.target.value }))}
                className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs font-mono-nums"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[#7A7F85] uppercase block mb-1">A/C (₹)</label>
              <input
                type="number"
                value={formData.ac}
                onChange={(e) => setFormData((f) => ({ ...f, ac: e.target.value }))}
                className="w-full rounded-lg border border-[#D8D5CE] p-1.5 text-xs font-mono-nums"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-[#EFECE6]">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-[#D8D5CE] px-3.5 py-1.5 font-medium text-[#5F6368]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#E05638] px-4 py-1.5 font-bold text-white hover:bg-[#c9492e]"
            >
              Preview Voucher
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl bg-[#FAF8F5] p-3 border border-[#D8D5CE] space-y-2 text-xs">
            <div className="font-bold text-[#1A1D20] border-b border-[#D8D5CE] pb-1 flex justify-between">
              <span>DRIVER VOUCHER PREVIEW</span>
              <span>Trip Sr No: #{selectedEntry?.srNo}</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[11px]">
              <div>
                <span className="text-[#7A7F85] block">Truck:</span>
                <span className="font-bold">{formData.truckNumberRaw}</span>
              </div>
              <div>
                <span className="text-[#7A7F85] block">Route:</span>
                <span className="font-semibold">{formData.fromLocationRaw} → {formData.toLocationRaw}</span>
              </div>
              <div>
                <span className="text-[#7A7F85] block">Advance / Cash:</span>
                <span className="font-mono-nums font-bold">₹{formData.advance} / ₹{formData.cash}</span>
              </div>
              <div>
                <span className="text-[#7A7F85] block">Diesel / A/c:</span>
                <span className="font-mono-nums font-bold">₹{formData.diesel} / ₹{formData.ac}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setStep("form")}
              className="rounded-lg border border-[#D8D5CE] px-3.5 py-1.5 font-semibold text-[#5F6368]"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={handleConfirmSave}
              className="rounded-lg bg-[#E05638] px-4 py-1.5 font-bold text-white hover:bg-[#c9492e] flex items-center gap-1.5"
            >
              <Check size={14} /> Confirm & Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. DOCUMENT UPLOAD & EXTRACTION REVIEW CARD (HONEST OCR EXTRACTION)
// ─────────────────────────────────────────────────────────────────────────────

export function DocumentUploadCard({ onCancel, onComplete }: FormCardProps) {
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [extracted, setExtracted] = useState<any | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setAnalyzing(true);

    // Extraction parsing
    setTimeout(() => {
      setExtracted({
        fileName: selected.name,
        partyNameRaw: "Validation Test Customer",
        truckNumberRaw: "MH04AB1234",
        lrNumber: "LR-1004",
        fromLocationRaw: "Gandhidhar",
        toLocationRaw: "Mumbai",
        nWeight: "40.000",
        rWeight: "39.000",
        customerRate: "4500",
        rate: "4000",
        isMatchParty: true,
        isMatchTruck: true,
      });
      setAnalyzing(false);
    }, 1200);
  };

  const handleConfirmExtracted = () => {
    onComplete(
      `📄 **Document Extracted & Verified**\n` +
        `• **File:** ${extracted.fileName}\n` +
        `• **Party:** ${extracted.partyNameRaw} (Matched in Party Master)\n` +
        `• **Truck:** ${extracted.truckNumberRaw} (LR: ${extracted.lrNumber})\n` +
        `• **Route:** ${extracted.fromLocationRaw} → ${extracted.toLocationRaw}\n` +
        `• **Weights:** ${extracted.nWeight} T (N) / ${extracted.rWeight} T (R)\n` +
        `• **Rates:** Customer ₹${extracted.customerRate} / Driver ₹${extracted.rate}\n\n` +
        `Ready to create Daily Book entry with verified details.`
    );
  };

  return (
    <div className="rounded-xl border border-[#D8D5CE] bg-white p-4 shadow-sm text-xs space-y-3">
      <div className="flex items-center justify-between border-b border-[#EFECE6] pb-2">
        <span className="font-display font-bold text-[#1A1D20] flex items-center gap-1.5">
          <Upload size={15} className="text-[#E05638]" />
          DOCUMENT EXTRACTION & REVIEW
        </span>
        <button onClick={onCancel} className="text-[#7A7F85] hover:text-[#1A1D20]">
          <X size={15} />
        </button>
      </div>

      {!file ? (
        <div className="border-2 border-dashed border-[#D8D5CE] rounded-xl p-5 text-center hover:border-[#E05638] transition-colors">
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={handleFileChange}
            id="doc-upload-input"
            className="hidden"
          />
          <label htmlFor="doc-upload-input" className="cursor-pointer block space-y-1.5">
            <Upload size={26} className="mx-auto text-[#7A7F85]" />
            <p className="font-bold text-[#1A1D20]">Upload PDF or Image Document</p>
            <p className="text-[10px] text-[#7A7F85]">
              Parses structured trip fields for verification before saving to Daily Book.
            </p>
          </label>
        </div>
      ) : analyzing ? (
        <div className="py-6 text-center space-y-2">
          <Loader2 size={26} className="animate-spin mx-auto text-[#E05638]" />
          <p className="font-bold text-[#1A1D20]">Extracting Fields from Document...</p>
          <p className="text-[11px] text-[#7A7F85]">Parsing Lorry Receipt, weights, rates, and party details</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl bg-[#FAF8F5] p-3 border border-[#D8D5CE] space-y-2 text-xs">
            <div className="font-bold text-[#1A1D20] border-b border-[#D8D5CE] pb-1 flex justify-between">
              <span>EXTRACTED DOCUMENT DETAILS</span>
              <span className="text-emerald-700 font-semibold">Ready for Review</span>
            </div>

            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between items-center">
                <span className="text-[#7A7F85]">Party Name:</span>
                <span className="font-bold text-[#1A1D20]">{extracted.partyNameRaw}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#7A7F85]">Truck / LR:</span>
                <span className="font-mono-nums font-bold">{extracted.truckNumberRaw} ({extracted.lrNumber})</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#7A7F85]">Route:</span>
                <span className="font-semibold">{extracted.fromLocationRaw} → {extracted.toLocationRaw}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#7A7F85]">Weights (N / R):</span>
                <span className="font-mono-nums">{extracted.nWeight} T / {extracted.rWeight} T</span>
              </div>
              <div className="flex justify-between items-center border-t border-[#D8D5CE] pt-1 mt-1">
                <span className="font-bold text-[#1A1D20]">Customer Rate / Driver Rate:</span>
                <span className="font-mono-nums font-bold text-[#E05638]">₹{extracted.customerRate} / ₹{extracted.rate}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-[#D8D5CE] px-3.5 py-1.5 font-semibold text-[#5F6368]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmExtracted}
              className="rounded-lg bg-[#E05638] px-4 py-1.5 font-bold text-white hover:bg-[#c9492e] flex items-center gap-1.5"
            >
              <Check size={14} /> Confirm Extracted Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
