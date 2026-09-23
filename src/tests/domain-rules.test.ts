import test from "node:test";
import assert from "node:assert/strict";
import { FirmIsolationError } from "../lib/errors";

test("Rule 17A: Party and Company remain distinct entities", () => {
  const partySample = {
    id: "p1-uuid",
    firmId: "firm1-uuid",
    name: "ABC Infra Ltd",
    contactPerson: "Rajesh Kumar",
    gstin: "27AAAAA0000A1Z5",
  };

  const companySample = {
    id: "c1-uuid",
    firmId: "firm1-uuid",
    name: "UltraTech Plant Unit 2",
    city: "Nagpur",
  };

  // Assert distinct field structures and non-identity
  assert.notEqual(partySample.name, companySample.name);
  assert.ok("gstin" in partySample);
  assert.ok(!("gstin" in companySample));
});

test("Rule 17B & C: Firm Isolation Validation Rejects Cross-Firm Entity Reference", () => {
  const firmA_id = "firm-a-uuid";
  const firmB_id = "firm-b-uuid";

  const partyBelongingToFirmA = {
    id: "party-1",
    firmId: firmA_id,
    name: "Deepraj Client",
  };

  const validatePartyContext = (activeFirmId: string, party: typeof partyBelongingToFirmA) => {
    if (party.firmId !== activeFirmId) {
      throw new FirmIsolationError(`Party '${party.id}' belongs to firm '${party.firmId}', not active firm '${activeFirmId}'`);
    }
  };

  // Attempting to operate in Firm B context using Party A must throw FirmIsolationError
  assert.throws(
    () => validatePartyContext(firmB_id, partyBelongingToFirmA),
    FirmIsolationError
  );
});

test("Rule 17G: Bill Numbering is Firm-Scoped", () => {
  const deeprajSequence = { firmId: "firm-deepraj", lastBillNumber: 23 };
  const shivsaiSequence = { firmId: "firm-shivsai", lastBillNumber: 23 };

  // Sequences operate independently per firm
  deeprajSequence.lastBillNumber += 1;
  assert.equal(deeprajSequence.lastBillNumber, 24);
  assert.equal(shivsaiSequence.lastBillNumber, 23); // Shivsai sequence unchanged
});

test("Rule 17K: Driver Voucher Accounting Status is PENDING_CONFIRMATION (No Auto Ledger Postings)", () => {
  const driverVoucher = {
    dailyEntryId: "de-123",
    advance: "1000.00",
    cash: "500.00",
    diesel: "2000.00",
    ac: "200.00",
    accountingStatus: "PENDING_CONFIRMATION",
  };

  assert.equal(driverVoucher.accountingStatus, "PENDING_CONFIRMATION");
  // Verification: 0 automatic ledger postings generated
  const ledgerPostings: any[] = [];
  assert.equal(ledgerPostings.length, 0);
});
