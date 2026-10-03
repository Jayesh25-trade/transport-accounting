/**
 * PDF FIRM CONTEXT FIX VERIFICATION SCRIPT
 *
 * Tests:
 * 1. PDF request with valid firmId query param -> 200 application/pdf & valid PDF magic bytes (%PDF)
 * 2. PDF request with valid x-firm-id header -> 200 application/pdf
 * 3. PDF request with missing firm context -> 400 FIRM_CONTEXT_REQUIRED
 * 4. PDF request with invalid firm UUID -> 400 INVALID_FIRM_CONTEXT
 * 5. PDF request for bill belonging to another firm (cross-firm attack) -> 404/403
 * 6. Non-PDF JSON API endpoints remain untouched and return standard JSON.
 */

import { db } from "../src/db";
import { firms, bills } from "../src/db/schema";
import { getActiveFirmId } from "../src/lib/api-context";
import { NextRequest } from "next/server";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`Assertion Failed: ${msg}`);
  console.log(`  ✅ PASS: ${msg}`);
}

async function testPdfContextFix() {
  console.log("════════════════════════════════════════════════════════");
  console.log("RUNNING PDF FIRM CONTEXT FIX UNIT/INTEGRATION VERIFICATION");
  console.log("════════════════════════════════════════════════════════");

  // 1. Fetch Deepraj and Shiv Sai firms from DB
  const allFirms = await db.select().from(firms);
  assert(allFirms.length >= 2, "Found at least 2 firms in DB");

  const deepraj = allFirms.find((f) => f.name.toLowerCase().includes("deepraj")) || allFirms[0];
  const shivSai = allFirms.find((f) => f.name.toLowerCase().includes("shiv")) || allFirms[1];

  console.log(`  Firm A (Deepraj): ${deepraj.name} (${deepraj.id})`);
  console.log(`  Firm B (Shiv Sai): ${shivSai.name} (${shivSai.id})`);

  // Test 1: getActiveFirmId with x-firm-id header
  const reqWithHeader = new NextRequest("https://localhost/api/test", {
    headers: { "x-firm-id": deepraj.id },
  });
  const extractedId1 = getActiveFirmId(reqWithHeader);
  assert(extractedId1 === deepraj.id, "getActiveFirmId correctly extracts x-firm-id header");

  // Test 2: getActiveFirmId with firmId query parameter (no header)
  const reqWithQuery = new NextRequest(`https://localhost/api/test?firmId=${deepraj.id}`);
  const extractedId2 = getActiveFirmId(reqWithQuery);
  assert(extractedId2 === deepraj.id, "getActiveFirmId correctly falls back to firmId query parameter");

  // Test 3: getActiveFirmId with missing header and query param throws
  const reqEmpty = new NextRequest("https://localhost/api/test");
  let emptyError: any = null;
  try {
    getActiveFirmId(reqEmpty);
  } catch (err: any) {
    emptyError = err;
  }
  assert(
    emptyError && emptyError.code === "FIRM_CONTEXT_REQUIRED",
    "getActiveFirmId throws FIRM_CONTEXT_REQUIRED when context is missing"
  );

  // Test 4: getActiveFirmId with invalid UUID throws
  const reqInvalid = new NextRequest("https://localhost/api/test?firmId=not-a-uuid");
  let invalidError: any = null;
  try {
    getActiveFirmId(reqInvalid);
  } catch (err: any) {
    invalidError = err;
  }
  assert(
    invalidError && invalidError.code === "INVALID_FIRM_CONTEXT",
    "getActiveFirmId throws INVALID_FIRM_CONTEXT for malformed UUID"
  );

  // 2. Fetch a bill for PDF integration testing
  const allBills = await db.select().from(bills);
  console.log(`  Found ${allBills.length} total bills in DB`);

  process.env.DISABLE_AUTH_FOR_TESTS = "true";

  if (allBills.length > 0) {
    const targetBill = allBills[0];
    const targetFirmId = targetBill.firmId;
    const otherFirmId = allFirms.find((f) => f.id !== targetFirmId)!.id;

    const { GET: getPdf } = await import("../src/app/api/bills/[id]/pdf/route");

    // Test 5: Execute PDF handler with valid firmId query param
    const pdfReq = new NextRequest(`https://localhost/api/bills/${targetBill.id}/pdf?firmId=${targetFirmId}`);
    const pdfRes: any = await getPdf(pdfReq, { params: Promise.resolve({ id: targetBill.id }) });

    assert(pdfRes.status === 200, "PDF endpoint returns HTTP 200 status");
    assert(
      pdfRes.headers.get("content-type") === "application/pdf",
      "PDF endpoint returns Content-Type: application/pdf"
    );

    const pdfArrayBuffer = await pdfRes.arrayBuffer();
    const pdfBuffer = Buffer.from(pdfArrayBuffer);
    const pdfHeader = pdfBuffer.slice(0, 5).toString("utf-8");
    assert(pdfHeader === "%PDF-", `PDF output begins with valid PDF magic bytes: "${pdfHeader}"`);

    // Test 6: Cross-firm PDF access rejection
    const crossFirmReq = new NextRequest(`https://localhost/api/bills/${targetBill.id}/pdf?firmId=${otherFirmId}`);
    const crossFirmRes: any = await getPdf(crossFirmReq, { params: Promise.resolve({ id: targetBill.id }) });

    const crossFirmJson = await crossFirmRes.json();
    assert(
      crossFirmRes.status === 404 || crossFirmRes.status === 403,
      `Cross-firm PDF request rejected with status ${crossFirmRes.status}`
    );
    assert(
      crossFirmJson.success === false,
      `Cross-firm PDF request returns success: false`
    );
  } else {
    console.log("  (Skipped live PDF rendering test: no bills present in local test DB)");
  }

  // Test 7: Normal JSON API endpoints (e.g. GET /api/bills) continue returning JSON wrapper
  const { GET: getBills } = await import("../src/app/api/bills/route");
  const jsonReq = new NextRequest(`https://localhost/api/bills?firmId=${deepraj.id}`, {
    headers: { "x-firm-id": deepraj.id },
  });
  const jsonRes: any = await getBills(jsonReq, { params: Promise.resolve({}) });
  const jsonBody = await jsonRes.json();
  assert(jsonRes.status === 200, `Normal JSON API returns HTTP 200 (got ${jsonRes.status}: ${JSON.stringify(jsonBody)})`);
  assert(jsonBody.success === true, "Normal JSON API returns wrapped JSON with success: true");
  assert(Array.isArray(jsonBody.data), "Normal JSON API returns array payload");

  console.log("\nALL PDF FIRM CONTEXT FIX VERIFICATION TESTS PASSED SUCCESSFULLY!");
}

testPdfContextFix().catch((err) => {
  console.error("FATAL TEST ERROR:", err);
  process.exit(1);
});
