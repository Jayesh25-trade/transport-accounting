# PHASE 4C-2L — FULL SYSTEM QA & END-TO-END BUSINESS WORKFLOW AUDIT PLAN

> [!IMPORTANT]
> **READ-ONLY AUDIT & VERIFICATION PLAN ONLY.**
> No application code, database schema, accounting logic, or client production data will be created, deleted, or modified during the creation of this plan. Execution will strictly commence ONLY after receiving explicit user approval.

---

## 1. Executive Objective

The objective of Phase 4C-2L is to execute a comprehensive, end-to-end audit and quality assurance verification of the complete Transport Accounting Web Application. This plan covers every business stage from initial Daily Book logging through trip status management, customer shortage valuation, TDS deduction, bill generation, ledger posting, payment processing, outstanding/aging reporting, server-side PDF invoice rendering, and management dashboard aggregation.

All verification steps will operate under strict multi-tenant firm isolation (`Deepraj Transport` vs `Shivsai Transport`), accounting safety, transaction rollback guarantees, and 100% post-test zero-data database cleanup.

---

## 2. Test Environment & Data Strategy

1. **Isolation & Fixtures**:
   - All QA entities (Firms, Parties, Companies, Daily Entries, Trips, Bills, Payments, Vouchers) will be generated with distinct `QA-TEST-*` identifiers.
   - Operations will be run within a dedicated QA subtest suite integrated into `src/tests/integration.test.ts` (or an isolated test invocation).

2. **Firm Setup**:
   - **Firm A**: `Deepraj Transport` (`code: QA_TEST_DEEPRAJ_<timestamp>`)
   - **Firm B**: `Shivsai Transport` (`code: QA_TEST_SHIVSAI_<timestamp>`)

3. **Master Data & Customer Rules Setup**:
   - **Party A (`QA Customer A - Percentage / Excess`)**:
     - Freight Basis: `R_WEIGHT`
     - Shortage Applicable: `true`
     - Shortage Allowance Type: `PERCENTAGE` (0.50%)
     - Shortage Rule Type: `EXCESS_ONLY`
     - Material Rate: ₹1,200 / Ton
     - TDS Applicable: `true`, Section `94C`, Rate: `1.0%`
   - **Party B (`QA Customer B - Fixed KG / Full Shortage`)**:
     - Freight Basis: `N_WEIGHT`
     - Shortage Applicable: `true`
     - Shortage Allowance Type: `FIXED_KG` (500 KG = 0.50 MT)
     - Shortage Rule Type: `FULL_SHORTAGE`
     - Material Rate: ₹1,500 / Ton
     - TDS Applicable: `true`, Section `94C`, Rate: `2.0%`
   - **Company A**: `QA Site Alpha` (Belongs to Firm A)
   - **Company B**: `QA Site Beta` (Belongs to Firm B)

4. **Zero-Data Database Guarantee**:
   - Before test execution: Assert database tables (`bills`, `billItems`, `payments`, `ledgerTransactions`, etc.) contain 0 rows.
   - Teardown: Execute clean deletion script removing all `QA-TEST-*` tagged records across all tables.
   - After test execution: Re-verify that production database business tables return to 0 rows.

---

## 3. Controlled Test Scenarios (35 Requirements)

### Scenario 1: Firm Isolation (Master Data)
- **Objective**: Verify master records (Parties, Companies, Trucks, Locations) created under Firm A are not accessible or visible in Firm B context.
- **Verification**: Call `verifyPartyInFirm` and `verifyCompanyInFirm` with cross-firm IDs and assert `FirmIsolationError` is thrown.

### Scenario 2: Party vs Company Separation
- **Objective**: Ensure `Party` represents the billing customer entity while `Company` represents physical sites/consignees.
- **Verification**: Attempt assigning Party A from Firm A with Company B from Firm B in a Daily Book entry; verify firm isolation enforcement.

