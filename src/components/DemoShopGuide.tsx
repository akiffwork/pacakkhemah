"use client";

import { useState, useEffect, useCallback } from "react";

type TourStep = {
  targetId: string;
  title: string;
  titleMy: string;
  desc: string;
  icon: string;
  position?: "top" | "bottom";
};

const TOUR_STEPS: TourStep[] = [
  {
    targetId: "demo-hero",
    title: "Vendor Profile",
    titleMy: "Profil Vendor",
    desc: "Your shop's identity — logo, name, badges, social links, and service tags. Customers see this first. You customize all of it from Vendor Studio.",
    icon: "fa-user-circle",
  },
  {
    targetId: "demo-tabs",
    title: "Shop Tabs",
    titleMy: "Tab Kedai",
    desc: "Three sections: Gear (your items), Updates (announcements to customers), and Reviews (verified customer ratings). All managed from your dashboard.",
    icon: "fa-layer-group",
  },
  {
    targetId: "demo-dates",
    title: "Date Picker",
    titleMy: "Pilih Tarikh",
    desc: "Customers pick their rental dates here. Blocked dates from your calendar won't appear. You control availability per item from your dashboard.",
    icon: "fa-calendar-alt",
  },
  {
    targetId: "demo-gear",
    title: "Gear Listing",
    titleMy: "Senarai Gear",
    desc: "Your items organized by category with photos, pricing, and stock. Customers add to cart and checkout via WhatsApp. You manage everything from Vendor Studio.",
    icon: "fa-campground",
  },
];

type HotspotData = {
  targetId: string;
  title: string;
  desc: string;
  icon: string;
};

const HOTSPOTS: HotspotData[] = [
  { targetId: "demo-hero", title: "Profil & Branding", desc: "Your logo, name, badges, social links — fully customizable from Vendor Studio.", icon: "fa-user-circle" },
  { targetId: "demo-tabs", title: "Tab Navigasi", desc: "Gear, Updates & Reviews — customers explore your shop through these tabs.", icon: "fa-layer-group" },
  { targetId: "demo-dates", title: "Tarikh Sewa", desc: "Smart date picker that respects your availability calendar. Blocked dates auto-hidden.", icon: "fa-calendar-alt" },
  { targetId: "demo-gear", title: "Katalog Gear", desc: "Your items with photos, pricing & stock. Organized by category. Add-to-cart in one tap.", icon: "fa-campground" },
];

type Rect = { top: number; left: number; width: number; height: number };

function getRect(id: string): Rect | null {
  const el = document.getElementById(id);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width, height: r.height };
}

