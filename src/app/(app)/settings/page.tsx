"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useFirm } from "@/lib/firm-context";
import { PageHeader } from "@/components/ui/page-header";
import { Button, Badge } from "@/components/ui/primitives";
import {
  Building2, Users, FileText, Shield, Download, History,
  UserPlus, RefreshCw, X, ChevronLeft, ChevronRight,
  Eye, EyeOff, CheckCircle2, AlertCircle, Lock, Pencil,
  Plus, ToggleLeft, ToggleRight, AlertTriangle,
} from "lucide-react";

// ─── Helper ───────────────────────────────────────────────────
function fmt(v?: string | null) { return v || "—"; }

function formatTs(ts: string | null | undefined) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return ts; }
}

// Business-readable entity names
const ENTITY_DISPLAY: Record<string, string> = {
  DAILY_ENTRIES: "Daily Book Entry",
  BILLS: "Bill",
  PAYMENTS: "Payment",
  DRIVER_VOUCHERS: "Driver Voucher",
  PARTIES: "Party",
  COMPANIES: "Company",
  TRUCKS: "Truck",
  LOCATIONS: "Location",
  AUTH: "Login / Logout",
  FIRMS: "Firm",
  USERS: "Team Member",
  CUSTOMER_RULES: "Customer Rule",
};

// Business-readable action verbs
const ACTION_VERB: Record<string, string> = {
  CREATE: "created",
  UPDATE: "updated",
  DELETE: "deleted",
  CANCEL: "cancelled",
  POST: "posted",
  REVERSE: "reversed",
  LOGIN: "logged in",
  LOGOUT: "logged out",
  IMPORT: "imported",
};

// Permission model mapping
const PERMISSION_OPTIONS = [
  { value: "ADMIN", label: "Full Access", desc: "Create, edit, delete records + manage team" },
  { value: "ACCOUNTANT", label: "Edit & View", desc: "Create and edit records. Cannot manage team." },
  { value: "MANAGER", label: "View Only", desc: "Read all records. Cannot create or modify." },
];

// ─── Types ────────────────────────────────────────────────────
interface FirmData { id: string; name: string; code: string; pan: string | null; phone: string | null; address: string | null; isActive: boolean; }
interface AllFirm { id: string; name: string; code: string; }
interface Member { id: string; name: string; email: string; role: "ADMIN" | "ACCOUNTANT" | "MANAGER"; isActive: boolean; userIsActive: boolean; lastLoginAt: string | null; createdAt: string; }
interface AuditLog { id: string; userEmail: string | null; action: string; entityName: string; entityId: string | null; newValues: any; oldValues: any; createdAt: string; }
interface Pagination { total: number; page: number; limit: number; totalPages: number; }

// ─── Reusable FormInput ───────────────────────────────────────
function FI({ label, id, required, ...props }: { label: string; id: string; required?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="form-group">
      <label htmlFor={id} className="form-label">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <input id={id} className="form-input" {...props} />
    </div>
  );
}

// ─── Alert Banner ─────────────────────────────────────────────
function AlertBanner({ type, message, onClose }: { type: "success" | "error"; message: string; onClose: () => void }) {
  return (
    <div className={`p-3 rounded-xl flex items-center gap-2 text-xs font-semibold border ${type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"}`}>
      {type === "success" ? <CheckCircle2 size={14} className="text-emerald-600 shrink-0" /> : <AlertCircle size={14} className="text-red-600 shrink-0" />}
      <span className="flex-1">{message}</span>
      <button onClick={onClose}><X size={13} /></button>
    </div>
  );
}

