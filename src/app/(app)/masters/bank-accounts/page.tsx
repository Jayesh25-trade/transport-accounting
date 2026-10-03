"use client";

import React, { useState } from "react";
import { Plus, Edit2, CheckCircle2, Star, Building2, CreditCard } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button, Badge, EmptyState } from "@/components/ui/primitives";
import { Modal, Field } from "@/components/ui/modal";
import { useMasterList } from "@/lib/use-master-list";
import { useApiClient, ApiError } from "@/lib/api-client";
import { useFirm } from "@/lib/firm-context";

interface BankAccountRecord {
  id: string;
  firmId: string;
  accountDisplayName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branch: string | null;
  accountType: string;
  upiId: string | null;
  isDefaultForBills: boolean;
  isActive: boolean;
}

interface FormState {
  accountDisplayName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branch: string;
  accountType: string;
  upiId: string;
  isDefaultForBills: boolean;
  isActive: boolean;
}

const initialFormState: FormState = {
  accountDisplayName: "",
  bankName: "",
  accountNumber: "",
  ifscCode: "",
  branch: "",
  accountType: "CURRENT",
  upiId: "",
  isDefaultForBills: false,
  isActive: true,
};

export default function BankAccountsPage() {
  const api = useApiClient();
  const { currentFirm } = useFirm();
  const { data: accounts, loading, refresh } = useMasterList<BankAccountRecord>({
    endpoint: "/api/bank-accounts?includeInactive=true",
  });

  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccountRecord | null>(null);
  const [form, setForm] = useState<FormState>(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenCreate() {
    setEditingAccount(null);
    setForm(initialFormState);
    setError(null);
    setShowModal(true);
  }

  function handleOpenEdit(acc: BankAccountRecord) {
    setEditingAccount(acc);
    setForm({
      accountDisplayName: acc.accountDisplayName,
      bankName: acc.bankName,
      accountNumber: acc.accountNumber,
      ifscCode: acc.ifscCode,
      branch: acc.branch || "",
      accountType: acc.accountType,
      upiId: acc.upiId || "",
      isDefaultForBills: acc.isDefaultForBills,
      isActive: acc.isActive,
    });
    setError(null);
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.accountDisplayName || !form.bankName || !form.accountNumber || !form.ifscCode) {
      setError("Display Name, Bank Name, Account Number, and IFSC Code are required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (editingAccount) {
        await api.put(`/api/bank-accounts/${editingAccount.id}`, form);
      } else {
        await api.post("/api/bank-accounts", form);
      }
      setShowModal(false);
      refresh();
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : "Failed to save bank account.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSetDefault(id: string) {
    try {
      await api.post(`/api/bank-accounts/${id}/default`, {});
      refresh();
    } catch (err: any) {
      console.error("Failed to set default bank account:", err);
    }
  }

  return (
    <div className="space-y-5 animate-fade-in text-[#1A1D20]">
      <PageHeader
        title="Bank Accounts Master"
        subtitle="Bank accounts for bill payments."
        breadcrumbs={[
          { label: "Masters", href: "/masters/parties" },
          { label: "Bank Accounts" },
        ]}
        actions={
          <Button variant="coral" onClick={handleOpenCreate} id="add-bank-account-btn">
            <Plus size={16} />
            + Add Bank Account
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-[#7A7F85] text-xs">
            Loading bank accounts…
          </div>
        ) : accounts.length === 0 ? (
          <div className="col-span-full">
            <EmptyState
              title="No bank accounts configured"
              description="Add a bank account to display payment instructions on customer bills."
              action={
                <Button variant="coral" onClick={handleOpenCreate}>
                  + Add First Bank Account
                </Button>
              }
            />
          </div>
        ) : (
          accounts.map((acc) => (
            <div
              key={acc.id}
              className={`rounded-2xl border p-4 transition-all bg-white shadow-xs relative flex flex-col justify-between space-y-3 ${
                acc.isDefaultForBills ? "border-[#E05638] ring-1 ring-[#E05638]/20" : "border-[#D8D5CE]"
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Building2 size={18} className="text-[#E05638] shrink-0" />
                    <div>
                      <h3 className="font-bold text-sm text-[#1A1D20]">{acc.accountDisplayName}</h3>
                      <p className="text-xs text-[#5F6368] font-medium">{acc.bankName}</p>
                    </div>
                  </div>
                  {acc.isDefaultForBills ? (
                    <Badge variant="coral" className="shrink-0 flex items-center gap-1">
                      <Star size={11} className="fill-current" /> Default for Bills
                    </Badge>
                  ) : (
                    <Badge variant={acc.isActive ? "success" : "neutral"} className="shrink-0">
                      {acc.isActive ? "ACTIVE" : "INACTIVE"}
                    </Badge>
                  )}
                </div>

                <div className="pt-2 border-t border-[#EFECE6] text-xs space-y-1 font-mono-nums">
                  <div className="flex justify-between">
                    <span className="text-[#7A7F85] font-sans">Account No:</span>
                    <span className="font-bold text-[#1A1D20]">{acc.accountNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#7A7F85] font-sans">IFSC Code:</span>
                    <span className="font-semibold">{acc.ifscCode}</span>
                  </div>
                  {acc.branch && (
                    <div className="flex justify-between">
                      <span className="text-[#7A7F85] font-sans">Branch:</span>
                      <span className="text-[#5F6368] font-sans">{acc.branch}</span>
                    </div>
                  )}
                  {acc.upiId && (
                    <div className="flex justify-between">
                      <span className="text-[#7A7F85] font-sans">UPI ID:</span>
                      <span className="text-[#0288D1] font-sans">{acc.upiId}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-[#EFECE6] flex items-center justify-between text-xs">
                {!acc.isDefaultForBills && acc.isActive && (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(acc.id)}
                    className="text-[#E05638] font-semibold hover:underline flex items-center gap-1"
                  >
                    <CheckCircle2 size={13} /> Set as Bill Default
                  </button>
                )}
                <div className="ml-auto">
                  <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(acc)}>
                    <Edit2 size={13} /> Edit
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Form */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingAccount ? "Edit Bank Account" : "Add Bank Account"}
      >
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          {error && (
            <div className="p-2.5 rounded-lg bg-[#FDEDED] text-[#D32F2F] text-xs">
              {error}
            </div>
          )}

          <Field label="Account Display Name" required hint="e.g. HDFC Main Operating Account">
            <input
              type="text"
              className="form-input"
              value={form.accountDisplayName}
              onChange={(e) => setForm({ ...form, accountDisplayName: e.target.value })}
              placeholder="e.g. HDFC Main Account"
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Bank Name" required>
              <input
                type="text"
                className="form-input"
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                placeholder="e.g. HDFC Bank"
              />
            </Field>

            <Field label="Account Type">
              <select
                className="form-input"
                value={form.accountType}
                onChange={(e) => setForm({ ...form, accountType: e.target.value })}
              >
                <option value="CURRENT">Current Account</option>
                <option value="SAVINGS">Savings Account</option>
                <option value="CC_OD">CC / OD Account</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Account Number" required>
              <input
                type="text"
                className="form-input font-mono-nums"
                value={form.accountNumber}
                onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                placeholder="e.g. 50200012345678"
              />
            </Field>

            <Field label="IFSC Code" required>
              <input
                type="text"
                className="form-input uppercase font-mono-nums"
                value={form.ifscCode}
                onChange={(e) => setForm({ ...form, ifscCode: e.target.value })}
                placeholder="HDFC0001234"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Branch Name (Optional)">
              <input
                type="text"
                className="form-input"
                value={form.branch}
                onChange={(e) => setForm({ ...form, branch: e.target.value })}
                placeholder="e.g. Industrial Estate Branch"
              />
            </Field>

            <Field label="UPI ID (Optional)">
              <input
                type="text"
                className="form-input"
                value={form.upiId}
                onChange={(e) => setForm({ ...form, upiId: e.target.value })}
                placeholder="e.g. deepraj@hdfcbank"
              />
            </Field>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-[#1A1D20]">
              <input
                type="checkbox"
                checked={form.isDefaultForBills}
                onChange={(e) => setForm({ ...form, isDefaultForBills: e.target.checked })}
                className="rounded border-[#D8D5CE] text-[#E05638] focus:ring-[#E05638]"
              />
              Set as Default Bank Account for new Bills
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-[#5F6368]">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="rounded border-[#D8D5CE] text-[#E05638] focus:ring-[#E05638]"
              />
              Active Account
            </label>
          </div>

          <div className="pt-3 border-t border-[#EFECE6] flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button variant="coral" type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save Account"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
