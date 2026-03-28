"use client";

import { useState, useEffect, useCallback } from "react";

type Lang = "en" | "my";

type TourStep = {
  targetId: string;
  icon: string;
  en: { title: string; desc: string };
  my: { title: string; desc: string };
};

type HotspotData = {
  targetId: string;
  icon: string;
  en: { title: string; desc: string };
  my: { title: string; desc: string };
};

type Rect = { top: number; left: number; width: number; height: number };

const TOUR_STEPS: TourStep[] = [
  {
    targetId: "demo-hero",
    icon: "fa-user-circle",
    en: { title: "Vendor Profile & Branding", desc: "Your shop's identity — logo, name, verified badges, and rating. Customers see this first. You set it up once in Vendor Studio and it stays updated." },
    my: { title: "Profil & Branding Vendor", desc: "Identiti kedai anda — logo, nama, lencana pengesahan, dan rating. Pelanggan nampak ini dulu. Anda set sekali di Vendor Studio dan ia sentiasa dikemas kini." },
  },
  {
    targetId: "demo-services",
    icon: "fa-truck",
    en: { title: "Pickup, Delivery & Setup", desc: "Show customers your pickup locations, delivery zones, and setup services. You configure these options in your dashboard — they appear automatically here." },
    my: { title: "Pickup, Penghantaran & Setup", desc: "Tunjukkan lokasi pickup, zon penghantaran, dan perkhidmatan setup anda. Anda tetapkan ini di dashboard — ia muncul secara automatik di sini." },
  },
  {
    targetId: "demo-tabs",
    icon: "fa-layer-group",
    en: { title: "Shop Tabs", desc: "Three sections: Gear (your items for rent), Updates (announcements to customers), and Reviews (verified ratings from past renters). All managed from your dashboard." },
    my: { title: "Tab Kedai", desc: "Tiga bahagian: Gear (item untuk disewa), Updates (pengumuman), dan Reviews (rating pelanggan). Semua diuruskan dari dashboard anda." },
  },
  {
    targetId: "demo-about",
    icon: "fa-info-circle",
    en: { title: "About Us Section", desc: "Tell your story — describe your business, what makes you different, and why customers should rent from you. Supports bilingual content (EN/BM)." },
    my: { title: "Bahagian Tentang Kami", desc: "Ceritakan kisah anda — terangkan bisnes anda, apa yang membuatkan anda berbeza, dan kenapa pelanggan patut menyewa dari anda. Sokong dwibahasa (EN/BM)." },
  },
  {
    targetId: "demo-howto",
    icon: "fa-list-ol",
    en: { title: "How to Rent Guide", desc: "Custom step-by-step rental instructions for your customers. Set your own process — from booking to return. Each step can have bilingual titles and descriptions." },
    my: { title: "Panduan Cara Sewa", desc: "Arahan langkah demi langkah untuk pelanggan anda. Tetapkan proses anda sendiri — dari tempahan hingga pulangan. Setiap langkah boleh ada tajuk dan penerangan dwibahasa." },
  },
  {
    targetId: "demo-offer",
    icon: "fa-tags",
    en: { title: "Discount & Promotions", desc: "Auto-discount banners appear when you set nightly discounts (e.g. 10% off for 3+ nights). You can also create promo codes. All configured in your dashboard." },
    my: { title: "Diskaun & Promosi", desc: "Banner diskaun automatik muncul bila anda set diskaun malam (cth. 10% off untuk 3+ malam). Anda juga boleh cipta kod promo. Semua diset di dashboard." },
  },
  {
    targetId: "demo-dates",
    icon: "fa-calendar-alt",
    en: { title: "Date Picker", desc: "Customers pick rental dates here. Blocked dates from your availability calendar are hidden automatically. You manage availability per item from your dashboard." },
    my: { title: "Pilih Tarikh", desc: "Pelanggan pilih tarikh sewa di sini. Tarikh yang diblok dari kalendar anda disembunyikan secara automatik. Anda urus ketersediaan setiap item dari dashboard." },
  },
  {
    targetId: "demo-gear",
    icon: "fa-campground",
    en: { title: "Gear Catalogue", desc: "Your items organized by category with photos, pricing per night, and stock count. Customers add to cart and checkout via WhatsApp. You manage everything from Vendor Studio." },
    my: { title: "Katalog Gear", desc: "Item anda disusun mengikut kategori dengan gambar, harga semalam, dan stok. Pelanggan tambah ke troli dan checkout via WhatsApp. Anda urus semua dari Vendor Studio." },
  },
  {
    targetId: "demo-cart-btn",
    icon: "fa-shopping-cart",
    en: { title: "Cart & Booking Summary", desc: "After adding items, customers open the cart to see full pricing breakdown — subtotal, discounts, delivery fees, deposit, and total. They submit the order via WhatsApp." },
    my: { title: "Troli & Ringkasan Tempahan", desc: "Selepas tambah item, pelanggan buka troli untuk lihat pecahan harga penuh — subtotal, diskaun, kos penghantaran, deposit, dan jumlah. Mereka hantar tempahan via WhatsApp." },
  },
];

