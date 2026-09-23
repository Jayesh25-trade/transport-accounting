/**
 * Safe Financial & Weight Decimal Arithmetic Utilities.
 * Prevents IEEE 754 floating-point inaccuracies (e.g. 0.1 + 0.2 = 0.30000000000000004).
 * All financial values are rounded/formatted to exact scale:
 *   - Money / Currency: 2 decimal places (scale 2)
 *   - Weight (Tons/Kg): 3 decimal places (scale 3)
 *   - Rate / Percentage / Allowance: 4 decimal places (scale 4)
 */

/**
 * Rounds a number to a specific decimal precision using safe scale multiplication.
 */
export function roundToScale(value: number | string, scale: number): number {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return 0;
  const factor = Math.pow(10, scale);
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

/**
 * Safe addition for array of numbers/numeric-strings at given scale.
 */
export function safeAdd(values: (number | string)[], scale: number = 2): number {
  const sum = values.reduce<number>((acc, val) => {
    const num = typeof val === "string" ? parseFloat(val) : val;
    return acc + (isNaN(num) ? 0 : num);
  }, 0);
  return roundToScale(sum, scale);
}

/**
 * Safe subtraction: a - b at given scale.
 */
export function safeSubtract(a: number | string, b: number | string, scale: number = 2): number {
  const numA = typeof a === "string" ? parseFloat(a) : a;
  const numB = typeof b === "string" ? parseFloat(b) : b;
  return roundToScale((isNaN(numA) ? 0 : numA) - (isNaN(numB) ? 0 : numB), scale);
}

/**
 * Safe multiplication: a * b at given scale.
 */
export function safeMultiply(a: number | string, b: number | string, scale: number = 2): number {
  const numA = typeof a === "string" ? parseFloat(a) : a;
  const numB = typeof b === "string" ? parseFloat(b) : b;
  return roundToScale((isNaN(numA) ? 0 : numA) * (isNaN(numB) ? 0 : numB), scale);
}

/**
 * Safe division: a / b at given scale.
 */
export function safeDivide(a: number | string, b: number | string, scale: number = 2): number {
  const numA = typeof a === "string" ? parseFloat(a) : a;
  const numB = typeof b === "string" ? parseFloat(b) : b;
  if (isNaN(numB) || numB === 0) return 0;
  return roundToScale((isNaN(numA) ? 0 : numA) / numB, scale);
}

/**
 * Formats numeric value to fixed string representation matching DB numeric scale.
 */
export function toFixedString(value: number | string, scale: number): string {
  const num = roundToScale(value, scale);
  return num.toFixed(scale);
}

export const MoneyMath = {
  add: (values: (number | string)[]) => safeAdd(values, 2),
  subtract: (a: number | string, b: number | string) => safeSubtract(a, b, 2),
  multiply: (a: number | string, b: number | string) => safeMultiply(a, b, 2),
  divide: (a: number | string, b: number | string) => safeDivide(a, b, 2),
  round: (v: number | string) => roundToScale(v, 2),
  toString: (v: number | string) => toFixedString(v, 2),
};

export const WeightMath = {
  subtract: (nWeight: number | string, rWeight: number | string) => safeSubtract(nWeight, rWeight, 3),
  add: (values: (number | string)[]) => safeAdd(values, 3),
  round: (v: number | string) => roundToScale(v, 3),
  toString: (v: number | string) => toFixedString(v, 3),
};

export const RateMath = {
  multiply: (weight: number | string, rate: number | string) => safeMultiply(weight, rate, 2), // Money result scale 2
  round: (v: number | string) => roundToScale(v, 4),
  toString: (v: number | string) => toFixedString(v, 4),
};
