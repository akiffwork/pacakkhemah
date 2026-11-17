"use client";

import { useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  type VendorSettings, type ServicesConfig, type DeliveryZone,
  DEFAULT_RULES, withServiceDefaults, extractCoords, haversineKm,
  locationSummary, depositSummary, rulesSummary, deliverySummary, setupSummary, comboSummary,
  timeSlotsSummary, stackingSummary,
} from "@/lib/vendorSettings";
import { Card, Field, Section, SwitchRow, Choice, ChipsInput, NumberInput, inputCls, hintCls, smallBtn, labelCls } from "./ui";

type Props = {
  vendorId: string;
  v: VendorSettings;
  set: (fields: Partial<VendorSettings>) => void;
  openSection: string | null;
  setOpenSection: (s: string | null) => void;
  toast: (msg: string, type?: "success" | "error") => void;
};

export default function RulesGroup({ vendorId, v, set, openSection, setOpenSection, toast }: Props) {
  const toggle = (s: string) => setOpenSection(openSection === s ? null : s);
  const services = withServiceDefaults(v.services);
  const rules = v.rules || [];
  const [pinDraft, setPinDraft] = useState(v.locationUrl || "");
  const [newZone, setNewZone] = useState<DeliveryZone>({ name: "", fee: 0 });

  function setServices(patch: (s: ServicesConfig) => ServicesConfig) { set({ services: patch(services) }); }
  function setDelivery(fields: Partial<ServicesConfig["delivery"]>) { setServices(s => ({ ...s, delivery: { ...s.delivery, ...fields } })); }

  async function savePin() {
    const url = pinDraft.trim();
    if (!url) { set({ locationUrl: null, locationLat: null, locationLng: null, nearbyCampsiteIds: [], nearbyCampsites: [] } as Partial<VendorSettings>); return; }
    const coords = extractCoords(url);
    if (!coords) { toast("That link has no coordinates. In Google Maps, long-press your location, then Share and copy the link.", "error"); return; }
    // Same shape the shop page already reads: locationLat/Lng, nearbyCampsiteIds, nearbyCampsites
    const fields: Record<string, unknown> = { locationUrl: url, locationLat: coords.lat, locationLng: coords.lng };
    try {
      const snap = await getDocs(collection(db, "campsites"));
      const nearby = snap.docs
        .map(d => ({ id: d.id, lat: d.data().lat as number | undefined, lng: d.data().lng as number | undefined }))
        .filter(c => c.lat != null && c.lng != null)
        .map(c => ({ id: c.id, km: Math.round(haversineKm(coords.lat, coords.lng, c.lat!, c.lng!) * 10) / 10 }))
        .filter(c => c.km <= 50)
        .sort((a, b) => a.km - b.km)
        .slice(0, 5);
      fields.nearbyCampsiteIds = nearby.map(c => c.id);
      fields.nearbyCampsites = nearby;
    } catch (e) { console.error("Campsite distance error:", e); }
    set(fields as Partial<VendorSettings>);
    toast("Map pin saved");
  }

  const deliveryOn = services.delivery.enabled;
  const setupOn = services.setup.enabled;

  return (
    <>
      <Card>
        <SwitchRow title={v.is_vacation ? "Shop is closed" : "Shop is open"}
          hint={v.is_vacation ? "Customers see a closed notice and cannot book." : "Customers can book. Switch off for a break."}
          checked={!v.is_vacation} onChange={open => set({ is_vacation: !open })} />
      </Card>

      <p className={hintCls}>Each section shows its current setting. Open one to change it.</p>

      <div className="flex flex-col gap-2">
        {/* Location */}
        <Section id="section-location" title="Location" summary={locationSummary(v)} warn={!v.pickup?.length || !v.locationUrl} open={openSection === "location"} onToggle={() => toggle("location")}>
          <Field id="city" label="Main city">
            <input id="city" value={v.city || ""} onChange={e => set({ city: e.target.value })} placeholder="e.g. Kuantan" className={inputCls} />
          </Field>
          <Field id="pickup-add" label="Pickup points" hint="Customers choose one when they book">
            <ChipsInput id="pickup-add" values={v.pickup || []} onChange={pickup => set({ pickup })} placeholder="Add a pickup point and press Enter" />
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className={labelCls}>Exact pickup pin</span>
            <div className={`rounded-xl border p-3 flex flex-col gap-2 ${v.locationUrl ? "bg-emerald-50 border-emerald-200" : "bg-amber-100 border-amber-300"}`}>
              <span className={`text-[13px] ${v.locationUrl ? "text-emerald-900" : "text-amber-900"}`}>
                {v.locationUrl ? "Set. Nearby campers are shown your shop." : "Not set. Used to suggest your shop to nearby campers. Never shown publicly."}
              </span>
              <div className="flex gap-2">
                <input aria-label="Google Maps link" value={pinDraft} onChange={e => setPinDraft(e.target.value)} placeholder="Paste a Google Maps link" className={inputCls} />
                <button type="button" onClick={savePin} className={smallBtn}>Save</button>
              </div>
              <span className={hintCls}>Open Google Maps, long-press your location, tap Share and copy the link.</span>
            </div>
          </div>
          <Field id="areas-add" label="Areas you serve" hint="States or towns. Shown in the directory.">
            <ChipsInput id="areas-add" values={v.areas || []} onChange={areas => set({ areas })} placeholder="Add a state or town and press Enter" />
          </Field>
        </Section>

        {/* Deposit */}
        <Section id="section-deposit" title="Security deposit" summary={depositSummary(v)} open={openSection === "deposit"} onToggle={() => toggle("deposit")}>
          <Choice label="Deposit type" value={(v.security_deposit_type === "percent" ? "percent" : "fixed") as "fixed" | "percent"}
            onChange={t => set({ security_deposit_type: t })}
            options={[{ value: "fixed", label: "Fixed amount (RM)" }, { value: "percent", label: "Percent of rental" }]} />
          <Field id="deposit" label={v.security_deposit_type === "percent" ? "Deposit (%)" : "Deposit (RM)"} hint="Refunded after the gear comes back in good condition. Set 0 for no deposit.">
            <NumberInput id="deposit" value={v.security_deposit ?? 50} onChange={n => set({ security_deposit: n })} suffix={v.security_deposit_type === "percent" ? "%" : "RM"} />
          </Field>
        </Section>

        {/* Rules */}
        <Section id="section-rules" title="Rental rules" summary={rulesSummary(v)} open={openSection === "rules"} onToggle={() => toggle("rules")}>
          <p className={hintCls}>Shown to customers before they book.</p>
          {rules.map((r, i) => (
            <div key={i} className="flex gap-2">
              <input aria-label={`Rule ${i + 1}`} value={r} onChange={e => set({ rules: rules.map((x, idx) => idx === i ? e.target.value : x) })} className={inputCls} />
              <button type="button" aria-label={`Remove rule ${i + 1}`} onClick={() => set({ rules: rules.filter((_, idx) => idx !== i) })} className={`${smallBtn} shrink-0`}><i className="fas fa-times" aria-hidden="true"></i></button>
            </div>
          ))}
          <div className="flex gap-2">
            <button type="button" onClick={() => set({ rules: [...rules, ""] })} className={smallBtn}>Add rule</button>
            {rules.length === 0 && <button type="button" onClick={() => set({ rules: DEFAULT_RULES })} className={smallBtn}>Use suggested rules</button>}
          </div>
        </Section>

        {/* Delivery */}
        <Section id="section-delivery" title="Delivery" summary={deliverySummary(services)} open={openSection === "delivery"} onToggle={() => toggle("delivery")}>
          <SwitchRow title="Offer delivery" checked={deliveryOn} onChange={on => setDelivery({ enabled: on })} />
          {deliveryOn && (
            <>
              <div className="flex flex-col gap-1.5">
                <span className={labelCls}>How you charge</span>
                <Choice label="Delivery pricing" value={services.delivery.pricingType} onChange={pricingType => setDelivery({ pricingType })}
                  options={[{ value: "fixed", label: "Fixed fee" }, { value: "per_km", label: "Per km" }, { value: "zones", label: "By zone" }, { value: "quote", label: "Quote on WhatsApp" }]} />
              </div>
              {services.delivery.pricingType === "fixed" && (
                <Field id="del-fixed" label="Delivery fee (RM)"><NumberInput id="del-fixed" value={services.delivery.fixedFee} onChange={fixedFee => setDelivery({ fixedFee })} suffix="RM" /></Field>
              )}
              {services.delivery.pricingType === "per_km" && (
                <div className="grid grid-cols-2 gap-3">
                  <Field id="del-km" label="Rate per km (RM)"><NumberInput id="del-km" value={services.delivery.perKmRate} onChange={perKmRate => setDelivery({ perKmRate })} suffix="RM" /></Field>
                  <Field id="del-min" label="Minimum fee (RM)"><NumberInput id="del-min" value={services.delivery.minFee} onChange={minFee => setDelivery({ minFee })} suffix="RM" /></Field>
                </div>
              )}
              {services.delivery.pricingType === "zones" && (
                <div className="flex flex-col gap-2">
                  <span className={labelCls}>Zones</span>
                  {services.delivery.zones.map((z, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                      <span className="text-sm font-semibold">{z.name}</span>
                      <span className="flex items-center gap-3">
                        <span className="text-sm">RM {z.fee}</span>
                        <button type="button" aria-label={`Remove zone ${z.name}`} onClick={() => setDelivery({ zones: services.delivery.zones.filter((_, idx) => idx !== i) })} className="w-9 h-9 rounded-full text-slate-700 hover:bg-slate-200"><i className="fas fa-times" aria-hidden="true"></i></button>
                      </span>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input aria-label="Zone name" value={newZone.name} onChange={e => setNewZone({ ...newZone, name: e.target.value })} placeholder="Zone name" className={inputCls} />
                    <input aria-label="Zone fee" type="text" inputMode="numeric" value={newZone.fee || ""} onChange={e => setNewZone({ ...newZone, fee: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })} placeholder="RM" className={`${inputCls} w-24`} />
                    <button type="button" disabled={!newZone.name.trim()} onClick={() => { setDelivery({ zones: [...services.delivery.zones, { name: newZone.name.trim(), fee: newZone.fee }] }); setNewZone({ name: "", fee: 0 }); }} className={smallBtn}>Add</button>
                  </div>
                </div>
              )}
              {services.delivery.pricingType === "quote" && <p className={hintCls}>Customers see &ldquo;delivery fee to be quoted&rdquo; and you agree the price on WhatsApp.</p>}
              {services.delivery.pricingType !== "quote" && (
                <Field id="del-free" label="Free delivery above (RM)" hint="0 means never free">
                  <NumberInput id="del-free" value={services.delivery.freeAbove} onChange={freeAbove => setDelivery({ freeAbove })} suffix="RM" />
                </Field>
              )}
              <Field id="del-notes" label="Note shown to customers (optional)">
                <input id="del-notes" value={services.delivery.notes} onChange={e => setDelivery({ notes: e.target.value })} placeholder="e.g. Delivery within Kuantan only" className={inputCls} />
              </Field>
              <p className={hintCls}>Customers see: delivery {deliverySummary(services).replace(/^On · /, "").replace(" · ", ", ")}.</p>
            </>
          )}
        </Section>

        {/* Setup */}
        <Section id="section-setup" title="Setup at campsite" summary={setupSummary(services)} open={openSection === "setup"} onToggle={() => toggle("setup")}>
          <SwitchRow title="Offer tent setup" hint="Only with delivery orders" checked={setupOn} onChange={enabled => setServices(s => ({ ...s, setup: { ...s.setup, enabled } }))} />
          {setupOn && (
            <>
              <Field id="setup-fee" label="Setup fee per tent (RM)"><NumberInput id="setup-fee" value={services.setup.fee} onChange={fee => setServices(s => ({ ...s, setup: { ...s.setup, fee } }))} suffix="RM" /></Field>
              <Field id="setup-desc" label="What is included">
                <input id="setup-desc" value={services.setup.description} onChange={e => setServices(s => ({ ...s, setup: { ...s.setup, description: e.target.value } }))} className={inputCls} />
              </Field>
            </>
          )}
        </Section>

        {/* Combo */}
        <Section id="section-combo" title="Delivery + setup combo" summary={comboSummary(services)} open={openSection === "combo"} onToggle={() => toggle("combo")}>
          {deliveryOn && setupOn ? (
            <>
              <SwitchRow title="Offer a combo price" hint="One price for delivery and setup together" checked={services.combo.enabled} onChange={enabled => setServices(s => ({ ...s, combo: { ...s.combo, enabled } }))} />
              {services.combo.enabled && (
                <Field id="combo-fee" label="Combo price (RM)" hint={`Separately: RM ${services.delivery.pricingType === "fixed" ? services.delivery.fixedFee : "?"} delivery + RM ${services.setup.fee} setup`}>
                  <NumberInput id="combo-fee" value={services.combo.fee} onChange={fee => setServices(s => ({ ...s, combo: { ...s.combo, fee } }))} suffix="RM" />
                </Field>
              )}
            </>
          ) : <p className={hintCls}>Turn on Delivery and Setup at campsite first.</p>}
        </Section>

        {/* Time slots */}
        <Section id="section-slots" title="Delivery time slots" summary={timeSlotsSummary(services)} open={openSection === "slots"} onToggle={() => toggle("slots")}>
          {deliveryOn ? (
            <>
              <SwitchRow title="Let customers pick a time slot" checked={services.timeSlots.enabled} onChange={enabled => setServices(s => ({ ...s, timeSlots: { ...s.timeSlots, enabled } }))} />
              {services.timeSlots.enabled && (
                <>
                  {services.timeSlots.slots.map((slot, i) => (
                    <div key={i} className="flex gap-2">
                      <input aria-label={`Slot ${i + 1} name`} value={slot.label} onChange={e => setServices(s => ({ ...s, timeSlots: { ...s.timeSlots, slots: s.timeSlots.slots.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x) } }))} placeholder="Name" className={inputCls} />
                      <input aria-label={`Slot ${i + 1} hours`} value={slot.time} onChange={e => setServices(s => ({ ...s, timeSlots: { ...s.timeSlots, slots: s.timeSlots.slots.map((x, idx) => idx === i ? { ...x, time: e.target.value } : x) } }))} placeholder="9:00 AM - 12:00 PM" className={inputCls} />
                      <button type="button" aria-label={`Remove slot ${i + 1}`} onClick={() => setServices(s => ({ ...s, timeSlots: { ...s.timeSlots, slots: s.timeSlots.slots.filter((_, idx) => idx !== i) } }))} className={`${smallBtn} shrink-0`}><i className="fas fa-times" aria-hidden="true"></i></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setServices(s => ({ ...s, timeSlots: { ...s.timeSlots, slots: [...s.timeSlots.slots, { label: "", time: "" }] } }))} className={`${smallBtn} self-start`}>Add slot</button>
                </>
              )}
            </>
          ) : <p className={hintCls}>Turn on Delivery first.</p>}
        </Section>

        {/* Stacking */}
        <Section id="section-stacking" title="Discount stacking" summary={stackingSummary(v)} open={openSection === "stacking"} onToggle={() => toggle("stacking")}>
          <SwitchRow title="Let offers combine" hint="Off: a customer gets the single best offer. On: promo codes, extended stay and bundle deals add up." checked={!!v.allow_stacking} onChange={allow_stacking => set({ allow_stacking })} />
        </Section>

      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3.5 flex flex-col gap-1">
        <span className="text-sm font-bold text-emerald-900">Discounts, referral codes and loyalty rewards</span>
        <span className="text-[13px] text-emerald-900">These are in More › Promotions.</span>
      </div>
    </>
  );
}
