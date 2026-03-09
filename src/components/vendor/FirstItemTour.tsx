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
  tip?: { en: string; my: string };
  highlight?: string; // CSS selector or field name to highlight
};

const TOUR_STEPS: TourStep[] = [
  {
    id: "intro",
    icon: "fa-box-open",
    title: {
      en: "Add Your First Item! 📦",
      my: "Tambah Item Pertama! 📦",
    },
    description: {
      en: "Great job setting up your shop! Now let's add your first camping gear so customers can start booking.",
      my: "Tahniah kerana menyiapkan kedai! Sekarang jom tambah peralatan khemah pertama supaya pelanggan boleh mula menempah.",
    },
  },
  {
    id: "type",
    icon: "fa-tags",
    title: {
      en: "Choose Item Type",
      my: "Pilih Jenis Item",
    },
    description: {
      en: "First, select the type of item you're adding:",
      my: "Pertama, pilih jenis item yang anda tambah:",
    },
    tip: {
      en: "📦 Package = Bundle of items (e.g., 'Complete Camping Set')\n🔧 Add-on = Individual item (e.g., 'Tent', 'Sleeping Bag')",
      my: "📦 Pakej = Set item (cth: 'Set Camping Lengkap')\n🔧 Add-on = Item individu (cth: 'Khemah', 'Sleeping Bag')",
    },
    highlight: "type",
  },
  {
    id: "name_price",
    icon: "fa-pen",
    title: {
      en: "Name & Price",
      my: "Nama & Harga",
    },
    description: {
      en: "Enter a clear name and your rental price per night. Be specific so customers know exactly what they're getting!",
      my: "Masukkan nama yang jelas dan harga sewa per malam. Spesifikkan supaya pelanggan tahu apa yang mereka dapat!",
    },
    tip: {
      en: "💡 Good: 'Coleman 4-Person Tent'\n❌ Avoid: 'Tent' (too generic)",
      my: "💡 Bagus: 'Khemah Coleman 4 Orang'\n❌ Elakkan: 'Khemah' (terlalu umum)",
    },
    highlight: "name_price",
  },
  {
    id: "stock",
    icon: "fa-cubes",
    title: {
      en: "Set Stock Quantity",
      my: "Tetapkan Kuantiti Stok",
    },
    description: {
      en: "How many of this item do you have available for rent? This prevents overbooking.",
      my: "Berapa banyak item ini yang anda ada untuk disewa? Ini mengelakkan tempahan berlebihan.",
    },
    tip: {
      en: "📊 Update this whenever you add or remove items from your inventory",
      my: "📊 Kemas kini ini bila anda tambah atau kurangkan item dari inventori",
    },
    highlight: "stock",
  },
  {
    id: "category",
    icon: "fa-folder",
    title: {
      en: "Organize with Categories",
      my: "Susun dengan Kategori",
    },
    description: {
      en: "Group similar items together. This helps customers browse your shop more easily.",
      my: "Kumpulkan item serupa. Ini membantu pelanggan melayari kedai anda dengan lebih mudah.",
    },
    tip: {
      en: "📁 Examples: 'Tents', 'Furniture', 'Cooking', 'Lighting', 'Sleeping'",
      my: "📁 Contoh: 'Khemah', 'Perabot', 'Memasak', 'Lampu', 'Tidur'",
    },
    highlight: "category",
  },
  {
    id: "photos",
    icon: "fa-camera",
    title: {
      en: "Add Photos 📸",
      my: "Tambah Gambar 📸",
    },
    description: {
      en: "Upload clear photos of your gear. Good photos = more bookings! Show the item from different angles.",
      my: "Muat naik gambar jelas peralatan anda. Gambar bagus = lebih banyak tempahan! Tunjukkan item dari pelbagai sudut.",
    },
    tip: {
      en: "📷 Tips:\n• Use natural lighting\n• Show the item set up\n• Include size reference\n• Max 5 photos per item",
      my: "📷 Tips:\n• Gunakan cahaya semulajadi\n• Tunjukkan item yang dipasang\n• Sertakan rujukan saiz\n• Maksimum 5 gambar per item",
    },
    highlight: "photos",
  },
  {
    id: "description",
    icon: "fa-align-left",
    title: {
      en: "Write a Description",
      my: "Tulis Penerangan",
    },
    description: {
      en: "Add helpful details: size, capacity, brand, condition, or special features. This builds trust!",
      my: "Tambah butiran berguna: saiz, kapasiti, jenama, keadaan, atau ciri khas. Ini membina kepercayaan!",
    },
    tip: {
      en: "✍️ Example: 'Spacious 4-person tent with waterproof rainfly. Easy setup, comes with stakes and carry bag. Great for family camping!'",
      my: "✍️ Contoh: 'Khemah 4 orang yang luas dengan rainfly kalis air. Mudah pasang, termasuk pancang dan beg. Sesuai untuk camping keluarga!'",
    },
    highlight: "description",
  },
  {
    id: "complete",
    icon: "fa-check-circle",
    title: {
      en: "You're Ready! 🎉",
      my: "Anda Sudah Sedia! 🎉",
    },
    description: {
      en: "That's all you need! Click 'Save Item' to add it to your shop. You can always edit it later.",
      my: "Itu sahaja yang diperlukan! Klik 'Simpan Item' untuk tambah ke kedai. Anda boleh edit kemudian.",
    },
    tip: {
      en: "🚀 Pro tip: Add at least 3-5 items to make your shop look active and professional!",
      my: "🚀 Tip pro: Tambah sekurang-kurangnya 3-5 item supaya kedai anda nampak aktif dan profesional!",
    },
  },
];

