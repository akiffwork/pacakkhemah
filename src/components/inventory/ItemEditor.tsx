"use client";

import { useMemo, useState } from "react";
import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db } from "@/lib/firebase";
import {
  type GearItem, type GearVariant, type LinkedItem, type PricingTier, type GearSpecs,
  categoryOptions, categoryOf, isTentLike, variantsSummary, tiersSummary, setupItemSummary,
  specsSummary, contentsSummary, variantTotals,
} from "@/lib/inventory";
import { Card, Field, Section, SwitchRow, Choice, NumberInput, inputCls, hintCls, smallBtn, labelCls } from "@/components/settings/ui";

type Props = {
  vendorId: string;
  item: GearItem | null;
  allGear: GearItem[];
  setupEnabledForShop: boolean;
  pickupPoints: string[];
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
  onDuplicate: (item: GearItem) => void;
  onDelete: (item: GearItem) => void;
};

const MAX_FILE_MB = 5;
const MAX_PHOTOS = 5;
const TIER_PRESETS = [
  { label: "Day trip", nights: 0 },
  { label: "2D1N", nights: 1 },
  { label: "3D2N", nights: 2 },
  { label: "4D3N", nights: 3 },
  { label: "5D4N", nights: 4 },
];
const TENT_TYPES = ["Auto Tent", "Air Tent", "Manual Tent", "Modular Tent", "Shelter", "Dome Tent", "Cabin Tent", "Teepee", "Hammock Tent", "Flysheet"];

