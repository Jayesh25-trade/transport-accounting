// ============================================================
// PHASE 4C-2U-C4.8-C UNIFIED AUTOMATED BACKUP PIPELINE
// Runs inside GitHub Actions or local environment.
// Does NOT depend on a pre-existing backups/ directory.
// REQUIRES process.env.PROD_DIRECT_DATABASE_URL EXCLUSIVELY.
// NEVER logs or exposes database credentials, passwords, or R2 keys.
// ============================================================

import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import {
  calculateSha256,
  isDirectPgConnection,
  generateBackupTimestampIso,
  validatePgRestoreList,
  redactConnectionString,
  getRedactedHost,
  BackupManifest,
} from "../src/lib/backup-engine";
import { uploadBackupArchiveToOffsite } from "../src/lib/storage-engine";

export async function runAutomatedBackupPipeline(): Promise<void> {
  console.log("==================================================");
  console.log("PRODUCTION AUTOMATED OFF-SITE BACKUP PIPELINE");
  console.log("==================================================");

  // 1. Environment & Connection Guard
  const directUrl = process.env.PROD_DIRECT_DATABASE_URL;
  if (!directUrl || directUrl.trim().length === 0) {
    throw new Error(
      "BACKUP_FAILED: PROD_DIRECT_DATABASE_URL environment variable is missing! Production backup automation requires an explicit direct unpooled connection string."
    );
  }

  if (!isDirectPgConnection(directUrl)) {
    throw new Error(
      "BACKUP_FAILED: PROD_DIRECT_DATABASE_URL is not a valid direct unpooled PostgreSQL connection URI (pooled or pgbouncer URLs are rejected)."
    );
  }

  console.log(`- Database Host: ${getRedactedHost(directUrl)}`);
  console.log("- Connection Mode: Direct Unpooled PostgreSQL (Verified)");

  // 2. Directory Provisioning
  const now = new Date();
  const { isoUtc, folderYear, folderMonth, folderDate, filenameTimestamp } =
    generateBackupTimestampIso(now);
  const backupDir = path.join(
    process.cwd(),
    "backups",
    "production",
    folderYear,
    folderMonth,
    folderDate
  );

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const dumpFilename = `transport_app_prod_backup_${filenameTimestamp}.dump`;
  const dumpFilePath = path.join(backupDir, dumpFilename);
  const checksumPath = path.join(backupDir, "checksum.sha256");
  const manifestPath = path.join(backupDir, "manifest.json");

  console.log(`- Target Dump Path: ${dumpFilePath}`);

  // 3. Execute pg_dump (Custom Format)
  console.log("\n1. Executing pg_dump (Custom Format -Fc)...");
  const cmd = `pg_dump --dbname="${directUrl}" --format=custom --file="${dumpFilePath}" --no-owner --no-privileges`;

  try {
    execSync(cmd, { stdio: "pipe", env: process.env });
    console.log("   ✅ pg_dump executed successfully.");
  } catch (dumpErr: any) {
    const redactedError = redactConnectionString(dumpErr?.message || String(dumpErr));
    throw new Error(`BACKUP_FAILED: pg_dump execution failed! ${redactedError}`);
  }

  // 4. Dump Size Validation
  if (!fs.existsSync(dumpFilePath)) {
    throw new Error(`BACKUP_FAILED: Backup file not found at expected path: ${dumpFilePath}`);
  }

  const dumpStats = fs.statSync(dumpFilePath);
  console.log(`   - Archive Size: ${(dumpStats.size / 1024).toFixed(2)} KB (${dumpStats.size} bytes)`);

  if (dumpStats.size < 1000) {
    throw new Error(
      `BACKUP_FAILED: Backup file size (${dumpStats.size} bytes) is suspiciously small or empty (< 1000 bytes)!`
    );
  }

  // 5. SHA-256 Checksum Calculation
  console.log("\n2. Computing SHA-256 Checksum...");
  const dumpSha256 = calculateSha256(dumpFilePath);
  fs.writeFileSync(checksumPath, `${dumpSha256}  ${dumpFilename}\n`);
  console.log(`   ✅ SHA-256: ${dumpSha256}`);

  // 6. pg_restore --list Schema TOC Integrity Validation
  console.log("\n3. Validating Archive Schema TOC (pg_restore --list)...");
  const tocResult = validatePgRestoreList(dumpFilePath);
  if (!tocResult.success || tocResult.tocCount === 0) {
    throw new Error(
      `BACKUP_FAILED: Archive TOC validation failed! (Indexed TOC count: ${tocResult.tocCount})`
    );
  }
  console.log(`   ✅ TOC Integrity Verified (${tocResult.tocCount} database objects indexed).`);

  // 7. Manifest Generation
  console.log("\n4. Generating Non-Sensitive Backup Manifest...");
  const manifest: BackupManifest = {
    backup_id: `prod_backup_${filenameTimestamp}`,
    created_at_utc: isoUtc,
    database_type: "PostgreSQL",
    postgres_server_version: "16 (Production)",
    pg_dump_client_version: "16",
    archive_format: "custom (-Fc)",
    compression_info: "pg_dump custom format compression",
    dump_filename: dumpFilename,
    dump_file_size_bytes: dumpStats.size,
    sha256_checksum: dumpSha256,
    validation_status: "PASS",
    pg_restore_list_verified: true,
    table_object_count_from_toc: tocResult.tocCount,
    schema_version: "1.0.0",
    app_version: "1.0.0",
    table_row_counts: {},
    redacted_host: getRedactedHost(directUrl),
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`   ✅ Manifest written: ${manifestPath}`);

  // 8. R2 Off-Site Upload & Read-Back Verification
  console.log("\n5. Executing Off-Site R2 Upload & Read-Back SHA-256 Verification...");
  const uploadRes = await uploadBackupArchiveToOffsite(dumpFilePath, checksumPath, manifestPath);

  if (uploadRes.status !== "PASS" || !uploadRes.uploadVerified) {
    if (uploadRes.error?.includes("verification failed")) {
      throw new Error(`REMOTE_VERIFICATION_FAILED: ${uploadRes.error}`);
    }
    throw new Error(`UPLOAD_FAILED: ${uploadRes.error || "Unknown R2 upload failure"}`);
  }

  console.log(`   ✅ Off-Site Storage Provider: ${uploadRes.provider}`);
  console.log(`   ✅ Target Bucket: ${uploadRes.bucketName}`);
  console.log(`   ✅ Target Object Key: ${uploadRes.dumpObjectKey}`);
  console.log(`   ✅ Remote Read-Back SHA-256 Match: PASS`);

  // Summary Matrix
  console.log("\n==================================================");
  console.log("AUTOMATED BACKUP PIPELINE EXECUTED SUCCESSFULLY");
  console.log("==================================================");
  console.log(`- Backup Archive: ${dumpFilename} (${dumpStats.size} bytes)`);
  console.log(`- SHA-256: ${dumpSha256}`);
  console.log(`- Remote Key: ${uploadRes.dumpObjectKey}`);
  console.log(`- Read-Back Hash Verification: PASS`);
  console.log("==================================================");
}

// Execute CLI runner when invoked directly
if (require.main === module) {
  runAutomatedBackupPipeline()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      const msg = redactConnectionString(err?.message || String(err));
      console.error(`\n❌ AUTOMATED BACKUP PIPELINE FAILED: ${msg}`);
      process.exit(1);
    });
}
