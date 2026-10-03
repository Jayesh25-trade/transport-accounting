import { db } from "../db";
import { sql } from "drizzle-orm";
import {
  paymentAllocations,
  payments,
  tdsEntries,
  debitNotes,
  billItems,
  bills,
  trips,
  driverVouchers,
  dailyEntries,
  ledgerTransactions,
  openingBalances,
  customerRules,
  companies,
  locations,
  trucks,
  parties,
  firmBillSequences,
  auditLogs,
  importErrors,
  rawImportRecords,
  importBatches,
  users,
  firms,
  userFirmMemberships
} from "../db/schema";

async function executeCleanup() {
  console.log("=== EXECUTING TRANSACTIONAL DATA CLEANUP ON LOCAL QA DATABASE ===");

  await db.transaction(async (tx) => {
    console.log("Deleting payment_allocations...");
    await tx.delete(paymentAllocations);

    console.log("Deleting payments...");
    await tx.delete(payments);

    console.log("Deleting tds_entries...");
    await tx.delete(tdsEntries);

    console.log("Deleting debit_notes...");
    await tx.delete(debitNotes);

    console.log("Deleting bill_items...");
    await tx.delete(billItems);

    console.log("Deleting bills...");
    await tx.delete(bills);

    console.log("Deleting trips...");
    await tx.delete(trips);

    console.log("Deleting driver_vouchers...");
    await tx.delete(driverVouchers);

    console.log("Deleting daily_entries...");
    await tx.delete(dailyEntries);

    console.log("Deleting ledger_transactions...");
    await tx.delete(ledgerTransactions);

    console.log("Deleting opening_balances...");
    await tx.delete(openingBalances);

    console.log("Deleting customer_rules...");
    await tx.delete(customerRules);

    console.log("Deleting companies...");
    await tx.delete(companies);

    console.log("Deleting locations...");
    await tx.delete(locations);

    console.log("Deleting trucks...");
    await tx.delete(trucks);

    console.log("Deleting parties...");
    await tx.delete(parties);

    console.log("Resetting firm_bill_sequences last_bill_number to 0...");
    await tx.update(firmBillSequences).set({ lastBillNumber: 0, updatedAt: new Date() });

    console.log("Deleting audit_logs...");
    await tx.delete(auditLogs);

    console.log("Deleting import tables...");
    await tx.delete(importErrors);
    await tx.delete(rawImportRecords);
    await tx.delete(importBatches);
  });

  console.log("=== TRANSACTION COMMITTED SUCCESSFULLY ===");

  console.log("\n=== VERIFYING POST-CLEANUP RECORD COUNTS ===");

  const tablesToCheck = [
    { name: "payment_allocations", table: paymentAllocations },
    { name: "payments", table: payments },
    { name: "tds_entries", table: tdsEntries },
    { name: "debit_notes", table: debitNotes },
    { name: "bill_items", table: billItems },
    { name: "bills", table: bills },
    { name: "trips", table: trips },
    { name: "driver_vouchers", table: driverVouchers },
    { name: "daily_entries", table: dailyEntries },
    { name: "ledger_transactions", table: ledgerTransactions },
    { name: "opening_balances", table: openingBalances },
    { name: "customer_rules", table: customerRules },
    { name: "companies", table: companies },
    { name: "locations", table: locations },
    { name: "trucks", table: trucks },
    { name: "parties", table: parties },
    { name: "audit_logs", table: auditLogs },
    { name: "import_batches", table: importBatches },
    { name: "raw_import_records", table: rawImportRecords },
    { name: "import_errors", table: importErrors },
  ];

  let allZero = true;
  for (const item of tablesToCheck) {
    const res = await db.select({ count: sql<number>`count(*)` }).from(item.table);
    const count = Number(res[0]?.count || 0);
    console.log(`Table ${item.name}: ${count} rows`);
    if (count !== 0) {
      allZero = false;
    }
  }

  console.log("\n=== VERIFYING PRESERVED TABLES ===");
  const usersCount = Number((await db.select({ count: sql<number>`count(*)` }).from(users))[0]?.count || 0);
  const firmsCount = Number((await db.select({ count: sql<number>`count(*)` }).from(firms))[0]?.count || 0);
  const membershipsCount = Number((await db.select({ count: sql<number>`count(*)` }).from(userFirmMemberships))[0]?.count || 0);

  console.log(`Preserved Users: ${usersCount}`);
  console.log(`Preserved Firms: ${firmsCount}`);
  console.log(`Preserved User Firm Memberships: ${membershipsCount}`);

  if (allZero && usersCount > 0 && firmsCount > 0) {
    console.log("\n SUCCESS: CLEAN LOCAL QA DATABASE IS READY FOR END-TO-END QA WORKFLOW.");
  } else {
    console.error("\n FAILURE: DATA CLEANUP INCOMPLETE OR PRESERVED DATA DAMAGED.");
    process.exit(1);
  }

  process.exit(0);
}

executeCleanup().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
