# PHASE 4C-2M-R — REAL BROWSER EVIDENCE VERIFICATION PLAN

> [!CAUTION]
> **CORRECTIVE PLAN ONLY — HARD STOP IMPLEMENTED.**
> As instructed by the critical user directive, no application code, database schema, services, API routes, integration test files, or test scripts will be modified or executed during the creation of this plan. No browser will be launched and no test data will be created until explicit approval is granted. Execution will strictly commence ONLY after receiving the exact command: `"APPROVED — EXECUTE PHASE 4C-2M-R"`.

---

## 1. Objective

The objective of Phase 4C-2M-R is to conduct a true, automated end-to-end browser acceptance audit using Puppeteer/Playwright to control a real Chrome browser instance. This test will automate real DOM interactions—including page navigations, clicks, form input typing, dropdown selections, modal dialogs, firm switching, PDF generation button triggers, and mobile drawer interactions—across Desktop (`1920x1080`), Tablet (`768x1024`), and Mobile (`375x812`) viewports.

Every milestone will produce verifiable visual screenshot evidence, console error logs, network API audit logs, and post-cleanup 0-row database assertions.

---

## 2. Real Browser Test Architecture

When authorized, a dedicated automation runner script `scripts/run-browser-qa-4c-2m-r.ts` will be executed to perform real browser testing against the running web application (`http://localhost:3000`):

1. **Browser Engine**: Puppeteer / Playwright launching Google Chrome in headless or headful mode.
2. **Real DOM Interactions**:
   - `page.goto(url)` for page navigation.
   - `page.click(selector)` for buttons, tabs, dropdowns, and checkboxes.
   - `page.type(selector, text)` for form inputs.
   - `page.select(selector, value)` for native/custom select inputs.
   - `page.setViewport({ width, height })` for responsive layout switching.
3. **Visual Screenshot Capture**:
   - Automatically saves full-page PNG screenshots for every workflow step into the artifact media directory.
4. **Console & Network Diagnostics**:
   - Listens to `page.on('console')` to intercept and log any `console.error` or unhandled promise rejections.
   - Listens to `page.on('response')` to log all API requests and flag HTTP status codes `>= 400`.

---

## 3. Temporary Test Data Strategy (`QA-4C-2M-R-*`)

All test entities generated via real browser DOM forms will strictly use the prefix **`QA-4C-2M-R-*`**:
- **Firm A**: `Deepraj Transport` (`code: QA-DEEPRAJ-<timestamp>`)
- **Firm B**: `Shivsai Transport` (`code: QA-SHIVSAI-<timestamp>`)
- **Party A**: `QA-4C-2M-R-Party-Alpha`
- **Company A**: `QA-4C-2M-R-Site-Alpha`
- **Customer Rule**: `R_WEIGHT` Freight, `PERCENTAGE` Allowance (0.50%), `EXCESS_ONLY`, Material Rate ₹1,400/Ton, 1% TDS (`94C`).

At the conclusion of the browser suite, a teardown script will delete all `QA-4C-2M-R-*` entities and verify that database tables return to 0 rows.

---

## 4. Real Browser Test Scenario Matrix (U1 - U15)

### Step 1: Desktop Viewport (`1920 x 1080`)

#### Scenario 1: Navigation & Firm Context Switching
- **DOM Actions**:
  1. Set Viewport to `1920 x 1080`.
  2. `page.goto('http://localhost:3000/dashboard')`.
  3. Click Header Firm Dropdown selector.
  4. Click option `Deepraj Transport`. Verify header updates.
  5. Click Header Firm Dropdown selector. Click option `Shivsai Transport`.
  6. Switch back to `Deepraj Transport`.
- **Evidence Output**: `01_firm_switching_desktop.png`.

#### Scenario 2: Masters UI (Parties, Companies, & Customer Rules)
- **DOM Actions**:
  1. `page.goto('http://localhost:3000/masters/parties')`.
  2. Click `[data-testid="add-party-btn"]` or "Add Party" button.
  3. Type `QA-4C-2M-R-Party-Alpha` into input name field. Click "Save Party".
  4. `page.goto('http://localhost:3000/masters/companies')`.
  5. Click "Add Company". Type `QA-4C-2M-R-Site-Alpha`. Click "Save Company".
  6. `page.goto('http://localhost:3000/masters/customer-rules')`.
  7. Select Party `QA-4C-2M-R-Party-Alpha`. Select Freight Basis `R_WEIGHT`, Shortage Allowance `PERCENTAGE` (0.5%), Rule Type `EXCESS_ONLY`, Material Rate `1400`, TDS `94C` (1.0%).
  8. Click "Save Customer Rule".
- **Evidence Output**: `02_masters_party_company.png`, `02_customer_rule_saved.png`.

