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

// ═══ Helper: load image URL as base64 via canvas ═══
function loadImageBase64(url: string, maxSize = 200): Promise<string> {
  return new Promise((resolve) => {
    if (!url) { resolve(""); return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      // Scale down for PDF size
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.75));
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
        // Select all by default
        setSelectedIds(new Set(gear.map(g => g.id)));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, [vendorId]);

  function toggleItem(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() { setSelectedIds(new Set(allGear.map(g => g.id))); }
  function selectNone() { setSelectedIds(new Set()); }

  const selectedItems = allGear.filter(g => selectedIds.has(g.id));

  // Group by category
  const categories = Array.from(new Set(allGear.map(g => g.category || (g.type === "package" ? "Packages" : "Add-ons"))));

  async function generatePDF() {
    if (selectedItems.length === 0 || !vendor) return;
    setGenerating(true);

    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = 210;
      const pageH = 297;
      const margin = 12;
      const contentW = pageW - margin * 2;

      // Colors
      const darkGreen = [6, 44, 36] as [number, number, number];
      const emerald = [16, 185, 129] as [number, number, number];
      const white = [255, 255, 255] as [number, number, number];
      const slate = [100, 116, 139] as [number, number, number];
      const lightBg = [240, 242, 241] as [number, number, number];

      // Preload images
      const shopUrl = `https://pacakkhemah.com/shop/${vendor.slug || vendorId}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shopUrl)}`;

      const [logoBase64, qrBase64, ...gearImages] = await Promise.all([
        loadImageBase64(vendor.image || "", 120),
        loadImageBase64(qrUrl, 200),
        ...selectedItems.map(item => loadImageBase64(item.images?.[0] || item.img || "", 200)),
      ]);

      // ═══ DRAW FUNCTION FOR EACH PAGE ═══
      let currentY = 0;
      let itemIndex = 0;
      let pageNum = 0;
      const itemsPerPage = 6; // 3 rows × 2 columns

      function drawHeader() {
        // Dark green header band
        pdf.setFillColor(...darkGreen);
        pdf.rect(0, 0, pageW, 42, "F");

        // Vendor logo
        if (logoBase64) {
          // White circle background
          pdf.setFillColor(...white);
          pdf.circle(margin + 14, 21, 13, "F");
          try {
            pdf.addImage(logoBase64, "JPEG", margin + 3, 9, 22, 22);
          } catch { /* image failed */ }
        }

        // Vendor name
        const textX = logoBase64 ? margin + 32 : margin + 6;
        pdf.setTextColor(...white);
        pdf.setFontSize(18);
        pdf.setFont("helvetica", "bold");
        pdf.text(vendor!.name.toUpperCase(), textX, 18);

        // Tagline
        if (vendor!.tagline) {
          pdf.setFontSize(8);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(200, 230, 220);
          pdf.text(vendor!.tagline.substring(0, 60), textX, 25);
        }

        // Pickup info
        const pickup = vendor!.pickup?.join(", ") || vendor!.city || "";
        if (pickup) {
          pdf.setFontSize(7);
          pdf.setTextColor(150, 200, 180);
          pdf.text(`📍 Pickup: ${pickup}`, textX, 32);
        }

        // WhatsApp
        if (vendor!.phone) {
          pdf.setFontSize(7);
          pdf.text(`📱 WhatsApp: ${vendor!.phone}`, textX, 37);
        }

        // "SENARAI GEAR" subtitle bar
        pdf.setFillColor(...lightBg);
        pdf.rect(0, 42, pageW, 10, "F");
        pdf.setFontSize(7);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...darkGreen);
        pdf.text("SENARAI GEAR UNTUK DISEWA  •  GEAR RENTAL CATALOGUE", pageW / 2, 48.5, { align: "center" });

        return 55; // Y position after header
      }

      function drawFooter() {
        const footerY = pageH - 32;

        // Footer background
        pdf.setFillColor(...darkGreen);
        pdf.rect(0, footerY, pageW, 32, "F");

        // QR Code
        if (qrBase64) {
          // White background for QR
          pdf.setFillColor(...white);
          pdf.roundedRect(margin, footerY + 3, 26, 26, 2, 2, "F");
          try {
            pdf.addImage(qrBase64, "PNG", margin + 1.5, footerY + 4.5, 23, 23);
          } catch { /* QR failed */ }
        }

        // Scan text
        const qrTextX = margin + 30;
        pdf.setTextColor(...white);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.text("IMBAS UNTUK TEMPAH", qrTextX, footerY + 12);
        pdf.setFontSize(7);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(180, 210, 200);
        pdf.text("Scan to browse & book via WhatsApp", qrTextX, footerY + 17);
        pdf.setFontSize(6);
        pdf.text(shopUrl, qrTextX, footerY + 22);

        // Pacak Khemah branding
        pdf.setFontSize(6);
        pdf.setTextColor(100, 140, 130);
        pdf.text("Powered by PACAK KHEMAH — pacakkhemah.com", pageW / 2, footerY + 29, { align: "center" });
      }

      function drawGearItem(item: GearItem, imageBase64: string, x: number, y: number, w: number) {
        const itemH = 58;

        // Item card background
        pdf.setFillColor(...white);
        pdf.roundedRect(x, y, w, itemH, 3, 3, "F");

        // Border
        pdf.setDrawColor(230, 230, 230);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(x, y, w, itemH, 3, 3, "S");

        // Image
        const imgSize = 32;
        if (imageBase64) {
          try {
            pdf.addImage(imageBase64, "JPEG", x + (w - imgSize) / 2, y + 3, imgSize, imgSize);
          } catch { /* image failed */ }
        } else {
          // Placeholder
          pdf.setFillColor(...lightBg);
          pdf.roundedRect(x + (w - imgSize) / 2, y + 3, imgSize, imgSize, 2, 2, "F");
          pdf.setFontSize(12);
          pdf.setTextColor(200, 200, 200);
          pdf.text("🏕️", x + w / 2, y + 22, { align: "center" });
        }

        // Name
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...darkGreen);
        const name = item.name.length > 22 ? item.name.substring(0, 20) + "..." : item.name;
        pdf.text(name, x + w / 2, y + 40, { align: "center" });

        // Category
        if (item.category) {
          pdf.setFontSize(5.5);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(...slate);
          pdf.text(item.category.toUpperCase(), x + w / 2, y + 45, { align: "center" });
        }

        // Price badge
        pdf.setFillColor(...emerald);
        const priceText = `RM${item.price}/malam`;
        const priceW = pdf.getTextWidth(priceText) * 1.8 + 6;
        pdf.roundedRect(x + (w - priceW) / 2, y + 48, priceW, 7, 2, 2, "F");
        pdf.setFontSize(7);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...white);
        pdf.text(priceText, x + w / 2, y + 53, { align: "center" });

        return itemH;
      }

      // ═══ GENERATE PAGES ═══
      while (itemIndex < selectedItems.length) {
        if (pageNum > 0) pdf.addPage();

        currentY = drawHeader();
        const footerY = pageH - 35;
        const colW = (contentW - 6) / 2;
        const rowH = 62;
        let row = 0;

        while (itemIndex < selectedItems.length && currentY + rowH < footerY) {
          const col1Item = selectedItems[itemIndex];
          const col1Img = gearImages[itemIndex] || "";
          drawGearItem(col1Item, col1Img, margin, currentY, colW);
          itemIndex++;

          if (itemIndex < selectedItems.length) {
            const col2Item = selectedItems[itemIndex];
            const col2Img = gearImages[itemIndex] || "";
            drawGearItem(col2Item, col2Img, margin + colW + 6, currentY, colW);
            itemIndex++;
          }

          currentY += rowH;
          row++;
        }

        drawFooter();
        pageNum++;
      }

      // Download
      const filename = `${vendor.name.replace(/[^a-zA-Z0-9]/g, "_")}_Gear_Catalogue.pdf`;
      pdf.save(filename);

    } catch (e) {
      console.error("PDF generation error:", e);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setGenerating(false);
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
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleItem(item.id)}
                        className="w-4 h-4 accent-emerald-500 rounded shrink-0"
                      />
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
          <div className="bg-white border border-slate-100 rounded-xl p-3 text-[10px] text-slate-400">
            <div className="flex items-start gap-2">
              <i className="fas fa-info-circle text-blue-400 mt-0.5 shrink-0"></i>
              <p>PDF will include vendor header, gear photos & prices in a 2-column grid, QR code linking to your shop page, and Pacak Khemah branding. Multiple pages generated if needed.</p>
            </div>
          </div>

          <button
            onClick={generatePDF}
            disabled={selectedIds.size === 0 || generating}
            className="w-full py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-[#062c24] text-white hover:bg-emerald-900"
          >
            {generating ? (
              <><i className="fas fa-spinner fa-spin"></i> Generating PDF...</>
            ) : (
              <><i className="fas fa-file-pdf"></i> Generate Flyer ({selectedIds.size} items)</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}