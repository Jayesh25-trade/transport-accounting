"use client";

import React, { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Badge, Button } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { useApiClient, ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ArrowRight,
  RotateCcw,
  Download,
  History,
  ShieldAlert,
  Database,
  Layers,
  FileCheck,
} from "lucide-react";

interface PartyOption {
  id: string;
  name: string;
}

interface CompanyOption {
  id: string;
  name: string;
}

interface ImportBatchRecord {
  id: string;
  originalFileName: string;
  financialYear: string;
  dataType: string;
  status: "UPLOADED" | "VALIDATING" | "VALIDATED" | "ERRORS" | "COMMITTED" | "ROLLED_BACK";
  totalRows: number;
  validRows: number;
  errorRows: number;
  committedRows: number;
  committedAt?: string | null;
  createdAt: string;
}

interface StagedRecordPreview {
  id: string;
  rowNumber: number;
  rawData: Record<string, any>;
  mappedData?: Record<string, any> | null;
  isValid?: boolean | null;
  isDuplicate: boolean;
  isCommitted: boolean;
  errors: Array<{
    id: string;
    rowNumber: number;
    fieldName?: string;
    rawValue?: string;
    errorMessage: string;
    severity: "ERROR" | "WARNING";
  }>;
}

const SYSTEM_FIELDS = [
  { key: "srNo", label: "Sr No", required: false },
  { key: "entryDate", label: "Date (YYYY-MM-DD)", required: true },
  { key: "truckNumber", label: "Truck No", required: false },
  { key: "lrNumber", label: "LR No", required: false },
  { key: "fromLocation", label: "From Location", required: false },
  { key: "toLocation", label: "To Location", required: false },
  { key: "nWeight", label: "N-Weight (Gross/Loading Wt)", required: false },
  { key: "rWeight", label: "R-Weight (Unloading Wt)", required: false },
  { key: "advance", label: "Advance Amount", required: false },
  { key: "rate", label: "Freight Rate", required: false },
  { key: "companyName", label: "Company Name", required: false },
  { key: "partyName", label: "Party / Customer Name", required: true },
  { key: "remarks", label: "Remarks", required: false },
  { key: "isReceived", label: "Trip Status (Received/Pending)", required: false },
];

