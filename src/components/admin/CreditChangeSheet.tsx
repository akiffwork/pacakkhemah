"use client";

// The one place to change a vendor's credits by hand (Vendors and Money).
// Every change is logged as a transaction.

import { useState } from "react";
import { adjustCredits, type CreditChangeType } from "@/lib/credits";
import { BottomSheet, Choice, Field, hintCls, inputCls, primaryBtn } from "@/components/ui/kit";
import type { AdminVendor } from "./types";

const TYPES: { value: CreditChangeType; label: string; hint: string }[] = [
  { value: "purchase", label: "Purchase", hint: "They paid you. Counts as credit sales." },
  { value: "bonus", label: "Bonus", hint: "Free credits, e.g. a promotion or goodwill." },
  { value: "refund", label: "Refund", hint: "Removes credits and records money returned." },
  { value: "adjustment", label: "Correction", hint: "Fixes a mistake. Not counted as sales." },
];

export default function CreditChangeSheet({ vendor, vendors, onClose, onDone }: {
  vendor?: AdminVendor | null; vendors?: AdminVendor[]; onClose: () => void; onDone: (msg: string, tone?: "success" | "error") => void;
}) {
  const [vendorId, setVendorId] = useState(vendor?.id || "");
  const [type, setType] = useState<CreditChangeType>("purchase");
  const [credits, setCredits] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const target = vendor || vendors?.find(v => v.id === vendorId) || null;
  const n = parseInt(credits, 10) || 0;
  const rm = parseFloat(amount) || 0;
  const money = type === "purchase" || type === "refund";
  const invalid = !target || n === 0 || (type === "adjustment" ? false : n < 0) || (money && rm <= 0);
  const after = (target?.credits || 0) + (type === "refund" ? -Math.abs(n) : n);

  async function save() {
    if (!target) return;
    setBusy(true);
    try {
      await adjustCredits({ vendorId: target.id, vendorName: target.name, type, credits: n, amount: money ? rm : 0, note });
      onDone(`${type === "refund" ? "Removed" : n < 0 ? "Removed" : "Added"} ${Math.abs(n)} credits ${type === "refund" || n < 0 ? "from" : "to"} ${target.name}`);
      onClose();
    } catch (e) { console.error(e); onDone("Could not change the credits", "error"); }
    finally { setBusy(false); }
  }

  return (
    <BottomSheet title={target ? `Credits for ${target.name}` : "Change credits"} onClose={onClose}>
      {!vendor && vendors && (
        <Field id="cc-vendor" label="Shop">
          <select id="cc-vendor" value={vendorId} onChange={e => setVendorId(e.target.value)} className={inputCls}>
            <option value="">Choose a shop</option>
            {[...vendors].sort((a, b) => (a.name || "").localeCompare(b.name || "")).map(v => <option key={v.id} value={v.id}>{v.name} · {v.credits || 0} credits</option>)}
          </select>
        </Field>
      )}
      <div className="flex flex-col gap-1.5">
        <Choice label="Type of change" value={type} onChange={setType} options={TYPES.map(t => ({ value: t.value, label: t.label }))} />
        <p className={hintCls}>{TYPES.find(t => t.value === type)!.hint}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field id="cc-credits" label={type === "adjustment" ? "Credits (+ or −)" : type === "refund" ? "Credits to remove" : "Credits to add"}>
          <input id="cc-credits" inputMode="numeric" value={credits} onChange={e => setCredits(e.target.value.replace(type === "adjustment" ? /[^0-9-]/g : /[^0-9]/g, ""))} className={inputCls} placeholder="0" />
        </Field>
        {money && (
          <Field id="cc-amount" label={type === "refund" ? "Money returned (RM)" : "Amount paid (RM)"}>
            <input id="cc-amount" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} className={inputCls} placeholder="0" />
          </Field>
        )}
      </div>
      <Field id="cc-note" label="Note (optional)">
        <input id="cc-note" value={note} onChange={e => setNote(e.target.value)} className={inputCls} placeholder="e.g. Bank transfer 17 Nov" />
      </Field>
      {target && n !== 0 && <p className="text-sm text-slate-700">Balance: {target.credits || 0} → <b>{after}</b> credits</p>}
      <button type="button" disabled={invalid || busy} onClick={save} className={primaryBtn}>{busy ? "Saving" : "Save and log it"}</button>
    </BottomSheet>
  );
}
