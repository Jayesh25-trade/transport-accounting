import assert from "node:assert";
import test from "node:test";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../db";
import { getBillById, listBills } from "../services/bill.service";
import { buildBillInvoiceHtml } from "../services/pdf.service";
import { bills, billItems } from "../db/schema";

test("A. PDF rendering test: Stored bill financial values render even when items=[]", async () => {
  const mockBill: any = {
    billNumber: 3,
    billDate: "2026-09-25",
    partyName: "QA Final Test Customer",
    totalNWeight: "40.000",
    totalRWeight: "39.000",
    subtotalFreight: "160000.00",
    tdsAmount: "3200.00",
    debitNoteAmount: "0.00",
    driverVoucherTotal: "6600.00",
    netBillAmount: "150200.00",
    receivedAmount: "0.00",
    pendingAmount: "150200.00",
    appliedTdsSection: "94C",
    appliedTdsPercentage: "2.00",
    items: [],
  };

  const html = buildBillInvoiceHtml(mockBill, {
    name: "Test Firm",
    address: "Test Address",
    phone: "9999999999",
    gstin: "27AAAAA0000A1Z5",
    pan: "ABCDE1234F",
  });

  assert.ok(html.includes("1,60,000.00"), "PDF contains Gross Freight ₹1,60,000");
  assert.ok(html.includes("3,200.00"), "PDF contains TDS ₹3,200");
  assert.ok(html.includes("6,600.00"), "PDF contains Driver Voucher ₹6,600");
  assert.ok(html.includes("1,50,200.00"), "PDF contains Net Bill Amount ₹1,50,200");
  assert.ok(html.includes("PENDING"), "PDF status is PENDING");
});

test("B. Bill retrieval fallback test: Zero bill_items but linked trips return trip rows", async () => {
  const allBills = await db
    .select({ id: bills.id, firmId: bills.firmId, billNumber: bills.billNumber })
    .from(bills);

  if (allBills.length === 0) {
    console.log("No bills found in database, skipping DB fallback test.");
    return;
  }

  const bill3 = allBills.find((b) => Number(b.billNumber) === 3) || allBills[0];
  const fetchedBill = await getBillById(db, bill3.id, bill3.firmId);

  assert.ok(fetchedBill, "Bill fetched successfully");
  assert.ok(fetchedBill.items.length > 0, "Fallback populated items array from linked trips");

  const firstItem: any = fetchedBill.items[0];
  assert.ok(firstItem.truckNumberRaw || firstItem.truckNumber, "Item has truck number");
  assert.ok(Number(firstItem.nWeight) > 0, "Item has N-Weight");
  assert.ok(Number(firstItem.rWeight) > 0, "Item has R-Weight");
  assert.ok(Number(firstItem.appliedRate || firstItem.rate) > 0, "Item has rate");
});

test("C. PDF parity test: Bills list totals = Bill detail totals = PDF totals for existing bills", async () => {
  const allBills = await db
    .select({ id: bills.id, firmId: bills.firmId, billNumber: bills.billNumber })
    .from(bills);

  if (allBills.length === 0) return;

  for (const b of allBills) {
    const listBill = (await listBills(db, b.firmId)).find((item) => item.id === b.id);
    assert.ok(listBill, `Bill #${b.billNumber} found in list`);

    const detailBill = await getBillById(db, b.id, b.firmId);
    assert.ok(detailBill, `Bill #${b.billNumber} found in detail`);

    // Parity check: List vs Detail
    assert.strictEqual(
      Number(listBill.subtotalFreight).toFixed(2),
      Number(detailBill.subtotalFreight).toFixed(2),
      `Bill #${b.billNumber} Subtotal Freight mismatch between list and detail`
    );
    assert.strictEqual(
      Number(listBill.tdsAmount).toFixed(2),
      Number(detailBill.tdsAmount).toFixed(2),
      `Bill #${b.billNumber} TDS Amount mismatch between list and detail`
    );
    assert.strictEqual(
      Number(listBill.netBillAmount).toFixed(2),
      Number(detailBill.netBillAmount).toFixed(2),
      `Bill #${b.billNumber} Net Bill Amount mismatch between list and detail`
    );

    // PDF rendering check
    const html = buildBillInvoiceHtml(detailBill as any, null);
    const expectedNetFmt = Number(detailBill.netBillAmount).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    assert.ok(html.includes(expectedNetFmt), `Bill #${b.billNumber} PDF contains net bill amount ${expectedNetFmt}`);
  }
});

test("D. Payment status test: Correct status derived from stored bill amounts", async () => {
  const cases = [
    { pendingAmount: "0.00", receivedAmount: "150000.00", expected: "PAID" },
    { pendingAmount: "50000.00", receivedAmount: "100000.00", expected: "PARTIALLY PAID" },
    { pendingAmount: "150200.00", receivedAmount: "0.00", expected: "PENDING" },
  ];

  for (const c of cases) {
    const mockBill: any = {
      billNumber: 99,
      subtotalFreight: "150000.00",
      netBillAmount: "150000.00",
      receivedAmount: c.receivedAmount,
      pendingAmount: c.pendingAmount,
      items: [],
    };
    const html = buildBillInvoiceHtml(mockBill, null);
    assert.ok(html.includes(c.expected), `PDF contains payment status ${c.expected}`);
  }
});

test("E. Database safety check: bill_items rows count remains 0", async () => {
  const dbBillItems = await db.select({ id: billItems.id }).from(billItems);
  assert.strictEqual(dbBillItems.length, 0, "bill_items table remains untouched (0 rows)");
});
