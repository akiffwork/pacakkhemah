"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/kit";
import {
  type Order, type DepositOutcome, getPayment, pickupGaps, formatShortDate,
  SKIP_REASONS, CANCEL_REASONS, KEEP_REASONS,
} from "@/lib/orderFlow";
import { customerLabel } from "./OrderCard";
import { usePrivacy } from "@/lib/privacy";

const primaryBtn = "min-h-13 w-full rounded-2xl bg-[#062c24] text-white text-[15px] font-bold hover:bg-[#0a4135] disabled:opacity-50";
const secondaryBtn = "min-h-13 w-full rounded-2xl border border-slate-300 bg-white text-slate-700 text-[15px] font-semibold hover:bg-slate-50";

export { BottomSheet };

function ReasonChips({ reasons, value, onChange, label }: { reasons: string[]; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {reasons.map(r => (
        <button key={r} type="button" aria-pressed={value === r} onClick={() => onChange(r)}
          className={`min-h-11 px-3.5 rounded-xl text-sm ${value === r ? "border-2 border-[#062c24] bg-emerald-50 text-[#062c24] font-bold" : "border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-50"}`}>
          {r}
        </button>
      ))}
    </div>
  );
}

function OtherReason({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="order-other-reason" className="text-sm font-semibold text-slate-700">Tell us the reason</label>
      <input id="order-other-reason" value={value} onChange={e => onChange(e.target.value)} maxLength={120}
        className="min-h-11 rounded-xl border border-slate-400 px-3 text-base text-slate-900" />
    </div>
  );
}

