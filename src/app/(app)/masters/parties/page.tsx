"use client";

import React, { useState, useMemo } from "react";
import { Plus, Search, Pencil, Users } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { Button, Badge, EmptyState } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useMasterList, useMasterMutation } from "@/lib/use-master-list";
import { useFirm } from "@/lib/firm-context";
import { Modal, Field, FormGrid, FormActions } from "@/components/ui/modal";

// ─── Types (match DB schema exactly) ─────────────────────────
interface Party {
  id: string;
  firmId: string;
  name: string;
  tradeName: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  pan: string | null;
  gstin: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type PartyFormData = Omit<Party, "id" | "firmId" | "isActive" | "createdAt" | "updatedAt">;

const EMPTY_FORM: PartyFormData = {
  name: "",
  tradeName: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  pan: "",
  gstin: "",
};

// ─── Form Component ───────────────────────────────────────────
interface PartyFormProps {
  initial?: Partial<PartyFormData>;
  onSubmit: (data: PartyFormData) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  error: string | null;
  submitLabel?: string;
}

function PartyForm({
  initial,
  onSubmit,
  onCancel,
  loading,
  error,
  submitLabel,
}: PartyFormProps) {
  const [form, setForm] = useState<PartyFormData>({ ...EMPTY_FORM, ...initial });
  const [errors, setErrors] = useState<Partial<Record<keyof PartyFormData, string>>>({});

  function set(field: keyof PartyFormData, value: string) {
    setForm((f) => ({ ...f, [field]: value || null }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate(): boolean {
    const e: typeof errors = {};
    if (!form.name?.trim()) e.name = "Party name is required";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      e.email = "Invalid email format";
    }
    if (form.gstin && form.gstin.length > 20) e.gstin = "GSTIN must be 20 chars or fewer";
    if (form.pan && form.pan.length > 20) e.pan = "PAN must be 20 chars or fewer";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    // Normalize empty strings to null
    const cleaned: PartyFormData = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v === "" ? null : v])
    ) as PartyFormData;
    onSubmit(cleaned);
  }

  const inp = (
    field: keyof PartyFormData,
    placeholder?: string,
    type = "text"
  ) => (
    <input
      type={type}
      id={`party-form-${field}`}
      value={(form[field] as string) ?? ""}
      onChange={(e) => set(field, e.target.value)}
      placeholder={placeholder}
      className="form-input"
    />
  );

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="space-y-3">
        <FormGrid cols={1}>
          <Field label="Party Name" required error={errors.name}>
            {inp("name", "e.g. Fairway Dream Pvt. Ltd.")}
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Trade Name" error={errors.tradeName}>
            {inp("tradeName", "Optional trade / short name")}
          </Field>
          <Field label="Contact Person" error={errors.contactPerson}>
            {inp("contactPerson", "e.g. Rahul Sharma")}
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Phone" error={errors.phone}>
            {inp("phone", "10-digit mobile number")}
          </Field>
          <Field label="Email" error={errors.email}>
            {inp("email", "billing@example.com", "email")}
          </Field>
        </FormGrid>
        <FormGrid cols={1}>
          <Field label="Address" error={errors.address}>
            <textarea
              id="party-form-address"
              value={form.address ?? ""}
              onChange={(e) => set("address", e.target.value)}
              placeholder="Full postal address"
              className="form-input min-h-[64px] resize-y"
              rows={2}
            />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="City" error={errors.city}>
            {inp("city", "e.g. Mumbai")}
          </Field>
          <Field label="State" error={errors.state}>
            {inp("state", "e.g. Maharashtra")}
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Pincode" error={errors.pincode}>
            {inp("pincode", "6-digit pincode")}
          </Field>
          <div />
        </FormGrid>

