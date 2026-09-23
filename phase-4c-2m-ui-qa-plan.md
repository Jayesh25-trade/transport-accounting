# PHASE 4C-2M — UI & BROWSER-LEVEL ACCEPTANCE TESTING PLAN

> [!IMPORTANT]
> **PLAN ONLY — DO NOT EXECUTE WITHOUT EXPLICIT APPROVAL.**
> As instructed by the critical execution rule, no application code, database schema, services, API routes, or test scripts will be modified or executed during the creation of this plan. Execution will strictly commence ONLY after receiving the explicit command: `"APPROVED — EXECUTE PHASE 4C-2M"`.

---

## 1. Objective

The objective of Phase 4C-2M is to conduct a complete browser-level end-to-end acceptance testing audit of the user interface across all modules of the Transport Accounting Web Application. This phase validates that the backend business logic, accounting rules, firm isolation, and database reconciliations built in previous phases are accurately exposed and usable via the web browser UI across desktop, tablet, and mobile viewports.

---

## 2. Scope

The QA scope spans the complete end-to-end user journey across both active firms (**Deepraj Transport** and **Shivsai Transport**):

- **Application Entry & Firm Switcher Context**: Top-level header firm selector, persistence, and zero-leakage state.
- **Management Dashboard**: Summary cards, period filters, 0-data behavior, and metric card aggregations.
- **Masters UI**: Parties, Companies, Trucks, Locations, and Customer Rules forms/tables.
- **Daily Book UI**: Entry creation, modal forms, filters, decimal/weight validation, and status toggles (`RECEIVED` vs `PENDING`).
- **Billing UI**: Trip selection, freight calculation, per-item customer shortage rules, TDS deduction preview, TDS manual percentage override, and invoice creation.
- **Bill Detail & Edit UI**: Invoice viewer, atomic bill edits, edit rejection when new net < received amount.
- **PDF Generation & Printing UI**: Server-side PDF viewer/printer trigger without database mutations.
- **Payments & Allocation UI**: `AGAINST_BILL` vs `ADVANCE` payments, payment mode selection (`BANK_ACCOUNT`, `CASH`, `CHEQUE`, `UTR`, `NEFT`, `RTGS`, `UPI`), manual payment allocations, and over-allocation rejection.
- **Customer Ledger UI**: Read-only ledger view, party selector, running balance formula (`Opening + Credits - Debits`), and export.
- **Outstanding & Aging Reports UI**: Customer outstanding summary, age bucket distribution (`Current`, `1–30`, `31–60`, `61-90`, `91-180`, `181+`), and as-of date filters.
- **Driver Vouchers UI**: Operational voucher listing, search, details, and `PENDING_CONFIRMATION` non-posting badge validation.
- **Responsive & Mobile Viewports**: Desktop (`1920x1080`), Tablet (`768x1024`), Mobile (`375x812`).
- **Console & Network Error Monitoring**: Hydration errors, 4xx/5xx requests, unhandled rejections.

---

## 3. Environment & Setup

- **App Server**: Local Next.js Development / Production Server (`http://localhost:3000`).
- **Database Engine**: PostgreSQL 16.15 `transport_acc` on `localhost:5432`.
- **Browser Automation Tools**: Puppeteer / Playwright headless or interactive browser session.
- **Browser Version**: Chrome / Chromium Headless (Puppeteer embedded).

---

## 4. Browser Strategy

- Headless Chrome browser instance orchestrated via automated Puppeteer script or manual verification protocol.
- Captures full-page screenshots for key workflow milestones (`dashboard`, `daily-book`, `billing-preview`, `bill-pdf`, `payments`, `ledger`, `outstanding`, `aging`, `driver-vouchers`).
- Captures browser console logs (`console.error`, `console.warn`) and HTTP network responses (`status >= 400`).

---

## 5. Viewport Strategy

Every major application route will be rendered and validated across three standard viewports:

| Viewport Category | Width x Height | Focus Areas |
|---|---|---|
| **Desktop** | `1920 x 1080` | Full layout tables, multi-column cards, sidebar navigation, modal dialogs |
| **Tablet** | `768 x 1024` | Flexible grid collapse, table horizontal scrolling, header firm switcher dropdown |
| **Mobile** | `375 x 812` | Mobile hamburger menu/drawer, stacked card views, sticky actions, modal full-screen readability |

---

## 6. Firm-Isolation Strategy

1. **Dual-Firm Validation**:
   - Create QA test data under **Deepraj Transport** (`Firm A`).
   - Switch active firm context to **Shivsai Transport** (`Firm B`) via top-header UI dropdown.
2. **Zero-Leakage Assertion**:
   - Verify that switching to Firm B updates all visible UI screens (`Dashboard`, `Daily Book`, `Billing`, `Payments`, `Ledger`, `Outstanding`, `Aging`, `Driver Vouchers`) to show 0 metrics and 0 rows of Firm A data.
3. **Cross-Firm Mutation Block**:
   - Verify that direct URL access or API calls under Firm B context attempting to modify Firm A entity IDs return `404` or `403` error alerts cleanly.

---

## 7. Test-Data Strategy

