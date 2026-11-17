"use client";

import { useMemo, useState } from "react";
import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  type Discount, type DiscountKind, type GearItem,
  DISCOUNT_KINDS, discountState, describeDiscount, discountMeta, discountTitle, limitsSummary,
  discountErrors, usedCategories,
} from "@/lib/inventory";
import { Card, Field, Section, SwitchRow, Choice, NumberInput, inputCls, hintCls, smallBtn, labelCls } from "@/components/settings/ui";

type Props = {
  vendorId: string;
  discounts: Discount[];
  gear: GearItem[];
  onClose: () => void;
  onToast: (msg: string, type?: "success" | "error") => void;
};

const stateChip = {
  active: "bg-emerald-100 text-emerald-800",
  upcoming: "bg-amber-100 text-amber-800",
  ended: "bg-slate-200 text-slate-700",
};

export default function DiscountsScreen({ vendorId, discounts, gear, onClose, onToast }: Props) {
  const [editing, setEditing] = useState<Discount | "new" | null>(null);
  const groups = useMemo(() => {
    const g = { active: [] as Discount[], upcoming: [] as Discount[], ended: [] as Discount[] };
    for (const d of discounts) g[discountState(d).state].push(d);
    return g;
  }, [discounts]);

  if (editing) {
    return <DiscountEditor vendorId={vendorId} discount={editing === "new" ? null : editing} gear={gear}
      existingCodes={discounts.filter(d => d.type === "promo_code" && (editing === "new" || d.id !== editing.id)).map(d => d.code || "")}
      onClose={() => setEditing(null)} onToast={onToast} />;
  }

  return (
    <div className="fixed inset-0 z-[500] bg-slate-50 flex flex-col" role="dialog" aria-modal="true" aria-label="Discounts">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto p-4 flex flex-col gap-3.5">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} aria-label="Back to inventory" className="w-11 h-11 rounded-xl border border-slate-200 bg-white text-slate-700 flex items-center justify-center hover:bg-slate-100 shrink-0">
              <i className="fas fa-chevron-left" aria-hidden="true"></i>
            </button>
            <h1 style={{ textTransform: "none" }} className="flex-1 text-[26px] font-extrabold text-[#062c24]">Discounts</h1>
            <button type="button" onClick={() => setEditing("new")} className="min-h-11 px-3.5 rounded-xl bg-[#062c24] text-white text-sm font-bold flex items-center gap-1.5 hover:bg-[#0a4135]">
              <i className="fas fa-plus" aria-hidden="true"></i>New
            </button>
          </div>
          <p className={hintCls}>Repeat-customer rewards are in Settings › Booking rules › Loyalty rewards.</p>

          {discounts.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center flex flex-col gap-2 items-center">
              <p className="text-sm font-bold text-slate-800">No discounts yet</p>
              <p className="text-[13px] text-slate-600">Promo codes, longer-stay deals and free gifts help customers choose your shop.</p>
              <button type="button" onClick={() => setEditing("new")} className={`${smallBtn} mt-1`}>Create a discount</button>
            </div>
          )}

          {(["active", "upcoming", "ended"] as const).map(key => groups[key].length > 0 && (
            <div key={key} className="flex flex-col gap-2">
              <h2 style={{ textTransform: "none" }} className="text-[15px] font-extrabold text-slate-600">{key === "active" ? "Active" : key === "upcoming" ? "Upcoming" : "Ended"} · {groups[key].length}</h2>
              {groups[key].map(d => {
                const st = discountState(d);
                return (
                  <button key={d.id} type="button" onClick={() => setEditing(d)}
                    className={`text-left rounded-2xl border p-3.5 flex flex-col gap-1.5 hover:border-slate-400 ${key === "ended" ? "bg-slate-50 border-slate-200" : "bg-white border-slate-200"}`}>
                    <span className="flex items-center justify-between gap-2 w-full">
                      <span className={`text-[15px] font-bold ${key === "ended" ? "text-slate-600" : "text-slate-900"}`}>{discountTitle(d)}</span>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${stateChip[st.state]}`}>{st.label}</span>
                    </span>
                    <span className={`text-[13px] ${key === "ended" ? "text-slate-600" : "text-slate-800"}`}>{describeDiscount(d, gear)}</span>
                    <span className="text-xs text-slate-600">{discountMeta(d)}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DiscountEditor({ vendorId, discount, gear, existingCodes, onClose, onToast }: {
  vendorId: string; discount: Discount | null; gear: GearItem[]; existingCodes: string[];
  onClose: () => void; onToast: (msg: string, type?: "success" | "error") => void;
}) {
  const isNew = !discount;
  const [kind, setKind] = useState<DiscountKind | null>((discount?.type as DiscountKind) || null);
  const [amountType, setAmountType] = useState<"percent" | "fixed">(discount?.discount_fixed ? "fixed" : "percent");
  const [percent, setPercent] = useState(discount ? (discount.discount_percent || 0) : 10);
  const [fixed, setFixed] = useState(discount?.discount_fixed || 0);
  const [code, setCode] = useState(discount?.code || "");
  const [nights, setNights] = useState(discount?.trigger_nights || 3);
  const [minSpend, setMinSpend] = useState(discount?.min_spend || 0);
  const [minQty, setMinQty] = useState(discount?.min_qty || 3);
  const [bundleCat, setBundleCat] = useState(discount?.bundle_category || "");
  const [freeItemId, setFreeItemId] = useState(discount?.freeItemId || "");
  const [freeQty, setFreeQty] = useState(discount?.freeItemQty || 1);
  const [trigger, setTrigger] = useState(discount?.free_trigger || "always");
  const [trigNights, setTrigNights] = useState(discount?.free_trigger_nights || 0);
  const [trigSpend, setTrigSpend] = useState(discount?.free_trigger_spend || 0);
  const [trigQty, setTrigQty] = useState(discount?.free_trigger_qty || 0);
  const [trigCat, setTrigCat] = useState(discount?.free_trigger_category || "");
  const [scope, setScope] = useState<"all" | "specific">(discount?.appliesTo?.type || "all");
  const [itemIds, setItemIds] = useState<string[]>(discount?.appliesTo?.itemIds || []);
  const [validFrom, setValidFrom] = useState(discount?.validFrom || "");
  const [validUntil, setValidUntil] = useState(discount?.validUntil || "");
  const [maxUses, setMaxUses] = useState(discount?.maxUses || 0);
  const [isPublic, setIsPublic] = useState(discount?.is_public !== false);
  const [limitsOpen, setLimitsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);

  const cats = usedCategories(gear);
  const fixedAllowed = kind === "promo_code" || kind === "min_spend";
  const hasScope = kind === "promo_code" || kind === "nightly_discount" || kind === "quantity_bundle";

  const draft: Discount = {
    id: discount?.id || "new",
    type: kind || "",
    discount_percent: kind === "free_item" ? 0 : (fixedAllowed && amountType === "fixed" ? 0 : percent),
    discount_fixed: fixedAllowed && amountType === "fixed" ? fixed : null,
    code: kind === "promo_code" ? code.toUpperCase().trim() : null,
    trigger_nights: kind === "nightly_discount" ? nights : null,
    min_spend: kind === "min_spend" ? minSpend : undefined,
    min_qty: kind === "quantity_bundle" ? minQty : undefined,
    bundle_category: kind === "quantity_bundle" ? (bundleCat || null) : undefined,
    freeItemId: kind === "free_item" ? freeItemId : undefined,
    freeItemQty: kind === "free_item" ? freeQty : undefined,
    free_trigger: kind === "free_item" ? trigger : undefined,
    free_trigger_nights: kind === "free_item" && trigger === "min_nights" ? trigNights : null,
    free_trigger_spend: kind === "free_item" && trigger === "min_spend" ? trigSpend : null,
    free_trigger_qty: kind === "free_item" && trigger === "min_qty" ? trigQty : null,
    free_trigger_category: kind === "free_item" && trigger === "min_qty" ? (trigCat || null) : null,
    appliesTo: hasScope ? { type: scope, itemIds: scope === "specific" ? itemIds : [] } : undefined,
    validFrom: validFrom || null,
    validUntil: validUntil || null,
    maxUses: maxUses > 0 ? maxUses : null,
    is_public: kind === "free_item" ? undefined : isPublic,
    usedCount: discount?.usedCount ?? 0,
  };
  const errors = kind ? discountErrors(draft, existingCodes) : ["Choose a kind of discount"];

  async function save() {
    setTried(true);
    if (errors.length) return;
    setSaving(true);
    try {
      const data: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(draft)) if (k !== "id" && v !== undefined) data[k] = v;
      data.deleted = false;
      if (isNew) { data.usedCount = 0; data.usedBy = []; await addDoc(collection(db, "vendors", vendorId, "discounts"), data); }
      else { delete data.usedCount; await updateDoc(doc(db, "vendors", vendorId, "discounts", discount!.id), data); }
      onToast(isNew ? "Discount created" : "Discount saved");
      onClose();
    } catch (e) { console.error(e); onToast("Could not save the discount", "error"); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!discount || !confirm("Delete this discount? Customers will no longer get it.")) return;
    try { await updateDoc(doc(db, "vendors", vendorId, "discounts", discount.id), { deleted: true }); onToast("Discount deleted"); onClose(); }
    catch { onToast("Could not delete the discount", "error"); }
  }

  async function endNow() {
    if (!discount) return;
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    try {
      await updateDoc(doc(db, "vendors", vendorId, "discounts", discount.id), { validUntil: yesterday, ...(discount.validFrom && discount.validFrom > yesterday ? { validFrom: null } : {}) });
      onToast("Discount ended"); onClose();
    } catch { onToast("Could not end the discount", "error"); }
  }

  const amountFields = kind && kind !== "free_item" && (
    <div className="flex flex-col gap-2">
      {fixedAllowed && (
        <Choice label="Discount amount type" value={amountType} onChange={setAmountType}
          options={[{ value: "percent", label: "Percent off" }, { value: "fixed", label: "RM off" }]} />
      )}
      {fixedAllowed && amountType === "fixed"
        ? <Field id="d-fixed" label="Amount off (RM)"><NumberInput id="d-fixed" value={fixed} onChange={setFixed} suffix="RM" /></Field>
        : <Field id="d-pct" label="Discount (%)"><NumberInput id="d-pct" value={percent} onChange={n => setPercent(Math.round(n))} suffix="%" /></Field>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[510] bg-slate-50 flex flex-col" role="dialog" aria-modal="true" aria-label={isNew ? "New discount" : "Edit discount"}>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto p-4 flex flex-col gap-3.5">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} aria-label="Back to discounts" className="w-11 h-11 rounded-xl border border-slate-200 bg-white text-slate-700 flex items-center justify-center hover:bg-slate-100 shrink-0">
              <i className="fas fa-chevron-left" aria-hidden="true"></i>
            </button>
            <h1 style={{ textTransform: "none" }} className="text-[26px] font-extrabold text-[#062c24]">{isNew ? "New discount" : discountTitle(draft)}</h1>
          </div>

          {isNew ? (
            <div className="flex flex-col gap-2">
              <span className={labelCls}>What kind of discount?</span>
              <div role="radiogroup" aria-label="Kind of discount" className="flex flex-col gap-2">
                {DISCOUNT_KINDS.map(k => (
                  <button key={k.key} type="button" role="radio" aria-checked={kind === k.key} onClick={() => setKind(k.key)}
                    className={`min-h-14 px-3.5 py-2.5 rounded-2xl text-left flex flex-col gap-0.5 ${kind === k.key ? "border-2 border-[#062c24] bg-emerald-50" : "border border-slate-300 bg-white hover:bg-slate-50"}`}>
                    <span className={`text-sm font-bold ${kind === k.key ? "text-[#062c24]" : "text-slate-900"}`}>{k.title}</span>
                    <span className={`text-xs ${kind === k.key ? "text-emerald-900" : "text-slate-600"}`}>{k.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className={hintCls}>{DISCOUNT_KINDS.find(k => k.key === kind)?.hint}. Used {discount?.usedCount ?? 0} time{(discount?.usedCount ?? 0) === 1 ? "" : "s"} so far.</p>
          )}

          {kind && (
            <Card>
              {kind === "promo_code" && (
                <Field id="d-code" label="Code" hint="Letters and numbers, e.g. CAMP10">
                  <input id="d-code" value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} maxLength={20} className={`${inputCls} uppercase tracking-wider font-bold`} />
                </Field>
              )}
              {kind === "nightly_discount" && (
                <Field id="d-nights" label="From how many nights"><NumberInput id="d-nights" value={nights} onChange={n => setNights(Math.round(n))} /></Field>
              )}
              {kind === "min_spend" && (
                <Field id="d-spend" label="Minimum order (RM)"><NumberInput id="d-spend" value={minSpend} onChange={setMinSpend} suffix="RM" /></Field>
              )}
              {kind === "quantity_bundle" && (
                <>
                  <Field id="d-qty" label="Minimum number of items"><NumberInput id="d-qty" value={minQty} onChange={n => setMinQty(Math.round(n))} /></Field>
                  <Field id="d-bcat" label="Count items from">
                    <select id="d-bcat" value={bundleCat} onChange={e => setBundleCat(e.target.value)} className={inputCls}>
                      <option value="">Any category</option>
                      {cats.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                </>
              )}
              {kind === "free_item" && (
                <>
                  <div className="grid grid-cols-[1fr_88px] gap-3">
                    <Field id="d-free" label="Free item">
                      <select id="d-free" value={freeItemId} onChange={e => setFreeItemId(e.target.value)} className={inputCls}>
                        <option value="">Choose an item</option>
                        {gear.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    </Field>
                    <Field id="d-fqty" label="Quantity"><NumberInput id="d-fqty" value={freeQty} min={1} onChange={n => setFreeQty(Math.max(1, Math.round(n)))} /></Field>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className={labelCls}>When</span>
                    <Choice label="When the gift applies" value={trigger as "always" | "min_nights" | "min_spend" | "min_qty"} onChange={setTrigger}
                      options={[{ value: "always", label: "Every booking" }, { value: "min_nights", label: "Enough nights" }, { value: "min_spend", label: "Enough spend" }, { value: "min_qty", label: "Enough items" }]} />
                  </div>
                  {trigger === "min_nights" && <Field id="d-tn" label="From how many nights"><NumberInput id="d-tn" value={trigNights} onChange={n => setTrigNights(Math.round(n))} /></Field>}
                  {trigger === "min_spend" && <Field id="d-ts" label="Minimum order (RM)"><NumberInput id="d-ts" value={trigSpend} onChange={setTrigSpend} suffix="RM" /></Field>}
                  {trigger === "min_qty" && (
                    <div className="grid grid-cols-2 gap-3">
                      <Field id="d-tq" label="Minimum items"><NumberInput id="d-tq" value={trigQty} onChange={n => setTrigQty(Math.round(n))} /></Field>
                      <Field id="d-tc" label="From category">
                        <select id="d-tc" value={trigCat} onChange={e => setTrigCat(e.target.value)} className={inputCls}>
                          <option value="">Any</option>
                          {cats.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </Field>
                    </div>
                  )}
                </>
              )}

              {amountFields}

              {hasScope && (
                <div className="flex flex-col gap-1.5">
                  <span className={labelCls}>Applies to</span>
                  <Choice label="Applies to" value={scope} onChange={setScope}
                    options={[{ value: "all", label: "All items" }, { value: "specific", label: scope === "specific" && itemIds.length ? `Chosen items · ${itemIds.length}` : "Chosen items" }]} />
                  {scope === "specific" && (
                    <div className="flex flex-col max-h-56 overflow-y-auto border border-slate-200 rounded-xl">
                      {gear.map(g => (
                        <label key={g.id} className="flex items-center gap-3 min-h-11 px-3 border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50">
                          <input type="checkbox" checked={itemIds.includes(g.id)} onChange={() => setItemIds(ids => ids.includes(g.id) ? ids.filter(x => x !== g.id) : [...ids, g.id])} className="w-5 h-5 accent-[#062c24]" />
                          <span className="text-sm">{g.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}

          {kind && (
            <Section title="Limits" summary={limitsSummary(draft)} open={limitsOpen} onToggle={() => setLimitsOpen(o => !o)}>
              <div className="grid grid-cols-2 gap-3">
                <Field id="d-from" label="Starts (optional)"><input id="d-from" type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} className={inputCls} /></Field>
                <Field id="d-until" label="Ends (optional)"><input id="d-until" type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className={inputCls} /></Field>
              </div>
              <Field id="d-max" label="Maximum uses" hint="0 means unlimited"><NumberInput id="d-max" value={maxUses} onChange={n => setMaxUses(Math.round(n))} /></Field>
              {kind !== "free_item" && (
                <SwitchRow title="Show on your shop page" hint={kind === "promo_code" ? "Off: only people you give the code to can use it" : "A banner that tells customers about the deal"} checked={isPublic} onChange={setIsPublic} />
              )}
            </Section>
          )}

          {kind && (
            <div className="bg-[#062c24] rounded-2xl px-4 py-3.5 flex flex-col gap-1 text-white">
              <span className="text-xs font-semibold text-emerald-200">Customers will see</span>
              <span className="text-[15px] font-bold">{describeDiscount(draft, gear)}</span>
              <span className="text-xs text-emerald-100">{kind === "promo_code" ? "When they enter the code at checkout" : "Applied automatically at checkout"}</span>
            </div>
          )}

          {tried && errors.length > 0 && (
            <ul className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-[13px] text-red-900 flex flex-col gap-1" role="alert">
              {errors.map(e => <li key={e}>{e}</li>)}
            </ul>
          )}

          {!isNew && (
            <div className="flex flex-col gap-1 pt-1">
              {discountState(discount!).state !== "ended" && <button type="button" onClick={endNow} className="min-h-11 text-[13px] font-semibold text-slate-700 underline">End this discount now</button>}
              <button type="button" onClick={remove} className="min-h-11 text-[13px] font-semibold text-red-800 underline">Delete this discount</button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border-t border-slate-200" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="max-w-xl mx-auto px-4 pt-3 pb-4">
          <button type="button" onClick={save} disabled={saving || !kind}
            className="w-full min-h-13 rounded-2xl bg-[#062c24] text-white text-[15px] font-bold hover:bg-[#0a4135] disabled:opacity-50">
            {saving ? "Saving" : isNew ? "Create discount" : "Save discount"}
          </button>
        </div>
      </div>
    </div>
  );
}
