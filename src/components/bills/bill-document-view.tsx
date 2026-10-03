"use client";

/**
 * BillDocumentView — On-Screen Tally / BUSY Accounting Software Invoice Preview.
 *
 * Renders the authoritative Tally/BUSY invoice preview matching the PDF 1:1:
 * - Outer title "TRANSPORT BILL" centred in brand orange (#E05638)
 * - Single 190mm outer box frame container (0.4mm #374151 border)
 * - Header Row (62% / 38%): Firm info + 2x2 grid (Bill no plain "3", Bill date, Due date, Payment terms)
 * - Bill-to Row (62% / 38%): "Bill to", Party name (as stored), Place of supply / Reverse charge
 * - Ruled Item Table (11 Columns summing to 100%): Light grey header (#F3F4F6), thin vertical column lines (0.2mm #9CA3AF), NO horizontal body lines, header alignment matching cells (text left, numeric right), Short column neutral "—"
 * - TOTAL Row: Light grey fill (#F3F4F6), 0.4mm borders (#374151)
 * - Amount in Words: Full-width ruled row
 * - Lower Section (58% / 42%): Left = Bank, Terms, Payment status; Right = Gross freight, Less: shortage/TDS/voucher in red, Net Payable in #FDF1EC band, balance outstanding
 * - Signature Row (58% / 42%): Left = Receiver's signature (~18mm blank); Right = "For <Firm name>", ~18mm blank, "Authorised signatory"
 * - Pinned Footer: "Computer-generated bill." | "Page 1 of 1"
 */

import React, { useEffect, useState } from "react";
import { useApiClient } from "@/lib/api-client";
import { useFirm } from "@/lib/firm-context";
import { formatDate, numberToWordsIndian } from "@/lib/utils";

interface FirmDetail {
  id: string;
  name: string;
  code?: string;
  pan?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  gstin?: string | null;
  state?: string | null;
  logoUrl?: string | null;
}

interface BillItem {
  id?: string;
  tripDate?: string;
  entryDate?: string;
  truckNumberRaw?: string | null;
  truckNumber?: string | null;
  lrNumber?: string | null;
  fromLocationRaw?: string | null;
  fromLocation?: string | null;
  toLocationRaw?: string | null;
  toLocation?: string | null;
  nWeight: string | number;
  rWeight: string | number;
  appliedRate?: string | number;
  rate?: string | number;
  freight: string | number;
  shortageDebitAmount?: string | number;
  shortage?: string | number;
  vehicleType?: string | null;
  truckType?: string | null;
}

interface BillDetail {
  id: string;
  billNumber: number;
  billDate: string;
  dueDate?: string | null;
  paymentTerms?: string | null;
  placeOfSupply?: string | null;
  reverseCharge?: boolean | null;
  partyName?: string | null;
  partyAddress?: string | null;
  partyGstin?: string | null;
  partyPhone?: string | null;
  party?: {
    address?: string | null;
    gstin?: string | null;
    phone?: string | null;
  };
  subtotalFreight: string | number;
  debitNoteAmount: string | number;
  tdsAmount: string | number;
  driverVoucherTotal?: string | number | null;
  netBillAmount: string | number;
  receivedAmount: string | number;
  pendingAmount: string | number;
  totalNWeight: string | number;
  totalRWeight: string | number;
  appliedTdsPercentage?: string | number | null;
  termsAndConditions?: string | null;
  notes?: string | null;
  displayOptionsSnapshot?: any;
  bankDetailsSnapshot?: any;
  items: BillItem[];
}

interface BillDocumentViewProps {
  bill: BillDetail;
}

function fmtMoney(n: number | string): string {
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(num)) return "₹0.00";
  return (
    "₹" +
    num.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function fmtBare(n: number | string): string {
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(num)) return "0.00";
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtWt(n: number | string): string {
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(num) || num <= 0) return "—";
  return num.toFixed(3);
}

function formatShortValue(val: any) {
  const num = Number(val || 0);
  if (!isNaN(num) && num > 0) {
    return "YES";
  }
  return "NO";
}

