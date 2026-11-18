"use client";

import { useState, type ReactNode } from "react";
import {
  type Order, type NextAction, type PaymentChange,
  getStage, getPayment, daysUntil, agreementOk,
  formatShortDate, toMillis,
} from "@/lib/orderFlow";
import { type MsgKind, type MsgLang, MESSAGE_LABELS } from "@/lib/orderMessages";
import { ProgressStrip, customerLabel, toneChip } from "./OrderCard";
import { downloadAgreement, useVendorBits, type Agreement } from "./AgreementsView";
import RentalItems from "./RentalItems";
import { summaryFromOrder } from "@/lib/rentalSummary";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type UnlinkedAgreement = {
  id: string;
  customerName: string;
  customerPhone?: string;
  timestamp?: { toDate?: () => Date };
  orderId?: string | null;
};

export type DetailHandlers = {
  onAction: (order: Order) => void;
  onMessage: (order: Order, kind: MsgKind) => void;
  onPayment: (order: Order, change: PaymentChange) => void;
  onSettle: (order: Order) => void;
  onPickup: (order: Order) => void;
  onUndoPickup: (order: Order) => void;
  onCancel: (order: Order) => void;
  onDelete: (order: Order) => void;
  onInvoice: (order: Order) => void;
  onCopyReview: (order: Order) => void;
  onLinkAgreement: (agreementId: string, order: Order) => void;
  onLinkParent: (order: Order, parent: Order) => void;
  onUnlinkParent: (order: Order) => void;
  onSelect: (orderId: string) => void;
  onOpenCalendar?: (order: Order) => void;
};

type Props = {
  order: Order;
  orders: Order[];
  action: NextAction;
  lang: MsgLang;
  setLang: (l: MsgLang) => void;
  busy: boolean;
  generatingInvoice: boolean;
  copiedReview: boolean;
  unlinkedAgreements: UnlinkedAgreement[];
  handlers: DetailHandlers;
  onClose: () => void;
};

const card = "bg-white rounded-2xl border border-slate-200";
const h2 = "text-[17px] font-extrabold text-[#062c24]";
const smallBtn = "min-h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-[13px] font-semibold hover:bg-slate-50 disabled:opacity-60";

const EVENT_LABELS: Record<string, string> = {
  confirmed: "Order confirmed",
  payment_requested: "Payment requested on WhatsApp",
  balance_requested: "Balance requested on WhatsApp",
  agreement_sent: "Agreement link sent",
  pickup_reminder_sent: "Pickup reminder sent",
  return_reminder_sent: "Return reminder sent",
  deposit_received: "Deposit marked received",
  deposit_undone: "Deposit mark undone",
  rental_received: "Rental marked received",
  rental_undone: "Rental mark undone",
  full_payment_received: "Full payment marked received",
  picked_up: "Marked picked up",
  pickup_undone: "Pickup mark undone",
  returned: "Marked returned",
  deposit_settled: "Deposit settled",
  deposit_unsettled: "Deposit settlement undone",
  completed: "Order completed",
  cancelled: "Order cancelled",
  review_sent: "Review link sent",
  message_sent: "Message opened in WhatsApp",
  credit_refunded: "1 credit returned for the customer review",
};

