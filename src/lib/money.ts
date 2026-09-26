// Money is stored and calculated in integer paise (project rule 8). These
// helpers are the only place rupee strings are converted, and they never
// use floating point.

/**
 * Parses a rupee amount typed by a user ("1500", "1,500", "1500.5",
 * "₹ 1,500.50") into paise. Returns null for anything else, including
 * negatives and more than 2 decimal places.
 */
export function parseRupeesToPaise(input: string): number | null {
  const cleaned = input.replace(/[₹,\s]/g, "").replace(/^rs\.?/i, "");
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const rupees = Number(match[1]);
  const paise = Number((match[2] ?? "").padEnd(2, "0"));
  const total = rupees * 100 + paise;
  return Number.isSafeInteger(total) ? total : null;
}

const formatters = {
  whole: new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }),
  fractional: new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
};

/** "₹1,500", "₹1,500.50", "₹1,50,000" (Indian digit grouping). */
export function formatRupees(paise: number): string {
  if (!Number.isInteger(paise)) throw new Error("formatRupees expects integer paise");
  const formatter = paise % 100 === 0 ? formatters.whole : formatters.fractional;
  // Divide only for display; the value is exact to two decimals.
  return formatter.format(paise / 100);
}

/** Paise → the plain value to pre-fill a rupee input ("1500", "1500.50"). */
export function paiseToRupeesInput(paise: number): string {
  const rupees = Math.trunc(paise / 100);
  const rest = paise % 100;
  return rest === 0 ? String(rupees) : `${rupees}.${String(rest).padStart(2, "0")}`;
}
