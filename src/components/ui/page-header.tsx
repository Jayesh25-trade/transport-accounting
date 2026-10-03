import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
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
            <div className="text-[11px] font-bold tracking-[0.18em] text-[#E05638] uppercase mb-1">
              {eyebrow}
            </div>
          )}
          {/* Breadcrumbs */}
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav aria-label="Breadcrumb" className="breadcrumb mb-1.5 flex items-center gap-1.5 text-xs text-[#7A7F85]">
              <Link href="/dashboard" className="hover:text-[#1A1D20] transition-colors">
                Dashboard
              </Link>
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={idx}>
                  <ChevronRight size={12} className="text-[#9E9A91]" />
                  {crumb.href && idx < breadcrumbs.length - 1 ? (
                    <Link href={crumb.href} className="hover:text-[#1A1D20] transition-colors">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-[#1A1D20] font-medium">{crumb.label}</span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          )}

          <h1 className="text-2xl font-bold tracking-tight text-[#1A1D20]">{title}</h1>
          {displaySubtitle && (
            <p className="text-sm text-[#5F6368] mt-1">{displaySubtitle}</p>
          )}
        </div>

        {/* Actions */}
        {actions && (
          <div className="flex items-center gap-2.5 flex-shrink-0">{actions}</div>
        )}
      </div>
    </div>
  );
}
