"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection, query, where, onSnapshot, doc, updateDoc,
  orderBy, serverTimestamp, getDocs, deleteDoc, getDoc, arrayUnion,
} from "firebase/firestore";
import { generateInvoicePDF, type InvoiceData, type InvoiceVendor } from "@/lib/invoicePDF";
import {
  type Order, type Group, type DepositOutcome, type PaymentChange,
  getNextAction, getPayment, getStage, paymentPatch, pickupGaps, canComplete,
  summarize, sortForGroup,
} from "@/lib/orderFlow";
import { type MsgKind, type MsgLang, buildMessage, whatsappUrl } from "@/lib/orderMessages";
import OrderCard from "@/components/orders/OrderCard";
import AgreementsView from "@/components/orders/AgreementsView";
import { PageHeader, SummaryStrip, Segments, Toast, useToast } from "@/components/ui/kit";
import OrderDetail, { type DetailHandlers, type UnlinkedAgreement } from "@/components/orders/OrderDetail";
import { PaidSheet, SkipSheet, CancelSheet, SettleSheet, ConflictSheet } from "@/components/orders/OrderSheets";

type OrdersTabProps = {
  vendorId: string;
  vendorName: string;
  /** Open this order's detail on load (from Home, Calendar or a link). */
  initialOrderId?: string | null;
  initialView?: "agreements";
  onOpenCalendar?: (orderId: string) => void;
};

type Sheet =
  | { type: "paid"; mode: "payment" | "balance"; orderId: string }
  | { type: "skip"; orderId: string }
  | { type: "cancel"; orderId: string }
  | { type: "settle"; orderId: string }
  | { type: "conflict"; orderId: string };

const SEGMENTS: { key: Group; label: string }[] = [
  { key: "action", label: "Needs action" },
  { key: "waiting", label: "Waiting on customer" },
  { key: "done", label: "Done" },
];

const LANG_KEY = "pk_order_msg_lang";