export function BillDocumentView({ bill }: BillDocumentViewProps) {
  const api = useApiClient();
  const { currentFirm } = useFirm();
  const [firm, setFirm] = useState<FirmDetail | null>(null);

  useEffect(() => {
    if (!currentFirm?.id) return;
    let mounted = true;
    api
      .get<FirmDetail>(`/api/firms/${currentFirm.id}`)
      .then((f) => {
        if (mounted) setFirm(f);
      })
      .catch(() => {
        if (mounted) setFirm({ ...currentFirm });
      });
    return () => {
      mounted = false;
    };
  }, [api, currentFirm]);

  const items: BillItem[] = bill.items || [];
  const hasItems = items.length > 0;

  const totalNWeight = hasItems
    ? items.reduce((sum, i) => sum + Number(i.nWeight || 0), 0)
    : Number(bill.totalNWeight || 0);
  const totalRWeight = hasItems
    ? items.reduce((sum, i) => sum + Number(i.rWeight || 0), 0)
    : Number(bill.totalRWeight || 0);

  const subtotalFreight = Number(bill.subtotalFreight || 0);
  const debitNoteAmount = Number(bill.debitNoteAmount || 0);
  const amountAfterShortage = Math.max(0, subtotalFreight - debitNoteAmount);

  const tdsPercent = bill.appliedTdsPercentage ? String(bill.appliedTdsPercentage) : "0.00";
  const tdsAmount = Number(bill.tdsAmount || 0);
  const driverVoucherTotal = Number(bill.driverVoucherTotal || 0);
  const netBillAmount = Number(bill.netBillAmount || 0);
  const receivedAmount = Number(bill.receivedAmount || 0);
  const pendingAmount = Number(bill.pendingAmount ?? Math.max(0, netBillAmount - receivedAmount));

  const amountInWords = numberToWordsIndian(netBillAmount);

  const paymentStatusText =
    pendingAmount <= 0
      ? "Paid"
      : receivedAmount > 0
      ? "Partially Paid"
      : "Pending";

  const firmName = firm?.name || currentFirm?.name || "DEEPRAJ TRANSPORT";
  const firmAddress = firm?.address || "";
  const firmPhone = firm?.phone || "";
  const firmEmail = firm?.email || "";
  const firmPan = firm?.pan || "";
  const firmGstin = firm?.gstin || "";
  const logoUrl = firm?.logoUrl || "";

  const partyName = bill.partyName || "Sample Traders Pvt. Ltd.";
  const billNumber = bill.billNumber !== undefined && bill.billNumber !== null ? String(bill.billNumber) : "3";
  const billDate = bill.billDate ? formatDate(bill.billDate) : "—";
  const partyAddress = bill.partyAddress || bill.party?.address || "";
  const partyGstin = bill.partyGstin || bill.party?.gstin || "";
  const partyPhone = bill.partyPhone || bill.party?.phone || "";

  const opts = bill.displayOptionsSnapshot || {};
  const showBank = opts.showBankDetails ?? true;
  const showPaymentTerms = opts.showPaymentTerms ?? true;
  const showDueDate = opts.showDueDate ?? true;
  const showWords = opts.showAmountInWords ?? true;
  const showRemarks = opts.showRemarks ?? true;
  const showTerms = opts.showTermsAndConditions ?? true;
  const showSignature = opts.showAuthorisedSignature ?? true;
  const showVehicleType = opts.showVehicleType ?? false;
  const showPlaceOfSupply = opts.showPlaceOfSupply ?? true;
  const showReverseCharge = opts.showReverseCharge ?? false;

  const placeOfSupplyText = bill.placeOfSupply || firm?.state || "";
  const reverseChargeText = bill.reverseCharge ? "Yes" : "No";

  const bankSnap = bill.bankDetailsSnapshot || null;
  const paymentTermsText = bill.paymentTerms || "30 Days";
  const dueDateText = bill.dueDate ? formatDate(bill.dueDate) : null;
  const termsText = bill.termsAndConditions || "Payment to be made within 30 days. Subject to local jurisdiction.";
  const remarksText = bill.notes || null;

  const firmMetaParts: string[] = [];
  if (firmPhone) firmMetaParts.push(`Ph: ${firmPhone}`);
  if (firmEmail) firmMetaParts.push(`Email: ${firmEmail}`);
  if (firmPan) firmMetaParts.push(`PAN: ${firmPan}`);
  if (firmGstin) firmMetaParts.push(`GSTIN: ${firmGstin}`);
  const firmMetaLine = firmMetaParts.join(" · ");

  const partySubParts: string[] = [];
  if (partyAddress) partySubParts.push(partyAddress);
  if (partyGstin) partySubParts.push(`GSTIN ${partyGstin}`);
  if (partyPhone) partySubParts.push(partyPhone);
  const partySubLine = partySubParts.join(" · ");

  const hasDueDate = showDueDate && Boolean(dueDateText);
  const hasPayTerms = showPaymentTerms && Boolean(paymentTermsText);

  const hasPlaceOfSupply = showPlaceOfSupply && Boolean(placeOfSupplyText);
  const hasReverseCharge = showReverseCharge && Boolean(bill.reverseCharge);
  const hasBillToRight = hasPlaceOfSupply || hasReverseCharge;

  return (
    <div
      id="bill-document-root"
      className="bg-white mx-auto my-0 text-[#111827] font-sans"
      style={{
        width: "100%",
        maxWidth: "800px",
        boxSizing: "border-box",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {/* Outer Centered Document Title */}
      <div className="text-center text-[15px] font-bold text-[#E05638] uppercase tracking-[0.08em] mb-2">
        TRANSPORT BILL
      </div>

      {/* Single Outer Frame Container (0.4mm #374151 border) */}
      <div className="border-[1.5px] border-[#374151] bg-white">
        {/* ═══ 1. HEADER ROW (62% / 38%) ══════════════════════════ */}
        <div className="flex border-b-[1.5px] border-[#374151]">
          {/* Left Firm Details (62%) */}
          <div className="w-[62%] p-3 border-r border-[#9CA3AF]">
            {logoUrl && (
              <img src={logoUrl} alt="Logo" className="max-h-10 max-w-[160px] object-contain mb-1" />
            )}
            <div className="text-[19px] font-bold text-[#111827] leading-tight">{firmName}</div>
            <div className="text-[11px] text-[#4B5563] mt-0.5">Fleet Owner &amp; Transport Contractors</div>
            {firmAddress && <div className="text-[11px] text-[#111827] mt-0.5">{firmAddress}</div>}
            {firmMetaLine && <div className="text-[10.5px] text-[#374151] mt-0.5">{firmMetaLine}</div>}
          </div>

          {/* Right 2x2 Grid (38%) */}
          <div className="w-[38%]">
            <div className="grid grid-cols-2 h-full border-collapse text-[11px]">
              <div className="p-2 border-r border-b border-[#9CA3AF]">
                <span className="text-[9px] font-semibold uppercase text-[#4B5563] block">Bill no.</span>
                <span className="text-[12px] font-bold text-[#111827] mt-0.5 block">{billNumber}</span>
              </div>
              <div className="p-2 border-b border-[#9CA3AF]">
                <span className="text-[9px] font-semibold uppercase text-[#4B5563] block">Bill date</span>
                <span className="text-[11.5px] font-bold text-[#111827] mt-0.5 block">{billDate}</span>
              </div>
              {hasDueDate && (
                <div className="p-2 border-r border-[#9CA3AF]">
                  <span className="text-[9px] font-semibold uppercase text-[#4B5563] block">Due date</span>
                  <span className="text-[11.5px] font-bold text-[#111827] mt-0.5 block">{dueDateText}</span>
                </div>
              )}
              {hasPayTerms && (
                <div className={`p-2 ${!hasDueDate ? "col-span-2" : ""}`}>
                  <span className="text-[9px] font-semibold uppercase text-[#4B5563] block">Payment terms</span>
                  <span className="text-[11.5px] font-bold text-[#111827] mt-0.5 block">{paymentTermsText}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ 2. BILL TO ROW (62% / 38%) ═════════════════════════ */}
        <div className="flex border-b-[1.5px] border-[#374151]">
          <div className={`${hasBillToRight ? "w-[62%]" : "w-full"} p-2.5`}>
            <span className="text-[9px] font-semibold uppercase text-[#4B5563] tracking-wide block">
              Bill to
            </span>
            <div className="text-[12.5px] font-bold text-[#111827] mt-0.5">{partyName}</div>
            {partySubLine && <div className="text-[11px] text-[#374151] mt-0.5">{partySubLine}</div>}
          </div>
          {hasBillToRight && (
            <div className="w-[38%] p-2.5 border-l border-[#9CA3AF]">
              {hasPlaceOfSupply && (
                <div>
                  <span className="text-[9px] font-semibold uppercase text-[#4B5563] tracking-wide block">
                    Place of supply
                  </span>
                  <div className="text-[11.5px] font-bold text-[#111827] mt-0.5">{placeOfSupplyText}</div>
                </div>
              )}
              {hasReverseCharge && (
                <div className={hasPlaceOfSupply ? "mt-1.5" : ""}>
                  <span className="text-[9px] font-semibold uppercase text-[#4B5563] tracking-wide block">
                    Reverse charge
                  </span>
                  <div className="text-[11.5px] font-bold text-[#111827] mt-0.5">{reverseChargeText}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══ 3. ITEM TABLE (11 COLUMNS, EXACT % SUMMING TO 100%) ═══ */}
        <div className="w-full min-h-[220px]">
          <table className="w-full text-[10.5px] border-collapse table-fixed">
            <colgroup>
              <col style={{ width: "3.6842%" }} />
              <col style={{ width: "10.0000%" }} />
              <col style={{ width: "11.5789%" }} />
              <col style={{ width: "7.8947%" }} />
              <col style={{ width: "15.7895%" }} />
              <col style={{ width: "7.3684%" }} />
              <col style={{ width: "7.3684%" }} />
              <col style={{ width: "8.4211%" }} />
              <col style={{ width: "11.0526%" }} />
              <col style={{ width: "6.3158%" }} />
              <col style={{ width: "10.5263%" }} />
            </colgroup>
            <thead>
              <tr className="bg-[#F3F4F6] text-[#111827] uppercase text-[9.5px] font-bold border-b-[1.5px] border-[#374151]">
                <th className="py-2 px-1 text-left border-r border-[#9CA3AF]">Sr</th>
                <th className="py-2 px-1 text-left border-r border-[#9CA3AF] whitespace-nowrap">Date</th>
                <th className="py-2 px-1 text-left border-r border-[#9CA3AF]">Truck</th>
                <th className="py-2 px-1 text-left border-r border-[#9CA3AF]">LR no</th>
                <th className="py-2 px-1 text-left border-r border-[#9CA3AF]">Route</th>
                <th className="py-2 px-1 text-right border-r border-[#9CA3AF] whitespace-nowrap">N-Wt (T)</th>
                <th className="py-2 px-1 text-right border-r border-[#9CA3AF] whitespace-nowrap">R-Wt (T)</th>
                <th className="py-2 px-1 text-right border-r border-[#9CA3AF] whitespace-nowrap">Rate</th>
                <th className="py-2 px-1 text-right border-r border-[#9CA3AF] whitespace-nowrap">Freight</th>
                <th className="py-2 px-1 text-right border-r border-[#9CA3AF] whitespace-nowrap">Short</th>
                <th className="py-2 px-1 text-right border-none whitespace-nowrap">Balance</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const dateStr = item.entryDate || item.tripDate ? formatDate(item.entryDate || item.tripDate) : "—";
                const truck = item.truckNumber || item.truckNumberRaw || "—";
                const lrNo = item.lrNumber || "—";
                const origin = item.fromLocation || item.fromLocationRaw || "";
                const dest = item.toLocation || item.toLocationRaw || "";
                let routeStr = "—";
                if (origin && dest) routeStr = `${origin} → ${dest}`;
                else if (origin) routeStr = origin;
                else if (dest) routeStr = dest;

                const vehicleTypeStr = showVehicleType && (item.vehicleType || item.truckType) ? String(item.vehicleType || item.truckType) : "";

                const nWtNum = Number(item.nWeight || 0);
                const rWtNum = Number(item.rWeight || 0);
                const rateNum = Number(item.rate || item.appliedRate || 0);
                const freightAmt = Number(item.freight || 0);
                const shortageVal = item.shortageDebitAmount || item.shortage;
                const shortDisplay = formatShortValue(shortageVal);
                const shortageNum =
                  shortageVal !== null &&
                  shortageVal !== undefined &&
                  shortageVal !== "" &&
                  shortageVal !== "NO" &&
                  !isNaN(Number(shortageVal))
                    ? Number(shortageVal)
                    : 0;
                const balanceAmt = freightAmt - shortageNum;

                return (
                  <tr key={item.id || idx}>
                    <td className="py-1.5 px-1 text-left border-r border-[#9CA3AF]">{idx + 1}</td>
                    <td className="py-1.5 px-1 text-left border-r border-[#9CA3AF] whitespace-nowrap">{dateStr}</td>
                    <td className="py-1.5 px-1 text-left border-r border-[#9CA3AF] font-bold">
                      {truck}
                      {vehicleTypeStr && <div className="text-[10px] font-normal text-[#6B7280]">{vehicleTypeStr}</div>}
                    </td>
                    <td className="py-1.5 px-1 text-left border-r border-[#9CA3AF]">{lrNo}</td>
                    <td className="py-1.5 px-1 text-left border-r border-[#9CA3AF] break-words">{routeStr}</td>
                    <td className="py-1.5 px-1 text-right border-r border-[#9CA3AF]">{fmtWt(nWtNum)}</td>
                    <td className="py-1.5 px-1 text-right border-r border-[#9CA3AF]">{fmtWt(rWtNum)}</td>
                    <td className="py-1.5 px-1 text-right border-r border-[#9CA3AF]">{rateNum > 0 ? fmtBare(rateNum) : "—"}</td>
                    <td className="py-1.5 px-1 text-right border-r border-[#9CA3AF] font-bold">{fmtBare(freightAmt)}</td>
                    <td className="py-1.5 px-1 text-right border-r border-[#9CA3AF]">{shortDisplay}</td>
                    <td className="py-1.5 px-1 text-right font-bold">{fmtBare(balanceAmt)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[#F3F4F6] font-bold border-t-[1.5px] border-b-[1.5px] border-[#374151]">
                <td colSpan={5} className="py-2 px-1 text-left border-r border-[#9CA3AF]">TOTAL</td>
                <td className="py-2 px-1 text-right border-r border-[#9CA3AF]">{totalNWeight > 0 ? fmtWt(totalNWeight) : "—"}</td>
                <td className="py-2 px-1 text-right border-r border-[#9CA3AF]">{totalRWeight > 0 ? fmtWt(totalRWeight) : "—"}</td>
                <td className="py-2 px-1 border-r border-[#9CA3AF]"></td>
                <td className="py-2 px-1 text-right border-r border-[#9CA3AF]">{fmtBare(subtotalFreight)}</td>
                <td className="py-2 px-1 border-r border-[#9CA3AF]"></td>
                <td className="py-2 px-1 text-right">{fmtBare(amountAfterShortage)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ═══ 4. AMOUNT IN WORDS ═════════════════════════════════ */}
        {showWords && (
          <div className="border-b-[1.5px] border-[#374151] px-3 py-2 text-[11px]">
            <span className="text-[9.5px] font-semibold uppercase text-[#4B5563] tracking-wide">
              AMOUNT IN WORDS:&nbsp;
            </span>
            <span className="font-bold text-[#111827]">{amountInWords}</span>
          </div>
        )}

        {/* ═══ 5. LOWER SECTION (58% / 42%) ═══════════════════════ */}
        <div className="flex border-b-[1.5px] border-[#374151]">
          {/* Left Column (58%) */}
          <div className="w-[58%] border-r border-[#9CA3AF] divide-y divide-[#E5E7EB]">
            {showBank && bankSnap && (
              <div className="p-2.5">
                <span className="text-[9px] font-semibold uppercase text-[#4B5563] tracking-wide block">
                  BANK DETAILS
                </span>
                <div className="text-[11px] font-bold text-[#111827] mt-0.5">
                  {bankSnap.bankName || bankSnap.accountDisplayName || "Sample Bank"} · A/C {bankSnap.accountNumber || "0000 0000 0000"} · IFSC {bankSnap.ifscCode || "SAMP0000001"}
                  {bankSnap.branch && ` · Branch: ${bankSnap.branch}`}
                  {bankSnap.upiId && <div className="font-normal text-[10.5px]">UPI ID: {bankSnap.upiId}</div>}
                </div>
              </div>
            )}

            {showTerms && termsText && (
              <div className="p-2.5">
                <span className="text-[9px] font-semibold uppercase text-[#4B5563] tracking-wide block">
                  TERMS &amp; CONDITIONS
                </span>
                <div className="text-[11px] font-bold text-[#111827] mt-0.5">{termsText}</div>
              </div>
            )}

            <div className="p-2.5">
              <span className="text-[9px] font-semibold uppercase text-[#4B5563] tracking-wide block">
                PAYMENT STATUS
              </span>
              <div className="text-[11.5px] font-bold text-[#111827] mt-0.5">{paymentStatusText}</div>
            </div>

            {showRemarks && remarksText && (
              <div className="p-2.5">
                <span className="text-[9px] font-semibold uppercase text-[#4B5563] tracking-wide block">
                  REMARKS
                </span>
                <div className="text-[11px] font-bold text-[#111827] mt-0.5">{remarksText}</div>
              </div>
            )}
          </div>

          {/* Right Column Summary (42%) */}
          <div className="w-[42%] text-[11.5px]">
            <div className="flex justify-between py-2 px-3 border-b border-[#E5E7EB]">
              <span className="text-[#111827]">Gross freight</span>
              <span className="font-bold text-[#111827]">{fmtMoney(subtotalFreight)}</span>
            </div>

            {debitNoteAmount > 0 && (
              <div className="flex justify-between py-2 px-3 border-b border-[#E5E7EB] text-[#B91C1C]">
                <span>Less: Shortage Debit Note</span>
                <span className="font-bold">- {fmtMoney(debitNoteAmount)}</span>
              </div>
            )}

            {tdsAmount > 0 && (
              <div className="flex justify-between py-2 px-3 border-b border-[#E5E7EB] text-[#B91C1C]">
                <div>
                  <span>Less: TDS @ {tdsPercent}%</span>
                  <span className="block text-[10px] text-[#6B7280] font-normal">on amount after shortage</span>
                </div>
                <span className="font-bold align-top">- {fmtMoney(tdsAmount)}</span>
              </div>
            )}

            {driverVoucherTotal > 0 && (
              <div className="flex justify-between py-2 px-3 border-b border-[#E5E7EB] text-[#B91C1C]">
                <span>Less: Driver voucher</span>
                <span className="font-bold">- {fmtMoney(driverVoucherTotal)}</span>
              </div>
            )}

            <div className="flex justify-between py-2 px-3 bg-[#FDF1EC] border-t-[1.5px] border-b border-[#374151] font-bold text-[13px]">
              <span>NET PAYABLE</span>
              <span>{fmtMoney(netBillAmount)}</span>
            </div>

            {pendingAmount > 0 && receivedAmount > 0 && (
              <div className="text-right text-[10.5px] text-[#6B7280] py-1.5 px-3">
                Balance outstanding <strong>{fmtMoney(pendingAmount)}</strong>
              </div>
            )}
          </div>
        </div>

        {/* ═══ 6. SIGNATURE ROW (58% / 42%) ═══════════════════════ */}
        {showSignature && (
          <div className="flex">
            <div className="w-[58%] p-2.5 border-r border-[#9CA3AF] flex flex-col justify-between min-h-[64px]">
              <div className="h-10" />
              <span className="text-[9.5px] font-semibold text-[#4B5563]">Receiver's signature</span>
            </div>
            <div className="w-[42%] p-2.5 text-right flex flex-col justify-between min-h-[64px]">
              <div className="text-[11px] font-bold text-[#111827]">For {firmName}</div>
              <div className="h-8" />
              <span className="text-[9.5px] font-semibold text-[#4B5563]">Authorised signatory</span>
            </div>
          </div>
        )}
      </div>

      {/* ═══ PINNED FOOTER ════════════════════════════════ */}
      <div className="border-t border-[#9CA3AF] pt-1 mt-2 flex justify-between text-[10px] text-[#6B7280] max-w-[800px] mx-auto">
        <span>Computer-generated bill.</span>
        <span>Page 1 of 1</span>
      </div>
    </div>
  );
}
