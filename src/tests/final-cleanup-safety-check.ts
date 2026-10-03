/**
 * final-cleanup-safety-check.ts
 * READ-ONLY final verification script before any cleanup approval.
 */

import "dotenv/config";
import { db } from "../db";
import {
  firms,
  parties,
  companies,
  dailyEntries,
  trips,
  bills,
  billItems,
  payments,
  paymentAllocations,
  tdsEntries,
  debitNotes,
  ledgerTransactions,
  driverVouchers,
  auditLogs,
  firmBillSequences,
  users,
  userFirmMemberships,
} from "../db/schema";
import { eq, inArray, and } from "drizzle-orm";

async function performSafetyCheck() {
  console.log("=================================================");
  console.log("FINAL CLEANUP SAFETY CHECK — READ ONLY VERIFICATION");
  console.log("=================================================\n");

  const firmDeeprajId = "beb79822-876c-41cf-8e4d-dacdafa17eed";
  const firmShivSaiId = "1ff5a00e-aa16-4086-a4c7-8e6b1391b17b";

  // ──────────────────────────────────────────────────────────────────────────
  // A) FINANCIAL RECORD SAFETY
  // ──────────────────────────────────────────────────────────────────────────
  console.log("--- A) FINANCIAL RECORD SAFETY ---");
  const deeprajBills = await db.select().from(bills).where(eq(bills.firmId, firmDeeprajId));
  const shivsaiBills = await db.select().from(bills).where(eq(bills.firmId, firmShivSaiId));

  console.log(`Deepraj Transport total bills: ${deeprajBills.length}`);
  console.table(deeprajBills.map(b => ({
    id: b.id,
    billNumber: b.billNumber,
    billDate: b.billDate,
    netBillAmount: b.netBillAmount,
    notes: b.notes,
    status: b.status,
  })));

  console.log(`Shiv Sai Transport total bills: ${shivsaiBills.length}`);
  console.table(shivsaiBills.map(b => ({
    id: b.id,
    billNumber: b.billNumber,
    billDate: b.billDate,
    netBillAmount: b.netBillAmount,
    notes: b.notes,
    status: b.status,
  })));

  // Check payments, tds, debit notes, ledger
  const allBills = [...deeprajBills, ...shivsaiBills];
  const allBillIds = allBills.map(b => b.id);

  const paymentsForBills = allBillIds.length > 0 ? await db.select().from(payments) : [];
  const tdsForBills = allBillIds.length > 0 ? await db.select().from(tdsEntries).where(inArray(tdsEntries.billId, allBillIds)) : [];
  const debitNotesForBills = allBillIds.length > 0 ? await db.select().from(debitNotes).where(inArray(debitNotes.billId, allBillIds)) : [];
  const ledgerForBills = allBillIds.length > 0 ? await db.select().from(ledgerTransactions).where(inArray(ledgerTransactions.sourceEntityId, allBillIds)) : [];

  console.log("\nAssociated Financial Records for Bills:");
  console.log(`- TDS Entries referencing bills: ${tdsForBills.length}`);
  console.log(`- Debit Notes referencing bills: ${debitNotesForBills.length}`);
  console.log(`- Ledger Transactions referencing bills: ${ledgerForBills.length}`);
  console.log(`- Payments in DB: ${paymentsForBills.length}`);
  console.table(paymentsForBills.map(p => ({
    id: p.id,
    firmId: p.firmId,
    paymentDate: p.paymentDate,
    amount: p.amount,
    referenceNumber: p.referenceNumber,
    remarks: p.remarks,
  })));

  // ──────────────────────────────────────────────────────────────────────────
  // B) BILL SEQUENCE SAFETY
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- B) BILL SEQUENCE SAFETY ---");
  const sequences = await db.select().from(firmBillSequences);
  console.table(sequences);

  // ──────────────────────────────────────────────────────────────────────────
  // C) AUDIT LOG SAFETY
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- C) AUDIT LOG SAFETY ---");
  const logs = await db.select().from(auditLogs);
  console.log(`Total Audit Logs in DB: ${logs.length}`);
  const nonAuthLogs = logs.filter(l => l.entityName !== "AUTH");
  console.log(`Data-related Audit Logs: ${nonAuthLogs.length}`);
  console.table(nonAuthLogs.map(l => ({
    id: l.id,
    firmId: l.firmId,
    userId: l.userId,
    action: l.action,
    entityName: l.entityName,
    entityId: l.entityId,
    createdAt: l.createdAt,
  })));

  // ──────────────────────────────────────────────────────────────────────────
  // D) TEST USER SAFETY
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- D) TEST USER SAFETY ---");
  const testUsers = await db.select().from(users).where(inArray(users.email, ["jayeshneo07+test@gmail.com", "test@gmail.com"]));
  console.table(testUsers.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt })));

  const testUserIds = testUsers.map(u => u.id);
  const testUserMemberships = testUserIds.length > 0 ? await db.select().from(userFirmMemberships).where(inArray(userFirmMemberships.userId, testUserIds)) : [];
  console.log(`Memberships for test users: ${testUserMemberships.length}`);

  // Check if test users created any dailyEntries, bills, payments, auditLogs
  const createdEntries = testUserIds.length > 0 ? await db.select().from(dailyEntries).where(inArray(dailyEntries.createdBy, testUserIds)) : [];
  const createdBills = testUserIds.length > 0 ? await db.select().from(bills).where(inArray(bills.createdBy, testUserIds)) : [];
  const createdPayments = testUserIds.length > 0 ? await db.select().from(payments).where(inArray(payments.createdBy, testUserIds)) : [];
  console.log(`Records created by test users: Entries=${createdEntries.length}, Bills=${createdBills.length}, Payments=${createdPayments.length}`);

  // ──────────────────────────────────────────────────────────────────────────
  // E) QA DATA DEPENDENCY RECHECK & UNPREFIXED RECHECK
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- E & F) RECHECK PER FIRM & UNPREFIXED LINKED RECORDS ---");
  const allParties = await db.select().from(parties);
  const allCompanies = await db.select().from(companies);
  const allEntries = await db.select().from(dailyEntries);
  const allTrips = await db.select().from(trips);
  const allDriverVouchers = await db.select().from(driverVouchers);
  const allBillItems = await db.select().from(billItems);
  const allAllocations = await db.select().from(paymentAllocations);

  console.log(`All Parties: ${allParties.length}`);
  console.table(allParties.map(p => ({ id: p.id, firmId: p.firmId, name: p.name })));

  console.log(`All Companies: ${allCompanies.length}`);
  console.table(allCompanies.map(c => ({ id: c.id, firmId: c.firmId, name: c.name })));

  console.log(`All Daily Entries: ${allEntries.length}`);
  console.table(allEntries.map(e => ({
    id: e.id,
    firmId: e.firmId,
    srNo: e.srNo,
    entryDate: e.entryDate,
    truckNumberRaw: e.truckNumberRaw,
    lrNumber: e.lrNumber,
    partyNameRaw: e.partyNameRaw,
    companyNameRaw: e.companyNameRaw,
    partyId: e.partyId,
    companyId: e.companyId,
  })));
}

performSafetyCheck().catch(err => {
  console.error("Safety check error:", err);
  process.exit(1);
});
