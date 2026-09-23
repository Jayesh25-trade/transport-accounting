// ============================================================
// PHASE 4C-2U-C4 STORAGE ENGINE UNIT TEST SUITE
// Validates key hierarchy generation, lifecycle policy schema,
// environment config parsing, HTTPS endpoint protocol validation,
// SHA-256 hash matching/mismatch, and upload verification simulation logic.
// Run with: npx tsx --test src/tests/storage-engine.test.ts
// ============================================================

import test from "node:test";
import assert from "node:assert/strict";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { Readable } from "stream";
import { S3Client } from "@aws-sdk/client-s3";
import {
  generateStorageObjectKey,
  generateLifecyclePolicyConfig,
  getStorageConfigFromEnv,
  uploadBackupArchiveToOffsite,
  validateEndpointProtocol,
  createS3StorageClient,
  verifyUploadedObjectSha256,
} from "../lib/storage-engine";

test("Phase 4C-2U-C4 Off-Site Storage Engine Unit Tests", async (t) => {
  await t.test("1. Object key hierarchy formatting follows production/YYYY/MM/YYYY-MM-DD/", () => {
    const fixedTime = "2026-09-23T12:30:00.000Z";
    const key = generateStorageObjectKey("transport_app_prod_2026-09-23T12-30-00Z.dump", fixedTime);
    assert.equal(key, "production/2026/09/2026-09-23/transport_app_prod_2026-09-23T12-30-00Z.dump");
  });

  await t.test("2. Lifecycle policy rules include 30d daily, 12w weekly, 12m monthly and business disclaimer", () => {
    const policy = generateLifecyclePolicyConfig();
    assert.equal(policy.Rules.length, 3);
    assert.equal(policy.Rules[0].Expiration.Days, 30);
    assert.equal(policy.Rules[1].Expiration.Days, 84);
    assert.equal(policy.Rules[2].Expiration.Days, 365);
    assert.equal(policy.Disclaimer, "BUSINESS/ACCOUNTING POLICY REQUIRING CLIENT CONFIRMATION");
  });

  await t.test("3. getStorageConfigFromEnv returns null cleanly when credentials are not set", () => {
    const config = getStorageConfigFromEnv();
    if (!process.env.R2_ACCESS_KEY_ID && !process.env.AWS_ACCESS_KEY_ID) {
      assert.equal(config, null);
    }
  });

  await t.test("4. HTTPS Endpoint Protocol Validation", () => {
    // Missing / empty endpoint -> preserved
    assert.doesNotThrow(() => validateEndpointProtocol());
    assert.doesNotThrow(() => validateEndpointProtocol(""));

    // Valid HTTPS -> accepted
    assert.doesNotThrow(() =>
      validateEndpointProtocol("https://123456789.r2.cloudflarestorage.com")
    );

    // Insecure HTTP -> fails closed
    assert.throws(
      () => validateEndpointProtocol("http://insecure-bucket.r2.cloudflarestorage.com"),
      /CRITICAL SECURITY VIOLATION: Storage endpoint must use HTTPS protocol/
    );

    // Malformed URL -> fails closed
    assert.throws(
      () => validateEndpointProtocol("not-a-valid-url"),
      /CRITICAL SECURITY VIOLATION: Storage endpoint is a malformed URL/
    );

    // S3Client creation with HTTP throws
    assert.throws(
      () =>
        createS3StorageClient({
          endpoint: "http://insecure-endpoint.com",
          region: "auto",
          bucketName: "test",
          accessKeyId: "key",
          secretAccessKey: "secret",
        }),
      /CRITICAL SECURITY VIOLATION: Storage endpoint must use HTTPS protocol/
    );
  });

  await t.test("5. SHA-256 Checksum Verification (Match vs Mismatch)", async () => {
    const testContent = "Test database backup payload buffer content";
    const expectedHash = crypto.createHash("sha256").update(Buffer.from(testContent)).digest("hex");
    const wrongHash = crypto.createHash("sha256").update(Buffer.from("Different content")).digest("hex");

    // Mock S3Client send method for GetObjectCommand
    const mockClient = {
      send: async (cmd: any) => {
        return {
          Body: Readable.from([Buffer.from(testContent)]),
        };
      },
    } as unknown as S3Client;

    // Matching hash scenario -> returns true
    const matchResult = await verifyUploadedObjectSha256(
      mockClient,
      "test-bucket",
      "test-key.dump",
      expectedHash
    );
    assert.equal(matchResult, true, "Matching hash must return true");

    // Mismatched hash scenario -> returns false
    const mismatchResult = await verifyUploadedObjectSha256(
      mockClient,
      "test-bucket",
      "test-key.dump",
      wrongHash
    );
    assert.equal(mismatchResult, false, "Mismatched hash must return false");
  });

  await t.test("6. Local storage engine simulation verifies C2 dump archive", async () => {
    const backupDir = path.join(process.cwd(), "backups", "production", "2026", "09", "2026-09-23");
    let dumpPath = "";

    if (fs.existsSync(backupDir)) {
      const files = fs.readdirSync(backupDir);
      const dump = files.find((f) => f.endsWith(".dump"));
      if (dump) dumpPath = path.join(backupDir, dump);
    }

    if (dumpPath) {
      const checksumPath = path.join(backupDir, "checksum.sha256");
      const manifestPath = path.join(backupDir, "manifest.json");

      const res = await uploadBackupArchiveToOffsite(dumpPath, checksumPath, manifestPath, null);
      assert.equal(res.status, "PASS");
      assert.equal(res.provider, "Local Simulation");
      assert.equal(res.uploadVerified, true);
      assert.ok(res.dumpSha256.length === 64);
    }
  });
});
