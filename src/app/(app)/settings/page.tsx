"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useFirm } from "@/lib/firm-context";
import { PageHeader } from "@/components/ui/page-header";
import { Button, Badge } from "@/components/ui/primitives";
import {
  Building2,
  ShieldAlert,
  FileText,
  RefreshCw,
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  Lock,
  CheckCircle2,
  UserCheck,
  HardDrive,
  Database,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface FirmData {
  id: string;
  name: string;
  code: string;
  pan: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
}

interface AuditLogItem {
  id: string;
  firmId: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  entityName: string;
  entityId: string | null;
  oldValues: Record<string, any> | null;
  newValues: Record<string, any> | null;
  reason: string | null;
  createdAt: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function SettingsPage() {
  const { currentFirm } = useFirm();

  // Firm Metadata State
  const [firmData, setFirmData] = useState<FirmData | null>(null);
  const [firmLoading, setFirmLoading] = useState(true);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditForbidden, setAuditForbidden] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Filters
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [page, setPage] = useState(1);

  // Fetch Firm Configuration Details
  const fetchFirmDetails = useCallback(async () => {
    if (!currentFirm) return;
    setFirmLoading(true);
    try {
      const res = await fetch("/api/firms/active", {
        headers: { "x-firm-id": currentFirm.id },
      });
      const json = await res.json();
      if (res.ok && json.data) {
        setFirmData(json.data);
      }
    } catch (err) {
      console.error("Failed to load firm details:", err);
    } finally {
      setFirmLoading(false);
    }
  }, [currentFirm]);

  // Fetch Audit Logs (ADMIN Only)
  const fetchAuditLogs = useCallback(async () => {
    if (!currentFirm) return;
    setAuditLoading(true);
    setAuditForbidden(false);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      if (actionFilter) params.set("action", actionFilter);
      if (entityFilter) params.set("entityName", entityFilter);

      const res = await fetch(`/api/audit-logs?${params.toString()}`, {
        headers: { "x-firm-id": currentFirm.id },
      });
      const json = await res.json();

      if (res.status === 403) {
        setAuditForbidden(true);
        setAuditLogs([]);
      } else if (res.ok && json.success) {
        setAuditLogs(json.logs || []);
        setPagination(json.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 });
      }
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setAuditLoading(false);
    }
  }, [currentFirm, page, actionFilter, entityFilter]);

  useEffect(() => {
    fetchFirmDetails();
  }, [fetchFirmDetails]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <PageHeader
        title="Settings"
        subtitle="Active firm configuration & transaction audit log viewer"
        breadcrumbs={[{ label: "Settings" }]}
        actions={
          <Button variant="secondary" size="sm" onClick={() => { fetchFirmDetails(); fetchAuditLogs(); }}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
        }
      />

      {/* ── 1. FIRM CONFIGURATION PANEL (READ-ONLY) ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Building2 size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Firm Configuration (Read-Only)</h2>
              <p className="text-xs text-slate-500">Active firm profile details for billing and invoices</p>
            </div>
          </div>
          <Badge variant="success" className="text-[10px] tracking-wider uppercase font-semibold">
            Active Context
          </Badge>
        </div>

        {firmLoading ? (
          <div className="py-6 text-center text-xs text-slate-400">Loading firm details...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs">
            <div>
              <p className="text-slate-500 font-medium mb-1">Firm Name</p>
              <p className="text-slate-900 font-bold text-sm">{firmData?.name || "Not configured"}</p>
            </div>

            <div>
              <p className="text-slate-500 font-medium mb-1">Firm Code</p>
              <p className="text-slate-900 font-semibold font-mono uppercase">{firmData?.code || "Not configured"}</p>
            </div>

            <div>
              <p className="text-slate-500 font-medium mb-1">PAN Number</p>
              <p className="text-slate-900 font-semibold font-mono uppercase">
                {firmData?.pan || <span className="text-slate-400 italic">Not configured</span>}
              </p>
            </div>

            <div>
              <p className="text-slate-500 font-medium mb-1">Phone Number</p>
              <p className="text-slate-900 font-semibold">
                {firmData?.phone || <span className="text-slate-400 italic">Not configured</span>}
              </p>
            </div>

            <div>
              <p className="text-slate-500 font-medium mb-1">Registered Address</p>
              <p className="text-slate-900 font-medium">
                {firmData?.address || <span className="text-slate-400 italic">Not configured</span>}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── 2. AUDIT LOG VIEWER (READ-ONLY, ADMIN ONLY) ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Audit Log Trail (Admin Only)</h2>
              <p className="text-xs text-slate-500">Immutable, non-deletable historical log of financial transaction changes</p>
            </div>
          </div>
          <Badge variant="warning" className="text-[10px] font-bold">
            <Lock className="w-3 h-3 inline mr-1" />
            READ-ONLY
          </Badge>
        </div>

        {auditForbidden ? (
          <div className="p-6 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-3 text-xs">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-bold">Access Restricted: ADMIN Authorization Required</p>
              <p className="text-amber-800 mt-0.5">
                Audit logs contain sensitive transaction metadata and are restricted to ADMIN roles only. ACCOUNTANT and MANAGER accounts cannot view audit log records.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Filter Bar */}
            <div className="flex flex-wrap gap-3 items-center text-xs">
              <div className="w-40">
                <select
                  value={actionFilter}
                  onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">All Actions</option>
                  <option value="CREATE">CREATE</option>
                  <option value="UPDATE">UPDATE</option>
                  <option value="DELETE">DELETE</option>
                  <option value="CANCEL">CANCEL</option>
                  <option value="POST">POST</option>
                  <option value="IMPORT">IMPORT</option>
                </select>
              </div>

              <div className="w-48">
                <input
                  type="text"
                  placeholder="Filter Entity (e.g. bills)"
                  value={entityFilter}
                  onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {(actionFilter || entityFilter) && (
                <button
                  onClick={() => { setActionFilter(""); setEntityFilter(""); setPage(1); }}
                  className="text-slate-500 hover:text-slate-800 underline text-xs"
                >
                  Clear Filters
                </button>
              )}
            </div>

            {/* Audit Log Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-700">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-2.5">Timestamp</th>
                      <th className="px-4 py-2.5">User</th>
                      <th className="px-4 py-2.5 text-center">Action</th>
                      <th className="px-4 py-2.5">Entity</th>
                      <th className="px-4 py-2.5">Entity ID</th>
                      <th className="px-4 py-2.5 text-center">Payload Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {auditLoading ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                          <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-blue-500" />
                          Loading audit records...
                        </td>
                      </tr>
                    ) : auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                          No audit log records found.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log) => {
                        const isExpanded = expandedLogId === log.id;
                        return (
                          <React.Fragment key={log.id}>
                            <tr className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-2.5 font-mono text-slate-600 whitespace-nowrap">
                                {formatDate(log.createdAt)}
                              </td>
                              <td className="px-4 py-2.5 text-slate-800 font-medium">
                                {log.userEmail || log.userId?.substring(0, 8) || "System"}
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <Badge
                                  variant={
                                    log.action === "CREATE"
                                      ? "success"
                                      : log.action === "UPDATE"
                                      ? "warning"
                                      : log.action === "DELETE" || log.action === "CANCEL"
                                      ? "danger"
                                      : "neutral"
                                  }
                                >
                                  {log.action}
                                </Badge>
                              </td>
                              <td className="px-4 py-2.5 font-semibold text-slate-900 uppercase">
                                {log.entityName}
                              </td>
                              <td className="px-4 py-2.5 font-mono text-slate-500 text-[11px]">
                                {log.entityId ? log.entityId.substring(0, 13) + "..." : "-"}
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                {(log.oldValues || log.newValues) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                    className="h-6 px-2 text-[11px] text-blue-600 hover:text-blue-800"
                                  >
                                    <Eye className="w-3 h-3 mr-1" />
                                    {isExpanded ? "Hide JSON" : "View JSON"}
                                  </Button>
                                )}
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-slate-900 text-slate-200 font-mono text-[11px]">
                                <td colSpan={6} className="p-4 space-y-3">
                                  {log.oldValues && (
                                    <div>
                                      <p className="text-amber-400 font-bold mb-1">Old Values (Before Change):</p>
                                      <pre className="p-2.5 bg-slate-950 rounded border border-slate-800 overflow-x-auto text-[10px]">
                                        {JSON.stringify(log.oldValues, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                  {log.newValues && (
                                    <div>
                                      <p className="text-emerald-400 font-bold mb-1">New Values (After Change):</p>
                                      <pre className="p-2.5 bg-slate-950 rounded border border-slate-800 overflow-x-auto text-[10px]">
                                        {JSON.stringify(log.newValues, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {pagination.totalPages > 1 && (
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                  <span>
                    Showing Page <span className="font-bold">{pagination.page}</span> of{" "}
                    <span className="font-bold">{pagination.totalPages}</span> ({pagination.total} total records)
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page <= 1 || auditLoading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page >= pagination.totalPages || auditLoading}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── 3. PLACEHOLDER CARDS (UNTOUCHED PLAIN CONTAINERS) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm opacity-80">
          <div className="flex items-center gap-2.5 mb-2 text-slate-700">
            <UserCheck size={18} className="text-slate-400" />
            <h2 className="text-sm font-semibold">User Management</h2>
          </div>
          <p className="text-xs text-slate-500">
            Role-based user access — Admin, Accountant, Manager — will be managed here.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm opacity-80">
          <div className="flex items-center gap-2.5 mb-2 text-slate-700">
            <Database size={18} className="text-slate-400" />
            <h2 className="text-sm font-semibold">Database Backup</h2>
          </div>
          <p className="text-xs text-slate-500">
            PostgreSQL off-site R2 automated backup pipeline active via GitHub Actions workflow.
          </p>
        </div>
      </div>
    </div>
  );
}
