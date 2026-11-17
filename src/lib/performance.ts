// src/lib/performance.ts
// Sales figures for the Performance tab, from orders using the pipeline
// model in orderFlow (rental received, deposits, stages, cancel reasons).

import { type Order, getPayment, getStage, toMillis } from "@/lib/orderFlow";

export type MonthBar = { key: string; label: string; received: number; orders: number };

/** When the rental money was recorded as received (falls back for older orders). */
export function receivedAt(o: Order): number {
  const p = getPayment(o);
  if (!p.rentalReceived) return 0;
  return toMillis(o.rentalReceivedAt) || toMillis(o.completedAt) || toMillis(o.createdAt);
}

export function monthlyReceived(orders: Order[], months = 6, now: Date = new Date()): MonthBar[] {
  const bars: MonthBar[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    bars.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("en-MY", { month: "short" }), received: 0, orders: 0 });
  }
  for (const o of orders) {
    if (o.deleted || o.status === "cancelled") continue;
    const at = receivedAt(o);
    if (!at) continue;
    const d = new Date(at);
    const bar = bars.find(b => b.key === `${d.getFullYear()}-${d.getMonth()}`);
    if (bar) { bar.received += getPayment(o).rental; bar.orders += 1; }
  }
  return bars;
}

export type SalesSummary = {
  receivedThisMonth: number;
  receivedLastMonth: number;
  receivedAllTime: number;
  ordersReceived: number;
  averageOrder: number;
  toCollect: number;
  depositsHeld: number;
  depositsKept: number;
};

export function salesSummary(orders: Order[], now: Date = new Date()): SalesSummary {
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const s: SalesSummary = { receivedThisMonth: 0, receivedLastMonth: 0, receivedAllTime: 0, ordersReceived: 0, averageOrder: 0, toCollect: 0, depositsHeld: 0, depositsKept: 0 };
  for (const o of orders) {
    if (o.deleted || o.status === "cancelled") continue;
    const p = getPayment(o);
    const at = receivedAt(o);
    if (at) {
      s.receivedAllTime += p.rental;
      s.ordersReceived += 1;
      if (at >= thisMonth) s.receivedThisMonth += p.rental;
      else if (at >= lastMonth) s.receivedLastMonth += p.rental;
    }
    const st = getStage(o);
    if (st === "confirmed" || st === "picked_up" || st === "returned") s.toCollect += p.balanceDue;
    if (p.depositHeld) s.depositsHeld += p.deposit;
    s.depositsKept += p.depositKept;
  }
  s.averageOrder = s.ordersReceived ? Math.round(s.receivedAllTime / s.ordersReceived) : 0;
  return s;
}

export type FunnelStep = { label: string; count: number };

/** Orders created in the last `days` days, by how far they got. */
export function funnel(orders: Order[], days = 90, now: Date = new Date()): { steps: FunnelStep[]; cancelled: number; reasons: { reason: string; count: number }[] } {
  const since = now.getTime() - days * 86_400_000;
  const recent = orders.filter(o => !o.deleted && toMillis(o.createdAt) >= since);
  const reached = (o: Order, n: number) => {
    const order = ["new", "confirmed", "picked_up", "returned", "completed"];
    const st = getStage(o);
    if (st === "cancelled") {
      // How far a cancelled order got before it was cancelled
      const got = o.pickedUpAt ? 2 : o.confirmedAt ? 1 : 0;
      return got >= n;
    }
    return order.indexOf(st) >= n;
  };
  const steps: FunnelStep[] = [
    { label: "Booking requests", count: recent.length },
    { label: "Confirmed", count: recent.filter(o => reached(o, 1)).length },
    { label: "Picked up", count: recent.filter(o => reached(o, 2)).length },
    { label: "Completed", count: recent.filter(o => getStage(o) === "completed").length },
  ];
  const cancelledList = recent.filter(o => getStage(o) === "cancelled");
  const byReason: Record<string, number> = {};
  for (const o of cancelledList) {
    const r = o.cancelReason?.trim() || "No reason given";
    byReason[r] = (byReason[r] || 0) + 1;
  }
  const reasons = Object.entries(byReason).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
  return { steps, cancelled: cancelledList.length, reasons };
}

export type TopItem = { name: string; qty: number; revenue: number };

export function topItems(orders: Order[], limit = 5): TopItem[] {
  const map: Record<string, TopItem> = {};
  for (const o of orders) {
    if (o.deleted || o.status === "cancelled" || !getPayment(o).rentalReceived) continue;
    for (const i of o.items || []) {
      const key = i.name;
      if (!map[key]) map[key] = { name: i.name, qty: 0, revenue: 0 };
      map[key].qty += i.qty || 0;
      map[key].revenue += typeof i.lineTotal === "number" ? i.lineTotal : (i.price || 0) * (i.qty || 0);
    }
  }
  return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

/** Share of orders that a vendor left without an update after their dates. */
export function updateRate(orders: Order[], now: Date = new Date()): { stale: number; total: number } {
  const today = now.toISOString().slice(0, 10);
  const past = orders.filter(o => !o.deleted && (o.bookingDates?.end || "9999") < today);
  const stale = past.filter(o => o.status === "pending" || o.status === "confirmed" || o.status === "conflict").length;
  return { stale, total: past.length };
}
