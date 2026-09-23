// ============================================================
// PRODUCTION SAFETY & DATA PROTECTION UTILITIES
// Enforces safety guardrails against accidental destructive operations.
// ============================================================

import { AppError } from "./errors";

/**
 * Ensures direct destructive SQL commands are strictly prohibited in production.
 */
export function assertSafeQuery(sqlString: string): void {
  const normalized = sqlString.toUpperCase().trim();

  if (normalized.includes("TRUNCATE ")) {
    throw new AppError(
      "[SAFETY_VIOLATION] TRUNCATE statements are strictly prohibited in production.",
      "SAFETY_GUARDRAIL_TRIGGERED"
    );
  }

  if (normalized.includes("DROP DATABASE") || normalized.includes("DROP TABLE")) {
    throw new AppError(
      "[SAFETY_VIOLATION] DROP DATABASE/TABLE statements are strictly prohibited.",
      "SAFETY_GUARDRAIL_TRIGGERED"
    );
  }

  // Prevent unindexed wildcard deletes
  if (normalized.startsWith("DELETE FROM") && !normalized.includes("WHERE")) {
    throw new AppError(
      "[SAFETY_VIOLATION] DELETE statements without explicit WHERE clause are strictly prohibited.",
      "SAFETY_GUARDRAIL_TRIGGERED"
    );
  }
}

/**
 * Validates that explicit UUID filtering is provided for cleanup operations.
 */
export function assertSafeCleanupIds(ids: string[]): void {
  if (!ids || ids.length === 0) {
    throw new AppError(
      "[SAFETY_VIOLATION] Cleanup operations require an explicit non-empty array of record IDs.",
      "SAFETY_GUARDRAIL_TRIGGERED"
    );
  }

  for (const id of ids) {
    if (typeof id !== "string" || id.trim().length < 10) {
      throw new AppError(
        `[SAFETY_VIOLATION] Invalid record ID in cleanup manifest: '${id}'`,
        "SAFETY_GUARDRAIL_TRIGGERED"
      );
    }
  }
}

/**
 * Verifies that database URL string for logical dump uses unpooled direct connection.
 */
export function isDirectPgConnection(connectionString: string): boolean {
  if (!connectionString) return false;
  // Neon pooled endpoints typically contain '-pooler' in hostname
  return !connectionString.includes("-pooler.");
}
