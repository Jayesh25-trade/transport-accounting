"use client";

import React, { useState, useEffect } from "react";
import { Save, CheckCircle2, Sliders, Building2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button, Panel } from "@/components/ui/primitives";
import { Field } from "@/components/ui/modal";
import { useMasterList } from "@/lib/use-master-list";
import { useApiClient, ApiError } from "@/lib/api-client";
import { useFirm } from "@/lib/firm-context";

interface BankAccountRecord {
  id: string;
  accountDisplayName: string;
  bankName: string;
  isActive: boolean;
}

interface BillSettingsState {
  defaultBankAccountId: string;
  defaultPaymentTerms: string;
  defaultTermsAndConditions: string;
  defaultRemarks: string;
  showBankDetails: boolean;
  showPaymentTerms: boolean;
  showDueDate: boolean;
  showAmountInWords: boolean;
  showRemarks: boolean;
  showTermsAndConditions: boolean;
  showAuthorisedSignature: boolean;
  showVehicleType: boolean;
  showGstDetails: boolean;
  showReverseCharge: boolean;
  showPlaceOfSupply: boolean;
}

const initialSettingsState: BillSettingsState = {
  defaultBankAccountId: "",
  defaultPaymentTerms: "30 Days",
  defaultTermsAndConditions: "Payment to be made within 30 days. Subject to local jurisdiction.",
  defaultRemarks: "Bill for transportation charges.",
  showBankDetails: true,
  showPaymentTerms: true,
  showDueDate: true,
  showAmountInWords: true,
  showRemarks: true,
  showTermsAndConditions: true,
  showAuthorisedSignature: true,
  showVehicleType: false,
  showGstDetails: false,
  showReverseCharge: false,
  showPlaceOfSupply: false,
};