### Scenario 3: Daily Book Creation & Dual-Entity Generation
- **Objective**: Verify creating a Daily Entry creates the associated `Trip` and `DriverVoucher` records with identical operational metrics.
- **Verification**: Call `createDailyEntry` with operational fields (`nWeight: 40`, `rWeight: 39.2`, `advance: 2000`, `cash: 500`, `diesel: 3000`). Confirm `trips` and `driverVouchers` rows are created with `dailyEntryId` linkage.

### Scenario 4: Daily Book Edit Atomicity
- **Objective**: Verify updating a Daily Entry atomically updates associated Trip weights and Driver Voucher amounts.
- **Verification**: Call `updateDailyEntry` modifying `nWeight`, `rWeight`, and `diesel`. Verify linked Trip and Driver Voucher reflect updated numbers.

### Scenario 5: Driver Voucher Operational Synchronization
- **Objective**: Verify Driver Voucher updates sync operational amounts (`advance`, `cash`, `diesel`, `ac`) without creating any accounting ledger transactions.
- **Verification**: Assert `ledgerTransactions` count remains unchanged after Driver Voucher creation/edit.

### Scenario 6: Received vs Pending Trip Behavior
- **Objective**: Distinguish between billing-eligible `RECEIVED` trips and non-billable `PENDING` trips.
- **Verification**:
  - Trip 1: `rWeight = 39.5` → Status = `RECEIVED`.
  - Trip 2: `rWeight = null` → Status = `PENDING`.
  - Call `getBillableTrips` for Party A; confirm only Trip 1 is returned.

### Scenario 7: Billing Trip Selection
- **Objective**: Verify trip selection for bill creation rejects already billed trips and trips belonging to other parties or firms.
- **Verification**: Attempt creating a bill with a `PENDING` trip or an already billed trip ID; verify `DomainValidationError`.

### Scenario 8: Freight Calculation Rules
- **Objective**: Validate freight calculations based on customer freight basis (`R_WEIGHT` vs `N_WEIGHT`).
- **Verification**:
  - Customer A (`R_WEIGHT`, Rate ₹500, R-Weight 39.2 MT): Freight = `39.2 * 500 = ₹19,600`.
  - Customer B (`N_WEIGHT`, Rate ₹600, N-Weight 40.0 MT): Freight = `40.0 * 600 = ₹24,000`.

### Scenario 9: Mixed-Customer Bill Handling
- **Objective**: Verify that a single bill containing trips for different parties correctly computes itemized freight, shortages, and TDS according to each trip customer's rules.
- **Verification**: Create a multi-trip bill; verify itemized shortage and gross freight match individual customer rule calculations.

### Scenario 10: Customer-Wise Shortage Engine Validation
- **Objective**: Validate distinct shortage logic per customer in the same transaction block.
- **Verification**: Verify Customer A and Customer B trips generate different shortage MT and debit note totals based on their respective rules.

### Scenario 11: EXCESS_ONLY Shortage Rule
- **Objective**: Test shortage deduction when loss exceeds allowance.
- **Verification**:
  - N-Weight = 40.0 MT, R-Weight = 39.2 MT (Loss = 0.80 MT).
  - Allowance (0.50% of 40 MT) = 0.20 MT.
  - Penalized Shortage = `0.80 - 0.20 = 0.60 MT`.
  - Debit Amount = `0.60 MT * ₹1,200 = ₹720`.

### Scenario 12: FULL_SHORTAGE Shortage Rule
- **Objective**: Test full shortage penalty when loss exceeds allowance threshold.
- **Verification**:
  - N-Weight = 50.0 MT, R-Weight = 49.0 MT (Loss = 1.0 MT).
  - Allowance (Fixed 0.50 MT) → Loss (1.0 MT) > Allowance (0.50 MT).
  - Penalized Shortage = Entire `1.0 MT`.
  - Debit Amount = `1.0 MT * ₹1,500 = ₹1,500`.

### Scenario 13: Percentage Allowance Calculation
- **Objective**: Verify percentage-based allowance formula: `N_Weight * (allowancePercentage / 100)`.
- **Verification**: Assert allowance for 40 MT @ 0.5% equals exactly 0.20 MT (200 KG).