export default function DemoShopGuide() {
  const [mode, setMode] = useState<"idle" | "hotspots" | "tour">("idle");
  const [tourStep, setTourStep] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [activeHotspot, setActiveHotspot] = useState<string | null>(null);
  const [rects, setRects] = useState<Record<string, Rect>>({});
  const [dismissed, setDismissed] = useState(false);
  const [showIntro, setShowIntro] = useState(true);

  // Auto-dismiss intro after 8s
  useEffect(() => {
    const t = setTimeout(() => setShowIntro(false), 8000);
    return () => clearTimeout(t);
  }, []);

  // Calculate element positions
  const updateRects = useCallback(() => {
    const newRects: Record<string, Rect> = {};
    [...TOUR_STEPS, ...HOTSPOTS].forEach(s => {
      const r = getRect(s.targetId);
      if (r) newRects[s.targetId] = r;
    });
    setRects(newRects);
  }, []);

  useEffect(() => {
    updateRects();
    const handler = () => updateRects();
    window.addEventListener("scroll", handler, { passive: true });
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler);
      window.removeEventListener("resize", handler);
    };
  }, [updateRects, mode]);

  // Tour: scroll to current step
  useEffect(() => {
    if (mode !== "tour") return;
    const step = TOUR_STEPS[tourStep];
    const el = document.getElementById(step.targetId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(updateRects, 400);
    }
  }, [tourStep, mode, updateRects]);

  function startTour() {
    setMode("tour");
    setTourStep(0);
    setShowMenu(false);
    setShowIntro(false);
  }

  function startHotspots() {
    setMode("hotspots");
    setShowMenu(false);
    setShowIntro(false);
  }

  function endTour() {
    setMode("idle");
    setTourStep(0);
    setActiveHotspot(null);
  }

  function nextStep() {
    if (tourStep < TOUR_STEPS.length - 1) setTourStep(tourStep + 1);
    else endTour();
  }

  function prevStep() {
    if (tourStep > 0) setTourStep(tourStep - 1);
  }

  if (dismissed) return null;

  const currentStep = TOUR_STEPS[tourStep];
  const currentRect = rects[currentStep?.targetId];

  return (
    <>
      {/* ═══ INTRO PROMPT (shows on first load) ═══ */}
      {showIntro && mode === "idle" && (
        <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-auto sm:bottom-24 sm:left-6 z-[90] max-w-xs animate-slideUp">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl p-4 shadow-2xl relative">
            <button onClick={() => setShowIntro(false)} className="absolute top-2 right-2 w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-[10px] hover:bg-white/30">
              <i className="fas fa-times"></i>
            </button>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <i className="fas fa-magic text-lg"></i>
              </div>
              <div>
                <p className="text-xs font-black uppercase mb-1">Explore This Demo Shop!</p>
                <p className="text-[10px] text-white/70 leading-relaxed mb-3">Tap the purple button below to learn what each feature does and how it works for vendors.</p>
                <div className="flex gap-2">
                  <button onClick={startTour} className="bg-white text-indigo-600 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase hover:bg-indigo-50 transition-all">
                    <i className="fas fa-play mr-1"></i>Guided Tour
                  </button>
                  <button onClick={startHotspots} className="bg-white/20 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase hover:bg-white/30 transition-all">
                    <i className="fas fa-dot-circle mr-1"></i>Hotspots
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

          {/* Menu popup */}
          {showMenu && (
            <div className="absolute bottom-16 left-0 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 w-52 animate-scaleIn">
              <button onClick={startTour}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-indigo-50 transition-all text-left group">
                <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <i className="fas fa-play text-xs"></i>
                </div>
                <div>
                  <p className="text-[10px] font-black text-[#062c24] uppercase">Guided Tour</p>
                  <p className="text-[8px] text-slate-400 font-medium">Step-by-step walkthrough</p>
                </div>
              </button>
              <button onClick={startHotspots}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-purple-50 transition-all text-left group">
                <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <i className="fas fa-dot-circle text-xs"></i>
                </div>
                <div>
                  <p className="text-[10px] font-black text-[#062c24] uppercase">Hotspots</p>
                  <p className="text-[8px] text-slate-400 font-medium">Explore at your own pace</p>
                </div>
              </button>
              <div className="border-t border-slate-100 mt-1 pt-1">
                <button onClick={() => { setDismissed(true); setShowMenu(false); }}
                  className="w-full px-4 py-2 text-[9px] font-bold text-slate-400 hover:text-red-500 transition-colors text-center">
                  Hide Guide
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ HOTSPOT MODE ═══ */}
      {mode === "hotspots" && (
        <>
          {/* Close button */}
          <div className="fixed bottom-6 left-6 z-[80]">
            <button onClick={endTour}
              className="w-14 h-14 bg-red-500 text-white rounded-2xl shadow-2xl flex items-center justify-center hover:bg-red-600 active:scale-95 transition-all">
              <i className="fas fa-times text-lg"></i>
            </button>
          </div>

          {/* Hotspot dots */}
          {HOTSPOTS.map(h => {
            const rect = rects[h.targetId];
            if (!rect) return null;
            const top = rect.top + 12;
            const left = rect.left + rect.width - 40;
            const isActive = activeHotspot === h.targetId;

            return (
              <div key={h.targetId} className="absolute z-[70]" style={{ top, left }}>
                {/* Pulsing dot */}
                <button
                  onClick={() => setActiveHotspot(isActive ? null : h.targetId)}
                  className="relative w-8 h-8 flex items-center justify-center"
                >
                  <span className="absolute inset-0 bg-indigo-500/30 rounded-full animate-ping"></span>
                  <span className="relative w-6 h-6 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                    <i className={`fas ${h.icon} text-white text-[8px]`}></i>
                  </span>
                </button>

                {/* Tooltip */}
                {isActive && (
                  <div className="absolute top-10 right-0 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 animate-scaleIn z-[75]">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                        <i className={`fas ${h.icon} text-sm`}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black text-[#062c24] uppercase">{h.title}</p>
                        <p className="text-[10px] text-slate-500 leading-relaxed mt-1">{h.desc}</p>
                      </div>
                    </div>
                    <button onClick={() => setActiveHotspot(null)} className="mt-3 w-full py-2 bg-slate-50 text-slate-400 rounded-xl text-[9px] font-bold uppercase hover:bg-slate-100 transition-colors">
                      Tutup
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* ═══ GUIDED TOUR MODE ═══ */}
      {mode === "tour" && currentRect && (
        <>
          {/* Dark overlay with spotlight cutout */}
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

          {/* Spotlight border */}
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

          {/* Info card */}
          <div
            className="fixed z-[87] left-4 right-4 sm:left-auto sm:right-auto sm:w-80 animate-slideUpCenter"
            style={{
              ...(currentRect.top - window.scrollY > window.innerHeight / 2
                ? { top: Math.max(80, currentRect.top - window.scrollY - 200), left: "50%", transform: "translateX(-50%)" }
                : { top: Math.min(window.innerHeight - 220, currentRect.top - window.scrollY + currentRect.height + 20), left: "50%", transform: "translateX(-50%)" }
              ),
            }}
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden" onClick={e => e.stopPropagation()}>
              {/* Progress bar */}
              <div className="h-1 bg-slate-100">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300" style={{ width: `${((tourStep + 1) / TOUR_STEPS.length) * 100}%` }} />
              </div>

              <div className="p-5">
                {/* Step counter */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">
                    {tourStep + 1} / {TOUR_STEPS.length}
                  </span>
                  <button onClick={endTour} className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors">
                    <i className="fas fa-times text-[10px]"></i>
                  </button>
                </div>

                {/* Content */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                    <i className={`fas ${currentStep.icon}`}></i>
                  </div>
                  <div>
                    <p className="text-sm font-black text-[#062c24] uppercase leading-tight">{currentStep.title}</p>
                    <p className="text-[10px] text-emerald-600 font-bold">{currentStep.titleMy}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mb-5">{currentStep.desc}</p>

                {/* Navigation */}
                <div className="flex gap-2">
                  {tourStep > 0 && (
                    <button onClick={prevStep}
                      className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all">
                      <i className="fas fa-arrow-left mr-1"></i> Sebelum
                    </button>
                  )}
                  <button onClick={nextStep}
                    className="flex-[2] py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl text-[10px] font-black uppercase hover:from-indigo-600 hover:to-purple-600 transition-all shadow-lg">
                    {tourStep < TOUR_STEPS.length - 1 ? (
                      <>Seterusnya <i className="fas fa-arrow-right ml-1"></i></>
                    ) : (
                      <>Selesai <i className="fas fa-check ml-1"></i></>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══ ANIMATIONS ═══ */}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUpCenter {
          from { opacity: 0; transform: translateY(12px) translateX(-50%); }
          to { opacity: 1; transform: translateY(0) translateX(-50%); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-slideUp { animation: slideUp 0.3s ease-out forwards; }
        .animate-slideUpCenter { animation: slideUpCenter 0.3s ease-out forwards; }
        .animate-scaleIn { animation: scaleIn 0.2s ease-out forwards; }
      `}</style>
    </>
  );
}