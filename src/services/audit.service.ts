import { auditLogs } from "../db/schema";
import { type PgTransaction } from "drizzle-orm/pg-core";
import { type NodePgDatabase } from "drizzle-orm/node-postgres";

export interface RecordAuditInput {
  firmId?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  action: "CREATE" | "UPDATE" | "DELETE" | "CANCEL" | "POST" | "REVERSE" | "LOGIN" | "LOGOUT" | "IMPORT";
  entityName: string;
  entityId?: string | null;
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Strips sensitive keys (passwords, tokens, database URLs) before writing audit payload.
 */
function sanitizePayload(payload: Record<string, any> | null | undefined): Record<string, any> | null {
  if (!payload) return null;
  const sensitiveKeys = ["password", "password_hash", "passwordHash", "token", "secret", "database_url", "databaseUrl"];
  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(payload)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

/**
 * Service helper to write an audit log entry.
 * Can execute within a Drizzle transaction or standard DB client.
 */
export async function recordAuditLog(
  dbOrTx: NodePgDatabase<any> | PgTransaction<any, any, any>,
  input: RecordAuditInput
): Promise<void> {
  await dbOrTx.insert(auditLogs).values({
    firmId: input.firmId || null,
    userId: input.userId || null,
    userEmail: input.userEmail || null,
    action: input.action,
    entityName: input.entityName,
    entityId: input.entityId || null,
    oldValues: sanitizePayload(input.oldValues),
    newValues: sanitizePayload(input.newValues),
    reason: input.reason || null,
    ipAddress: input.ipAddress || null,
    userAgent: input.userAgent || null,
  });
}