### Scenario 14: Fixed-KG Allowance Calculation
- **Objective**: Verify fixed-KG allowance formula: `allowanceValue / 1000` MT.
- **Verification**: Assert allowance for 500 KG equals exactly 0.50 MT.

### Scenario 15: Material-Rate Shortage Valuation
- **Objective**: Verify shortage debit note valuation equals `Shortage MT * Material Rate Per Ton`.
- **Verification**: Assert Debit Note amount matches `shortageWeight * materialRatePerTon`.

### Scenario 16: TDS Calculation Logic
- **Objective**: Validate TDS deduction: `Gross Freight * (tdsPercentage / 100)`.
- **Verification**: Gross Freight = ₹20,000 @ 1% TDS → TDS Amount = ₹200.

### Scenario 17: TDS Manual Override
- **Objective**: Test manual override of TDS amount during bill creation.
- **Verification**: Pass explicit `tdsAmount: 250` during `createBill`. Assert stored `tdsEntries` and bill totals reflect ₹250 override.

### Scenario 18: Bill Ledger Posting & Accounting Structure
- **Objective**: Verify single atomic bill ledger transaction posting.
- **Verification**: Confirm bill creation creates 1 `ledgerTransactions` entry:
  - `CREDIT` = Transportation Charges (Gross Freight)
  - `DEBIT` = Shortage / Debit Note
  - `DEBIT` = TDS Entry
  - Net Customer Debit = `Gross Freight - Shortage - TDS`.

### Scenario 19: Bill Edit Atomic Reconciliation
- **Objective**: Verify editing a bill recalculates and updates bill totals, items, debit notes, TDS entries, ledger postings, and audit logs.
- **Verification**: Call `editBill` to add/remove trips; verify ledger transaction and net payable reflect updated figures seamlessly.

### Scenario 20: Payment AGAINST_BILL Flow
- **Objective**: Process payment against a specific bill.
- **Verification**: Call `createPayment` with `paymentType: AGAINST_BILL`, `billId`, amount ₹10,000. Verify bill `receivedAmount` increases by ₹10,000, `paymentAllocations` record is created, and ledger posts `DEBIT` to Payment / Bank/Cash account.

### Scenario 21: Payment ADVANCE Flow
- **Objective**: Process advance payment without linking to a bill.
- **Verification**: Call `createPayment` with `paymentType: ADVANCE`, amount ₹5,000. Verify payment is saved with `unallocatedAmount = 5000`, ledger entry created, and no bill received amounts are altered.

### Scenario 22: Payment Allocation Workflow
- **Objective**: Allocate an existing unallocated/advance payment to an outstanding bill.
- **Verification**: Call `allocatePaymentToBill`. Verify payment `unallocatedAmount` decreases, bill `receivedAmount` increases, and allocation history record is inserted.

### Scenario 23: Over-Allocation Rejection & Transaction Safety
- **Objective**: Attempt allocating a payment amount exceeding the bill's remaining pending balance.
- **Verification**: Pass allocation amount > `netAmount - receivedAmount`. Assert `PaymentAllocationError` is thrown and database state rolls back completely without orphan records.

### Scenario 24: Ledger Running Balance Verification
- **Objective**: Verify customer ledger running balance computation formula: `Running Balance = Opening Balance + Credits - Debits`.
- **Verification**: Call `calculateLedgerRunningBalance` on ledger entries and confirm running balances match mathematical expectations line-by-line.

### Scenario 25: Outstanding Report Accuracy
- **Objective**: Validate `getOutstandingReport` calculations.
- **Verification**: Query report for Party A; assert `grossTotal`, `shortageTotal`, `tdsTotal`, `netTotal`, `receivedTotal`, and `pendingTotal` reconcile with individual bill records.

### Scenario 26: Aging Report Bucketing
- **Objective**: Validate `getAgingReport` distribution across 5 aging buckets: `Current (0-30)`, `31-60`, `61-90`, `91-180`, `181+`.
- **Verification**: Create bills with dates 15 days, 45 days, 75 days, 120 days, and 200 days prior to as-of date. Assert outstanding balances fall into exact corresponding buckets.

