import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "" || isNaN(Number(amount))) return "—";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date || date === "0000-00-00" || date === "null" || date === "undefined") return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatWeight(tonnes: number | string | null | undefined): string {
  if (tonnes === null || tonnes === undefined || tonnes === "" || isNaN(Number(tonnes))) return "—";
  const num = typeof tonnes === "string" ? parseFloat(tonnes) : tonnes;
  return `${num.toFixed(3)} T`;
}

export function formatStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  const s = String(status).toUpperCase();
  switch (s) {
    case "POSTED":
    case "ISSUED":
      return "Issued";
    case "PENDING":
    case "PENDING CONFIRMATION":
    case "AWAITING":
      return "Pending";
    case "PARTIALLY_PAID":
    case "PARTIALLY PAID":
    case "PARTLY PAID":
      return "Partly paid";
    case "PAID":
      return "Paid";
    case "RECEIVED":
      return "Received";
    case "ACTIVE":
      return "Active";
    case "INACTIVE":
      return "Inactive";
    case "CONFIRMED":
      return "Confirmed";
    default:
      return formatSentenceCase(status);
  }
}

export function formatVoucherTypeLabel(type: string | null | undefined): string {
  if (!type) return "—";
  const t = String(type).toUpperCase().replace(/\s*\((CR|DR)\)/gi, "");
  switch (t) {
    case "TRANSPORTATION_CHARGES_RCM":
      return "Freight bill";
    case "TDS_JOURNAL":
      return "TDS deducted";
    case "DEBIT_NOTE_RCM":
      return "Shortage debit note";
    case "DRIVER_VOUCHER_DEDUCTION":
      return "Driver voucher deduction";
    case "PAYMENT_CASH":
      return "Payment received (Cash)";
    case "PAYMENT_BANK":
      return "Payment received (Bank)";
    case "AGAINST_BILL":
      return "Against bill";
    case "ADVANCE":
      return "Advance";
    case "ADVANCE (PARTIALLY ALLOCATED)":
    case "ADVANCE_PARTIAL":
      return "Advance · Partly allocated";
    case "CASH":
      return "Cash";
    case "BANK":
    case "BANK ACCOUNT":
      return "Bank account";
    default:
      return formatSentenceCase(type);
  }
}

export function formatSentenceCase(val: string | null | undefined): string {
  if (!val || val === "null" || val === "undefined" || val === "NaN" || val === "[object Object]") return "—";
  const clean = String(val).replace(/_/g, " ").trim();
  if (!clean) return "—";
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

export function formatCleanNarration(narration: string | null | undefined): string {
  if (!narration || narration === "null" || narration === "undefined") return "—";
  let text = String(narration);
  text = text.replace(/AGAINST_BILL/g, "against Bill");
  text = text.replace(/TRANSPORTATION_CHARGES_RCM/g, "Freight bill");
  text = text.replace(/TDS_JOURNAL/g, "TDS deducted");
  text = text.replace(/DEBIT_NOTE_RCM/g, "Shortage debit note");
  text = text.replace(/DRIVER_VOUCHER_DEDUCTION/g, "Driver voucher deduction");
  text = text.replace(/Payment Received \(AGAINST_BILL - CASH \(Bill #(\d+)\) Ref #([^)]+)\)/gi, "Payment received, Cash, against Bill #$1 (Ref: $2)");
  text = text.replace(/Payment Received \(AGAINST_BILL - CASH \(Bill #(\d+)\) Ref #NO\)/gi, "Payment received, Cash, against Bill #$1");
  text = text.replace(/Payment Received \(AGAINST_BILL - CASH \(Bill #(\d+)\)\)/gi, "Payment received, Cash, against Bill #$1");
  text = text.replace(/Ref #NO/gi, "");
  return text.trim() || "—";
}

export function formatPlural(count: number, singular: string, plural?: string): string {
  const p = plural || `${singular}s`;
  return `${count} ${count === 1 ? singular : p}`;
}

export function numberToWordsIndian(numInput: number | string): string {
  const amount = typeof numInput === "string" ? parseFloat(numInput) : numInput;
  if (isNaN(amount) || amount === 0) return "Rupees Zero Only";

  const absAmount = Math.abs(amount);
  const rupees = Math.floor(absAmount);
  const paise = Math.round((absAmount - rupees) * 100);

  const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convertChunk(n: number): string {
    if (n === 0) return "";
    if (n < 20) return units[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + units[n % 10] : "");
    return units[Math.floor(n / 100)] + " Hundred" + (n % 100 !== 0 ? " " + convertChunk(n % 100) : "");
  }

  function convertRupees(n: number): string {
    if (n === 0) return "";

    let result = "";
    const crore = Math.floor(n / 10000000);
    n %= 10000000;
    const lakh = Math.floor(n / 100000);
    n %= 100000;
    const thousand = Math.floor(n / 1000);
    n %= 1000;
    const remainder = n;

    if (crore > 0) result += convertChunk(crore) + " Crore ";
    if (lakh > 0) result += convertChunk(lakh) + " Lakh ";
    if (thousand > 0) result += convertChunk(thousand) + " Thousand ";
    if (remainder > 0) result += convertChunk(remainder);

    return result.trim();
  }

  const words = convertRupees(rupees);
  let finalStr = words ? `Rupees ${words}` : "Rupees Zero";

  if (paise > 0) {
    finalStr += ` and ${convertChunk(paise)} Paise`;
  }

  return finalStr + " Only";
}
