// src/lib/orderFlow.ts
// Pure order-pipeline logic for the vendor Orders tab.
// One pipeline (New → Confirmed → Picked up → Returned → Completed) with a
// separate payment track (deposit in, rental in, deposit out). Every order has
// exactly one next action, derived from its fields and booking dates.
//
// Order `status` values are unchanged (pending | confirmed | completed |
// cancelled | conflict) so other screens, Cloud Functions and security rules
// keep working. Picked up / returned are timestamps on a confirmed order.

/* eslint-disable @typescript-eslint/no-explicit-any */

export type OrderStatus = "pending" | "confirmed" | "completed" | "cancelled" | "conflict";
export type LegacyPaymentStatus = "unpaid" | "deposit_paid" | "full_paid" | "refunded" | "deposit_burnt";
export type DepositOutcome = "refunded" | "partial" | "kept";

export type OrderLinkedItem = {
  itemId: string; name: string; qty: number;
  variantLabel?: string; variantColor?: string | null;
};

export type OrderItem = {
  id?: string; name: string; qty: number; price: number;
  lineTotal?: number;
  addSetup?: boolean; setupFee?: number;
  variantId?: string; variantLabel?: string; variantColor?: string | null;
  linkedItems?: OrderLinkedItem[];
};

export type OrderSkip = { step: string; reason: string; at: string };
export type OrderEvent = { type: string; at: string; via?: string; note?: string };

export type Order = {
  id: string;
  vendorId?: string;
  customerPhone: string;
  customerName?: string;
  items: OrderItem[];
  totalAmount: number;
  manualPrice?: number;
  rentalAmount?: number;
  depositAmount?: number;
  serviceFee?: number;
  // Cart snapshot (saved at checkout from Nov 2026 onward)
  subtotal?: number;
  nights?: number;
  setupFeeTotal?: number;
  deliveryFee?: number;
  deliveryQuotePending?: boolean;
  deliveryDistanceKm?: number | null;
  comboApplied?: boolean;
  comboFee?: number;
  comboSavings?: number;
  timeSlotTime?: string | null;
  // Discounts
  promoCode?: string;
  promoDiscount?: number;
  promoType?: string;
  autoDiscount?: number;
  minSpendDiscount?: number;
  bundleDiscount?: number;
  freeItems?: { id?: string; name: string; qty: number }[];
  // Booking
  pickupLocation: string;
  fulfillmentType?: string;
  deliveryZone?: string | null;
  timeSlot?: string | null;
  pax?: number | null;
  campingLocation?: string;
  bookingDates: { start: string; end: string };
  // Pipeline
  status: OrderStatus;
  confirmedAt?: any;
  pickedUpAt?: any;
  returnedAt?: any;
  completedAt?: any;
  cancelledAt?: any;
  cancelReason?: string;
  skips?: OrderSkip[];
  history?: OrderEvent[];
  // Payment
  paymentStatus?: LegacyPaymentStatus;
  paymentV2?: boolean;
  depositReceivedAt?: any;
  rentalReceivedAt?: any;
  depositOutcome?: DepositOutcome | null;
  depositKeptAmount?: number;
  depositKeptReason?: string;
  depositSettledAt?: any;
  // Follow-ups sent
  paymentRequestedAt?: any;
  balanceRequestedAt?: any;
  agreementSentAt?: any;
  pickupReminderSentAt?: any;
  returnReminderSentAt?: any;
  // Agreement, calendar, linking
  agreementSigned?: boolean;
  agreementSignedAt?: any;
  agreementId?: string | null;
  calendarLinked?: boolean;
  calendarDates?: { start: string; end: string };
  parentOrderId?: string | null;
  stockConflict?: boolean;
  stockConflictDetails?: string[];
  // Review
  reviewToken?: string;
  reviewTokenUsed?: boolean;
  reviewTokenSentAt?: any;
  createdAt: any;
  deleted?: boolean;
};

export type Stage = "new" | "confirmed" | "picked_up" | "returned" | "completed" | "cancelled";

export const STAGES: { key: Exclude<Stage, "cancelled">; label: string }[] = [
  { key: "new", label: "New" },
  { key: "confirmed", label: "Confirmed" },
  { key: "picked_up", label: "Picked up" },
  { key: "returned", label: "Returned" },
  { key: "completed", label: "Completed" },
];

const DAY = 86_400_000;