type FirstItemTourProps = {
  vendorId: string;
  isOpen: boolean;
  onClose: () => void;
  onOpenAddModal?: () => void;
};

export default function FirstItemTour({ vendorId, isOpen, onClose, onOpenAddModal }: FirstItemTourProps) {
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

  async function completeTour(skipped: boolean = false) {
    try {
      await updateDoc(doc(db, "vendors", vendorId), {
        "tutorials_completed.first_item": true,
        "tutorials_completed.first_item_skipped": skipped,
        "tutorials_completed.first_item_completed_at": new Date().toISOString(),
      });
    } catch (e) {
      console.error("Failed to save tutorial progress:", e);
    }
    onClose();
    // Open the add modal after tour completes
    if (!skipped && onOpenAddModal) {
      setTimeout(() => onOpenAddModal(), 300);
    }
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
    if (confirm(lang === "en" ? "Skip the tutorial? You can add items anytime." : "Langkau tutorial? Anda boleh tambah item bila-bila masa.")) {
      completeTour(true);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#062c24]/90 backdrop-blur-md" />

      {/* Tour Card */}
      <div
        className={`relative w-full max-w-md transition-all duration-300 ${
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
          <div className="h-1.5 bg-slate-100">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Icon Header */}
          <div className="bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 p-8 text-center relative overflow-hidden">
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
                  <span className="text-[10px] font-black text-indigo-600">
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
            <p className="text-slate-600 text-sm leading-relaxed text-center mb-4">
              {step.description[lang]}
            </p>

            {/* Tip Box */}
            {step.tip && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 mb-4">
                <p className="text-xs text-amber-800 whitespace-pre-line leading-relaxed">
                  {step.tip[lang]}
                </p>
              </div>
            )}

            {/* Step dots */}
            <div className="flex justify-center gap-2 mb-6">
              {TOUR_STEPS.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentStep(idx)}
                  className={`transition-all duration-300 rounded-full ${
                    idx === currentStep
                      ? "w-6 h-2 bg-indigo-500"
                      : idx < currentStep
                      ? "w-2 h-2 bg-indigo-300"
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
                    ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:shadow-indigo-500/30 hover:shadow-xl"
                    : "bg-[#062c24] text-white hover:bg-emerald-800"
                }`}
              >
                {isLast ? (
                  <>
                    <i className="fas fa-plus mr-2"></i>
                    {lang === "en" ? "Add My First Item!" : "Tambah Item Pertama!"}
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
                {lang === "en" ? "Skip & Add Item Myself" : "Langkau & Tambah Sendiri"}
              </button>
            </div>
          )}
        </div>

        {/* Help text */}
        <p className="text-center text-white/50 text-[10px] mt-4 font-medium">
          {lang === "en"
            ? "You can always edit items after adding them"
            : "Anda boleh edit item selepas menambahnya"}
        </p>
      </div>
    </div>
  );
}