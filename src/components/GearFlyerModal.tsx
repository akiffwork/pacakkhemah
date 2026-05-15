"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";

type GearSpecs = {
  size?: string;
  maxPax?: number;
  puRating?: string;
  layerType?: string;
  layers?: string;
  weight?: string;
  tentType?: string;
};

type GearVariant = {
  id: string;
  color?: { label: string; hex: string };
  size?: string;
  price: number;
  stock: number;
};

type GearItem = {
  id: string;
  name: string;
  price: number;
  stock: number;
  img?: string;
  images?: string[];
  desc?: string;
  category?: string;
  type?: string;
  inc?: string[];
  linkedItems?: { itemId: string; qty: number }[];
  deleted?: boolean;
  hasVariants?: boolean;
  variants?: GearVariant[];
  setup?: { available: boolean; fee: number; description: string };
  specs?: GearSpecs;
  size?: string;
  maxPax?: number;
  puRating?: string;
  layerType?: string;
  weight?: string;
  tentType?: string;
  pickupLocation?: string;
};

type VendorInfo = {
  name: string;
  tagline?: string;
  image?: string;
  phone?: string;
  city?: string;
  pickup?: string[];
  slug?: string;
};

type Props = { vendorId: string; onClose: () => void };

function resolveSpecs(item: GearItem): GearSpecs {
  return {
    size: item.specs?.size || item.size,
    maxPax: item.specs?.maxPax ?? item.maxPax,
    puRating: item.specs?.puRating || item.puRating,
    layerType: item.specs?.layerType || item.layerType || item.specs?.layers,
    weight: item.specs?.weight || item.weight,
    tentType: item.specs?.tentType || item.tentType,
  };
}

const SPEC_CHIPS: { key: keyof GearSpecs; icon: string; label: (v: string | number) => string }[] = [
  { key: "maxPax",    icon: "fa-users",         label: (v) => `${v} pax` },
  { key: "size",      icon: "fa-ruler-combined", label: (v) => `${v}` },
  { key: "weight",    icon: "fa-weight-hanging", label: (v) => `${v}` },
  { key: "puRating",  icon: "fa-tint",           label: (v) => `${v} PU` },
  { key: "layerType", icon: "fa-layer-group",    label: (v) => `${v}` },
  { key: "tentType",  icon: "fa-campground",     label: (v) => `${v}` },
];

function getPrice(item: GearItem): { base: number; isRange: boolean; min: number; max: number } {
  if (item.hasVariants && item.variants?.length) {
    const priced = item.variants.filter(v => v.price > 0);
    if (priced.length) {
      const min = Math.min(...priced.map(v => v.price));
      const max = Math.max(...priced.map(v => v.price));
      return { base: min, isRange: min !== max, min, max };
    }
  }
  return { base: item.price, isRange: false, min: item.price, max: item.price };
}

const DURATION_ROWS = [
  { label: "Day Trip", nights: 1, suffix: "(Same Day)" },
  { label: "2D1N",     nights: 1, suffix: "(1 Night)" },
  { label: "3D2N",     nights: 2, suffix: "(2 Nights)" },
  { label: "4D3N",     nights: 3, suffix: "(3 Nights)" },
  { label: "5D4N",     nights: 4, suffix: "(4 Nights)" },
];