/** Shown right after a payment or balance request is sent on WhatsApp. */
export function PaidSheet({ order, mode, onDeposit, onFull, onBalance, onNotYet, onClose }: {
  order: Order; mode: "payment" | "balance";
  onDeposit: () => void; onFull: () => void; onBalance: () => void; onNotYet: () => void; onClose: () => void;
}) {
  const p = getPayment(order);
  const { money: m, name: nm } = usePrivacy();
  const first = nm(order.customerName || "the customer").split(" ")[0];
  return (
    <BottomSheet title={mode === "balance" ? `Did ${first} pay the balance?` : `Did ${first} pay?`} onClose={onClose}>
      <p className="text-sm font-semibold text-emerald-800 flex items-center gap-2 -mt-1">
        <i className="fas fa-check" aria-hidden="true"></i>
        {mode === "balance" ? "Balance request opened in WhatsApp" : "Payment request opened in WhatsApp"}
      </p>
      <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 flex flex-col gap-2 text-sm">
        {p.deposit > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-600">Deposit</span>
            <span className={`font-semibold ${p.depositReceived ? "text-emerald-800" : "text-amber-800"}`}>{m(`RM ${p.deposit}`)} {p.depositReceived ? "received" : "not received"}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-slate-600">Rental</span>
          <span className={`font-semibold ${p.rentalReceived ? "text-emerald-800" : "text-amber-800"}`}>{m(`RM ${p.rental}`)} {p.rentalReceived ? "received" : "not received"}</span>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {mode === "payment" ? (
          <>
            <button type="button" className={primaryBtn} onClick={onFull}>{m(`Full payment received · RM ${p.total}`)}</button>
            {p.deposit > 0 && <button type="button" className={secondaryBtn} onClick={onDeposit}>{m(`Deposit only · RM ${p.deposit}`)}</button>}
          </>
        ) : (
          <button type="button" className={primaryBtn} onClick={onBalance}>{m(`Yes, RM ${p.balanceDue} received`)}</button>
        )}
        <button type="button" className={secondaryBtn} onClick={onNotYet}>Not yet</button>
      </div>
      <p className="text-[13px] leading-relaxed text-slate-600 text-center">If you choose Not yet, the order moves to Waiting on customer and comes back to Needs action after a day, or sooner if pickup is close.</p>
    </BottomSheet>
  );
}

/** Marking pickup while payment or agreement is still open: allowed, with a reason. */
export function SkipSheet({ order, onConfirm, onClose }: { order: Order; onConfirm: (reason: string) => void; onClose: () => void }) {
  const gaps = pickupGaps(order);
  const p = getPayment(order);
  const { money: m } = usePrivacy();
  const [reason, setReason] = useState("");
  const [other, setOther] = useState("");
  const final = reason === "Other reason" ? other.trim() : reason;
  const title = m(p.balanceDue > 0 ? `Hand over gear with RM ${p.balanceDue} unpaid?` : "Hand over gear without a signed agreement?");
  return (
    <BottomSheet title={title} onClose={onClose}>
      <p className="text-sm leading-relaxed text-slate-600 -mt-1">You can continue. Tell us why, so this stays on your follow-up list.</p>
      <ul className="text-sm text-slate-700 flex flex-col gap-1">
        {gaps.map(g => (
          <li key={g.step} className="flex items-center gap-2"><i className="fas fa-exclamation-circle text-amber-700" aria-hidden="true"></i><span className="first-letter:uppercase">{m(g.label)}</span></li>
        ))}
      </ul>
      <ReasonChips reasons={SKIP_REASONS} value={reason} onChange={setReason} label="Reason" />
      {reason === "Other reason" && <OtherReason value={other} onChange={setOther} />}
      {p.balanceDue > 0 && (
        <div className="bg-amber-100 border border-amber-300 rounded-2xl px-3.5 py-3 text-[13px] leading-relaxed text-amber-900">
          This order cannot be completed until the rental is marked received.
        </div>
      )}
      <div className="flex flex-col gap-2.5">
        <button type="button" className={primaryBtn} disabled={!final} onClick={() => onConfirm(final)}>Mark as picked up</button>
        <button type="button" className={secondaryBtn} onClick={onClose}>Go back</button>
      </div>
    </BottomSheet>
  );
}

export function CancelSheet({ order, onConfirm, onClose }: { order: Order; onConfirm: (reason: string) => void; onClose: () => void }) {
  const isNew = order.status === "pending" || order.status === "conflict";
  const p = getPayment(order);
  const { name: nm } = usePrivacy();
  const [reason, setReason] = useState("");
  const [other, setOther] = useState("");
  const final = reason === "Other reason" ? other.trim() : reason;
  return (
    <BottomSheet title={isNew ? "Decline this order?" : "Cancel this order?"} onClose={onClose}>
      <p className="text-sm leading-relaxed text-slate-600 -mt-1">
        {nm(customerLabel(order))} · {formatShortDate(order.bookingDates?.start)} to {formatShortDate(order.bookingDates?.end)}. The dates are released on your calendar.
      </p>
      {(p.depositReceived || p.rentalReceived) && (
        <div className="bg-amber-100 border border-amber-300 rounded-2xl px-3.5 py-3 text-[13px] leading-relaxed text-amber-900">
          Payment is marked as received on this order. Remember to refund the customer if needed.
        </div>
      )}
      <ReasonChips reasons={CANCEL_REASONS} value={reason} onChange={setReason} label="Reason" />
      {reason === "Other reason" && <OtherReason value={other} onChange={setOther} />}
      <div className="flex flex-col gap-2.5">
        <button type="button" disabled={!final} onClick={() => onConfirm(final)}
          className="min-h-13 w-full rounded-2xl bg-red-700 text-white text-[15px] font-bold hover:bg-red-800 disabled:opacity-50">
          {isNew ? "Decline order" : "Cancel order"}
        </button>
        <button type="button" className={secondaryBtn} onClick={onClose}>Keep order</button>
      </div>
    </BottomSheet>
  );
}

export function SettleSheet({ order, onConfirm, onClose }: {
  order: Order;
  onConfirm: (outcome: DepositOutcome, keptAmount: number, reason: string) => void;
  onClose: () => void;
}) {
  const p = getPayment(order);
  const { money: m, name: nm } = usePrivacy();
  const [choice, setChoice] = useState<DepositOutcome>("refunded");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const keptRaw = choice === "kept" ? p.deposit : choice === "partial" ? Math.round(Number(amount) || 0) : 0;
  const kept = Math.min(p.deposit, Math.max(0, keptRaw));
  const refund = p.deposit - kept;
  const invalid = (choice === "partial" && (kept <= 0 || kept >= p.deposit)) || (choice !== "refunded" && !reason);
  const options: { key: DepositOutcome; label: string }[] = [
    { key: "refunded", label: "Refund in full" },
    { key: "partial", label: "Keep part of it" },
    { key: "kept", label: "Keep all of it" },
  ];
  return (
    <BottomSheet title={m(`Settle the RM ${p.deposit} deposit`)} onClose={onClose}>
      <p className="text-sm leading-relaxed text-slate-600 -mt-1">{nm(customerLabel(order))} · gear returned. What happens to the deposit?</p>
      <div role="radiogroup" aria-label="Deposit outcome" className="flex flex-col gap-2">
        {options.map(opt => (
          <button key={opt.key} type="button" role="radio" aria-checked={choice === opt.key} onClick={() => setChoice(opt.key)}
            className={`min-h-13 px-3.5 rounded-2xl text-sm flex items-center gap-3 text-left ${choice === opt.key ? "border-2 border-[#062c24] bg-emerald-50 text-[#062c24] font-bold" : "border border-slate-300 bg-white text-slate-900 font-semibold hover:bg-slate-50"}`}>
            <span className={`w-5 h-5 rounded-full shrink-0 bg-white ${choice === opt.key ? "border-[6px] border-[#062c24]" : "border-2 border-slate-400"}`} aria-hidden="true"></span>
            {opt.label}
          </button>
        ))}
      </div>
      {choice !== "refunded" && (
        <div className="flex flex-col gap-2.5">
          {choice === "partial" && (
            <div className="flex items-center gap-3">
              <label htmlFor="deposit-keep-amount" className="text-sm font-semibold flex-1">Amount to keep (RM)</label>
              <input id="deposit-keep-amount" type="text" inputMode="numeric" value={amount}
                onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ""))} placeholder="0"
                className="w-24 min-h-11 rounded-xl border border-slate-400 px-3 text-base font-bold text-slate-900 text-right" />
            </div>
          )}
          <ReasonChips reasons={KEEP_REASONS} value={reason} onChange={setReason} label="Reason for keeping" />
        </div>
      )}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 flex flex-col gap-1.5 text-sm">
        <div className="flex justify-between"><span className="text-slate-600">Refund to customer</span><span className="font-bold">{m(`RM ${refund}`)}</span></div>
        <div className="flex justify-between"><span className="text-slate-600">Kept{reason && kept > 0 ? ` for ${reason.toLowerCase()}` : ""}</span><span className="font-bold">{m(`RM ${kept}`)}</span></div>
      </div>
      <button type="button" className={primaryBtn} disabled={invalid} onClick={() => onConfirm(choice, kept, choice === "refunded" ? "" : reason)}>
        {p.rentalReceived ? "Confirm and complete order" : "Confirm deposit"}
      </button>
      <p className="text-[13px] leading-relaxed text-slate-600 text-center">
        {p.rentalReceived
          ? "The order is completed automatically and the review link is ready to send."
          : m(`Rental RM ${p.rental} is still unpaid, so the order stays open until it is marked received.`)}
      </p>
    </BottomSheet>
  );
}

export function ConflictSheet({ order, onOverride, onCancel, onClose }: { order: Order; onOverride: () => void; onCancel: () => void; onClose: () => void }) {
  return (
    <BottomSheet title="Stock conflict" onClose={onClose}>
      <p className="text-sm leading-relaxed text-slate-600 -mt-1">This order asks for more than you have available on these dates.</p>
      <ul className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-900 flex flex-col gap-1">
        {(order.stockConflictDetails?.length ? order.stockConflictDetails : ["Check your inventory for these dates."]).map((d, i) => <li key={i}>{d}</li>)}
      </ul>
      <div className="flex flex-col gap-2.5">
        <button type="button" className={primaryBtn} onClick={onOverride}>I have the stock, confirm order</button>
        <button type="button" className={secondaryBtn} onClick={onCancel}>Decline order</button>
      </div>
    </BottomSheet>
  );
}