- All temporary records created during browser acceptance testing will use the prefix **`QA-4C-2M-*`** (e.g., Party: `QA-4C-2M-Customer-Alpha`).
- **No Real Client Data**: Real business names or client files will not be touched.
- **Teardown Guarantee**: After completing browser verification, a dedicated teardown script will delete all `QA-4C-2M-*` records and assert that database business tables return to 0 rows.

---

## 8. UI Workflow Matrix (Primary End-to-End User Journey)

```
[1. Firm Selector (Deepraj)]
       ↓
[2. Dashboard Overview]
       ↓
[3. Masters (Parties, Companies, Rules)]
       ↓
[4. Daily Book (Create Entry & Received Trip)]
       ↓
[5. Billing (Select Trip, Calculate, Preview, Create Bill)]
       ↓
[6. Bill Detail & PDF Export]
       ↓
[7. Payments (AGAINST_BILL & ADVANCE)]
       ↓
[8. Payment Allocation]
       ↓
[9. Customer Ledger (Verify Running Balance)]
       ↓
[10. Outstanding & Aging Reports]
       ↓
[11. Driver Vouchers (Verify Operational Status)]
       ↓
[12. Firm Selector (Switch to Shivsai -> Verify 0 Data)]
```

---

## 9. Desktop Test Matrix (1920x1080)

| Route / Module | Workflow Steps | Expected UI Behavior |
|---|---|---|
| `/` or `/dashboard` | Load home dashboard | Header displays firm name; summary cards render metrics without `NaN`/`undefined`; empty database state renders clean zeroes. |
| `/masters/parties` | Add Party `QA-4C-2M-Party-A` | Party card/row appears in list with active status; form validates required name field. |
| `/masters/companies` | Add Company `QA-4C-2M-Company-A` | Company site saved; remains visually distinct from billing Party. |
| `/masters/customer-rules` | Configure rule for Party A | Configures Freight Basis (`R_WEIGHT`), Shortage Allowance (`PERCENTAGE` 0.5%), Rule Type (`EXCESS_ONLY`), Material Rate (₹1,200), TDS (1.0%). |
| `/daily-book` | Create Daily Entry | Form submits entry (`Sr No 1001`, `Truck MH12QA1001`, `N-Weight 40.0`, `R-Weight 39.2`, `Rate 500`, `Advance 1500`, `Diesel 2500`, `isReceived: true`). Linked trip and voucher indicator shown. |
| `/billing/new` | Create Bill | Trip selection table lists `RECEIVED` trip. Calculates Subtotal (₹19,600), Shortage (₹720), TDS (₹196), Net (₹18,684). Submits bill. |
| `/billing/bills` | View Bill Details | Opens created bill invoice. Displays bill number `BILL/26-27/001`, itemized trips, shortage debit, TDS, and net payable. |
| `/billing/bills` | Generate PDF | Clicks "Generate PDF" button. Opens/renders Puppeteer PDF without page errors or DB mutations. |
| `/payments` | Add Payment (AGAINST_BILL) | Selects Party A, Payment Type `AGAINST_BILL`, selects Bill #1, Amount ₹8,684, Mode `BANK_ACCOUNT`. Bill pending balance updates to ₹10,000. |
| `/payments` | Add Payment (ADVANCE) | Selects Party A, Payment Type `ADVANCE`, Amount ₹5,000, Mode `CASH`. Unallocated balance shows ₹5,000. |
| `/payments` | Payment Allocation Modal | Opens payment allocation UI. Allocates ₹5,000 advance to Bill #1. Remaining bill pending updates to ₹5,000. Over-allocation displays error toast. |
| `/ledger` | Customer Ledger View | Selects Party A. Displays running balance (`Credit ₹19,600`, `Debit ₹720 Shortage`, `Debit ₹196 TDS`, `Debit ₹8,684 Payment`, `Debit ₹5,000 Advance`). |
| `/reports/outstanding` | Outstanding Report View | Lists Party A pending bill balance ₹5,000. Total outstanding reconciles with bill record. |
| `/reports/aging` | Aging Report View | Displays ₹5,000 in `Current / 0-30 Days` bucket based on bill date vs as-of date. |
| `/driver-vouchers` | Driver Voucher List | Displays operational voucher for `MH12QA1001` with `Diesel ₹2,800`. Badge displays `PENDING CONFIRMATION`. 0 ledger debit/credit postings created. |

---

## 10. Mobile Test Matrix (375x812)

| Route / Module | Test Viewport | Validation Criteria |
|---|---|---|
| Header & Navigation | `375 x 812` | Navigation drawer/menu toggles smoothly; active firm selector dropdown remains accessible without horizontal page overflow. |
| Dashboard Cards | `375 x 812` | Summary cards stack vertically; metric numbers remain fully legible without text clipping. |
| Daily Book Table | `375 x 812` | Data table enables horizontal scroll container; "Add Entry" floating or fixed button is clickable. |
| Billing Trip Selector | `375 x 812` | Multi-select checkboxes for trips remain responsive; calculation sticky footer bar displays gross, shortage, TDS, net clearly. |
| Payment Modal Form | `375 x 812` | Form fields (Party, Type, Amount, Mode) display stacked; submit button is not obscured by soft keyboard or bottom nav. |
| Ledger & Report Cards | `375 x 812` | Running balance table scrolls horizontally; export button remains touch-target friendly (min 44x44px). |

