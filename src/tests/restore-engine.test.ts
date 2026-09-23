// ============================================================
// PHASE 4C-2U-C3 RESTORE ENGINE UNIT TEST SUITE
// Validates restore engine safety assertions, credential redaction,
// schema table definitions, and expected baseline definitions.
// Run with: npx tsx --test src/tests/restore-engine.test.ts
// ============================================================

import test from "node:test";
import assert from "node:assert/strict";
import {
  assertNotProductionUrl,
  EXPECTED_25_TABLES,
  EXPECTED_BASELINE_COUNTS,
  executePgRestore,
} from "../lib/restore-engine";
import { redactConnectionString } from "../lib/backup-engine";

test("Phase 4C-2U-C3 Restore Engine Safety Unit Tests", async (t) => {
  await t.test("1. assertNotProductionUrl blocks Neon production connection URLs", () => {
    assert.throws(
      () => assertNotProductionUrl("postgresql://user:pass@ep-cool-cloud-1234.us-east-2.aws.neon.tech/neondb?sslmode=require"),
      /CRITICAL SAFETY VIOLATION/
    );
    assert.throws(
      () => assertNotProductionUrl("postgres://admin:secret@neondb.internal/prod"),
      /CRITICAL SAFETY VIOLATION/
    );
    assert.doesNotThrow(() =>
      assertNotProductionUrl("postgresql://postgres:pass@localhost:5432/transport_acc_restore_test")
    );
  });

  await t.test("2. Expected tables list contains exactly 25 tables", () => {
    assert.equal(EXPECTED_25_TABLES.length, 25);
    assert.ok(EXPECTED_25_TABLES.includes("firms"));
    assert.ok(EXPECTED_25_TABLES.includes("users"));
    assert.ok(EXPECTED_25_TABLES.includes("user_firm_memberships"));
    assert.ok(EXPECTED_25_TABLES.includes("firm_bill_sequences"));
    assert.ok(EXPECTED_25_TABLES.includes("audit_logs"));
    assert.ok(EXPECTED_25_TABLES.includes("bills"));
    assert.ok(EXPECTED_25_TABLES.includes("payments"));
    assert.ok(EXPECTED_25_TABLES.includes("ledger_transactions"));
  });

  await t.test("3. Expected baseline row counts strictly match clean production baseline", () => {
    assert.equal(EXPECTED_BASELINE_COUNTS["firms"], 2);
    assert.equal(EXPECTED_BASELINE_COUNTS["users"], 2);
    assert.equal(EXPECTED_BASELINE_COUNTS["user_firm_memberships"], 4);
    assert.equal(EXPECTED_BASELINE_COUNTS["firm_bill_sequences"], 2);
    assert.equal(EXPECTED_BASELINE_COUNTS["audit_logs"], 44);
    assert.equal(EXPECTED_BASELINE_COUNTS["sessions"], 0);

    const businessTables = [
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
      "import_batches",
    ];

    assert.equal(businessTables.length, 17);
    for (const bTable of businessTables) {
      assert.equal(
        EXPECTED_BASELINE_COUNTS[bTable],
        0,
        `Business table ${bTable} must expect 0 rows`
      );
    }
  });

  await t.test("4. Missing dump file error handling", () => {
    assert.throws(
      () => executePgRestore("/non/existent/path/backup.dump", "postgresql://postgres:pass@localhost:5432/test_db"),
      /Backup dump file not found/
    );
  });

  await t.test("5. Redact connection string scrubs secrets from restore logs", () => {
    const rawError = "Error connecting to postgresql://postgres:SecretPassword123@localhost:5432/transport_acc_restore_test";
    const redacted = redactConnectionString(rawError);
    assert.ok(!redacted.includes("SecretPassword123"));
    assert.ok(redacted.includes("[REDACTED_PASS]"));
  });
});
