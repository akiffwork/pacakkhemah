"use client";

import {
  type Order, type NextAction, type Tone,
  STAGES, getStage, stageIndex, getPayment, formatDateRange,
} from "@/lib/orderFlow";

export const toneChip: Record<Tone, string> = {
  danger: "bg-red-100 text-red-800",
  warn: "bg-amber-100 text-amber-800",
  info: "bg-blue-100 text-blue-800",
  neutral: "bg-slate-200 text-slate-700",
  good: "bg-emerald-100 text-emerald-800",
};

export const toneText: Record<Tone, string> = {
  danger: "text-red-800",
  warn: "text-amber-800",
  info: "text-blue-800",
  neutral: "text-slate-700",
  good: "text-emerald-800",
};

const toneIcon: Record<Tone, string> = {
  danger: "fa-exclamation-circle",
  warn: "fa-clock",
  info: "fa-comment-dots",
  neutral: "fa-hourglass-half",
  good: "fa-check-circle",
};

export function customerLabel(o: Order): string {
  return o.customerName || o.customerPhone || "Customer (name not given yet)";
}

export function itemsSummary(o: Order): string {
  if (!o.items?.length) return "No items";
  const first = o.items[0];
  const more = o.items.length - 1 + (o.freeItems?.length || 0);
  return more > 0 ? `${first.name}, ${more} more item${more === 1 ? "" : "s"}` : `${first.name} x${first.qty}`;
}

/** Five-bar strip: reached stages in brand green, the next one in amber. */
export function ProgressStrip({ order, labels = false }: { order: Order; labels?: boolean }) {
  const stage = getStage(order);
  const idx = stageIndex(order);
  const cancelled = stage === "cancelled";
  return (
    <div className="flex flex-col gap-1.5" role="img" aria-label={cancelled ? "Order cancelled" : `Stage ${idx + 1} of 5: ${STAGES[idx].label}`}>
      <div className="grid grid-cols-5 gap-1">
        {STAGES.map((s, i) => (
          <div key={s.key} className={`h-1.5 rounded-full ${
            cancelled ? "bg-slate-200" : i <= idx ? "bg-[#062c24]" : i === idx + 1 ? "bg-amber-500" : "bg-slate-200"
          }`} />
        ))}
      </div>
      {labels ? (
        <div className="grid grid-cols-5 gap-1 text-[11px] font-semibold">
          {STAGES.map((s, i) => (
            <span key={s.key} className={cancelled ? "text-slate-500" : i <= idx ? "text-[#062c24]" : i === idx + 1 ? "text-amber-800" : "text-slate-500"}>{s.label}</span>
          ))}
        </div>
      ) : (
        <div className="flex justify-between text-xs text-slate-600">
          <span>{cancelled ? "Cancelled" : STAGES[idx].label}</span>
          {!cancelled && idx < STAGES.length - 1 && <span>Next: {STAGES[idx + 1].label}</span>}
        </div>
      )}
    </div>
  );
}

type Props = {
  order: Order;
  action: NextAction;
  hasAddOns: boolean;
  busy: boolean;
  onOpen: () => void;
  onAction: () => void;
  onDecline: () => void;
};

export default function OrderCard({ order, action, hasAddOns, busy, onOpen, onAction, onDecline }: Props) {
  const p = getPayment(order);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col gap-3">
      <button type="button" onClick={onOpen} className="text-left flex flex-col gap-3 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#062c24]">
        <div className="flex items-center justify-between gap-2 w-full">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${toneChip[action.tone]}`}>{action.tag}</span>
            {order.parentOrderId && <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-violet-100 text-violet-800">Add-on</span>}
            {hasAddOns && <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-violet-100 text-violet-800">Has add-ons</span>}
          </div>
          <span className="text-[15px] font-bold text-[#062c24] whitespace-nowrap">RM {p.total}</span>
        </div>
        <div className="flex flex-col gap-0.5 w-full">
          <span className={`text-base font-bold ${order.customerName ? "text-slate-900" : "text-slate-600"}`}>{customerLabel(order)}</span>
          <span className="text-[13px] text-slate-600">{formatDateRange(order.bookingDates)} · {itemsSummary(order)}</span>
        </div>
        <div className="w-full"><ProgressStrip order={order} /></div>
        <div className={`flex items-start gap-2 text-[13px] font-semibold w-full ${toneText[action.tone]}`}>
          <i className={`fas ${toneIcon[action.tone]} mt-0.5`} aria-hidden="true"></i>
          <span>{action.reason}</span>
        </div>
      </button>

      <div className="flex gap-2">
        {action.label ? (
          <button type="button" onClick={onAction} disabled={busy}
            className="flex-1 min-h-12 px-3 rounded-xl bg-[#062c24] text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#0a4135] disabled:opacity-60">
            {action.whatsapp && <i className="fab fa-whatsapp text-base" aria-hidden="true"></i>}
            {action.label}
          </button>
        ) : (
          <button type="button" onClick={onOpen}
            className="flex-1 min-h-12 px-3 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50">
            View order
          </button>
        )}
        {action.key === "confirm" ? (
          <button type="button" onClick={onDecline} disabled={busy}
            className="min-h-12 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60">
            Decline
          </button>
        ) : action.label ? (
          <button type="button" onClick={onOpen} aria-label={`Open order for ${customerLabel(order)}`}
            className="w-12 min-h-12 rounded-xl border border-slate-300 bg-white text-slate-700 flex items-center justify-center hover:bg-slate-50">
            <i className="fas fa-chevron-right" aria-hidden="true"></i>
          </button>
        ) : null}
      </div>
    </div>
  );
}
