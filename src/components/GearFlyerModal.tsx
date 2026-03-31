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

type Props = {
  vendorId: string;
  onClose: () => void;
};

function loadImageBase64(url: string, maxSize = 300): Promise<string> {
  return new Promise((resolve) => {
    if (!url) { resolve(""); return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => resolve("");
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
      const CW = W - M * 2; // content width

      // Colors
      const DARK = [6, 44, 36] as [number, number, number];
      const EMERALD = [16, 185, 129] as [number, number, number];
      const WHITE = [255, 255, 255] as [number, number, number];
      const GRAY = [148, 163, 184] as [number, number, number];
      const LIGHT = [248, 250, 249] as [number, number, number];
      const BORDER = [226, 232, 240] as [number, number, number];

      // Preload all images
      setProgress("Loading vendor logo...");
      const shopUrl = `https://pacakkhemah.com/shop/${vendor.slug || vendorId}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(shopUrl)}&bgcolor=FFFFFF&color=062c24`;

      const logoBase64 = await loadImageBase64(vendor.image || "", 150);
      const qrBase64 = await loadImageBase64(qrUrl, 300);

      setProgress(`Loading gear photos (0/${selectedItems.length})...`);
      const gearImages: string[] = [];
      for (let i = 0; i < selectedItems.length; i++) {
        setProgress(`Loading gear photos (${i + 1}/${selectedItems.length})...`);
        const img = await loadImageBase64(selectedItems[i].images?.[0] || selectedItems[i].img || "", 300);
        gearImages.push(img);
      }

      setProgress("Generating PDF...");

      // Layout constants
      const HEADER_H = 36;
      const SUBTITLE_H = 8;
      const FOOTER_H = 28;
      const COLS = 2;
      const COL_GAP = 6;
      const ROW_GAP = 5;
      const COL_W = (CW - COL_GAP) / COLS;
      const IMG_H = 38;
      const CARD_H = 56;
      const GRID_TOP = HEADER_H + SUBTITLE_H + 6;
      const GRID_BOTTOM = H - FOOTER_H - 4;
      const ROWS_PER_PAGE = Math.floor((GRID_BOTTOM - GRID_TOP + ROW_GAP) / (CARD_H + ROW_GAP));
      const ITEMS_PER_PAGE = ROWS_PER_PAGE * COLS;

      function drawHeader(pageIdx: number) {
        // Dark green header
        pdf.setFillColor(...DARK);
        pdf.rect(0, 0, W, HEADER_H, "F");

        // Logo
        let textX = M + 4;
        if (logoBase64) {
          pdf.setFillColor(...WHITE);
          pdf.roundedRect(M, 5, 26, 26, 3, 3, "F");
          try { pdf.addImage(logoBase64, "JPEG", M + 1.5, 6.5, 23, 23); } catch {}
          textX = M + 32;
        }

        // Vendor name
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(16);
        pdf.setTextColor(...WHITE);
        const nameText = vendor!.name.toUpperCase();
        pdf.text(nameText, textX, 14);

        // Tagline
        if (vendor!.tagline) {
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(7);
          pdf.setTextColor(180, 220, 200);
          const maxTagW = W - textX - M - 4;
          const tagText = vendor!.tagline.length > 70 ? vendor!.tagline.substring(0, 68) + "..." : vendor!.tagline;
          pdf.text(tagText, textX, 20, { maxWidth: maxTagW });
        }

        // Pickup & WhatsApp on one line
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(140, 190, 170);
        const pickup = vendor!.pickup?.join(", ") || vendor!.city || "";
        let infoLine = "";
        if (pickup) infoLine += `Pickup: ${pickup}`;
        if (vendor!.phone) infoLine += (infoLine ? "   |   " : "") + `WhatsApp: ${vendor!.phone}`;
        if (infoLine) pdf.text(infoLine, textX, 26);

        // Page number (if multi-page)
        if (selectedItems.length > ITEMS_PER_PAGE) {
          pdf.setFontSize(6);
          pdf.setTextColor(100, 160, 140);
          pdf.text(`Page ${pageIdx + 1}`, W - M - 4, 32, { align: "right" });
        }

        // Subtitle bar
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

        // QR code
        if (qrBase64) {
          pdf.setFillColor(...WHITE);
          pdf.roundedRect(M, fy + 3, 22, 22, 2, 2, "F");
          try { pdf.addImage(qrBase64, "PNG", M + 1, fy + 4, 20, 20); } catch {}
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

        // Branding
        pdf.setFontSize(5.5);
        pdf.setTextColor(70, 120, 100);
        pdf.text("Powered by PACAK KHEMAH  —  pacakkhemah.com", W / 2, fy + 26, { align: "center" });
      }

      function drawCard(item: GearItem, imgB64: string, x: number, y: number) {
        // Card background
        pdf.setFillColor(...WHITE);
        pdf.roundedRect(x, y, COL_W, CARD_H, 2.5, 2.5, "F");

        // Card border
        pdf.setDrawColor(...BORDER);
        pdf.setLineWidth(0.2);
        pdf.roundedRect(x, y, COL_W, CARD_H, 2.5, 2.5, "S");

        // Image area
        const imgPad = 3;
        const imgW = COL_W - imgPad * 2;
        if (imgB64) {
          try {
            // Clip image into rounded rect area
            pdf.addImage(imgB64, "JPEG", x + imgPad, y + imgPad, imgW, IMG_H - imgPad);
          } catch {}
        } else {
          pdf.setFillColor(...LIGHT);
          pdf.roundedRect(x + imgPad, y + imgPad, imgW, IMG_H - imgPad, 2, 2, "F");
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(7);
          pdf.setTextColor(200, 200, 200);
          pdf.text("No Image", x + COL_W / 2, y + IMG_H / 2 + 2, { align: "center" });
        }

        // Item name
        const nameY = y + IMG_H + 3;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.5);
        pdf.setTextColor(...DARK);
        const truncName = item.name.length > 28 ? item.name.substring(0, 26) + "..." : item.name;
        pdf.text(truncName, x + COL_W / 2, nameY, { align: "center" });

        // Category
        const cat = item.category || (item.type === "package" ? "Packages" : "Add-ons");
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(5.5);
        pdf.setTextColor(...GRAY);
        pdf.text(cat.toUpperCase(), x + COL_W / 2, nameY + 4, { align: "center" });

        // Price pill
        const priceText = `RM${item.price}/malam`;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7);
        const priceW = pdf.getTextWidth(priceText) + 8;
        const pillX = x + (COL_W - priceW) / 2;
        const pillY = nameY + 6;
        pdf.setFillColor(...EMERALD);
        pdf.roundedRect(pillX, pillY, priceW, 5.5, 2, 2, "F");
        pdf.setTextColor(...WHITE);
        pdf.text(priceText, x + COL_W / 2, pillY + 4, { align: "center" });
      }

      // ═══ RENDER PAGES ═══
      let idx = 0;
      let page = 0;

      while (idx < selectedItems.length) {
        if (page > 0) pdf.addPage();

        drawHeader(page);

        let row = 0;
        while (idx < selectedItems.length && row < ROWS_PER_PAGE) {
          const cy = GRID_TOP + row * (CARD_H + ROW_GAP);

          // Left column
          drawCard(selectedItems[idx], gearImages[idx], M, cy);
          idx++;

          // Right column
          if (idx < selectedItems.length) {
            drawCard(selectedItems[idx], gearImages[idx], M + COL_W + COL_GAP, cy);
            idx++;
          }

          row++;
        }

        drawFooter();
        page++;
      }

      const filename = `${vendor.name.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_")}_Gear_Catalogue.pdf`;
      pdf.save(filename);
      setProgress("");

    } catch (e) {
      console.error("PDF generation error:", e);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setGenerating(false);
      setProgress("");
    }
  }

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
          <span className="text-[10px] font-black text-slate-500 uppercase">
            {selectedIds.size} / {allGear.length} items selected
          </span>
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
                  {items.map(item => (
                    <label key={item.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        selectedIds.has(item.id)
                          ? "bg-emerald-50 border-emerald-200"
                          : "bg-white border-slate-100 hover:border-slate-200"
                      }`}>
                      <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleItem(item.id)}
                        className="w-4 h-4 accent-emerald-500 rounded shrink-0" />
                      <div className="w-10 h-10 bg-slate-100 rounded-lg overflow-hidden shrink-0">
                        {(item.images?.[0] || item.img) ? (
                          <img src={item.images?.[0] || item.img} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs">
                            <i className="fas fa-image"></i>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-[#062c24] truncate">{item.name}</p>
                        <p className="text-[10px] text-emerald-600 font-bold">RM {item.price}/night</p>
                      </div>
                    </label>
                  ))}
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
          {/* Progress indicator */}
          {generating && progress && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center gap-3">
              <i className="fas fa-spinner fa-spin text-blue-500"></i>
              <p className="text-[10px] font-bold text-blue-600">{progress}</p>
            </div>
          )}

          <div className="bg-white border border-slate-100 rounded-xl p-3 text-[10px] text-slate-400">
            <div className="flex items-start gap-2">
              <i className="fas fa-info-circle text-blue-400 mt-0.5 shrink-0"></i>
              <p>A4 PDF with vendor header, gear photos in 2-column grid, QR code to your shop, and Pacak Khemah branding. Auto multi-page for many items.</p>
            </div>
          </div>

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