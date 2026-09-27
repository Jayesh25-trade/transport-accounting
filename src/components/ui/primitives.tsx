import React from "react";
import { cn } from "@/lib/utils";

// ─── Badge ──────────────────────────────────────────────────
type BadgeVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "posted"
  | "pending"
  | "received"
  | "coral"
  | "turq"
  | "sun";

interface BadgeProps {
  variant?: BadgeVariant;
  tone?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant, tone, children, className }: BadgeProps) {
  const activeVariant = tone || variant || "neutral";
  return (
    <span className={cn("badge", `badge-${activeVariant}`, className)}>
      {children}
    </span>
  );
}

// ─── Button ──────────────────────────────────────────────────
type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "ghost"
  | "coral"
  | "ink"
  | "turq";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  icon?: React.ElementType;
  iconPosition?: "left" | "right";
  loading?: boolean;
}

export function Button({
  variant = "secondary",
  size = "md",
  children,
  icon: Icon,
  iconPosition = "left",
  loading,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        "btn",
        `btn-${variant}`,
        size === "sm" && "btn-sm",
        size === "lg" && "btn-lg",
        className
      )}
    >
      {loading && (
        <svg
          className="animate-spin w-3.5 h-3.5"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
      )}
      {!loading && Icon && iconPosition === "left" && <Icon size={14} />}
      {children}
      {!loading && Icon && iconPosition === "right" && <Icon size={14} />}
    </button>
  );
}

// ─── Panel / Container ───────────────────────────────────────
interface PanelProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
}: PanelProps) {
  return (
    <div className={cn("panel mb-6 border border-[#D8D5CE] bg-white rounded-2xl shadow-xs p-6", className)}>
      {(title || subtitle || action) && (
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            {title && <h3 className="panel-title text-base font-bold text-[#1A1D20]">{title}</h3>}
            {subtitle && <p className="panel-subtitle text-xs text-[#5F6368]">{subtitle}</p>}
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────
interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center border border-dashed border-[#D8D5CE] rounded-2xl bg-[#FAF8F5]">
      {Icon && (
        <div className="w-12 h-12 rounded-xl bg-white border border-[#D8D5CE] flex items-center justify-center mb-3 text-[#7A7F85]">
          <Icon size={20} />
        </div>
      )}
      <h3 className="text-sm font-bold text-[#1A1D20] mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-xs text-[#5F6368] max-w-xs mb-4">{description}</p>
      )}
      {action}
    </div>
  );
}

// ─── Divider ─────────────────────────────────────────────────
export function Divider({ className }: { className?: string }) {
  return (
    <hr
      className={cn("border-0 border-t border-[#D8D5CE] my-4", className)}
    />
  );
}
