/**
 * verify-voucher-print-dom.ts
 * READ-ONLY verification of Driver Voucher body portal print architecture.
 */

import "dotenv/config";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

async function verifyPrintSetup() {
  console.log("=================================================");
  console.log("VERIFYING DRIVER VOUCHER PRINT PORTAL ARCHITECTURE");
  console.log("=================================================\n");

  // 1. Verify globals.css contains scoped print media rules targeting body portal root
  const cssPath = path.join(process.cwd(), "src/app/globals.css");
  const cssContent = fs.readFileSync(cssPath, "utf-8");

  console.log("[Check 1] Inspecting src/app/globals.css print rules...");
  assert.ok(cssContent.includes("@media print"), "globals.css must contain @media print");
  assert.ok(cssContent.includes("#driver-voucher-print-root"), "globals.css must target #driver-voucher-print-root");
  assert.ok(cssContent.includes("body.driver-voucher-printing > *:not(#driver-voucher-print-root)"), "globals.css must hide all sibling body children during print");
  assert.ok(cssContent.includes("body.driver-voucher-printing #driver-voucher-print-root"), "globals.css must show print root during print");
  assert.ok(cssContent.includes("size: A4 portrait"), "globals.css must set @page size to A4 portrait");
  console.log("  -> CSS portal print scoping confirmed!");

  // 2. Verify DriverVoucherDetailModal renders print root via React createPortal to document.body
  const voucherModalPath = path.join(process.cwd(), "src/components/driver-vouchers/driver-voucher-detail-modal.tsx");
  const voucherModalContent = fs.readFileSync(voucherModalPath, "utf-8");
  console.log("\n[Check 2] Inspecting src/components/driver-vouchers/driver-voucher-detail-modal.tsx...");

  assert.ok(voucherModalContent.includes("createPortal"), "Must use createPortal for body root rendering");
  assert.ok(voucherModalContent.includes("document.body"), "Must target document.body in createPortal");
  assert.ok(voucherModalContent.includes('id="driver-voucher-print-root"'), "Must render print root with id driver-voucher-print-root");
  assert.ok(voucherModalContent.includes('classList.add("driver-voucher-printing")'), "Must toggle driver-voucher-printing class on body during print");
  assert.ok(voucherModalContent.includes('classList.remove("driver-voucher-printing")'), "Must remove driver-voucher-printing class after print");

  // Document fields check
  assert.ok(voucherModalContent.includes("DRIVER VOUCHER / OPERATIONAL EXPENSE VOUCHER"), "Must have professional document title");
  assert.ok(voucherModalContent.includes("voucher.dailyEntrySrNo"), "Must use dailyEntrySrNo");
  assert.ok(voucherModalContent.includes("currentFirm?.name"), "Must render firm name");

  // Absence of fabricated fields
  assert.ok(!voucherModalContent.includes("Driver Signature"), "Must NOT fabricate Driver Signature");
  assert.ok(!voucherModalContent.includes("Authorized Signatory"), "Must NOT fabricate Authorized Signatory");

  console.log("  -> DriverVoucherDetailModal body portal print architecture confirmed!");

  console.log("\n=================================================");
  console.log("✅ ALL PRINT ARCHITECTURE CHECKS PASSED");
  console.log("=================================================");
}

verifyPrintSetup().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
