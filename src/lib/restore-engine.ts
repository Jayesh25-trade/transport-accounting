// ============================================================
// LOGICAL BACKUP RESTORE ENGINE (PHASE 4C-2U-C3)
// Handles safe, isolated PostgreSQL restoration drills, schema verification,
// row count auditing, foreign key integrity checks, credential redaction,
// and automated cleanup.
// MUST NEVER REFERENCE OR MUTATE LIVE PRODUCTION DATABASE.
// ============================================================

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { Client } from "pg";
import {
  redactConnectionString,
  calculateSha256,
  verifySha256Checksum,
} from "./backup-engine";

export const EXPECTED_25_TABLES = [
  "users",
  "sessions",
  "user_firm_memberships",
  "firms",
  "firm_bill_sequences",
  "parties",
  "companies",
  "trucks",
  "locations",
  "customer_rules",
  "daily_entries",
  "trips",
  "driver_vouchers",
  "bills",
  "bill_items",
  "tds_entries",
  "debit_notes",
  "payments",
  "payment_allocations",
  "ledger_transactions",
  "opening_balances",
  "audit_logs",
  "import_batches",
  "raw_import_records",
  "import_errors",
] as const;

export const EXPECTED_BASELINE_COUNTS: Record<string, number> = {
  firms: 2,
  users: 2,
  user_firm_memberships: 4,
  firm_bill_sequences: 2,
  audit_logs: 44,
  sessions: 0,
  parties: 0,
  companies: 0,
  trucks: 0,
  locations: 0,
  customer_rules: 0,
  daily_entries: 0,
  trips: 0,
  driver_vouchers: 0,
  bills: 0,
  bill_items: 0,
  tds_entries: 0,
  debit_notes: 0,
  payments: 0,
  payment_allocations: 0,
  ledger_transactions: 0,
  opening_balances: 0,
  import_batches: 0,
  raw_import_records: 0,
  import_errors: 0,
};

export interface RestoreVerificationResult {
  status: "PASS" | "FAIL";
  observedRestoreTimeMs: number;
  observedRestoreTimeFormatted: string;
  sha256Verified: boolean;
  isolatedDbName: string;
  tablesVerifiedCount: number;
  missingTables: string[];
  rowCountMismatch: Record<string, { expected: number; actual: number }>;
  fkViolationsCount: number;
  appHealthOk: boolean;
  cleanedUp: boolean;
  error?: string;
}

/**
 * Ensures connection string does NOT point to a production database.
 */
export function assertNotProductionUrl(connectionUrl: string): void {
  if (!connectionUrl) {
    throw new Error("Connection URL is empty!");
  }
  const lower = connectionUrl.toLowerCase();
  if (lower.includes("neon.tech") || lower.includes("neondb") || lower.includes("ep-")) {
    throw new Error(
      "CRITICAL SAFETY VIOLATION: Refusing to run restore operations against production Neon database!"
    );
  }
}

/**
 * Creates an isolated temporary local database for restore validation.
 */
export async function createIsolatedRestoreDb(
  dbName: string,
  postgresAdminUrl: string
): Promise<void> {
  assertNotProductionUrl(postgresAdminUrl);

  const client = new Client({ connectionString: postgresAdminUrl });
  try {
    await client.connect();
    // Drop database if exists (force disconnect prior sessions)
    await client.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [dbName]
    );
    await client.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    await client.query(`CREATE DATABASE "${dbName}"`);
  } catch (err: any) {
    throw new Error(`Failed to create isolated restore DB: ${redactConnectionString(err?.message || String(err))}`);
  } finally {
    await client.end().catch(() => {});
  }
}

/**
 * Drops the isolated temporary local database.
 */
export async function dropIsolatedRestoreDb(
  dbName: string,
  postgresAdminUrl: string
): Promise<void> {
  assertNotProductionUrl(postgresAdminUrl);

  const client = new Client({ connectionString: postgresAdminUrl });
  try {
    await client.connect();
    await client.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [dbName]
    );
    await client.query(`DROP DATABASE IF EXISTS "${dbName}"`);
  } catch (err: any) {
    console.error(`Warning during isolated DB cleanup: ${redactConnectionString(err?.message || String(err))}`);
  } finally {
    await client.end().catch(() => {});
  }
}

/**
 * Restores custom-format PostgreSQL archive (.dump) into isolated target database.
 * Returns observed duration in milliseconds.
 */