export default function ImportPage() {
  const api = useApiClient();

  const [activeTab, setActiveTab] = useState<"wizard" | "history">("wizard");

  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [file, setFile] = useState<File | null>(null);
  const [financialYear, setFinancialYear] = useState<string>("2024-25");
  const [headers, setHeaders] = useState<string[]>([]);

  // Batch state
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchSummary, setBatchSummary] = useState<ImportBatchRecord | null>(null);
  const [stagedRecords, setStagedRecords] = useState<StagedRecordPreview[]>([]);

  // Mappings
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [partyMapping, setPartyMapping] = useState<Record<string, string>>({});
  const [companyMapping, setCompanyMapping] = useState<Record<string, string>>({});

  // Master options
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);

  // Loading & Error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commitConfirmOpen, setCommitConfirmOpen] = useState(false);
  const [commitSuccess, setCommitSuccess] = useState<string | null>(null);

  // History state
  const [historyBatches, setHistoryBatches] = useState<ImportBatchRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load Masters
  useEffect(() => {
    async function loadMasters() {
      try {
        const [pRes, cRes] = await Promise.all([
          api.get<PartyOption[]>("/api/parties"),
          api.get<CompanyOption[]>("/api/companies"),
        ]);
        setParties(pRes);
        setCompanies(cRes);
      } catch (err) {
        console.error("Failed to load masters", err);
      }
    }
    loadMasters();
  }, [api]);

  // Load History
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await api.get<ImportBatchRecord[]>("/api/import/batches");
      setHistoryBatches(res);
    } catch (err) {
      console.error("Failed to load import history", err);
    } finally {
      setLoadingHistory(false);
    }
  }, [api]);

  useEffect(() => {
    if (activeTab === "history") loadHistory();
  }, [activeTab, loadHistory]);

  // Step 1: Handle File Upload & Staging
  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("financialYear", financialYear);

      const res = await api.post<any>("/api/import/upload", formData);

      setBatchId(res.batchId);
      setHeaders(res.headers || []);

      // Auto-suggest column mapping based on header similarity
      const autoMap: Record<string, string> = {};
      const fileHeaders: string[] = res.headers || [];

      SYSTEM_FIELDS.forEach((sys) => {
        const sysName = sys.key.toLowerCase();
        const match = fileHeaders.find((h) => {
          const hNorm = h.toLowerCase().replace(/[^a-z0-9]/g, "");
          return (
            hNorm === sysName ||
            hNorm.includes(sysName) ||
            (sysName === "entrydate" && (hNorm.includes("date") || hNorm.includes("dt"))) ||
            (sysName === "trucknumber" && (hNorm.includes("truck") || hNorm.includes("vehicle"))) ||
            (sysName === "partyname" && (hNorm.includes("party") || hNorm.includes("customer"))) ||
            (sysName === "companyname" && (hNorm.includes("company") || hNorm.includes("site"))) ||
            (sysName === "nweight" && (hNorm.includes("nweight") || hNorm.includes("net") || hNorm.includes("loading"))) ||
            (sysName === "rweight" && (hNorm.includes("rweight") || hNorm.includes("rec") || hNorm.includes("unloading")))
          );
        });
        if (match) autoMap[sys.key] = match;
      });

      setColumnMapping(autoMap);
      setStep(2);
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : "Failed to upload file");
    } finally {
      setLoading(false);
    }
  };

  // Step 2 & 3: Run Validation Engine
  const handleRunValidation = async () => {
    if (!batchId) return;

    setLoading(true);
    setError(null);
    try {
      await api.post("/api/import/validate", {
        batchId,
        columnMapping,
        masterMapping: {
          partyMapping,
          companyMapping,
        },
      });

      // Fetch full preview details
      const previewRes = await api.get<any>(`/api/import/batches/${batchId}`);
      setBatchSummary(previewRes.batch);
      setStagedRecords(previewRes.records || []);
      setStep(3);
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : "Failed to run validation engine");
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Commit Batch to Production
  const handleCommitBatch = async () => {
    if (!batchId) return;

    setLoading(true);
    setError(null);
    try {
      const res = await api.post<any>("/api/import/commit", { batchId });
      setCommitConfirmOpen(false);
      setCommitSuccess(`Successfully committed ${res.committedRows} records to active firm database!`);
      setStep(4);
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : "Failed to commit import batch");
    } finally {
      setLoading(false);
    }
  };

  // Export Errors to CSV
  const handleDownloadErrorsCSV = () => {
    if (!stagedRecords.length) return;

    const errorRows: string[] = ["Row Number,Field Name,Raw Value,Severity,Error Message"];
    stagedRecords.forEach((rec) => {
      rec.errors.forEach((err) => {
        errorRows.push(
          `${err.rowNumber},"${err.fieldName || ""}","${err.rawValue || ""}",${err.severity},"${err.errorMessage.replace(/"/g, '""')}"`
        );
      });
    });

    const csvContent = "data:text/csv;charset=utf-8," + errorRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `import_validation_errors_${batchId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleResetWizard = () => {
    setStep(1);
    setFile(null);
    setBatchId(null);
    setBatchSummary(null);
    setStagedRecords([]);
    setColumnMapping({});
    setPartyMapping({});
    setCompanyMapping({});
    setError(null);
    setCommitSuccess(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <PageHeader
        title="Historical Excel Import Infrastructure"
        subtitle="Staging, master mapping, validation engine, duplicate detection, and atomic batch commits"
        breadcrumbs={[{ label: "Data Import" }]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === "wizard" ? "primary" : "secondary"}
              size="sm"
              icon={FileSpreadsheet}
              onClick={() => setActiveTab("wizard")}
            >
              Import Wizard
            </Button>
            <Button
              variant={activeTab === "history" ? "primary" : "secondary"}
              size="sm"
              icon={History}
              onClick={() => setActiveTab("history")}
            >
              Import History
            </Button>
          </div>
        }
      />

      {activeTab === "wizard" ? (
        <div className="space-y-6">
          {/* Progress Indicator Steps */}
          <div className="card p-4">
            <div className="flex items-center justify-between max-w-2xl mx-auto text-xs">
              <div className={`flex items-center gap-2 font-semibold ${step >= 1 ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400"}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${step >= 1 ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-500"}`}>
                  1
                </span>
                <span>Upload & Stage</span>
              </div>
              <ArrowRight size={14} className="text-gray-300" />

              <div className={`flex items-center gap-2 font-semibold ${step >= 2 ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400"}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${step >= 2 ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-500"}`}>
                  2
                </span>
                <span>Column Mapping</span>
              </div>
              <ArrowRight size={14} className="text-gray-300" />

              <div className={`flex items-center gap-2 font-semibold ${step >= 3 ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400"}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${step >= 3 ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-500"}`}>
                  3
                </span>
                <span>Validation & Preview</span>
              </div>
              <ArrowRight size={14} className="text-gray-300" />

              <div className={`flex items-center gap-2 font-semibold ${step >= 4 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400"}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${step >= 4 ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-500"}`}>
                  4
                </span>
                <span>Committed</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-xl text-xs border border-red-200 flex items-start gap-2">
              <XCircle size={16} className="mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-bold block mb-0.5">Import Validation Error</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* STEP 1: Upload File */}
          {step === 1 && (
            <div className="card space-y-6">
              <div className="border-b border-gray-100 dark:border-gray-800 pb-4">
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <UploadCloud size={20} className="text-indigo-500" />
                  Select Historical Excel / CSV File
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Upload Excel file (.xlsx, .xls, .csv) for FY 2024-25, FY 2025-26, or FY 2026-27. Data is staged securely before production commit.
                </p>
              </div>

              <form onSubmit={handleFileUpload} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Financial Year <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={financialYear}
                      onChange={(e) => setFinancialYear(e.target.value)}
                      className="form-input w-full"
                    >
                      <option value="2024-25">FY 2024-25</option>
                      <option value="2025-26">FY 2025-26</option>
                      <option value="2026-27">FY 2026-27</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Target Financial Context
                    </label>
                    <input
                      type="text"
                      disabled
                      value="Active Selected Firm Only (Enforced Server-Side)"
                      className="form-input w-full bg-gray-50 dark:bg-gray-800 text-gray-500"
                    />
                  </div>
                </div>

                {/* File Dropzone */}
                <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center space-y-3 bg-gray-50/50 dark:bg-gray-900/20">
                  <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 flex items-center justify-center mx-auto">
                    <FileSpreadsheet size={24} />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 block">
                      {file ? file.name : "Click to select or drag Excel file"}
                    </span>
                    <span className="text-xs text-gray-400 block mt-0.5">
                      Supported formats: .xlsx, .xls, .csv (Max 15MB)
                    </span>
                  </div>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="excel-file-input"
                  />
                  <label htmlFor="excel-file-input" className="btn btn-secondary btn-sm cursor-pointer inline-flex">
                    Browse File
                  </label>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-gray-400">
                    Status: <strong className="text-gray-600 dark:text-gray-300">No file imported yet</strong>
                  </span>
                  <Button type="submit" disabled={!file || loading} loading={loading} icon={ArrowRight}>
                    Stage File & Continue
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* STEP 2: Column & Master Mapping */}
          {step === 2 && (
            <div className="card space-y-6">
              <div className="border-b border-gray-100 dark:border-gray-800 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Layers size={20} className="text-indigo-500" />
                    Map Excel Columns to System Fields
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Match each Excel header column to its corresponding system field.
                  </p>
                </div>
                <Button variant="secondary" size="sm" icon={RotateCcw} onClick={handleResetWizard}>
                  Start Over
                </Button>
              </div>

              {/* Column Mapping Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                {SYSTEM_FIELDS.map((sys) => (
                  <div key={sys.key} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                    <label className="block font-semibold text-gray-800 dark:text-gray-200 mb-1">
                      {sys.label} {sys.required && <span className="text-red-500">*</span>}
                    </label>
                    <select
                      value={columnMapping[sys.key] || ""}
                      onChange={(e) =>
                        setColumnMapping({ ...columnMapping, [sys.key]: e.target.value })
                      }
                      className="form-input w-full text-xs"
                    >
                      <option value="">-- Ignore / Unmapped --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-800">
                <Button onClick={handleRunValidation} disabled={loading} loading={loading} icon={FileCheck}>
                  Validate Staged Records & Preview
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Validation & Preview Grid */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  label="Total Staged Rows"
                  value={batchSummary?.totalRows ?? 0}
                  icon={Database}
                  iconColor="#6366f1"
                />
                <StatCard
                  label="Valid Rows"
                  value={batchSummary?.validRows ?? 0}
                  icon={CheckCircle}
                  iconColor="#10b981"
                />
                <StatCard
                  label="Error Rows"
                  value={batchSummary?.errorRows ?? 0}
                  icon={XCircle}
                  iconColor="#ef4444"
                />
                <StatCard
                  label="Duplicate Signals"
                  value={stagedRecords.filter((r) => r.isDuplicate).length}
                  icon={AlertTriangle}
                  iconColor="#f59e0b"
                />
              </div>

              {/* Action Bar */}
              <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    Staging & Validation Results Preview
                  </h4>
                  <p className="text-xs text-gray-500">
                    Review row-level validation status. Only valid records will be committed upon explicit human approval.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {Boolean(batchSummary?.errorRows) && (
                    <Button variant="secondary" size="sm" icon={Download} onClick={handleDownloadErrorsCSV}>
                      Export Error Report
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    icon={CheckCircle}
                    disabled={!batchSummary?.validRows}
                    onClick={() => setCommitConfirmOpen(true)}
                  >
                    IMPORT VALID RECORDS ({batchSummary?.validRows})
                  </Button>
                </div>
              </div>

              {/* Staged Records Grid */}
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-800/80 font-semibold uppercase text-gray-500 border-b border-gray-100 dark:border-gray-800">
                      <tr>
                        <th className="p-3">Excel Row</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Sr No</th>
                        <th className="p-3">Truck No</th>
                        <th className="p-3">Party Name</th>
                        <th className="p-3 font-mono text-right">N-Wt</th>
                        <th className="p-3 font-mono text-right">R-Wt</th>
                        <th className="p-3">Validation Errors / Warnings</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {stagedRecords.map((rec) => (
                        <tr
                          key={rec.id}
                          className={`hover:bg-gray-50/50 dark:hover:bg-gray-800/50 ${
                            !rec.isValid ? "bg-red-50/30 dark:bg-red-950/10" : rec.isDuplicate ? "bg-amber-50/30 dark:bg-amber-950/10" : ""
                          }`}
                        >
                          <td className="p-3 font-mono font-bold">Row #{rec.rowNumber}</td>
                          <td className="p-3">
                            <Badge variant={rec.isValid ? "success" : "danger"}>
                              {rec.isValid ? (rec.isDuplicate ? "DUPLICATE" : "VALID") : "INVALID"}
                            </Badge>
                          </td>
                          <td className="p-3 font-mono">{rec.mappedData?.entryDate || "-"}</td>
                          <td className="p-3 font-mono">{rec.mappedData?.srNo ?? "-"}</td>
                          <td className="p-3 font-medium">{rec.mappedData?.truckNumberRaw || "-"}</td>
                          <td className="p-3 font-semibold">{rec.mappedData?.partyName || "-"}</td>
                          <td className="p-3 text-right font-mono">{Number(rec.mappedData?.nWeight || 0).toFixed(3)}</td>
                          <td className="p-3 text-right font-mono">{Number(rec.mappedData?.rWeight || 0).toFixed(3)}</td>
                          <td className="p-3 text-xs">
                            {rec.errors.length > 0 ? (
                              <ul className="space-y-0.5">
                                {rec.errors.map((err) => (
                                  <li key={err.id} className={err.severity === "ERROR" ? "text-red-600 font-medium" : "text-amber-600"}>
                                    • {err.errorMessage}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-emerald-600">✓ Ready for import</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Confirmation Modal */}
              <Modal
                open={commitConfirmOpen}
                onClose={() => setCommitConfirmOpen(false)}
                title="Explicit Human Approval Required"
                size="md"
              >
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs">
                    <ShieldAlert size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block mb-1">Production Database Commitment</span>
                      <span>
                        You are about to import <strong>{batchSummary?.validRows} valid records</strong> into the active firm database. This action will create production operational trips and daily book entries.
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500">
                    No automatic bills, payments, or ledger transactions will be created. Are you sure you want to proceed with committing this batch?
                  </p>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <Button variant="secondary" size="sm" onClick={() => setCommitConfirmOpen(false)}>
                      Cancel
                    </Button>
                    <Button variant="primary" size="sm" icon={CheckCircle} onClick={handleCommitBatch} loading={loading}>
                      Confirm & Commit Batch
                    </Button>
                  </div>
                </div>
              </Modal>
            </div>
          )}

          {/* STEP 4: Commit Success */}
          {step === 4 && (
            <div className="card text-center py-12 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 flex items-center justify-center mx-auto">
                <CheckCircle size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Import Batch Committed Successfully!
                </h3>
                <p className="text-sm text-gray-500 max-w-md mx-auto">{commitSuccess}</p>
              </div>
              <div className="pt-4">
                <Button icon={RotateCcw} onClick={handleResetWizard}>
                  Import Another File
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* TAB 2: Import History */
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <History size={16} className="text-indigo-500" />
              Import History Batches
            </h3>
            <Button variant="secondary" size="sm" icon={RotateCcw} onClick={loadHistory} loading={loadingHistory}>
              Refresh
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800/80 font-semibold uppercase text-gray-500 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="p-3">File Name</th>
                  <th className="p-3">FY</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Total Rows</th>
                  <th className="p-3 text-right">Valid Rows</th>
                  <th className="p-3 text-right">Error Rows</th>
                  <th className="p-3 text-right">Committed Rows</th>
                  <th className="p-3">Uploaded Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loadingHistory ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-400">
                      Loading import history…
                    </td>
                  </tr>
                ) : !historyBatches.length ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-400">
                      No historical import batches found for active firm. Status: No file imported yet.
                    </td>
                  </tr>
                ) : (
                  historyBatches.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                      <td className="p-3 font-semibold text-gray-900 dark:text-gray-100">
                        {b.originalFileName}
                      </td>
                      <td className="p-3 font-mono">
                        <Badge variant="neutral">{b.financialYear}</Badge>
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={
                            b.status === "COMMITTED"
                              ? "success"
                              : b.status === "ERRORS"
                              ? "danger"
                              : b.status === "VALIDATED"
                              ? "info"
                              : "neutral"
                          }
                        >
                          {b.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-mono">{b.totalRows}</td>
                      <td className="p-3 text-right font-mono text-emerald-600">{b.validRows}</td>
                      <td className="p-3 text-right font-mono text-red-500">{b.errorRows}</td>
                      <td className="p-3 text-right font-mono font-bold text-indigo-600">{b.committedRows}</td>
                      <td className="p-3 whitespace-nowrap text-gray-500">{formatDate(b.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
