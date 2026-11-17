"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { type LoyaltyConfig, DEFAULT_LOYALTY_TIERS, loyaltySummary } from "@/lib/vendorSettings";
import { useVendorAutosave } from "@/hooks/useVendorAutosave";
import { Card, Field, SwitchRow, Choice, NumberInput, SaveStatus, hintCls, labelCls } from "@/components/ui/kit";
import type { GearItem } from "@/lib/inventory";

/** Repeat-customer discount tiers, saved on the vendor document as you edit. */
export default function LoyaltyEditor({ vendorId, gear }: { vendorId: string; gear: GearItem[] }) {
  const [loyalty, setLoyaltyState] = useState<LoyaltyConfig | null>(null);
  const { state, save } = useVendorAutosave(vendorId);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "vendors", vendorId), snap => {
      if (snap.metadata.hasPendingWrites) return;
      const l = snap.data()?.loyalty as LoyaltyConfig | undefined;
      setLoyaltyState(cur => cur ?? (l || { enabled: false, tiers: DEFAULT_LOYALTY_TIERS, appliesTo: { type: "all" } }));
    });
    return () => unsub();
  }, [vendorId]);

  if (!loyalty) return <div className="h-32 bg-white border border-slate-200 rounded-2xl animate-pulse" />;

  function setLoyalty(fields: Partial<LoyaltyConfig>) {
    const next = { ...loyalty!, ...fields };
    setLoyaltyState(next);
    save({ loyalty: next });
  }

  return (
    <div className="flex flex-col gap-3.5">
      <p className={hintCls}>Customers get a bigger discount the more times they book with you. It is applied automatically using their phone number.</p>
      <Card>
        <SwitchRow title="Reward repeat customers" hint={loyaltySummary(loyalty)} checked={loyalty.enabled} onChange={enabled => setLoyalty({ enabled })} />
        {loyalty.enabled && (
          <>
            {loyalty.tiers.map((tier, i) => (
              <div key={tier.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col gap-2">
                <span className="text-sm font-bold">{tier.label}</span>
                <div className="grid grid-cols-2 gap-3">
                  <Field id={`tier-${tier.id}-min`} label="From booking number">
                    <NumberInput id={`tier-${tier.id}-min`} value={tier.minBookings} min={1} onChange={n => setLoyalty({ tiers: loyalty.tiers.map((t, idx) => idx === i ? { ...t, minBookings: Math.round(n) || 1 } : t) })} />
                  </Field>
                  <Field id={`tier-${tier.id}-disc`} label="Discount (%)">
                    <NumberInput id={`tier-${tier.id}-disc`} value={tier.discount} onChange={n => setLoyalty({ tiers: loyalty.tiers.map((t, idx) => idx === i ? { ...t, discount: Math.min(100, Math.round(n)) } : t) })} suffix="%" />
                  </Field>
                </div>
              </div>
            ))}
            <div className="flex flex-col gap-1.5">
              <span className={labelCls}>Applies to</span>
              <Choice label="Loyalty applies to" value={loyalty.appliesTo?.type || "all"} onChange={type => setLoyalty({ appliesTo: { type, itemIds: type === "all" ? [] : (loyalty.appliesTo?.itemIds || []) } })}
                options={[{ value: "all", label: "All items" }, { value: "specific", label: "Chosen items" }]} />
            </div>
            {loyalty.appliesTo?.type === "specific" && (
              <div className="flex flex-col max-h-56 overflow-y-auto border border-slate-200 rounded-xl">
                {gear.length === 0 && <p className={`${hintCls} p-3`}>No items in your inventory yet.</p>}
                {gear.map(g => {
                  const ids = loyalty.appliesTo?.itemIds || [];
                  const on = ids.includes(g.id);
                  return (
                    <label key={g.id} className="flex items-center gap-3 min-h-11 px-3 border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50">
                      <input type="checkbox" checked={on} onChange={() => setLoyalty({ appliesTo: { type: "specific", itemIds: on ? ids.filter(x => x !== g.id) : [...ids, g.id] } })} className="w-5 h-5 accent-[#062c24]" />
                      <span className="text-sm">{g.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </>
        )}
      </Card>
      <div className="flex justify-end">{state === "error" ? <SaveStatus state="error" /> : state === "saving" ? <SaveStatus state="saving" /> : state === "saved" ? <SaveStatus state="saved" /> : null}</div>
    </div>
  );
}
