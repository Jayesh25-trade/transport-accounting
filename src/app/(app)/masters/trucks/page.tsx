"use client";

import React, { useState, useMemo } from "react";
import { Plus, Search, Pencil, Truck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button, Badge, EmptyState } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useMasterList, useMasterMutation } from "@/lib/use-master-list";
import { useFirm } from "@/lib/firm-context";
import { Modal, Field, FormGrid, FormActions } from "@/components/ui/modal";

// ─── Types (match trucks schema exactly) ─────────────────────
interface TruckRecord {
  id: string;
  firmId: string;
  truckNumber: string;
  ownerName: string | null;
  ownerPhone: string | null;
  capacityTons: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type TruckFormData = Omit<TruckRecord, "id" | "firmId" | "isActive" | "createdAt" | "updatedAt">;

const EMPTY_FORM: TruckFormData = {
  truckNumber: "",
  ownerName: null,
  ownerPhone: null,
  capacityTons: null,
  notes: null,
};

// ─── Form ─────────────────────────────────────────────────────
interface TruckFormProps {
  initial?: Partial<TruckFormData>;
  onSubmit: (data: TruckFormData) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  error: string | null;
  submitLabel?: string;
}

function TruckForm({ initial, onSubmit, onCancel, loading, error, submitLabel }: TruckFormProps) {
  const [form, setForm] = useState<TruckFormData>({ ...EMPTY_FORM, ...initial });
  const [errors, setErrors] = useState<Partial<Record<keyof TruckFormData, string>>>({});

  function set(field: keyof TruckFormData, value: string) {
    setForm((f) => ({ ...f, [field]: value || null }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate(): boolean {
    const e: typeof errors = {};
    if (!form.truckNumber?.trim()) e.truckNumber = "Truck number is required";
    else if (form.truckNumber.length > 30) e.truckNumber = "Max 30 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    const cleaned: TruckFormData = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v === "" ? null : v])
    ) as TruckFormData;
    onSubmit(cleaned);
  }

  const inp = (field: keyof TruckFormData, placeholder?: string) => (
    <input
      type="text"
      id={`truck-form-${field}`}
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
          <Field
            label="Truck Number"
            required
            error={errors.truckNumber}
            hint="Registration number, e.g. MH06BW0111 (will be uppercased)"
          >
            {inp("truckNumber", "e.g. MH06BW0111")}
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Owner Name" error={errors.ownerName}>
            {inp("ownerName", "e.g. Raju Patil")}
          </Field>
          <Field label="Owner Phone" error={errors.ownerPhone}>
            {inp("ownerPhone", "10-digit number")}
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Capacity (Tons)" error={errors.capacityTons} hint="Informational only">
            {inp("capacityTons", "e.g. 14")}
          </Field>
          <div />
        </FormGrid>
        <FormGrid cols={1}>
          <Field label="Notes" error={errors.notes}>
            <textarea
              id="truck-form-notes"
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Optional notes about this truck"
              className="form-input resize-y"
              rows={2}
            />
          </Field>
        </FormGrid>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
      </div>
      <FormActions onCancel={onCancel} loading={loading} submitLabel={submitLabel ?? "Save Truck"} />
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function TrucksPage() {
  const { currentFirm, loading: firmLoading } = useFirm();
  const { data: trucksData, loading, error, refresh } = useMasterList<TruckRecord>({
    endpoint: "/api/trucks",
  });
  const { submitting, submitError, create, update } = useMasterMutation("/api/trucks");

  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<
    | { mode: "create" }
    | { mode: "edit"; truck: TruckRecord }
    | null
  >(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return trucksData;
    const q = search.toLowerCase();
    return trucksData.filter(
      (t) =>
        t.truckNumber.toLowerCase().includes(q) ||
        (t.ownerName ?? "").toLowerCase().includes(q) ||
        (t.ownerPhone ?? "").includes(q)
    );
  }, [trucksData, search]);

  async function handleCreate(data: TruckFormData) {
    const ok = await create(data);
    if (ok) { setModal(null); refresh(); }
  }

  async function handleUpdate(id: string, data: TruckFormData) {
    const ok = await update(id, data);
    if (ok) { setModal(null); refresh(); }
  }

  const columns: Column<TruckRecord>[] = [
    {
      key: "truckNumber",
      label: "Truck Number",
      render: (t) => <span className="font-mono font-semibold text-sm">{t.truckNumber}</span>,
    },
    {
      key: "ownerName",
      label: "Owner",
      render: (t) => t.ownerName ?? <span className="text-gray-400">—</span>,
    },
    {
      key: "ownerPhone",
      label: "Phone",
      render: (t) => t.ownerPhone ?? <span className="text-gray-400">—</span>,
    },
    {
      key: "capacityTons",
      label: "Capacity",
      align: "right",
      render: (t) =>
        t.capacityTons ? (
          <span>{t.capacityTons} T</span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: "isActive",
      label: "Status",
      render: (t) => (
        <Badge variant={t.isActive ? "success" : "neutral"}>
          {t.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (t) => (
        <button
          className="btn btn-ghost btn-sm"
          onClick={(e) => { e.stopPropagation(); setModal({ mode: "edit", truck: t }); }}
          id={`truck-edit-${t.id}`}
        >
          <Pencil size={13} />
        </button>
      ),
    },
  ];

  const editTruck = modal?.mode === "edit" ? modal.truck : null;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Trucks"
        subtitle="Vehicle registry — firm-scoped"
        breadcrumbs={[{ label: "Masters" }, { label: "Trucks" }]}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => setModal({ mode: "create" })}
            id="trucks-add-new"
            disabled={firmLoading || !currentFirm}
          >
            Add Truck
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
            placeholder="Search by truck number, owner…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input pl-8"
            id="trucks-search"
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
            icon={Truck}
            title={search ? "No trucks match your search" : "No trucks yet"}
            description={
              search
                ? "Try a different search term."
                : "Add trucks to reference them in daily book entries."
            }
            action={
              !search ? (
                <Button variant="primary" size="sm" icon={Plus} onClick={() => setModal({ mode: "create" })}>
                  Add Truck
                </Button>
              ) : undefined
            }
          />
        }
        onRowClick={(t) => setModal({ mode: "edit", truck: t })}
      />

      <Modal open={modal?.mode === "create"} onClose={() => setModal(null)} title="Add Truck">
        <TruckForm
          onSubmit={handleCreate}
          onCancel={() => setModal(null)}
          loading={submitting}
          error={submitError}
          submitLabel="Add Truck"
        />
      </Modal>

      <Modal
        open={modal?.mode === "edit"}
        onClose={() => setModal(null)}
        title={`Edit Truck — ${editTruck?.truckNumber ?? ""}`}
      >
        {editTruck && (
          <TruckForm
            initial={editTruck}
            onSubmit={(data) => handleUpdate(editTruck.id, data)}
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