export default function GearFlyerModal({ vendorId, onClose }: Props) {
  const [vendor, setVendor] = useState<VendorInfo | null>(null);
  const [allGear, setAllGear] = useState<GearItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [showPrice, setShowPrice] = useState(true);
  const [showDesc, setShowDesc] = useState(true);
  const [durationRows, setDurationRows] = useState(4);

  useEffect(() => {
    async function load() {
      try {
        const [vSnap, gSnap] = await Promise.all([
          getDoc(doc(db, "vendors", vendorId)),
          getDocs(query(collection(db, "gear"), where("vendorId", "==", vendorId))),
        ]);
        if (vSnap.exists()) setVendor(vSnap.data() as VendorInfo);
        const gear = gSnap.docs.map(d => ({ id: d.id, ...d.data() } as GearItem)).filter(g => !g.deleted);
        setAllGear(gear);
        setSelectedIds(new Set(gear.map(g => g.id)));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, [vendorId]);

  function toggleItem(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() { setSelectedIds(new Set(allGear.map(g => g.id))); }
  function selectNone() { setSelectedIds(new Set()); }

  const selectedItems = allGear.filter(g => selectedIds.has(g.id));
  const categories = Array.from(new Set(allGear.map(g => g.category || (g.type === "package" ? "Packages" : "Add-ons"))));

  const shopUrl = `https://pacakkhemah.com/shop/${vendor?.slug || vendorId}`;
  const waLink = vendor?.phone ? `https://wa.me/${vendor.phone.replace(/\D/g, "")}` : "#";
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(shopUrl)}&bgcolor=FFFFFF&color=062c24&margin=6`;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#062c24]/90 backdrop-blur-sm z-[500] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center">
          <i className="fas fa-spinner fa-spin text-emerald-600 text-2xl mb-3"></i>
          <p className="text-xs font-bold text-slate-400 uppercase">Loading gear...</p>
        </div>
      </div>
    );
  }

  // ==========================================
  // PRINT PREVIEW
  // ==========================================
  if (showPreview && vendor) {
    return (
      <div id="flyer-preview-root" className="fixed inset-0 bg-slate-800 z-[600] overflow-y-auto print:bg-white print:overflow-visible">
        <style>{`
          @media print {
            @page { size: A4 portrait; margin: 0; }
            body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body > * { visibility: hidden; }
            #flyer-preview-root, #flyer-preview-root * { visibility: visible; }
            #flyer-preview-root { position: absolute; top: 0; left: 0; width: 100%; background: none !important; overflow: visible !important; }
            #flyer-toolbar { display: none !important; }
            #flyer-paper { margin: 0 !important; box-shadow: none !important; width: 210mm !important; min-height: 297mm; }
          }
          .item-card { break-inside: avoid; page-break-inside: avoid; }
        `}</style>

        {/* Toolbar */}
        <div id="flyer-toolbar" className="sticky top-0 bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center z-50 shadow-md print:hidden">
          <button onClick={() => setShowPreview(false)} className="text-slate-500 hover:text-[#062c24] font-bold text-sm flex items-center gap-2">
            <i className="fas fa-arrow-left"></i> Back to Editor
          </button>
          <p className="text-xs text-slate-400 font-medium hidden sm:block">Choose <b>"Save as PDF"</b> as print destination</p>
          <button onClick={() => window.print()} className="bg-[#062c24] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-emerald-900 flex items-center gap-2 shadow-lg">
            <i className="fas fa-print"></i> Print / Save PDF
          </button>
        </div>

        {/* A4 Paper */}
        <div id="flyer-paper" className="w-[210mm] mx-auto bg-white my-6 shadow-2xl overflow-hidden print:my-0 print:shadow-none">

          {/* ── HEADER ── */}
          <div className="bg-[#062c24] px-8 py-6 flex items-center gap-5">
            {vendor.image && (
              <img src={vendor.image} crossOrigin="anonymous"
                className="w-[72px] h-[72px] rounded-2xl object-cover bg-white/10 shrink-0 border-2 border-white/20" alt="Logo" />
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-[28px] font-black text-white uppercase leading-none tracking-tight">{vendor.name}</h1>
              {vendor.tagline && (
                <p className="text-emerald-300 text-[11px] font-semibold mt-1 italic">{vendor.tagline}</p>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                {(vendor.city || (vendor.pickup && vendor.pickup.length > 0)) && (
                  <span className="text-emerald-100/80 text-[10px] flex items-center gap-1.5">
                    <i className="fas fa-map-marker-alt text-emerald-400"></i>
                    {vendor.city || vendor.pickup?.[0]}
                  </span>
                )}
                {vendor.pickup && vendor.pickup.length > 0 && (
                  <span className="text-emerald-100/80 text-[10px] flex items-center gap-1.5">
                    <i className="fas fa-car text-emerald-400"></i>
                    Pickup: {vendor.pickup.join(" · ")}
                  </span>
                )}
                {vendor.phone && (
                  <span className="text-emerald-100/80 text-[10px] flex items-center gap-1.5">
                    <i className="fab fa-whatsapp text-emerald-400"></i>
                    {vendor.phone}
                  </span>
                )}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-emerald-400 text-[8px] font-black uppercase tracking-widest">Powered by</p>
              <p className="text-white text-[10px] font-black">Pacak Khemah</p>
            </div>
          </div>

          {/* ── SUBTITLE BAR ── */}
          <div className="bg-emerald-600 py-2.5 text-center">
            <p className="text-white text-[9px] font-black uppercase tracking-[0.25em]">
              Gear Rental Catalogue &nbsp;·&nbsp; Senarai Gear Untuk DiSewa
            </p>
          </div>

          {/* ── ITEM GRID (2 columns) ── */}
          <div className="p-5 grid grid-cols-2 gap-4">
            {selectedItems.map((item) => {
              const imgUrl = item.images?.[0] || item.img;
              const specs = resolveSpecs(item);
              const activeSpecs = SPEC_CHIPS.filter(({ key }) => {
                const v = specs[key];
                return v !== undefined && v !== null && v !== "";
              });
              const isPkg = item.type === "package" && item.linkedItems && item.linkedItems.length > 0;
              const pricing = getPrice(item);
              const hasInc = item.inc && item.inc.filter(Boolean).length > 0;
              const durations = DURATION_ROWS.slice(0, durationRows);

              return (
                <div key={item.id} className="item-card border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm flex flex-col">

                  {/* Item image */}
                  {imgUrl ? (
                    <div className="aspect-[16/9] w-full relative bg-slate-100">
                      <img src={imgUrl} crossOrigin="anonymous" className="w-full h-full object-cover" alt={item.name} />
                      {/* Category badge */}
                      {item.category && (
                        <span className="absolute top-2 left-2 bg-[#062c24]/80 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full backdrop-blur-sm">
                          {item.category}
                        </span>
                      )}
                      {isPkg && (
                        <span className="absolute top-2 right-2 bg-emerald-500 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full">
                          Package
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="aspect-[16/9] w-full bg-slate-100 flex items-center justify-center">
                      <i className="fas fa-image text-slate-300 text-3xl"></i>
                    </div>
                  )}

                  <div className="p-3 flex flex-col gap-2 flex-1">

                    {/* Name */}
                    <h3 className="font-black text-[13px] text-[#062c24] uppercase leading-tight">{item.name}</h3>

                    {/* Description */}
                    {showDesc && item.desc && (
                      <p className="text-[9px] text-slate-500 leading-relaxed line-clamp-2">{item.desc}</p>
                    )}

                    {/* Spec chips */}
                    {activeSpecs.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {activeSpecs.map(({ key, icon, label }) => (
                          <span key={key} className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-[8px] px-1.5 py-0.5 rounded font-semibold">
                            <i className={`fas ${icon} text-emerald-600`} style={{ fontSize: "7px" }}></i>
                            {label(specs[key]!)}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Pricing table */}
                    {showPrice && (
                      <div className="border border-slate-200 rounded-lg overflow-hidden mt-1">
                        <div className="bg-[#062c24] px-2.5 py-1">
                          <p className="text-emerald-300 text-[8px] font-black uppercase tracking-wider">Rental Price</p>
                        </div>
                        <table className="w-full">
                          <tbody>
                            {durations.map((row, i) => {
                              const total = pricing.base * row.nights;
                              return (
                                <tr key={row.label} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                                  <td className="px-2.5 py-1 text-[9px] font-black text-[#062c24] w-16">{row.label}</td>
                                  <td className="px-2 py-1 text-[8px] text-slate-400 font-medium">{row.suffix}</td>
                                  <td className="px-2.5 py-1 text-right text-[9px] font-black text-emerald-600">
                                    {pricing.isRange
                                      ? `From RM ${pricing.min * row.nights}`
                                      : `RM ${total}`}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Includes list (legacy text) */}
                    {hasInc && (
                      <div className="mt-1">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-1">Includes</p>
                        <div className="flex flex-wrap gap-1">
                          {item.inc!.filter(Boolean).map((inc, i) => (
                            <span key={i} className="text-[8px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-medium">
                              <i className="fas fa-check text-[7px] mr-1"></i>{inc}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Package linked items */}
                    {isPkg && (
                      <div className="mt-1 border-t border-slate-100 pt-2">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                          Package Includes
                        </p>
                        <div className="space-y-1">
                          {item.linkedItems!.map((li, idx) => {
                            const linked = allGear.find(g => g.id === li.itemId);
                            const linkedImg = linked?.images?.[0] || linked?.img;
                            return (
                              <div key={idx} className="flex items-center gap-1.5">
                                {linkedImg ? (
                                  <img src={linkedImg} crossOrigin="anonymous"
                                    className="w-7 h-7 rounded object-cover border border-slate-200 bg-slate-50 shrink-0" alt="" />
                                ) : (
                                  <div className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center shrink-0">
                                    <i className="fas fa-box text-slate-300 text-[8px]"></i>
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-[9px] font-bold text-[#062c24] truncate">{linked?.name || "Item"}</p>
                                  {linked?.specs && (() => {
                                    const s = resolveSpecs(linked);
                                    const chip = SPEC_CHIPS.find(c => s[c.key]);
                                    return chip ? (
                                      <p className="text-[7px] text-slate-400">
                                        <i className={`fas ${chip.icon} mr-0.5`}></i>{chip.label(s[chip.key]!)}
                                      </p>
                                    ) : null;
                                  })()}
                                </div>
                                <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">
                                  ×{li.qty}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Setup service */}
                    {item.setup?.available && (
                      <div className="mt-auto pt-1">
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-[8px] px-2 py-0.5 rounded-full font-semibold">
                          <i className="fas fa-tools text-[7px]"></i>
                          Setup Service Available (+RM{item.setup.fee})
                        </span>
                      </div>
                    )}

                    {/* CTA button */}
                    <a href={waLink} className="mt-auto w-full bg-[#062c24] text-white py-1.5 rounded-lg text-center text-[9px] font-black tracking-widest uppercase flex items-center justify-center gap-1.5 no-underline">
                      <i className="fab fa-whatsapp text-emerald-400"></i> Order via WhatsApp
                    </a>

                  </div>
                </div>
              );
            })}
          </div>

          {/* ── FOOTER ── */}
          <div className="bg-[#062c24] px-8 py-6 flex items-center gap-6">
            <img src={qrUrl} crossOrigin="anonymous"
              className="w-[80px] h-[80px] rounded-xl bg-white p-1.5 shrink-0" alt="QR" />
            <div className="flex-1">
              <p className="text-emerald-300 text-[8px] font-black uppercase tracking-widest mb-1">
                Imbas / Scan to Browse &amp; Order
              </p>
              <p className="text-white text-[13px] font-black mb-1">{vendor.name}</p>
              <p className="text-emerald-100/60 text-[9px] font-mono tracking-tight">{shopUrl}</p>
              {vendor.phone && (
                <p className="text-emerald-100/80 text-[9px] mt-1 flex items-center gap-1.5">
                  <i className="fab fa-whatsapp text-emerald-400"></i> WhatsApp: {vendor.phone}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right self-end">
              <p className="text-emerald-700 text-[7px] uppercase tracking-widest">Powered by</p>
              <p className="text-emerald-500 text-[10px] font-black">Pacak Khemah</p>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ==========================================
  // EDITOR VIEW
  // ==========================================
  return (
    <div className="fixed inset-0 bg-[#062c24]/90 backdrop-blur-sm z-[500] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
              <i className="fas fa-file-pdf text-lg"></i>
            </div>
            <div>
              <h3 className="text-sm font-black text-[#062c24] uppercase">Gear Flyer Editor</h3>
              <p className="text-[10px] text-slate-400 font-medium">Select items · configure layout</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Controls */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 space-y-2.5">
          {/* Item count + select all/none */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-slate-500 uppercase">{selectedIds.size} / {allGear.length} items</span>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-[10px] font-bold text-emerald-600 hover:underline uppercase">All</button>
                <span className="text-slate-300">|</span>
                <button onClick={selectNone} className="text-[10px] font-bold text-slate-400 hover:underline uppercase">None</button>
              </div>
            </div>
            {/* Duration rows */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-500 uppercase">Pricing Rows</span>
              <select value={durationRows} onChange={e => setDurationRows(Number(e.target.value))}
                className="text-[10px] font-bold text-[#062c24] bg-white border border-slate-200 rounded-lg px-2 py-1 focus:outline-none">
                {[2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          {/* Toggles */}
          <div className="flex items-center gap-4">
            {[
              { label: "Show Price", value: showPrice, set: setShowPrice },
              { label: "Show Description", value: showDesc, set: setShowDesc },
            ].map(({ label, value, set }) => (
              <label key={label} className="flex items-center gap-2 cursor-pointer select-none">
                <button type="button" onClick={() => set(p => !p)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${value ? "bg-emerald-500" : "bg-slate-300"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${value ? "translate-x-4" : "translate-x-0"}`} />
                </button>
                <span className="text-[10px] font-black text-slate-500 uppercase">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Item List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5" style={{ scrollbarWidth: "none" }}>
          {categories.map(cat => {
            const items = allGear.filter(g => (g.category || (g.type === "package" ? "Packages" : "Add-ons")) === cat);
            if (!items.length) return null;
            return (
              <div key={cat}>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">{cat}</p>
                <div className="space-y-2">
                  {items.map(item => {
                    const isPkg = item.type === "package" && item.linkedItems && item.linkedItems.length > 0;
                    const specs = resolveSpecs(item);
                    const activeSpecs = SPEC_CHIPS.filter(({ key }) => {
                      const v = specs[key];
                      return v !== undefined && v !== null && v !== "";
                    });
                    const pricing = getPrice(item);
                    return (
                      <label key={item.id}
                        className={`flex items-center gap-4 p-3 rounded-2xl border cursor-pointer transition-all ${
                          selectedIds.has(item.id) ? "bg-emerald-50/50 border-emerald-200 shadow-sm" : "bg-white border-slate-100 hover:border-slate-200"
                        }`}>
                        <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleItem(item.id)}
                          className="w-5 h-5 accent-emerald-600 rounded shrink-0 cursor-pointer" />
                        <div className="w-12 h-12 bg-slate-100 rounded-xl overflow-hidden shrink-0 border border-slate-200/50">
                          {(item.images?.[0] || item.img) ? (
                            <img src={item.images?.[0] || item.img} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs"><i className="fas fa-image"></i></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-[#062c24] truncate">{item.name}</p>
                            {isPkg && <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-black shrink-0">PKG</span>}
                          </div>
                          {activeSpecs.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {activeSpecs.slice(0, 3).map(({ key, icon, label }) => (
                                <span key={key} className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 text-[9px] px-1.5 py-0.5 rounded font-semibold">
                                  <i className={`fas ${icon} text-emerald-500`} style={{ fontSize: "7px" }}></i>
                                  {label(specs[key]!)}
                                </span>
                              ))}
                              {activeSpecs.length > 3 && <span className="text-[9px] text-slate-400 font-semibold px-1">+{activeSpecs.length - 3}</span>}
                            </div>
                          )}
                          <p className="text-[11px] text-emerald-600 font-bold mt-0.5">
                            {pricing.isRange ? `RM ${pricing.min} – ${pricing.max}` : `RM ${pricing.base}`}/malam
                            {isPkg && item.linkedItems && <span className="text-slate-400 font-medium"> · {item.linkedItems.length} items</span>}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {allGear.length === 0 && (
            <div className="text-center py-12">
              <i className="fas fa-box-open text-slate-200 text-4xl mb-4"></i>
              <p className="text-sm text-slate-400 font-bold">No gear items found</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 bg-white z-10">
          <button onClick={() => setShowPreview(true)} disabled={selectedIds.size === 0}
            className="w-full py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-[#062c24] text-white hover:bg-emerald-900">
            <i className="fas fa-eye text-sm"></i> Preview & Print Flyer ({selectedIds.size} items)
          </button>
        </div>

      </div>
    </div>
  );
}