#### Scenario 3: Daily Book UI (Entry Logging & Received Status)
- **DOM Actions**:
  1. `page.goto('http://localhost:3000/daily-book')`.
  2. Click "Add Daily Entry" modal button.
  3. Fill inputs: Sr No `3001`, Date `2026-08-15`, Truck `MH12QR3001`, N-Weight `45.0`, R-Weight `44.2`, Rate `600`, Advance `2000`, Diesel `3200`, Party `QA-4C-2M-R-Party-Alpha`, Company `QA-4C-2M-R-Site-Alpha`, Check `Received`.
  4. Click "Submit Entry". Verify new row appears in table with `RECEIVED` badge.
- **Evidence Output**: `03_daily_book_entry_created.png`.

#### Scenario 4: Billing UI (Trip Selection, Calculation, Preview, & Bill Creation)
- **DOM Actions**:
  1. `page.goto('http://localhost:3000/billing/new')`.
  2. Select Customer `QA-4C-2M-R-Party-Alpha`.
  3. Check trip checkbox for `MH12QR3001`.
  4. Verify DOM preview totals render: Subtotal Freight ₹26,520 (44.2 MT * ₹600), Shortage Debit ₹805 (0.575 MT * ₹1,400), TDS ₹265.20 (1%), Net Payable ₹25,449.80.
  5. Click "Generate Bill" button.
  6. Verify navigation to `/billing/bills` and display of invoice `#BILL/26-27/001`.
- **Evidence Output**: `04_billing_new_preview.png`, `04_bill_invoice_detail.png`.

#### Scenario 5: Bill Detail & Atomic Edit UI
- **DOM Actions**:
  1. Click "Edit Bill" button on Bill Detail page.
  2. Modify Bill Date input to `2026-08-21`. Add Notes "Edited via Browser Acceptance Test".
  3. Click "Save Changes". Verify success toast and updated bill date.
- **Evidence Output**: `05_bill_edited.png`.

#### Scenario 6: PDF Generation Button Interaction
- **DOM Actions**:
  1. Click "Generate & Print PDF" button on Bill Detail page.
  2. Intercept browser request to `/api/bills/[id]/pdf`. Assert response status = `200 OK` and Content-Type = `application/pdf`.
- **Evidence Output**: `06_pdf_print_triggered.png`.

#### Scenario 7: Payments UI (AGAINST_BILL, ADVANCE, & Payment Modes)
- **DOM Actions**:
  1. `page.goto('http://localhost:3000/payments')`.
  2. Click "Add Payment". Select Type `AGAINST_BILL`, Party `QA-4C-2M-R-Party-Alpha`, Select Bill `#BILL/26-27/001`, Amount `15449.80`, Payment Mode `BANK_ACCOUNT`, Reference `QA-UI-REF-001`. Click "Save Payment".
  3. Click "Add Payment". Select Type `ADVANCE`, Party `QA-4C-2M-R-Party-Alpha`, Amount `10000`, Payment Mode `CASH`. Click "Save Payment".
  4. Verify Payment list renders both payment entries with correct status and unallocated amounts.
- **Evidence Output**: `07_payments_list.png`.

#### Scenario 8: Payment Allocation & Over-Allocation Rejection UI
- **DOM Actions**:
  1. On Payments page, locate Advance Payment row (₹10,000). Click "Allocate Payment" modal button.
  2. Select Bill `#BILL/26-27/001`. Type Allocation Amount `10000` (Remaining pending is ₹10,000). Click "Confirm Allocation". Verify success toast and bill status updated to `PAID`.
  3. Re-open Allocation Modal. Attempt allocating `5000` to the fully paid bill. Click "Confirm Allocation".
  4. Verify UI error alert displays: `"Allocation amount cannot exceed pending bill balance"`.
- **Evidence Output**: `08_payment_allocated_paid.png`, `08_over_allocation_error_toast.png`.

#### Scenario 9: Read-Only Customer Ledger UI
- **DOM Actions**:
  1. `page.goto('http://localhost:3000/ledger')`.
  2. Select Party `QA-4C-2M-R-Party-Alpha`.
  3. Verify ledger table displays rows: Credit Freight ₹26,520, Debit Shortage ₹805, Debit TDS ₹265.20, Debit Payment ₹15,449.80, Debit Advance ₹10,000.
  4. Verify running balance formula: `Opening (0) + Credit (26,520) - Debits (805 + 265.20 + 15,449.80 + 10,000) = ₹0`.
- **Evidence Output**: `09_customer_ledger_view.png`.

#### Scenario 10: Outstanding & Aging Reports UI
- **DOM Actions**:
  1. `page.goto('http://localhost:3000/reports/outstanding')`. Verify Party Alpha pending balance displays `₹0` (Fully Paid).
  2. `page.goto('http://localhost:3000/reports/aging')`. Select As-Of Date `2026-09-30`. Verify total aging matches outstanding.
