"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import {
  type Order, getNextAction, getStage, getPayment, sortForGroup, summarize, daysUntil, toMillis, formatDateRange,
} from "@/lib/orderFlow";
import { setupChecklist, type VendorSettings } from "@/lib/vendorSettings";
import { SummaryStrip, SectionTitle, Chip, EmptyState, smallBtn } from "@/components/ui/kit";
import { customerLabel, itemsSummary } from "@/components/orders/OrderCard";

type HomeTabProps = {
  vendorId: string;
  vendorData: VendorSettings & { name?: string; credits?: number; [key: string]: unknown };
  onNavigate: (tab: string, extra?: Record<string, string>) => void;
};

const toneMap = { danger: "danger", warn: "warn", info: "info", neutral: "neutral", good: "good" } as const;

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function HomeTab({ vendorId, vendorData, onNavigate }: HomeTabProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "orders"), where("vendorId", "==", vendorId)), snap => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)).filter(o => !o.deleted));
      setLoading(false);
    }, e => { console.error("Orders listener error:", e); setLoading(false); });
    return () => unsub();
  }, [vendorId]);

  const now = new Date();
  const summary = useMemo(() => summarize(orders, new Date()), [orders]);
  const nextActions = useMemo(() => sortForGroup(orders, "action", new Date()).slice(0, 3), [orders]);

  // Gear going out and coming back, today and tomorrow
  const movements = useMemo(() => {
    const now = new Date();
    const rows: { order: Order; kind: "out" | "back"; day: 0 | 1 }[] = [];
    for (const o of orders) {
      const st = getStage(o);
      const ds = daysUntil(o.bookingDates?.start, now);
      const de = daysUntil(o.bookingDates?.end, now);
      if (st === "confirmed" && (ds === 0 || ds === 1)) rows.push({ order: o, kind: "out", day: ds as 0 | 1 });
      if (st === "picked_up" && (de === 0 || de === 1)) rows.push({ order: o, kind: "back", day: de as 0 | 1 });
    }
    return rows.sort((a, b) => a.day - b.day || (a.kind === "out" ? -1 : 1));
  }, [orders]);
  const today = movements.filter(m => m.day === 0);
  const tomorrow = movements.filter(m => m.day === 1);

  // Rental recorded as received this month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthCollected = orders.reduce((s, o) => {
    if (o.status === "cancelled") return s;
    const p = getPayment(o);
    const when = toMillis(o.rentalReceivedAt) || (p.rentalReceived ? toMillis(o.completedAt) || toMillis(o.createdAt) : 0);
    return p.rentalReceived && when >= monthStart ? s + p.rental : s;
  }, 0);

  const checklist = setupChecklist(vendorData);
  const todo = checklist.filter(i => !i.done);
  const credits = vendorData.credits ?? 0;

  const openOrder = (id: string) => onNavigate("orders", { order: id });

  return (
    <div className="flex flex-col gap-4 pb-24">
      <div>
        <p className="text-[13px] font-semibold text-slate-600">{greeting()}</p>
        <h1 style={{ textTransform: "none" }} className="text-[28px] leading-tight font-extrabold text-[#062c24] truncate">{vendorData.name || "Your shop"}</h1>
        <p className="text-[13px] text-slate-600 mt-0.5">
          {loading ? "Loading today's bookings"
            : today.length ? `Today: ${today.filter(m => m.kind === "out").length} going out, ${today.filter(m => m.kind === "back").length} coming back`
            : "Nothing going out or coming back today"}
        </p>
      </div>

      <SummaryStrip items={[
        { value: summary.action, label: "Need action" },
        { value: `RM ${summary.toCollect.toLocaleString()}`, label: "To collect" },
        { value: `RM ${monthCollected.toLocaleString()}`, label: `Received in ${now.toLocaleDateString("en-MY", { month: "long" })}` },
      ]} />

      {credits <= 5 && (
        <button type="button" onClick={() => onNavigate("settings", { group: "account" })}
          className={`text-left rounded-2xl border px-4 py-3.5 flex items-center gap-3 ${credits === 0 ? "bg-red-50 border-red-200" : "bg-amber-100 border-amber-300"}`}>
          <i className={`fas fa-coins ${credits === 0 ? "text-red-800" : "text-amber-900"}`} aria-hidden="true"></i>
          <span className="flex-1 flex flex-col gap-0.5">
            <span className={`text-sm font-bold ${credits === 0 ? "text-red-900" : "text-amber-900"}`}>{credits === 0 ? "No credits left" : `${credits} credit${credits === 1 ? "" : "s"} left`}</span>
            <span className={`text-[13px] ${credits === 0 ? "text-red-900" : "text-amber-900"}`}>{credits === 0 ? "New customers cannot send you booking requests until you top up." : "Top up so you keep receiving new booking requests."}</span>
          </span>
          <i className="fas fa-chevron-right text-slate-500" aria-hidden="true"></i>
        </button>
      )}

      {todo.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[15px] font-bold text-[#062c24]">Finish setting up your shop</span>
            <span className="text-xs font-semibold text-slate-600">{checklist.length - todo.length} of {checklist.length}</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden"><div className="h-full bg-emerald-600" style={{ width: `${Math.round(((checklist.length - todo.length) / checklist.length) * 100)}%` }} /></div>
          <ul className="flex flex-col">
            {todo.slice(0, 3).map(item => (
              <li key={item.key}>
                <button type="button" onClick={() => item.section === "inventory" ? onNavigate("inventory") : item.group === "storefront" ? onNavigate("shop", { section: "storefront" }) : onNavigate("settings", { group: item.group, section: item.section })}
                  className="w-full min-h-11 flex items-center gap-3 text-left text-sm text-slate-800">
                  <span className="w-[18px] h-[18px] rounded-full border-2 border-slate-400 shrink-0" aria-hidden="true"></span>
                  <span className="flex-1">{item.label}</span>
                  <i className="fas fa-chevron-right text-slate-400 text-xs" aria-hidden="true"></i>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <SectionTitle action={summary.action > 3 ? <button type="button" onClick={() => onNavigate("orders")} className="text-[13px] font-semibold text-emerald-800 underline">See all {summary.action}</button> : undefined}>
          Next actions
        </SectionTitle>
        {loading ? (
          <div className="h-20 bg-white border border-slate-200 rounded-2xl animate-pulse" />
        ) : nextActions.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3.5 flex items-center gap-3">
            <i className="fas fa-check-circle text-emerald-700" aria-hidden="true"></i>
            <span className="text-sm text-slate-700">{orders.length ? "You are up to date. Nothing needs your action." : "No orders yet. They appear here when customers book through your shop."}</span>
          </div>
        ) : nextActions.map(o => {
          const a = getNextAction(o, now);
          return (
            <button key={o.id} type="button" onClick={() => openOrder(o.id)}
              className="text-left bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-3 hover:border-slate-400">
              <span className="flex-1 min-w-0 flex flex-col gap-1">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-[15px] font-bold text-slate-900 truncate">{customerLabel(o)}</span>
                  <Chip tone={toneMap[a.tone]}>{a.tag}</Chip>
                </span>
                <span className="text-[13px] text-slate-600 truncate">{a.reason}</span>
              </span>
              <span className="text-[13px] font-bold text-[#062c24] whitespace-nowrap">{a.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        <SectionTitle action={<button type="button" onClick={() => onNavigate("calendar")} className="text-[13px] font-semibold text-emerald-800 underline">Open calendar</button>}>
          Gear going out and coming back
        </SectionTitle>
        {loading ? (
          <div className="h-20 bg-white border border-slate-200 rounded-2xl animate-pulse" />
        ) : movements.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3.5 text-sm text-slate-700">No pickups or returns today or tomorrow.</div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            {[{ label: "Today", rows: today }, { label: "Tomorrow", rows: tomorrow }].filter(g => g.rows.length).map(g => (
              <div key={g.label}>
                <p className="px-4 pt-3 pb-1 text-xs font-bold text-slate-600">{g.label}</p>
                {g.rows.map(({ order, kind }) => (
                  <button key={`${order.id}-${kind}`} type="button" onClick={() => openOrder(order.id)}
                    className="w-full text-left px-4 py-2.5 flex items-center gap-3 border-t border-slate-100 first:border-t-0 hover:bg-slate-50">
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${kind === "out" ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800"}`} aria-hidden="true">
                      <i className={`fas ${kind === "out" ? "fa-arrow-up" : "fa-arrow-down"}`}></i>
                    </span>
                    <span className="flex-1 min-w-0 flex flex-col">
                      <span className="text-sm font-semibold text-slate-900 truncate">{kind === "out" ? "Pickup" : "Return"} · {customerLabel(order)}</span>
                      <span className="text-xs text-slate-600 truncate">{itemsSummary(order)} · {formatDateRange(order.bookingDates)}</span>
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {!loading && orders.length === 0 && todo.length === 0 && (
        <EmptyState icon="fa-campground" title="Your shop is ready" body="Share your shop link so campers can book."
          action={<button type="button" onClick={() => onNavigate("shop")} className={smallBtn}>Go to Shop page</button>} />
      )}
    </div>
  );
}
