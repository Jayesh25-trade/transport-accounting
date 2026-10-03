# Tally / BUSY Style Bill PDF & Modal Preview Redesign Progress Log

## Task Summary
Redesigned the Bill PDF template and Bill Invoice Modal preview to match a high-grade professional Tally / BUSY accounting software invoice with a single 190mm ruled outer frame, 2x2 header grid, 11-column ruled item table, ruled totals, summary table, and signature cells.

## Steps Completed
1. **Shared Template Engine (`src/lib/pdf-bill-template.ts`)**:
   - Implemented single outer frame container of width `190mm` with `border: 0.4mm solid #374151` and `box-sizing: border-box`.
   - Title `"TRANSPORT BILL"` centered above frame in brand orange (`#E05638`, `12pt bold`, `letter-spacing: 0.08em`).
   - Embedded local `Noto Sans / Arial` base64 fonts ensuring proper `₹` symbol rendering.
   - Header Row (62% / 38%): Left = Firm name (16pt bold), tagline, address, contact line (ONLY present fields); Right = 2x2 grid (Bill no. plain "3", Bill date, Due date, Payment terms).
   - Bill-To Row (62% / 38%): Left = "BILL TO", party name (as stored), address, GSTIN, phone; Right = Place of supply (`Maharashtra (27)`) / Reverse charge.
   - Item Table (11 columns summing to exactly 100% / 190mm):
     - `Sr` (7mm, 3.6842%), `Date` (19mm, 10.0000%), `Truck` (22mm, 11.5789%), `LR no` (15mm, 7.8947%), `Route` (30mm, 15.7895%), `N-Wt (T)` (14mm, 7.3684%), `R-Wt (T)` (14mm, 7.3684%), `Rate` (16mm, 8.4211%), `Freight` (21mm, 11.0526%), `Short` (12mm, 6.3158%), `Balance` (20mm, 10.5263%).
     - Tally Style: Light grey header fill (`#F3F4F6`), thin vertical rules between columns (`0.2mm #9CA3AF`), NO horizontal lines between body rows, header alignments matching cells (text left, numeric right), Date `nowrap`, Route `Origin → Destination`, bare numbers in cells, Short column shows numbers or neutral `—` (no green, no text "NO").
     - Total Row: Light grey fill (`#F3F4F6`), `0.4mm` top & bottom borders, column totals directly under respective columns.
   - Amount in Words: Full-width ruled row inside frame (`border-bottom: 0.4mm solid #374151`).
   - Lower Section (58% / 42%): Left = Bank details, Terms & Conditions, Payment status (friendly chip); Right = Summary table (Gross freight, Less: shortage/TDS/voucher in red `#B91C1C`, Net Payable in `#FDF1EC` band, balance outstanding).
   - Signature Row (58% / 42%): Left = Receiver's signature (~18mm blank); Right = "For <Firm name>", ~18mm blank, "Authorised signatory".
   - Page Footer: Pinned at page bottom ("Computer-generated bill." left, "Page X of Y" right, no internal IDs).

2. **PDF Service Integration (`src/services/pdf.service.ts`)**:
   - Set `@page` margins: top 10mm, bottom 14mm, left 10mm, right 10mm.
   - Configured page header/footer template printing page numbers cleanly.

3. **On-Screen Modal Preview & Component (`src/components/bills/bill-document-view.tsx` & `src/components/bills/bill-detail-modal.tsx`)**:
   - Redesigned `BillDocumentView` to render the exact same 190mm Tally sheet layout on screen inside an A4-proportioned white sheet over a light grey backdrop (`#F3F4F6`).
   - Fixed header with title `"Bill #<no> · <Party name>"`, buttons `"Download PDF"` (secondary) and `"Print"` (primary), close button X.
   - Accessible modal with focus trap and Escape key listener.

4. **Self-Test & Automated QA Verification (`scripts/qa-bill-visual-test.ts`)**:
   - Verified 190mm grid column width sum = `190mm / 190mm` (100.00%).
   - Automated overflow check: 0 horizontal overflow detected on modal preview or PDF.
   - Rendered real Bill #3 PDF & PNG, and stress-tested with 1, 8, 25, and 60 trip rows, all toggles OFF, and 12-digit numbers.
   - Captured modal preview screenshots at 1440px, 1024px, and 390px.
   - `npm run build`: 56 routes compiled cleanly with 0 TypeScript/build errors.

## Result
ALL REQUIREMENTS SATISFIED. Visual assets and PDFs saved in `ui-qa/bill/`.
