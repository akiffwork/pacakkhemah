"use client";

// Admin › Money: top-up requests, credit sales and every credit change.

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { netRevenue } from "@/lib/credits";
import { toMillis } from "@/lib/orderFlow";
import {
  Card, Chip, EmptyState, PageHeader, SectionTitle, Segments, StatCard, Toast, primarySmallBtn, smallBtn, useToast,
} from "@/components/ui/kit";
import TopUpRequests from "./TopUpRequests";
import CreditChangeSheet from "./CreditChangeSheet";
import type { AdminVendor } from "./types";

type Tx = { id: string; vendorId: string; vendorName?: string; amount?: number; credits?: number; type?: string; note?: string; source?: string; createdAt?: unknown };
type Range = "7" | "30" | "90" | "all";
type TypeFilter = "all" | "purchase" | "bonus" | "refund" | "adjustment";

const TYPE: Record<string, { label: string; tone: "good" | "info" | "danger" | "neutral" }> = {
  purchase: { label: "Purchase", tone: "good" },
  bonus: { label: "Bonus", tone: "info" },
  refund: { label: "Refund", tone: "danger" },
  adjustment: { label: "Correction", tone: "neutral" },
};
const rm = (n: number) => `RM ${Math.round(n).toLocaleString()}`;

export default function FinanceTab({ allVendors }: { allVendors: AdminVendor[] }) {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>("30");
  const [type, setType] = useState<TypeFilter>("all");
  const [shown, setShown] = useState(30);
  const [changing, setChanging] = useState<AdminVendor | "pick" | null>(null);
  const { toast, show } = useToast();

  async function load() {
    try {
      const snap = await getDocs(query(collection(db, "transactions"), orderBy("createdAt", "desc"), limit(1000)));
      setTxs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tx)));
    } catch (e) { console.error(e); show("Could not load transactions", "error"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const s = useMemo(() => {
    const from = range === "all" ? 0 : Date.now() - Number(range) * 86_400_000;
    const inRange = txs.filter(t => toMillis(t.createdAt) >= from);
    const purchases = inRange.filter(t => t.type === "purchase");
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i));
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const value = netRevenue(txs.filter(t => { const ms = toMillis(t.createdAt); const x = new Date(ms); return ms > 0 && `${x.getFullYear()}-${x.getMonth()}` === key; }));
      return { label: d.toLocaleDateString("en-MY", { month: "short" }), value };
    });
    return {
      sales: netRevenue(inRange),
      creditsSold: purchases.reduce((a, t) => a + (t.credits || 0), 0),
      refunds: inRange.filter(t => t.type === "refund").reduce((a, t) => a + (t.amount || 0), 0),
      average: purchases.length ? purchases.reduce((a, t) => a + (t.amount || 0), 0) / purchases.length : 0,
      months,
      list: inRange.filter(t => type === "all" || t.type === type),
    };
  }, [txs, range, type]);

  const low = allVendors.filter(v => v.status === "approved" && (v.credits || 0) <= 5).sort((a, b) => (a.credits || 0) - (b.credits || 0));
  const max = Math.max(1, ...s.months.map(m => m.value));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Money" subtitle="Top-up requests, credit sales and every credit change"
        action={<button type="button" className={primarySmallBtn} onClick={() => setChanging("pick")}><i className="fas fa-plus mr-1.5" aria-hidden="true"></i>Change credits</button>} />

      <TopUpRequests onChanged={load} notify={show} />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <SectionTitle>Credit sales</SectionTitle>
        <Segments label="Time range" value={range} onChange={setRange}
          items={[{ key: "7", label: "7 days" }, { key: "30", label: "30 days" }, { key: "90", label: "90 days" }, { key: "all", label: "All time" }]} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Sales after refunds" value={rm(s.sales)} />
        <StatCard label="Credits sold" value={s.creditsSold.toLocaleString()} />
        <StatCard label="Refunded" value={rm(s.refunds)} tone={s.refunds ? "warn" : undefined} />
        <StatCard label="Average purchase" value={rm(s.average)} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h2 style={{ textTransform: "none" }} className="text-[15px] font-bold text-[#062c24]">Last 6 months</h2>
          <div className="flex items-end gap-2 h-36" role="img" aria-label="Credit sales by month">
            {s.months.map(m => (
              <div key={m.label} className="flex-1 h-full flex flex-col items-center justify-end gap-1">
                {m.value > 0 && <span className="text-xs font-semibold text-slate-700">{Math.round(m.value)}</span>}
                <div className="w-full bg-emerald-600 rounded-t" style={{ height: `${(Math.max(0, m.value) / max) * 100}%` }}></div>
                <span className="text-xs text-slate-600">{m.label}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 style={{ textTransform: "none" }} className="text-[15px] font-bold text-[#062c24]">Shops running low</h2>
          {low.length === 0 ? <p className="text-sm text-slate-700">Every live shop has more than 5 credits.</p> : (
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
              {low.map(v => (
                <div key={v.id} className="flex items-center justify-between gap-3 border border-slate-200 rounded-xl px-3.5 py-2.5">
                  <span className="min-w-0"><span className="block text-sm font-semibold truncate">{v.name}</span>
                    <span className={`text-xs font-semibold ${(v.credits || 0) <= 0 ? "text-red-800" : "text-amber-800"}`}>{v.credits || 0} credits left</span></span>
                  <button type="button" className={smallBtn} onClick={() => setChanging(v)}>Add credits</button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <section className="flex flex-col gap-3">
        <SectionTitle>All credit changes</SectionTitle>
        <Segments label="Type" role="group" value={type} onChange={t => { setType(t); setShown(30); }} items={[
          { key: "all", label: "All" }, { key: "purchase", label: "Purchases" }, { key: "bonus", label: "Bonuses" }, { key: "refund", label: "Refunds" }, { key: "adjustment", label: "Corrections" },
        ]} />
        {loading ? <p className="text-sm text-slate-600" role="status">Loading</p> : s.list.length === 0 ? <EmptyState icon="fa-receipt" title="No credit changes in this period" /> : (
          <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
            {s.list.slice(0, shown).map(t => {
              const meta = TYPE[t.type || ""] || { label: t.type || "Other", tone: "neutral" as const };
              const sign = t.type === "refund" ? "−" : (t.credits || 0) < 0 ? "" : "+";
              return (
                <div key={t.id} className="px-4 py-3 flex items-center gap-3">
                  <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="flex items-center gap-2 flex-wrap"><span className="text-sm font-semibold truncate">{t.vendorName || "Unknown shop"}</span><Chip tone={meta.tone}>{meta.label}</Chip></span>
                    <span className="text-xs text-slate-600 truncate">
                      {toMillis(t.createdAt) ? new Date(toMillis(t.createdAt)).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" }) : "–"}
                      {t.note ? ` · ${t.note}` : ""}
                    </span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block text-sm font-bold">{sign}{t.credits || 0} credits</span>
                    {!!t.amount && <span className="text-xs text-slate-600">{rm(t.amount)}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {s.list.length > shown && <button type="button" className={smallBtn} onClick={() => setShown(n => n + 50)}>Show more ({s.list.length - shown} left)</button>}
      </section>

      {changing && <CreditChangeSheet vendor={changing === "pick" ? null : changing} vendors={allVendors}
        onClose={() => setChanging(null)} onDone={(m, t) => { show(m, t); if (t !== "error") load(); }} />}
      <Toast toast={toast} />
    </div>
  );
}
