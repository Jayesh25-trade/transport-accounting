import React from "react";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: string;
  description?: string;
  eyebrow?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  description,
  eyebrow,
  breadcrumbs,
  actions,
}: PageHeaderProps) {
  const displaySubtitle = subtitle || description;
  return (
    <div className="page-header mb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <div className="text-[11px] font-semibold tracking-[0.2em] text-coral uppercase mb-1">
              {eyebrow}
            </div>
          )}
          {/* Breadcrumbs */}
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav aria-label="Breadcrumb" className="breadcrumb mb-1.5">
              <Link href="/dashboard" className="inline-flex items-center gap-0.5">
                <Home size={11} />
              </Link>
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={idx}>
                  <ChevronRight size={11} className="text-gray-300" />
                  {crumb.href && idx < breadcrumbs.length - 1 ? (
                    <Link href={crumb.href}>{crumb.label}</Link>
                  ) : (
                    <span className="text-gray-400">{crumb.label}</span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          )}

          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{title}</h1>
          {displaySubtitle && (
            <p className="text-sm text-gray-500 mt-0.5">{displaySubtitle}</p>
          )}
        </div>

        {/* Actions */}
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
        )}
      </div>
    </div>
  );
}