export function executePgRestore(
  dumpFilePath: string,
  targetConnectionUrl: string
): { durationMs: number; output: string } {
  assertNotProductionUrl(targetConnectionUrl);

  if (!fs.existsSync(dumpFilePath)) {
    throw new Error(`Backup dump file not found: ${dumpFilePath}`);
  }

  const startTime = performance.now();

  try {
    // pg_restore options: --clean --if-exists --no-owner --no-privileges
    const cmd = `pg_restore --clean --if-exists --no-owner --no-privileges --dbname="${targetConnectionUrl}" "${dumpFilePath}"`;
    const output = execSync(cmd, {
      encoding: "utf-8",
      maxBuffer: 50 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const endTime = performance.now();
    return {
      durationMs: Math.round(endTime - startTime),
      output: redactConnectionString(output),
    };
  } catch (err: any) {
    const endTime = performance.now();
    // Note: pg_restore might return warnings exit code 1 in some cases, but if it fails critically throw
    const errorMsg = redactConnectionString(err?.stderr || err?.message || String(err));
    // If output exists despite non-zero exit (e.g. warnings on drop if not exists), check if schema exists
    if (err?.status === 1 && errorMsg.includes("WARNING")) {
      return {
        durationMs: Math.round(endTime - startTime),
        output: errorMsg,
      };
    }
    throw new Error(`pg_restore failed: ${errorMsg}`);
  }
}

/**
 * Audits schema of restored database, confirming all expected tables exist.
 */
export async function verifyRestoredSchema(
  targetConnectionUrl: string
): Promise<{ presentTables: string[]; missingTables: string[] }> {
  assertNotProductionUrl(targetConnectionUrl);

  const client = new Client({ connectionString: targetConnectionUrl });
  try {
    await client.connect();
    const res = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );
    const presentTables = res.rows.map((r) => r.table_name as string);

    const missingTables: string[] = [];
    for (const expectedTable of EXPECTED_25_TABLES) {
      if (!presentTables.includes(expectedTable)) {
        missingTables.push(expectedTable);
      }
    }

    return { presentTables, missingTables };
  } finally {
    await client.end().catch(() => {});
  }
}

/**
 * Audits row counts of all 25 tables in restored database against expected baseline.
 */
export async function verifyRestoredRowCounts(
  targetConnectionUrl: string
): Promise<{
  counts: Record<string, number>;
  mismatches: Record<string, { expected: number; actual: number }>;
}> {
  assertNotProductionUrl(targetConnectionUrl);

  const client = new Client({ connectionString: targetConnectionUrl });
  try {
    await client.connect();
    const counts: Record<string, number> = {};
    const mismatches: Record<string, { expected: number; actual: number }> = {};

    for (const table of EXPECTED_25_TABLES) {
      const res = await client.query(`SELECT COUNT(*)::int AS cnt FROM "${table}"`);
      const actual = res.rows[0].cnt as number;
      counts[table] = actual;

      const expected = EXPECTED_BASELINE_COUNTS[table];
      if (expected !== undefined && actual !== expected) {
        mismatches[table] = { expected, actual };
      }
    }

    return { counts, mismatches };
  } finally {
    await client.end().catch(() => {});
  }
}

/**
 * Verifies foreign key constraint integrity in restored database (zero orphaned records).
 */
export async function verifyForeignKeyIntegrity(
  targetConnectionUrl: string
): Promise<{ violationsCount: number; details: string[] }> {
  assertNotProductionUrl(targetConnectionUrl);

  const client = new Client({ connectionString: targetConnectionUrl });
  try {
    await client.connect();
    const details: string[] = [];
    let violationsCount = 0;

    // 1. Check user_firm_memberships -> users
    const memberUserCheck = await client.query(
      `SELECT count(*)::int as cnt FROM user_firm_memberships m LEFT JOIN users u ON m.user_id = u.id WHERE u.id IS NULL`
    );
    if (memberUserCheck.rows[0].cnt > 0) {
      violationsCount += memberUserCheck.rows[0].cnt;
      details.push(`Orphaned user_firm_memberships without user: ${memberUserCheck.rows[0].cnt}`);
    }

    // 2. Check user_firm_memberships -> firms
    const memberFirmCheck = await client.query(
      `SELECT count(*)::int as cnt FROM user_firm_memberships m LEFT JOIN firms f ON m.firm_id = f.id WHERE f.id IS NULL`
    );
    if (memberFirmCheck.rows[0].cnt > 0) {
      violationsCount += memberFirmCheck.rows[0].cnt;
      details.push(`Orphaned user_firm_memberships without firm: ${memberFirmCheck.rows[0].cnt}`);
    }

    // 3. Check firm_bill_sequences -> firms
    const seqFirmCheck = await client.query(
      `SELECT count(*)::int as cnt FROM firm_bill_sequences s LEFT JOIN firms f ON s.firm_id = f.id WHERE f.id IS NULL`
    );
    if (seqFirmCheck.rows[0].cnt > 0) {
      violationsCount += seqFirmCheck.rows[0].cnt;
      details.push(`Orphaned firm_bill_sequences without firm: ${seqFirmCheck.rows[0].cnt}`);
    }

    return { violationsCount, details };
  } finally {
    await client.end().catch(() => {});
  }
}

/**
 * Tests isolated application-level DB connectivity and basic querying.
 */
export async function verifyApplicationConnectivity(
  targetConnectionUrl: string
): Promise<boolean> {
  assertNotProductionUrl(targetConnectionUrl);

  const client = new Client({ connectionString: targetConnectionUrl });
  try {
    await client.connect();
    const res = await client.query(`SELECT id, name FROM firms ORDER BY name ASC`);
    return res.rows.length === 2 && res.rows[0].name === "Deepraj Transport";
  } catch (err) {
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}
