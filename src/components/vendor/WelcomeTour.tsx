"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

type Language = "en" | "my";

type TourStep = {
  id: string;
  icon: string;
  title: { en: string; my: string };
  description: { en: string; my: string };
  targetTab?: string;
  position?: "center" | "bottom";
};

const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    icon: "fa-campground",
    title: {
      en: "Welcome to Pacak Khemah!",
      my: "Selamat Datang ke Pacak Khemah!",
    },
    description: {
      en: "Let's set up your rental shop in just a few quick steps. You'll be ready to receive bookings in no time!",
      my: "Jom sediakan kedai sewa anda dalam beberapa langkah mudah. Anda akan bersedia menerima tempahan dalam masa singkat!",
    },
    position: "center",
  },
  {
    id: "profile",
    icon: "fa-user-circle",
    title: {
      en: "Complete Your Profile",
      my: "Lengkapkan Profil Anda",
    },
    description: {
      en: "Add your shop name, contact info, WhatsApp number, and pickup locations so customers can find and reach you.",
      my: "Tambah nama kedai, maklumat hubungan, nombor WhatsApp, dan lokasi pickup supaya pelanggan dapat mencari anda.",
    },
    targetTab: "profile",
    position: "bottom",
  },
  {
    id: "storefront",
    icon: "fa-store",
    title: {
      en: "Design Your Storefront",
      my: "Reka Bentuk Kedai Anda",
    },
    description: {
      en: "Upload your logo, add a catchy tagline, and customize your shop's appearance to stand out.",
      my: "Muat naik logo, tambah slogan menarik, dan sesuaikan penampilan kedai anda untuk menonjol.",
    },
    targetTab: "storefront",
    position: "bottom",
  },
  {
    id: "inventory",
    icon: "fa-boxes-stacked",
    title: {
      en: "Add Your Camping Gear",
      my: "Tambah Peralatan Khemah",
    },
    description: {
      en: "List your tents, furniture, cooking equipment, and other gear. Add photos, prices, and stock quantities.",
      my: "Senaraikan khemah, perabot, peralatan memasak, dan gear lain. Tambah gambar, harga, dan kuantiti stok.",
    },
    targetTab: "inventory",
    position: "bottom",
  },
  {
    id: "settings",
    icon: "fa-cog",
    title: {
      en: "Configure Settings",
      my: "Tetapkan Tetapan",
    },
    description: {
      en: "Set up delivery options, pricing rules, and rental terms. You can also enable setup services here.",
      my: "Tetapkan pilihan penghantaran, peraturan harga, dan syarat sewa. Anda juga boleh aktifkan perkhidmatan setup di sini.",
    },
    targetTab: "settings",
    position: "bottom",
  },
  {
    id: "complete",
    icon: "fa-check-circle",
    title: {
      en: "You're All Set! 🎉",
      my: "Anda Sudah Sedia! 🎉",
    },
    description: {
      en: "Your shop is ready to go live! Share your shop link and start receiving bookings via WhatsApp.",
      my: "Kedai anda sudah sedia untuk aktif! Kongsi pautan kedai dan mula terima tempahan melalui WhatsApp.",
    },
    position: "center",
  },
];

type WelcomeTourProps = {
  vendorId: string;
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
};

