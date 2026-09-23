import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Settings"
        subtitle="Application and firm configuration"
        breadcrumbs={[{ label: "Settings" }]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Firm Configuration
          </h2>
          <p className="text-sm text-gray-500">
            Firm details, TDS defaults, and financial year settings will be
            configurable here.
          </p>
        </div>
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            User Management
          </h2>
          <p className="text-sm text-gray-500">
            Role-based user access — Admin, Accountant, Manager — will be
            managed here.
          </p>
        </div>
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Database Backup
          </h2>
          <p className="text-sm text-gray-500">
            PostgreSQL backup schedule and restore utilities.
          </p>
        </div>
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Audit Log
          </h2>
          <p className="text-sm text-gray-500">
            Full transaction audit trail — who changed what, and when.
          </p>
        </div>
      </div>
    </div>
  );
}
