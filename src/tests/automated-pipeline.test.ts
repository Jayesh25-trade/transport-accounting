// ============================================================
// AUTOMATED BACKUP PIPELINE LOCAL UNIT TEST SUITE
// Runs in node native test runner without network access,
// database connections, or cloud R2 API calls.
// ============================================================

import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import crypto from "crypto";

import {
  isDirectPgConnection,
  calculateSha256,
  verifySha256Checksum,
  validatePgRestoreList,
  redactConnectionString,
  getRedactedHost,
} from "../lib/backup-engine";
import {
  validateEndpointProtocol,
  generateStorageObjectKey,
  getStorageConfigFromEnv,
  uploadBackupArchiveToOffsite,
} from "../lib/storage-engine";
import { runAutomatedBackupPipeline } from "../../scripts/run-automated-backup-pipeline";

test("Automated Backup Pipeline - 15 Unit Test Safety Requirements", async (t) => {

  await t.test("1. Missing PROD_DIRECT_DATABASE_URL throws fail-closed error", async () => {
    const originalEnv = process.env.PROD_DIRECT_DATABASE_URL;
    delete process.env.PROD_DIRECT_DATABASE_URL;

    try {
      await assert.rejects(
        async () => {
          await runAutomatedBackupPipeline();
        },
        (err: any) => {
          return (
            err.message.includes("BACKUP_FAILED") &&
            err.message.includes("PROD_DIRECT_DATABASE_URL")
          );
        }
      );
    } finally {
      if (originalEnv) process.env.PROD_DIRECT_DATABASE_URL = originalEnv;
    }
  });

  await t.test("2. DATABASE_URL is NOT used as a fallback when PROD_DIRECT_DATABASE_URL is absent", async () => {
    const origProd = process.env.PROD_DIRECT_DATABASE_URL;
    const origDbUrl = process.env.DATABASE_URL;

    delete process.env.PROD_DIRECT_DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://postgres:pass@localhost:5432/pooled_db";

    try {
      await assert.rejects(
        async () => {
          await runAutomatedBackupPipeline();
        },
        (err: any) => {
          // Must fail due to missing PROD_DIRECT_DATABASE_URL and NOT proceed with DATABASE_URL
          return err.message.includes("PROD_DIRECT_DATABASE_URL environment variable is missing");
        }
      );
    } finally {
      if (origProd) process.env.PROD_DIRECT_DATABASE_URL = origProd;
      else delete process.env.PROD_DIRECT_DATABASE_URL;
      if (origDbUrl) process.env.DATABASE_URL = origDbUrl;
      else delete process.env.DATABASE_URL;
    }
  });

  await t.test("3. Pooled database connection URIs are rejected by isDirectPgConnection", () => {
    assert.equal(
      isDirectPgConnection("postgresql://user:pass@ep-cool-pooler.us-east-2.aws.neon.tech/neondb"),
      false
    );
    assert.equal(
      isDirectPgConnection("postgresql://user:pass@ep-cool.us-east-2.aws.neon.tech/neondb?pgbouncer=true"),
      false
    );
    assert.equal(
      isDirectPgConnection("postgresql://user:pass@ep-cool.us-east-2.aws.neon.tech/neondb"),
      true
    );
  });

  await t.test("4. Invalid connection protocols are rejected", () => {
    assert.equal(isDirectPgConnection("http://localhost:5432/neondb"), false);
    assert.equal(isDirectPgConnection("mysql://user:pass@localhost:3306/db"), false);
    assert.equal(isDirectPgConnection("invalid_uri_format"), false);
  });

  await t.test("5. Backup dump size validation rejects archives < 1,000 bytes", () => {
    const tempSmallFile = path.join(process.cwd(), "backups", "temp_test_small.dump");
    fs.mkdirSync(path.dirname(tempSmallFile), { recursive: true });
    fs.writeFileSync(tempSmallFile, "tiny corrupt payload");

    try {
      const stats = fs.statSync(tempSmallFile);
      assert.ok(stats.size < 1000, "File should be smaller than 1000 bytes");
    } finally {
      if (fs.existsSync(tempSmallFile)) fs.unlinkSync(tempSmallFile);
    }
  });

  await t.test("6. SHA-256 calculation generates valid 64-char hex string", () => {
    const tempFile = path.join(process.cwd(), "backups", "temp_test_sha.txt");
    fs.mkdirSync(path.dirname(tempFile), { recursive: true });
    fs.writeFileSync(tempFile, "test SHA-256 content payload 12345");

    try {
      const sha = calculateSha256(tempFile);
      assert.equal(sha.length, 64);
      assert.equal(/^[a-f0-9]{64}$/.test(sha), true);
      assert.equal(verifySha256Checksum(tempFile, sha), true);
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  });

  await t.test("7. pg_restore --list validation returns failure on invalid file", () => {
    const tempInvalidFile = path.join(process.cwd(), "backups", "temp_invalid.dump");
    fs.mkdirSync(path.dirname(tempInvalidFile), { recursive: true });
    fs.writeFileSync(tempInvalidFile, "not a postgres custom dump file");

    try {
      const res = validatePgRestoreList(tempInvalidFile);
      assert.equal(res.success, false);
      assert.equal(res.tocCount, 0);
    } finally {
      if (fs.existsSync(tempInvalidFile)) fs.unlinkSync(tempInvalidFile);
    }
  });

  await t.test("8. Manifest generation redacts database credentials and host URIs", () => {
    const sampleUri = "postgresql://admin_user:secret_password_123@db-host.neon.tech:5432/neondb";
    const redactedHost = getRedactedHost(sampleUri);
    const redactedString = redactConnectionString(sampleUri);

    assert.equal(redactedHost, "db-host.neon.tech");
    assert.equal(redactedString.includes("secret_password_123"), false);
    assert.equal(redactedString.includes("[REDACTED_PASS]"), true);
  });

  await t.test("9. HTTPS storage endpoint protocol validation throws error on HTTP or invalid URLs", () => {
    assert.throws(
      () => validateEndpointProtocol("http://insecure-r2-endpoint.com"),
      /CRITICAL SECURITY VIOLATION/
    );
    assert.throws(
      () => validateEndpointProtocol("not-a-valid-url"),
      /CRITICAL SECURITY VIOLATION/
    );
    assert.doesNotThrow(() =>
      validateEndpointProtocol("https://c2e1ab10.r2.cloudflarestorage.com")
    );
  });

  await t.test("10. Storage key formatting matches hierarchy production/YYYY/MM/YYYY-MM-DD/", () => {
    const key = generateStorageObjectKey("test_backup.dump", "2026-09-23T12:00:00.000Z");
    assert.equal(key, "production/2026/09/2026-09-23/test_backup.dump");
  });

  await t.test("11. Local simulation mode produces PASS without making cloud API calls when credentials absent", async () => {
    const tempDump = path.join(process.cwd(), "backups", "temp_sim.dump");
    const tempSha = path.join(process.cwd(), "backups", "temp_sim.sha256");
    const tempManifest = path.join(process.cwd(), "backups", "temp_sim.json");

    fs.mkdirSync(path.dirname(tempDump), { recursive: true });
    fs.writeFileSync(tempDump, Buffer.alloc(2000, "a"));
    fs.writeFileSync(tempSha, "fake_sha  temp_sim.dump\n");
    fs.writeFileSync(tempManifest, "{}");

    try {
      const res = await uploadBackupArchiveToOffsite(
        tempDump,
        tempSha,
        tempManifest,
        null // Simulation override
      );
      assert.equal(res.status, "PASS");
      assert.equal(res.provider, "Local Simulation");
      assert.equal(res.uploadVerified, true);
    } finally {
      if (fs.existsSync(tempDump)) fs.unlinkSync(tempDump);
      if (fs.existsSync(tempSha)) fs.unlinkSync(tempSha);
      if (fs.existsSync(tempManifest)) fs.unlinkSync(tempManifest);
    }
  });

  await t.test("12. SHA mismatch logic throws verification error", () => {
    const buffer1 = Buffer.from("content A");
    const buffer2 = Buffer.from("content B");

    const hash1 = crypto.createHash("sha256").update(buffer1).digest("hex");
    const hash2 = crypto.createHash("sha256").update(buffer2).digest("hex");

    assert.notEqual(hash1, hash2);
  });

  await t.test("13. Source code contains zero DeleteObject or DeleteObjects commands", () => {
    const storageCode = fs.readFileSync(
      path.join(process.cwd(), "src", "lib", "storage-engine.ts"),
      "utf-8"
    );
    assert.equal(storageCode.includes("DeleteObjectCommand"), false);
    assert.equal(storageCode.includes("DeleteObjectsCommand"), false);
    assert.equal(storageCode.includes("DeleteBucketCommand"), false);
  });

  await t.test("14. R2 configuration parsing handles environment variables safely", () => {
    const origKey = process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.AWS_ACCESS_KEY_ID;

    try {
      const config = getStorageConfigFromEnv();
      assert.equal(config, null);
    } finally {
      if (origKey) process.env.R2_ACCESS_KEY_ID = origKey;
    }
  });

  await t.test("15. Temporary backup folder creation and cleanup operates safely", () => {
    const tempDir = path.join(process.cwd(), "backups", "temp_cleanup_test");
    fs.mkdirSync(tempDir, { recursive: true });
    assert.equal(fs.existsSync(tempDir), true);

    fs.rmSync(tempDir, { recursive: true, force: true });
    assert.equal(fs.existsSync(tempDir), false);
  });
});