/** Milliseconds from a Firestore Timestamp, Date, ISO string or number. 0 if empty. */
export function toMillis(ts: any): number {
  if (!ts) return 0;
  if (typeof ts === "number") return ts;
  if (typeof ts === "string") { const n = Date.parse(ts); return Number.isNaN(n) ? 0 : n; }
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.toDate === "function") return ts.toDate().getTime();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  return 0;
}

/** Whole days from today to a "YYYY-MM-DD" date: 0 today, 1 tomorrow, -1 yesterday. */
export function daysUntil(dateStr: string | undefined, now: Date = new Date()): number {
  if (!dateStr) return 0;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return 0;
  const target = new Date(y, m - 1, d).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target - today) / DAY);
}

export function formatShortDate(dateStr: string | undefined): string {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(y, m - 1, d).toLocaleDateString("en-MY", { day: "numeric", month: "short" });
}

export function formatDateRange(dates: { start: string; end: string } | undefined): string {
  if (!dates) return "-";
  return `${formatShortDate(dates.start)} – ${formatShortDate(dates.end)}`;
}

export function getStage(o: Order): Stage {
  if (o.status === "cancelled") return "cancelled";
  if (o.status === "completed") return "completed";
  if (o.status === "confirmed") {
    if (o.returnedAt) return "returned";
    if (o.pickedUpAt) return "picked_up";
    return "confirmed";
  }
  return "new";
}

/** Index of the stage in the 5-step strip (cancelled orders show how far they got as "new"). */
export function stageIndex(o: Order): number {
  const s = getStage(o);
  const i = STAGES.findIndex(x => x.key === s);
  return i < 0 ? 0 : i;
}

export type PaymentState = {
  total: number;
  deposit: number;
  rental: number;
  depositReceived: boolean;
  rentalReceived: boolean;
  depositOutcome: DepositOutcome | null;
  depositKept: number;
  depositRefunded: number;
  /** Deposit was received and has not been refunded or kept yet. */
  depositHeld: boolean;
  /** Money still to collect from the customer. */
  balanceDue: number;
  nothingReceived: boolean;
  fullyReceived: boolean;
};

export function getPayment(o: Order): PaymentState {
  const total = o.manualPrice || o.totalAmount || 0;
  const deposit = Math.max(0, o.depositAmount || 0);
  const rental = Math.max(0, o.rentalAmount ?? (total - deposit));

  let depositReceived: boolean;
  let rentalReceived: boolean;
  let depositOutcome: DepositOutcome | null;

  if (o.paymentV2) {
    depositReceived = deposit > 0 && !!o.depositReceivedAt;
    rentalReceived = !!o.rentalReceivedAt;
    depositOutcome = o.depositOutcome || null;
  } else {
    // Orders last touched by the old single "payment status" control.
    const ps = o.paymentStatus || "unpaid";
    depositReceived = deposit > 0 && ps !== "unpaid";
    rentalReceived = ps === "full_paid" || ps === "refunded" || ps === "deposit_burnt";
    depositOutcome = ps === "refunded" ? "refunded" : ps === "deposit_burnt" ? "kept" : null;
  }
  if (deposit === 0 || !depositReceived) depositOutcome = null;

  let depositKept = 0;
  if (depositOutcome === "kept") depositKept = deposit;
  else if (depositOutcome === "partial") depositKept = Math.min(deposit, Math.max(0, o.depositKeptAmount || 0));
  const depositRefunded = depositOutcome ? deposit - depositKept : 0;

  const balanceDue = (rentalReceived ? 0 : rental) + (deposit > 0 && !depositReceived ? deposit : 0);

  return {
    total, deposit, rental, depositReceived, rentalReceived, depositOutcome,
    depositKept, depositRefunded,
    depositHeld: depositReceived && !depositOutcome,
    balanceDue,
    nothingReceived: !depositReceived && !rentalReceived,
    fullyReceived: rentalReceived && (deposit === 0 || depositReceived),
  };
}

/** Old single-field status, kept in sync so invoices, analytics and admin screens stay correct. */
export function legacyPaymentStatus(p: Pick<PaymentState, "deposit" | "depositReceived" | "rentalReceived" | "depositOutcome">): LegacyPaymentStatus {
  if (p.depositOutcome === "kept") return "deposit_burnt";
  if (p.depositOutcome === "refunded" || p.depositOutcome === "partial") return "refunded";
  if (p.rentalReceived && (p.deposit === 0 || p.depositReceived)) return "full_paid";
  if (p.depositReceived || p.rentalReceived) return "deposit_paid";
  return "unpaid";
}

