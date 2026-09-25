import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatWeight(kg: number | string): string {
  const num = typeof kg === "string" ? parseFloat(kg) : kg;
  return `${num.toFixed(2)} KG`;
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
