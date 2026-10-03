import { execSync } from "child_process";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import fs from "fs";
import path from "path";

const BACKUP_DIR = path.join(
  process.env.APP_DATA_DIR || "C:\\Users\\SHRIRAM\\.gemini\\antigravity-ide\\brain\\14c6df3a-3aea-4f5f-b31f-c2b1d6cdee34",
  "backups"
);

const EXPECTED_TABLES = [
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
];

async function verifyBackupArchive() {
  console.log("==================================================");
  console.log("BACKUP ARCHIVE RESTORE DRILL VERIFIER (PHASE 4C-2U)");
  console.log("==================================================");

  if (!fs.existsSync(BACKUP_DIR)) {
    throw new Error(`Backup directory does not exist: ${BACKUP_DIR}`);
  }

  const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith(".dump"));
  if (files.length === 0) {
    throw new Error(`No .dump backup files found in ${BACKUP_DIR}!`);
  }

  // Sort by modification time to get latest backup
  files.sort((a, b) => {
    return fs.statSync(path.join(BACKUP_DIR, b)).mtimeMs - fs.statSync(path.join(BACKUP_DIR, a)).mtimeMs;
  });

  const latestBackup = files[0];
  const backupPath = path.join(BACKUP_DIR, latestBackup);
  const stats = fs.statSync(backupPath);

  console.log(`- Latest Backup Archive: ${latestBackup}`);
  console.log(`- Archive Size: ${(stats.size / 1024).toFixed(2)} KB (${stats.size} bytes)`);

  console.log("\nParsing archive header & TOC via pg_restore --list...");
  const tocOutput = execSync(`pg_restore --list "${backupPath}"`, { encoding: "utf-8" });

  const missingTables: string[] = [];
  for (const table of EXPECTED_TABLES) {
    if (!tocOutput.includes(`TABLE public ${table}`) && !tocOutput.includes(`TABLE Data public ${table}`)) {
      missingTables.push(table);
    }
  }

  console.log("\nTable Verification Results:");
  console.log(`- Total Required Tables Checked: ${EXPECTED_TABLES.length}`);
  console.log(`- Verified Tables Present: ${EXPECTED_TABLES.length - missingTables.length}`);

  if (missingTables.length > 0) {
    console.error("❌ Missing tables in backup archive:", missingTables);
    throw new Error(`Backup archive incomplete! Missing ${missingTables.length} tables.`);
  }

  console.log("✅ ALL 25 SYSTEM & BUSINESS TABLES VERIFIED PRESENT IN BACKUP ARCHIVE!");
  console.log("✅ Zero production mutations performed during backup verification drill.");
  console.log("==================================================");
}

verifyBackupArchive()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
