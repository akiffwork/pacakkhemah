"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Order } from "@/lib/orderFlow";
import { salesSummary, monthlyReceived, funnel, topItems, updateRate } from "@/lib/performance";
import { SummaryStrip, StatCard, SectionTitle, EmptyState, Card } from "@/components/ui/kit";

type Lead = { id: string; totalAmount?: number; timestamp?: { toDate?: () => Date }; creditDeducted?: boolean };

const rm = (n: number) => `RM ${Math.round(n).toLocaleString()}`;

export default function SalesView({ vendorId, orders }: { vendorId: string; orders: Order[] }) {
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "analytics"), where("vendorId", "==", vendorId), orderBy("timestamp", "desc"), limit(10)),
      snap => setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() } as Lead))), () => {});
    return () => unsub();
  }, [vendorId]);

  const s = useMemo(() => salesSummary(orders), [orders]);
  const months = useMemo(() => monthlyReceived(orders), [orders]);
  const f = useMemo(() => funnel(orders, 90), [orders]);
  const top = useMemo(() => topItems(orders), [orders]);
  const upd = useMemo(() => updateRate(orders), [orders]);
  const maxBar = Math.max(1, ...months.map(m => m.received));
  const now = new Date();
  const lastMonthName = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString("en-MY", { month: "long" });

  if (!orders.length) {
    return <EmptyState icon="fa-chart-line" title="No sales yet" body="Your sales figures appear here once customers book and you record their payments in Orders." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <SummaryStrip items={[
        { value: rm(s.receivedThisMonth), label: `Received in ${now.toLocaleDateString("en-MY", { month: "long" })}` },
        { value: rm(s.toCollect), label: "Still to collect" },
        { value: rm(s.depositsHeld), label: "Deposits you hold" },
      ]} />

      {upd.stale > 0 && (
        <div className="bg-amber-100 border border-amber-300 rounded-2xl px-4 py-3 text-[13px] text-amber-900">
          {upd.stale} past order{upd.stale === 1 ? " was" : "s were"} never updated, so these figures miss that money. Update them in Orders.
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <StatCard label={`Received in ${lastMonthName}`} value={rm(s.receivedLastMonth)} />
        <StatCard label="Average order" value={rm(s.averageOrder)} hint={`${s.ordersReceived} paid orders`} />
        <StatCard label="Received, all time" value={rm(s.receivedAllTime)} />
        <StatCard label="Deposits kept" value={rm(s.depositsKept)} hint="For damage, loss or late returns" />
      </div>

      <Card>
        <SectionTitle>Rental received, last 6 months</SectionTitle>
        <div className="flex items-end gap-2 h-40" role="img" aria-label={`Rental received per month: ${months.map(m => `${m.label} ${rm(m.received)}`).join(", ")}`}>
          {months.map(m => (
            <div key={m.key} className="flex-1 h-full flex flex-col items-center justify-end gap-1">
              <span className="text-[11px] font-semibold text-slate-700 whitespace-nowrap">{m.received ? (m.received >= 1000 ? `${(m.received / 1000).toFixed(1)}k` : `${Math.round(m.received)}`) : ""}</span>
              <div className="w-full bg-emerald-700 rounded-t-md" style={{ height: `${(m.received / maxBar) * 100}%`, minHeight: m.received ? 4 : 0 }} />
              <span className="text-xs font-semibold text-slate-600">{m.label}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Where bookings drop off, last 90 days</SectionTitle>
        <div className="flex flex-col gap-2.5">
          {f.steps.map((st, i) => {
            const pct = f.steps[0].count ? Math.round((st.count / f.steps[0].count) * 100) : 0;
            return (
              <div key={st.label} className="flex flex-col gap-1">
                <div className="flex justify-between text-[13px]"><span className="font-semibold text-slate-800">{st.label}</span><span className="text-slate-700">{st.count}{i > 0 ? ` · ${pct}%` : ""}</span></div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-[#062c24] rounded-full" style={{ width: `${f.steps[0].count ? (st.count / f.steps[0].count) * 100 : 0}%` }} /></div>
              </div>
            );
          })}
        </div>
        {f.cancelled > 0 && (
          <div className="border-t border-slate-200 pt-3 flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-slate-800">Why {f.cancelled} order{f.cancelled === 1 ? " was" : "s were"} cancelled</span>
            {f.reasons.map(r => (
              <div key={r.reason} className="flex justify-between text-[13px] text-slate-700"><span>{r.reason}</span><span className="font-semibold">{r.count}</span></div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>Top items by rental received</SectionTitle>
        {top.length === 0 ? <p className="text-[13px] text-slate-600">No paid orders yet.</p> : (
          <ol className="flex flex-col gap-2.5">
            {top.map((it, i) => (
              <li key={it.name} className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <span className="flex-1 min-w-0 flex flex-col"><span className="text-sm font-semibold text-slate-900 truncate">{it.name}</span><span className="text-xs text-slate-600">{it.qty} rented</span></span>
                <span className="text-sm font-bold text-emerald-800">{rm(it.revenue)}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {leads.length > 0 && (
        <Card>
          <SectionTitle>Recent booking requests</SectionTitle>
          <ul className="flex flex-col">
            {leads.map(l => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2 border-t border-slate-100 first:border-t-0">
                <span className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-900">{l.creditDeducted ? "New customer" : "Returning visitor"}</span>
                  <span className="text-xs text-slate-600">{l.timestamp?.toDate?.()?.toLocaleDateString("en-MY", { day: "numeric", month: "short" }) || "Just now"}{l.creditDeducted ? " · 1 credit used" : " · no credit used"}</span>
                </span>
                {typeof l.totalAmount === "number" && <span className="text-sm font-bold text-slate-800">{rm(l.totalAmount)}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
