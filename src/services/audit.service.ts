import { eq, and, gte, lte, desc, count } from "drizzle-orm";
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

export interface AuditLogQueryOptions {
  page?: number;
  limit?: number;
  action?: string;
  entityName?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Strips sensitive keys (passwords, tokens, database URLs, API keys) before writing or returning audit payload.
 */
export function sanitizePayload(payload: any): any {
  if (!payload) return null;
  if (typeof payload !== "object") return payload;
  if (Array.isArray(payload)) {
    return payload.map(sanitizePayload);
  }

  const sensitiveKeys = [
    "password",
    "password_hash",
    "passwordhash",
    "pass",
    "token",
    "secret",
    "database_url",
    "databaseurl",
    "apikey",
    "api_key",
    "authorization",
    "session",
    "cookie",
  ];

  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(payload)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
      sanitized[key] = "[REDACTED]";
    } else if (val && typeof val === "object") {
      sanitized[key] = sanitizePayload(val);
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

/**
 * Query audit logs for active firm with server-side secret redaction and pagination.
 */
export async function getAuditLogs(
  db: NodePgDatabase<any>,
  firmId: string,
  options: AuditLogQueryOptions = {}
) {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 50));
  const offset = (page - 1) * limit;

  const conditions = [eq(auditLogs.firmId, firmId)];

  if (options.action) {
    conditions.push(eq(auditLogs.action, options.action as any));
  }
  if (options.entityName) {
    conditions.push(eq(auditLogs.entityName, options.entityName));
  }
  if (options.startDate) {
    conditions.push(gte(auditLogs.createdAt, new Date(options.startDate)));
  }
  if (options.endDate) {
    conditions.push(lte(auditLogs.createdAt, new Date(options.endDate)));
  }

  const whereClause = and(...conditions);

  const [totals] = await db
    .select({ totalCount: count() })
    .from(auditLogs)
    .where(whereClause);

  const totalCount = Number(totals?.totalCount || 0);

  const rows = await db
    .select({
      id: auditLogs.id,
      firmId: auditLogs.firmId,
      userId: auditLogs.userId,
      userEmail: auditLogs.userEmail,
      action: auditLogs.action,
      entityName: auditLogs.entityName,
      entityId: auditLogs.entityId,
      oldValues: auditLogs.oldValues,
      newValues: auditLogs.newValues,
      reason: auditLogs.reason,
      ipAddress: auditLogs.ipAddress,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(whereClause)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  // Server-side sanitization pass to guarantee zero sensitive data exposure
  const sanitizedLogs = rows.map((log) => ({
    ...log,
    oldValues: sanitizePayload(log.oldValues),
    newValues: sanitizePayload(log.newValues),
  }));

  return {
    logs: sanitizedLogs,
    pagination: {
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit) || 1,
    },
  };
}

