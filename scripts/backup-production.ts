import { execSync } from "child_process";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import fs from "fs";
import path from "path";
import { isDirectPgConnection } from "../src/lib/safety";

const BACKUP_DIR = path.join(
  process.env.APP_DATA_DIR || "C:\\Users\\SHRIRAM\\.gemini\\antigravity-ide\\brain\\14c6df3a-3aea-4f5f-b31f-c2b1d6cdee34",
  "backups"
);

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

async function runProductionBackup() {
  console.log("==================================================");
  console.log("PRODUCTION BACKUP UTILITY (PHASE 4C-2U)");
  console.log("==================================================");

  const dbUrl = process.env.PROD_DIRECT_DATABASE_URL;
  if (!dbUrl) {
    throw new Error("PROD_DIRECT_DATABASE_URL environment variable is missing! Production backups require an explicit direct unpooled connection string.");
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFileName = `transport_app_prod_backup_${timestamp}.dump`;
  const backupFilePath = path.join(BACKUP_DIR, backupFileName);

  const isDirect = isDirectPgConnection(dbUrl);
  console.log(`- Connection Type: ${isDirect ? "Direct Connection (Recommended)" : "Pooled Connection"}`);
  console.log(`- Output Target: ${backupFilePath}`);

  // Redact credentials for logging
  const maskedUrl = dbUrl.replace(/\/\/[^:]+:[^@]+@/, "//[REDACTED]:[REDACTED]@");
  console.log(`- Connecting to PostgreSQL: ${maskedUrl}`);

  console.log("\nExecuting pg_dump (Custom Format)...");
  
  // Execute pg_dump command securely
  const cmd = `pg_dump --dbname="${dbUrl}" --format=custom --file="${backupFilePath}" --no-owner --no-privileges`;
  
  try {
    execSync(cmd, { stdio: "pipe", env: process.env });
    console.log("✅ pg_dump executed successfully!");
  } catch (err: any) {
    console.error("❌ pg_dump execution failed:", err.message);
    throw err;
  }

  // Inspect generated file
  const stats = fs.statSync(backupFilePath);
  console.log(`- Backup Size: ${(stats.size / 1024).toFixed(2)} KB (${stats.size} bytes)`);

  if (stats.size < 1000) {
    throw new Error(`Backup file size (${stats.size} bytes) is suspiciously small!`);
  }

  // Verify backup contents using pg_restore --list
  console.log("\nVerifying Backup Archive Table & Schema Manifest...");
  try {
    const restoreList = execSync(`pg_restore --list "${backupFilePath}"`, { encoding: "utf-8" });
    const lines = restoreList.split("\n").filter((l) => l.includes("TABLE") || l.includes("SEQUENCE"));
    
    console.log(`- Backup Archive Contents: ${lines.length} tables/sequences indexed.`);
    console.log(`✅ Backup file archive integrity verified successfully!`);
    console.log(`- Artifact Location: ${backupFilePath}`);
  } catch (verifyErr: any) {
    console.error("❌ pg_restore verification failed:", verifyErr.message);
    throw verifyErr;
  }

  console.log("\n==================================================");
  console.log("PRODUCTION BACKUP COMPLETED & VERIFIED SUCCESSFULLY!");
  console.log("==================================================");
}

runProductionBackup()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
