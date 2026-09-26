import test, { describe } from "node:test";
import assert from "node:assert/strict";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../db";
import { firms, auditLogs } from "../db/schema";
import { getFirmDetails } from "../services/firm.service";
import { getAuditLogs, recordAuditLog, sanitizePayload } from "../services/audit.service";
import { EntityNotFoundError } from "../lib/errors";
import { eq, inArray, sql } from "drizzle-orm";

describe("Phase 4C Settings V1 Unit & Integration Test Suite", () => {
  let firmA_Id = "";
  let firmB_Id = "";

  test.before(async () => {
    // Clean existing test firm records
    const existingTestFirms = await db
      .select({ id: firms.id })
      .from(firms)
      .where(sql`code LIKE 'TEST_SETTINGS_%'`);

    if (existingTestFirms.length > 0) {
      const ids = existingTestFirms.map((f) => f.id);
      await db.delete(auditLogs).where(inArray(auditLogs.firmId, ids));
      await db.delete(firms).where(inArray(firms.id, ids));
    }

    // Seed test firms
    const [fA] = await db
      .insert(firms)
      .values({
        name: "Deepraj Settings Test Transport",
        code: "TEST_SETTINGS_DEEPRAJ",
        pan: "ABCDE1234F",
        phone: "9876543210",
        address: "123 Logistics Hub, Navi Mumbai",
      })
      .returning();

    const [fB] = await db
      .insert(firms)
      .values({
        name: "Shiv Sai Settings Test Transport",
        code: "TEST_SETTINGS_SHIVSAI",
        pan: "FGHIJ5678K",
        phone: "9123456789",
        address: "456 Cargo Complex, Pune",
      })
      .returning();

    firmA_Id = fA.id;
    firmB_Id = fB.id;
  });

  test.after(async () => {
    if (firmA_Id && firmB_Id) {
      await db.delete(auditLogs).where(inArray(auditLogs.firmId, [firmA_Id, firmB_Id]));
      await db.delete(firms).where(inArray(firms.id, [firmA_Id, firmB_Id]));
    }
  });

  // ── 1. FIRM CONFIGURATION METADATA TESTS ────────────────────────────────
  test("1. Firm Details Retrieval & Metadata Accuracy", async () => {
    const deeprajFirm = await getFirmDetails(db, firmA_Id);
    assert.equal(deeprajFirm.name, "Deepraj Settings Test Transport");
    assert.equal(deeprajFirm.code, "TEST_SETTINGS_DEEPRAJ");
    assert.equal(deeprajFirm.pan, "ABCDE1234F");
    assert.equal(deeprajFirm.phone, "9876543210");
    assert.equal(deeprajFirm.address, "123 Logistics Hub, Navi Mumbai");

    const shivsaiFirm = await getFirmDetails(db, firmB_Id);
    assert.equal(shivsaiFirm.name, "Shiv Sai Settings Test Transport");
    assert.equal(shivsaiFirm.code, "TEST_SETTINGS_SHIVSAI");
    assert.equal(shivsaiFirm.pan, "FGHIJ5678K");
  });

  test("2. Non-existent Firm ID throws EntityNotFoundError", async () => {
    const bogusId = "00000000-0000-0000-0000-000000000000";
    await assert.rejects(async () => await getFirmDetails(db, bogusId), EntityNotFoundError);
  });

  // ── 2. SECRET SANITIZATION & AUDIT LOGGING TESTS ──────────────────────
  test("3. Server-side Secret Redaction (sanitizePayload)", () => {
    const sensitivePayload = {
      userEmail: "test@transport.com",
      password: "SuperSecretPassword123!",
      passwordHash: "$2b$10$xyz...",
      token: "session_token_abc123",
      secret: "api_secret_key",
      databaseUrl: "postgresql://user:pass@host/db",
      apiKey: "key_9999",
      nonSensitiveField: "Safe Value",
    };

    const sanitized = sanitizePayload(sensitivePayload);

    assert.equal(sanitized.userEmail, "test@transport.com");
    assert.equal(sanitized.nonSensitiveField, "Safe Value");
    assert.equal(sanitized.password, "[REDACTED]");
    assert.equal(sanitized.passwordHash, "[REDACTED]");
    assert.equal(sanitized.token, "[REDACTED]");
    assert.equal(sanitized.secret, "[REDACTED]");
    assert.equal(sanitized.databaseUrl, "[REDACTED]");
    assert.equal(sanitized.apiKey, "[REDACTED]");
  });

  test("4. Audit Log Creation and Firm-Isolated Querying", async () => {
    // Insert test audit logs for Firm A
    await recordAuditLog(db, {
      firmId: firmA_Id,
      action: "CREATE",
      entityName: "bills",
      entityId: "11111111-1111-1111-1111-111111111111",
      userEmail: "admin@deepraj.com",
      newValues: { billNumber: 101, netAmount: 50000 },
    });

    await recordAuditLog(db, {
      firmId: firmA_Id,
      action: "UPDATE",
      entityName: "daily_entries",
      entityId: "22222222-2222-2222-2222-222222222222",
      userEmail: "admin@deepraj.com",
      oldValues: { advance: 1000 },
      newValues: { advance: 1500 },
    });

    // Insert test audit log for Firm B
    await recordAuditLog(db, {
      firmId: firmB_Id,
      action: "CREATE",
      entityName: "bills",
      entityId: "33333333-3333-3333-3333-333333333333",
      userEmail: "admin@shivsai.com",
      newValues: { billNumber: 1, netAmount: 20000 },
    });

    // Query Firm A audit logs
    const firmALogs = await getAuditLogs(db, firmA_Id);
    assert.equal(firmALogs.pagination.total, 2);
    assert.equal(firmALogs.logs.length, 2);
    assert.ok(firmALogs.logs.every((l) => l.firmId === firmA_Id));

    // Query Firm B audit logs
    const firmBLogs = await getAuditLogs(db, firmB_Id);
    assert.equal(firmBLogs.pagination.total, 1);
    assert.equal(firmBLogs.logs[0].firmId, firmB_Id);
    assert.equal(firmBLogs.logs[0].userEmail, "admin@shivsai.com");
  });

  test("5. Audit Log Pagination", async () => {
    const p1 = await getAuditLogs(db, firmA_Id, { page: 1, limit: 1 });
    assert.equal(p1.logs.length, 1);
    assert.equal(p1.pagination.total, 2);
    assert.equal(p1.pagination.totalPages, 2);

    const p2 = await getAuditLogs(db, firmA_Id, { page: 2, limit: 1 });
    assert.equal(p2.logs.length, 1);
    assert.notEqual(p1.logs[0].id, p2.logs[0].id);
  });
});
