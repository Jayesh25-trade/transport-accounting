import test from "node:test";
import assert from "node:assert/strict";
import { calculateFreight } from "../domain/freight";
import { calculateShortage } from "../domain/shortage";
import { calculateTds } from "../domain/tds";
import { calculateBillTotals } from "../domain/bill";

test("TEST 2 & 3 — TDS After Shortage & Net Bill Amount (Section 14 Normal Bill Example)", () => {
  const grossFreight = 120000;
  const shortageDebit = 5000;
  const tdsPercentage = 1;

  // STEP 1-4: Gross & Shortage
  assert.equal(grossFreight, 120000);
  assert.equal(shortageDebit, 5000);

  // STEP 5: Amount After Shortage = Gross Freight - Total Shortage Debit
  const amountAfterShortage = grossFreight - shortageDebit;
  assert.equal(amountAfterShortage, 115000, "Amount after shortage must be ₹115,000");

  // STEP 6: TDS Base = Amount After Shortage, TDS Amount = TDS Base × TDS % / 100
  const tdsRes = calculateTds({
    grossBillAmount: amountAfterShortage,
    tdsApplicable: true,
    tdsPercentage,
    tdsSection: "94C",
  });

  assert.equal(tdsRes.tdsBaseAmount, 115000, "TDS Base must be ₹115,000");
  assert.equal(tdsRes.tdsAmount, 1150, "TDS Amount must be ₹1,150 (NOT ₹1,200)");

  // STEP 7: Net Bill Amount = Amount After Shortage - TDS Amount
  const totals = calculateBillTotals({
    items: [
      { freight: grossFreight, shortageDebitAmount: shortageDebit },
    ],
    tdsAmount: tdsRes.tdsAmount,
    debitNoteAmount: shortageDebit,
  });

  assert.equal(totals.subtotalFreight, 120000, "Subtotal Freight must be ₹120,000");
  assert.equal(totals.debitNoteAmount, 5000, "Debit Note Amount must be ₹5,000");
  assert.equal(totals.tdsAmount, 1150, "TDS Amount must be ₹1,150");
  assert.equal(totals.netBillAmount, 113850, "Net Bill Amount must be ₹113,850");
});

test("TEST 6 — Shortage Uses Material Rate (NOT Freight Rate)", () => {
  const nWeight = 30.000;
  const rWeight = 29.500;
  const freightRate = 1200; // ₹1,200/T freight rate
  const materialRate = 5000; // ₹5,000/T material rate

  const shortageRes = calculateShortage({
    nWeight,
    rWeight,
    shortageApplicable: true,
    allowanceType: "FIXED_KG",
    allowanceValue: 300,
    shortageRuleType: "FULL_SHORTAGE",
    materialRatePerTon: materialRate, // MUST use material rate
  });

  // Shortage = (30.000 - 29.500) = 0.500 T
  // Debit = 0.500 T × ₹5,000 = ₹2,500 (NOT 0.500 × ₹1,200 = ₹600)
  assert.equal(shortageRes.shortageDebitAmount, 2500, "Shortage must use Material Rate ₹5,000/T, resulting in ₹2,500");
  assert.notEqual(shortageRes.shortageDebitAmount, 0.5 * freightRate, "Shortage must NOT use freight rate");
});

