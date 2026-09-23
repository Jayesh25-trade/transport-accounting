"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Settings2, Search, ChevronDown, Save, Info } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/primitives";
import { useMasterList } from "@/lib/use-master-list";
import { useApiClient, ApiError } from "@/lib/api-client";
import { useFirm } from "@/lib/firm-context";
import { Field, FormGrid, FormActions } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────
interface Party {
  id: string;
  name: string;
  tradeName: string | null;
}

interface CustomerRule {
  id: string;
  firmId: string;
  partyId: string;
  freightBasis: "R_WEIGHT" | "N_WEIGHT" | "FIXED";
  shortageApplicable: boolean;
  shortageAllowanceType: "PERCENTAGE" | "FIXED_KG" | null;
  shortageAllowanceValue: string | null;
  shortageRuleType: "EXCESS_ONLY" | "FULL_SHORTAGE" | null;
  materialRatePerTon: string | null;
  tdsApplicable: boolean;
  tdsSection: string | null;
  tdsPercentage: string | null;
}

interface RuleFormState {
  freightBasis: "R_WEIGHT" | "N_WEIGHT" | "FIXED";
  shortageApplicable: boolean;
  shortageAllowanceType: "PERCENTAGE" | "FIXED_KG" | null;
  shortageAllowanceValue: string;
  shortageRuleType: "EXCESS_ONLY" | "FULL_SHORTAGE" | null;
  materialRatePerTon: string;
  tdsApplicable: boolean;
  tdsSection: string;
  tdsPercentage: string;
}

const DEFAULT_RULE: RuleFormState = {
  freightBasis: "R_WEIGHT",
  shortageApplicable: false,
  shortageAllowanceType: null,
  shortageAllowanceValue: "",
  shortageRuleType: null,
  materialRatePerTon: "",
  tdsApplicable: false,
  tdsSection: "94C",
  tdsPercentage: "",
};

function ruleToForm(rule: CustomerRule | null): RuleFormState {
  if (!rule) return DEFAULT_RULE;
  return {
    freightBasis: rule.freightBasis,
    shortageApplicable: rule.shortageApplicable,
    shortageAllowanceType: rule.shortageAllowanceType,
    shortageAllowanceValue: rule.shortageAllowanceValue ?? "",
    shortageRuleType: rule.shortageRuleType,
    materialRatePerTon: rule.materialRatePerTon ?? "",
    tdsApplicable: rule.tdsApplicable,
    tdsSection: rule.tdsSection ?? "94C",
    tdsPercentage: rule.tdsPercentage ?? "",
  };
}

function formToPayload(partyId: string, form: RuleFormState): object {
  return {
    partyId,
    freightBasis: form.freightBasis,
    shortageApplicable: form.shortageApplicable,
    shortageAllowanceType: form.shortageApplicable ? form.shortageAllowanceType : null,
    shortageAllowanceValue:
      form.shortageApplicable && form.shortageAllowanceValue !== ""
        ? parseFloat(form.shortageAllowanceValue)
        : null,
    shortageRuleType: form.shortageApplicable ? form.shortageRuleType : null,
    materialRatePerTon:
      form.shortageApplicable && form.materialRatePerTon !== ""
        ? parseFloat(form.materialRatePerTon)
        : null,
    tdsApplicable: form.tdsApplicable,
    tdsSection: form.tdsApplicable ? (form.tdsSection || null) : null,
    tdsPercentage:
      form.tdsApplicable && form.tdsPercentage !== ""
        ? parseFloat(form.tdsPercentage)
        : null,
  };
}

