"use client";

import React, { useState, useMemo } from "react";
import { Plus, Search, Pencil, Building2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button, Badge, EmptyState } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useMasterList, useMasterMutation } from "@/lib/use-master-list";
import { useFirm } from "@/lib/firm-context";
import { Modal, Field, FormGrid, FormActions } from "@/components/ui/modal";

// ─── Types ────────────────────────────────────────────────────
interface Company {
  id: string;
  firmId: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  contactPerson: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type CompanyFormData = Omit<Company, "id" | "firmId" | "isActive" | "createdAt" | "updatedAt">;

const EMPTY_FORM: CompanyFormData = {
  name: "",
  address: null,
  city: null,
  state: null,
  contactPerson: null,
  phone: null,
};

// ─── Form ─────────────────────────────────────────────────────
interface CompanyFormProps {
  initial?: Partial<CompanyFormData>;
  onSubmit: (data: CompanyFormData) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  error: string | null;
  submitLabel?: string;
}

function CompanyForm({
  initial,
  onSubmit,
  onCancel,
  loading,
  error,
  submitLabel,
}: CompanyFormProps) {
  const [form, setForm] = useState<CompanyFormData>({ ...EMPTY_FORM, ...initial });
  const [errors, setErrors] = useState<Partial<Record<keyof CompanyFormData, string>>>({});

  function set(field: keyof CompanyFormData, value: string) {
    setForm((f) => ({ ...f, [field]: value || null }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate(): boolean {
    const e: typeof errors = {};
    if (!form.name?.trim()) e.name = "Company name is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const cleaned: CompanyFormData = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v === "" ? null : v])
    ) as CompanyFormData;
    onSubmit(cleaned);
  }

  const inp = (field: keyof CompanyFormData, placeholder?: string) => (
    <input
      type="text"
      id={`company-form-${field}`}
      value={(form[field] as string) ?? ""}
      onChange={(e) => set(field, e.target.value)}
      placeholder={placeholder}
      className="form-input"
    />
  );

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="space-y-3">
        {/* NOTE: Company ≠ Party — remind user visually */}
        <div className="rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 p-3 mb-2">
          <p className="text-xs text-blue-700 dark:text-blue-400">
            <strong>Company</strong> = loading/dispatch site record only. Companies do{" "}
            <strong>not</strong> hold financial ledgers. For billing entities, use{" "}
            <strong>Parties</strong>.
          </p>
        </div>

        <FormGrid cols={1}>
          <Field label="Company Name" required error={errors.name}>
            {inp("name", "e.g. Parle Industries Ltd.")}
          </Field>
        </FormGrid>
        <FormGrid cols={1}>
          <Field label="Address" error={errors.address}>
            <textarea
              id="company-form-address"
              value={form.address ?? ""}
              onChange={(e) => set("address", e.target.value)}
              placeholder="Loading/dispatch address"
              className="form-input min-h-[64px] resize-y"
              rows={2}
            />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="City" error={errors.city}>
            {inp("city", "e.g. Pune")}
          </Field>
          <Field label="State" error={errors.state}>
            {inp("state", "e.g. Maharashtra")}
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Contact Person" error={errors.contactPerson}>
            {inp("contactPerson", "e.g. Site Manager")}
          </Field>
          <Field label="Phone" error={errors.phone}>
            {inp("phone", "10-digit number")}
          </Field>
        </FormGrid>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
      </div>
      <FormActions
        onCancel={onCancel}
        loading={loading}
        submitLabel={submitLabel ?? "Save Company"}
      />
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function CompaniesPage() {
  const { currentFirm, loading: firmLoading } = useFirm();
  const { data: companies, loading, error, refresh } = useMasterList<Company>({
    endpoint: "/api/companies",
  });
  const { submitting, submitError, create, update } = useMasterMutation("/api/companies");

  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<
    | { mode: "create" }
    | { mode: "edit"; company: Company }
    | null
  >(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return companies;
    const q = search.toLowerCase();
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.city ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").includes(q)
    );
  }, [companies, search]);

  async function handleCreate(data: CompanyFormData) {
    const ok = await create(data);
    if (ok) { setModal(null); refresh(); }
  }

  async function handleUpdate(id: string, data: CompanyFormData) {
    const ok = await update(id, data);
    if (ok) { setModal(null); refresh(); }
  }

  const columns: Column<Company>[] = [
    {
      key: "name",
      label: "Company Name",
      render: (c) => <span className="font-medium">{c.name}</span>,
    },
    {
      key: "address",
      label: "Address",
      render: (c) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {[c.city, c.state].filter(Boolean).join(", ") || (c.address ?? "—")}
        </span>
      ),
    },
    {
      key: "phone",
      label: "Phone",
      render: (c) => c.phone ?? <span className="text-gray-400">—</span>,
    },
    {
      key: "contactPerson",
      label: "Contact",
      render: (c) => c.contactPerson ?? <span className="text-gray-400">—</span>,
    },
    {
      key: "isActive",
      label: "Status",
      render: (c) => (
        <Badge variant={c.isActive ? "success" : "neutral"}>
          {c.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (c) => (
        <button
          className="btn btn-ghost btn-sm"
          onClick={(e) => { e.stopPropagation(); setModal({ mode: "edit", company: c }); }}
          id={`company-edit-${c.id}`}
        >
          <Pencil size={13} />
        </button>
      ),
    },
  ];

  const editCompany = modal?.mode === "edit" ? modal.company : null;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Companies"
        subtitle="Loading / dispatch site records — separate from billing parties"
        breadcrumbs={[{ label: "Masters" }, { label: "Companies" }]}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => setModal({ mode: "create" })}
            id="companies-add-new"
            disabled={firmLoading || !currentFirm}
          >
            Add Company
          </Button>
        }
      />

      {error && (
        <div className="card mb-4 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Search by name, city, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input pl-8"
            id="companies-search"
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
            icon={Building2}
            title={search ? "No companies match your search" : "No companies yet"}
            description={
              search
                ? "Try a different search term."
                : "Add loading/dispatch companies to reference in daily entries."
            }
            action={
              !search ? (
                <Button variant="primary" size="sm" icon={Plus} onClick={() => setModal({ mode: "create" })}>
                  Add Company
                </Button>
              ) : undefined
            }
          />
        }
        onRowClick={(c) => setModal({ mode: "edit", company: c })}
      />

      <Modal open={modal?.mode === "create"} onClose={() => setModal(null)} title="Add Company" size="md">
        <CompanyForm
          onSubmit={handleCreate}
          onCancel={() => setModal(null)}
          loading={submitting}
          error={submitError}
          submitLabel="Add Company"
        />
      </Modal>

      <Modal
        open={modal?.mode === "edit"}
        onClose={() => setModal(null)}
        title={`Edit Company — ${editCompany?.name ?? ""}`}
        size="md"
      >
        {editCompany && (
          <CompanyForm
            initial={editCompany}
            onSubmit={(data) => handleUpdate(editCompany.id, data)}
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
