export interface CleanedLedgerRow {
  dateFormatted: string;
  title: string;
  narration: string | null;
  voucherTypeLabel: string;
  voucherNumber: string;
  debitFormatted: string;
  creditFormatted: string;
  balanceFormatted: string;
  debitRaw: number;
  creditRaw: number;
  balanceRaw: number;
}

/**
 * Clean up raw values or placeholders like "NO", "N/A", "null", "undefined", "dasd".
 */
export function sanitizeText(val?: string | null): string | null {
  if (!val) return null;
  const trimmed = val.trim();
  const lower = trimmed.toLowerCase();
  if (
    !trimmed ||
    lower === "no" ||
    lower === "n/a" ||
    lower === "null" ||
    lower === "undefined" ||
    lower === "dasd" ||
    lower === "ref #no" ||
    lower === "ref #null" ||
    lower === "ref #undefined" ||
    lower === "ref no" ||
    lower === "ref null"
  ) {
    return null;
  }
  return trimmed;
}

/**
 * Strip all unwanted symbols (#, ₹, -, –, brackets) from titles and narrations.
 */
export function stripSymbols(text: string): string {
  return text
    .replace(/[#₹\(\)]/g, "") // Remove #, ₹, and parentheses ()
    .replace(/–|-/g, " ")     // Replace dashes with space
    .replace(/\s+/g, " ")     // Collapse multiple spaces
    .trim();
}

/**
 * Format Indian currency with 2 decimal places.
 */
export function formatIndianCurrency(amount: number): string {
  const absVal = Math.abs(amount);
  return absVal.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format date string to "DD Mon YYYY" (e.g., "02 Oct 2026")
 */
export function formatLedgerDate(dateStr?: string | Date | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return String(dateStr);
  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "short" });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Map raw voucher types to user-friendly display labels without symbols.
 */
export function getVoucherTypeLabel(voucherType?: string | null): string {
  if (!voucherType) return "";
  switch (voucherType) {
    case "TRANSPORTATION_CHARGES_RCM":
      return "Transport Charges";
    case "TDS_JOURNAL":
      return "TDS Journal";
    case "DEBIT_NOTE_RCM":
      return "Debit Note";
    case "DRIVER_VOUCHER_DEDUCTION":
      return "Driver Deduction";
    case "PAYMENT_CASH":
      return "Payment Cash";
    case "PAYMENT_BANK":
      return "Payment Bank";
    case "ADVANCE_RECEIPT":
      return "Advance Receipt";
    case "OPENING_BALANCE":
      return "Opening Balance";
    case "ADJUSTMENT":
      return "Adjustment";
    default:
      return voucherType
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}

/**
 * Cleans particulars and extracts a clean Title and Narration strictly adhering to Black & White symbol-free rules.
 */
export function cleanParticulars(
  particulars?: string | null,
  voucherType?: string | null,
  voucherNumber?: string | null
): { title: string; narration: string | null } {
  const raw = particulars || "";
  let title = "";
  let narration: string | null = null;

  // 1. Identify base title without brackets or symbols
  const vType = voucherType || "";
  if (vType === "TRANSPORTATION_CHARGES_RCM" || raw.includes("Transportation Charges")) {
    title = "Transportation Charges RCM";
  } else if (vType === "TDS_JOURNAL" || raw.includes("TDS")) {
    if (raw.includes("94C") || raw.includes("Sec 94C") || raw.includes("Contract")) {
      title = "TDS on Contract 94C";
    } else {
      title = "TDS Journal";
    }
  } else if (vType === "DEBIT_NOTE_RCM" || raw.includes("Shortage") || raw.includes("Debit Note")) {
    title = "Shortage Debit Note RCM";
  } else if (vType === "DRIVER_VOUCHER_DEDUCTION" || raw.includes("Driver Voucher")) {
    title = "Driver Voucher Deduction";
  } else if (vType === "PAYMENT_CASH") {
    title = "Payment Received Cash";
  } else if (vType === "PAYMENT_BANK") {
    title = "Payment Received Bank";
  } else if (vType === "ADVANCE_RECEIPT") {
    title = "Advance Received";
  } else if (vType === "OPENING_BALANCE") {
    title = "Opening Balance";
  } else {
    // Fallback: clean title from raw text by stripping parenthetical noise
    const cleanRaw = raw.replace(/\(.*?\)/g, "").trim();
    title = stripSymbols(cleanRaw || getVoucherTypeLabel(vType) || "Transaction");
  }

  // 2. Extract Narration line without # symbol
  // Rule A: Against Bill reference -> "Against Bill 1"
  if (raw.toLowerCase().includes("against") || raw.includes("AGAINST_BILL")) {
    const match = raw.match(/(?:Against\s+Bill|AGAINST_BILL)[^\d#]*#?\s*([A-Za-z0-9\-_]+)/i);
    if (match && match[1] && sanitizeText(match[1])) {
      narration = `Against Bill ${match[1].replace(/^#/, "")}`;
    }
  }

  // Rule B: Specific Bill reference -> "Bill 1"
  if (!narration) {
    const match = raw.match(/\bBill\s*#?\s*([A-Za-z0-9\-_]+)/i);
    if (match && match[1] && sanitizeText(match[1])) {
      narration = `Bill ${match[1].replace(/^#/, "")}`;
    }
  }

  // Rule C: Advance reference -> "Advance"
  if (!narration && raw.toLowerCase().includes("advance")) {
    narration = "Advance";
  }

  // Rule D: Ref reference -> "Ref DN-1"
  if (!narration && (raw.includes("Ref #") || raw.includes("Ref:") || raw.includes("Ref "))) {
    const match = raw.match(/\bRef\s*[:#]?\s*([A-Za-z0-9\-_]+)/i);
    if (match && match[1] && sanitizeText(match[1])) {
      narration = `Ref ${match[1]}`;
    }
  }

  // Rule E: Debit note voucher number fallback -> "Ref DN-1"
  if (!narration && vType === "DEBIT_NOTE_RCM" && voucherNumber && sanitizeText(voucherNumber)) {
    narration = `Ref ${voucherNumber}`;
  }

  // Rule F: Custom note or reference inside parentheses (excluding system codes)
  if (!narration) {
    const match = raw.match(/\(([^)]+)\)/);
    if (match && match[1]) {
      const inner = match[1];
      if (
        !inner.includes("AGAINST_BILL") &&
        !inner.includes("PAYMENT") &&
        !inner.includes("TRANSPORTATION_CHARGES") &&
        sanitizeText(inner)
      ) {
        narration = stripSymbols(inner.trim());
      }
    }
  }

  // Final check: sanitize and strip #, ₹, brackets
  if (narration) {
    narration = sanitizeText(stripSymbols(narration));
  }

  // Truncate narration at 80 characters max
  if (narration && narration.length > 80) {
    narration = narration.substring(0, 77) + "...";
  }

  return { title: stripSymbols(title), narration };
}

/**
 * Processes a single ledger transaction for Black & White PDF table output.
 */
export function cleanLedgerRow(transaction: any): CleanedLedgerRow {
  const dr = Number(transaction.debitAmount || 0);
  const cr = Number(transaction.creditAmount || 0);
  const bal = Number(transaction.runningBalance || 0);

  const rawVchNo = sanitizeText(transaction.voucherNumber);
  const vchNo = rawVchNo ? stripSymbols(rawVchNo) : "";

  const { title, narration } = cleanParticulars(
    transaction.particulars,
    transaction.voucherType,
    transaction.voucherNumber
  );

  const dateFormatted = formatLedgerDate(transaction.transactionDate);
  const voucherTypeLabel = getVoucherTypeLabel(transaction.voucherType);

  // Empty cells stay completely blank (no dashes!)
  const debitFormatted = dr > 0 ? formatIndianCurrency(dr) : "";
  const creditFormatted = cr > 0 ? formatIndianCurrency(cr) : "";

  const balSuffix = bal >= 0 ? "Cr" : "Dr";
  const balanceFormatted = `${formatIndianCurrency(Math.abs(bal))} ${balSuffix}`;

  return {
    dateFormatted,
    title,
    narration,
    voucherTypeLabel,
    voucherNumber: vchNo,
    debitFormatted,
    creditFormatted,
    balanceFormatted,
    debitRaw: dr,
    creditRaw: cr,
    balanceRaw: bal,
  };
}