export type PaymentChange =
  | { kind: "deposit"; received: boolean }
  | { kind: "rental"; received: boolean }
  | { kind: "full" }
  | { kind: "settle"; outcome: DepositOutcome; keptAmount?: number; reason?: string }
  | { kind: "unsettle" };

/**
 * Fields to write for a payment change. `stamp` is the value used for "now"
 * (serverTimestamp() in the app, anything truthy in tests). Always writes the
 * complete payment state so an order migrates off the legacy field in one go.
 */
export function paymentPatch(o: Order, change: PaymentChange, stamp: any): Record<string, any> {
  const cur = getPayment(o);
  let depositReceived = cur.depositReceived;
  let rentalReceived = cur.rentalReceived;
  let outcome: DepositOutcome | null = cur.depositOutcome;
  let keptAmount = cur.depositOutcome === "partial" ? cur.depositKept : 0;
  let keptReason = o.depositKeptReason || "";

  if (change.kind === "deposit") {
    depositReceived = change.received && cur.deposit > 0;
    if (!depositReceived) { outcome = null; keptAmount = 0; keptReason = ""; }
  } else if (change.kind === "rental") {
    rentalReceived = change.received;
  } else if (change.kind === "full") {
    rentalReceived = true;
    depositReceived = cur.deposit > 0;
  } else if (change.kind === "settle") {
    if (!depositReceived) return {};
    const kept = change.outcome === "kept" ? cur.deposit
      : change.outcome === "partial" ? Math.min(cur.deposit, Math.max(0, Math.round(change.keptAmount || 0)))
      : 0;
    outcome = kept >= cur.deposit ? "kept" : kept <= 0 ? "refunded" : "partial";
    keptAmount = outcome === "partial" ? kept : 0;
    keptReason = outcome === "refunded" ? "" : (change.reason || "");
  } else if (change.kind === "unsettle") {
    outcome = null; keptAmount = 0; keptReason = "";
  }

  const keep = (prev: any, on: boolean) => (on ? (prev || stamp) : null);
  return {
    paymentV2: true,
    depositReceivedAt: keep(o.paymentV2 ? o.depositReceivedAt : null, depositReceived),
    rentalReceivedAt: keep(o.paymentV2 ? o.rentalReceivedAt : null, rentalReceived),
    depositOutcome: outcome,
    depositKeptAmount: keptAmount,
    depositKeptReason: keptReason,
    depositSettledAt: outcome ? (o.paymentV2 && o.depositSettledAt && cur.depositOutcome === outcome ? o.depositSettledAt : stamp) : null,
    paymentStatus: legacyPaymentStatus({ deposit: cur.deposit, depositReceived, rentalReceived, depositOutcome: outcome }),
  };
}

/** Agreement is in place: signed, or covered by a parent order. */
export function agreementOk(o: Order): boolean {
  return !!o.agreementSigned || !!o.parentOrderId;
}

/** Steps still open when gear is handed over. Marking pickup with any of these needs a reason. */
export function pickupGaps(o: Order): { step: string; label: string }[] {
  const p = getPayment(o);
  const gaps: { step: string; label: string }[] = [];
  if (p.balanceDue > 0) gaps.push({ step: "payment", label: `RM ${p.balanceDue} unpaid` });
  if (!agreementOk(o)) gaps.push({ step: "agreement", label: "agreement not signed" });
  return gaps;
}

/** An order can complete once gear is back, rental is received and the deposit is refunded or kept. */
export function canComplete(o: Order): boolean {
  const p = getPayment(o);
  return getStage(o) === "returned" && p.rentalReceived && !p.depositHeld;
}

export type ActionKey =
  | "resolve_conflict" | "confirm" | "request_payment" | "send_agreement"
  | "request_balance" | "pickup_reminder" | "mark_picked_up" | "return_reminder"
  | "mark_returned" | "settle_deposit" | "complete" | "send_review" | "none";

export type Tone = "danger" | "warn" | "info" | "neutral" | "good";
export type Group = "action" | "waiting" | "done";