### Scenario 27: Partial Payment Aging Impact
- **Objective**: Verify partial payments reduce remaining pending balance without altering original bill bucket placement.
- **Verification**: Pay 50% of a 45-day old bill; verify remaining 50% stays in the `31-60` bucket.

### Scenario 28: PDF Invoice Generation Safety
- **Objective**: Verify server-side PDF invoice rendering via `generateBillPdfBuffer` and `buildBillInvoiceHtml`.
- **Verification**: Render PDF for QA bill; assert non-empty Buffer returned, HTML contains firm/party/trip details, and zero database writes occur during generation.

### Scenario 29: Management Dashboard Reconciliation
- **Objective**: Verify `getDashboardOverview` metrics match authoritative underlying services 1:1.
- **Verification**: Compare dashboard summary numbers for Daily Book, Billing, Payments, Outstanding, Aging, and Driver Vouchers against direct report outputs.

### Scenario 30: Driver Voucher Accounting Safety
- **Objective**: Verify Driver Vouchers remain strictly operational.
- **Verification**: Assert Driver Voucher `accountingStatus = PENDING_CONFIRMATION` and confirm no financial ledger debit/credit transactions are posted.

### Scenario 31: Audit Logging Verification
- **Objective**: Verify system audit log tracking for key business mutations.
- **Verification**: Check `auditLogs` table for entries logged during `CREATE_BILL`, `EDIT_BILL`, `CREATE_PAYMENT`, `CREATE_DAILY_ENTRY` with correct `firmId` and `action`.

### Scenario 32: Transaction Rollback Verification
- **Objective**: Verify complete atomic rollback on API/service execution failure.
- **Verification**: Intentionally fail a multi-table mutation (e.g. invalid bill edit making net payable < received amount); verify no orphan bill items or ledger entries persist.

### Scenario 33: Sequential Bill Numbering Integrity
- **Objective**: Verify `getNextBillNumberForFirm` generates sequential numbers per firm (`BILL/26-27/001`, `BILL/26-27/002`) without cross-firm collision or sequence gaps.
- **Verification**: Generate bills in Firm A and Firm B concurrently; confirm sequence counters maintain firm independence.

### Scenario 34: Cross-Firm Data Isolation Audit
- **Objective**: Verify complete data isolation across all modules between `Deepraj Transport` and `Shivsai Transport`.
- **Verification**: Query reports, ledgers, bills, payments, vouchers, and dashboard under Firm B context while QA data exists under Firm A; confirm Firm B returns 0 metrics/records.

### Scenario 35: Zero-Data Cleanup & Verification
- **Objective**: Clean all QA test data and verify business tables return to zero rows.
- **Verification**: Execute teardown script; run database row count check on all 12 core tables (`bills`, `bill_items`, `tds_entries`, `debit_notes`, `payments`, `payment_allocations`, `ledger_transactions`, `daily_entries`, `trips`, `driver_vouchers`, `opening_balances`, `audit_logs`) and assert count = 0.

---

## 4. Verification Execution Plan & Commands

Upon explicit user authorization to execute this plan, the following steps will be performed:

1. **Integration Test Execution**:
   ```bash
   npm test
   ```
   *Expected Output*: All integration subtests pass cleanly (100% success rate).

2. **Production Build & Type Check**:
   ```bash
   npm run build
   ```
   *Expected Output*: Build succeeds with 0 TypeScript compilation errors.

3. **Database Row Count Audit Script**:
   Run inline DB check script verifying all 12 business tables contain 0 rows.

4. **QA Report Generation**:
   Create `phase-4c-2l-qa-report.md` detailing test results, bug fixes (if any), build status, and final database verification.

---

## 5. Stop Condition & Approval Request

> [!CAUTION]
> **STOPPING HERE.**
> As instructed, no QA test execution, application code modifications, database schema changes, or test data insertions have been performed.
> 
> **Awaiting your explicit approval to proceed with Phase 4C-2L QA execution.**
