"use client";

import { useState, useEffect, useCallback } from "react";

type Lang = "en" | "my";
type Rect = { top: number; left: number; width: number; height: number };

type GuideItem = {
  targetId: string;
  icon: string;
  en: { title: string; desc: string };
  my: { title: string; desc: string };
};

const STEPS: GuideItem[] = [
  {
    targetId: "demo-hero",
    icon: "fa-user-circle",
    en: { title: "Vendor Profile & Branding", desc: "Your shop's identity — logo, name, verified badges, and star rating. Customers see this first. Set it up once in Vendor Studio." },
    my: { title: "Profil & Branding Vendor", desc: "Identiti kedai anda — logo, nama, lencana pengesahan, dan rating bintang. Pelanggan nampak ini dulu. Set sekali di Vendor Studio." },
  },
  {
    targetId: "demo-services",
    icon: "fa-truck",
    en: { title: "Pickup, Delivery & Setup", desc: "Display your pickup locations, delivery zones with pricing, and setup services. Configure in your dashboard — shown automatically here." },
    my: { title: "Pickup, Penghantaran & Setup", desc: "Paparkan lokasi pickup, zon penghantaran dengan harga, dan perkhidmatan setup. Tetapkan di dashboard — dipaparkan automatik di sini." },
  },
  {
    targetId: "demo-tabs",
    icon: "fa-layer-group",
    en: { title: "Shop Tabs", desc: "Three sections: Gear (items for rent), Updates (announcements), and Reviews (verified customer ratings). All managed from your dashboard." },
    my: { title: "Tab Kedai", desc: "Tiga bahagian: Gear (item sewa), Updates (pengumuman), dan Reviews (rating pelanggan). Semua diurus dari dashboard anda." },
  },
  {
    targetId: "demo-about",
    icon: "fa-info-circle",
    en: { title: "About Us Section", desc: "Tell your story — describe your business and why customers should rent from you. Supports bilingual content (EN/BM)." },
    my: { title: "Bahagian Tentang Kami", desc: "Ceritakan kisah anda — terangkan bisnes dan kenapa pelanggan patut sewa dari anda. Sokong dwibahasa (EN/BM)." },
  },
  {
    targetId: "demo-howto",
    icon: "fa-list-ol",
    en: { title: "How to Rent Guide", desc: "Custom step-by-step rental instructions for your customers. Set your own process — booking to return. Bilingual titles and descriptions." },
    my: { title: "Panduan Cara Sewa", desc: "Arahan langkah demi langkah untuk pelanggan. Tetapkan proses sendiri — dari tempahan hingga pulangan. Tajuk dan penerangan dwibahasa." },
  },
  {
    targetId: "demo-offer",
    icon: "fa-tags",
    en: { title: "Discounts & Promotions", desc: "Auto-discount banners for nightly deals (e.g. 10% off for 3+ nights). Create promo codes too. All configured in your dashboard." },
    my: { title: "Diskaun & Promosi", desc: "Banner diskaun automatik untuk tawaran malam (cth. 10% off 3+ malam). Cipta kod promo juga. Semua diset di dashboard." },
  },
  {
    targetId: "demo-dates",
    icon: "fa-calendar-alt",
    en: { title: "Date Picker", desc: "Customers select rental dates here. Blocked dates from your availability calendar are hidden automatically. Manage per item." },
    my: { title: "Pilih Tarikh", desc: "Pelanggan pilih tarikh sewa di sini. Tarikh yang diblok dari kalendar disembunyikan automatik. Urus setiap item." },
  },
  {
    targetId: "demo-gear",
    icon: "fa-campground",
    en: { title: "Gear Catalogue", desc: "Your items by category — photos, pricing per night, stock count. Customers add to cart and checkout via WhatsApp." },
    my: { title: "Katalog Gear", desc: "Item mengikut kategori — gambar, harga semalam, stok. Pelanggan tambah ke troli dan checkout via WhatsApp." },
  },
  {
    targetId: "demo-cart-btn",
    icon: "fa-shopping-cart",
    en: { title: "Cart & Booking Summary", desc: "Full pricing breakdown — subtotal, discounts, delivery, deposit, total. Customer submits order via WhatsApp with one tap." },
    my: { title: "Troli & Ringkasan Tempahan", desc: "Pecahan harga penuh — subtotal, diskaun, penghantaran, deposit, jumlah. Pelanggan hantar tempahan via WhatsApp dengan satu tap." },
  },
];

function getRect(id: string): Rect | null {
  const el = document.getElementById(id);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width, height: r.height };
}

