"use client";

import { usePrivacy } from "@/lib/privacy";
import { useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  BottomSheet, Field, Choice, NumberInput, Switch, EmptyState, Chip, SectionTitle,
  inputCls, hintCls, smallBtn, primaryBtn,
} from "@/components/ui/kit";

export type ReferralCode = {
  id: string;
  code: string;
  assignedTo: { name: string; phone: string };
  discountType: "percent" | "fixed";
  discountValue: number;
  maxUses: number | null;
  usedCount: number;
  usedBy?: { phone: string; name?: string; date: unknown; orderId?: string }[];
  isActive: boolean;
  createdAt?: unknown;
};

function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function referralStatus(r: ReferralCode): { label: string; tone: "good" | "neutral" | "warn" } {
  if (!r.isActive) return { label: "Off", tone: "neutral" };
  if (r.maxUses != null && r.usedCount >= r.maxUses) return { label: "Used up", tone: "warn" };
  return { label: "Active", tone: "good" };
}

/** Personal codes for a customer to share; whoever uses one gets the discount. */
export default function ReferralCodes({ vendorId, vendorName, existingPromoCodes, onToast }: {
  vendorId: string; vendorName: string; existingPromoCodes: string[]; onToast: (m: string, t?: "success" | "error") => void;
}) {
  const privacy = usePrivacy();
  const [codes, setCodes] = useState<ReferralCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ReferralCode | "new" | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "vendors", vendorId, "referrals"), orderBy("createdAt", "desc")),
      snap => { setCodes(snap.docs.map(d => ({ id: d.id, ...d.data() } as ReferralCode))); setLoading(false); },
      e => { console.error("Referrals listener error:", e); setLoading(false); });
    return () => unsub();
  }, [vendorId]);

  async function toggle(r: ReferralCode) {
    try { await updateDoc(doc(db, "vendors", vendorId, "referrals", r.id), { isActive: !r.isActive }); }
    catch { onToast("Could not update the code", "error"); }
  }

  function share(r: ReferralCode) {
    const amount = r.discountType === "percent" ? `${r.discountValue}%` : `RM${r.discountValue}`;
    const msg = `Hi! Use my code ${r.code} to get ${amount} off your camping gear rental at ${vendorName}.`;
    window.open(`https://wa.me/${(r.assignedTo.phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  const totalUses = codes.reduce((s, c) => s + (c.usedCount || 0), 0);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-3">
        <p className={hintCls}>Give a loyal customer their own code to share with friends. Their friends get the discount.</p>
        <button type="button" onClick={() => setEditing("new")} className="min-h-11 px-3.5 rounded-xl bg-[#062c24] text-white text-sm font-bold flex items-center gap-1.5 hover:bg-[#0a4135] shrink-0">
          <i className="fas fa-plus" aria-hidden="true"></i>New code
        </button>
      </div>

      {loading ? (
        <div className="h-24 bg-white border border-slate-200 rounded-2xl animate-pulse" />
      ) : codes.length === 0 ? (
        <EmptyState icon="fa-user-friends" title="No referral codes yet" body="Create one for a happy customer and they can share it with friends."
          action={<button type="button" onClick={() => setEditing("new")} className={smallBtn}>Create a referral code</button>} />
      ) : (
        <>
          <SectionTitle>{codes.length} code{codes.length === 1 ? "" : "s"} · used {totalUses} time{totalUses === 1 ? "" : "s"}</SectionTitle>
          {codes.map(r => {
            const st = referralStatus(r);
            return (
              <div key={r.id} className={`rounded-2xl border p-3.5 flex flex-col gap-2.5 ${r.isActive ? "bg-white border-slate-200" : "bg-slate-50 border-slate-200"}`}>
                <div className="flex items-start justify-between gap-3">
                  <button type="button" onClick={() => setEditing(r)} className="text-left min-w-0 flex flex-col gap-0.5">
                    <span className="text-[15px] font-bold text-slate-900 tracking-wider">{r.code}</span>
                    <span className="text-[13px] text-slate-700">
                      {r.discountType === "percent" ? `${r.discountValue}% off` : `RM ${r.discountValue} off`} · for {r.assignedTo?.name ? privacy.name(r.assignedTo.name) : "a customer"}
                    </span>
                    <span className="text-xs text-slate-600">Used {r.usedCount || 0}{r.maxUses != null ? ` of ${r.maxUses}` : ""} time{(r.usedCount || 0) === 1 ? "" : "s"}</span>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <Chip tone={st.tone}>{st.label}</Chip>
                    <Switch checked={r.isActive} onChange={() => toggle(r)} label={`Code ${r.code} active`} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => privacy.guard(() => share(r), "This opens WhatsApp with the customer's name and number.")} className={`${smallBtn} flex-1`}><i className="fab fa-whatsapp mr-1.5" aria-hidden="true"></i>Send to {r.assignedTo?.name ? privacy.name(r.assignedTo.name).split(" ")[0] : "customer"}</button>
                  <button type="button" onClick={() => setEditing(r)} className={smallBtn}>Edit</button>
                </div>
              </div>
            );
          })}
        </>
      )}

      {editing && (
        <ReferralEditor vendorId={vendorId} code={editing === "new" ? null : editing}
          takenCodes={[...existingPromoCodes, ...codes.filter(c => editing === "new" || c.id !== editing.id).map(c => c.code)]}
          onClose={() => setEditing(null)} onToast={onToast} />
      )}
    </div>
  );
}

function ReferralEditor({ vendorId, code, takenCodes, onClose, onToast }: {
  vendorId: string; code: ReferralCode | null; takenCodes: string[]; onClose: () => void; onToast: (m: string, t?: "success" | "error") => void;
}) {
  const [value, setValue] = useState(code?.code || randomCode());
  const [name, setName] = useState(code?.assignedTo?.name || "");
  const [phone, setPhone] = useState(code?.assignedTo?.phone || "");
  const [type, setType] = useState<"percent" | "fixed">(code?.discountType || "percent");
  const [amount, setAmount] = useState(code?.discountValue || 10);
  const [maxUses, setMaxUses] = useState(code?.maxUses || 0);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);

  const clean = value.trim().toUpperCase();
  const errors = [
    !/^[A-Z0-9_-]{3,12}$/.test(clean) && "Code must be 3 to 12 letters or numbers",
    takenCodes.includes(clean) && "This code is already used by another discount or referral",
    !name.trim() && "Enter the customer's name",
    !(amount > 0) && "Enter the discount amount",
    type === "percent" && amount > 100 && "Percent cannot be more than 100",
  ].filter(Boolean) as string[];

  async function save() {
    setTried(true);
    if (errors.length) return;
    setSaving(true);
    const data = { code: clean, assignedTo: { name: name.trim(), phone: phone.replace(/[^0-9]/g, "") }, discountType: type, discountValue: amount, maxUses: maxUses > 0 ? maxUses : null };
    try {
      if (code) await updateDoc(doc(db, "vendors", vendorId, "referrals", code.id), data);
      else await addDoc(collection(db, "vendors", vendorId, "referrals"), { ...data, isActive: true, usedCount: 0, usedBy: [], expiresAt: null, createdAt: serverTimestamp() });
      onToast(code ? "Code saved" : "Referral code created");
      onClose();
    } catch (e) { console.error(e); onToast("Could not save the code", "error"); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!code || !confirm(`Delete code ${code.code}? Customers will no longer be able to use it.`)) return;
    try { await deleteDoc(doc(db, "vendors", vendorId, "referrals", code.id)); onToast("Code deleted"); onClose(); }
    catch { onToast("Could not delete the code", "error"); }
  }

  return (
    <BottomSheet title={code ? `Edit ${code.code}` : "New referral code"} onClose={onClose}>
      <Field id="ref-code" label="Code">
        <div className="flex gap-2">
          <input id="ref-code" value={value} maxLength={12} onChange={e => setValue(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} className={`${inputCls} uppercase tracking-wider font-bold`} />
          <button type="button" onClick={() => setValue(randomCode())} className={`${smallBtn} shrink-0`} aria-label="Make a new random code"><i className="fas fa-random" aria-hidden="true"></i></button>
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="ref-name" label="Customer's name"><input id="ref-name" value={name} onChange={e => setName(e.target.value)} className={inputCls} /></Field>
        <Field id="ref-phone" label="Phone (optional)"><input id="ref-phone" type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="60123456789" className={inputCls} /></Field>
      </div>
      <Choice label="Discount type" value={type} onChange={setType} options={[{ value: "percent", label: "Percent off" }, { value: "fixed", label: "RM off" }]} />
      <div className="grid grid-cols-2 gap-3">
        <Field id="ref-amount" label={type === "percent" ? "Discount (%)" : "Discount (RM)"}><NumberInput id="ref-amount" value={amount} onChange={setAmount} suffix={type === "percent" ? "%" : "RM"} /></Field>
        <Field id="ref-max" label="Maximum uses" hint="0 means unlimited"><NumberInput id="ref-max" value={maxUses} onChange={n => setMaxUses(Math.round(n))} /></Field>
      </div>
      {tried && errors.length > 0 && (
        <ul role="alert" className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-[13px] text-red-900 flex flex-col gap-1">{errors.map(e => <li key={e}>{e}</li>)}</ul>
      )}
      <button type="button" disabled={saving} onClick={save} className={primaryBtn}>{saving ? "Saving" : code ? "Save code" : "Create code"}</button>
      {code && <button type="button" onClick={remove} className="min-h-11 text-[13px] font-semibold text-red-800 underline">Delete this code</button>}
    </BottomSheet>
  );
}