export default function WelcomeTour({ vendorId, isOpen, onClose, onNavigateTab }: WelcomeTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [lang, setLang] = useState<Language>("en");
  const [isAnimating, setIsAnimating] = useState(false);

  const step = TOUR_STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === TOUR_STEPS.length - 1;
  const progress = ((currentStep + 1) / TOUR_STEPS.length) * 100;

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Highlight target tab when step changes
  useEffect(() => {
    if (step?.targetTab && onNavigateTab) {
      onNavigateTab(step.targetTab);
    }
  }, [currentStep, step?.targetTab, onNavigateTab]);

  async function completeTour(skipped: boolean = false) {
    try {
      await updateDoc(doc(db, "vendors", vendorId), {
        "tutorials_completed.welcome": true,
        "tutorials_completed.welcome_skipped": skipped,
        "tutorials_completed.welcome_completed_at": new Date().toISOString(),
      });
    } catch (e) {
      console.error("Failed to save tutorial progress:", e);
    }
    onClose();
  }

  function nextStep() {
    if (isLast) {
      completeTour(false);
    } else {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep((prev) => prev + 1);
        setIsAnimating(false);
      }, 150);
    }
  }

  function prevStep() {
    if (!isFirst) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep((prev) => prev - 1);
        setIsAnimating(false);
      }, 150);
    }
  }

  function skipTour() {
    if (confirm(lang === "en" ? "Skip the tutorial? You can restart it anytime from Settings." : "Langkau tutorial? Anda boleh mulakan semula dari Tetapan.")) {
      completeTour(true);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#062c24]/90 backdrop-blur-md" />

      {/* Spotlight effect for targeted tabs */}
      {step?.targetTab && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-transparent to-black/20" />
        </div>
      )}

      {/* Tour Card */}
      <div
        className={`relative w-full max-w-md mx-4 transition-all duration-300 ${
          isAnimating ? "opacity-0 scale-95" : "opacity-100 scale-100"
        }`}
      >
        {/* Language Toggle */}
        <div className="flex justify-center mb-4">
          <div className="bg-white/10 backdrop-blur-md rounded-full p-1 flex">
            <button
              onClick={() => setLang("en")}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${
                lang === "en"
                  ? "bg-white text-[#062c24]"
                  : "text-white/70 hover:text-white"
              }`}
            >
              English
            </button>
            <button
              onClick={() => setLang("my")}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${
                lang === "my"
                  ? "bg-white text-[#062c24]"
                  : "text-white/70 hover:text-white"
              }`}
            >
              Bahasa
            </button>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden">
          {/* Progress Bar */}
          <div className="h-1 bg-slate-100">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Icon Header */}
          <div className="bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 p-8 text-center relative overflow-hidden">
            {/* Background Pattern */}
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: "url('/pattern-chevron.png')",
                backgroundSize: "200px",
              }}
            />

            {/* Decorative circles */}
            <div className="absolute top-4 left-4 w-20 h-20 bg-white/10 rounded-full blur-xl" />
            <div className="absolute bottom-4 right-4 w-32 h-32 bg-white/10 rounded-full blur-xl" />

            {/* Icon */}
            <div className="relative">
              <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg">
                <i className={`fas ${step.icon} text-white text-3xl`}></i>
              </div>

              {/* Step indicator */}
              {!isFirst && !isLast && (
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-[10px] font-black text-emerald-600">
                    {currentStep}/{TOUR_STEPS.length - 2}
                  </span>
                </div>
              )}
            </div>

            {/* Title */}
            <h2 className="text-xl font-black text-white relative">
              {step.title[lang]}
            </h2>
          </div>

          {/* Content */}
          <div className="p-6">
            <p className="text-slate-600 text-sm leading-relaxed text-center mb-6">
              {step.description[lang]}
            </p>

            {/* Step dots */}
            <div className="flex justify-center gap-2 mb-6">
              {TOUR_STEPS.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentStep(idx)}
                  className={`transition-all duration-300 rounded-full ${
                    idx === currentStep
                      ? "w-6 h-2 bg-emerald-500"
                      : idx < currentStep
                      ? "w-2 h-2 bg-emerald-300"
                      : "w-2 h-2 bg-slate-200"
                  }`}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              {!isFirst && (
                <button
                  onClick={prevStep}
                  className="flex-1 py-3.5 rounded-xl border-2 border-slate-200 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all"
                >
                  <i className="fas fa-arrow-left mr-2"></i>
                  {lang === "en" ? "Back" : "Kembali"}
                </button>
              )}

              <button
                onClick={nextStep}
                className={`flex-1 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg ${
                  isLast
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:shadow-emerald-500/30 hover:shadow-xl"
                    : "bg-[#062c24] text-white hover:bg-emerald-800"
                }`}
              >
                {isLast ? (
                  <>
                    <i className="fas fa-rocket mr-2"></i>
                    {lang === "en" ? "Get Started!" : "Mula Sekarang!"}
                  </>
                ) : (
                  <>
                    {lang === "en" ? "Next" : "Seterusnya"}
                    <i className="fas fa-arrow-right ml-2"></i>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Skip Footer */}
          {!isLast && (
            <div className="border-t border-slate-100 p-4 bg-slate-50">
              <button
                onClick={skipTour}
                className="w-full text-center text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors"
              >
                {lang === "en" ? "Skip Tutorial" : "Langkau Tutorial"}
              </button>
            </div>
          )}
        </div>

        {/* Help text */}
        <p className="text-center text-white/50 text-[10px] mt-4 font-medium">
          {lang === "en"
            ? "You can restart this tour anytime from Settings → Help"
            : "Anda boleh mulakan semula tutorial ini dari Tetapan → Bantuan"}
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HELP SECTION COMPONENT (For Settings Tab)
// ═══════════════════════════════════════════════════════════════════════════

type HelpSectionProps = {
  onRestartTour: () => void;
  lang?: Language;
};

export function HelpSection({ onRestartTour, lang = "en" }: HelpSectionProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <h3 className="text-sm font-black text-[#062c24] uppercase tracking-wide mb-4 flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-50 text-blue-500 rounded-lg flex items-center justify-center">
          <i className="fas fa-life-ring text-sm"></i>
        </div>
        {lang === "en" ? "Help & Support" : "Bantuan & Sokongan"}
      </h3>

      <div className="space-y-2">
        {/* Restart Tour */}
        <button
          onClick={onRestartTour}
          className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-100 hover:border-emerald-200 transition-all group text-left"
        >
          <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-all">
            <i className="fas fa-graduation-cap"></i>
          </div>
          <div className="flex-1">
            <p className="text-xs font-black text-[#062c24]">
              {lang === "en" ? "Restart Welcome Tour" : "Mulakan Semula Tutorial"}
            </p>
            <p className="text-[10px] text-slate-400">
              {lang === "en"
                ? "Learn how to set up your shop"
                : "Belajar cara sediakan kedai anda"}
            </p>
          </div>
          <i className="fas fa-chevron-right text-slate-300 group-hover:text-emerald-500 transition-colors"></i>
        </button>

        {/* Help Center */}
        <a
          href="https://wa.me/6011136904336?text=Hi%20Pacak%20Khemah,%20I%20need%20help%20with%20my%20vendor%20account"
          target="_blank"
          rel="noreferrer"
          className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 transition-all group text-left"
        >
          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-all">
            <i className="fab fa-whatsapp"></i>
          </div>
          <div className="flex-1">
            <p className="text-xs font-black text-[#062c24]">
              {lang === "en" ? "Contact Support" : "Hubungi Sokongan"}
            </p>
            <p className="text-[10px] text-slate-400">
              {lang === "en"
                ? "Chat with us on WhatsApp"
                : "Berbual dengan kami di WhatsApp"}
            </p>
          </div>
          <i className="fas fa-chevron-right text-slate-300 group-hover:text-blue-500 transition-colors"></i>
        </a>

        {/* FAQ */}
        <a
          href="/faq"
          target="_blank"
          className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-amber-50 border border-slate-100 hover:border-amber-200 transition-all group text-left"
        >
          <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-all">
            <i className="fas fa-question-circle"></i>
          </div>
          <div className="flex-1">
            <p className="text-xs font-black text-[#062c24]">
              {lang === "en" ? "FAQ & Help Articles" : "Soalan Lazim & Artikel Bantuan"}
            </p>
            <p className="text-[10px] text-slate-400">
              {lang === "en"
                ? "Find answers to common questions"
                : "Cari jawapan untuk soalan lazim"}
            </p>
          </div>
          <i className="fas fa-chevron-right text-slate-300 group-hover:text-amber-500 transition-colors"></i>
        </a>
      </div>
    </div>
  );
}