// ─── Radio Group helper ───────────────────────────────────────
function RadioGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T | null;
  options: { value: T; label: string; desc?: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div className="flex flex-col gap-1.5 mt-1">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={cn(
              "flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors",
              value === opt.value
                ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20"
                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600",
              disabled && "opacity-40 pointer-events-none"
            )}
          >
            <input
              type="radio"
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="mt-0.5 accent-indigo-600"
              disabled={disabled}
            />
            <div>
              <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                {opt.label}
              </div>
              {opt.desc && (
                <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
              )}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── Rule Editor form ─────────────────────────────────────────
function RuleEditor({
  partyId,
  onSaved,
}: {
  partyId: string;
  onSaved: () => void;
}) {
  const api = useApiClient();
  const [form, setForm] = useState<RuleFormState>(DEFAULT_RULE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load existing rule
  useEffect(() => {
    if (!partyId || !api.ready) return;
    setLoading(true);
    setError(null);
    api
      .get<CustomerRule | null>(`/api/customer-rules?partyId=${partyId}`)
      .then((rule) => setForm(ruleToForm(rule)))
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Failed to load rules")
      )
      .finally(() => setLoading(false));
  }, [partyId, api.firmUuid]);

  function set<K extends keyof RuleFormState>(field: K, value: RuleFormState[K]) {
    setForm((f) => ({ ...f, [field]: value }));
    setError(null);
    setSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await api.post<CustomerRule>("/api/customer-rules", formToPayload(partyId, form));
      setSuccess(true);
      onSaved();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-gray-400 text-sm">
        <div className="skeleton h-4 w-48 rounded" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {/* ── Freight Basis ── */}
      <div className="card">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
          Freight Calculation Basis
        </h3>
        <RadioGroup
          label=""
          value={form.freightBasis}
          onChange={(v) => set("freightBasis", v)}
          options={[
            {
              value: "R_WEIGHT",
              label: "R-Weight × Rate",
              desc: "Received/unloaded weight × freight rate per ton",
            },
            {
              value: "N_WEIGHT",
              label: "N-Weight × Rate",
              desc: "Net/loading weight × freight rate per ton",
            },
            {
              value: "FIXED",
              label: "Fixed Per Trip",
              desc: "Fixed freight amount regardless of weight",
            },
          ]}
        />
      </div>

      {/* ── Shortage ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Shortage Debit
          </h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.shortageApplicable}
              onChange={(e) => set("shortageApplicable", e.target.checked)}
              className="accent-indigo-600"
              id="shortage-applicable"
            />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Applicable
            </span>
          </label>
        </div>

        <div className={cn(!form.shortageApplicable && "opacity-40 pointer-events-none")}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <RadioGroup
              label="Shortage Rule"
              value={form.shortageRuleType}
              onChange={(v) => set("shortageRuleType", v)}
              disabled={!form.shortageApplicable}
              options={[
                {
                  value: "EXCESS_ONLY",
                  label: "Rule A — Excess Only",
                  desc: "Debit only the shortage exceeding the allowance",
                },
                {
                  value: "FULL_SHORTAGE",
                  label: "Rule B — Full Shortage",
                  desc: "Debit the full shortage once allowance threshold is crossed",
                },
              ]}
            />
            <RadioGroup
              label="Allowance Type"
              value={form.shortageAllowanceType}
              onChange={(v) => set("shortageAllowanceType", v)}
              disabled={!form.shortageApplicable}
              options={[
                {
                  value: "PERCENTAGE",
                  label: "Percentage (%)",
                  desc: "e.g. 1% of loading weight",
                },
                {
                  value: "FIXED_KG",
                  label: "Fixed KG",
                  desc: "e.g. 300 KG per trip",
                },
              ]}
            />
          </div>

          <FormGrid>
            <Field
              label={
                form.shortageAllowanceType === "PERCENTAGE"
                  ? "Allowance (%)"
                  : "Allowance (KG)"
              }
              hint="Enter the allowance value"
            >
              <input
                type="number"
                id="shortage-allowance-value"
                step="0.01"
                min="0"
                value={form.shortageAllowanceValue}
                onChange={(e) => set("shortageAllowanceValue", e.target.value)}
                placeholder={form.shortageAllowanceType === "PERCENTAGE" ? "e.g. 1.00" : "e.g. 300"}
                className="form-input"
                disabled={!form.shortageApplicable}
              />
            </Field>
            <Field
              label="Material Rate per Ton (₹)"
              hint="Used for shortage debit valuation — NOT freight rate"
            >
              <input
                type="number"
                id="shortage-material-rate"
                step="0.01"
                min="0"
                value={form.materialRatePerTon}
                onChange={(e) => set("materialRatePerTon", e.target.value)}
                placeholder="e.g. 3500.00"
                className="form-input"
                disabled={!form.shortageApplicable}
              />
            </Field>
          </FormGrid>

          <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <Info size={12} className="flex-shrink-0 mt-0.5" />
            <span>
              Shortage = N-Weight (loading) − R-Weight (unloading).
              Debit = Applicable Shortage × <strong>Material Rate</strong> (not freight rate).
            </span>
          </div>
        </div>
      </div>

      {/* ── TDS ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            TDS Deduction
          </h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.tdsApplicable}
              onChange={(e) => set("tdsApplicable", e.target.checked)}
              className="accent-indigo-600"
              id="tds-applicable"
            />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Applicable
            </span>
          </label>
        </div>

        <div className={cn(!form.tdsApplicable && "opacity-40 pointer-events-none")}>
          <FormGrid>
            <Field label="TDS Section" hint="e.g. 94C">
              <input
                type="text"
                id="tds-section"
                value={form.tdsSection}
                onChange={(e) => set("tdsSection", e.target.value)}
                placeholder="94C"
                className="form-input"
                disabled={!form.tdsApplicable}
              />
            </Field>
            <Field
              label="TDS Rate (%)"
              hint="Applied on Gross Bill Amount"
            >
              <input
                type="number"
                id="tds-percentage"
                step="0.01"
                min="0"
                max="100"
                value={form.tdsPercentage}
                onChange={(e) => set("tdsPercentage", e.target.value)}
                placeholder="e.g. 1.00"
                className="form-input"
                disabled={!form.tdsApplicable}
              />
            </Field>
          </FormGrid>
          <p className="text-xs text-gray-400 mt-2">
            TDS is calculated on the <strong>Gross Bill Amount</strong>{" "}
            (e.g. ₹1,00,000 × 1% = ₹1,000). It is recorded at bill creation and
            recalculated on bill edits.
          </p>
        </div>
      </div>

      {/* Status */}
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3">
          <p className="text-xs text-green-600 dark:text-green-400">
            ✓ Rules saved successfully
          </p>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={saving}
          id="customer-rules-save"
        >
          {saving ? (
            <span className="flex items-center gap-1.5">
              <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Saving…
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Save size={14} />
              Save Rules
            </span>
          )}
        </button>
      </div>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function CustomerRulesPage() {
  const { currentFirm, loading: firmLoading } = useFirm();
  const { data: parties, loading: partiesLoading } = useMasterList<Party>({
    endpoint: "/api/parties",
  });

  const [search, setSearch] = useState("");
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  // Auto-select first party when list loads
  useEffect(() => {
    if (!selectedPartyId && parties.length > 0) {
      setSelectedPartyId(parties[0].id);
    }
  }, [parties, selectedPartyId]);

  // Reset selection on firm change
  useEffect(() => {
    setSelectedPartyId(null);
  }, [currentFirm?.id]);

  const filteredParties = search.trim()
    ? parties.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : parties;

  const selectedParty = parties.find((p) => p.id === selectedPartyId) ?? null;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Customer Rules"
        subtitle="Per-party freight, shortage, and TDS configuration"
        breadcrumbs={[{ label: "Masters" }, { label: "Customer Rules" }]}
      />

      {parties.length === 0 && !partiesLoading && (
        <div className="card mb-6">
          <div className="flex items-start gap-3">
            <Info size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">No parties found</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Add parties first, then configure rules here.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-4 h-[calc(100dvh-180px)]">
        {/* ── Party selector panel ── */}
        <div className="w-60 flex-shrink-0 flex flex-col bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="p-2.5 border-b border-gray-200 dark:border-gray-800">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                placeholder="Search parties…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="form-input pl-6 py-1.5 text-xs"
                id="customer-rules-party-search"
              />
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {partiesLoading ? (
              <div className="p-3 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton h-8 rounded" />
                ))}
              </div>
            ) : filteredParties.length === 0 ? (
              <div className="p-4 text-xs text-gray-400 text-center">
                No parties found
              </div>
            ) : (
              filteredParties.map((party) => (
                <button
                  key={party.id}
                  onClick={() => setSelectedPartyId(party.id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 text-sm transition-colors",
                    party.id === selectedPartyId
                      ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-medium"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                  )}
                  id={`customer-rules-party-${party.id}`}
                >
                  <div className="truncate">{party.name}</div>
                  {party.tradeName && (
                    <div className="text-xs text-gray-400 truncate">{party.tradeName}</div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Rule editor panel ── */}
        <div className="flex-1 overflow-y-auto">
          {!selectedParty ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Settings2 size={32} className="mb-3 text-gray-300" />
              <p className="text-sm">Select a party to configure their rules</p>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">
                  {selectedParty.name}
                </h2>
                {selectedParty.tradeName && (
                  <span className="text-sm text-gray-400">({selectedParty.tradeName})</span>
                )}
              </div>
              <RuleEditor
                key={`${selectedPartyId}-${savedCount}-${currentFirm?.id}`}
                partyId={selectedPartyId!}
                onSaved={() => setSavedCount((n) => n + 1)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