export default function DemoShopGuide() {
  const [lang, setLang] = useState<Lang>("my");
  const [mode, setMode] = useState<"idle" | "hotspots" | "tour">("idle");
  const [tourStep, setTourStep] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [activeHotspot, setActiveHotspot] = useState<string | null>(null);
  const [rects, setRects] = useState<Record<string, Rect>>({});
  const [dismissed, setDismissed] = useState(false);
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowIntro(false), 10000);
    return () => clearTimeout(t);
  }, []);

  const updateRects = useCallback(() => {
    const newRects: Record<string, Rect> = {};
    const ids = new Set(STEPS.map(s => s.targetId));
    ids.forEach(id => {
      const r = getRect(id);
      if (r) newRects[id] = r;
    });
    setRects(newRects);
  }, []);

  useEffect(() => {
    updateRects();
    const fn = () => updateRects();
    window.addEventListener("scroll", fn, { passive: true });
    window.addEventListener("resize", fn);
    return () => { window.removeEventListener("scroll", fn); window.removeEventListener("resize", fn); };
  }, [updateRects, mode]);

  useEffect(() => {
    if (mode !== "tour") return;
    const step = STEPS[tourStep];
    if (!step) return;
    const el = document.getElementById(step.targetId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(updateRects, 400);
    }
  }, [tourStep, mode, updateRects]);

  function startTour() { setMode("tour"); setTourStep(0); setShowMenu(false); setShowIntro(false); }
  function startHotspots() { setMode("hotspots"); setShowMenu(false); setShowIntro(false); }
  function endGuide() { setMode("idle"); setTourStep(0); setActiveHotspot(null); }

  function nextStep() {
    // Skip steps whose elements don't exist on page
    let next = tourStep + 1;
    while (next < STEPS.length && !rects[STEPS[next].targetId]) next++;
    if (next >= STEPS.length) endGuide();
    else setTourStep(next);
  }

  function prevStep() {
    let prev = tourStep - 1;
    while (prev >= 0 && !rects[STEPS[prev].targetId]) prev--;
    if (prev >= 0) setTourStep(prev);
  }

  const tx = (en: string, my: string) => lang === "en" ? en : my;

  if (dismissed) return null;

  const currentStep = STEPS[tourStep];
  const currentRect = currentStep ? rects[currentStep.targetId] : undefined;

  // Count available steps (elements that exist)
  const availableCount = STEPS.filter(s => rects[s.targetId]).length;
  const currentNum = STEPS.slice(0, tourStep + 1).filter(s => rects[s.targetId]).length;

  // Hotspot items — only those with visible elements
  const visibleHotspots = STEPS.filter(s => rects[s.targetId]);

  return (
    <>
      {/* ═══════════════════════════════════════════ */}
      {/* INTRO — Bottom Sheet                       */}
      {/* ═══════════════════════════════════════════ */}
      {showIntro && mode === "idle" && (
        <div className="fixed inset-x-0 bottom-0 z-[90] p-4 pb-6" style={{ animation: "dsg-sheetUp 0.35s ease-out" }}>
          <div className="max-w-sm mx-auto bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-2xl p-5 shadow-2xl">
            {/* Pill handle */}
            <div className="w-8 h-1 bg-white/30 rounded-full mx-auto mb-4"></div>

            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-black uppercase">
                {tx("Explore This Demo!", "Terokai Demo Ini!")}
              </p>
              <button onClick={() => setShowIntro(false)} className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-xs hover:bg-white/30">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <p className="text-xs text-white/70 leading-relaxed mb-4">
              {tx(
                "See how your shop will look to customers. Tap below to explore each feature.",
                "Lihat bagaimana kedai anda akan kelihatan. Tekan di bawah untuk terokai setiap fungsi."
              )}
            </p>

            <div className="flex gap-2">
              <button onClick={startTour} className="flex-1 bg-white text-indigo-600 py-3 rounded-xl text-[10px] font-black uppercase tracking-wide hover:bg-indigo-50 transition-all">
                <i className="fas fa-play mr-1.5"></i>{tx("Guided Tour", "Jelajah Berpandu")}
              </button>
              <button onClick={startHotspots} className="flex-1 bg-white/20 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-wide hover:bg-white/30 transition-all">
                <i className="fas fa-dot-circle mr-1.5"></i>{tx("Hotspots", "Titik Info")}
              </button>
            </div>

            {/* Language toggle */}
            <button onClick={() => setLang(l => l === "en" ? "my" : "en")} className="mt-3 w-full flex items-center justify-center gap-2 py-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">
              <i className="fas fa-globe text-[10px]"></i>
              <span className="text-[9px] font-bold uppercase tracking-widest">{tx("Switch to BM", "Tukar ke EN")}</span>
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* FAB — Floating Action Button               */}
      {/* ═══════════════════════════════════════════ */}
      {mode === "idle" && !showIntro && (
        <div className="fixed bottom-6 left-4 z-[80]">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-12 h-12 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl shadow-xl flex items-center justify-center active:scale-95 transition-all relative"
          >
            <i className={`fas ${showMenu ? "fa-times" : "fa-question"} text-base`}></i>
            {!showMenu && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 rounded-full animate-pulse"></span>
            )}
          </button>
        </div>
      )}

      {/* ═══ FAB Menu — Bottom Sheet ═══ */}
      {showMenu && mode === "idle" && (
        <>
          <div className="fixed inset-0 bg-black/30 z-[78]" onClick={() => setShowMenu(false)} />
          <div className="fixed inset-x-0 bottom-0 z-[79] p-4 pb-6" style={{ animation: "dsg-sheetUp 0.25s ease-out" }}>
            <div className="max-w-sm mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden">
              <div className="w-8 h-1 bg-slate-200 rounded-full mx-auto mt-3"></div>

              {/* Language row */}
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{tx("Shop Guide", "Panduan Kedai")}</span>
                <button onClick={() => setLang(l => l === "en" ? "my" : "en")} className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg active:bg-slate-200 transition-colors">
                  <i className="fas fa-globe text-indigo-400 text-[9px]"></i>
                  <span className="text-[10px] font-black text-[#062c24]">{lang === "en" ? "EN" : "BM"}</span>
                </button>
              </div>

              <div className="px-3 pb-3 space-y-1">
                <button onClick={startTour}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl active:bg-indigo-50 transition-all text-left">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                    <i className="fas fa-play text-sm"></i>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-black text-[#062c24] uppercase">{tx("Guided Tour", "Jelajah Berpandu")}</p>
                    <p className="text-[10px] text-slate-400">{tx("Step-by-step walkthrough", "Panduan langkah demi langkah")}</p>
                  </div>
                  <i className="fas fa-chevron-right text-slate-200 text-xs"></i>
                </button>

                <button onClick={startHotspots}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl active:bg-purple-50 transition-all text-left">
                  <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center">
                    <i className="fas fa-dot-circle text-sm"></i>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-black text-[#062c24] uppercase">{tx("Hotspots", "Titik Info")}</p>
                    <p className="text-[10px] text-slate-400">{tx("Explore at your own pace", "Terokai mengikut rentak anda")}</p>
                  </div>
                  <i className="fas fa-chevron-right text-slate-200 text-xs"></i>
                </button>
              </div>

              <div className="border-t border-slate-100 px-5 py-3">
                <button onClick={() => { setDismissed(true); setShowMenu(false); }}
                  className="w-full text-center text-[10px] font-bold text-slate-400 active:text-red-500 py-1">
                  {tx("Hide Guide Permanently", "Sembunyikan Panduan")}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* HOTSPOT MODE                               */}
      {/* ═══════════════════════════════════════════ */}
      {mode === "hotspots" && (
        <>
          {/* Close FAB */}
          <div className="fixed bottom-6 left-4 z-[80]">
            <button onClick={endGuide}
              className="w-12 h-12 bg-slate-800 text-white rounded-xl shadow-xl flex items-center justify-center active:scale-95 transition-all">
              <i className="fas fa-times text-base"></i>
            </button>
          </div>

          {/* Pulsing dots on each section */}
          {visibleHotspots.map(h => {
            const rect = rects[h.targetId];
            if (!rect) return null;
            // Position dot at top-right of element, clamped to viewport
            const dotTop = rect.top + 8;
            const dotLeft = Math.min(rect.left + rect.width - 32, (typeof window !== "undefined" ? window.innerWidth : 400) - 44);

            return (
              <button
                key={h.targetId}
                onClick={() => setActiveHotspot(activeHotspot === h.targetId ? null : h.targetId)}
                className="absolute z-[70] w-7 h-7 flex items-center justify-center"
                style={{ top: dotTop, left: dotLeft }}
              >
                <span className="absolute inset-0 bg-indigo-500/25 rounded-full animate-ping"></span>
                <span className="relative w-5 h-5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center shadow-md border-2 border-white">
                  <i className={`fas ${h.icon} text-white text-[7px]`}></i>
                </span>
              </button>
            );
          })}

          {/* Hotspot Info — Bottom Sheet */}
          {activeHotspot && (() => {
            const item = STEPS.find(s => s.targetId === activeHotspot);
            if (!item) return null;
            const content = item[lang];
            return (
              <>
                <div className="fixed inset-0 z-[73]" onClick={() => setActiveHotspot(null)} />
                <div className="fixed inset-x-0 bottom-0 z-[74] p-4 pb-6" style={{ animation: "dsg-sheetUp 0.25s ease-out" }}>
                  <div className="max-w-sm mx-auto bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
                    <div className="w-8 h-1 bg-slate-200 rounded-full mx-auto mt-3"></div>
                    <div className="p-5">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                          <i className={`fas ${item.icon}`}></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-[#062c24] uppercase leading-tight">{content.title}</p>
                        </div>
                        <button onClick={() => setLang(l => l === "en" ? "my" : "en")} className="shrink-0 bg-slate-100 px-2 py-1 rounded-lg">
                          <span className="text-[9px] font-black text-slate-500">{lang === "en" ? "EN" : "BM"}</span>
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{content.desc}</p>
                    </div>
                    <button onClick={() => setActiveHotspot(null)} className="w-full py-3.5 border-t border-slate-100 text-[10px] font-black text-slate-400 uppercase active:bg-slate-50">
                      {tx("Close", "Tutup")}
                    </button>
                  </div>
                </div>
              </>
            );
          })()}
        </>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* GUIDED TOUR MODE                           */}
      {/* ═══════════════════════════════════════════ */}
      {mode === "tour" && currentRect && currentStep && (
        <>
          {/* Dark overlay with spotlight */}
          <div className="fixed inset-0 z-[85]" onClick={endGuide}>
            <svg className="w-full h-full" style={{ position: "absolute", top: 0, left: 0 }}>
              <defs>
                <mask id="dsg-mask">
                  <rect width="100%" height="100%" fill="white" />
                  <rect
                    x={currentRect.left - window.scrollX - 6}
                    y={currentRect.top - window.scrollY - 6}
                    width={currentRect.width + 12}
                    height={currentRect.height + 12}
                    rx="14"
                    fill="black"
                  />
                </mask>
              </defs>
              <rect width="100%" height="100%" fill="rgba(6,44,36,0.8)" mask="url(#dsg-mask)" />
            </svg>
          </div>

          {/* Spotlight border glow */}
          <div
            className="fixed z-[86] border-2 border-indigo-400/60 rounded-2xl pointer-events-none transition-all duration-300"
            style={{
              top: currentRect.top - window.scrollY - 6,
              left: currentRect.left - window.scrollX - 6,
              width: currentRect.width + 12,
              height: currentRect.height + 12,
              boxShadow: "0 0 0 3px rgba(99,102,241,0.15)",
            }}
          />

          {/* Tour Card — Fixed Bottom Sheet */}
          <div className="fixed inset-x-0 bottom-0 z-[87] p-4 pb-6" style={{ animation: "dsg-sheetUp 0.3s ease-out" }} onClick={e => e.stopPropagation()}>
            <div className="max-w-sm mx-auto bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
              {/* Progress bar */}
              <div className="h-1 bg-slate-100">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300" style={{ width: `${(currentNum / availableCount) * 100}%` }} />
              </div>

              <div className="p-5">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">
                    {currentNum} / {availableCount}
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setLang(l => l === "en" ? "my" : "en")} className="flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-lg active:bg-slate-200">
                      <i className="fas fa-globe text-indigo-400 text-[8px]"></i>
                      <span className="text-[9px] font-black text-slate-500">{lang === "en" ? "EN" : "BM"}</span>
                    </button>
                    <button onClick={endGuide} className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 active:text-red-500">
                      <i className="fas fa-times text-[10px]"></i>
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                    <i className={`fas ${currentStep.icon}`}></i>
                  </div>
                  <p className="text-sm font-black text-[#062c24] uppercase leading-tight pt-1">{currentStep[lang].title}</p>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mb-5">{currentStep[lang].desc}</p>

                {/* Navigation */}
                <div className="flex gap-2">
                  {tourStep > 0 && (
                    <button onClick={prevStep}
                      className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase active:bg-slate-200 transition-all">
                      <i className="fas fa-arrow-left mr-1"></i> {tx("Back", "Kembali")}
                    </button>
                  )}
                  <button onClick={nextStep}
                    className="flex-[2] py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl text-[10px] font-black uppercase active:from-indigo-600 active:to-purple-600 transition-all shadow-lg">
                    {tourStep < STEPS.length - 1 ? (
                      <>{tx("Next", "Seterusnya")} <i className="fas fa-arrow-right ml-1"></i></>
                    ) : (
                      <>{tx("Finish", "Selesai")} <i className="fas fa-check ml-1"></i></>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══ Animations ═══ */}
      <style>{`
        @keyframes dsg-sheetUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes dsg-scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
}