const HOTSPOTS: HotspotData[] = [
  { targetId: "demo-hero", icon: "fa-user-circle", en: { title: "Profile & Branding", desc: "Logo, name, badges, rating, social links — fully customizable." }, my: { title: "Profil & Branding", desc: "Logo, nama, lencana, rating, pautan sosial — semuanya boleh diubah suai." } },
  { targetId: "demo-services", icon: "fa-truck", en: { title: "Pickup, Delivery & Setup", desc: "Show your service options — pickup points, delivery zones, setup services." }, my: { title: "Pickup, Penghantaran & Setup", desc: "Tunjukkan pilihan perkhidmatan anda — lokasi pickup, zon penghantaran, setup." } },
  { targetId: "demo-tabs", icon: "fa-layer-group", en: { title: "Navigation Tabs", desc: "Gear, Updates & Reviews — customers explore your shop through these." }, my: { title: "Tab Navigasi", desc: "Gear, Updates & Reviews — pelanggan terokai kedai melalui tab ini." } },
  { targetId: "demo-about", icon: "fa-info-circle", en: { title: "About Section", desc: "Your story and business description. Supports bilingual content." }, my: { title: "Tentang Kami", desc: "Cerita dan penerangan bisnes anda. Sokong dwibahasa." } },
  { targetId: "demo-howto", icon: "fa-list-ol", en: { title: "Rental Steps", desc: "Custom step-by-step guide for your customers." }, my: { title: "Langkah Sewa", desc: "Panduan langkah demi langkah untuk pelanggan anda." } },
  { targetId: "demo-dates", icon: "fa-calendar-alt", en: { title: "Date Picker", desc: "Smart date selector linked to your availability calendar." }, my: { title: "Pilih Tarikh", desc: "Pemilih tarikh pintar yang dipautkan ke kalendar ketersediaan anda." } },
  { targetId: "demo-gear", icon: "fa-campground", en: { title: "Gear Catalogue", desc: "Items with photos, pricing & stock. Organized by category." }, my: { title: "Katalog Gear", desc: "Item dengan gambar, harga & stok. Disusun mengikut kategori." } },
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
    const ids = new Set([...TOUR_STEPS.map(s => s.targetId), ...HOTSPOTS.map(h => h.targetId)]);
    ids.forEach(id => {
      const r = getRect(id);
      if (r) newRects[id] = r;
    });
    setRects(newRects);
  }, []);

  useEffect(() => {
    updateRects();
    const onScroll = () => updateRects();
    const onResize = () => updateRects();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [updateRects, mode]);

  useEffect(() => {
    if (mode !== "tour") return;
    const step = TOUR_STEPS[tourStep];
    if (!step) return;
    const el = document.getElementById(step.targetId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(updateRects, 400);
    }
  }, [tourStep, mode, updateRects]);

  function startTour() { setMode("tour"); setTourStep(0); setShowMenu(false); setShowIntro(false); }
  function startHotspots() { setMode("hotspots"); setShowMenu(false); setShowIntro(false); }
  function endTour() { setMode("idle"); setTourStep(0); setActiveHotspot(null); }
  function nextStep() { tourStep < TOUR_STEPS.length - 1 ? setTourStep(tourStep + 1) : endTour(); }
  function prevStep() { if (tourStep > 0) setTourStep(tourStep - 1); }
  function toggleLang() { setLang(prev => prev === "en" ? "my" : "en"); }

  const t = (obj: { en: string; my: string }) => obj[lang];

  if (dismissed) return null;

  const currentStep = TOUR_STEPS[tourStep];
  const currentRect = currentStep ? rects[currentStep.targetId] : undefined;

  // Filter to only steps whose elements exist on page
  const availableSteps = TOUR_STEPS.filter(s => rects[s.targetId]);
  const currentStepIndex = availableSteps.findIndex(s => s.targetId === currentStep?.targetId);

  return (
    <>
      {/* ═══ LANGUAGE TOGGLE (always visible when guide active) ═══ */}
      {(mode !== "idle" || showIntro) && (
        <button
          onClick={toggleLang}
          className="fixed top-20 right-4 z-[95] bg-white shadow-xl border border-slate-200 rounded-full px-3 py-1.5 flex items-center gap-2 hover:shadow-2xl transition-all"
        >
          <i className="fas fa-globe text-indigo-500 text-xs"></i>
          <span className="text-[9px] font-black uppercase tracking-widest text-[#062c24]">{lang === "en" ? "EN" : "BM"}</span>
          <i className="fas fa-exchange-alt text-slate-300 text-[8px]"></i>
        </button>
      )}

      {/* ═══ INTRO PROMPT ═══ */}
      {showIntro && mode === "idle" && (
        <div className="fixed bottom-20 left-4 right-4 sm:left-6 sm:right-auto z-[90] max-w-xs" style={{ animation: "dsg-slideUp 0.3s ease-out" }}>
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl p-4 shadow-2xl relative">
            <button onClick={() => setShowIntro(false)} className="absolute top-2 right-2 w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-[10px] hover:bg-white/30">
              <i className="fas fa-times"></i>
            </button>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <i className="fas fa-magic text-lg"></i>
              </div>
              <div>
                <p className="text-xs font-black uppercase mb-1">
                  {t({ en: "Explore This Demo Shop!", my: "Terokai Demo Shop Ini!" })}
                </p>
                <p className="text-[10px] text-white/70 leading-relaxed mb-3">
                  {t({ en: "Tap the purple button to learn what each feature does and how it works for vendors.", my: "Tekan butang ungu untuk ketahui fungsi setiap bahagian dan cara ia berfungsi untuk vendor." })}
                </p>
                <div className="flex gap-2">
                  <button onClick={startTour} className="bg-white text-indigo-600 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase hover:bg-indigo-50 transition-all">
                    <i className="fas fa-play mr-1"></i>{t({ en: "Guided Tour", my: "Jelajah Berpandu" })}
                  </button>
                  <button onClick={startHotspots} className="bg-white/20 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase hover:bg-white/30 transition-all">
                    <i className="fas fa-dot-circle mr-1"></i>{t({ en: "Hotspots", my: "Titik Info" })}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ FLOATING ACTION BUTTON ═══ */}
      {mode === "idle" && (
        <div className="fixed bottom-6 left-6 z-[80]">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-14 h-14 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all relative"
          >
            <i className={`fas ${showMenu ? "fa-times" : "fa-question"} text-lg`}></i>
            {!showMenu && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center text-[7px] font-black text-amber-900 animate-pulse">!</span>
            )}
          </button>

          {showMenu && (
            <div className="absolute bottom-16 left-0 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 w-56" style={{ animation: "dsg-scaleIn 0.2s ease-out" }}>
              {/* Language toggle in menu */}
              <div className="flex items-center justify-between px-4 py-2 mb-1">
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                  {t({ en: "Language", my: "Bahasa" })}
                </span>
                <button onClick={toggleLang} className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg hover:bg-slate-200 transition-colors">
                  <span className="text-[9px] font-black text-[#062c24]">{lang === "en" ? "EN" : "BM"}</span>
                  <i className="fas fa-exchange-alt text-slate-400 text-[7px]"></i>
                </button>
              </div>

              <button onClick={startTour}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-indigo-50 transition-all text-left group">
                <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <i className="fas fa-play text-xs"></i>
                </div>
                <div>
                  <p className="text-[10px] font-black text-[#062c24] uppercase">{t({ en: "Guided Tour", my: "Jelajah Berpandu" })}</p>
                  <p className="text-[8px] text-slate-400 font-medium">{t({ en: "Step-by-step walkthrough", my: "Panduan langkah demi langkah" })}</p>
                </div>
              </button>
              <button onClick={startHotspots}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-purple-50 transition-all text-left group">
                <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <i className="fas fa-dot-circle text-xs"></i>
                </div>
                <div>
                  <p className="text-[10px] font-black text-[#062c24] uppercase">{t({ en: "Hotspots", my: "Titik Info" })}</p>
                  <p className="text-[8px] text-slate-400 font-medium">{t({ en: "Explore at your own pace", my: "Terokai mengikut rentak anda" })}</p>
                </div>
              </button>
              <div className="border-t border-slate-100 mt-1 pt-1">
                <button onClick={() => { setDismissed(true); setShowMenu(false); }}
                  className="w-full px-4 py-2 text-[9px] font-bold text-slate-400 hover:text-red-500 transition-colors text-center">
                  {t({ en: "Hide Guide", my: "Sembunyikan Panduan" })}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ HOTSPOT MODE ═══ */}
      {mode === "hotspots" && (
        <>
          <div className="fixed bottom-6 left-6 z-[80]">
            <button onClick={endTour}
              className="w-14 h-14 bg-red-500 text-white rounded-2xl shadow-2xl flex items-center justify-center hover:bg-red-600 active:scale-95 transition-all">
              <i className="fas fa-times text-lg"></i>
            </button>
          </div>

          {HOTSPOTS.map(h => {
            const rect = rects[h.targetId];
            if (!rect) return null;
            const dotTop = rect.top + 12;
            const dotLeft = rect.left + rect.width - 40;
            const isActive = activeHotspot === h.targetId;
            const content = h[lang];

            return (
              <div key={h.targetId} className="absolute z-[70]" style={{ top: dotTop, left: dotLeft }}>
                <button
                  onClick={() => setActiveHotspot(isActive ? null : h.targetId)}
                  className="relative w-8 h-8 flex items-center justify-center"
                >
                  <span className="absolute inset-0 bg-indigo-500/30 rounded-full animate-ping"></span>
                  <span className="relative w-6 h-6 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                    <i className={`fas ${h.icon} text-white text-[8px]`}></i>
                  </span>
                </button>

                {isActive && (
                  <div className="absolute top-10 right-0 w-60 bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 z-[75]" style={{ animation: "dsg-scaleIn 0.2s ease-out" }}>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                        <i className={`fas ${h.icon} text-sm`}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black text-[#062c24] uppercase">{content.title}</p>
                        <p className="text-[10px] text-slate-500 leading-relaxed mt-1">{content.desc}</p>
                      </div>
                    </div>
                    <button onClick={() => setActiveHotspot(null)} className="mt-3 w-full py-2 bg-slate-50 text-slate-400 rounded-xl text-[9px] font-bold uppercase hover:bg-slate-100 transition-colors">
                      {t({ en: "Close", my: "Tutup" })}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* ═══ GUIDED TOUR MODE ═══ */}
      {mode === "tour" && currentRect && currentStep && (
        <>
          <div className="fixed inset-0 z-[85]" onClick={endTour}>
            <svg className="w-full h-full" style={{ position: "absolute", top: 0, left: 0 }}>
              <defs>
                <mask id="tour-mask">
                  <rect width="100%" height="100%" fill="white" />
                  <rect
                    x={currentRect.left - window.scrollX - 8}
                    y={currentRect.top - window.scrollY - 8}
                    width={currentRect.width + 16}
                    height={currentRect.height + 16}
                    rx="16"
                    fill="black"
                  />
                </mask>
              </defs>
              <rect width="100%" height="100%" fill="rgba(6,44,36,0.85)" mask="url(#tour-mask)" />
            </svg>
          </div>

          <div
            className="fixed z-[86] border-2 border-indigo-400 rounded-2xl pointer-events-none transition-all duration-300"
            style={{
              top: currentRect.top - window.scrollY - 8,
              left: currentRect.left - window.scrollX - 8,
              width: currentRect.width + 16,
              height: currentRect.height + 16,
              boxShadow: "0 0 0 4px rgba(99,102,241,0.2), 0 0 40px rgba(99,102,241,0.15)",
            }}
          />

          <div
            className="fixed z-[87] left-4 right-4 sm:left-1/2 sm:right-auto sm:w-96"
            style={{
              ...(currentRect.top - window.scrollY > window.innerHeight / 2
                ? { top: Math.max(80, currentRect.top - window.scrollY - 230) }
                : { top: Math.min(window.innerHeight - 250, currentRect.top - window.scrollY + currentRect.height + 20) }
              ),
              ...(typeof window !== "undefined" && window.innerWidth >= 640 ? { transform: "translateX(-50%)" } : {}),
              animation: "dsg-slideUp 0.3s ease-out",
            }}
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden" onClick={e => e.stopPropagation()}>
              {/* Progress bar */}
              <div className="h-1 bg-slate-100">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300" style={{ width: `${((tourStep + 1) / TOUR_STEPS.length) * 100}%` }} />
              </div>

              <div className="p-5">
                {/* Header row */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">
                    {tourStep + 1} / {TOUR_STEPS.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={toggleLang} className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg hover:bg-slate-200 transition-colors">
                      <i className="fas fa-globe text-indigo-400 text-[8px]"></i>
                      <span className="text-[8px] font-black text-slate-500">{lang === "en" ? "EN" : "BM"}</span>
                    </button>
                    <button onClick={endTour} className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors">
                      <i className="fas fa-times text-[10px]"></i>
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                    <i className={`fas ${currentStep.icon}`}></i>
                  </div>
                  <div>
                    <p className="text-sm font-black text-[#062c24] uppercase leading-tight">{currentStep[lang].title}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mb-5">{currentStep[lang].desc}</p>

                {/* Navigation */}
                <div className="flex gap-2">
                  {tourStep > 0 && (
                    <button onClick={prevStep}
                      className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all">
                      <i className="fas fa-arrow-left mr-1"></i> {t({ en: "Back", my: "Sebelum" })}
                    </button>
                  )}
                  <button onClick={nextStep}
                    className="flex-[2] py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl text-[10px] font-black uppercase hover:from-indigo-600 hover:to-purple-600 transition-all shadow-lg">
                    {tourStep < TOUR_STEPS.length - 1 ? (
                      <>{t({ en: "Next", my: "Seterusnya" })} <i className="fas fa-arrow-right ml-1"></i></>
                    ) : (
                      <>{t({ en: "Finish", my: "Selesai" })} <i className="fas fa-check ml-1"></i></>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes dsg-slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes dsg-scaleIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
}