// Report aggregation. Pure; amounts in paise; dates are IST.
import { addDays, isIsoDate } from "./dates";

export type PaymentRow = {
  amount_paise: number; // negative for reversals
  mode: "CASH" | "UPI" | "CARD" | "OTHER";
  received_by: string | null;
  kind: "PAYMENT" | "REVERSAL";
};

export type CollectionSummary = {
  total: number;
  count: number;
  reversals: number;
  byMode: { mode: PaymentRow["mode"]; amount: number }[];
  byStaff: { userId: string | null; amount: number; count: number }[];
};

const MODE_ORDER: PaymentRow["mode"][] = ["CASH", "UPI", "CARD", "OTHER"];

/** Net collections (payments minus reversals) by mode and by staff member. */
export function summarizeCollections(rows: PaymentRow[]): CollectionSummary {
  const byMode = new Map<PaymentRow["mode"], number>();
  const byStaff = new Map<string | null, { amount: number; count: number }>();
  let total = 0;
  let count = 0;
  let reversals = 0;
  for (const r of rows) {
    total += r.amount_paise;
    if (r.kind === "PAYMENT") count++;
    else reversals++;
    byMode.set(r.mode, (byMode.get(r.mode) ?? 0) + r.amount_paise);
    const s = byStaff.get(r.received_by) ?? { amount: 0, count: 0 };
    s.amount += r.amount_paise;
    if (r.kind === "PAYMENT") s.count++;
    byStaff.set(r.received_by, s);
  }
  return {
    total,
    count,
    reversals,
    byMode: MODE_ORDER.filter((m) => byMode.has(m)).map((mode) => ({
      mode,
      amount: byMode.get(mode)!,
    })),
    byStaff: [...byStaff]
      .map(([userId, s]) => ({ userId, ...s }))
      .sort((a, b) => b.amount - a.amount),
  };
}

export type DiscountRow = { updatedBy: string | null; amount: number };

/** Discounts given, grouped by who set them. */
export function summarizeDiscounts(rows: DiscountRow[]) {
  const by = new Map<string | null, { amount: number; count: number }>();
  for (const r of rows) {
    const s = by.get(r.updatedBy) ?? { amount: 0, count: 0 };
    s.amount += r.amount;
    s.count++;
    by.set(r.updatedBy, s);
  }
  return {
    total: rows.reduce((s, r) => s + r.amount, 0),
    count: rows.length,
    byStaff: [...by].map(([userId, s]) => ({ userId, ...s })).sort((a, b) => b.amount - a.amount),
  };
}

/**
 * A date range from query params, defaulting to the 1st of this month →
 * today, and never longer than a year or ending in the future.
 */
export function resolveRange(
  fromRaw: string | undefined,
  toRaw: string | undefined,
  today: string,
): { from: string; to: string } {
  let to = toRaw && isIsoDate(toRaw) ? toRaw : today;
  if (to > today) to = today;
  let from = fromRaw && isIsoDate(fromRaw) ? fromRaw : `${today.slice(0, 8)}01`;
  if (from > to) from = to;
  if (from < addDays(to, -366)) from = addDays(to, -366);
  return { from, to };
}

/** Timestamp bounds covering whole IST days [from, to]. */
export function istDayBounds(from: string, to: string): { gte: string; lt: string } {
  return { gte: `${from}T00:00:00+05:30`, lt: `${addDays(to, 1)}T00:00:00+05:30` };
}