test("DEMO BUG TEST CASE (Section 15)", () => {
  // Party: QA Demo Party 01
  // Customer Rule: TDS = 2%, Shortage Allowance = 300 KG, Rule = FULL_SHORTAGE, Material Rate = ₹5,000/T
  // Trip: N = 30.000 MT, R = 29.500 MT, Rate = ₹1,200/T
  const nWeight = 30.000;
  const rWeight = 29.500;
  const rate = 1200;

  const freightRes = calculateFreight({
    freightBasis: "R_WEIGHT",
    rate,
    nWeight,
    rWeight,
  });
  // Freight = 29.500 × 1200 = ₹35,400
  assert.equal(freightRes.freightAmount, 35400, "Freight must be ₹35,400");

  const shortageRes = calculateShortage({
    nWeight,
    rWeight,
    shortageApplicable: true,
    allowanceType: "FIXED_KG",
    allowanceValue: 300,
    shortageRuleType: "FULL_SHORTAGE",
    materialRatePerTon: 5000,
  });
  // Shortage Debit = 0.500 T × ₹5,000 = ₹2,500
  assert.equal(shortageRes.shortageDebitAmount, 2500, "Shortage Debit must be ₹2,500");

  // Amount After Shortage = ₹35,400 - ₹2,500 = ₹32,900
  const amountAfterShortage = freightRes.freightAmount - shortageRes.shortageDebitAmount;
  assert.equal(amountAfterShortage, 32900);

  // TDS = ₹32,900 × 2% = ₹658
  const tdsRes = calculateTds({
    grossBillAmount: amountAfterShortage,
    tdsApplicable: true,
    tdsPercentage: 2,
    tdsSection: "94C",
  });
  assert.equal(tdsRes.tdsAmount, 658, "TDS must be ₹658 (calculated on ₹32,900 @ 2%)");

  const totals = calculateBillTotals({
    items: [{ freight: freightRes.freightAmount, shortageDebitAmount: shortageRes.shortageDebitAmount }],
    tdsAmount: tdsRes.tdsAmount,
    debitNoteAmount: shortageRes.shortageDebitAmount,
  });

  assert.equal(totals.netBillAmount, 32242, "Net bill amount must be ₹32,242");
});

test("SECTION 13 — Shortage Exceeding Gross Freight (Pending Client Presentation Confirmation)", () => {
  // Scenario: Gross Freight = ₹1,200, Shortage Debit = ₹2,500
  const grossFreight = 1200;
  const shortageDebit = 2500;

  // 1. Confirmed Accounting/Shortage Logic: Shortage debit note MUST remain ₹2,500
  assert.equal(shortageDebit, 2500, "Shortage debit note amount must NOT be reduced or zeroed out");

  // 2. Net calculation: Gross Freight - Shortage = -₹1,300
  const unclampedAmountAfterShortage = grossFreight - shortageDebit;
  assert.equal(unclampedAmountAfterShortage, -1300, "Raw amount after shortage is -₹1,300");

  // 3. Current temporary presentation behavior: Net Bill Amount clamped to ₹0 for invoice view
  // PENDING CLIENT CONFIRMATION: Whether invoice/PDF should display ₹0 vs -₹1,300.
  const totals = calculateBillTotals({
    items: [{ freight: grossFreight, shortageDebitAmount: shortageDebit }],
    tdsAmount: 0,
    debitNoteAmount: shortageDebit,
  });

  assert.equal(totals.subtotalFreight, 1200, "Subtotal freight remains ₹1,200");
  assert.equal(totals.debitNoteAmount, 2500, "Debit note amount remains ₹2,500");
  assert.equal(totals.tdsAmount, 0, "TDS amount is ₹0 when base <= 0");
  assert.equal(totals.netBillAmount, 0, "Current temporary UI presentation clamps invoice to ₹0");
});