export default function ItemEditor({ vendorId, item, allGear, setupEnabledForShop, pickupPoints, onClose, onSaved, onError, onDuplicate, onDelete }: Props) {
  const isNew = !item;
  const [type, setType] = useState<"addon" | "package">(item?.type === "package" ? "package" : "addon");
  const [name, setName] = useState(item?.name || "");
  const [category, setCategory] = useState(item ? categoryOf(item) : "");
  const [customCat, setCustomCat] = useState(false);
  const [price, setPrice] = useState(item?.price || 0);
  const [stock, setStock] = useState(item?.stock ?? 1);
  const [paused, setPaused] = useState(!!item?.paused);
  const [desc, setDesc] = useState(item?.desc || "");
  const [images, setImages] = useState<string[]>(item?.images?.length ? item.images : item?.img ? [item.img] : []);
  const [pending, setPending] = useState<File[]>([]);
  const [hasVariants, setHasVariants] = useState(!!item?.hasVariants && !!item?.variants?.length);
  const [variants, setVariants] = useState<GearVariant[]>(item?.variants || []);
  const [tiers, setTiers] = useState<PricingTier[]>(item?.pricingTiers || []);
  const [setupOn, setSetupOn] = useState(!!item?.setup?.available);
  const [setupFee, setSetupFee] = useState(item?.setup?.fee || 0);
  const [setupDesc, setSetupDesc] = useState(item?.setup?.description || "");
  const [specs, setSpecs] = useState<GearSpecs>(item?.specs || {});
  const [pickup, setPickup] = useState(item?.pickupLocation || "");
  const [linked, setLinked] = useState<LinkedItem[]>(item?.linkedItems || []);
  const [inc, setInc] = useState<string[]>(item?.inc || []);
  const [open, setOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [menu, setMenu] = useState(false);
  const toggle = (s: string) => setOpen(open === s ? null : s);

  const cats = useMemo(() => categoryOptions(allGear), [allGear]);
  const addons = allGear.filter(g => g.type !== "package" && g.id !== item?.id);
  const showTent = isTentLike({ category, name, specs });
  const showSetup = setupEnabledForShop || setupOn;
  const showPickup = pickupPoints.length > 1 || !!pickup;

  const initial = useMemo(() => JSON.stringify({
    type: item?.type === "package" ? "package" : "addon", name: item?.name || "", category: item ? categoryOf(item) : "",
    price: item?.price || 0, stock: item?.stock ?? 1, paused: !!item?.paused, desc: item?.desc || "",
    images: item?.images?.length ? item.images : item?.img ? [item.img] : [], hasVariants: !!item?.hasVariants && !!item?.variants?.length,
    variants: item?.variants || [], tiers: item?.pricingTiers || [], setupOn: !!item?.setup?.available, setupFee: item?.setup?.fee || 0,
    setupDesc: item?.setup?.description || "", specs: item?.specs || {}, pickup: item?.pickupLocation || "", linked: item?.linkedItems || [], inc: item?.inc || [],
  }), [item]);
  const current = JSON.stringify({ type, name, category, price, stock, paused, desc, images, hasVariants, variants, tiers, setupOn, setupFee, setupDesc, specs, pickup, linked, inc });
  const dirty = current !== initial || pending.length > 0;

  function close() {
    if (dirty && !confirm("Discard your changes to this item?")) return;
    onClose();
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    const ok: File[] = [];
    let tooBig = 0;
    for (const f of Array.from(files)) { if (f.size > MAX_FILE_MB * 1024 * 1024) tooBig++; else ok.push(f); }
    if (tooBig) onError(`${tooBig} photo${tooBig > 1 ? "s are" : " is"} over ${MAX_FILE_MB} MB`);
    setPending(p => [...p, ...ok].slice(0, Math.max(0, MAX_PHOTOS - images.length)));
  }

  function makeCover(i: number) { setImages(imgs => [imgs[i], ...imgs.filter((_, idx) => idx !== i)]); }

  async function save() {
    if (!name.trim()) { onError("Give the item a name"); return; }
    const cleanVariants = hasVariants ? variants.filter(v => v.color?.label?.trim() || v.size?.trim()) : [];
    if (hasVariants && !cleanVariants.length) { onError("Add at least one colour or size, or turn the option off"); return; }
    setSaving(true);
    try {
      const storage = getStorage();
      const uploaded: string[] = [];
      for (const f of pending) {
        const snap = await uploadBytes(ref(storage, `gear/${vendorId}/${Date.now()}_${f.name}`), f);
        uploaded.push(await getDownloadURL(snap.ref));
      }
      const allImages = [...images, ...uploaded];
      const totals = variantTotals(cleanVariants);
      const cleanSpecs: GearSpecs = {};
      if (showTent) {
        if (specs.size?.trim()) cleanSpecs.size = specs.size.trim();
        if (specs.maxPax && specs.maxPax > 0) cleanSpecs.maxPax = specs.maxPax;
        if (specs.puRating?.trim()) cleanSpecs.puRating = specs.puRating.trim();
        if (specs.layers?.trim()) cleanSpecs.layers = specs.layers.trim();
        if (specs.weight?.trim()) cleanSpecs.weight = specs.weight.trim();
        if (specs.tentType?.trim()) cleanSpecs.tentType = specs.tentType.trim();
      }
      const data: Record<string, unknown> = {
        vendorId,
        owner_uid: auth.currentUser?.uid,
        type,
        category: category.trim() || (type === "package" ? "Packages" : "Other"),
        name: name.trim(),
        desc: desc.trim(),
        price: totals.minPrice ?? price,
        stock: cleanVariants.length ? totals.stock : stock,
        img: allImages[0] || "",
        images: allImages,
        inc: type === "package" ? inc.map(s => s.trim()).filter(Boolean) : [],
        deleted: false,
        paused,
        hasVariants: cleanVariants.length > 0,
        variants: cleanVariants,
        setup: { available: setupOn, fee: setupOn ? setupFee : 0, description: setupOn ? setupDesc : "" },
        specs: cleanSpecs,
        pricingTiers: tiers.filter(t => t.price > 0).sort((a, b) => a.nights - b.nights),
        pickupLocation: pickup || null,
        linkedItems: type === "package"
          ? linked.filter(l => l.itemId && l.qty > 0).map(l => ({ itemId: l.itemId, qty: l.qty, ...(l.variantId ? { variantId: l.variantId, variantLabel: l.variantLabel, variantColor: l.variantColor } : {}) }))
          : [],
      };
      if (item) await updateDoc(doc(db, "gear", item.id), data);
      else await addDoc(collection(db, "gear"), data);
      onSaved(isNew ? "Item added" : "Item saved");
      onClose();
    } catch (e) {
      console.error(e);
      onError("Could not save the item. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  function updateVariant(i: number, patch: Partial<GearVariant>) { setVariants(vs => vs.map((v, idx) => idx === i ? { ...v, ...patch } : v)); }

  return (
    <div className="fixed inset-0 z-[500] bg-slate-50 flex flex-col" role="dialog" aria-modal="true" aria-label={isNew ? "New item" : `Edit ${item?.name}`}>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto p-4 flex flex-col gap-3.5">

          <div className="flex items-center gap-3">
            <button type="button" onClick={close} aria-label="Back to inventory" className="w-11 h-11 rounded-xl border border-slate-200 bg-white text-slate-700 flex items-center justify-center hover:bg-slate-100 shrink-0">
              <i className="fas fa-chevron-left" aria-hidden="true"></i>
            </button>
            <div className="flex-1 min-w-0">
              <h1 style={{ textTransform: "none" }} className="text-[22px] font-extrabold text-[#062c24] leading-tight truncate">{isNew ? "New item" : name || "Untitled item"}</h1>
              <p className="text-[13px] text-slate-600">{category || "No category"} · {type === "package" ? "package" : "single item"}</p>
            </div>
            {!isNew && (
              <div className="relative">
                <button type="button" onClick={() => setMenu(m => !m)} aria-label="More: duplicate, delete" aria-expanded={menu}
                  className="w-11 h-11 rounded-xl border border-slate-200 bg-white text-slate-700 flex items-center justify-center hover:bg-slate-100">
                  <i className="fas fa-ellipsis-v" aria-hidden="true"></i>
                </button>
                {menu && (
                  <div className="absolute right-0 top-12 z-10 w-48 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                    <button type="button" onClick={() => { setMenu(false); onDuplicate(item!); }} className="w-full min-h-11 px-4 text-left text-sm font-semibold hover:bg-slate-50">Duplicate</button>
                    <button type="button" onClick={() => { setMenu(false); onDelete(item!); }} className="w-full min-h-11 px-4 text-left text-sm font-semibold text-red-800 hover:bg-red-50">Delete</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {isNew && (
            <div className="flex flex-col gap-1.5">
              <span className={labelCls}>What are you adding?</span>
              <Choice label="Item type" value={type} onChange={t => { setType(t); if (t === "package" && !category) setCategory("Packages"); }}
                options={[{ value: "addon", label: "Single item" }, { value: "package", label: "Package of items" }]} />
            </div>
          )}

          <Card>
            <SwitchRow title={paused ? "Paused" : "Live on your shop"} hint={paused ? "Hidden from your shop. Existing bookings are kept." : "Switch off to hide it without deleting"} checked={!paused} onChange={on => setPaused(!on)} />
          </Card>

          <Card>
            <div className="flex flex-col gap-2">
              <span className={labelCls}>Photos</span>
              <div className="flex gap-2 flex-wrap">
                {images.length + pending.length < MAX_PHOTOS && (
                  <label className="w-20 h-20 rounded-xl border border-dashed border-slate-400 bg-white text-slate-700 flex flex-col items-center justify-center gap-1 text-xs font-semibold cursor-pointer hover:bg-slate-50">
                    <i className="fas fa-camera text-lg" aria-hidden="true"></i>Add
                    <input type="file" accept="image/*" multiple className="sr-only" onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
                  </label>
                )}
                {images.map((src, i) => (
                  <div key={src} className="relative w-20 h-20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Photo ${i + 1}`} className={`w-20 h-20 rounded-xl object-cover ${i === 0 ? "ring-2 ring-[#062c24]" : ""}`} />
                    <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => setImages(imgs => imgs.filter((_, idx) => idx !== i))}
                      className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white border border-slate-300 text-slate-700 flex items-center justify-center shadow-sm"><i className="fas fa-times text-xs" aria-hidden="true"></i></button>
                    {i > 0 && (
                      <button type="button" onClick={() => makeCover(i)} className="absolute bottom-1 left-1 right-1 rounded-md bg-white/90 text-[11px] font-bold text-slate-800 py-0.5">Make cover</button>
                    )}
                  </div>
                ))}
                {pending.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="relative w-20 h-20 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center p-1 text-center">
                    <span className="text-[11px] text-emerald-900 break-all line-clamp-3">{f.name}</span>
                    <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setPending(p => p.filter((_, idx) => idx !== i))}
                      className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white border border-slate-300 text-slate-700 flex items-center justify-center shadow-sm"><i className="fas fa-times text-xs" aria-hidden="true"></i></button>
                  </div>
                ))}
              </div>
              <span className={hintCls}>Up to {MAX_PHOTOS} photos, {MAX_FILE_MB} MB each. The first is the cover.{pending.length ? " New photos upload when you save." : ""}</span>
            </div>

            <Field id="item-name" label="Name">
              <input id="item-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Naturehike Mongar 2P" className={inputCls} />
            </Field>

            <div className="flex flex-col gap-1.5">
              <span className={labelCls}>Category</span>
              <div role="radiogroup" aria-label="Category" className="flex flex-wrap gap-2">
                {cats.map(c => (
                  <button key={c} type="button" role="radio" aria-checked={!customCat && category.toLowerCase() === c.toLowerCase()} onClick={() => { setCategory(c); setCustomCat(false); }}
                    className={`min-h-10 px-3.5 rounded-xl text-[13px] ${!customCat && category.toLowerCase() === c.toLowerCase() ? "border-2 border-[#062c24] bg-emerald-50 text-[#062c24] font-bold" : "border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-50"}`}>
                    {c}
                  </button>
                ))}
                <button type="button" role="radio" aria-checked={customCat} onClick={() => { setCustomCat(true); setCategory(""); }}
                  className={`min-h-10 px-3.5 rounded-xl text-[13px] ${customCat ? "border-2 border-[#062c24] bg-emerald-50 text-[#062c24] font-bold" : "border border-dashed border-slate-400 bg-white text-slate-700 font-semibold"}`}>
                  Other…
                </button>
              </div>
              {customCat && <input aria-label="New category name" autoFocus value={category} onChange={e => setCategory(e.target.value)} placeholder="Category name" className={inputCls} />}
            </div>

            {!hasVariants ? (
              <div className="grid grid-cols-2 gap-3">
                <Field id="item-price" label="Price per night (RM)"><NumberInput id="item-price" value={price} onChange={setPrice} suffix="RM" /></Field>
                <Field id="item-stock" label="Units you own"><NumberInput id="item-stock" value={stock} onChange={n => setStock(Math.round(n))} /></Field>
              </div>
            ) : (
              <p className={hintCls}>Price and units are set per colour or size below.</p>
            )}
          </Card>

          <div className="flex flex-col gap-2">
            <Section title="Description" summary={desc.trim() ? `${desc.trim().slice(0, 60)}${desc.trim().length > 60 ? "…" : ""}` : "Not written yet"} open={open === "desc"} onToggle={() => toggle("desc")}>
              <textarea aria-label="Description" rows={4} value={desc} onChange={e => setDesc(e.target.value)} placeholder="What customers should know: size, condition, what is included" className={`${inputCls} py-2.5 resize-none`} />
            </Section>

            {type === "package" && (
              <Section title="Items inside the package" summary={contentsSummary(linked, inc, allGear)} warn={!linked.length && !inc.filter(Boolean).length} open={open === "contents"} onToggle={() => toggle("contents")}>
                <p className={hintCls}>Linked items are reserved from your stock when the package is booked.</p>
                {linked.map((l, i) => {
                  const it = addons.find(a => a.id === l.itemId);
                  return (
                    <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col gap-2">
                      <div className="flex gap-2">
                        <select aria-label={`Linked item ${i + 1}`} value={l.itemId} onChange={e => setLinked(ls => ls.map((x, idx) => idx === i ? { itemId: e.target.value, qty: x.qty } : x))} className={inputCls}>
                          <option value="">Choose an item</option>
                          {addons.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                        <input aria-label={`Quantity of linked item ${i + 1}`} type="text" inputMode="numeric" value={l.qty} onChange={e => setLinked(ls => ls.map((x, idx) => idx === i ? { ...x, qty: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 } : x))} className={`${inputCls} w-16 text-center`} />
                        <button type="button" aria-label={`Remove linked item ${i + 1}`} onClick={() => setLinked(ls => ls.filter((_, idx) => idx !== i))} className={`${smallBtn} shrink-0`}><i className="fas fa-times" aria-hidden="true"></i></button>
                      </div>
                      {it?.hasVariants && it.variants?.length ? (
                        <select aria-label={`Colour or size for linked item ${i + 1}`} value={l.variantId || ""} onChange={e => {
                          const v = it.variants!.find(x => x.id === e.target.value);
                          setLinked(ls => ls.map((x, idx) => idx === i ? { ...x, variantId: v?.id, variantLabel: v ? [v.color?.label, v.size].filter(Boolean).join(", ") : undefined, variantColor: v?.color?.hex } : x));
                        }} className={inputCls}>
                          <option value="">Customer chooses</option>
                          {it.variants.map(v => <option key={v.id} value={v.id}>{[v.color?.label, v.size].filter(Boolean).join(", ")}</option>)}
                        </select>
                      ) : null}
                    </div>
                  );
                })}
                <button type="button" onClick={() => setLinked(ls => [...ls, { itemId: "", qty: 1 }])} className={`${smallBtn} self-start`}>Link an item</button>
                <Field id="pkg-inc" label="Also included (not tracked in stock)" hint="One per line, e.g. pegs, mallet, ground sheet">
                  <textarea id="pkg-inc" rows={3} value={inc.join("\n")} onChange={e => setInc(e.target.value.split("\n"))} className={`${inputCls} py-2.5 resize-none`} />
                </Field>
              </Section>
            )}

            <Section title="Colours and sizes" summary={variantsSummary(hasVariants, variants)} open={open === "variants"} onToggle={() => toggle("variants")}>
              <SwitchRow title="This item comes in different colours or sizes" checked={hasVariants} onChange={on => {
                setHasVariants(on);
                if (on && !variants.length) setVariants([{ id: `v${Date.now()}`, color: { label: "", hex: "#062c24" }, size: "", price, stock: Math.max(1, stock) }]);
              }} />
              {hasVariants && (
                <>
                  {variants.map((v, i) => (
                    <div key={v.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col gap-2">
                      <div className="flex gap-2 items-end">
                        <label className="flex flex-col gap-1">
                          <span className={labelCls}>Colour</span>
                          <input type="color" value={v.color?.hex || "#062c24"} onChange={e => updateVariant(i, { color: { label: v.color?.label || "", hex: e.target.value } })} className="w-11 h-11 rounded-xl border border-slate-400 bg-white p-1" />
                        </label>
                        <label className="flex flex-col gap-1 flex-1">
                          <span className={labelCls}>Name</span>
                          <input value={v.color?.label || ""} onChange={e => updateVariant(i, { color: { label: e.target.value, hex: v.color?.hex || "#062c24" } })} placeholder="e.g. Khaki" className={inputCls} />
                        </label>
                        <button type="button" aria-label={`Remove option ${i + 1}`} onClick={() => setVariants(vs => vs.filter((_, idx) => idx !== i))} className={`${smallBtn} shrink-0 min-h-11`}><i className="fas fa-times" aria-hidden="true"></i></button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <label className="flex flex-col gap-1"><span className={labelCls}>Size</span><input value={v.size || ""} onChange={e => updateVariant(i, { size: e.target.value })} placeholder="optional" className={inputCls} /></label>
                        <label className="flex flex-col gap-1"><span className={labelCls}>RM / night</span><input type="text" inputMode="decimal" value={v.price || ""} onChange={e => updateVariant(i, { price: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 })} className={inputCls} /></label>
                        <label className="flex flex-col gap-1"><span className={labelCls}>Units</span><input type="text" inputMode="numeric" value={v.stock} onChange={e => updateVariant(i, { stock: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })} className={inputCls} /></label>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => setVariants(vs => [...vs, { id: `v${Date.now()}`, color: { label: "", hex: "#062c24" }, size: "", price: vs[vs.length - 1]?.price || price, stock: 1 }])} className={`${smallBtn} self-start`}>Add colour or size</button>
                </>
              )}
            </Section>

            <Section title="Prices for longer stays" summary={tiersSummary(tiers)} open={open === "tiers"} onToggle={() => toggle("tiers")}>
              <p className={hintCls}>A set price for a whole trip, used instead of price per night × nights.</p>
              <div className="flex flex-wrap gap-2">
                {TIER_PRESETS.filter(p => !tiers.some(t => t.nights === p.nights)).map(p => (
                  <button key={p.nights} type="button" onClick={() => setTiers(ts => [...ts, { ...p, price: 0 }].sort((a, b) => a.nights - b.nights))} className={smallBtn}>+ {p.label}</button>
                ))}
              </div>
              {tiers.map((t, i) => (
                <div key={t.nights} className="flex items-center gap-2">
                  <span className="text-sm font-semibold w-24 shrink-0">{t.label}</span>
                  <input aria-label={`Price for ${t.label}`} type="text" inputMode="decimal" value={t.price || ""} onChange={e => setTiers(ts => ts.map((x, idx) => idx === i ? { ...x, price: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 } : x))} placeholder={`RM ${(t.nights || 1) * price}`} className={inputCls} />
                  <button type="button" aria-label={`Remove ${t.label}`} onClick={() => setTiers(ts => ts.filter((_, idx) => idx !== i))} className={`${smallBtn} shrink-0`}><i className="fas fa-times" aria-hidden="true"></i></button>
                </div>
              ))}
            </Section>

            {showSetup && (
              <Section title="Setup at campsite" summary={setupItemSummary(setupOn, setupFee)} open={open === "setup"} onToggle={() => toggle("setup")}>
                <SwitchRow title="Offer setup for this item" hint={setupEnabledForShop ? "Only with delivery orders" : "Setup is switched off for your shop in Settings, so customers will not see this."} checked={setupOn} onChange={setSetupOn} />
                {setupOn && (
                  <>
                    <Field id="setup-fee" label="Setup fee (RM)"><NumberInput id="setup-fee" value={setupFee} onChange={setSetupFee} suffix="RM" /></Field>
                    <Field id="setup-desc" label="What is included (optional)"><input id="setup-desc" value={setupDesc} onChange={e => setSetupDesc(e.target.value)} placeholder="e.g. Pitched with flysheet and pegs" className={inputCls} /></Field>
                  </>
                )}
              </Section>
            )}

            {showTent && (
              <Section title="Tent details" summary={specsSummary(specs)} open={open === "specs"} onToggle={() => toggle("specs")}>
                <p className={hintCls}>Shown on the item page so campers can compare tents.</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field id="spec-type" label="Tent type">
                    <select id="spec-type" value={specs.tentType || ""} onChange={e => setSpecs(s => ({ ...s, tentType: e.target.value }))} className={inputCls}>
                      <option value="">Not specified</option>
                      {TENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field id="spec-pax" label="Sleeps"><input id="spec-pax" type="text" inputMode="numeric" value={specs.maxPax || ""} onChange={e => setSpecs(s => ({ ...s, maxPax: Number(e.target.value.replace(/[^0-9]/g, "")) || undefined }))} className={inputCls} /></Field>
                  <Field id="spec-pu" label="PU rating (mm)"><input id="spec-pu" type="text" value={specs.puRating || ""} onChange={e => setSpecs(s => ({ ...s, puRating: e.target.value }))} placeholder="e.g. 3000" className={inputCls} /></Field>
                  <Field id="spec-layers" label="Layers">
                    <select id="spec-layers" value={specs.layers || ""} onChange={e => setSpecs(s => ({ ...s, layers: e.target.value }))} className={inputCls}>
                      <option value="">Not specified</option>
                      <option value="Single Layer">Single</option>
                      <option value="Double Layer">Double</option>
                    </select>
                  </Field>
                  <Field id="spec-size" label="Size (cm)"><input id="spec-size" value={specs.size || ""} onChange={e => setSpecs(s => ({ ...s, size: e.target.value }))} placeholder="400 × 300 × 200" className={inputCls} /></Field>
                  <Field id="spec-weight" label="Weight (kg)"><input id="spec-weight" type="text" inputMode="decimal" value={specs.weight || ""} onChange={e => setSpecs(s => ({ ...s, weight: e.target.value }))} className={inputCls} /></Field>
                </div>
              </Section>
            )}

            {showPickup && (
              <Section title="Pickup point" summary={pickup || "Any of your pickup points"} open={open === "pickup"} onToggle={() => toggle("pickup")}>
                <p className={hintCls}>Choose one if this item is only kept at one place.</p>
                <div role="radiogroup" aria-label="Pickup point" className="flex flex-wrap gap-2">
                  {["", ...pickupPoints, ...(pickup && !pickupPoints.includes(pickup) ? [pickup] : [])].map(p => (
                    <button key={p || "any"} type="button" role="radio" aria-checked={pickup === p} onClick={() => setPickup(p)}
                      className={`min-h-10 px-3.5 rounded-xl text-[13px] ${pickup === p ? "border-2 border-[#062c24] bg-emerald-50 text-[#062c24] font-bold" : "border border-slate-300 bg-white text-slate-700 font-semibold"}`}>
                      {p || "Any"}
                    </button>
                  ))}
                </div>
              </Section>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border-t border-slate-200" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="max-w-xl mx-auto px-4 pt-3 pb-4 flex flex-col gap-1.5">
          <button type="button" onClick={save} disabled={saving || (!dirty && !isNew)}
            className="min-h-13 rounded-2xl bg-[#062c24] text-white text-[15px] font-bold hover:bg-[#0a4135] disabled:opacity-50">
            {saving ? (pending.length ? "Uploading photos" : "Saving") : isNew ? "Add item" : dirty ? "Save item" : "No changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
