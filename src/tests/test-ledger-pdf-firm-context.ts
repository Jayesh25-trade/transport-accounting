import { db } from "@/db";
import { firms, parties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateLedgerPdfBuffer } from "@/services/pdf.service";
import { getActiveFirmId } from "@/lib/api-context";
import { NextRequest } from "next/server";

async function runVerification() {
  console.log("=========================================");
  console.log("STARTING LEDGER PDF FIRM CONTEXT VERIFICATION");
  console.log("=========================================");

  // 1. Get Deepraj Firm & Shiv Sai Firm
  const allFirms = await db.select().from(firms);
  const deeprajFirm = allFirms.find((f) => f.name.toUpperCase().includes("DEEPRAJ"));
  const shivSaiFirm = allFirms.find((f) => f.name.toUpperCase().includes("SHIV SAI"));

  if (!deeprajFirm) throw new Error("Deepraj firm not found");
  console.log(`DEEPRAJ FIRM ID: ${deeprajFirm.id} (${deeprajFirm.name})`);
  if (shivSaiFirm) console.log(`SHIV SAI FIRM ID: ${shivSaiFirm.id} (${shivSaiFirm.name})`);

  // Find Validation Test party in Deepraj
  const deeprajParties = await db.select().from(parties).where(eq(parties.firmId, deeprajFirm.id));
  const validationTestParty = deeprajParties.find((p) => p.name === "Validation Test");
  if (!validationTestParty) throw new Error("Validation Test party not found in Deepraj");
  console.log(`VALIDATION TEST PARTY ID: ${validationTestParty.id}`);

  // TEST A: Generate Ledger PDF for Deepraj + Validation Test
  console.log("\n--- TEST A: DEEPRAJ TRANSPORT Ledger PDF ---");
  const pdfBufferDeepraj = await generateLedgerPdfBuffer(
    db,
    deeprajFirm.id,
    validationTestParty.id,
    {}
  );
  console.log(`[TEST A SUCCESS] Generated PDF buffer size: ${pdfBufferDeepraj.length} bytes`);
  if (pdfBufferDeepraj.length < 1000) {
    throw new Error("[TEST A FAIL] PDF buffer is unexpectedly small");
  }

  // TEST B: Export PDF (download=true)
  console.log("\n--- TEST B: DEEPRAJ Export PDF (download=true) ---");
  const dummyReqWithQuery = new NextRequest(`http://localhost:3000/api/ledger/pdf?firmId=${deeprajFirm.id}&partyId=${validationTestParty.id}&download=true`);
  const extractedFirmId = getActiveFirmId(dummyReqWithQuery);
  console.log(`Extracted firm ID from query param: ${extractedFirmId}`);
  if (extractedFirmId !== deeprajFirm.id) {
    throw new Error("[TEST B FAIL] Firm ID extraction mismatch");
  }
  console.log("[TEST B SUCCESS] Export PDF URL format correctly extracts firmId");

  // TEST C: Shiv Sai Firm PDF
  console.log("\n--- TEST C: Shiv Sai Transport QA Ledger PDF ---");
  if (shivSaiFirm) {
    const shivSaiParties = await db.select().from(parties).where(eq(parties.firmId, shivSaiFirm.id));
    if (shivSaiParties.length > 0) {
      const shivSaiPdf = await generateLedgerPdfBuffer(db, shivSaiFirm.id, shivSaiParties[0].id, {});
      console.log(`[TEST C SUCCESS] Generated Shiv Sai PDF buffer size: ${shivSaiPdf.length} bytes`);
    } else {
      console.log("[TEST C INFO] No parties in Shiv Sai firm, verified empty path");
    }
  }

  // TEST D: Cross-firm protection
  console.log("\n--- TEST D: Cross-firm Protection ---");
  if (shivSaiFirm) {
    let crossFirmError: any = null;
    try {
      await generateLedgerPdfBuffer(db, shivSaiFirm.id, validationTestParty.id, {});
    } catch (err) {
      crossFirmError = err;
    }
    if (crossFirmError && (crossFirmError.name === "FirmIsolationError" || crossFirmError.code === "FIRM_ISOLATION_VIOLATION")) {
      console.log(`[TEST D SUCCESS] Cross-firm call correctly rejected with ${crossFirmError.name}: "${crossFirmError.message}"`);
    } else {
      throw new Error(`[TEST D FAIL] Cross-firm call was not protected properly! Result: ${crossFirmError}`);
    }
  }

  // TEST E: No active firm context header/param
  console.log("\n--- TEST E: Missing Firm Context Header/Param ---");
  const dummyReqNoFirm = new NextRequest(`http://localhost:3000/api/ledger/pdf?partyId=${validationTestParty.id}`);
  let caughtError: any = null;
  try {
    getActiveFirmId(dummyReqNoFirm);
  } catch (err) {
    caughtError = err;
  }
  if (caughtError && caughtError.code === "FIRM_CONTEXT_REQUIRED") {
    console.log(`[TEST E SUCCESS] Correctly threw FIRM_CONTEXT_REQUIRED: "${caughtError.message}"`);
  } else {
    throw new Error(`[TEST E FAIL] Expected FIRM_CONTEXT_REQUIRED error but got ${caughtError}`);
  }

  console.log("\n=========================================");
  console.log("ALL TESTS (A - E) PASSED SUCCESSFULLY!");
  console.log("=========================================");
  process.exit(0);
}

runVerification().catch((err) => {
  console.error("VERIFICATION FAILED:", err);
  process.exit(1);
});