export type NextAction = {
  key: ActionKey;
  /** Button text. Empty when there is nothing to do. */
  label: string;
  /** One line explaining why this order is where it is. */
  reason: string;
  /** Short chip shown on the card. */
  tag: string;
  tone: Tone;
  group: Group;
  /** Opens WhatsApp. */
  whatsapp: boolean;
  /** Lower sorts first. */
  priority: number;
};

function agoLabel(ms: number, now: Date): string {
  if (!ms) return "";
  const mins = Math.max(0, Math.round((now.getTime() - ms) / 60000));
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function sentRecently(ts: any, now: Date): boolean {
  const ms = toMillis(ts);
  return ms > 0 && now.getTime() - ms < DAY;
}

function pickupTag(dStart: number): { tag: string; tone: Tone } {
  if (dStart < 0) return { tag: "Pickup overdue", tone: "danger" };
  if (dStart === 0) return { tag: "Pickup today", tone: "warn" };
  if (dStart === 1) return { tag: "Pickup tomorrow", tone: "warn" };
  return { tag: `Pickup in ${dStart} days`, tone: "neutral" };
}

const REVIEW_WINDOW_DAYS = 14;

export function getNextAction(o: Order, now: Date = new Date()): NextAction {
  const stage = getStage(o);
  const p = getPayment(o);
  const dStart = daysUntil(o.bookingDates?.start, now);
  const dEnd = daysUntil(o.bookingDates?.end, now);
  const base = { whatsapp: false, priority: 50 };

  if (stage === "cancelled") {
    return { ...base, key: "none", label: "", reason: o.cancelReason ? `Cancelled: ${o.cancelReason}` : "Cancelled", tag: "Cancelled", tone: "neutral", group: "done", priority: 99 };
  }

  if (stage === "completed") {
    if (o.reviewTokenUsed) {
      return { ...base, key: "none", label: "", reason: "Customer left a review", tag: "Reviewed", tone: "good", group: "done", priority: 95 };
    }
    const doneMs = toMillis(o.completedAt);
    const recent = doneMs > 0 && now.getTime() - doneMs < REVIEW_WINDOW_DAYS * DAY;
    if (o.reviewToken && !o.reviewTokenSentAt && recent) {
      return { ...base, key: "send_review", label: "Send review link", reason: "Completed. Ask the customer for a review", tag: "Review not requested", tone: "info", group: "action", whatsapp: true, priority: 40 };
    }
    return { ...base, key: "send_review", label: o.reviewTokenSentAt ? "Resend review link" : "Send review link", reason: o.reviewTokenSentAt ? "Review link sent, no review yet" : "Completed", tag: "Completed", tone: "good", group: "done", whatsapp: true, priority: 90 };
  }

  if (stage === "new") {
    if (o.status === "conflict" || o.stockConflict) {
      return { ...base, key: "resolve_conflict", label: "Review stock conflict", reason: "Requested items exceed your stock for these dates", tag: "Stock conflict", tone: "danger", group: "action", priority: 0 };
    }
    const ago = agoLabel(toMillis(o.createdAt), now);
    const late = toMillis(o.createdAt) > 0 && now.getTime() - toMillis(o.createdAt) > 3_600_000;
    return {
      ...base, key: "confirm", label: "Confirm order", whatsapp: true,
      reason: "Customer is waiting for your reply",
      tag: ago ? `New · ${ago}` : "New", tone: "info", group: "action", priority: late ? 5 : 10,
    };
  }

  if (stage === "confirmed") {
    // Dates already over and never updated: go straight to "returned".
    if (dEnd < 0) {
      return { ...base, key: "mark_returned", label: "Mark as returned", reason: "Return date has passed and this order was not updated", tag: "Overdue", tone: "danger", group: "action", priority: 1 };
    }
    const gaps = pickupGaps(o);
    const pt = pickupTag(dStart);
    // Pickup day: handing over is the job, open steps are shown as the reason.
    if (dStart <= 0) {
      const reason = gaps.length ? `${pt.tag}, ${gaps.map(g => g.label).join(", ")}` : `${pt.tag}. Hand over the gear`;
      return { ...base, key: "mark_picked_up", label: "Mark as picked up", reason, tag: pt.tag, tone: gaps.length || dStart < 0 ? "danger" : "warn", group: "action", priority: dStart < 0 ? 2 : 3 };
    }
    const soon = dStart <= 1;
    if (p.nothingReceived && p.total > 0) {
      const waiting = sentRecently(o.paymentRequestedAt, now) && !soon;
      return {
        ...base, key: "request_payment", label: o.paymentRequestedAt ? "Request payment again" : "Request payment", whatsapp: true,
        reason: waiting ? "Payment requested, waiting for the customer" : "No payment received yet",
        tag: soon ? pt.tag : waiting ? "Waiting for payment" : "Unpaid", tone: soon ? "warn" : waiting ? "neutral" : "warn",
        group: waiting ? "waiting" : "action", priority: soon ? 4 : 20,
      };
    }
    if (!agreementOk(o)) {
      const waiting = sentRecently(o.agreementSentAt, now) && !soon;
      return {
        ...base, key: "send_agreement", label: o.agreementSentAt ? "Resend agreement link" : "Send agreement link", whatsapp: true,
        reason: waiting ? "Agreement link sent, waiting for signature" : "Agreement not signed yet",
        tag: soon ? pt.tag : waiting ? "Waiting for signature" : "Agreement needed", tone: soon ? "warn" : waiting ? "neutral" : "warn",
        group: waiting ? "waiting" : "action", priority: soon ? 4 : 22,
      };
    }
    if (p.balanceDue > 0) {
      const waiting = sentRecently(o.balanceRequestedAt, now) && !soon;
      const what = p.depositReceived && !p.rentalReceived ? `Deposit received, balance RM ${p.balanceDue} unpaid` : `Balance RM ${p.balanceDue} unpaid`;
      return {
        ...base, key: "request_balance", label: o.balanceRequestedAt ? "Request balance again" : "Request balance", whatsapp: true,
        reason: waiting ? `Balance RM ${p.balanceDue} requested, waiting for the customer` : what,
        tag: soon ? pt.tag : waiting ? "Waiting for balance" : "Balance unpaid", tone: soon ? "warn" : waiting ? "neutral" : "warn",
        group: waiting ? "waiting" : "action", priority: soon ? 4 : 24,
      };
    }
    return {
      ...base, key: "pickup_reminder", label: o.pickupReminderSentAt ? "Send pickup reminder again" : "Send pickup reminder", whatsapp: true,
      reason: `Paid and signed. Pickup on ${formatShortDate(o.bookingDates?.start)}`,
      tag: pt.tag, tone: "good", group: "waiting", priority: 60 + Math.min(dStart, 30),
    };
  }

  if (stage === "picked_up") {
    if (dEnd < 0) {
      const n = -dEnd;
      return { ...base, key: "mark_returned", label: "Mark as returned", reason: `Return was due ${n === 1 ? "yesterday" : `${n} days ago`}, not marked returned`, tag: "Overdue", tone: "danger", group: "action", priority: 1 };
    }
    if (dEnd === 0) {
      return { ...base, key: "mark_returned", label: "Mark as returned", reason: p.balanceDue > 0 ? `Return today, RM ${p.balanceDue} still unpaid` : "Gear is due back today", tag: "Return today", tone: "warn", group: "action", priority: 3 };
    }
    if (p.balanceDue > 0) {
      return { ...base, key: "request_balance", label: "Request balance", whatsapp: true, reason: `On trip, RM ${p.balanceDue} still unpaid`, tag: "Balance unpaid", tone: "warn", group: "action", priority: 15 };
    }
    return {
      ...base, key: "return_reminder", label: o.returnReminderSentAt ? "Send return reminder again" : "Send return reminder", whatsapp: true,
      reason: `On trip. Returns ${formatShortDate(o.bookingDates?.end)}`,
      tag: dEnd === 1 ? "Returns tomorrow" : "On trip", tone: "good", group: "waiting", priority: 70 + Math.min(dEnd, 30),
    };
  }

  // stage === "returned"
  if (!p.rentalReceived) {
    return { ...base, key: "request_balance", label: "Request balance", whatsapp: true, reason: `Gear returned, rental RM ${p.rental} still unpaid`, tag: "Balance unpaid", tone: "danger", group: "action", priority: 6 };
  }
  if (p.depositHeld) {
    return { ...base, key: "settle_deposit", label: "Settle deposit", reason: `Deposit RM ${p.deposit} still held`, tag: "Returned", tone: "warn", group: "action", priority: 8 };
  }
  return { ...base, key: "complete", label: "Complete order", reason: "Everything is settled", tag: "Returned", tone: "good", group: "action", priority: 9 };
}

export type OrdersSummary = { action: number; waiting: number; done: number; toCollect: number; depositsHeld: number };

export function summarize(orders: Order[], now: Date = new Date()): OrdersSummary {
  const s: OrdersSummary = { action: 0, waiting: 0, done: 0, toCollect: 0, depositsHeld: 0 };
  for (const o of orders) {
    if (o.deleted) continue;
    s[getNextAction(o, now).group]++;
    const stage = getStage(o);
    if (stage === "confirmed" || stage === "picked_up" || stage === "returned") {
      const p = getPayment(o);
      s.toCollect += p.balanceDue;
      if (p.depositHeld) s.depositsHeld += p.deposit;
    }
  }
  return s;
}

/** Orders of one group, most urgent first. */
export function sortForGroup(orders: Order[], group: Group, now: Date = new Date()): Order[] {
  const rows = orders
    .filter(o => !o.deleted)
    .map(o => ({ o, a: getNextAction(o, now) }))
    .filter(r => r.a.group === group);
  if (group === "done") {
    rows.sort((x, y) => (toMillis(y.o.completedAt || y.o.cancelledAt || y.o.createdAt) - toMillis(x.o.completedAt || x.o.cancelledAt || x.o.createdAt)));
  } else {
    rows.sort((x, y) => x.a.priority - y.a.priority
      || (x.o.bookingDates?.start || "").localeCompare(y.o.bookingDates?.start || "")
      || toMillis(x.o.createdAt) - toMillis(y.o.createdAt));
  }
  return rows.map(r => r.o);
}

/** Line total for an item: the cart's own figure when saved, otherwise price × qty. */
export function itemLineTotal(i: OrderItem): number {
  return typeof i.lineTotal === "number" ? i.lineTotal : (i.price || 0) * (i.qty || 0);
}

export type PriceRow = { label: string; amount?: number; text?: string; kind: "plain" | "discount" | "strong" | "total"; code?: string };

/** Price breakdown exactly as the cart showed it, using whatever the order saved. */
export function priceBreakdown(o: Order): PriceRow[] {
  const rows: PriceRow[] = [];
  const p = getPayment(o);
  if (typeof o.subtotal === "number") rows.push({ label: "Subtotal", amount: o.subtotal, kind: "plain" });
  if (o.autoDiscount) rows.push({ label: "Extended stay discount", amount: -o.autoDiscount, kind: "discount" });
  if (o.minSpendDiscount) rows.push({ label: "Spend reward", amount: -o.minSpendDiscount, kind: "discount" });
  if (o.bundleDiscount) rows.push({ label: "Bundle deal", amount: -o.bundleDiscount, kind: "discount" });
  if (o.promoCode && o.promoDiscount) rows.push({ label: "Promo code", code: o.promoCode, amount: -o.promoDiscount, kind: "discount" });
  if (o.comboApplied && typeof o.comboFee === "number") {
    rows.push({ label: o.comboSavings ? `Delivery + setup combo (saved RM ${o.comboSavings})` : "Delivery + setup combo", amount: o.comboFee, kind: "plain" });
  } else {
    if (o.setupFeeTotal) rows.push({ label: "Setup fee", amount: o.setupFeeTotal, kind: "plain" });
    if (o.deliveryQuotePending) rows.push({ label: "Delivery fee", text: "To be quoted", kind: "plain" });
    else if (o.deliveryFee) rows.push({ label: o.deliveryZone ? `Delivery fee · ${o.deliveryZone}` : "Delivery fee", amount: o.deliveryFee, kind: "plain" });
  }
  if (o.serviceFee) rows.push({ label: "Service fee", amount: o.serviceFee, kind: "plain" });
  if (p.deposit > 0) {
    rows.push({ label: "Rental", amount: p.rental, kind: "strong" });
    rows.push({ label: "Security deposit (refundable)", amount: p.deposit, kind: "plain" });
  }
  rows.push({ label: o.deliveryQuotePending ? "Total (excl. delivery)" : "Total", amount: p.total, kind: "total" });
  return rows;
}

export const SKIP_REASONS = ["Paying on return", "Paying cash at pickup", "Regular customer", "Agreement signed on paper", "Other reason"];
export const CANCEL_REASONS = ["Customer did not reply", "Customer cancelled", "Dates not available", "Item not available", "Price not agreed", "Other reason"];
export const KEEP_REASONS = ["Damage", "Missing item", "Late return", "Cleaning"];