export default function BillSettingsPage() {
  const api = useApiClient();
  const { currentFirm } = useFirm();

  const { data: bankAccounts } = useMasterList<BankAccountRecord>({
    endpoint: "/api/bank-accounts",
  });

  const [settings, setSettings] = useState<BillSettingsState>(initialSettingsState);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!api.ready) return;

    api
      .get<BillSettingsState>("/api/bill-settings")
      .then((res) => {
        if (res) {
          setSettings({
            defaultBankAccountId: res.defaultBankAccountId || "",
            defaultPaymentTerms: res.defaultPaymentTerms || "30 Days",
            defaultTermsAndConditions: res.defaultTermsAndConditions || "",
            defaultRemarks: res.defaultRemarks || "",
            showBankDetails: res.showBankDetails ?? true,
            showPaymentTerms: res.showPaymentTerms ?? true,
            showDueDate: res.showDueDate ?? true,
            showAmountInWords: res.showAmountInWords ?? true,
            showRemarks: res.showRemarks ?? true,
            showTermsAndConditions: res.showTermsAndConditions ?? true,
            showAuthorisedSignature: res.showAuthorisedSignature ?? true,
            showVehicleType: res.showVehicleType ?? false,
            showGstDetails: res.showGstDetails ?? false,
            showReverseCharge: res.showReverseCharge ?? false,
            showPlaceOfSupply: res.showPlaceOfSupply ?? false,
          });
        }
      })
      .catch((err) => {
        console.error("Failed to load bill settings:", err);
      })
      .finally(() => setLoading(false));
  }, [api.ready]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessNotice(null);

    try {
      await api.put("/api/bill-settings", settings);
      setSuccessNotice("Bill presentation defaults updated successfully.");
      setTimeout(() => setSuccessNotice(null), 4000);
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : "Failed to save settings.");
    } finally {
      setSubmitting(false);
    }
  }

  function toggleOption(key: keyof BillSettingsState) {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  return (
    <div className="space-y-5 animate-fade-in text-[#1A1D20] max-w-4xl">
      <PageHeader
        title="Default Bill Settings"
        subtitle="Bill display settings and default terms."
        breadcrumbs={[
          { label: "Masters", href: "/masters/parties" },
          { label: "Bill Settings" },
        ]}
      />

      {successNotice && (
        <div className="rounded-xl border border-emerald-600/30 bg-emerald-50 p-3.5 flex items-center gap-2 text-xs font-semibold text-emerald-800">
          <CheckCircle2 size={16} className="text-emerald-600" />
          {successNotice}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-[#D32F2F]/30 bg-[#FDEDED] p-3.5 text-xs text-[#D32F2F]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-[#7A7F85]">Loading bill settings…</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Default Bank Account & Terms Panel */}
          <Panel title="Default Bank Account & Terms" subtitle="Default values auto-populated when creating a new bill.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <Field label="Default Bank Account for Bills" hint="Shown at the bottom of bills for receiving payments">
                <select
                  value={settings.defaultBankAccountId}
                  onChange={(e) => setSettings({ ...settings, defaultBankAccountId: e.target.value })}
                  className="form-input"
                >
                  <option value="">-- Select Default Bank Account --</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.accountDisplayName} ({b.bankName})
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Default Payment Terms" hint="e.g. 30 Days, Due on Receipt">
                <input
                  type="text"
                  value={settings.defaultPaymentTerms}
                  onChange={(e) => setSettings({ ...settings, defaultPaymentTerms: e.target.value })}
                  placeholder="30 Days"
                  className="form-input"
                />
              </Field>

              <div className="md:col-span-2">
                <Field label="Default Terms & Conditions" hint="Standard legal / terms notice printed on bills">
                  <textarea
                    rows={2}
                    value={settings.defaultTermsAndConditions}
                    onChange={(e) => setSettings({ ...settings, defaultTermsAndConditions: e.target.value })}
                    placeholder="Payment to be made within 30 days..."
                    className="form-input font-mono text-xs"
                  />
                </Field>
              </div>

              <div className="md:col-span-2">
                <Field label="Default Bill Remarks" hint="General notes/remarks footer text">
                  <textarea
                    rows={2}
                    value={settings.defaultRemarks}
                    onChange={(e) => setSettings({ ...settings, defaultRemarks: e.target.value })}
                    placeholder="Bill for transportation charges..."
                    className="form-input"
                  />
                </Field>
              </div>
            </div>
          </Panel>

          {/* Optional Display Features Toggles */}
          <Panel title="Bill Optional Display Sections" subtitle="Control which optional blocks are enabled by default for new bills.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {[
                { key: "showBankDetails", label: "Bank Account Details", desc: "Show bank name, A/c No, IFSC for payment" },
                { key: "showPaymentTerms", label: "Payment Terms", desc: "Show payment due terms (e.g. 30 Days)" },
                { key: "showDueDate", label: "Due Date", desc: "Display calculated payment due date" },
                { key: "showAmountInWords", label: "Amount in Words", desc: "Print total net payable amount in words" },
                { key: "showRemarks", label: "Remarks / Notes", desc: "Show notes and remarks section" },
                { key: "showTermsAndConditions", label: "Terms & Conditions", desc: "Show terms & conditions footer block" },
                { key: "showAuthorisedSignature", label: "Authorised Signature Block", desc: "Show signature line and firm name" },
                { key: "showVehicleType", label: "Vehicle Type", desc: "Show truck vehicle type classification" },
                { key: "showGstDetails", label: "GST Details", desc: "Include GSTIN / Tax identification block" },
                { key: "showReverseCharge", label: "Reverse Charge (RCM)", desc: "Show RCM tax liability indicator" },
                { key: "showPlaceOfSupply", label: "Place of Supply", desc: "Show state code and place of supply" },
              ].map((opt) => (
                <div
                  key={opt.key}
                  onClick={() => toggleOption(opt.key as keyof BillSettingsState)}
                  className={`p-3 rounded-xl border transition-colors cursor-pointer flex items-start gap-3 ${
                    settings[opt.key as keyof BillSettingsState]
                      ? "bg-[#FAF8F5] border-[#E05638]/40"
                      : "bg-white border-[#D8D5CE] opacity-60"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(settings[opt.key as keyof BillSettingsState])}
                    onChange={() => {}}
                    className="mt-0.5 rounded border-[#D8D5CE] text-[#E05638] focus:ring-[#E05638]"
                  />
                  <div>
                    <h4 className="font-bold text-[#1A1D20]">{opt.label}</h4>
                    <p className="text-[11px] text-[#7A7F85]">{opt.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <div className="flex justify-end pt-2">
            <Button variant="coral" type="submit" disabled={submitting} className="font-bold">
              <Save size={16} />
              {submitting ? "Saving Defaults…" : "Save Default Settings"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
