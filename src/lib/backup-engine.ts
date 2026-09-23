// ============================================================
// PRODUCTION LOGICAL BACKUP ENGINE
// Handles secure pg_dump execution, SHA-256 verification, manifest generation,
// pg_restore --list TOC validation, and strict credential redaction.
// Never logs, prints, or stores plaintext passwords or connection URIs.
// ============================================================

import { execSync, exec } from "child_process";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface BackupManifest {
  backup_id: string;
  created_at_utc: string;
  database_type: "PostgreSQL";
  postgres_server_version: string;
  pg_dump_client_version: string;
  archive_format: "custom (-Fc)";
  compression_info: string;
  dump_filename: string;
  dump_file_size_bytes: number;
  sha256_checksum: string;
  validation_status: "PASS" | "FAIL";
  pg_restore_list_verified: boolean;
  table_object_count_from_toc: number;
  schema_version: string;
  app_version: string;
  table_row_counts: Record<string, number>;
  redacted_host: string;
}

export interface BackupExecutionResult {
  status: "PASS" | "FAIL";
  dumpFilePath: string;
  checksumPath: string;
  manifestPath: string;
  fileSizeBytes: number;
  sha256Checksum: string;
  tocObjectCount: number;
  serverVersion: string;
  clientVersion: string;
  error?: string;
  manifest?: BackupManifest;
}

/**
  Redacts connection strings and passwords from strings to prevent credential exposure.
 */
export function redactConnectionString(input: string): string {
  if (!input || typeof input !== "string") return "";
  let redacted = input;
  // Redact postgresql:// or postgres:// connection URIs
  redacted = redacted.replace(
    /postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:\/]+)(?::(\d+))?\/([^?\s]+)(\?[^\s]*)?/gi,
    "postgresql://[REDACTED_USER]:[REDACTED_PASS]@[REDACTED_HOST]:$4/$5"
  );
  // Redact password parameters
  redacted = redacted.replace(/password=([^&\s]+)/gi, "password=[REDACTED]");
  return redacted;
}

/**
 * Validates that connection string is direct (unpooled) for pg_dump execution.
 */
export function isDirectPgConnection(urlStr: string): boolean {
  if (!urlStr) return false;
  const lower = urlStr.toLowerCase();
  // Ensure it's PostgreSQL and does not contain connection pooling indicators
  if (!lower.startsWith("postgres://") && !lower.startsWith("postgresql://")) {
    return false;
  }
  if (lower.includes("-pooler") || lower.includes("pgbouncer=true")) {
    return false; // Pooled connections are unsafe for pg_dump
  }
  return true;
}

/**
 * Generates UTC timestamp string in ISO-8601 format compatible with filenames.
 */
export function generateBackupTimestampIso(date: Date = new Date()): {
  isoUtc: string;
  folderDate: string;
  folderYear: string;
  folderMonth: string;
  filenameTimestamp: string;
} {
  const isoUtc = date.toISOString(); // e.g. 2026-09-23T12:30:00.000Z
  const folderYear = isoUtc.substring(0, 4);
  const folderMonth = isoUtc.substring(5, 7);
  const folderDate = isoUtc.substring(0, 10);
  const filenameTimestamp = isoUtc.replace(/[:.]/g, "-");

  return {
    isoUtc,
    folderYear,
    folderMonth,
    folderDate,
    filenameTimestamp,
  };
}

/**
 * Calculates SHA-256 checksum of a file.
 */
export function calculateSha256(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found for SHA-256 calculation: ${filePath}`);
  }
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
}

/**
 * Verifies that SHA-256 checksum of a file matches expected hash.
 */
export function verifySha256Checksum(filePath: string, expectedHash: string): boolean {
  const actualHash = calculateSha256(filePath);
  return crypto.timingSafeEqual(Buffer.from(actualHash), Buffer.from(expectedHash));
}

/**
 * Validates custom dump file using `pg_restore --list`.
 */
export function validatePgRestoreList(dumpFilePath: string): {
  success: boolean;
  tocCount: number;
  tableNames: string[];
  output: string;
} {
  if (!fs.existsSync(dumpFilePath)) {
    throw new Error(`Dump file not found for pg_restore validation: ${dumpFilePath}`);
  }

  try {
    const output = execSync(`pg_restore --list "${dumpFilePath}"`, {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });

    const lines = output.split("\n").filter((l) => l.trim().length > 0);
    const tocCount = lines.length;

    // Extract TABLE names from TOC lines (lines containing "TABLE DATA" or "TABLE")
    const tableNames: string[] = [];
    for (const line of lines) {
      if (line.includes("TABLE DATA public ") || line.includes("TABLE public ")) {
        const parts = line.split("public.");
        if (parts.length > 1) {
          const tableName = parts[1].split(" ")[0].trim();
          if (tableName && !tableNames.includes(tableName)) {
            tableNames.push(tableName);
          }
        }
      }
    }

    return {
      success: tocCount > 0,
      tocCount,
      tableNames,
      output,
    };
  } catch (err: any) {
    return {
      success: false,
      tocCount: 0,
      tableNames: [],
      output: redactConnectionString(err?.message || String(err)),
    };
  }
}

/**
 * Extracts host parameter safely from connection URI for manifest without exposing user/pass.
 */
export function getRedactedHost(connectionUrl: string): string {
  try {
    const parsed = new URL(connectionUrl);
    return parsed.hostname || "[REDACTED_HOST]";
  } catch {
    return "[REDACTED_HOST]";
  }
}
