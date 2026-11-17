"use client";

// Admin › Orders: every order on the platform, with the vendor's view of it.

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  STAGES, formatDateRange, getNextAction, getPayment, getStage, toMillis, type Order,
} from "@/lib/orderFlow";
import { adminOrderAction, type AdminOrderAction } from "@/lib/adminOrders";
import {
  BottomSheet, Chip, ConfirmSheet, EmptyState, PageHeader, SearchInput, Segments, SummaryStrip, Toast, hintCls, smallBtn, useToast,
} from "@/components/ui/kit";

type AOrder = Order & { id: string; vendorId: string; vendorName?: string; status: string };
type StatusKey = "all" | "pending" | "confirmed" | "completed" | "cancelled" | "conflict";

const STATUS: Record<string, { label: string; tone: "warn" | "info" | "good" | "danger" | "neutral" }> = {
  pending: { label: "New request", tone: "warn" },
  confirmed: { label: "Confirmed", tone: "info" },
  completed: { label: "Completed", tone: "good" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  conflict: { label: "Stock conflict", tone: "danger" },
};
const statusOf = (s?: string) => STATUS[s || ""] || { label: s || "Unknown", tone: "neutral" as const };
const rm = (n: number) => `RM ${Math.round(n).toLocaleString()}`;
const when = (ms: number) => (ms ? new Date(ms).toLocaleString("en-MY", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "–");

export default function OrdersTab({ initialStatus }: { initialStatus?: string }) {
  const [orders, setOrders] = useState<AOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusKey>((["pending", "confirmed", "completed", "cancelled", "conflict"] as StatusKey[]).includes(initialStatus as StatusKey) ? initialStatus as StatusKey : "all");
  const [selected, setSelected] = useState<string | null>(null);
  const [action, setAction] = useState<AdminOrderAction | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast();

  async function load() {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(500)));
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as AOrder)).filter(o => !o.deleted));
    } catch (e) { console.error(e); show("Could not load orders", "error"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const count = (k: StatusKey) => (k === "all" ? orders.length : orders.filter(o => o.status === k).length);
  const q = search.trim().toLowerCase();
  const list = orders.filter(o => (status === "all" || o.status === status)
    && (!q || [o.id, o.customerName, o.customerPhone, o.vendorName].some(x => x?.toLowerCase().includes(q))));

  const totals = useMemo(() => ({
    pending: orders.filter(o => o.status === "pending").length,
    active: orders.filter(o => o.status === "confirmed").length,
    value: orders.filter(o => o.status === "completed").reduce((a, o) => a + getPayment(o).rental, 0),
  }), [orders]);

  const order = orders.find(o => o.id === selected) || null;

  async function doAction(reason: string) {
    if (!order || !action) return;
    setBusy(true);
    try {
      await adminOrderAction(order, action, reason);
      show(action === "cancel" ? "Order cancelled" : action === "complete" ? "Order completed" : "Order confirmed");
      setAction(null);
      await load();
    } catch (e) { console.error(e); show("Could not update the order", "error"); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Orders" subtitle="Every booking on the platform. Vendors handle their own orders; step in only when needed."
        action={<button type="button" onClick={load} aria-label="Refresh" className="w-11 h-11 rounded-xl border border-slate-300 bg-white text-slate-700 flex items-center justify-center hover:bg-slate-50"><i className={`fas fa-rotate ${loading ? "fa-spin" : ""}`} aria-hidden="true"></i></button>} />
      <SummaryStrip items={[
        { value: totals.pending, label: "New requests" },
        { value: totals.active, label: "Confirmed, in progress" },
        { value: rm(totals.value), label: "Completed rental value" },
      ]} />
      <SearchInput id="order-search" value={search} onChange={setSearch} placeholder="Search customer, phone, shop or order ID" />
      <Segments label="Order status" value={status} onChange={setStatus} items={([
        ["all", "All"], ["pending", "New"], ["confirmed", "Confirmed"], ["completed", "Completed"], ["cancelled", "Cancelled"], ["conflict", "Conflict"],
      ] as [StatusKey, string][]).filter(([k]) => k === "all" || k === status || count(k) > 0).map(([k, l]) => ({ key: k, label: `${l} · ${count(k)}` }))} />

      {loading && !orders.length ? <p className="text-sm text-slate-600" role="status">Loading orders</p>
        : list.length === 0 ? <EmptyState icon="fa-receipt" title={q ? "No orders match your search" : "No orders here"} />
        : (
          <div className="flex flex-col gap-2.5">
            {list.map(o => {
              const st = statusOf(o.status);
              const p = getPayment(o);
              return (
                <button key={o.id} type="button" onClick={() => setSelected(o.id)}
                  className="text-left bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-3 hover:border-slate-400">
                  <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className="text-[15px] font-bold text-slate-900 truncate">{o.customerName || o.customerPhone || "Customer"}</span>
                      <Chip tone={st.tone}>{st.label}</Chip>
                    </span>
                    <span className="text-[13px] text-slate-600 truncate">{o.vendorName || "Unknown shop"} · {formatDateRange(o.bookingDates)}</span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block text-sm font-bold text-slate-900">{rm(p.total)}</span>
                    <span className="text-xs text-slate-600">{p.fullyReceived ? "Paid" : p.nothingReceived ? "Unpaid" : "Part paid"}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

      {order && !action && (
        <BottomSheet title={order.customerName || order.customerPhone || "Order"} onClose={() => setSelected(null)}>
          <OrderSummary order={order} />
          <a href={`/store?admin_override=${order.vendorId}&tab=orders&order=${order.id}`} target="_blank" rel="noreferrer"
            className="min-h-12 rounded-2xl bg-[#062c24] text-white text-[15px] font-bold flex items-center justify-center hover:bg-[#0a4135]">
            <i className="fas fa-key mr-2" aria-hidden="true"></i>Open in the vendor&apos;s dashboard
          </a>
          <p className={`${hintCls} text-center -mt-2`}>Every step is there: payments, agreement, pickup, return and deposit.</p>
          {order.status !== "cancelled" && order.status !== "completed" && (
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
              <p className="text-[13px] font-semibold text-slate-700">Step in as admin</p>
              <div className="flex flex-wrap gap-2">
                {(order.status === "pending" || order.status === "conflict") && <button type="button" className={smallBtn} onClick={() => setAction("confirm")}>Confirm</button>}
                <button type="button" className={smallBtn} onClick={() => setAction("complete")}>Mark completed</button>
                <button type="button" className={`${smallBtn} text-red-800 border-red-200`} onClick={() => setAction("cancel")}>Cancel order</button>
              </div>
            </div>
          )}
        </BottomSheet>
      )}

      {order && action && (
        <ConfirmSheet busy={busy} onClose={() => setAction(null)} onConfirm={doAction}
          tone={action === "cancel" ? "danger" : "primary"}
          title={action === "cancel" ? "Cancel this order?" : action === "complete" ? "Mark as completed?" : "Confirm this order?"}
          confirmLabel={action === "cancel" ? "Cancel order" : action === "complete" ? "Mark completed" : "Confirm order"}
          body={<p>{action === "cancel"
            ? "The booking is cancelled and the dates are freed in the shop's calendar. The vendor sees your reason."
            : action === "complete"
              ? "The order is closed, the dates are freed and the review link becomes ready. Payments are not changed."
              : "The order moves to confirmed. The vendor still records payments and pickup."}</p>}
          reason={{ label: "Reason", placeholder: "Recorded in the order history", required: action === "cancel" }} />
      )}
      <Toast toast={toast} />
    </div>
  );
}

function OrderSummary({ order }: { order: AOrder }) {
  const p = getPayment(order);
  const stage = getStage(order);
  const next = getNextAction(order);
  const idx = STAGES.findIndex(s => s.key === stage);
  const row = (label: string, value: string) => <div className="flex justify-between gap-3 text-sm"><span className="text-slate-600">{label}</span><span className="font-semibold text-right">{value}</span></div>;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5 -mt-1">
        <Chip tone={statusOf(order.status).tone}>{statusOf(order.status).label}</Chip>
        {stage !== "cancelled" && idx >= 0 && <Chip>Step {idx + 1} of {STAGES.length}: {STAGES[idx].label}</Chip>}
      </div>
      {next.reason && <p className="text-sm bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5"><b>Vendor&apos;s next step:</b> {next.label || next.reason}{next.label && next.reason ? ` (${next.reason})` : ""}</p>}
      <div className="flex flex-col gap-1.5">
        {row("Shop", order.vendorName || "Unknown")}
        {row("Customer", [order.customerName, order.customerPhone].filter(Boolean).join(" · ") || "–")}
        {row("Dates", formatDateRange(order.bookingDates))}
        {order.pickupLocation && row(order.fulfillmentType === "delivery" ? "Delivery to" : "Pickup at", order.pickupLocation)}
        {row("Booked", when(toMillis(order.createdAt)))}
        {row("Order ID", order.id)}
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-[13px] font-semibold text-slate-700">Items</p>
        {(order.items || []).map((it, i) => (
          <div key={i} className="flex justify-between gap-3 text-sm">
            <span>{it.qty}× {it.name}{it.variantLabel ? ` (${it.variantLabel})` : ""}</span>
            <span className="font-semibold">{rm(it.lineTotal ?? it.price * it.qty)}</span>
          </div>
        ))}
        {order.promoCode && <p className={hintCls}>Promo code {order.promoCode}</p>}
      </div>
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 flex flex-col gap-1.5">
        {row("Rental", `${rm(p.rental)} · ${p.rentalReceived ? "received" : "not received"}`)}
        {p.deposit > 0 && row("Deposit", `${rm(p.deposit)} · ${p.depositOutcome ? (p.depositOutcome === "refunded" ? "refunded" : `RM ${p.depositKept} kept`) : p.depositReceived ? "held" : "not received"}`)}
        {row("Total", rm(p.total))}
      </div>
      {!!order.history?.length && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[13px] font-semibold text-slate-700">History</p>
          {[...order.history].reverse().slice(0, 8).map((h, i) => (
            <p key={i} className="text-[13px] text-slate-700">
              <span className="text-slate-600">{new Date(h.at).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
              {" · "}{h.type.replace(/_/g, " ")}{h.via === "admin" ? " (admin)" : ""}{h.note ? `: ${h.note}` : ""}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