- **Evidence Output**: `10_outstanding_report.png`, `10_aging_report.png`.

#### Scenario 11: Driver Vouchers Operational UI
- **DOM Actions**:
  1. `page.goto('http://localhost:3000/driver-vouchers')`.
  2. Filter list by Truck `MH12QR3001`. Click "View Voucher".
  3. Verify voucher details render: Advance `₹2,000`, Cash `₹300`, Diesel `₹3,200`. Badge displays `PENDING CONFIRMATION`. Confirm 0 financial ledger entries were created.
- **Evidence Output**: `11_driver_voucher_detail.png`.

---

### Step 2: Mobile Viewport (`375 x 812`) & Tablet Viewport (`768 x 1024`)

#### Scenario 12: Mobile Navigation & Responsive Audit
- **DOM Actions**:
  1. Set Viewport to `375 x 812` (Mobile iPhone X).
  2. `page.goto('http://localhost:3000/dashboard')`. Click mobile hamburger drawer button. Verify menu slides open cleanly.
  3. Navigate to `/daily-book`. Verify data table enables horizontal scrolling without clipping sidebar controls.
  4. Navigate to `/billing/new`. Verify calculation sticky footer bar renders cleanly above mobile viewport bottom.
  5. Navigate to `/payments`. Click "Add Payment" modal. Verify form inputs stack vertically and submit button is clickable.
- **Evidence Output**: `12_mobile_menu_drawer.png`, `12_mobile_dashboard.png`, `12_mobile_daily_book.png`, `12_mobile_billing_footer.png`, `12_mobile_payment_modal.png`.

#### Scenario 13: Tablet Responsive Audit (`768 x 1024`)
- **DOM Actions**:
  1. Set Viewport to `768 x 1024` (Tablet iPad).
  2. `page.goto('http://localhost:3000/dashboard')`. Verify grid cards collapse cleanly to 2 columns.
  3. `page.goto('http://localhost:3000/ledger')`. Verify running balance table fits cleanly.
- **Evidence Output**: `13_tablet_dashboard.png`, `13_tablet_ledger.png`.

---

### Step 3: Cross-Firm Zero-Data Leakage Check

#### Scenario 14: Firm B Context Zero-Data Audit
- **DOM Actions**:
  1. Set Viewport to `1920 x 1080`.
  2. Switch Header Firm Selector to `Shivsai Transport` (`Firm B`).
  3. Visit `/dashboard`, `/daily-book`, `/billing/bills`, `/payments`, `/ledger`, `/reports/outstanding`, `/driver-vouchers`.
  4. Verify 100% clean empty states with 0 rows and 0 metrics of Deepraj Transport data.
- **Evidence Output**: `14_shivsai_empty_dashboard.png`, `14_shivsai_empty_billing.png`, `14_shivsai_empty_ledger.png`.

---

### Step 4: Teardown & Database 0-Row Verification

#### Scenario 15: Database Table Cleanup & Pre-QA State Verification
- **Actions**:
  1. Execute teardown routine deleting all `QA-4C-2M-R-*` entities.
  2. Query database for row counts across all 12 business tables: `bills`, `bill_items`, `tds_entries`, `debit_notes`, `payments`, `payment_allocations`, `ledger_transactions`, `daily_entries`, `trips`, `driver_vouchers`, `opening_balances`, `audit_logs`.
  3. Assert count = 0 across all 12 tables.
- **Evidence Output**: Recorded JSON row count log in final report.

---

## 5. Verification Commands & Execution Protocol (Upon Explicit Approval Only)

When explicitly authorized via `"APPROVED — EXECUTE PHASE 4C-2M-R"`, the following sequence will be run:

1. **Start Local Application Web Server** (if not already running):
   `npm run dev` or `npm run start` at `http://localhost:3000`.
2. **Execute Real Browser Test Suite**:
   `npx tsx scripts/run-browser-qa-4c-2m-r.ts`
3. **Execute Automated Integration Verification**:
   `npm test`
4. **Execute Production Build Verification**:
   `npm run build`
5. **Generate Final Verification Report**:
   Create `phase-4c-2m-r-browser-qa-report.md` embedding screenshot references, console error logs, network audit logs, and DB row count assertions.

---

## 6. Hard Stop & Explicit Approval Request

> [!CAUTION]
> **CORRECTIVE PLAN COMPLETED — HARD STOP.**
> As instructed by the critical user directive:
> - No application code, services, APIs, schema, or migrations were modified.
> - `integration.test.ts` was NOT modified or executed.
> - No test commands (`npm test`, `npm run build`) were run.
> - No browser (Puppeteer / Playwright) was launched.
> - No test data was created in the database.
> 
> **Awaiting your explicit authorization command: `"APPROVED — EXECUTE PHASE 4C-2M-R"` to proceed with execution.**