---

## 11. Error-State & Validation Matrix

| Trigger / Condition | Location | Expected User-Facing UI Behavior |
|---|---|---|
| Empty Database | `/dashboard`, `/daily-book`, `/billing/bills`, `/reports/outstanding` | Displays professional empty states ("No entries found", "0 Outstanding") with zero console error trace. |
| Bill Pending Trip Attempt | `/billing/new` | Pending trips are unchecked/disabled or show tooltip "Unreceived trips cannot be billed". |
| Over-Allocation Attempt | `/payments` allocation modal | Toast/Alert notification: "Allocation amount cannot exceed pending bill balance". Submit button remains blocked. |
| Invalid Bill Edit | `/billing/bills` edit form | Attempting to lower net bill amount below received ₹13,684 displays validation message: "Bill has ₹13,684 already received. Edit rejected." |
| Cross-Firm Direct URL Access | `/billing/bills?id=<Firm_A_Bill_ID>` under Firm B | Render 404 page or error notification: "Bill not found in current firm context". |

---

## 12. Console & Network Diagnostics Protocol

During browser test execution, automated diagnostics will log:

1. **Console Audits**:
   - Record all browser errors (`window.onerror`, `console.error`).
   - Rejection check: Assert 0 unhandled promise rejections.
2. **Network Audits**:
   - Inspect all HTTP requests to `/api/*`.
   - Rejection check: Assert 0 unexpected `500 Internal Server Error` responses.
   - Idempotency check: Assert 0 duplicate rapid-fire mutation calls on submit clicks.

---

## 13. Accounting Reconciliation Verification Matrix

| UI Surface | Backend Service Source | Reconciliation Formula / Assertion |
|---|---|---|
| Dashboard Net Payable | `getDashboardOverview` / `bills` table | `Dashboard Net Payable == Sum(bills.net_bill_amount)` |
| Dashboard Outstanding | `getOutstandingReport` | `Dashboard Outstanding == Outstanding Report Total` |
| Ledger Running Balance | `listLedgerTransactions` | `Running Balance = Opening + Credits - Debits` |
| Aging Report Total | `getAgingReport` | `Sum(Current + 1-30 + 31-60 + 61-90 + 91-180 + 181+) == Total Outstanding` |
| Driver Voucher Status | `getDriverVouchers` | `Voucher Accounting Status == PENDING_CONFIRMATION` |

---

## 14. Data Cleanup Strategy

1. **Tracking**: Every record inserted via UI during acceptance testing will be created with `QA-4C-2M-*` naming.
2. **Execution**: Following test completion, an inline script will delete all `QA-4C-2M-*` records across `payment_allocations`, `payments`, `tds_entries`, `debit_notes`, `bill_items`, `bills`, `trips`, `driver_vouchers`, `daily_entries`, `ledger_transactions`, `customer_rules`, `companies`, `parties`, `audit_logs`.
3. **Zero-Row Audit**: Query all 12 business tables and assert count = 0.

---

## 15. Bug Severity Classification Standard

If defects are discovered during execution, they will be classified as follows:

- **P0 — Critical Accounting / Data Corruption**: Data corruption, cross-firm data leakage, or duplicate ledger entries.
- **P1 — Workflow Blocking Defect**: Core user flow broken (e.g. inability to create bill or save payment).
- **P2 — Functional Defect**: Secondary feature broken (e.g. filter date picker issue, table sort error).
- **P3 — Minor Visual / Usability Issue**: Alignment error, minor text clipping on mobile, non-critical layout issue.

> [!CAUTION]
> **NO AUTOMATIC FIXING PROTOCOL:**
> If a bug is discovered, execution for that workflow will STOP. The bug will be documented in `phase-4c-2m-ui-qa-report.md`. Application code or database schema will NOT be edited without explicit user authorization.

---

## 16. Expected Evidence

Upon execution, the QA process will generate:
1. `phase-4c-2m-ui-qa-report.md` summarizing test results.
2. Screenshots of key UI workflows across desktop and mobile viewports saved in artifact media storage.
3. Console and network error logs.
4. Post-cleanup database table row count verification.

---

## 17. Final Acceptance Criteria

- All 15 major UI module workflows pass across Desktop and Mobile viewports.
- 0 P0/P1 defects discovered.
- Complete multi-tenant firm isolation confirmed in UI.
- All numbers on UI surfaces reconcile 100% with backend authoritative accounting services.
- Database row counts for all 12 business tables return to 0 post-cleanup.

---

## HARD STOP

> [!CAUTION]
> **PLANNING COMPLETED — HARD STOP.**
> As per explicit instructions:
> - No application code was modified.
> - No database schema or migrations were altered.
> - No browser test scripts or commands were executed.
> 
> **Awaiting your explicit authorization command: `"APPROVED — EXECUTE PHASE 4C-2M"` to proceed with execution.**
