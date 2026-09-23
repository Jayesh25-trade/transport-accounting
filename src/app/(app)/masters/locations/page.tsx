"use client";

import React, { useState, useMemo } from "react";
import { Plus, Search, Pencil, MapPin } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button, Badge, EmptyState } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useMasterList, useMasterMutation } from "@/lib/use-master-list";
import { useFirm } from "@/lib/firm-context";
import { Modal, Field, FormGrid, FormActions } from "@/components/ui/modal";

// ─── Types ────────────────────────────────────────────────────
interface LocationRecord {
  id: string;
  firmId: string;
  name: string;
  state: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type LocationFormData = Omit<LocationRecord, "id" | "firmId" | "isActive" | "createdAt" | "updatedAt">;

const EMPTY_FORM: LocationFormData = {
  name: "",
  state: null,
  notes: null,
};

// ─── Form ─────────────────────────────────────────────────────
interface LocationFormProps {
  initial?: Partial<LocationFormData>;
  onSubmit: (data: LocationFormData) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  error: string | null;
  submitLabel?: string;
}

function LocationForm({ initial, onSubmit, onCancel, loading, error, submitLabel }: LocationFormProps) {
  const [form, setForm] = useState<LocationFormData>({ ...EMPTY_FORM, ...initial });
  const [errors, setErrors] = useState<Partial<Record<keyof LocationFormData, string>>>({});

  function set(field: keyof LocationFormData, value: string) {
    setForm((f) => ({ ...f, [field]: value || null }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate(): boolean {
    const e: typeof errors = {};
    if (!form.name?.trim()) e.name = "Location name is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    const cleaned = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v === "" ? null : v])
    ) as LocationFormData;
    onSubmit(cleaned);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="space-y-3">
        <FormGrid cols={1}>
          <Field
            label="Location Name"
            required
            error={errors.name}
            hint="e.g. WADKHAL, MANCHAR, TALOJA (will be uppercased)"
          >
            <input
              type="text"
              id="location-form-name"
              value={form.name ?? ""}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. WADKHAL"
              className="form-input"
            />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="State" error={errors.state}>
            <input
              type="text"
              id="location-form-state"
              value={form.state ?? ""}
              onChange={(e) => set("state", e.target.value)}
              placeholder="e.g. Maharashtra"
              className="form-input"
            />
          </Field>
          <div />
        </FormGrid>
        <FormGrid cols={1}>
          <Field label="Notes" error={errors.notes}>
            <textarea
              id="location-form-notes"
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Optional notes"
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
      <FormActions onCancel={onCancel} loading={loading} submitLabel={submitLabel ?? "Save Location"} />
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function LocationsPage() {
  const { currentFirm, loading: firmLoading } = useFirm();
  const { data: locations, loading, error, refresh } = useMasterList<LocationRecord>({
    endpoint: "/api/locations",
  });
  const { submitting, submitError, create, update } = useMasterMutation("/api/locations");

  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<
    | { mode: "create" }
    | { mode: "edit"; location: LocationRecord }
    | null
  >(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return locations;
    const q = search.toLowerCase();
    return locations.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        (l.state ?? "").toLowerCase().includes(q)
    );
  }, [locations, search]);

  async function handleCreate(data: LocationFormData) {
    const ok = await create(data);
    if (ok) { setModal(null); refresh(); }
  }

  async function handleUpdate(id: string, data: LocationFormData) {
    const ok = await update(id, data);
    if (ok) { setModal(null); refresh(); }
  }

  const columns: Column<LocationRecord>[] = [
    {
      key: "name",
      label: "Location Name",
      render: (l) => <span className="font-mono font-medium">{l.name}</span>,
    },
    {
      key: "state",
      label: "State",
      render: (l) => l.state ?? <span className="text-gray-400">—</span>,
    },
    {
      key: "notes",
      label: "Notes",
      render: (l) =>
        l.notes ? (
          <span className="text-sm text-gray-500 truncate max-w-xs block">{l.notes}</span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: "isActive",
      label: "Status",
      render: (l) => (
        <Badge variant={l.isActive ? "success" : "neutral"}>
          {l.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (l) => (
        <button
          className="btn btn-ghost btn-sm"
          onClick={(e) => { e.stopPropagation(); setModal({ mode: "edit", location: l }); }}
          id={`location-edit-${l.id}`}
        >
          <Pencil size={13} />
        </button>
      ),
    },
  ];

  const editLocation = modal?.mode === "edit" ? modal.location : null;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Locations"
        subtitle="Loading & unloading points — firm-scoped"
        breadcrumbs={[{ label: "Masters" }, { label: "Locations" }]}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => setModal({ mode: "create" })}
            id="locations-add-new"
            disabled={firmLoading || !currentFirm}
          >
            Add Location
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
            placeholder="Search by name or state…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input pl-8"
            id="locations-search"
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
            icon={MapPin}
            title={search ? "No locations match your search" : "No locations yet"}
            description={
              search
                ? "Try a different search term."
                : "Add loading/unloading locations to reference in daily entries."
            }
            action={
              !search ? (
                <Button variant="primary" size="sm" icon={Plus} onClick={() => setModal({ mode: "create" })}>
                  Add Location
                </Button>
              ) : undefined
            }
          />
        }
        onRowClick={(l) => setModal({ mode: "edit", location: l })}
      />

      <Modal open={modal?.mode === "create"} onClose={() => setModal(null)} title="Add Location">
        <LocationForm
          onSubmit={handleCreate}
          onCancel={() => setModal(null)}
          loading={submitting}
          error={submitError}
          submitLabel="Add Location"
        />
      </Modal>

      <Modal
        open={modal?.mode === "edit"}
        onClose={() => setModal(null)}
        title={`Edit Location — ${editLocation?.name ?? ""}`}
      >
        {editLocation && (
          <LocationForm
            initial={editLocation}
            onSubmit={(data) => handleUpdate(editLocation.id, data)}
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
