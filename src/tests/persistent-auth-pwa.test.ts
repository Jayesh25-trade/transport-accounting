import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

test("Persistent Auth & PWA Manifest Tests", async (t) => {
  await t.test("Public Web App Manifest exists and is valid PWA config", () => {
    const manifestPath = join(process.cwd(), "public", "manifest.json");
    assert.equal(existsSync(manifestPath), true, "manifest.json must exist in public/");

    const content = JSON.parse(readFileSync(manifestPath, "utf-8"));
    assert.equal(content.display, "standalone");
    assert.equal(content.start_url, "/");
    assert.equal(typeof content.name, "string");
    assert.equal(typeof content.theme_color, "string");
  });

  await t.test("Session helper file exports correct persistent session durations", async () => {
    const sessionModule = await import("../lib/session");
    assert.equal(typeof sessionModule.createSession, "function");
    assert.equal(typeof sessionModule.validateRequestSession, "function");
    assert.equal(typeof sessionModule.clearSessionCookie, "function");
    assert.equal(typeof sessionModule.revokeSessionByHash, "function");
  });
});
