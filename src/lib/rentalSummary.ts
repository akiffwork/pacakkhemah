// src/lib/rentalSummary.ts
// One view of "what is being rented" — items, add-ons, free items and the
// price rows — built from the order's cart snapshot. Used by the vendor's
// order details, the customer's rental agreement page and the agreement PDF,
// so all three show the cart exactly as the customer saw it.

import { itemLineTotal, priceBreakdown, type Order, type OrderItem, type PriceRow } from "./orderFlow";

export type SummaryInclude = { qty: number; name: string; variantLabel?: string; variantColor?: string | null };

export type SummaryLine = {
  name: string;
  qty: number;
  /** Line total for the whole stay, or null when unknown. */
  amount: number | null;
  /** "RM 60/night × 2 × 2N" when the line is a plain nightly price. */
  calc?: string;
  variantLabel?: string;
  variantColor?: string | null;
  includes: SummaryInclude[];
  /** Present when the customer added setup at the campsite (fee may be 0). */
  setupFee?: number;
};

export type RentalSummary = {
  lines: SummaryLine[];
  freeItems: { name: string; qty: number }[];
  rows: PriceRow[];
  dates?: { start: string; end: string };
  nights?: number;
  /** Shown under the rows when the breakdown is incomplete. */
  note?: string;
};

/** Whole nights between two YYYY-MM-DD dates (0 for a day trip). */
export function nightsBetween(dates?: { start: string; end: string }): number | undefined {
  if (!dates?.start || !dates?.end) return undefined;
  const p = (s: string) => { const [y, m, d] = s.split("-").map(Number); return y && m && d ? Date.UTC(y, m - 1, d) : NaN; };
  const n = Math.round((p(dates.end) - p(dates.start)) / 86_400_000);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function durationLabel(nights?: number): string {
  if (nights == null) return "";
  return nights === 0 ? "Day trip" : `${nights} night${nights === 1 ? "" : "s"}`;
}

/** "16 May 2026" from YYYY-MM-DD; anything else is returned as given. */
export function formatLongDate(s?: string): string {
  if (!s) return "TBD";
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return s;
  return new Date(y, m - 1, d).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}

function lineFromItem(i: OrderItem, nights?: number): SummaryLine {
  const amount = typeof i.lineTotal === "number" || i.price ? itemLineTotal(i) : null;
  const n = Math.max(1, nights ?? 1);
  // Same hint as the cart, but only when it really is price × qty × nights
  // (tiered/package pricing is shown as the line total alone).
  const calc = i.price && amount === i.price * i.qty * n && nights != null
    ? `RM ${i.price}/night × ${i.qty} × ${n}N`
    : undefined;
  return {
    name: i.name,
    qty: i.qty,
    amount,
    calc,
    variantLabel: i.variantLabel || undefined,
    variantColor: i.variantColor || null,
    includes: (i.linkedItems || []).map(li => ({ qty: li.qty * i.qty, name: li.name, variantLabel: li.variantLabel, variantColor: li.variantColor })),
    ...(i.addSetup ? { setupFee: i.setupFee || 0 } : {}),
  };
}

/** From a saved order (the source of truth). */
export function summaryFromOrder(o: Order): RentalSummary {
  const nights = typeof o.nights === "number" ? o.nights : nightsBetween(o.bookingDates);
  return {
    lines: (o.items || []).map(i => lineFromItem(i, nights)),
    freeItems: o.freeItems || [],
    rows: priceBreakdown(o),
    dates: o.bookingDates,
    nights,
    note: typeof o.subtotal !== "number"
      ? "This order was placed before full cart details were saved, so fees such as delivery are not itemised."
      : undefined,
  };
}

/** Older agreement links carried a small summary instead of an order. */
export type LegacyBooking = {
  items?: { name: string; qty: number; price?: number; variantLabel?: string; variantColor?: string; linkedItems?: { name: string; qty: number; variantLabel?: string }[] }[];
  dates?: { start: string; end: string };
  subtotal?: number;
  discounts?: { label: string; amount: number }[];
  serviceFee?: number;
  rentalAmount?: number;
  depositAmount?: number;
  total?: number;
};

export function summaryFromLegacy(b: LegacyBooking): RentalSummary {
  const nights = nightsBetween(b.dates);
  const rows: PriceRow[] = [];
  if (typeof b.subtotal === "number") rows.push({ label: "Subtotal", amount: b.subtotal, kind: "plain" });
  for (const d of b.discounts || []) rows.push({ label: d.label, amount: -d.amount, kind: "discount" });
  if (b.serviceFee) rows.push({ label: "Service fee", amount: b.serviceFee, kind: "plain" });
  if (b.depositAmount) {
    rows.push({ label: "Rental", amount: b.rentalAmount ?? (b.total || 0) - b.depositAmount, kind: "strong" });
    rows.push({ label: "Security deposit (refundable)", amount: b.depositAmount, kind: "plain" });
  }
  rows.push({ label: "Total", amount: b.total || 0, kind: "total" });
  return {
    lines: (b.items || []).map(i => {
      const l = lineFromItem({ ...i, price: i.price || 0, linkedItems: i.linkedItems?.map(li => ({ ...li, itemId: "" })) }, nights);
      // Old links stored the nightly price only, not the stay total.
      return { ...l, amount: null, calc: i.price ? `RM ${i.price}/night × ${i.qty}` : undefined };
    }),
    freeItems: [],
    rows,
    dates: b.dates,
    nights,
  };
}

/** "RM 144", "− RM 16" or the row's text. */
export function rowAmount(r: PriceRow): string {
  return r.text ?? `${(r.amount || 0) < 0 ? "− " : ""}RM ${Math.abs(r.amount || 0)}`;
}
