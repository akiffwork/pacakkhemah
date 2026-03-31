"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";

type GearItem = {
  id: string;
  name: string;
  price: number;
  img?: string;
  images?: string[];
  category?: string;
  type?: string;
  deleted?: boolean;
  linkedItems?: { itemId: string; qty: number }[];
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

export default function GearFlyerModal({ vendorId, onClose }: Props) {
  const [vendor, setVendor] = useState<VendorInfo | null>(null);
  const [allGear, setAllGear] = useState<GearItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [vSnap, gSnap] = await Promise.all([
          getDoc(doc(db, "vendors", vendorId)),
          getDocs(query(collection(db, "gear"), where("vendorId", "==", vendorId))),
        ]);
        if (vSnap.exists()) setVendor(vSnap.data() as VendorInfo);
        const gear = gSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as GearItem))
          .filter(g => !g.deleted);
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
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(shopUrl)}&bgcolor=FFFFFF&color=062c24`;

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
  // VIEW: PRINT PREVIEW (The Output)
  // ==========================================
  if (showPreview && vendor) {
    return (
      <div id="flyer-preview-root" className="fixed inset-0 bg-slate-900 z-[600] overflow-y-auto print:bg-white print:overflow-visible">
        {/* CSS for perfect native A4 printing */}
        <style>{`
          @media print {
            @page { size: A4 portrait; margin: 0; }
            body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body > * { visibility: hidden; }
            #flyer-preview-root, #flyer-preview-root * { visibility: visible; }
            #flyer-preview-root { position: absolute; top: 0; left: 0; width: 100%; background: none !important; overflow: visible !important; }
            #flyer-toolbar { display: none !important; }
            #flyer-paper { margin: 0 !important; box-shadow: none !important; width: 100% !important; }
          }
        `}</style>

        {/* Toolbar - Hidden when printing */}
        <div id="flyer-toolbar" className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center z-50 print:hidden shadow-md">
          <button onClick={() => setShowPreview(false)} className="text-slate-500 hover:text-[#062c24] font-bold text-sm flex items-center gap-2 transition-colors">
            <i className="fas fa-arrow-left"></i> Back to Editor
          </button>
          <div className="flex items-center gap-4">
            <p className="text-xs text-slate-400 font-medium hidden sm:block">
              Choose <b>"Save as PDF"</b> in the print destination
            </p>
            <button onClick={() => window.print()} className="bg-[#062c24] text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-emerald-900 transition-colors shadow-lg flex items-center gap-2">
              <i className="fas fa-print"></i> Print / Save PDF
            </button>
          </div>
        </div>

        {/* A4 Paper Layout */}
        <div id="flyer-paper" className="w-[210mm] min-h-[297mm] mx-auto bg-white my-8 shadow-2xl flex flex-col relative print:my-0 print:w-full print:shadow-none overflow-hidden">
          
          {/* HEADER */}
          <div className="bg-[#062c24] flex items-center p-8 text-white break-inside-avoid">
            {vendor.image && (
              <img src={vendor.image} crossOrigin="anonymous" className="w-20 h-20 rounded-xl object-cover bg-white p-1 mr-6 shrink-0" alt="Vendor Logo" />
            )}
            <div>
              <h1 className="text-3xl font-black uppercase tracking-wide leading-tight">{vendor.name}</h1>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2 text-emerald-100 text-sm">
                {vendor.pickup && vendor.pickup.length > 0 && (
                  <span><i className="fas fa-map-marker-alt mr-2"></i>Pickup: {vendor.pickup.join(", ")}</span>
                )}
                {vendor.phone && (
                  <span><i className="fab fa-whatsapp mr-2"></i>WhatsApp: {vendor.phone}</span>
                )}
              </div>
            </div>
          </div>
          
          {/* SUBTITLE */}
          <div className="bg-slate-100 py-3 text-center text-[10px] font-black text-[#062c24] tracking-[0.2em] uppercase border-b border-slate-200 break-inside-avoid">
             Senarai Gear Untuk DiseWA &nbsp;/&nbsp; Gear Rental Catalogue
          </div>

          {/* GRID OF ITEMS */}
          <div className="p-6 grid grid-cols-3 gap-5 flex-1 content-start items-start">
            {selectedItems.map((item) => {
              const imgUrl = item.images?.[0] || item.img;
              const isPkg = item.type === "package" && item.linkedItems && item.linkedItems.length > 0;

              return (
                <div key={item.id} className="border border-slate-200 rounded-xl bg-white overflow-hidden flex flex-col break-inside-avoid shadow-sm h-full">
                  
                  {/* Item Image (4:3 aspect ratio, cover, no stretching) */}
                  <div className="aspect-[4/3] w-full relative bg-slate-50 border-b border-slate-100">
                    {imgUrl ? (
                      <img src={imgUrl} crossOrigin="anonymous" className="w-full h-full object-cover" alt={item.name} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300"><i className="fas fa-image text-2xl"></i></div>
                    )}
                  </div>
                  
                  {/* Item Info */}
                  <div className="p-4 flex flex-col flex-1 gap-3">
                    <div>
                      <h4 className="font-black text-[13px] text-[#062c24] uppercase leading-tight">{item.name}</h4>
                      <p className="text-emerald-600 font-bold text-xs mt-1">RM {item.price}/night</p>
                    </div>

                    {/* Package Thumbnails */}
                    {isPkg && (
                      <div className="flex flex-wrap gap-1.5 mt-auto pt-2 border-t border-slate-100">
                        {item.linkedItems!.map((li, idx) => {
                          const linkedItem = allGear.find(g => g.id === li.itemId);
                          const linkedImg = linkedItem?.images?.[0] || linkedItem?.img;
                          return linkedImg ? (
                            <img key={idx} src={linkedImg} crossOrigin="anonymous" className="w-6 h-6 rounded object-cover border border-slate-200 bg-slate-50" title={linkedItem?.name} alt="" />
                          ) : null;
                        })}
                      </div>
                    )}

                    {/* Button */}
                    <div className={isPkg ? "mt-1" : "mt-auto pt-2"}>
                      <div className="w-full bg-[#062c24] text-white py-2.5 rounded-lg text-center text-[11px] font-black tracking-widest uppercase">
                        Shop Now
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* FOOTER */}
          <div className="bg-[#062c24] p-8 text-white flex items-center gap-6 mt-auto break-inside-avoid">
            <img src={qrUrl} crossOrigin="anonymous" className="w-24 h-24 rounded-xl bg-white p-1.5 shrink-0" alt="QR Code" />
            <div>
              <h2 className="text-xl font-black uppercase tracking-wide mb-1 text-emerald-50">Imbas Untuk Tempah</h2>
              <p className="text-emerald-100 text-sm mb-2 opacity-90">Scan to browse & book via WhatsApp</p>
              <p className="text-emerald-400 text-xs font-mono font-bold tracking-tight bg-black/20 inline-block px-2 py-1 rounded">{shopUrl}</p>
            </div>
            <div className="ml-auto text-right self-end pb-1 opacity-50">
              <p className="text-[8px] uppercase tracking-widest">Powered By</p>
              <p className="text-[10px] font-bold">Pacak Khemah</p>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW: COMPONENT CONFIGURATOR
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
              <p className="text-[10px] text-slate-400 font-medium">Select items for your layout</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Selection Controls */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <span className="text-[10px] font-black text-slate-500 uppercase">{selectedIds.size} / {allGear.length} items</span>
          <div className="flex gap-2">
            <button onClick={selectAll} className="text-[10px] font-bold text-emerald-600 hover:underline uppercase">Select All</button>
            <span className="text-slate-300">|</span>
            <button onClick={selectNone} className="text-[10px] font-bold text-slate-400 hover:underline uppercase">Clear</button>
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
                          <p className="text-sm font-bold text-[#062c24] truncate">{item.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[11px] text-emerald-600 font-bold">RM {item.price}/night</p>
                            {isPkg && <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold">{item.linkedItems!.length} items</span>}
                          </div>
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

        {/* Action Footer */}
        <div className="p-5 border-t border-slate-100 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.02)] z-10">
          <button onClick={() => setShowPreview(true)} disabled={selectedIds.size === 0}
            className="w-full py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-[#062c24] text-white hover:bg-emerald-900">
            <i className="fas fa-eye text-sm"></i> Preview & Print Flyer ({selectedIds.size})
          </button>
        </div>

      </div>
    </div>
  );
}