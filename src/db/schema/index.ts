// ============================================================
// DATABASE SCHEMA INDEX
// Central export point for all schema definitions.
// Import from "@/db/schema" or "@/db" in application code.
// Drizzle ORM uses this file as the schema source.
// ============================================================

// Master entities
export * from "./firms";
export * from "./users";
export * from "./parties-companies";
export * from "./customer-rules";
export * from "./trucks-locations";

// Operational
export * from "./daily-entries";
export * from "./driver-vouchers";
export * from "./trips";

// Billing
export * from "./bills";
export * from "./bill-items";
export * from "./tds-entries";
export * from "./debit-notes";

// Payments
export * from "./payments";

// Accounting
export * from "./ledger";

// System / Safety
export * from "./audit-logs";
export * from "./import";
export * from "./sessions";
export * from "./user-firm-memberships";