        {/* Tax identifiers */}
        <div className="pt-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Tax Identifiers
          </p>
          <FormGrid>
            <Field
              label="PAN"
              error={errors.pan}
              hint="Permanent Account Number"
            >
              {inp("pan", "AAAPA1234B")}
            </Field>
            <Field
              label="GSTIN"
              error={errors.gstin}
              hint="GST Identification Number"
            >
              {inp("gstin", "27AAAPA1234B1Z5")}
            </Field>
          </FormGrid>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Opening Balance Notice */}
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 p-3">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            <strong>Opening Balance</strong> is managed separately in the
            Opening Balance module — not from this form.
          </p>
        </div>
      </div>

      <FormActions
        onCancel={onCancel}
        loading={loading}
        submitLabel={submitLabel ?? "Save Party"}
      />
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function PartiesPage() {
  const { currentFirm, loading: firmLoading } = useFirm();
  const { data: parties, loading, error, refresh } = useMasterList<Party>({
    endpoint: "/api/parties",
  });
  const { submitting, submitError, create, update } = useMasterMutation("/api/parties");

  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<
    | { mode: "create" }
    | { mode: "edit"; party: Party }
    | null
  >(null);

  // Client-side search filter
  const filtered = useMemo(() => {
    if (!search.trim()) return parties;
    const q = search.toLowerCase();
    return parties.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.tradeName ?? "").toLowerCase().includes(q) ||
        (p.phone ?? "").includes(q) ||
        (p.pan ?? "").toLowerCase().includes(q) ||
        (p.gstin ?? "").toLowerCase().includes(q)
    );
  }, [parties, search]);

  async function handleCreate(data: PartyFormData) {
    const ok = await create(data);
    if (ok) {
      setModal(null);
      refresh();
    }
  }

  async function handleUpdate(id: string, data: PartyFormData) {
    const ok = await update(id, data);
    if (ok) {
      setModal(null);
      refresh();
    }
  }

  const columns: Column<Party>[] = [
    {
      key: "name",
      label: "Party Name",
      render: (p) => (
        <div>
          <div className="font-medium">{p.name}</div>
          {p.tradeName && (
            <div className="text-xs text-gray-400">{p.tradeName}</div>
          )}
        </div>
      ),
    },
    {
      key: "phone",
      label: "Phone",
      render: (p) => p.phone ?? <span className="text-gray-400">—</span>,
    },
    {
      key: "gstin",
      label: "GSTIN",
      render: (p) =>
        p.gstin ? (
          <span className="font-mono text-xs">{p.gstin}</span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: "pan",
      label: "PAN",
      render: (p) =>
        p.pan ? (
          <span className="font-mono text-xs">{p.pan}</span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: "city",
      label: "City",
      render: (p) => p.city ?? <span className="text-gray-400">—</span>,
    },
    {
      key: "isActive",
      label: "Status",
      render: (p) => (
        <Badge variant={p.isActive ? "success" : "neutral"}>
          {p.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (p) => (
        <button
          className="btn btn-ghost btn-sm"
          onClick={(e) => {
            e.stopPropagation();
            setModal({ mode: "edit", party: p });
          }}
          id={`party-edit-${p.id}`}
          title="Edit party"
        >
          <Pencil size={13} />
        </button>
      ),
    },
  ];

  const editParty = modal?.mode === "edit" ? modal.party : null;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Parties"
        subtitle="Billing & payment customers — strictly isolated per firm"
        breadcrumbs={[{ label: "Masters" }, { label: "Parties" }]}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => setModal({ mode: "create" })}
            id="parties-add-new"
            disabled={firmLoading || !currentFirm}
          >
            Add Party
          </Button>
        }
      />

      {/* Error banner */}
      {error && (
        <div className="card mb-4 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10">
          <p className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        </div>
      )}

      {/* Search bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Search by name, phone, PAN, GSTIN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input pl-8"
            id="parties-search"
          />
        </div>
        <span className="text-xs text-gray-400">
          {loading ? "Loading…" : `${filtered.length} record${filtered.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        emptyState={
          <EmptyState
            icon={Users}
            title={search ? "No parties match your search" : "No parties yet"}
            description={
              search
                ? "Try a different search term."
                : "Add your first billing party to get started."
            }
            action={
              !search ? (
                <Button
                  variant="primary"
                  size="sm"
                  icon={Plus}
                  onClick={() => setModal({ mode: "create" })}
                >
                  Add Party
                </Button>
              ) : undefined
            }
          />
        }
        onRowClick={(p) => setModal({ mode: "edit", party: p })}
      />

      {/* Create Modal */}
      <Modal
        open={modal?.mode === "create"}
        onClose={() => setModal(null)}
        title="Add Party"
        size="lg"
      >
        <PartyForm
          onSubmit={handleCreate}
          onCancel={() => setModal(null)}
          loading={submitting}
          error={submitError}
          submitLabel="Add Party"
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={modal?.mode === "edit"}
        onClose={() => setModal(null)}
        title={`Edit Party — ${editParty?.name ?? ""}`}
        size="lg"
      >
        {editParty && (
          <PartyForm
            initial={editParty}
            onSubmit={(data) => handleUpdate(editParty.id, data)}
            onCancel={() => setModal(null)}
            loading={submitting}
            error={submitError}
            submitLabel="Save Changes"
          />
        )}
      </Modal>
    </div>
  );
}
