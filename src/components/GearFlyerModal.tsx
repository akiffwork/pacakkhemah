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
    // Split items: packages keep 2-col layout, singles get 3-col compact layout
    const packageItems = selectedItems.filter(item => item.type === "package" && item.linkedItems && item.linkedItems.length > 0);
    const singleItems  = selectedItems.filter(item => !(item.type === "package" && item.linkedItems && item.linkedItems.length > 0));

    const singleRows: GearItem[][] = [];
    for (let i = 0; i < singleItems.length; i += 3) singleRows.push(singleItems.slice(i, i + 3));

    const packageRows: GearItem[][] = [];
    for (let i = 0; i < packageItems.length; i += 2) packageRows.push(packageItems.slice(i, i + 2));

    // Table uses 6 columns (LCM of 2 and 3):
    //   singles → each td colSpan=2  (3 per row = 6 cols)
    //   packages → each td colSpan=3 (2 per row = 6 cols)
    //   header/footer → colSpan=6

    // Shared header markup (used in both thead and repeated on every page)
    const flyerHeader = (
      <>
        <div style={{ background: "#062c24", padding: "20px 28px", display: "flex", alignItems: "center", gap: "16px" }}>
          {vendor.image && (
            <img src={vendor.image} crossOrigin="anonymous"
              style={{ width: 64, height: 64, borderRadius: 14, objectFit: "cover", border: "2px solid rgba(255,255,255,0.2)", flexShrink: 0 }} alt="Logo" />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", textTransform: "uppercase", letterSpacing: "-0.5px", lineHeight: 1 }}>{vendor.name}</div>
            {vendor.tagline && <div style={{ fontSize: 10, color: "#6ee7b7", fontStyle: "italic", marginTop: 4 }}>{vendor.tagline}</div>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px 20px", marginTop: 6 }}>
              {(vendor.city || vendor.pickup?.[0]) && (
                <span style={{ fontSize: 9, color: "rgba(209,250,229,0.8)", display: "flex", alignItems: "center", gap: 4 }}>
                  <i className="fas fa-map-marker-alt" style={{ color: "#34d399" }}></i>
                  {vendor.city || vendor.pickup?.[0]}
                </span>
              )}
              {vendor.pickup && vendor.pickup.length > 0 && (
                <span style={{ fontSize: 9, color: "rgba(209,250,229,0.8)", display: "flex", alignItems: "center", gap: 4 }}>
                  <i className="fas fa-car" style={{ color: "#34d399" }}></i>
                  Pickup: {vendor.pickup.join(" · ")}
                </span>
              )}
              {vendor.phone && (
                <span style={{ fontSize: 9, color: "rgba(209,250,229,0.8)", display: "flex", alignItems: "center", gap: 4 }}>
                  <i className="fab fa-whatsapp" style={{ color: "#34d399" }}></i>
                  {vendor.phone}
                </span>
              )}
            </div>
          </div>
          <div style={{ flexShrink: 0, textAlign: "right" }}>
            <div style={{ fontSize: 7, color: "#34d399", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.15em" }}>Powered by</div>
            <div style={{ fontSize: 9, color: "#fff", fontWeight: 900 }}>Pacak Khemah</div>
          </div>
        </div>
        <div style={{ background: "#059669", padding: "8px", textAlign: "center" }}>
          <span style={{ fontSize: 8, color: "#fff", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.2em" }}>
            Gear Rental Catalogue &nbsp;·&nbsp; Senarai Gear Untuk DiSewa
          </span>
        </div>
      </>
    );

    const flyerFooter = (
      <div style={{ background: "#062c24", padding: "20px 28px", display: "flex", alignItems: "center", gap: "20px" }}>
        <img src={qrUrl} crossOrigin="anonymous"
          style={{ width: 72, height: 72, borderRadius: 12, background: "#fff", padding: 5, flexShrink: 0 }} alt="QR" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 8, color: "#34d399", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 3 }}>
            Imbas / Scan to Browse &amp; Order
          </div>
          <div style={{ fontSize: 13, color: "#fff", fontWeight: 900, marginBottom: 2 }}>{vendor.name}</div>
          <div style={{ fontSize: 8, color: "rgba(209,250,229,0.6)", fontFamily: "monospace" }}>{shopUrl}</div>
          {vendor.phone && (
            <div style={{ fontSize: 9, color: "rgba(209,250,229,0.8)", marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
              <i className="fab fa-whatsapp" style={{ color: "#34d399" }}></i> WhatsApp: {vendor.phone}
            </div>
          )}
        </div>
        <div style={{ flexShrink: 0, textAlign: "right", alignSelf: "flex-end" }}>
          <div style={{ fontSize: 7, color: "#065f46", textTransform: "uppercase", letterSpacing: "0.1em" }}>Powered by</div>
          <div style={{ fontSize: 9, color: "#34d399", fontWeight: 900 }}>Pacak Khemah</div>
        </div>
      </div>
    );

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
            #flyer-wrap { margin: 0 !important; box-shadow: none !important; width: 100% !important; }
            /* thead and tfoot repeat on every printed page */
            #flyer-table thead { display: table-header-group; }
            #flyer-table tfoot { display: table-footer-group; }
            #flyer-table tbody { display: table-row-group; }
          }
        `}</style>

        {/* Toolbar */}
        <div id="flyer-toolbar" className="sticky top-0 bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center z-50 shadow-md">
          <button onClick={() => setShowPreview(false)} className="text-slate-500 hover:text-[#062c24] font-bold text-sm flex items-center gap-2">
            <i className="fas fa-arrow-left"></i> Back to Editor
          </button>
          <p className="text-xs text-slate-400 font-medium hidden sm:block">Choose <b>"Save as PDF"</b> as print destination</p>
          <button onClick={() => window.print()} className="bg-[#062c24] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-emerald-900 flex items-center gap-2 shadow-lg">
            <i className="fas fa-print"></i> Print / Save PDF
          </button>
        </div>

        {/* A4 paper wrapper — shadow + centering on screen only */}
        <div id="flyer-wrap" className="w-[210mm] mx-auto my-6 bg-white shadow-2xl print:my-0 print:shadow-none print:w-full">

          {/*
            THE KEY: wrapping in <table> makes browsers automatically repeat
            <thead> (header) and <tfoot> (footer) on every printed page.
            Each <tbody> <tr> is a row of 2 item cards.
          */}
          <table id="flyer-table" style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>

            <thead>
              <tr>
                <td colSpan={6} style={{ padding: 0 }}>
                  {flyerHeader}
                </td>
              </tr>
            </thead>

            <tfoot>
              <tr>
                <td colSpan={6} style={{ padding: 0 }}>
                  {flyerFooter}
                </td>
              </tr>
            </tfoot>

            <tbody>
              <tr aria-hidden="true"><td colSpan={6} style={{ height: 14 }}></td></tr>

              {/* ── SINGLE ITEMS — 3 per row, compact square cards ── */}
              {singleRows.map((trio, rowIdx) => (
                <tr key={`s-${rowIdx}`} style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
                  {trio.map((item, colIdx) => {
                    const imgUrl = item.images?.[0] || item.img;
                    const specs = resolveSpecs(item);
                    const activeSpecs = SPEC_CHIPS.filter(({ key }) => { const v = specs[key]; return v !== undefined && v !== null && v !== ""; });
                    const pricing = getPrice(item);
                    const hasInc = item.inc && item.inc.filter(Boolean).length > 0;
                    const durations = DURATION_ROWS.slice(0, durationRows);
                    const validDesc = item.desc && item.desc !== "undefined" && item.desc.trim();
                    const pad = colIdx === 0 ? "0 5px 12px 14px" : colIdx === 1 ? "0 5px 12px 5px" : "0 14px 12px 5px";
                    return (
                      <td key={item.id} colSpan={2} style={{ width: "33.33%", verticalAlign: "top", padding: pad }}>
                        <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", background: "#fff", breakInside: "avoid" }}>

                          {/* Square image */}
                          {imgUrl ? (
                            <div style={{ position: "relative", paddingTop: "100%", background: "#f1f5f9" }}>
                              <img src={imgUrl} crossOrigin="anonymous"
                                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} alt={item.name} />
                              {item.category && (
                                <span style={{ position: "absolute", top: 5, left: 5, background: "rgba(6,44,36,0.85)", color: "#fff", fontSize: 6, fontWeight: 900, textTransform: "uppercase", padding: "2px 6px", borderRadius: 99 }}>
                                  {item.category}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div style={{ paddingTop: "100%", position: "relative", background: "#f1f5f9" }}>
                              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <i className="fas fa-image" style={{ color: "#cbd5e1", fontSize: 20 }}></i>
                              </div>
                            </div>
                          )}

                          <div style={{ padding: "8px 9px 9px", display: "flex", flexDirection: "column", gap: 6 }}>

                            {/* Name */}
                            <div style={{ fontSize: 10, fontWeight: 900, color: "#062c24", textTransform: "uppercase", lineHeight: 1.2 }}>{item.name}</div>

                            {/* Description */}
                            {showDesc && validDesc && (
                              <div style={{ fontSize: 7, color: "#64748b", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                {validDesc}
                              </div>
                            )}

                            {/* Spec chips */}
                            {activeSpecs.length > 0 && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                                {activeSpecs.slice(0, 3).map(({ key, icon, label }) => (
                                  <span key={key} style={{ display: "inline-flex", alignItems: "center", gap: 2, background: "#f1f5f9", color: "#475569", fontSize: 6.5, padding: "2px 5px", borderRadius: 4, fontWeight: 700 }}>
                                    <i className={`fas ${icon}`} style={{ color: "#059669", fontSize: 5.5 }}></i>
                                    {label(specs[key]!)}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Pricing table */}
                            {showPrice && (
                              <div style={{ border: "1px solid #e2e8f0", borderRadius: 6, overflow: "hidden" }}>
                                <div style={{ background: "#062c24", padding: "3px 8px" }}>
                                  <span style={{ fontSize: 6.5, color: "#6ee7b7", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>Rental Price</span>
                                </div>
                                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                  <tbody>
                                    {durations.map((row, i) => (
                                      <tr key={row.label} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                                        <td style={{ padding: "2.5px 7px", fontSize: 7, fontWeight: 900, color: "#062c24", width: 40 }}>{row.label}</td>
                                        <td style={{ padding: "2.5px 3px", fontSize: 6, color: "#94a3b8" }}>{row.suffix}</td>
                                        <td style={{ padding: "2.5px 7px", fontSize: 7, fontWeight: 900, color: "#059669", textAlign: "right" }}>
                                          {pricing.isRange ? `From RM${pricing.min * row.nights}` : `RM${pricing.base * row.nights}`}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {/* Includes */}
                            {hasInc && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                                {item.inc!.filter(Boolean).map((inc, i) => (
                                  <span key={i} style={{ fontSize: 6.5, background: "#ecfdf5", color: "#065f46", padding: "2px 5px", borderRadius: 3, fontWeight: 600 }}>✓ {inc}</span>
                                ))}
                              </div>
                            )}

                            {/* Setup badge */}
                            {item.setup?.available && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "#fffbeb", color: "#92400e", fontSize: 6.5, padding: "2px 7px", borderRadius: 99, fontWeight: 600 }}>
                                <i className="fas fa-tools" style={{ fontSize: 5.5 }}></i> Setup +RM{item.setup.fee}
                              </span>
                            )}

                            {/* CTA */}
                            <a href={waLink} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 2, background: "#062c24", color: "#fff", padding: "5px", borderRadius: 6, fontSize: 7, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", textDecoration: "none" }}>
                              <i className="fab fa-whatsapp" style={{ color: "#34d399" }}></i> Order via WhatsApp
                            </a>

                          </div>
                        </div>
                      </td>
                    );
                  })}
                  {/* Fill remaining cells in last row */}
                  {trio.length < 3 && Array.from({ length: 3 - trio.length }).map((_, i) => (
                    <td key={`empty-s-${i}`} colSpan={2} style={{ width: "33.33%" }}></td>
                  ))}
                </tr>
              ))}

              {/* Spacing between sections */}
              {singleItems.length > 0 && packageItems.length > 0 && (
                <tr aria-hidden="true"><td colSpan={6} style={{ height: 8 }}></td></tr>
              )}

              {/* ── PACKAGE ITEMS — 2 per row, full-width cards (unchanged layout) ── */}
              {packageRows.map((pair, rowIdx) => (
                <tr key={`p-${rowIdx}`} style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
                  {pair.map((item, colIdx) => {
                    const imgUrl = item.images?.[0] || item.img;
                    const specs = resolveSpecs(item);
                    const activeSpecs = SPEC_CHIPS.filter(({ key }) => { const v = specs[key]; return v !== undefined && v !== null && v !== ""; });
                    const pricing = getPrice(item);
                    const hasInc = item.inc && item.inc.filter(Boolean).length > 0;
                    const durations = DURATION_ROWS.slice(0, durationRows);
                    const validDesc = item.desc && item.desc !== "undefined" && item.desc.trim();
                    return (
                      <td key={item.id} colSpan={3} style={{ width: "50%", verticalAlign: "top", padding: colIdx === 0 ? "0 8px 16px 16px" : "0 16px 16px 8px" }}>
                        <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", background: "#fff", breakInside: "avoid" }}>

                          {/* Image 16:9 */}
                          {imgUrl ? (
                            <div style={{ position: "relative", paddingTop: "56.25%", background: "#f1f5f9" }}>
                              <img src={imgUrl} crossOrigin="anonymous"
                                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} alt={item.name} />
                              {item.category && (
                                <span style={{ position: "absolute", top: 6, left: 6, background: "rgba(6,44,36,0.8)", color: "#fff", fontSize: 7, fontWeight: 900, textTransform: "uppercase", padding: "2px 7px", borderRadius: 99 }}>{item.category}</span>
                              )}
                              <span style={{ position: "absolute", top: 6, right: 6, background: "#10b981", color: "#fff", fontSize: 7, fontWeight: 900, textTransform: "uppercase", padding: "2px 7px", borderRadius: 99 }}>Package</span>
                            </div>
                          ) : (
                            <div style={{ paddingTop: "56.25%", position: "relative", background: "#f1f5f9" }}>
                              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <i className="fas fa-image" style={{ color: "#cbd5e1", fontSize: 24 }}></i>
                              </div>
                            </div>
                          )}

                          <div style={{ padding: "10px 12px 12px", display: "flex", flexDirection: "column", gap: 8 }}>

                            <div style={{ fontSize: 12, fontWeight: 900, color: "#062c24", textTransform: "uppercase", lineHeight: 1.2 }}>{item.name}</div>

                            {showDesc && validDesc && (
                              <div style={{ fontSize: 8, color: "#64748b", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{validDesc}</div>
                            )}

                            {activeSpecs.length > 0 && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                                {activeSpecs.map(({ key, icon, label }) => (
                                  <span key={key} style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "#f1f5f9", color: "#475569", fontSize: 7, padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>
                                    <i className={`fas ${icon}`} style={{ color: "#059669", fontSize: 6 }}></i>
                                    {label(specs[key]!)}
                                  </span>
                                ))}
                              </div>
                            )}

                            {showPrice && (
                              <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                                <div style={{ background: "#062c24", padding: "4px 10px" }}>
                                  <span style={{ fontSize: 7, color: "#6ee7b7", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em" }}>Rental Price</span>
                                </div>
                                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                  <tbody>
                                    {durations.map((row, i) => (
                                      <tr key={row.label} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                                        <td style={{ padding: "3px 10px", fontSize: 8, fontWeight: 900, color: "#062c24", width: 52 }}>{row.label}</td>
                                        <td style={{ padding: "3px 4px", fontSize: 7, color: "#94a3b8" }}>{row.suffix}</td>
                                        <td style={{ padding: "3px 10px", fontSize: 8, fontWeight: 900, color: "#059669", textAlign: "right" }}>
                                          {pricing.isRange ? `From RM ${pricing.min * row.nights}` : `RM ${pricing.base * row.nights}`}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {hasInc && (
                              <div>
                                <div style={{ fontSize: 7, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>Includes</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                                  {item.inc!.filter(Boolean).map((inc, i) => (
                                    <span key={i} style={{ fontSize: 7, background: "#ecfdf5", color: "#065f46", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>✓ {inc}</span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Package linked items */}
                            {item.linkedItems && item.linkedItems.length > 0 && (
                              <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 8 }}>
                                <div style={{ fontSize: 7, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>Package Includes</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                  {item.linkedItems.map((li, idx) => {
                                    const linked = allGear.find(g => g.id === li.itemId);
                                    const linkedImg = linked?.images?.[0] || linked?.img;
                                    return (
                                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        {linkedImg ? (
                                          <img src={linkedImg} crossOrigin="anonymous" style={{ width: 26, height: 26, borderRadius: 4, objectFit: "cover", border: "1px solid #e2e8f0", flexShrink: 0 }} alt="" />
                                        ) : (
                                          <div style={{ width: 26, height: 26, borderRadius: 4, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                            <i className="fas fa-box" style={{ color: "#cbd5e1", fontSize: 7 }}></i>
                                          </div>
                                        )}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <div style={{ fontSize: 8, fontWeight: 700, color: "#062c24", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{linked?.name || "Item"}</div>
                                          {linked && (() => { const s = resolveSpecs(linked); const chip = SPEC_CHIPS.find(c => s[c.key]); return chip ? <div style={{ fontSize: 7, color: "#94a3b8" }}>{chip.label(s[chip.key]!)}</div> : null; })()}
                                        </div>
                                        <span style={{ fontSize: 7, fontWeight: 900, color: "#059669", background: "#ecfdf5", padding: "2px 5px", borderRadius: 4, flexShrink: 0 }}>×{li.qty}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {item.setup?.available && (
                              <div style={{ marginTop: 4 }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#fffbeb", color: "#92400e", fontSize: 7, padding: "3px 8px", borderRadius: 99, fontWeight: 600 }}>
                                  <i className="fas fa-tools" style={{ fontSize: 6 }}></i> Setup Service +RM{item.setup.fee}
                                </span>
                              </div>
                            )}

                            <a href={waLink} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 6, background: "#062c24", color: "#fff", padding: "6px", borderRadius: 8, fontSize: 8, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", textDecoration: "none" }}>
                              <i className="fab fa-whatsapp" style={{ color: "#34d399" }}></i> Order via WhatsApp
                            </a>

                          </div>
                        </div>
                      </td>
                    );
                  })}
                  {pair.length === 1 && <td colSpan={3} style={{ width: "50%" }}></td>}
                </tr>
              ))}

              <tr aria-hidden="true"><td colSpan={6} style={{ height: 16 }}></td></tr>
            </tbody>

          </table>
        </div>{/* end #flyer-wrap */}
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