function fmtDateTime(ms: number): string {
  if (!ms) return "";
  return new Date(ms).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function Fold({ title, hint, open, onToggle, children }: { title: string; hint?: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className={`${card} overflow-hidden`}>
      <button type="button" onClick={onToggle} aria-expanded={open}
        className="w-full min-h-13 px-4 flex items-center justify-between gap-3 text-left hover:bg-slate-50">
        <span className="flex flex-col py-2">
          <span className="text-sm font-bold text-slate-900">{title}</span>
          {hint && !open && <span className="text-xs text-slate-600">{hint}</span>}
        </span>
        <i className={`fas ${open ? "fa-chevron-up" : "fa-chevron-down"} text-slate-600`} aria-hidden="true"></i>
      </button>
      {open && <div className="px-4 pb-4 flex flex-col gap-3">{children}</div>}
    </div>
  );
}

function Tick({ on, pending }: { on: boolean; pending?: boolean }) {
  if (on) {
    return <span className="w-7 h-7 rounded-full bg-emerald-700 text-white flex items-center justify-center shrink-0"><i className="fas fa-check text-xs" aria-hidden="true"></i></span>;
  }
  return <span className={`w-7 h-7 rounded-full shrink-0 border-2 ${pending ? "border-dashed border-slate-300" : "border-slate-400"}`} aria-hidden="true"></span>;
}

export default function OrderDetail({
  order, orders, action, lang, setLang, busy, generatingInvoice, copiedReview, unlinkedAgreements, handlers, onClose,
}: Props) {
  const stage = getStage(order);
  const p = getPayment(order);
  const dStart = daysUntil(order.bookingDates?.start);
  const closed = stage === "cancelled" || stage === "completed";
  const nights = order.nights ?? Math.max(0, daysUntil(order.bookingDates?.end) - dStart);

  const [open, setOpen] = useState<Record<string, boolean>>({
    items: stage === "new" || (stage === "confirmed" && dStart <= 0) || stage === "returned",
    booking: stage === "new",
  });
  const toggle = (k: string) => setOpen(s => ({ ...s, [k]: !s[k] }));
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [agreementBusy, setAgreementBusy] = useState(false);
  const vendorBits = useVendorBits(order.vendorId || "");

  async function openAgreementPdf() {
    if (!order.agreementId) return;
    setAgreementBusy(true);
    try {
      const snap = await getDoc(doc(db, "agreements", order.agreementId));
      if (snap.exists()) await downloadAgreement({ id: snap.id, ...snap.data() } as Agreement, vendorBits);
    } catch (e) { console.error(e); }
    finally { setAgreementBusy(false); }
  }
  const [showParentPicker, setShowParentPicker] = useState(false);
  const [parentSearch, setParentSearch] = useState("");

  const itemCount = order.items.length + (order.freeItems?.length || 0);
  const parent = order.parentOrderId ? orders.find(o => o.id === order.parentOrderId) : undefined;
  const children = orders.filter(o => o.parentOrderId === order.id);
  const parentCandidates = orders.filter(o =>
    o.id !== order.id && !o.parentOrderId && o.status !== "cancelled" && !o.deleted &&
    o.bookingDates.start === order.bookingDates.start && o.bookingDates.end === order.bookingDates.end);
  const filteredParents = parentSearch.trim()
    ? parentCandidates.filter(o =>
        (o.customerName || "").toLowerCase().includes(parentSearch.toLowerCase()) ||
        (o.customerPhone || "").includes(parentSearch) || o.id.includes(parentSearch))
    : parentCandidates;

  const messageKinds: MsgKind[] = (() => {
    if (stage === "cancelled") return ["custom"];
    if (stage === "completed") return ["review", "custom"];
    const list: MsgKind[] = [];
    if (stage === "confirmed") list.push("confirm");
    if (p.balanceDue > 0) list.push(p.nothingReceived ? "request_payment" : "request_balance");
    if (!p.nothingReceived) list.push("payment_received");
    if (stage === "confirmed") list.push("pickup_reminder", "gear_ready");
    if (stage === "picked_up") list.push("return_reminder");
    if (p.depositOutcome) list.push("deposit_settled");
    list.push("custom");
    return list;
  })();

  const history = [...(order.history || [])].sort((a, b) => toMillis(b.at) - toMillis(a.at));
  const calloutTone = action.tone === "danger" ? "bg-red-50 border-red-200 text-red-900"
    : action.tone === "warn" ? "bg-amber-100 border-amber-300 text-amber-900"
    : action.tone === "info" ? "bg-blue-100 border-blue-300 text-blue-900"
    : action.tone === "good" ? "bg-emerald-50 border-emerald-200 text-emerald-900"
    : "bg-slate-100 border-slate-200 text-slate-800";

  // Secondary button in the bottom bar
  const secondary: { label: string; run: () => void } | null =
    stage === "new" ? { label: "Decline order", run: () => handlers.onCancel(order) }
    : stage === "confirmed" && action.key !== "mark_picked_up" && action.key !== "mark_returned" ? { label: "Mark as picked up", run: () => handlers.onPickup(order) }
    : null;

  return (
    <div className="fixed inset-0 z-[500] bg-slate-50 flex flex-col" role="dialog" aria-modal="true" aria-label={`Order for ${customerLabel(order)}`}>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto p-4 flex flex-col gap-4">

          {/* Header */}
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} aria-label="Back to orders"
              className="w-11 h-11 rounded-xl border border-slate-200 bg-white text-slate-700 flex items-center justify-center hover:bg-slate-100 shrink-0">
              <i className="fas fa-chevron-left" aria-hidden="true"></i>
            </button>
            <div className="flex-1 min-w-0">
              <h1 style={{ textTransform: "none" }} className={`text-[22px] font-extrabold leading-tight truncate ${order.customerName ? "text-[#062c24]" : "text-slate-600"}`}>{customerLabel(order)}</h1>
              <p className="text-[13px] text-slate-600">
                {formatShortDate(order.bookingDates?.start)} – {formatShortDate(order.bookingDates?.end)} · {nights === 0 ? "Day trip" : `${nights} night${nights === 1 ? "" : "s"}`} · RM {p.total}
              </p>
            </div>
            {order.customerPhone && (
              <a href={`https://wa.me/${order.customerPhone.replace(/[\s\-+()]/g, "")}`} target="_blank" rel="noreferrer" aria-label="Open WhatsApp chat with customer"
                className="w-11 h-11 rounded-xl border border-slate-200 bg-white text-emerald-700 flex items-center justify-center hover:bg-slate-100 shrink-0">
                <i className="fab fa-whatsapp text-lg" aria-hidden="true"></i>
              </a>
            )}
          </div>

          {/* Progress */}
          <div className={`${card} p-4`}>
            <ProgressStrip order={order} labels />
          </div>

          {/* What needs attention */}
          <div className={`rounded-2xl border px-4 py-3.5 flex flex-col gap-1 ${calloutTone}`}>
            <span className="text-sm font-bold">{action.tag}</span>
            <span className="text-[13px]">{action.reason}</span>
            {order.stockConflict && (order.stockConflictDetails || []).map((d, i) => <span key={i} className="text-[13px]">• {d}</span>)}
          </div>

          {/* Payment */}
          {stage !== "new" && (
            <div className={`${card} p-4 flex flex-col gap-3`}>
              <h2 style={{ textTransform: "none" }} className={h2}>Payment</h2>

              {p.deposit > 0 && (
                <div className="flex items-center gap-3">
                  <Tick on={p.depositReceived} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">Deposit · RM {p.deposit}</p>
                    <p className={`text-xs ${p.depositReceived ? "text-slate-600" : "text-amber-800 font-semibold"}`}>
                      {p.depositReceived ? `Received${order.depositReceivedAt ? ` ${fmtDateTime(toMillis(order.depositReceivedAt))}` : ""}` : "Not received"}
                    </p>
                  </div>
                  {stage !== "cancelled" && (p.depositReceived
                    ? (!p.depositOutcome && <button type="button" disabled={busy} onClick={() => handlers.onPayment(order, { kind: "deposit", received: false })} className="min-h-11 px-2.5 text-[13px] font-semibold text-slate-600 underline">Undo</button>)
                    : <button type="button" disabled={busy} onClick={() => handlers.onPayment(order, { kind: "deposit", received: true })} className="min-h-11 px-3.5 rounded-xl border border-[#062c24] bg-white text-[#062c24] text-[13px] font-bold hover:bg-emerald-50">Mark received</button>)}
                </div>
              )}

              <div className="flex items-center gap-3">
                <Tick on={p.rentalReceived} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">Rental · RM {p.rental}</p>
                  <p className={`text-xs ${p.rentalReceived ? "text-slate-600" : "text-amber-800 font-semibold"}`}>
                    {p.rentalReceived ? `Received${order.rentalReceivedAt ? ` ${fmtDateTime(toMillis(order.rentalReceivedAt))}` : ""}` : "Not received"}
                  </p>
                </div>
                {stage !== "cancelled" && (p.rentalReceived
                  ? (stage !== "completed" && <button type="button" disabled={busy} onClick={() => handlers.onPayment(order, { kind: "rental", received: false })} className="min-h-11 px-2.5 text-[13px] font-semibold text-slate-600 underline">Undo</button>)
                  : <button type="button" disabled={busy} onClick={() => handlers.onPayment(order, { kind: "rental", received: true })} className="min-h-11 px-3.5 rounded-xl border border-[#062c24] bg-white text-[#062c24] text-[13px] font-bold hover:bg-emerald-50">Mark received</button>)}
              </div>

              {stage !== "cancelled" && p.nothingReceived && p.deposit > 0 && (
                <button type="button" disabled={busy} onClick={() => handlers.onPayment(order, { kind: "full" })}
                  className="min-h-11 rounded-xl bg-emerald-50 border border-emerald-200 text-[#062c24] text-[13px] font-bold hover:bg-emerald-100">
                  Full payment received · RM {p.total}
                </button>
              )}

              <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
                <span className="text-sm font-semibold">Balance to collect</span>
                <span className={`text-lg font-bold ${p.balanceDue > 0 && stage !== "cancelled" ? "text-amber-800" : "text-emerald-800"}`}>RM {stage === "cancelled" ? 0 : p.balanceDue}</span>
              </div>

              {p.deposit > 0 && (
                <div className="flex items-center gap-3">
                  <Tick on={!!p.depositOutcome} pending={!p.depositHeld} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">Deposit return</p>
                    <p className="text-xs text-slate-600">
                      {p.depositOutcome === "refunded" ? `RM ${p.deposit} refunded`
                        : p.depositOutcome === "kept" ? `RM ${p.deposit} kept${order.depositKeptReason ? ` (${order.depositKeptReason.toLowerCase()})` : ""}`
                        : p.depositOutcome === "partial" ? `RM ${p.depositRefunded} refunded, RM ${p.depositKept} kept${order.depositKeptReason ? ` (${order.depositKeptReason.toLowerCase()})` : ""}`
                        : !p.depositReceived ? "No deposit received"
                        : stage === "returned" || stage === "completed" ? `RM ${p.deposit} still held`
                        : "Opens after the gear is returned"}
                    </p>
                  </div>
                  {p.depositHeld && (stage === "returned" || stage === "completed") && (
                    <button type="button" disabled={busy} onClick={() => handlers.onSettle(order)} className="min-h-11 px-3.5 rounded-xl border border-[#062c24] bg-white text-[#062c24] text-[13px] font-bold hover:bg-emerald-50">Settle</button>
                  )}
                  {p.depositOutcome && stage === "returned" && (
                    <button type="button" disabled={busy} onClick={() => handlers.onPayment(order, { kind: "unsettle" })} className="min-h-11 px-2.5 text-[13px] font-semibold text-slate-600 underline">Undo</button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Agreement */}
          {stage !== "new" && (
            <div className={`${card} p-4 flex flex-col gap-3`}>
              <div className="flex items-center gap-3">
                <Tick on={agreementOk(order)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">Rental agreement</p>
                  <p className={`text-xs ${agreementOk(order) ? "text-slate-600" : "text-amber-800 font-semibold"}`}>
                    {order.parentOrderId ? "Covered by the main order"
                      : order.agreementSigned ? `Signed by customer${order.agreementSignedAt ? `, ${fmtDateTime(toMillis(order.agreementSignedAt))}` : ""}`
                      : order.agreementSentAt ? `Link sent ${fmtDateTime(toMillis(order.agreementSentAt))}, not signed yet`
                      : "Not signed"}
                  </p>
                </div>
                {order.agreementSigned && order.agreementId && !order.parentOrderId && (
                  <button type="button" disabled={agreementBusy} onClick={openAgreementPdf} className={smallBtn}>
                    <i className="fas fa-file-pdf mr-1.5" aria-hidden="true"></i>{agreementBusy ? "Creating" : "PDF"}
                  </button>
                )}
                {!agreementOk(order) && !closed && (
                  <button type="button" onClick={() => handlers.onMessage(order, "agreement")} className={smallBtn}>
                    <i className="fab fa-whatsapp mr-1.5" aria-hidden="true"></i>{order.agreementSentAt ? "Resend" : "Send link"}
                  </button>
                )}
              </div>
              {!agreementOk(order) && !closed && unlinkedAgreements.length > 0 && (
                <>
                  <button type="button" onClick={() => setShowLinkPicker(s => !s)} aria-expanded={showLinkPicker} className={`${smallBtn} w-full`}>
                    <i className="fas fa-link mr-1.5" aria-hidden="true"></i>Link a signed agreement ({unlinkedAgreements.length})
                  </button>
                  {showLinkPicker && (
                    <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                      {unlinkedAgreements.map(a => (
                        <button key={a.id} type="button" onClick={() => { handlers.onLinkAgreement(a.id, order); setShowLinkPicker(false); }}
                          className="min-h-11 flex items-center justify-between gap-3 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 hover:border-[#062c24] text-left">
                          <span>
                            <span className="block text-[13px] font-bold text-slate-900">{a.customerName}</span>
                            <span className="block text-xs text-slate-600">
                              {a.timestamp?.toDate?.()?.toLocaleDateString("en-MY", { day: "numeric", month: "short" }) || ""}{a.customerPhone ? ` · ${a.customerPhone}` : ""}
                            </span>
                          </span>
                          <i className="fas fa-arrow-right text-slate-500 text-xs" aria-hidden="true"></i>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Items: the cart exactly as submitted */}
          <Fold title={`Items · ${itemCount}`} hint={order.items.map(i => `${i.name} x${i.qty}`).join(", ")} open={!!open.items} onToggle={() => toggle("items")}>
            <RentalItems summary={summaryFromOrder(order)} />
          </Fold>

          {/* Booking */}
          <Fold title="Booking details" hint={`${order.fulfillmentType === "delivery" ? "Delivery" : "Pickup"} · ${order.pickupLocation || "location not set"}`} open={!!open.booking} onToggle={() => toggle("booking")}>
            <dl className="flex flex-col gap-2 text-sm">
              {([
                ["Dates", `${formatShortDate(order.bookingDates?.start)} – ${formatShortDate(order.bookingDates?.end)}`],
                ["Fulfilment", order.fulfillmentType === "delivery" ? "Delivery" : "Pickup"],
                [order.fulfillmentType === "delivery" ? "Address" : "Pickup point", order.pickupLocation],
                ["Delivery zone", order.deliveryZone],
                ["Distance", order.deliveryDistanceKm ? `${order.deliveryDistanceKm} km` : ""],
                ["Time slot", order.timeSlot ? `${order.timeSlot}${order.timeSlotTime ? ` (${order.timeSlotTime})` : ""}` : ""],
                ["People", order.pax ? String(order.pax) : ""],
                ["Camping location", order.campingLocation],
                ["Customer phone", order.customerPhone],
                ["Order ID", `#${order.id.slice(-8)}`],
                ["Received", fmtDateTime(toMillis(order.createdAt))],
              ] as [string, string | null | undefined][]).filter(r => r[1]).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-slate-600 shrink-0">{k}</dt>
                  <dd className="font-semibold text-right break-words min-w-0">{v}</dd>
                </div>
              ))}
            </dl>
            {!order.calendarLinked && !closed && (
              <button type="button" onClick={() => handlers.onOpenCalendar?.(order)} className={`${smallBtn} flex items-center justify-center`}>
                <i className="fas fa-calendar-plus mr-1.5" aria-hidden="true"></i>Block these dates on the calendar
              </button>
            )}
          </Fold>

          {/* Review */}
          {stage === "completed" && (
            <div className={`${card} p-4 flex items-center gap-3`}>
              <Tick on={!!order.reviewTokenUsed} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Customer review</p>
                <p className="text-xs text-slate-600">
                  {order.reviewTokenUsed ? "Review received" : order.reviewTokenSentAt ? `Link sent ${fmtDateTime(toMillis(order.reviewTokenSentAt))}, no review yet` : "Link not sent yet"}
                </p>
              </div>
              {!order.reviewTokenUsed && order.reviewToken && (
                <button type="button" onClick={() => handlers.onCopyReview(order)} className={smallBtn}>
                  <i className={`fas ${copiedReview ? "fa-check" : "fa-copy"} mr-1.5`} aria-hidden="true"></i>{copiedReview ? "Copied" : "Copy link"}
                </button>
              )}
            </div>
          )}

          {/* Messages */}
          <Fold title="WhatsApp messages" hint="Reminders and other messages to the customer" open={!!open.messages} onToggle={() => toggle("messages")}>
            <div className="grid grid-cols-2 gap-2">
              {messageKinds.map(k => (
                <button key={k} type="button" onClick={() => handlers.onMessage(order, k)} className={`${smallBtn} flex items-center gap-2 text-left`}>
                  <i className="fab fa-whatsapp text-emerald-700" aria-hidden="true"></i><span>{MESSAGE_LABELS[k]}</span>
                </button>
              ))}
            </div>
            {!order.customerPhone && <p className="text-xs text-slate-600">No phone number saved yet. WhatsApp will ask you to choose the contact.</p>}
          </Fold>

          {/* Invoice */}
          {stage !== "cancelled" && (
            <Fold title="Invoice and receipt" hint="Print-ready PDF" open={!!open.invoice} onToggle={() => toggle("invoice")}>
              <p className="text-[13px] text-slate-600">Creates an LHDN-compliant invoice or receipt PDF for this order. Make sure your TIN is set in Settings, under Tax and Invoice Profile.</p>
              <button type="button" disabled={generatingInvoice} onClick={() => handlers.onInvoice(order)} className={`${smallBtn} w-full`}>
                <i className={`fas ${generatingInvoice ? "fa-spinner fa-spin" : "fa-file-invoice"} mr-1.5`} aria-hidden="true"></i>
                {generatingInvoice ? "Generating" : "Generate invoice or receipt"}
              </button>
            </Fold>
          )}

          {/* Linked orders */}
          {(parent || order.parentOrderId || children.length > 0 || (parentCandidates.length > 0 && !closed)) && (
            <Fold title="Linked orders" hint={order.parentOrderId ? "This is an add-on order" : children.length ? `${children.length} add-on order${children.length === 1 ? "" : "s"}` : "Link as an add-on to another order"} open={!!open.linked} onToggle={() => toggle("linked")}>
              {order.parentOrderId ? (
                <>
                  <p className="text-[13px] text-slate-600">This is an add-on order. It needs no separate deposit or agreement, because the main booking covers it.</p>
                  {parent && (
                    <button type="button" onClick={() => handlers.onSelect(parent.id)} className={`${smallBtn} w-full`}>
                      <i className="fas fa-arrow-left mr-1.5" aria-hidden="true"></i>View main order ({customerLabel(parent)})
                    </button>
                  )}
                  {!closed && <button type="button" onClick={() => handlers.onUnlinkParent(order)} className={`${smallBtn} w-full`}><i className="fas fa-unlink mr-1.5" aria-hidden="true"></i>Remove link</button>}
                </>
              ) : (
                <>
                  {children.map(child => (
                    <button key={child.id} type="button" onClick={() => handlers.onSelect(child.id)}
                      className="min-h-11 flex items-center justify-between gap-3 bg-violet-50 rounded-xl px-3 py-2 border border-violet-200 hover:border-violet-400 text-left">
                      <span>
                        <span className="block text-[13px] font-bold text-slate-900">{child.items.map(i => i.name).join(", ")}</span>
                        <span className="block text-xs text-slate-600">RM {child.totalAmount} · {child.status}</span>
                      </span>
                      <i className="fas fa-arrow-right text-violet-700 text-xs" aria-hidden="true"></i>
                    </button>
                  ))}
                  {parentCandidates.length > 0 && !closed && (
                    <>
                      <button type="button" onClick={() => { setShowParentPicker(s => !s); setParentSearch(""); }} aria-expanded={showParentPicker} className={`${smallBtn} w-full`}>
                        <i className="fas fa-link mr-1.5" aria-hidden="true"></i>Link as add-on to an order on the same dates
                      </button>
                      {showParentPicker && (
                        <div className="flex flex-col gap-2">
                          <label htmlFor="parent-search" className="sr-only">Search orders by name or phone</label>
                          <input id="parent-search" type="text" value={parentSearch} onChange={e => setParentSearch(e.target.value)} placeholder="Search by name or phone"
                            className="min-h-11 bg-white border border-slate-400 rounded-xl px-3 text-base" />
                          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                            {filteredParents.length === 0 ? (
                              <p className="text-center text-[13px] text-slate-600 py-3">No matching orders found</p>
                            ) : filteredParents.map(o => (
                              <button key={o.id} type="button" onClick={() => { handlers.onLinkParent(order, o); setShowParentPicker(false); }}
                                className="min-h-11 flex items-center justify-between gap-3 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200 hover:border-violet-400 text-left">
                                <span className="min-w-0">
                                  <span className="block text-[13px] font-bold text-slate-900 truncate">{customerLabel(o)}</span>
                                  <span className="block text-xs text-slate-600 truncate">{o.items.map(i => i.name).join(", ")} · RM {o.totalAmount}</span>
                                </span>
                                <i className="fas fa-link text-violet-700 text-xs shrink-0" aria-hidden="true"></i>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </Fold>
          )}

          {/* History */}
          <Fold title="Order history" hint={history.length ? `${history.length} update${history.length === 1 ? "" : "s"}` : "No updates recorded yet"} open={!!open.history} onToggle={() => toggle("history")}>
            <ul className="flex flex-col gap-2 text-[13px]">
              {history.map((h, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="text-slate-900">{EVENT_LABELS[h.type] || h.type}{h.note ? `: ${h.note}` : ""}</span>
                  <span className="text-slate-600 whitespace-nowrap">{fmtDateTime(toMillis(h.at))}</span>
                </li>
              ))}
              <li className="flex justify-between gap-3">
                <span className="text-slate-900">Order received</span>
                <span className="text-slate-600 whitespace-nowrap">{fmtDateTime(toMillis(order.createdAt))}</span>
              </li>
            </ul>
            {(order.skips || []).map((s, i) => (
              <p key={i} className={`text-xs px-2.5 py-1.5 rounded-lg ${toneChip.warn}`}>Skipped {s.step}: {s.reason}</p>
            ))}
          </Fold>

          {/* Less common actions */}
          <div className="flex flex-col gap-2 pt-1 pb-2">
            {stage === "picked_up" && (
              <button type="button" disabled={busy} onClick={() => handlers.onUndoPickup(order)} className="min-h-11 text-[13px] font-semibold text-slate-600 underline">Undo &quot;picked up&quot;</button>
            )}
            {!closed && stage !== "new" && (
              <button type="button" onClick={() => handlers.onCancel(order)} className="min-h-11 text-[13px] font-semibold text-red-800 underline">Cancel this order</button>
            )}
            <button type="button" onClick={() => handlers.onDelete(order)} className="min-h-11 text-[13px] font-semibold text-red-800 underline">Delete this order</button>
          </div>
        </div>
      </div>

      {/* Next action, always in reach */}
      {(action.label || secondary) && (
        <div className="bg-white border-t border-slate-200" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="max-w-xl mx-auto px-4 pt-3 pb-4 flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-600">Next action</span>
              <div role="group" aria-label="Message language" className="flex border border-slate-300 rounded-[10px] overflow-hidden">
                {(["en", "bm"] as MsgLang[]).map(l => (
                  <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}
                    className={`min-h-9 px-3 text-xs ${lang === l ? "bg-[#062c24] text-white font-bold" : "bg-white text-slate-700 font-semibold"}`}>
                    {l === "en" ? "English" : "BM"}
                  </button>
                ))}
              </div>
            </div>
            {action.label && (
              <button type="button" disabled={busy} onClick={() => handlers.onAction(order)}
                className="min-h-13 rounded-2xl bg-[#062c24] text-white text-[15px] font-bold flex items-center justify-center gap-2 hover:bg-[#0a4135] disabled:opacity-60">
                {action.whatsapp && <i className="fab fa-whatsapp text-lg" aria-hidden="true"></i>}
                {action.key === "confirm" ? "Confirm and request payment"
                  : action.key === "request_balance" ? `${action.label} RM ${p.balanceDue}`
                  : action.label}
              </button>
            )}
            {secondary && (
              <button type="button" disabled={busy} onClick={secondary.run}
                className="min-h-12 rounded-2xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60">
                {secondary.label}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