export default function OrdersTab({ vendorId, vendorName, initialOrderId, initialView, onOpenCalendar }: OrdersTabProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [segment, setSegment] = useState<Group | "agreements">(initialView || "action");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialOrderId || null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [busy, setBusy] = useState(false);
  const [lang, setLangState] = useState<MsgLang>("en");
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [unlinkedAgreements, setUnlinkedAgreements] = useState<UnlinkedAgreement[]>([]);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  // Re-evaluate "today" every few minutes so urgency stays right on a long-open tab
  const [now, setNow] = useState(() => new Date());

  const { toast, show: showToast } = useToast();

  useEffect(() => {
    try { const saved = localStorage.getItem(LANG_KEY); if (saved === "bm" || saved === "en") setLangState(saved); } catch { /* ignore */ }
    const t = setInterval(() => setNow(new Date()), 5 * 60_000);
    return () => clearInterval(t);
  }, []);

  function setLang(l: MsgLang) {
    setLangState(l);
    try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ }
  }

  // Real-time orders listener
  useEffect(() => {
    const q = query(collection(db, "orders"), where("vendorId", "==", vendorId), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)).filter(o => !o.deleted));
      setLoading(false);
    }, (error) => {
      console.error("Orders listener error:", error);
      setLoading(false);
    });
    return () => unsub();
  }, [vendorId]);

  // Real-time unlinked agreements listener
  useEffect(() => {
    const q = query(collection(db, "agreements"), where("vendorId", "==", vendorId), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setUnlinkedAgreements(snap.docs.map(d => ({ id: d.id, ...d.data() } as UnlinkedAgreement)).filter(a => !a.orderId));
    }, (error) => { console.error("Agreements listener error:", error); });
    return () => unsub();
  }, [vendorId]);

  const summary = useMemo(() => summarize(orders, now), [orders, now]);
  const selectedOrder = selectedId ? orders.find(o => o.id === selectedId) || null : null;
  const sheetOrder = sheet ? orders.find(o => o.id === sheet.orderId) || null : null;
  const parentIds = useMemo(() => new Set(orders.map(o => o.parentOrderId).filter(Boolean) as string[]), [orders]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return segment === "agreements" ? [] : sortForGroup(orders, segment, now);
    const match = (o: Order) =>
      (o.customerName || "").toLowerCase().includes(term) ||
      (o.customerPhone || "").includes(term) ||
      o.id.toLowerCase().includes(term) ||
      o.items.some(i => i.name.toLowerCase().includes(term));
    return (["action", "waiting", "done"] as Group[]).flatMap(g => sortForGroup(orders, g, now)).filter(match);
  }, [orders, segment, search, now]);

  // ── Firestore helpers ─────────────────────────────────────────────────────

  /** Update an order and append one line to its history. */
  async function patch(orderId: string, data: Record<string, unknown>, event: string, note?: string) {
    await updateDoc(doc(db, "orders", orderId), {
      ...data,
      history: arrayUnion({ type: event, at: new Date().toISOString(), via: "orders_tab", ...(note ? { note } : {}) }),
    });
  }

  async function run(fn: () => Promise<void>, failMsg = "Could not update the order. Please try again.") {
    setBusy(true);
    try { await fn(); } catch (e) { console.error("Order update error:", e); showToast(failMsg, "error"); } finally { setBusy(false); }
  }

  async function releaseCalendar(orderId: string) {
    try {
      const availSnap = await getDocs(query(collection(db, "vendors", vendorId, "availability"), where("orderId", "==", orderId)));
      for (const d of availSnap.docs) await deleteDoc(doc(db, "vendors", vendorId, "availability", d.id));
    } catch (e) { console.error("Calendar sync error:", e); }
  }

  // ── Links and messages ────────────────────────────────────────────────────

  // Agreement link with orderId and embedded booking data
  function getAgreementLink(order: Order) {
    if (typeof window === "undefined") return "";
    const base = `${window.location.origin}/agreement?v=${vendorId}&o=${order.id}`;
    try {
      const discounts: { label: string; amount: number }[] = [];
      if (order.autoDiscount) discounts.push({ label: "Extended Stay Discount", amount: order.autoDiscount });
      if (order.minSpendDiscount) discounts.push({ label: "Spend Reward", amount: order.minSpendDiscount });
      if (order.bundleDiscount) discounts.push({ label: "Bundle Deal", amount: order.bundleDiscount });
      if (order.promoCode && order.promoDiscount) {
        const promoLabel = order.promoType === "fixed"
          ? `Promo Code "${order.promoCode}" (RM${order.promoDiscount} off)`
          : `Promo Code "${order.promoCode}"`;
        discounts.push({ label: promoLabel, amount: order.promoDiscount });
      }
      const total = order.manualPrice || order.totalAmount;
      const depositAmount = order.depositAmount;
      const rentalAmount = order.rentalAmount ?? (depositAmount != null ? total - depositAmount : undefined);
      const summaryData = {
        items: order.items.map(i => ({
          name: i.name, qty: i.qty, price: i.price,
          ...(i.variantLabel ? { variantLabel: i.variantLabel, variantColor: i.variantColor } : {}),
        })),
        dates: order.bookingDates,
        ...(discounts.length ? { discounts } : {}),
        ...(order.serviceFee ? { serviceFee: order.serviceFee } : {}),
        ...(rentalAmount != null ? { rentalAmount } : {}),
        ...(depositAmount != null ? { depositAmount } : {}),
        total,
      };
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(summaryData))));
      return `${base}&d=${encoded}`;
    } catch {
      return base;
    }
  }

  function getReviewLink(order: Order): string {
    if (!order.reviewToken || typeof window === "undefined") return "";
    return `${window.location.origin}/review/${order.reviewToken}`;
  }

  /** Open WhatsApp with a ready message. Must run first in a click handler, before any await. */
  function openWhatsApp(order: Order, kind: MsgKind) {
    const msg = buildMessage(kind, lang, order, {
      vendorName,
      agreementLink: kind === "agreement" ? getAgreementLink(order) : undefined,
      reviewLink: kind === "review" ? getReviewLink(order) : undefined,
    });
    window.open(whatsappUrl(order.customerPhone, msg), "_blank");
  }

  // ── Pipeline actions ──────────────────────────────────────────────────────

  function confirmOrder(order: Order) {
    openWhatsApp(order, "confirm");
    run(async () => {
      await patch(order.id, {
        status: "confirmed", confirmedAt: serverTimestamp(), stockConflict: false,
        paymentRequestedAt: serverTimestamp(),
      }, "confirmed");
      // Calendar: replace the "Pending Order" placeholder with the customer's name
      try {
        const name = order.customerName || order.customerPhone || "Customer";
        const availSnap = await getDocs(query(collection(db, "vendors", vendorId, "availability"), where("orderId", "==", order.id)));
        for (const d of availSnap.docs) {
          if (d.data().customer === "Pending Order") await updateDoc(doc(db, "vendors", vendorId, "availability", d.id), { customer: name });
        }
      } catch (e) { console.error("Calendar sync error:", e); }
      setSheet({ type: "paid", mode: "payment", orderId: order.id });
    });
  }

  async function completeOrder(order: Order) {
    await patch(order.id, {
      status: "completed", completedAt: serverTimestamp(),
      reviewToken: order.id, reviewTokenUsed: false,
    }, "completed");
    await releaseCalendar(order.id);
    showToast("Order completed. The review link is ready to send.");
  }

  function markPickedUp(order: Order, reason?: string) {
    const gaps = pickupGaps(order);
    run(async () => {
      const at = new Date().toISOString();
      await patch(order.id, {
        pickedUpAt: serverTimestamp(),
        ...(gaps.length && reason ? { skips: arrayUnion(...gaps.map(g => ({ step: g.step, reason, at }))) } : {}),
      }, "picked_up", gaps.length && reason ? `with ${gaps.map(g => g.label).join(", ")} (${reason})` : undefined);
      setSheet(null);
      showToast("Marked as picked up");
    });
  }

  function markReturned(order: Order) {
    run(async () => {
      await patch(order.id, { returnedAt: serverTimestamp(), ...(order.pickedUpAt ? {} : { pickedUpAt: serverTimestamp() }) }, "returned");
      // Gear is back, so the stock is free again
      await releaseCalendar(order.id);
      const p = getPayment(order);
      if (p.rentalReceived && !p.depositHeld) {
        await completeOrder(order);
      } else if (p.depositHeld) {
        setSheet({ type: "settle", orderId: order.id });
      } else {
        showToast(`Marked as returned. Rental RM ${p.rental} is still unpaid.`);
      }
    });
  }

  function applyPayment(order: Order, change: PaymentChange, opts: { closeSheet?: boolean } = {}) {
    run(async () => {
      const data = paymentPatch(order, change, serverTimestamp());
      if (!Object.keys(data).length) return;
      const event = change.kind === "deposit" ? (change.received ? "deposit_received" : "deposit_undone")
        : change.kind === "rental" ? (change.received ? "rental_received" : "rental_undone")
        : change.kind === "full" ? "full_payment_received"
        : change.kind === "settle" ? "deposit_settled" : "deposit_unsettled";
      const note = change.kind === "settle"
        ? (data.depositOutcome === "refunded" ? "refunded in full" : data.depositOutcome === "kept" ? `kept in full (${change.reason || "no reason"})` : `RM ${data.depositKeptAmount} kept (${change.reason || "no reason"})`)
        : undefined;
      await patch(order.id, data, event, note);
      if (opts.closeSheet) setSheet(null);
      const after = { ...order, ...data } as Order;
      if (canComplete(after)) {
        await completeOrder(after);
      } else if (change.kind === "settle") {
        showToast("Deposit settled");
      } else if (change.kind === "full") {
        showToast("Full payment recorded");
      } else if (change.kind === "deposit" || change.kind === "rental") {
        showToast(change.received ? `${change.kind === "deposit" ? "Deposit" : "Rental"} marked received` : "Undone");
      } else {
        showToast("Undone");
      }
    });
  }

  function cancelOrder(order: Order, reason: string) {
    run(async () => {
      await patch(order.id, { status: "cancelled", cancelledAt: serverTimestamp(), cancelReason: reason }, "cancelled", reason);
      await releaseCalendar(order.id);
      setSheet(null);
      setSelectedId(null);
      showToast("Order cancelled");
    });
  }

  function sendFollowUp(order: Order, kind: MsgKind) {
    openWhatsApp(order, kind);
    const stamp: Partial<Record<MsgKind, [string, string]>> = {
      request_payment: ["paymentRequestedAt", "payment_requested"],
      request_balance: ["balanceRequestedAt", "balance_requested"],
      agreement: ["agreementSentAt", "agreement_sent"],
      pickup_reminder: ["pickupReminderSentAt", "pickup_reminder_sent"],
      return_reminder: ["returnReminderSentAt", "return_reminder_sent"],
      review: ["reviewTokenSentAt", "review_sent"],
    };
    const entry = stamp[kind];
    run(async () => {
      if (entry) await patch(order.id, { [entry[0]]: serverTimestamp() }, entry[1]);
      if (kind === "request_payment") setSheet({ type: "paid", mode: "payment", orderId: order.id });
      else if (kind === "request_balance") setSheet({ type: "paid", mode: "balance", orderId: order.id });
      else if (kind === "agreement") showToast("Agreement link opened in WhatsApp. It updates here once signed.");
    });
  }

  /** The one main button on a card or in the detail view. */
  function runAction(order: Order) {
    const a = getNextAction(order, new Date());
    switch (a.key) {
      case "resolve_conflict": setSheet({ type: "conflict", orderId: order.id }); break;
      case "confirm": confirmOrder(order); break;
      case "request_payment": sendFollowUp(order, "request_payment"); break;
      case "request_balance": sendFollowUp(order, "request_balance"); break;
      case "send_agreement": sendFollowUp(order, "agreement"); break;
      case "pickup_reminder": sendFollowUp(order, "pickup_reminder"); break;
      case "return_reminder": sendFollowUp(order, "return_reminder"); break;
      case "send_review": sendFollowUp(order, "review"); break;
      case "mark_picked_up": requestPickup(order); break;
      case "mark_returned": markReturned(order); break;
      case "settle_deposit": setSheet({ type: "settle", orderId: order.id }); break;
      case "complete": run(() => completeOrder(order)); break;
      default: break;
    }
  }

  function requestPickup(order: Order) {
    if (pickupGaps(order).length) setSheet({ type: "skip", orderId: order.id });
    else markPickedUp(order);
  }

  // ── Less common actions (unchanged behaviour) ─────────────────────────────

  async function linkAgreementToOrder(agreementId: string, order: Order) {
    try {
      const ag = unlinkedAgreements.find(a => a.id === agreementId);
      if (!ag) return;
      await updateDoc(doc(db, "orders", order.id), {
        customerName: ag.customerName,
        customerPhone: ag.customerPhone || "",
        agreementSigned: true,
        agreementSignedAt: serverTimestamp(),
        agreementId,
      });
      await updateDoc(doc(db, "agreements", agreementId), { orderId: order.id });
      try {
        const availSnap = await getDocs(query(collection(db, "vendors", vendorId, "availability"), where("orderId", "==", order.id)));
        for (const d of availSnap.docs) {
          if (d.data().customer === "Pending Order") {
            await updateDoc(doc(db, "vendors", vendorId, "availability", d.id), { customer: ag.customerName, phone: ag.customerPhone || "" });
          }
        }
      } catch (e) { console.error("Calendar update error:", e); }
      showToast("Agreement linked");
    } catch (e) {
      console.error("Link error:", e);
      showToast("Failed to link agreement", "error");
    }
  }

  async function deleteOrder(order: Order) {
    if (!confirm("Delete this order? This action cannot be undone.")) return;
    try {
      await updateDoc(doc(db, "orders", order.id), { deleted: true });
      await releaseCalendar(order.id);
      setSelectedId(null);
      showToast("Order deleted");
    } catch (e) { console.error("Delete order error:", e); showToast("Failed to delete order", "error"); }
  }

  async function linkToParentOrder(order: Order, parentOrder: Order) {
    try {
      await updateDoc(doc(db, "orders", order.id), {
        parentOrderId: parentOrder.id,
        agreementSigned: true,
        agreementId: parentOrder.agreementId || null,
        depositAmount: 0,
        rentalAmount: order.totalAmount,
      });
      showToast("Linked as add-on order");
    } catch (e) { console.error(e); showToast("Failed to link order", "error"); }
  }

  async function unlinkParentOrder(order: Order) {
    if (!confirm("Remove link to the main order?")) return;
    try {
      await updateDoc(doc(db, "orders", order.id), {
        parentOrderId: null,
        agreementSigned: false,
        agreementId: null,
        depositAmount: order.depositAmount,
      });
      showToast("Link removed");
    } catch { showToast("Failed to remove link", "error"); }
  }

  function copyReviewLink(order: Order) {
    navigator.clipboard.writeText(getReviewLink(order));
    setCopiedLink(order.id);
    setTimeout(() => setCopiedLink(null), 2000);
  }

  async function handleGenerateInvoice(order: Order) {
    setGeneratingInvoice(true);
    try {
      const vendorSnap = await getDoc(doc(db, "vendors", vendorId));
      const vd = vendorSnap.data() || {};
      const vendor: InvoiceVendor = { name: vendorName, phone: vd.phone, city: vd.city, taxProfile: vd.taxProfile };
      const invoiceData: InvoiceData = {
        orderId: order.id,
        vendor,
        customerName: order.customerName || "General Public",
        customerPhone: order.customerPhone,
        bookingDates: order.bookingDates,
        pickupLocation: order.pickupLocation || "",
        items: order.items.map(i => ({ name: i.name, qty: i.qty, price: i.price, variantLabel: i.variantLabel })),
        rentalAmount: order.rentalAmount ?? (order.depositAmount != null ? order.totalAmount - order.depositAmount : order.totalAmount),
        depositAmount: order.depositAmount,
        serviceFee: order.serviceFee,
        autoDiscount: order.autoDiscount,
        promoCode: order.promoCode,
        promoDiscount: order.promoDiscount,
        promoType: order.promoType,
        totalAmount: order.totalAmount,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt?.toDate?.() || new Date(),
      };
      generateInvoicePDF(invoiceData);
    } catch (e) {
      console.error("Invoice generation error:", e);
      showToast("Failed to generate invoice", "error");
    } finally {
      setGeneratingInvoice(false);
    }
  }

  const handlers: DetailHandlers = {
    onAction: runAction,
    onMessage: sendFollowUp,
    onPayment: (order, change) => applyPayment(order, change),
    onSettle: (order) => setSheet({ type: "settle", orderId: order.id }),
    onPickup: requestPickup,
    onUndoPickup: (order) => run(async () => { await patch(order.id, { pickedUpAt: null }, "pickup_undone"); showToast("Undone"); }),
    onCancel: (order) => setSheet({ type: "cancel", orderId: order.id }),
    onDelete: deleteOrder,
    onInvoice: handleGenerateInvoice,
    onCopyReview: copyReviewLink,
    onLinkAgreement: linkAgreementToOrder,
    onLinkParent: linkToParentOrder,
    onUnlinkParent: unlinkParentOrder,
    onSelect: setSelectedId,
    onOpenCalendar: (order) => onOpenCalendar?.(order.id),
  };

  const counts: Record<Group, number> = { action: summary.action, waiting: summary.waiting, done: summary.done };

  return (
    <div className="flex flex-col gap-4 pb-24">
      <PageHeader title="Orders" subtitle="Every order shows the one thing to do next" />

      <SummaryStrip items={[
        { value: summary.action, label: "Need action" },
        { value: summary.waiting, label: "Waiting on customer" },
        { value: `RM ${summary.toCollect.toLocaleString()}`, label: "To collect" },
      ]} />

      {/* Search */}
      <div className="relative">
        <label htmlFor="orders-search" className="sr-only">Search orders</label>
        <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm" aria-hidden="true"></i>
        <input id="orders-search" type="search" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, phone or item"
          className="w-full min-h-11 bg-white border border-slate-300 rounded-xl pl-10 pr-3 text-base text-slate-900 placeholder:text-slate-500" />
      </div>

      {/* Segments */}
      {!search.trim() && (
        <Segments label="Order groups" value={segment} onChange={setSegment}
          items={[
            ...SEGMENTS.map(sg => ({ key: sg.key as Group | "agreements", label: `${sg.label}${sg.key !== "done" || counts[sg.key] ? ` · ${counts[sg.key]}` : ""}` })),
            { key: "agreements" as const, label: unlinkedAgreements.length ? `Agreements · ${unlinkedAgreements.length} to link` : "Agreements" },
          ]} />
      )}

      {segment === "agreements" && !search.trim() ? (
        <AgreementsView vendorId={vendorId} onOpenOrder={(id) => setSelectedId(id)} toast={showToast} />
      ) : (<>
      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl p-4 border border-slate-200 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-1/3 mb-3"></div>
              <div className="h-3 bg-slate-100 rounded w-1/2 mb-4"></div>
              <div className="h-12 bg-slate-100 rounded-xl"></div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
          <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <i className={`fas ${segment === "action" && orders.length ? "fa-check" : "fa-inbox"} text-slate-500 text-xl`} aria-hidden="true"></i>
          </div>
          <p className="text-sm font-bold text-slate-800">
            {search.trim() ? "No orders match your search"
              : orders.length === 0 ? "No orders yet"
              : segment === "action" ? "Nothing needs your action"
              : segment === "waiting" ? "No orders are waiting on a customer"
              : "No completed or cancelled orders yet"}
          </p>
          <p className="text-[13px] text-slate-600 mt-1">
            {search.trim() ? "Try a different name, phone number or item."
              : orders.length === 0 ? "Orders appear here when customers book through your shop."
              : segment === "action" ? "New orders and follow-ups will show up here."
              : "Check the other groups above."}
          </p>

          {orders.length === 0 && !search.trim() && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mt-5 text-left">
              <h3 style={{ textTransform: "none" }} className="text-sm font-extrabold text-[#062c24] mb-3">How an order moves</h3>
              <ol className="flex flex-col gap-2.5 text-[13px] text-slate-700">
                {[
                  ["New", "A customer books through your shop. Confirm or decline."],
                  ["Confirmed", "Collect the deposit or full payment and get the agreement signed."],
                  ["Picked up", "Hand over the gear."],
                  ["Returned", "Check the gear, then refund or keep the deposit."],
                  ["Completed", "The order closes itself and the review link is ready to send."],
                ].map(([t, d], i) => (
                  <li key={t} className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#062c24] text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span><span className="font-bold text-slate-900">{t}.</span> {d}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {visible.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              action={getNextAction(order, now)}
              hasAddOns={parentIds.has(order.id)}
              busy={busy}
              onOpen={() => setSelectedId(order.id)}
              onAction={() => runAction(order)}
              onDecline={() => setSheet({ type: "cancel", orderId: order.id })}
            />
          ))}
        </div>
      )}
      </>)}

      {/* Order detail */}
      {selectedOrder && (
        <OrderDetail
          key={`${selectedOrder.id}-${getStage(selectedOrder)}`}
          order={selectedOrder}
          orders={orders}
          action={getNextAction(selectedOrder, now)}
          lang={lang}
          setLang={setLang}
          busy={busy}
          generatingInvoice={generatingInvoice}
          copiedReview={copiedLink === selectedOrder.id}
          unlinkedAgreements={unlinkedAgreements}
          handlers={handlers}
          onClose={() => setSelectedId(null)}
        />
      )}

      {/* Prompts */}
      {sheet && sheetOrder && sheet.type === "paid" && (
        <PaidSheet
          order={sheetOrder}
          mode={sheet.mode}
          onFull={() => applyPayment(sheetOrder, { kind: "full" }, { closeSheet: true })}
          onDeposit={() => applyPayment(sheetOrder, { kind: "deposit", received: true }, { closeSheet: true })}
          onBalance={() => applyPayment(sheetOrder, { kind: "full" }, { closeSheet: true })}
          onNotYet={() => setSheet(null)}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet && sheetOrder && sheet.type === "skip" && (
        <SkipSheet order={sheetOrder} onConfirm={(reason) => markPickedUp(sheetOrder, reason)} onClose={() => setSheet(null)} />
      )}
      {sheet && sheetOrder && sheet.type === "cancel" && (
        <CancelSheet order={sheetOrder} onConfirm={(reason) => cancelOrder(sheetOrder, reason)} onClose={() => setSheet(null)} />
      )}
      {sheet && sheetOrder && sheet.type === "settle" && (
        <SettleSheet
          order={sheetOrder}
          onConfirm={(outcome: DepositOutcome, keptAmount: number, reason: string) =>
            applyPayment(sheetOrder, { kind: "settle", outcome, keptAmount, reason }, { closeSheet: true })}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet && sheetOrder && sheet.type === "conflict" && (
        <ConflictSheet
          order={sheetOrder}
          onOverride={() => { setSheet(null); confirmOrder(sheetOrder); }}
          onCancel={() => setSheet({ type: "cancel", orderId: sheetOrder.id })}
          onClose={() => setSheet(null)}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}
