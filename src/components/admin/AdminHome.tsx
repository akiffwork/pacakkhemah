"use client";

// Admin › Home: what needs attention first, then how the platform is doing.

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getPayment, toMillis, type Order } from "@/lib/orderFlow";
import { netRevenue } from "@/lib/credits";
import { Card, EmptyState, NavRow, PageHeader, SectionTitle, Segments, StatCard, SummaryStrip } from "@/components/ui/kit";
import type { AdminNavigate } from "@/app/admin/page";
import type { AdminVendor, AlertCounts } from "./types";

type Tx = { id: string; type?: string; amount?: number; credits?: number; vendorName?: string; createdAt?: unknown };
type Range = "7" | "30" | "90";

const rental = (o: Order) => getPayment(o).rental;
const doneAt = (o: Order) => toMillis(o.completedAt) || toMillis(o.createdAt);
const joinedAt = (v: AdminVendor) => toMillis(v.joinedAt) || toMillis(v.createdAt);
const pct = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : 0);
const rm = (n: number) => `RM ${Math.round(n).toLocaleString()}`;

export default function AdminHome({ allVendors, counts, onNavigate }: { allVendors: AdminVendor[]; counts: AlertCounts; onNavigate: AdminNavigate }) {
  const [txs, setTxs] = useState<Tx[]>([]);
  type AOrder = Order & { id: string; vendorId: string; vendorName?: string };
  const [orders, setOrders] = useState<AOrder[]>([]);
  const [ratings, setRatings] = useState<number[]>([]);
  const [waitlist, setWaitlist] = useState(0);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>("30");

  async function load() {
    setLoading(true);
    const safe = async <T,>(p: Promise<T>, fallback: T) => { try { return await p; } catch (e) { console.error(e); return fallback; } };
    const [t, o, r, w] = await Promise.all([
      safe(getDocs(query(collection(db, "transactions"), orderBy("createdAt", "desc"), limit(500))), null),
      safe(getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(1000))), null),
      safe(getDocs(query(collection(db, "reviews"), orderBy("createdAt", "desc"), limit(200))), null),
      safe(getDocs(collection(db, "area_waitlist")), null),
    ]);
    setTxs(t ? t.docs.map(d => ({ id: d.id, ...d.data() } as Tx)) : []);
    setOrders(o ? o.docs.map(d => ({ id: d.id, ...d.data() } as AOrder)).filter(x => !x.deleted) : []);
    setRatings(r ? r.docs.map(d => Number(d.data().rating) || 0).filter(Boolean) : []);
    setWaitlist(w ? w.size : 0);
    setLoading(false);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const s = useMemo(() => {
    const now = Date.now();
    const days = Number(range) * 86_400_000;
    const from = now - days, prevFrom = now - 2 * days;
    const inRange = (ms: number) => ms >= from;
    const inPrev = (ms: number) => ms >= prevFrom && ms < from;

    const approved = allVendors.filter(v => v.status === "approved");
    const live = approved.filter(v => (v.credits || 0) > 0 && !v.is_vacation);
    const valid = orders.filter(o => o.status !== "cancelled");
    const completed = orders.filter(o => o.status === "completed");

    const txIn = txs.filter(t => inRange(toMillis(t.createdAt)));
    const txPrev = txs.filter(t => inPrev(toMillis(t.createdAt)));
    const revenue = netRevenue(txIn), revenuePrev = netRevenue(txPrev);
    const value = completed.filter(o => inRange(doneAt(o))).reduce((a, o) => a + rental(o), 0);
    const valuePrev = completed.filter(o => inPrev(doneAt(o))).reduce((a, o) => a + rental(o), 0);
    const custIn = new Set(valid.filter(o => inRange(toMillis(o.createdAt))).map(o => o.customerPhone).filter(Boolean)).size;
    const custPrev = new Set(valid.filter(o => inPrev(toMillis(o.createdAt))).map(o => o.customerPhone).filter(Boolean)).size;

    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i));
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const sameMonth = (ms: number) => { const x = new Date(ms); return ms > 0 && `${x.getFullYear()}-${x.getMonth()}` === key; };
      return {
        label: d.toLocaleDateString("en-MY", { month: "short" }),
        value: completed.filter(o => sameMonth(doneAt(o))).reduce((a, o) => a + rental(o), 0),
        revenue: netRevenue(txs.filter(t => sameMonth(toMillis(t.createdAt)))),
      };
    });

    const pay = { nothing: 0, deposit: 0, full: 0, settled: 0 };
    for (const o of valid) {
      const p = getPayment(o);
      if (p.depositOutcome) pay.settled++;
      else if (p.fullyReceived) pay.full++;
      else if (p.nothingReceived) pay.nothing++;
      else pay.deposit++;
    }

    const byVendor: Record<string, { name: string; value: number; orders: number }> = {};
    for (const o of completed) {
      const v = (byVendor[o.vendorId] ||= { name: allVendors.find(x => x.id === o.vendorId)?.name || o.vendorName || "Unknown", value: 0, orders: 0 });
      v.value += rental(o); v.orders++;
    }
    const topVendors = Object.entries(byVendor).sort((a, b) => b[1].value - a[1].value).slice(0, 5);

    const cities: Record<string, number> = {};
    approved.forEach(v => { const c = v.city || "No city set"; cities[c] = (cities[c] || 0) + 1; });

    const activity = [
      ...orders.slice(0, 6).map(o => ({ at: toMillis(o.createdAt), icon: "fa-receipt", text: `${o.customerName || "A customer"} booked from ${o.vendorName || "a vendor"}` })),
      ...allVendors.filter(v => joinedAt(v) >= now - 7 * 86_400_000).map(v => ({ at: joinedAt(v), icon: "fa-store", text: `${v.name} signed up` })),
    ].sort((a, b) => b.at - a.at).slice(0, 6);

    const stale = orders.filter(o => o.status === "pending" && now - toMillis(o.createdAt) > 86_400_000).length;
    const noCredits = approved.filter(v => (v.credits || 0) <= 0).length;

    return {
      approved, live, valid, completed, revenue, revenuePrev, value, valuePrev, custIn, custPrev, months, pay, topVendors,
      cities: Object.entries(cities).sort((a, b) => b[1] - a[1]).slice(0, 5),
      lowCredit: approved.filter(v => (v.credits || 0) > 0 && (v.credits || 0) <= 5).length,
      holiday: approved.filter(v => v.is_vacation).length,
      newVendors: allVendors.filter(v => inRange(joinedAt(v))).length,
      ordersIn: valid.filter(o => inRange(toMillis(o.createdAt))).length,
      activity, stale, noCredits,
    };
  }, [allVendors, orders, txs, range]);

  const rating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "–";
  const max = Math.max(1, ...s.months.map(m => Math.max(m.value, m.revenue)));
  const change = (n: number) => (n === 0 ? undefined : `${n > 0 ? "+" : ""}${n}% vs previous ${range} days`);

  const needs = [
    counts.applications > 0 && { icon: "fa-user-check", title: `${counts.applications} vendor application${counts.applications > 1 ? "s" : ""}`, hint: "Check and approve new shops", go: () => onNavigate("vendors", { view: "applications" }), badge: counts.applications },
    counts.topUps > 0 && { icon: "fa-coins", title: `${counts.topUps} top-up request${counts.topUps > 1 ? "s" : ""}`, hint: "Check the receipt, then add the credits", go: () => onNavigate("money"), badge: counts.topUps },
    s.stale > 0 && { icon: "fa-hourglass-half", title: `${s.stale} booking request${s.stale > 1 ? "s" : ""} unanswered for over a day`, hint: "Vendors have not confirmed these yet", go: () => onNavigate("orders", { status: "pending" }), badge: s.stale },
    waitlist > 0 && { icon: "fa-bell", title: `${waitlist} customer${waitlist > 1 ? "s" : ""} waiting for a vendor nearby`, hint: "Notify them when a shop opens in their area", go: () => onNavigate("vendors", { view: "prospects" }), badge: waitlist },
    s.noCredits > 0 && { icon: "fa-battery-empty", title: `${s.noCredits} vendor${s.noCredits > 1 ? "s" : ""} out of credits`, hint: "They cannot receive new booking requests", go: () => onNavigate("vendors", { view: "active", q: "" }), badge: s.noCredits },
  ].filter(Boolean) as { icon: string; title: string; hint: string; go: () => void; badge: number }[];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Home" subtitle="What needs you, and how the platform is doing"
        action={<button type="button" onClick={load} aria-label="Refresh" className="w-11 h-11 rounded-xl border border-slate-300 bg-white text-slate-700 flex items-center justify-center hover:bg-slate-50"><i className={`fas fa-rotate ${loading ? "fa-spin" : ""}`} aria-hidden="true"></i></button>} />

      <section className="flex flex-col gap-2">
        <SectionTitle>Needs you</SectionTitle>
        {needs.length === 0
          ? <Card><p className="text-sm text-slate-700 flex items-center gap-2"><i className="fas fa-circle-check text-emerald-700" aria-hidden="true"></i>Nothing needs you right now.</p></Card>
          : needs.map(n => <NavRow key={n.title} icon={n.icon} title={n.title} hint={n.hint} onClick={n.go} badge={n.badge} />)}
      </section>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <SectionTitle>Platform</SectionTitle>
        <Segments label="Time range" value={range} onChange={setRange}
          items={[{ key: "7", label: "7 days" }, { key: "30", label: "30 days" }, { key: "90", label: "90 days" }]} />
      </div>

      <SummaryStrip items={[
        { value: s.approved.length, label: "Live shops" },
        { value: s.live.length, label: "Taking bookings" },
        { value: s.ordersIn, label: `Orders, ${range} days` },
        { value: s.newVendors, label: `New shops, ${range} days` },
      ]} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Credit sales" value={rm(s.revenue)} hint={change(pct(s.revenue, s.revenuePrev)) || "Purchases minus refunds"} />
        <StatCard label="Rental value completed" value={rm(s.value)} hint={change(pct(s.value, s.valuePrev)) || "From completed orders"} />
        <StatCard label="Customers" value={s.custIn} hint={change(pct(s.custIn, s.custPrev)) || "Unique phone numbers"} />
        <StatCard label="Average rating" value={rating} hint={`${ratings.length} recent reviews`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h2 style={{ textTransform: "none" }} className="text-[15px] font-bold text-[#062c24]">Last 6 months</h2>
          <div className="flex items-end gap-2 h-40" role="img" aria-label="Rental value and credit sales by month">
            {s.months.map(m => (
              <div key={m.label} className="flex-1 h-full flex flex-col items-center justify-end gap-1">
                <div className="w-full flex-1 flex items-end justify-center gap-1">
                  <div className="w-1/2 bg-emerald-600 rounded-t" style={{ height: `${(m.value / max) * 100}%` }} title={`Rental value ${rm(m.value)}`}></div>
                  <div className="w-1/2 bg-sky-500 rounded-t" style={{ height: `${(m.revenue / max) * 100}%` }} title={`Credit sales ${rm(m.revenue)}`}></div>
                </div>
                <span className="text-xs text-slate-600">{m.label}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 text-xs text-slate-700">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-600"></span>Rental value</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-sky-500"></span>Credit sales</span>
          </div>
        </Card>

        <Card>
          <h2 style={{ textTransform: "none" }} className="text-[15px] font-bold text-[#062c24]">Orders, all time</h2>
          {[
            { label: "Not cancelled", n: s.valid.length, cls: "bg-slate-500" },
            { label: "Confirmed and in progress", n: orders.filter(o => o.status === "confirmed").length, cls: "bg-sky-500" },
            { label: "Completed", n: s.completed.length, cls: "bg-emerald-600" },
            { label: "Cancelled", n: orders.filter(o => o.status === "cancelled").length, cls: "bg-red-500" },
          ].map(f => (
            <div key={f.label} className="flex flex-col gap-1">
              <div className="flex justify-between text-[13px]"><span className="text-slate-700">{f.label}</span><b>{f.n}</b></div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full ${f.cls}`} style={{ width: `${orders.length ? (f.n / orders.length) * 100 : 0}%` }}></div></div>
            </div>
          ))}
          <p className="text-[13px] font-semibold text-slate-700 pt-2 border-t border-slate-100">Payments recorded by vendors</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[["Nothing yet", s.pay.nothing], ["Deposit only", s.pay.deposit], ["Fully paid", s.pay.full], ["Deposit settled", s.pay.settled]].map(([l, n]) => (
              <div key={l as string}><p className="text-lg font-bold text-[#062c24]">{n}</p><p className="text-xs text-slate-600">{l}</p></div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <h2 style={{ textTransform: "none" }} className="text-[15px] font-bold text-[#062c24]">Top shops by rental value</h2>
          {s.topVendors.length === 0 ? <p className="text-sm text-slate-600">No completed orders yet.</p> : s.topVendors.map(([id, v], i) => (
            <div key={id} className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
              <span className="flex-1 min-w-0"><span className="block text-sm font-semibold truncate">{v.name}</span><span className="text-xs text-slate-600">{v.orders} order{v.orders > 1 ? "s" : ""}</span></span>
              <span className="text-sm font-bold text-emerald-800">{rm(v.value)}</span>
            </div>
          ))}
        </Card>
        <Card>
          <h2 style={{ textTransform: "none" }} className="text-[15px] font-bold text-[#062c24]">Where shops are</h2>
          {s.cities.length === 0 ? <p className="text-sm text-slate-600">No live shops yet.</p> : s.cities.map(([c, n]) => (
            <div key={c} className="flex justify-between text-sm"><span className="text-slate-700">{c}</span><b>{n}</b></div>
          ))}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
            <div><p className="text-lg font-bold text-emerald-800">{s.live.length}</p><p className="text-xs text-slate-600">Taking bookings</p></div>
            <div><p className="text-lg font-bold text-amber-800">{s.lowCredit}</p><p className="text-xs text-slate-600">Low credits</p></div>
            <div><p className="text-lg font-bold text-slate-700">{s.holiday}</p><p className="text-xs text-slate-600">On holiday</p></div>
          </div>
        </Card>
        <Card>
          <h2 style={{ textTransform: "none" }} className="text-[15px] font-bold text-[#062c24]">Recent activity</h2>
          {s.activity.length === 0 ? <EmptyState title="No activity yet" /> : s.activity.map((a, i) => (
            <div key={i} className="flex items-start gap-3">
              <i className={`fas ${a.icon} text-slate-500 mt-1 w-4 text-center`} aria-hidden="true"></i>
              <span className="flex-1 min-w-0"><span className="block text-sm text-slate-800">{a.text}</span><span className="text-xs text-slate-600">{a.at ? new Date(a.at).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : ""}</span></span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