// ─── Panel wrapper ────────────────────────────────────────────
function Section({ title, icon: Icon, action, children }: { title: string; icon: any; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#D8D5CE] rounded-2xl shadow-xs overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#EFECE6]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#FAF8F5] border border-[#EFECE6] flex items-center justify-center">
            <Icon size={16} className="text-[#E05638]" />
          </div>
          <h2 className="text-sm font-bold text-[#1A1D20]">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  TAB 1 — FIRM PROFILE
// ════════════════════════════════════════════════════════════════
function FirmProfileTab() {
  const { currentFirm } = useFirm();
  const [data, setData] = useState<FirmData | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", pan: "", phone: "", address: "" });
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const load = useCallback(async () => {
    if (!currentFirm) return;
    try {
      const r = await fetch("/api/firms/active", { headers: { "x-firm-id": currentFirm.id } });
      const j = await r.json();
      if (r.ok && j.data) {
        setData(j.data);
        setForm({ name: j.data.name || "", pan: j.data.pan || "", phone: j.data.phone || "", address: j.data.address || "" });
      }
    } catch {}
  }, [currentFirm]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!currentFirm) return;
    setSaving(true);
    try {
      const r = await fetch("/api/firms/active", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-firm-id": currentFirm.id },
        body: JSON.stringify({ name: form.name, pan: form.pan || null, phone: form.phone || null, address: form.address || null }),
      });
      const j = await r.json();
      if (r.ok && j.success) {
        setData(j.data);
        setEditing(false);
        setAlert({ type: "success", msg: "Firm profile updated successfully." });
      } else {
        setAlert({ type: "error", msg: j.error?.message || "Failed to save changes." });
      }
    } catch (e: any) {
      setAlert({ type: "error", msg: e.message || "Failed to save changes." });
    } finally { setSaving(false); }
  }

  const fields = [
    { label: "Firm Name", key: "name", editable: true },
    { label: "Firm Code", key: "code", editable: false },
    { label: "PAN Number", key: "pan", editable: true },
    { label: "GSTIN", key: "gstin", editable: false, note: "Contact administrator" },
    { label: "Phone", key: "phone", editable: true },
    { label: "Email", key: "email", editable: false, note: "Contact administrator" },
    { label: "Registered Address", key: "address", editable: true, span: true },
    { label: "City", key: "city", editable: false, note: "Contact administrator" },
    { label: "State", key: "state", editable: false, note: "Contact administrator" },
    { label: "Pincode", key: "pincode", editable: false, note: "Contact administrator" },
  ];

  return (
    <Section title="Firm Profile" icon={Building2} action={
      !editing ? (
        <Button variant="coral" size="sm" onClick={() => setEditing(true)} id="firm-edit-btn">
          <Pencil size={13} className="mr-1.5" /> Edit Details
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => { setEditing(false); load(); }} disabled={saving}>Cancel</Button>
          <Button variant="coral" size="sm" onClick={save} disabled={saving} id="firm-save-btn">{saving ? "Saving…" : "Save Changes"}</Button>
        </div>
      )
    }>
      {alert && <div className="mb-4"><AlertBanner type={alert.type} message={alert.msg} onClose={() => setAlert(null)} /></div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {fields.map((f) => {
          const dbVal = data ? (data as any)[f.key] : null;
          const formVal = (form as any)[f.key] ?? "";
          const showEdit = editing && f.editable;

          return (
            <div key={f.key} className={`${f.span ? "sm:col-span-2 md:col-span-3" : ""}`}>
              {showEdit ? (
                <div className="form-group">
                  <label className="form-label">{f.label}</label>
                  {f.key === "address" ? (
                    <textarea
                      className="form-input resize-none"
                      rows={3}
                      value={formVal}
                      onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                    />
                  ) : (
                    <input
                      className="form-input"
                      value={formVal}
                      onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    />
                  )}
                </div>
              ) : (
                <div className="rounded-xl bg-[#FAF8F5] border border-[#EFECE6] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#7A7F85] mb-1">{f.label}</p>
                  {dbVal ? (
                    <p className="text-sm font-bold text-[#1A1D20]">{dbVal}</p>
                  ) : f.note ? (
                    <p className="text-sm text-[#9E9A91] italic">{f.note}</p>
                  ) : (
                    <p className="text-sm text-[#9E9A91] italic">Not added</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!editing && (
        <p className="mt-4 text-[11px] text-[#7A7F85]">
          Fields marked "Contact administrator" require administrative privileges. All other fields are editable by an ADMIN.
        </p>
      )}
    </Section>
  );
}

// ════════════════════════════════════════════════════════════════
//  TAB 2 — FIRM MANAGEMENT
// ════════════════════════════════════════════════════════════════
function FirmManagementTab() {
  const { currentFirm, firms: ctxFirms, refetchFirms } = useFirm();
  const [allFirms, setAllFirms] = useState<AllFirm[]>([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editFirm, setEditFirm] = useState<AllFirm | null>(null);
  const [addForm, setAddForm] = useState({ name: "", code: "", pan: "", phone: "", address: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/firms");
      const j = await r.json();
      if (r.ok && j.data) setAllFirms(j.data);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!currentFirm) return;
    setSaving(true);
    try {
      const r = await fetch("/api/firms", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-firm-id": currentFirm.id },
        body: JSON.stringify(addForm),
      });
      const j = await r.json();
      if (r.ok && j.success) {
        setAlert({ type: "success", msg: `Firm "${addForm.name}" created successfully.` });
        setShowAdd(false);
        setAddForm({ name: "", code: "", pan: "", phone: "", address: "" });
        load(); refetchFirms();
      } else { setAlert({ type: "error", msg: j.error?.message || "Failed to create firm." }); }
    } catch (e: any) { setAlert({ type: "error", msg: e.message }); }
    finally { setSaving(false); }
  }

  async function handleDeactivate(firmId: string, firmName: string) {
    if (!currentFirm) return;
    if (!confirm(`Deactivate "${firmName}"? This cannot be undone if the firm has financial history.`)) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/firms/${firmId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-firm-id": currentFirm.id },
        body: JSON.stringify({ isActive: false }),
      });
      const j = await r.json();
      if (r.ok && j.success) {
        setAlert({ type: "success", msg: `Firm "${firmName}" deactivated.` });
        load(); refetchFirms();
      } else { setAlert({ type: "error", msg: j.error?.message || "Cannot deactivate firm." }); }
    } catch (e: any) { setAlert({ type: "error", msg: e.message }); }
    finally { setSaving(false); }
  }

  return (
    <Section title="Firm Management" icon={Building2} action={
      <Button variant="coral" size="sm" onClick={() => setShowAdd(true)} id="firm-add-btn">
        <Plus size={13} className="mr-1.5" /> Add Firm
      </Button>
    }>
      {alert && <div className="mb-4"><AlertBanner type={alert.type} message={alert.msg} onClose={() => setAlert(null)} /></div>}

      {/* Add Firm Form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="mb-6 rounded-xl border border-[#EFECE6] bg-[#FAF8F5] p-5 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-[#1A1D20]">New Firm Details</h3>
            <button type="button" onClick={() => setShowAdd(false)} className="text-[#7A7F85] hover:text-[#1A1D20]"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FI label="Firm Name" id="nf-name" required value={addForm.name} onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Ramesh Transport" />
            <FI label="Firm Code" id="nf-code" required value={addForm.code} onChange={(e) => setAddForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="e.g. RAMESH" />
            <FI label="PAN Number" id="nf-pan" value={addForm.pan} onChange={(e) => setAddForm((p) => ({ ...p, pan: e.target.value }))} placeholder="e.g. AAAAA1234A" />
            <FI label="Phone" id="nf-phone" value={addForm.phone} onChange={(e) => setAddForm((p) => ({ ...p, phone: e.target.value }))} placeholder="e.g. 9876543210" />
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <textarea className="form-input resize-none" rows={2} value={addForm.address} onChange={(e) => setAddForm((p) => ({ ...p, address: e.target.value }))} placeholder="Registered office address" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" size="sm" type="button" onClick={() => setShowAdd(false)} disabled={saving}>Cancel</Button>
            <Button variant="coral" size="sm" type="submit" disabled={saving} id="firm-add-submit">{saving ? "Creating…" : "Create Firm"}</Button>
          </div>
        </form>
      )}

      {/* Firm List */}
      {loading ? (
        <div className="py-6 text-center text-xs text-[#7A7F85]">Loading firms…</div>
      ) : (
        <div className="space-y-3">
          {allFirms.map((f) => (
            <div key={f.id} className="flex items-center justify-between p-4 rounded-xl border border-[#D8D5CE] bg-white hover:border-[#9E9A91] transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#FAF8F5] border border-[#EFECE6] flex items-center justify-center text-[11px] font-bold text-[#1A1D20]">
                  {f.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold text-[#1A1D20]">{f.name}</p>
                  <p className="text-xs text-[#5F6368] font-mono">{f.code}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {currentFirm?.id === f.id && <Badge variant="success" className="text-[10px]">Active</Badge>}
                <button
                  onClick={() => handleDeactivate(f.id, f.name)}
                  disabled={saving}
                  className="text-[11px] px-3 py-1.5 rounded-lg border border-[#D8D5CE] text-[#5F6368] hover:border-red-300 hover:text-red-600 transition-colors disabled:opacity-40"
                  title="Deactivate (protected if financial records exist)"
                >
                  Deactivate
                </button>
              </div>
            </div>
          ))}
          {allFirms.length === 0 && (
            <div className="py-6 text-center text-xs text-[#7A7F85] border border-dashed border-[#D8D5CE] rounded-xl">No firms found.</div>
          )}
        </div>
      )}

      <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3.5 flex items-start gap-2 text-xs text-amber-900">
        <AlertTriangle size={13} className="text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Deactivation Protection</p>
          <p className="mt-0.5 text-amber-800">Firms with existing bills or daily book entries cannot be deactivated. All financial history is permanently preserved.</p>
        </div>
      </div>
    </Section>
  );
}

// ════════════════════════════════════════════════════════════════
//  TAB 3 — TEAM MEMBERS
// ════════════════════════════════════════════════════════════════
function TeamMembersTab() {
  const { currentFirm } = useFirm();
  const [members, setMembers] = useState<Member[]>([]);
  const [allFirms, setAllFirms] = useState<AllFirm[]>([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({ name: "", email: "", password: "", confirm: "", firmIds: [] as string[], role: "ACCOUNTANT" });
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    if (!currentFirm) return;
    setLoading(true);
    try {
      const [mr, fr] = await Promise.all([
        fetch("/api/members", { headers: { "x-firm-id": currentFirm.id } }),
        fetch("/api/firms"),
      ]);
      const mj = await mr.json();
      const fj = await fr.json();
      if (mr.status === 403) { setForbidden(true); return; }
      if (mr.ok && mj.success) setMembers(mj.data || []);
      if (fr.ok && fj.data) setAllFirms(fj.data);
    } catch {} finally { setLoading(false); }
  }, [currentFirm]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!currentFirm) return;
    if (addForm.password !== addForm.confirm) { setAlert({ type: "error", msg: "Passwords do not match." }); return; }
    if (addForm.firmIds.length === 0) { setAlert({ type: "error", msg: "Please assign at least one firm." }); return; }
    setSaving(true);
    try {
      // Add member to each selected firm
      const results = await Promise.all(addForm.firmIds.map((fid) =>
        fetch("/api/members", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-firm-id": fid },
          body: JSON.stringify({ name: addForm.name, email: addForm.email, password: addForm.password, role: addForm.role }),
        }).then((r) => r.json())
      ));
      const failed = results.find((r) => !r.success);
      if (failed) { setAlert({ type: "error", msg: failed.error?.message || "Failed to add member." }); }
      else {
        setAlert({ type: "success", msg: `${addForm.name} added successfully.` });
        setShowAdd(false);
        setAddForm({ name: "", email: "", password: "", confirm: "", firmIds: [], role: "ACCOUNTANT" });
        load();
      }
    } catch (e: any) { setAlert({ type: "error", msg: e.message }); }
    finally { setSaving(false); }
  }

  async function handleUpdate(memberId: string, updates: any) {
    if (!currentFirm) return;
    setUpdating(memberId);
    try {
      const r = await fetch(`/api/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-firm-id": currentFirm.id },
        body: JSON.stringify(updates),
      });
      const j = await r.json();
      if (r.ok && j.success) { load(); setAlert({ type: "success", msg: "Member updated." }); }
      else { setAlert({ type: "error", msg: j.error?.message || "Failed to update." }); }
    } catch (e: any) { setAlert({ type: "error", msg: e.message }); }
    finally { setUpdating(null); }
  }

  const permLabel = (role: string) => PERMISSION_OPTIONS.find((p) => p.value === role)?.label || role;
  const permBadge = (role: string) => role === "ADMIN" ? "danger" : role === "ACCOUNTANT" ? "info" : "neutral";

  if (forbidden) return (
    <Section title="Team Members" icon={Users}>
      <div className="p-5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-3 text-sm">
        <Shield className="w-5 h-5 text-amber-600 shrink-0" />
        <div><p className="font-bold">Admin Access Required</p><p className="text-xs mt-0.5">Only Full Access accounts can view and manage team members.</p></div>
      </div>
    </Section>
  );

  return (
    <Section title="Team Members" icon={Users} action={
      <Button variant="coral" size="sm" onClick={() => setShowAdd(true)} id="members-add-btn">
        <UserPlus size={13} className="mr-1.5" /> Add Member
      </Button>
    }>
      {alert && <div className="mb-4"><AlertBanner type={alert.type} message={alert.msg} onClose={() => setAlert(null)} /></div>}

      {/* Add Member Form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="mb-6 rounded-xl border border-[#EFECE6] bg-[#FAF8F5] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1A1D20]">New Team Member</h3>
            <button type="button" onClick={() => setShowAdd(false)} className="text-[#7A7F85] hover:text-[#1A1D20]"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FI label="Full Name" id="nm-name" required value={addForm.name} onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Ravi Sharma" autoComplete="off" />
            <FI label="Email Address" id="nm-email" required type="email" value={addForm.email} onChange={(e) => setAddForm((p) => ({ ...p, email: e.target.value }))} placeholder="e.g. ravi@firm.com" autoComplete="off" />
            {/* Password */}
            <div className="form-group">
              <label htmlFor="nm-pwd" className="form-label">Password <span className="text-red-500">*</span></label>
              <div className="relative">
                <input id="nm-pwd" type={showPwd ? "text" : "password"} className="form-input pr-9" required value={addForm.password} onChange={(e) => setAddForm((p) => ({ ...p, password: e.target.value }))} placeholder="Min. 8 characters" autoComplete="new-password" />
                <button type="button" onClick={() => setShowPwd((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7A7F85]">{showPwd ? <EyeOff size={14} /> : <Eye size={14} />}</button>
              </div>
            </div>
            {/* Confirm Password */}
            <div className="form-group">
              <label htmlFor="nm-cpwd" className="form-label">Confirm Password <span className="text-red-500">*</span></label>
              <div className="relative">
                <input id="nm-cpwd" type={showConfirm ? "text" : "password"} className="form-input pr-9" required value={addForm.confirm} onChange={(e) => setAddForm((p) => ({ ...p, confirm: e.target.value }))} placeholder="Re-enter password" autoComplete="new-password" />
                <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7A7F85]">{showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}</button>
              </div>
            </div>
          </div>

          {/* Firm Assignment */}
          <div className="form-group">
            <label className="form-label">Assign Firm(s) <span className="text-red-500">*</span></label>
            <div className="flex flex-wrap gap-2 mt-1">
              {allFirms.map((f) => {
                const checked = addForm.firmIds.includes(f.id);
                return (
                  <label key={f.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs font-semibold transition-all ${checked ? "border-[#E05638] bg-[#FDF2F0] text-[#E05638]" : "border-[#D8D5CE] bg-white text-[#5F6368] hover:border-[#E05638]/50"}`}>
                    <input type="checkbox" className="accent-[#E05638]" checked={checked} onChange={(e) => {
                      setAddForm((p) => ({ ...p, firmIds: e.target.checked ? [...p.firmIds, f.id] : p.firmIds.filter((id) => id !== f.id) }));
                    }} />
                    {f.name}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Permission */}
          <div className="form-group">
            <label className="form-label">Permission Level <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
              {PERMISSION_OPTIONS.map((p) => (
                <label key={p.value} className={`flex flex-col gap-0.5 p-3 rounded-xl border cursor-pointer transition-all text-xs ${addForm.role === p.value ? "border-[#E05638] bg-[#FDF2F0]" : "border-[#D8D5CE] bg-white hover:border-[#E05638]/40"}`}>
                  <div className="flex items-center gap-2">
                    <input type="radio" name="nm-role" className="accent-[#E05638]" value={p.value} checked={addForm.role === p.value} onChange={() => setAddForm((prev) => ({ ...prev, role: p.value }))} />
                    <span className="font-bold text-[#1A1D20]">{p.label}</span>
                  </div>
                  <span className="text-[#5F6368] pl-5">{p.desc}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="secondary" size="sm" type="button" onClick={() => setShowAdd(false)} disabled={saving}>Cancel</Button>
            <Button variant="coral" size="sm" type="submit" disabled={saving} id="member-add-submit">{saving ? "Adding…" : "Add Member"}</Button>
          </div>
        </form>
      )}

      {/* Member table */}
      {loading ? (
        <div className="py-8 text-center text-xs text-[#7A7F85]">Loading members…</div>
      ) : members.length === 0 ? (
        <div className="py-8 text-center text-xs text-[#7A7F85] border border-dashed border-[#D8D5CE] rounded-xl">No team members found.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#D8D5CE]">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#FAF8F5] border-b border-[#D8D5CE] text-[10px] font-bold uppercase tracking-wider text-[#5F6368]">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5 text-center">Permission</th>
                <th className="px-4 py-2.5 text-center">Status</th>
                <th className="px-4 py-2.5 text-right">Last Login</th>
                <th className="px-4 py-2.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFECE6]">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-[#FAF8F5] transition-colors">
                  <td className="px-4 py-3 font-semibold text-[#1A1D20]">{m.name}</td>
                  <td className="px-4 py-3 text-[#5F6368]">{m.email}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={permBadge(m.role) as any}>{permLabel(m.role)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={m.isActive && m.userIsActive ? "success" : "neutral"}>
                      {m.isActive && m.userIsActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right text-[#5F6368] font-mono">{m.lastLoginAt ? formatTs(m.lastLoginAt) : "Never"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <select
                        value={m.role}
                        disabled={updating === m.id}
                        onChange={(e) => handleUpdate(m.id, { role: e.target.value })}
                        className="text-[11px] px-2 py-1 border border-[#D8D5CE] rounded-lg bg-white text-[#1A1D20] focus:outline-none focus:ring-1 focus:ring-[#E05638] disabled:opacity-50"
                      >
                        {PERMISSION_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </select>
                      <button
                        onClick={() => handleUpdate(m.id, { isActive: !m.isActive })}
                        disabled={updating === m.id}
                        title={m.isActive ? "Deactivate" : "Activate"}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border disabled:opacity-40 transition-colors ${m.isActive ? "border-red-200 text-red-600 hover:bg-red-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}
                      >
                        {updating === m.id ? "…" : m.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

// ════════════════════════════════════════════════════════════════
//  TAB 4 — SECURITY
// ════════════════════════════════════════════════════════════════
function SecurityTab() {
  const [form, setForm] = useState({ current: "", newPwd: "", confirm: "" });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  async function handleChangePwd(e: React.FormEvent) {
    e.preventDefault();
    if (form.newPwd !== form.confirm) { setAlert({ type: "error", msg: "New password and confirm password do not match." }); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: form.current, newPassword: form.newPwd, confirmPassword: form.confirm }),
      });
      const j = await r.json();
      if (r.ok && j.success) {
        setAlert({ type: "success", msg: "Password changed successfully. Please use your new password on next login." });
        setForm({ current: "", newPwd: "", confirm: "" });
      } else { setAlert({ type: "error", msg: j.error?.message || "Failed to change password." }); }
    } catch (e: any) { setAlert({ type: "error", msg: e.message }); }
    finally { setSaving(false); }
  }

  return (
    <Section title="Security" icon={Shield}>
      {alert && <div className="mb-4"><AlertBanner type={alert.type} message={alert.msg} onClose={() => setAlert(null)} /></div>}
      <div className="max-w-md">
        <h3 className="text-sm font-bold text-[#1A1D20] mb-1">Change Password</h3>
        <p className="text-xs text-[#5F6368] mb-5">Enter your current password and choose a new one. Minimum 8 characters.</p>
        <form onSubmit={handleChangePwd} className="space-y-3">
          {[
            { id: "sp-cur", label: "Current Password", key: "current", show: showCurrent, toggle: () => setShowCurrent((v) => !v) },
            { id: "sp-new", label: "New Password", key: "newPwd", show: showNew, toggle: () => setShowNew((v) => !v) },
            { id: "sp-con", label: "Confirm New Password", key: "confirm", show: showConfirm, toggle: () => setShowConfirm((v) => !v) },
          ].map((f) => (
            <div key={f.id} className="form-group">
              <label htmlFor={f.id} className="form-label">{f.label} <span className="text-red-500">*</span></label>
              <div className="relative">
                <input
                  id={f.id} type={f.show ? "text" : "password"} required
                  className="form-input pr-9"
                  value={(form as any)[f.key]}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  autoComplete={f.key === "current" ? "current-password" : "new-password"}
                />
                <button type="button" onClick={f.toggle} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7A7F85]">
                  {f.show ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          ))}
          <div className="pt-2">
            <Button variant="coral" size="sm" type="submit" disabled={saving} id="security-change-pwd-btn">
              {saving ? "Changing…" : "Change Password"}
            </Button>
          </div>
        </form>

        <div className="mt-8 pt-5 border-t border-[#EFECE6]">
          <h3 className="text-sm font-bold text-[#1A1D20] mb-1">Change Login Email</h3>
          <p className="text-xs text-[#5F6368] mb-3">Contact your administrator to update your login email address.</p>
          <div className="rounded-xl bg-[#FAF8F5] border border-[#EFECE6] p-4 text-xs text-[#5F6368]">
            Login email changes require administrator approval to prevent unauthorized account takeovers.
          </div>
        </div>
      </div>
    </Section>
  );
}

// ════════════════════════════════════════════════════════════════
//  TAB 5 — REPORTS & DOWNLOADS
// ════════════════════════════════════════════════════════════════
function ReportsTab() {
  const { currentFirm } = useFirm();
  const [filters, setFilters] = useState({ fromDate: "", toDate: "", party: "" });
  const [downloading, setDownloading] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  async function downloadReport(type: string, format: "pdf" | "csv") {
    if (!currentFirm) return;
    setDownloading(`${type}-${format}`);
    setAlert(null);
    try {
      const params = new URLSearchParams();
      if (filters.fromDate) params.set("fromDate", filters.fromDate);
      if (filters.toDate) params.set("toDate", filters.toDate);
      params.set("format", format);

      // Map type to existing API endpoints
      const urlMap: Record<string, string> = {
        "daily-book": `/api/daily-entries?${params}`,
        "bills": `/api/bills?${params}`,
        "payments": `/api/payments?${params}`,
        "ledger": `/api/ledger?${params}`,
        "outstanding": `/api/reports/outstanding?${params}`,
        "aging": `/api/reports/aging?${params}`,
        "driver-vouchers": `/api/driver-vouchers?${params}`,
      };

      const url = urlMap[type];
      if (!url) return;

      const r = await fetch(url, { headers: { "x-firm-id": currentFirm.id } });
      const j = await r.json();

      if (!r.ok || !j.success) { setAlert({ type: "error", msg: j.error?.message || "Failed to fetch report data." }); return; }

      // Client-side CSV generation
      const rows: any[] = j.data || j.entries || j.bills || j.payments || j.vouchers || [];
      if (rows.length === 0) { setAlert({ type: "error", msg: `No data found for ${type} with the selected filters.` }); return; }

      if (format === "csv") {
        const headers = Object.keys(rows[0]).filter((k) => !k.toLowerCase().includes("id") && k !== "firmId");
        const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${currentFirm.code}_${type}_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        setAlert({ type: "success", msg: `${type} CSV downloaded successfully.` });
      } else {
        setAlert({ type: "error", msg: "PDF export for this report is not yet available. Please use CSV." });
      }
    } catch (e: any) { setAlert({ type: "error", msg: e.message || "Download failed." }); }
    finally { setDownloading(null); }
  }

  const reports = [
    { key: "daily-book", label: "Daily Book", desc: "All operational trip entries" },
    { key: "bills", label: "Bills", desc: "All freight bills and invoices" },
    { key: "payments", label: "Payments", desc: "All payment receipts" },
    { key: "ledger", label: "Ledger", desc: "Party-wise account ledger" },
    { key: "outstanding", label: "Outstanding", desc: "Pending dues and receivables" },
    { key: "aging", label: "Aging Analysis", desc: "Age-wise outstanding breakdown" },
    { key: "driver-vouchers", label: "Driver Vouchers", desc: "All driver voucher records" },
  ];

  return (
    <Section title="Reports & Downloads" icon={Download}>
      {alert && <div className="mb-4"><AlertBanner type={alert.type} message={alert.msg} onClose={() => setAlert(null)} /></div>}

      {/* Filters */}
      <div className="mb-5 p-4 rounded-xl bg-[#FAF8F5] border border-[#EFECE6] space-y-3">
        <p className="text-xs font-bold text-[#1A1D20]">Date Filter (optional)</p>
        <div className="flex flex-wrap gap-3">
          <div className="form-group flex-1 min-w-32">
            <label className="form-label">From Date</label>
            <input type="date" className="form-input" value={filters.fromDate} onChange={(e) => setFilters((p) => ({ ...p, fromDate: e.target.value }))} />
          </div>
          <div className="form-group flex-1 min-w-32">
            <label className="form-label">To Date</label>
            <input type="date" className="form-input" value={filters.toDate} onChange={(e) => setFilters((p) => ({ ...p, toDate: e.target.value }))} />
          </div>
          {(filters.fromDate || filters.toDate) && (
            <div className="flex items-end pb-0.5">
              <button onClick={() => setFilters({ fromDate: "", toDate: "", party: "" })} className="text-xs text-[#5F6368] hover:text-[#1A1D20] underline">Clear</button>
            </div>
          )}
        </div>
      </div>

      {/* Report Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {reports.map((rep) => (
          <div key={rep.key} className="border border-[#D8D5CE] rounded-xl bg-white p-4 shadow-xs hover:border-[#9E9A91] transition-colors">
            <p className="text-sm font-bold text-[#1A1D20] mb-0.5">{rep.label}</p>
            <p className="text-xs text-[#5F6368] mb-3">{rep.desc}</p>
            <div className="flex gap-2">
              <button
                onClick={() => downloadReport(rep.key, "csv")}
                disabled={!!downloading}
                id={`download-${rep.key}-csv`}
                className="flex-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-[#D8D5CE] text-[#5F6368] hover:border-[#E05638] hover:text-[#E05638] transition-colors disabled:opacity-40"
              >
                {downloading === `${rep.key}-csv` ? "…" : "CSV"}
              </button>
              <button
                onClick={() => downloadReport(rep.key, "pdf")}
                disabled={!!downloading}
                id={`download-${rep.key}-pdf`}
                className="flex-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-[#E05638] text-[#E05638] hover:bg-[#FDF2F0] transition-colors disabled:opacity-40"
              >
                {downloading === `${rep.key}-pdf` ? "…" : "PDF"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-[11px] text-[#7A7F85]">
        CSV download is available for all reports. Bill PDF is available from the Bills page. Dedicated PDF export for each report type is coming soon.
      </p>
    </Section>
  );
}

// ════════════════════════════════════════════════════════════════
//  TAB 6 — ACTIVITY HISTORY
// ════════════════════════════════════════════════════════════════
function ActivityHistoryTab() {
  const { currentFirm } = useFirm();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 25, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");

  const load = useCallback(async () => {
    if (!currentFirm) return;
    setLoading(true);
    setForbidden(false);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (actionFilter) params.set("action", actionFilter);
      if (entityFilter) params.set("entityName", entityFilter.toUpperCase());
      const r = await fetch(`/api/audit-logs?${params}`, { headers: { "x-firm-id": currentFirm.id } });
      if (r.status === 403) { setForbidden(true); return; }
      const j = await r.json();
      if (r.ok && j.success) {
        setLogs(j.logs || []);
        setPagination(j.pagination || { total: 0, page: 1, limit: 25, totalPages: 1 });
      }
    } catch {} finally { setLoading(false); }
  }, [currentFirm, page, actionFilter, entityFilter]);

  useEffect(() => { load(); }, [load]);

  function businessSummary(log: AuditLog) {
    const who = log.userEmail ? log.userEmail.split("@")[0] : "System";
    const verb = ACTION_VERB[log.action] || log.action.toLowerCase();
    const entity = ENTITY_DISPLAY[log.entityName] || log.entityName;
    const ref = log.entityId?.length === 36 ? "" : log.entityId ? ` #${log.entityId}` : "";
    const date = log.createdAt ? new Date(log.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";
    return `${date} — ${who} ${verb} ${entity}${ref}`;
  }

  if (forbidden) return (
    <Section title="Activity History" icon={History}>
      <div className="p-5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-3 text-sm">
        <Shield className="w-5 h-5 text-amber-600 shrink-0" />
        <div><p className="font-bold">Admin Access Required</p><p className="text-xs mt-0.5">Activity history is restricted to Full Access accounts.</p></div>
      </div>
    </Section>
  );

  return (
    <Section title="Activity History" icon={History} action={
      <Badge variant="warning" className="text-[10px]"><Lock className="w-3 h-3 inline mr-1" />Read-only</Badge>
    }>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }} className="text-xs px-2.5 py-1.5 border border-[#D8D5CE] rounded-lg bg-white text-[#1A1D20] focus:outline-none focus:ring-1 focus:ring-[#E05638] w-36">
          <option value="">All Actions</option>
          <option value="CREATE">Created</option>
          <option value="UPDATE">Updated</option>
          <option value="DELETE">Deleted</option>
          <option value="CANCEL">Cancelled</option>
          <option value="LOGIN">Login</option>
          <option value="LOGOUT">Logout</option>
        </select>
        <input type="text" placeholder="Filter by type (e.g. bills)" value={entityFilter} onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }} className="text-xs px-2.5 py-1.5 border border-[#D8D5CE] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#E05638] w-44" />
        {(actionFilter || entityFilter) && <button onClick={() => { setActionFilter(""); setEntityFilter(""); setPage(1); }} className="text-xs text-[#5F6368] hover:text-[#1A1D20] underline">Clear</button>}
      </div>

      {/* Log items */}
      <div className="space-y-1.5">
        {loading ? (
          <div className="py-8 text-center text-xs text-[#7A7F85]"><RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2 text-[#E05638]" />Loading activity…</div>
        ) : logs.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#7A7F85] border border-dashed border-[#D8D5CE] rounded-xl">No activity records found.</div>
        ) : (
          logs.map((log) => {
            const isExpanded = expanded === log.id;
            const actionColor = log.action === "CREATE" ? "text-emerald-600" : log.action === "UPDATE" ? "text-amber-600" : log.action === "DELETE" || log.action === "CANCEL" ? "text-red-600" : "text-[#5F6368]";
            return (
              <div key={log.id} className="rounded-xl border border-[#EFECE6] bg-white overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 hover:bg-[#FAF8F5] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-[10px] font-bold uppercase tracking-wider shrink-0 ${actionColor}`}>{ACTION_VERB[log.action] || log.action}</span>
                    <span className="text-xs text-[#1A1D20] truncate">{businessSummary(log)}</span>
                  </div>
                  {(log.oldValues || log.newValues) && (
                    <button onClick={() => setExpanded(isExpanded ? null : log.id)} className="ml-3 shrink-0 text-[11px] text-[#0288D1] hover:text-[#0277BD] flex items-center gap-1">
                      <Eye size={12} /> {isExpanded ? "Hide" : "Details"}
                    </button>
                  )}
                </div>
                {isExpanded && (
                  <div className="px-4 pb-4 bg-slate-900 text-slate-200 font-mono text-[10px] space-y-2">
                    {log.oldValues && (
                      <div className="pt-3">
                        <p className="text-amber-400 font-bold mb-1 text-[10px]">Before:</p>
                        <pre className="bg-slate-950 rounded p-2 overflow-x-auto border border-slate-800">{JSON.stringify(log.oldValues, null, 2)}</pre>
                      </div>
                    )}
                    {log.newValues && (
                      <div className="pt-1">
                        <p className="text-emerald-400 font-bold mb-1 text-[10px]">After:</p>
                        <pre className="bg-slate-950 rounded p-2 overflow-x-auto border border-slate-800">{JSON.stringify(log.newValues, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-[#5F6368] border-t border-[#EFECE6] pt-4">
          <span>Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} records)</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft size={13} className="mr-1" />Prev</Button>
            <Button variant="secondary" size="sm" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((p) => p + 1)}>Next<ChevronRight size={13} className="ml-1" /></Button>
          </div>
        </div>
      )}
    </Section>
  );
}

// ════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ════════════════════════════════════════════════════════════════
const TABS = [
  { id: "profile", label: "Firm Profile", icon: Building2 },
  { id: "firms", label: "Firm Management", icon: Building2 },
  { id: "team", label: "Team Members", icon: Users },
  { id: "security", label: "Security", icon: Shield },
  { id: "reports", label: "Reports & Downloads", icon: Download },
  { id: "activity", label: "Activity History", icon: History },
] as const;

type TabId = typeof TABS[number]["id"];

export default function SettingsPage() {
  const [tab, setTab] = useState<TabId>("profile");

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Settings"
        subtitle="Manage your firm profile, team, security, and download reports"
        breadcrumbs={[{ label: "Settings" }]}
      />

      {/* Tab Bar */}
      <div className="overflow-x-auto">
        <div className="flex gap-1 bg-white rounded-xl border border-[#D8D5CE] p-1 shadow-xs w-max min-w-full sm:min-w-0">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                tab === id ? "bg-[#E05638] text-white shadow-xs" : "text-[#5F6368] hover:bg-[#FAF8F5] hover:text-[#1A1D20]"
              }`}
            >
              <Icon size={13} />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{label.split(" ")[0]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {tab === "profile" && <FirmProfileTab />}
      {tab === "firms" && <FirmManagementTab />}
      {tab === "team" && <TeamMembersTab />}
      {tab === "security" && <SecurityTab />}
      {tab === "reports" && <ReportsTab />}
      {tab === "activity" && <ActivityHistoryTab />}
    </div>
  );
}
