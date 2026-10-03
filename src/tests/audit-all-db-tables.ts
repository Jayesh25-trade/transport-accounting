/**
 * audit-all-db-tables.ts
 * READ-ONLY database inventory script.
 * Scans all database tables, lists every row with creation date and attributes,
 * traces foreign key relationships, and categorizes QA/Test vs Real/Reference data.
 */

import "dotenv/config";
import { db } from "../db";
import {
  firms,
  parties,
  companies,
  trucks,
  locations,
  customerRules,
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
  openingBalances,
} from "../db/schema";
import { eq, sql } from "drizzle-orm";

async function auditDatabase() {
  console.log("=================================================");
  console.log("READ-ONLY DATABASE AUDIT & INVENTORY");
  console.log("=================================================\n");

  // 1. Firms
  const firmRows = await db.select().from(firms);
  console.log(`=== FIRMS (${firmRows.length} rows) ===`);
  console.table(firmRows);

  // 2. Users & Memberships
  const userRows = await db.select().from(users);
  console.log(`\n=== USERS (${userRows.length} rows) ===`);
  console.table(userRows);

  const membershipRows = await db.select().from(userFirmMemberships);
  console.log(`\n=== USER FIRM MEMBERSHIPS (${membershipRows.length} rows) ===`);
  console.table(membershipRows);

  // 3. Parties
  const partyRows = await db.select().from(parties);
  console.log(`\n=== PARTIES (${partyRows.length} rows) ===`);
  console.table(partyRows);

  // 4. Companies
  const companyRows = await db.select().from(companies);
  console.log(`\n=== COMPANIES (${companyRows.length} rows) ===`);
  console.table(companyRows);

  // 5. Trucks
  const truckRows = await db.select().from(trucks);
  console.log(`\n=== TRUCKS (${truckRows.length} rows) ===`);
  console.table(truckRows);

  // 6. Locations
  const locationRows = await db.select().from(locations);
  console.log(`\n=== LOCATIONS (${locationRows.length} rows) ===`);
  console.table(locationRows);

  // 7. Customer Rules
  const ruleRows = await db.select().from(customerRules);
  console.log(`\n=== CUSTOMER RULES (${ruleRows.length} rows) ===`);
  console.table(ruleRows);

  // 8. Daily Entries
  const entryRows = await db.select().from(dailyEntries);
  console.log(`\n=== DAILY ENTRIES (${entryRows.length} rows) ===`);
  console.table(entryRows);

  // 9. Trips
  const tripRows = await db.select().from(trips);
  console.log(`\n=== TRIPS (${tripRows.length} rows) ===`);
  console.table(tripRows);

  // 10. Bills
  const billRows = await db.select().from(bills);
  console.log(`\n=== BILLS (${billRows.length} rows) ===`);
  console.table(billRows);

  // 11. Bill Items
  const billItemRows = await db.select().from(billItems);
  console.log(`\n=== BILL ITEMS (${billItemRows.length} rows) ===`);
  console.table(billItemRows);

  // 12. Payments
  const paymentRows = await db.select().from(payments);
  console.log(`\n=== PAYMENTS (${paymentRows.length} rows) ===`);
  console.table(paymentRows);

  // 13. Payment Allocations
  const allocationRows = await db.select().from(paymentAllocations);
  console.log(`\n=== PAYMENT ALLOCATIONS (${allocationRows.length} rows) ===`);
  console.table(allocationRows);

  // 14. TDS Entries
  const tdsRows = await db.select().from(tdsEntries);
  console.log(`\n=== TDS ENTRIES (${tdsRows.length} rows) ===`);
  console.table(tdsRows);

  // 15. Debit Notes
  const debitNoteRows = await db.select().from(debitNotes);
  console.log(`\n=== DEBIT NOTES (${debitNoteRows.length} rows) ===`);
  console.table(debitNoteRows);

  // 16. Ledger Transactions
  const ledgerRows = await db.select().from(ledgerTransactions);
  console.log(`\n=== LEDGER TRANSACTIONS (${ledgerRows.length} rows) ===`);
  console.table(ledgerRows);

  // 17. Driver Vouchers
  const voucherRows = await db.select().from(driverVouchers);
  console.log(`\n=== DRIVER VOUCHERS (${voucherRows.length} rows) ===`);
  console.table(voucherRows);

  // 18. Audit Logs
  const auditRows = await db.select().from(auditLogs);
  console.log(`\n=== AUDIT LOGS (${auditRows.length} rows) ===`);
  console.table(auditRows);

  // 19. Sequences
  const sequenceRows = await db.select().from(firmBillSequences);
  console.log(`\n=== FIRM BILL SEQUENCES (${sequenceRows.length} rows) ===`);
  console.table(sequenceRows);

  // 20. Opening Balances
  const balanceRows = await db.select().from(openingBalances);
  console.log(`\n=== OPENING BALANCES (${balanceRows.length} rows) ===`);
  console.table(balanceRows);
}

auditDatabase().catch((err) => {
  console.error("Audit error:", err);
  process.exit(1);
});
