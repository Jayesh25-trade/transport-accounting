"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

export function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Prevent body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={cn(
          "relative bg-white border border-[#D8D5CE] text-[#1A1D20] rounded-2xl shadow-2xl flex flex-col max-h-[85vh] w-full animate-fade-in my-auto",
          size === "sm" && "max-w-md",
          size === "md" && "max-w-xl",
          size === "lg" && "max-w-3xl",
          size === "xl" && "max-w-5xl"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D8D5CE] bg-[#FAF8F5] rounded-t-2xl flex-shrink-0">
          <h2 className="text-base font-bold text-[#1A1D20]">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#5F6368] hover:bg-[#EFECE6] hover:text-[#1A1D20] transition-colors"
            id="modal-close"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Form Field wrapper ──────────────────────────────────────
interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  hint?: string;
}

export function Field({ label, required, error, children, hint }: FieldProps) {
  return (
    <div className="form-group flex flex-col gap-1.5">
      <label className="text-xs font-bold text-[#5F6368] uppercase tracking-wider">
        {label}
        {required && <span className="text-[#D32F2F] ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-[#D32F2F] mt-0.5">{error}</p>
      )}
      {hint && !error && (
        <p className="text-xs text-[#7A7F85] mt-0.5">{hint}</p>
      )}
    </div>
  );
}

// ─── Form grid helper ────────────────────────────────────────
export function FormGrid({
  children,
  cols = 2,
}: {
  children: React.ReactNode;
  cols?: 1 | 2;
}) {
  return (
    <div
      className={cn(
        "grid gap-4",
        cols === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
      )}
    >
      {children}
    </div>
  );
}

// ─── Form Actions footer ─────────────────────────────────────
interface FormActionsProps {
  onCancel: () => void;
  loading?: boolean;
  submitLabel?: string;
  destructive?: boolean;
}

export function FormActions({
  onCancel,
  loading,
  submitLabel = "Save",
  destructive,
}: FormActionsProps) {
  return (
    <div className="flex items-center justify-end gap-2.5 pt-4 mt-4 border-t border-[#D8D5CE]">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-[#D8D5CE] bg-white px-4 py-2 text-xs font-semibold text-[#1A1D20] shadow-xs hover:bg-[#FAF8F5] transition-colors"
        disabled={loading}
      >
        Cancel
      </button>
      <button
        type="submit"
        className={cn(
          "rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors",
          destructive ? "bg-[#D32F2F] hover:bg-[#B71C1C]" : "bg-[#E05638] hover:bg-[#D04223]"
        )}
        disabled={loading}
      >
        {loading ? (
          <span className="flex items-center gap-1.5">
            <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Saving…
          </span>
        ) : (
          submitLabel
        )}
      </button>
    </div>
  );
}