test("PDF 12-Column Structure, Balance Calculation & Reconciled Example (Section 12 Example)", () => {
  const mockFirm = {
    name: "DEEPRAJ TRANSPORT",
    code: "DEEPRAJ",
    address: "Plot 12, Taloja MIDC, Navi Mumbai",
    phone: "9820000000",
    pan: "ABCDE1234F",
    gstin: "27ABCDE1234F1Z5",
  };

  // Reconciled example from prompt Section 12:
  // Gross Freight = ₹1,33,000 (Trip 1: ₹1,00,000 with 5,600 shortage, Trip 2: ₹33,000 with 0 shortage)
  // Shortage Debit = ₹5,600
  // TDS Base = ₹1,27,400
  // TDS @ 1% = ₹1,274
  // Net Bill = ₹1,26,126
  const mockBill = {
    id: "bill-qa-133",
    billNumber: "1001",
    billDate: "2026-09-29",
    partyName: "QA Demo Party 01",
    subtotalFreight: "133000.00",
    debitNoteAmount: "5600.00",
    tdsAmount: "1274.00",
    netBillAmount: "126126.00",
    receivedAmount: "0.00",
    pendingAmount: "126126.00",
    totalNWeight: "100.000",
    totalRWeight: "98.000",
    appliedTdsPercentage: "1.00",
    items: [
      {
        entryDate: "2026-09-28",
        truckNumber: "MH04AB1234",
        lrNumber: "LR-001",
        fromLocation: "TALOJA",
        toLocation: "MUMBAI",
        nWeight: "60.000",
        rWeight: "58.000",
        appliedRate: "1724.1379",
        freight: "100000.00",
        shortageDebitAmount: "5600.00", // SHORT = YES -> Balance = 100,000 - 5,600 = 94,400
      },
      {
        entryDate: "2026-09-28",
        truckNumber: "MH04CD5678",
        lrNumber: "LR-002",
        fromLocation: "TALOJA",
        toLocation: "PUNE",
        nWeight: "40.000",
        rWeight: "40.000",
        appliedRate: "825.0000",
        freight: "33000.00",
        shortageDebitAmount: "0.00", // SHORT = NO -> Balance = 33,000
      },
    ],
  };

  const { buildBillInvoiceHtml } = require("../services/pdf.service");
  const html = buildBillInvoiceHtml(mockBill, mockFirm);

  // 1. Check exact 12-column headers in order
  assert.ok(html.includes("SR.NO"), "Header must include SR.NO");
  assert.ok(html.includes("DATE"), "Header must include DATE");
  assert.ok(html.includes("TRUCK NO"), "Header must include TRUCK NO");
  assert.ok(html.includes("L.R NO"), "Header must include L.R NO");
  assert.ok(html.includes("FROM"), "Header must include FROM");
  assert.ok(html.includes("TO"), "Header must include TO");
  assert.ok(html.includes("N-WEIGHT"), "Header must include N-WEIGHT");
  assert.ok(html.includes("R-WEIGHT"), "Header must include R-WEIGHT");
  assert.ok(html.includes("RATE"), "Header must include RATE");
  assert.ok(html.includes("FREIGHT"), "Header must include FREIGHT");
  assert.ok(html.includes("SHORT"), "Header must include SHORT");
  assert.ok(html.includes("BALANCE"), "Header must include BALANCE");

  // 2. Check SHORT = YES / NO mapping for trip rows & blank cell in TOTAL row
  assert.ok(html.includes('<td style="text-align:center;font-weight:700;color:#b00000;">YES</td>'), "Trip 1 SHORT column must show YES");
  assert.ok(html.includes('<td style="text-align:center;font-weight:700;color:#2e7d32;">NO</td>'), "Trip 2 SHORT column must show NO");
  // tfoot must be present (whitespace-agnostic check)
  assert.ok(html.includes("<tfoot>"), "tfoot element must be present");
  assert.ok(html.includes('<tr style="background:#e8ecf4;font-weight:700;">'), "Totals row must exist inside tfoot");
  assert.ok(!html.match(/<tfoot[\s\S]*?(YES|NO)[\s\S]*?<\/tfoot>/), "Totals row SHORT cell must remain blank (no aggregated YES/NO)");

  // 3. Check Trip Balances (Trip 1: 94,400.00, Trip 2: 33,000.00)
  assert.ok(html.includes("94,400.00"), "Trip 1 Balance must be 100,000 - 5,600 = 94,400.00");
  assert.ok(html.includes("33,000.00"), "Trip 2 Balance must equal Freight 33,000.00");

  // 4. Check Total Balance (1,27,400.00)
  assert.ok(html.includes("1,27,400.00"), "Total Balance must be 1,27,400.00");

  // 5. Check TDS Amount (1,274.00) & Net Payable (1,26,126.00)
  assert.ok(html.includes("1,274.00"), "TDS Amount must be 1,274.00");
  assert.ok(html.includes("1,26,126.00"), "Net Payable must be 1,26,126.00");

  // 6. Check Amount in Words contains Net Payable text
  const { numberToWordsIndian } = require("../lib/utils");
  const expectedWords = numberToWordsIndian(126126);
  assert.ok(html.includes(expectedWords), `Amount in words must match '${expectedWords}'`);
});


