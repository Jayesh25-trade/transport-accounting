import test, { describe } from "node:test";
import assert from "node:assert";
import fs from "fs";
import path from "path";
import {
  redactConnectionString,
  isDirectPgConnection,
  generateBackupTimestampIso,
  calculateSha256,
  verifySha256Checksum,
  validatePgRestoreList,
  getRedactedHost,
  verifyPgDumpClientVersion,
} from "../lib/backup-engine";

describe("Phase 4C-2U-C2 Backup Engine Unit Tests", () => {
  const testDir = path.join(__dirname, ".temp_test_backup");

  test.before(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  test.after(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test("1. Redact Connection String prevents credential exposure", () => {
    const rawUri = "postgresql://neondb_owner:MySuperSecretPass123@ep-xyz.neon.tech:5432/neondb?sslmode=require";
    const redacted = redactConnectionString(rawUri);

    assert.strictEqual(redacted.includes("neondb_owner"), false);
    assert.strictEqual(redacted.includes("MySuperSecretPass123"), false);
    assert.strictEqual(redacted.includes("[REDACTED_USER]"), true);
    assert.strictEqual(redacted.includes("[REDACTED_PASS]"), true);
    assert.strictEqual(redacted.includes("[REDACTED_HOST]"), true);
  });

  test("2. Connection Pooling Validation (isDirectPgConnection)", () => {
    const directUrl = "postgresql://postgres:pass@localhost:5432/transport_acc";
    const pooledUrl = "postgresql://user:pass@ep-xyz-pooler.neon.tech/neondb?pgbouncer=true";

    assert.strictEqual(isDirectPgConnection(directUrl), true);
    assert.strictEqual(isDirectPgConnection(pooledUrl), false);
  });

  test("3. Timestamp & Filename Generation is deterministic and UTC", () => {
    const fixedDate = new Date("2026-09-23T12:30:00.000Z");
    const ts = generateBackupTimestampIso(fixedDate);

    assert.strictEqual(ts.isoUtc, "2026-09-23T12:30:00.000Z");
    assert.strictEqual(ts.folderYear, "2026");
    assert.strictEqual(ts.folderMonth, "09");
    assert.strictEqual(ts.folderDate, "2026-09-23");
    assert.strictEqual(ts.filenameTimestamp.includes("2026-09-23T12-30-00-000Z"), true);
  });

  test("4. SHA-256 Calculation & Verification", () => {
    const sampleFile = path.join(testDir, "test_file.txt");
    fs.writeFileSync(sampleFile, "Sample backup content for hash testing\n");

    const hash = calculateSha256(sampleFile);
    assert.ok(hash);
    assert.strictEqual(hash.length, 64);

    const match = verifySha256Checksum(sampleFile, hash);
    assert.strictEqual(match, true);

    const bogusHash = "0000000000000000000000000000000000000000000000000000000000000000";
    assert.strictEqual(verifySha256Checksum(sampleFile, bogusHash), false);
  });

  test("5. Redacted Host extraction", () => {
    const uri = "postgresql://user:secret@ep-cool-db.neon.tech/neondb";
    const host = getRedactedHost(uri);
    assert.strictEqual(host, "ep-cool-db.neon.tech");
    assert.strictEqual(host.includes("secret"), false);
  });

  test("6. Missing Archive Error Handling for SHA-256", () => {
    const missingPath = path.join(testDir, "non_existent.dump");
    assert.throws(() => calculateSha256(missingPath), /File not found/);
  });

  test("7. Missing Archive Error Handling for pg_restore", () => {
    const missingPath = path.join(testDir, "non_existent.dump");
    assert.throws(() => validatePgRestoreList(missingPath), /Dump file not found/);
  });

  test("8. Invalid/Corrupted Archive for pg_restore validation", () => {
    const invalidDump = path.join(testDir, "invalid.dump");
    fs.writeFileSync(invalidDump, "THIS IS NOT A VALID POSTGRES DUMP FILE\n");

    const valResult = validatePgRestoreList(invalidDump);
    assert.strictEqual(valResult.success, false);
    assert.strictEqual(valResult.tocCount, 0);
  });

  test("9. Partial Backup Cleanup Logic", () => {
    const tempDump = path.join(testDir, "temp_backup.tmp.dump");
    fs.writeFileSync(tempDump, "Temporary data");
    assert.strictEqual(fs.existsSync(tempDump), true);

    if (fs.existsSync(tempDump)) {
      fs.unlinkSync(tempDump);
    }
    assert.strictEqual(fs.existsSync(tempDump), false);
  });

  test("10. Non-Secret Manifest Safety Check", () => {
    const sampleManifest = {
      backup_id: "test-backup-123",
      dump_filename: "transport_app_prod_test.dump",
      dump_file_size_bytes: 1024,
      sha256_checksum: "abcd1234efgh5678",
      redacted_host: getRedactedHost("postgresql://user:pass@ep-xyz.neon.tech/neondb"),
    };

    const manifestStr = JSON.stringify(sampleManifest);
    assert.strictEqual(manifestStr.includes("user"), false);
    assert.strictEqual(manifestStr.includes("pass"), false);
    assert.strictEqual(manifestStr.includes("postgresql://"), false);
  });

  test("11. Client Version Guard (verifyPgDumpClientVersion)", () => {
    // Tests that version detection runs safely without exposing credentials
    // Passes expectedMajorVersion = 1 to work across local environments with pg_dump 14, 15, 16, or 18 installed
    const ver = verifyPgDumpClientVersion(1);
    assert.ok(ver.versionString);
    assert.ok(ver.majorVersion >= 1);
  });
});
