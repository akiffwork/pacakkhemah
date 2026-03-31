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
type ImgData = { b64: string; ratio: number };

function loadImage(url: string, maxSize = 300): Promise<ImgData> {
  return new Promise((resolve) => {
    if (!url) { resolve({ b64: "", ratio: 1 }); return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve({ b64: canvas.toDataURL("image/jpeg", 0.8), ratio: img.width / img.height });
    };
    img.onerror = () => resolve({ b64: "", ratio: 1 });
    img.src = url;
  });
}

export default function GearFlyerModal({ vendorId, onClose }: Props) {
  const [vendor, setVendor] = useState<VendorInfo | null>(null);
  const [allGear, setAllGear] = useState<GearItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState("");

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

  async function generatePDF() {
    if (selectedItems.length === 0 || !vendor) return;
    setGenerating(true);
    setProgress("Loading images...");

    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const W = 210, H = 297, M = 10;
      const CW = W - M * 2;

      // Colors
      const DARK: [number, number, number] = [6, 44, 36];
      const EMERALD: [number, number, number] = [16, 185, 129];
      const WHITE: [number, number, number] = [255, 255, 255];
      const GRAY: [number, number, number] = [148, 163, 184];
      const LIGHT: [number, number, number] = [245, 247, 246];
      const BORDER: [number, number, number] = [226, 232, 240];

      const shopUrl = `https://pacakkhemah.com/shop/${vendor.slug || vendorId}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(shopUrl)}&bgcolor=FFFFFF&color=062c24`;

      setProgress("Loading vendor logo...");
      const logoData = await loadImage(vendor.image || "", 150);
      const qrData = await loadImage(qrUrl, 300);

      setProgress(`Loading gear photos (0/${selectedItems.length})...`);
      const gearImgs: ImgData[] = [];
      for (let i = 0; i < selectedItems.length; i++) {
        setProgress(`Loading gear photos (${i + 1}/${selectedItems.length})...`);
        gearImgs.push(await loadImage(selectedItems[i].images?.[0] || selectedItems[i].img || "", 300));
      }

      // Build gear lookup + load linked thumbnails for packages
      const gearById = new Map<string, GearItem>();
      allGear.forEach(g => gearById.set(g.id, g));

      setProgress("Loading package thumbnails...");
      const linkedImgMap = new Map<string, ImgData>();
      const linkedIds = new Set<string>();
      selectedItems.forEach(item => {
        if (item.type === "package" && item.linkedItems?.length) {
          item.linkedItems.forEach(li => linkedIds.add(li.itemId));
        }
      });
      for (const lid of linkedIds) {
        const g = gearById.get(lid);
        if (g) linkedImgMap.set(lid, await loadImage(g.images?.[0] || g.img || "", 100));
      }

      setProgress("Generating PDF...");

      // ═══ LAYOUT — 3 columns matching shop UI ═══
      const HEADER_H = 30;
      const SUBTITLE_H = 8;
      const FOOTER_H = 28;
      const COLS = 3;
      const COL_GAP = 4;
      const ROW_GAP = 4;
      const COL_W = (CW - COL_GAP * (COLS - 1)) / COLS;
      const IMG_H = 36; // Square-ish image area
      const INFO_H = 22; // Name + price + button
      const PKG_EXTRA = 10; // Extra height for package thumbnails
      const CARD_H = IMG_H + INFO_H;
      const CARD_PKG_H = CARD_H + PKG_EXTRA;
      const GRID_TOP = HEADER_H + SUBTITLE_H + 4;
      const GRID_BOTTOM = H - FOOTER_H - 3;

      // ═══ Build rows of 3 ═══
      type RowData = { items: { item: GearItem; img: ImgData; }[]; height: number };
      const rows: RowData[] = [];
      for (let i = 0; i < selectedItems.length; i += COLS) {
        const chunk: { item: GearItem; img: ImgData }[] = [];
        let maxH = CARD_H;
        for (let c = 0; c < COLS && i + c < selectedItems.length; c++) {
          const item = selectedItems[i + c];
          chunk.push({ item, img: gearImgs[i + c] });
          if (item.type === "package" && item.linkedItems?.length) maxH = CARD_PKG_H;
        }
        rows.push({ items: chunk, height: maxH });
      }

      // Paginate rows
      const pages: RowData[][] = [];
      let currentPage: RowData[] = [];
      let cy = GRID_TOP;
      for (const row of rows) {
        if (cy + row.height > GRID_BOTTOM && currentPage.length > 0) {
          pages.push(currentPage);
          currentPage = [];
          cy = GRID_TOP;
        }
        currentPage.push(row);
        cy += row.height + ROW_GAP;
      }
      if (currentPage.length > 0) pages.push(currentPage);
      const totalPages = pages.length;

      // ═══ DRAW FUNCTIONS ═══

      function drawHeader(pageIdx: number) {
        pdf.setFillColor(...DARK);
        pdf.rect(0, 0, W, HEADER_H, "F");

        let textX = M + 4;
        if (logoData.b64) {
          pdf.setFillColor(...WHITE);
          pdf.roundedRect(M, 4, 22, 22, 3, 3, "F");
          try { pdf.addImage(logoData.b64, "JPEG", M + 1.5, 5.5, 19, 19); } catch {}
          textX = M + 28;
        }

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(16);
        pdf.setTextColor(...WHITE);
        pdf.text(vendor!.name.toUpperCase(), textX, 14);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(150, 200, 180);
        const pickup = vendor!.pickup?.join(", ") || vendor!.city || "";
        let info = "";
        if (pickup) info += `Pickup: ${pickup}`;
        if (vendor!.phone) info += (info ? "   |   " : "") + `WhatsApp: ${vendor!.phone}`;
        if (info) pdf.text(info, textX, 20);

        if (totalPages > 1) {
          pdf.setFontSize(6);
          pdf.setTextColor(100, 160, 140);
          pdf.text(`${pageIdx + 1} / ${totalPages}`, W - M - 2, 26, { align: "right" });
        }

        pdf.setFillColor(...LIGHT);
        pdf.rect(0, HEADER_H, W, SUBTITLE_H, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(6.5);
        pdf.setTextColor(...DARK);
        pdf.text("SENARAI GEAR UNTUK DISEWA  /  GEAR RENTAL CATALOGUE", W / 2, HEADER_H + 5.5, { align: "center" });
      }

      function drawFooter() {
        const fy = H - FOOTER_H;
        pdf.setFillColor(...DARK);
        pdf.rect(0, fy, W, FOOTER_H, "F");

        if (qrData.b64) {
          pdf.setFillColor(...WHITE);
          pdf.roundedRect(M, fy + 3, 22, 22, 2, 2, "F");
          try { pdf.addImage(qrData.b64, "PNG", M + 1, fy + 4, 20, 20); } catch {}
        }

        const tx = M + 27;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.setTextColor(...WHITE);
        pdf.text("IMBAS UNTUK TEMPAH", tx, fy + 10);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(150, 200, 180);
        pdf.text("Scan to browse & book via WhatsApp", tx, fy + 15);
        pdf.setFontSize(6);
        pdf.setTextColor(100, 160, 140);
        pdf.text(shopUrl, tx, fy + 20);
        pdf.setFontSize(5.5);
        pdf.setTextColor(70, 120, 100);
        pdf.text("Powered by PACAK KHEMAH  —  pacakkhemah.com", W / 2, fy + 26, { align: "center" });
      }

      function drawCard(item: GearItem, imgData: ImgData, x: number, y: number, cardH: number) {
        const isPackage = item.type === "package" && item.linkedItems && item.linkedItems.length > 0;
        const r = 2.5;

        // Card background
        pdf.setFillColor(...WHITE);
        pdf.roundedRect(x, y, COL_W, cardH, r, r, "F");
        pdf.setDrawColor(...BORDER);
        pdf.setLineWidth(0.2);
        pdf.roundedRect(x, y, COL_W, cardH, r, r, "S");

        // ── Image area: edge-to-edge, cover-fit ──
        if (imgData.b64) {
          // Fill the entire image box (cover style)
          const ratio = imgData.ratio;
          let drawW = COL_W;
          let drawH = COL_W / ratio;
          if (drawH < IMG_H) {
            drawH = IMG_H;
            drawW = IMG_H * ratio;
          }
          const dx = x + (COL_W - drawW) / 2;
          const dy = y + (IMG_H - drawH) / 2;

          // Clip to card top area using white overlay trick
          try { pdf.addImage(imgData.b64, "JPEG", dx, dy, drawW, drawH); } catch {}

          // Mask overflow: draw white rects on the sides and below
          pdf.setFillColor(...WHITE);
          // Left overflow
          if (dx < x) pdf.rect(x - 1, y, x - dx + 1, IMG_H, "F");
          // Right overflow
          const rightEdge = dx + drawW;
          if (rightEdge > x + COL_W) pdf.rect(x + COL_W, y, rightEdge - (x + COL_W) + 1, IMG_H, "F");
          // Below image area
          pdf.rect(x, y + IMG_H, COL_W, cardH - IMG_H, "F");

          // Redraw bottom corners border
          pdf.setDrawColor(...BORDER);
          pdf.setLineWidth(0.2);
          // Only redraw the card border to cover the mask
          pdf.roundedRect(x, y, COL_W, cardH, r, r, "S");
        } else {
          pdf.setFillColor(...LIGHT);
          pdf.rect(x + 0.5, y + 0.5, COL_W - 1, IMG_H - 1, "F");
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(6);
          pdf.setTextColor(200, 200, 200);
          pdf.text("No Image", x + COL_W / 2, y + IMG_H / 2 + 1, { align: "center" });
        }

        // ── Name: bold uppercase ──
        const nameY = y + IMG_H + 5;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(6.5);
        pdf.setTextColor(...DARK);
        const truncName = item.name.length > 22 ? item.name.substring(0, 20) + "..." : item.name;
        pdf.text(truncName.toUpperCase(), x + COL_W / 2, nameY, { align: "center" });

        // ── Price: emerald ──
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(6);
        pdf.setTextColor(...EMERALD);
        pdf.text(`RM ${item.price}/night`, x + COL_W / 2, nameY + 4.5, { align: "center" });

        // ── "SHOP NOW" button ──
        const btnW = COL_W - 8;
        const btnH = 5.5;
        const btnX = x + 4;
        const btnY = nameY + 7;
        pdf.setFillColor(...DARK);
        pdf.roundedRect(btnX, btnY, btnW, btnH, 2, 2, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(5.5);
        pdf.setTextColor(...WHITE);
        pdf.text("SHOP NOW", x + COL_W / 2, btnY + 3.8, { align: "center" });

        // ── Package linked thumbnails ──
        if (isPackage && item.linkedItems) {
          const thumbY = btnY + btnH + 2;
          const thumbSize = 7;
          const thumbGap = 1.5;
          const maxThumbs = Math.min(item.linkedItems.length, 5);
          const totalThumbW = maxThumbs * thumbSize + (maxThumbs - 1) * thumbGap;
          let tx = x + (COL_W - totalThumbW) / 2;

          for (let t = 0; t < maxThumbs; t++) {
            const li = item.linkedItems[t];
            const liImg = linkedImgMap.get(li.itemId);

            pdf.setFillColor(...LIGHT);
            pdf.roundedRect(tx, thumbY, thumbSize, thumbSize, 1, 1, "F");
            pdf.setDrawColor(...BORDER);
            pdf.setLineWidth(0.15);
            pdf.roundedRect(tx, thumbY, thumbSize, thumbSize, 1, 1, "S");

            if (liImg?.b64) {
              try { pdf.addImage(liImg.b64, "JPEG", tx + 0.3, thumbY + 0.3, thumbSize - 0.6, thumbSize - 0.6); } catch {}
            }
            tx += thumbSize + thumbGap;
          }

          if (item.linkedItems.length > maxThumbs) {
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(4.5);
            pdf.setTextColor(...GRAY);
            pdf.text(`+${item.linkedItems.length - maxThumbs}`, tx + 1, thumbY + thumbSize / 2 + 1);
          }
        }
      }

      // ═══ RENDER PAGES ═══
      for (let p = 0; p < totalPages; p++) {
        if (p > 0) pdf.addPage();
        drawHeader(p);

        let rowY = GRID_TOP;
        for (const row of pages[p]) {
          for (let c = 0; c < row.items.length; c++) {
            const colX = M + c * (COL_W + COL_GAP);
            drawCard(row.items[c].item, row.items[c].img, colX, rowY, row.height);
          }
          rowY += row.height + ROW_GAP;
        }

        drawFooter();
      }

      const filename = `${vendor.name.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_")}_Gear_Catalogue.pdf`;
      pdf.save(filename);

    } catch (e) {
      console.error("PDF generation error:", e);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setGenerating(false);
      setProgress("");
    }
  }

  // ═══ UI ═══

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

  return (
    <div className="fixed inset-0 bg-[#062c24]/90 backdrop-blur-sm z-[500] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center">
                <i className="fas fa-file-pdf text-lg"></i>
              </div>
              <div>
                <h3 className="text-sm font-black text-[#062c24] uppercase">Gear Flyer</h3>
                <p className="text-[10px] text-slate-400">Select items for your A4 promotional flyer</p>
              </div>
            </div>
            <button onClick={onClose} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors">
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        {/* Selection controls */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <span className="text-[10px] font-black text-slate-500 uppercase">{selectedIds.size} / {allGear.length} items</span>
          <div className="flex gap-2">
            <button onClick={selectAll} className="text-[9px] font-bold text-emerald-600 hover:underline uppercase">Select All</button>
            <span className="text-slate-200">|</span>
            <button onClick={selectNone} className="text-[9px] font-bold text-slate-400 hover:underline uppercase">Clear</button>
          </div>
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4" style={{ scrollbarWidth: "none" }}>
          {categories.map(cat => {
            const items = allGear.filter(g => (g.category || (g.type === "package" ? "Packages" : "Add-ons")) === cat);
            if (!items.length) return null;
            return (
              <div key={cat}>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">{cat}</p>
                <div className="space-y-1.5">
                  {items.map(item => {
                    const isPackage = item.type === "package" && item.linkedItems && item.linkedItems.length > 0;
                    return (
                      <label key={item.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          selectedIds.has(item.id) ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-100 hover:border-slate-200"
                        }`}>
                        <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleItem(item.id)}
                          className="w-4 h-4 accent-emerald-500 rounded shrink-0" />
                        <div className="w-10 h-10 bg-slate-100 rounded-lg overflow-hidden shrink-0">
                          {(item.images?.[0] || item.img) ? (
                            <img src={item.images?.[0] || item.img} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs"><i className="fas fa-image"></i></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-[#062c24] truncate">{item.name}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] text-emerald-600 font-bold">RM {item.price}/night</p>
                            {isPackage && (
                              <span className="text-[8px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded font-bold">{item.linkedItems!.length} items</span>
                            )}
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
            <div className="text-center py-8">
              <i className="fas fa-box-open text-slate-200 text-3xl mb-3"></i>
              <p className="text-xs text-slate-400 font-bold">No gear items found</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 bg-slate-50 space-y-3">
          {generating && progress && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center gap-3">
              <i className="fas fa-spinner fa-spin text-blue-500"></i>
              <p className="text-[10px] font-bold text-blue-600">{progress}</p>
            </div>
          )}
          <button onClick={generatePDF} disabled={selectedIds.size === 0 || generating}
            className="w-full py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-[#062c24] text-white hover:bg-emerald-900">
            {generating ? (
              <><i className="fas fa-spinner fa-spin"></i> Generating...</>
            ) : (
              <><i className="fas fa-file-pdf"></i> Generate Flyer ({selectedIds.size} items)</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}