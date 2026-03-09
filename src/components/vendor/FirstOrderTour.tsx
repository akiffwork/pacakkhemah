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
};

const TOUR_STEPS: TourStep[] = [
  {
    id: "intro",
    icon: "fa-shopping-bag",
    title: {
      en: "Your First Order! 🎉",
      my: "Pesanan Pertama Anda! 🎉",
    },
    description: {
      en: "Congratulations! You've received a booking request. Let's learn how to handle orders like a pro.",
      my: "Tahniah! Anda telah menerima permintaan tempahan. Jom belajar cara menguruskan pesanan seperti pro.",
    },
  },
  {
    id: "notification",
    icon: "fa-bell",
    title: {
      en: "Order Notifications",
      my: "Notifikasi Pesanan",
    },
    description: {
      en: "When a customer makes a booking request, you'll receive a WhatsApp message with all the details.",
      my: "Apabila pelanggan membuat tempahan, anda akan menerima mesej WhatsApp dengan semua butiran.",
    },
    tip: {
      en: "📱 Make sure your WhatsApp number is correct in Settings!\n⚡ Quick responses = Happy customers = Better reviews",
      my: "📱 Pastikan nombor WhatsApp anda betul dalam Tetapan!\n⚡ Respon cepat = Pelanggan gembira = Ulasan lebih baik",
    },
  },
  {
    id: "review",
    icon: "fa-clipboard-list",
    title: {
      en: "Review the Order",
      my: "Semak Pesanan",
    },
    description: {
      en: "Check the booking details: dates, items requested, customer contact, and delivery/pickup preference.",
      my: "Semak butiran tempahan: tarikh, item yang diminta, hubungan pelanggan, dan pilihan hantar/ambil.",
    },
    tip: {
      en: "✅ Verify dates against your calendar\n✅ Check stock availability\n✅ Confirm delivery location if applicable",
      my: "✅ Sahkan tarikh dengan kalendar anda\n✅ Semak ketersediaan stok\n✅ Sahkan lokasi penghantaran jika berkenaan",
    },
  },
  {
    id: "confirm",
    icon: "fa-check-double",
    title: {
      en: "Confirm with Customer",
      my: "Sahkan dengan Pelanggan",
    },
    description: {
      en: "Reply on WhatsApp to confirm the booking. Discuss pickup/delivery time, deposit, and any questions.",
      my: "Balas di WhatsApp untuk sahkan tempahan. Bincangkan masa ambil/hantar, deposit, dan sebarang soalan.",
    },
    tip: {
      en: "💬 Sample reply:\n'Hi! Thanks for booking with us. I can confirm your [items] for [dates]. Pickup at [time]? Deposit is RM[X]. Let me know!'",
      my: "💬 Contoh balasan:\n'Hi! Terima kasih kerana menempah. Saya sahkan [item] untuk [tarikh]. Ambil pada [masa]? Deposit RM[X]. Maklumkan saya!'",
    },
  },
  {
    id: "payment",
    icon: "fa-money-bill-wave",
    title: {
      en: "Collect Deposit",
      my: "Kutip Deposit",
    },
    description: {
      en: "Request a deposit to secure the booking. This protects you from no-shows!",
      my: "Minta deposit untuk sahkan tempahan. Ini melindungi anda daripada pelanggan yang tidak hadir!",
    },
    tip: {
      en: "💰 Typical deposit: 30-50% of total\n🏦 Accept: Bank transfer, Touch 'n Go, etc.\n📸 Ask for payment proof before confirming",
      my: "💰 Deposit biasa: 30-50% daripada jumlah\n🏦 Terima: Transfer bank, Touch 'n Go, dll.\n📸 Minta bukti bayaran sebelum sahkan",
    },
  },
  {
    id: "prepare",
    icon: "fa-box",
    title: {
      en: "Prepare the Gear",
      my: "Sediakan Peralatan",
    },
    description: {
      en: "Before the rental date, clean and inspect all items. Pack them neatly for a great first impression!",
      my: "Sebelum tarikh sewa, bersihkan dan periksa semua item. Kemas dengan rapi untuk kesan pertama yang baik!",
    },
    tip: {
      en: "📋 Checklist:\n• Clean all items\n• Check for damage\n• Include all accessories\n• Add instruction cards if needed",
      my: "📋 Senarai semak:\n• Bersihkan semua item\n• Periksa kerosakan\n• Sertakan semua aksesori\n• Tambah kad arahan jika perlu",
    },
  },
  {
    id: "handover",
    icon: "fa-handshake",
    title: {
      en: "Handover Day!",
      my: "Hari Penyerahan!",
    },
    description: {
      en: "Meet the customer, collect remaining payment, and brief them on how to use the equipment.",
      my: "Jumpa pelanggan, kutip baki bayaran, dan terangkan cara menggunakan peralatan.",
    },
    tip: {
      en: "📝 Pro tips:\n• Take photos of gear condition\n• Exchange WhatsApp for easy contact\n• Confirm return date & time\n• Be friendly & helpful!",
      my: "📝 Tip pro:\n• Ambil gambar keadaan gear\n• Tukar WhatsApp untuk hubungan mudah\n• Sahkan tarikh & masa pulang\n• Mesra & membantu!",
    },
  },
  {
    id: "return",
    icon: "fa-rotate-left",
    title: {
      en: "Handle Returns",
      my: "Uruskan Pemulangan",
    },
    description: {
      en: "When gear is returned, inspect for any damage. Process the security deposit accordingly.",
      my: "Apabila gear dipulangkan, periksa kerosakan. Proses deposit keselamatan sewajarnya.",
    },
    tip: {
      en: "🔍 Inspection checklist:\n• All items returned?\n• Any damage or missing parts?\n• Clean condition?\n• Refund deposit or deduct repairs",
      my: "🔍 Senarai pemeriksaan:\n• Semua item dipulangkan?\n• Ada kerosakan atau bahagian hilang?\n• Keadaan bersih?\n• Pulangkan deposit atau tolak kos pembaikan",
    },
  },
  {
    id: "review_request",
    icon: "fa-star",
    title: {
      en: "Ask for Reviews ⭐",
      my: "Minta Ulasan ⭐",
    },
    description: {
      en: "After a successful rental, kindly ask the customer to leave a review. Good reviews attract more customers!",
      my: "Selepas sewaan berjaya, minta pelanggan tinggalkan ulasan. Ulasan baik menarik lebih ramai pelanggan!",
    },
    tip: {
      en: "💬 'Thank you for renting with us! If you had a great experience, would you mind leaving us a review? It really helps our small business! 🙏'",
      my: "💬 'Terima kasih kerana menyewa dengan kami! Jika pengalaman anda bagus, bolehkah tinggalkan ulasan? Ia sangat membantu perniagaan kami! 🙏'",
    },
  },
  {
    id: "complete",
    icon: "fa-trophy",
    title: {
      en: "You're a Pro Now! 🏆",
      my: "Anda Sudah Pro! 🏆",
    },
    description: {
      en: "You've learned the complete rental flow! Each order will get easier. Keep providing great service and watch your business grow!",
      my: "Anda telah belajar aliran sewa lengkap! Setiap pesanan akan jadi lebih mudah. Teruskan memberi perkhidmatan hebat dan lihat perniagaan anda berkembang!",
    },
  },
];

type FirstOrderTourProps = {
  vendorId: string;
  isOpen: boolean;
  onClose: () => void;
};

export default function FirstOrderTour({ vendorId, isOpen, onClose }: FirstOrderTourProps) {
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
        "tutorials_completed.first_order": true,
        "tutorials_completed.first_order_skipped": skipped,
        "tutorials_completed.first_order_completed_at": new Date().toISOString(),
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
    if (confirm(lang === "en" ? "Skip this guide?" : "Langkau panduan ini?")) {
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
        <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
          {/* Progress Bar */}
          <div className="h-1.5 bg-slate-100 shrink-0">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-pink-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Icon Header */}
          <div className="bg-gradient-to-br from-orange-500 via-pink-500 to-rose-500 p-6 text-center relative overflow-hidden shrink-0">
            {/* Background Pattern */}
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: "url('/pattern-chevron.png')",
                backgroundSize: "200px",
              }}
            />

            {/* Decorative circles */}
            <div className="absolute top-4 left-4 w-16 h-16 bg-white/10 rounded-full blur-xl" />
            <div className="absolute bottom-4 right-4 w-24 h-24 bg-white/10 rounded-full blur-xl" />

            {/* Icon */}
            <div className="relative">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl mx-auto flex items-center justify-center mb-3 shadow-lg">
                <i className={`fas ${step.icon} text-white text-2xl`}></i>
              </div>

              {/* Step indicator */}
              {!isFirst && !isLast && (
                <div className="absolute -top-1 -right-1 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-[9px] font-black text-pink-600">
                    {currentStep}/{TOUR_STEPS.length - 2}
                  </span>
                </div>
              )}
            </div>

            {/* Title */}
            <h2 className="text-lg font-black text-white relative">
              {step.title[lang]}
            </h2>
          </div>

          {/* Content - Scrollable */}
          <div className="p-5 overflow-y-auto flex-1">
            <p className="text-slate-600 text-sm leading-relaxed text-center mb-4">
              {step.description[lang]}
            </p>

            {/* Tip Box */}
            {step.tip && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-3 mb-4">
                <p className="text-[11px] text-amber-800 whitespace-pre-line leading-relaxed">
                  {step.tip[lang]}
                </p>
              </div>
            )}

            {/* Step dots */}
            <div className="flex justify-center gap-1.5 mb-5 flex-wrap">
              {TOUR_STEPS.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentStep(idx)}
                  className={`transition-all duration-300 rounded-full ${
                    idx === currentStep
                      ? "w-5 h-1.5 bg-pink-500"
                      : idx < currentStep
                      ? "w-1.5 h-1.5 bg-pink-300"
                      : "w-1.5 h-1.5 bg-slate-200"
                  }`}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              {!isFirst && (
                <button
                  onClick={prevStep}
                  className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all"
                >
                  <i className="fas fa-arrow-left mr-2"></i>
                  {lang === "en" ? "Back" : "Kembali"}
                </button>
              )}

              <button
                onClick={nextStep}
                className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg ${
                  isLast
                    ? "bg-gradient-to-r from-orange-500 to-pink-500 text-white hover:shadow-pink-500/30 hover:shadow-xl"
                    : "bg-[#062c24] text-white hover:bg-emerald-800"
                }`}
              >
                {isLast ? (
                  <>
                    <i className="fas fa-check mr-2"></i>
                    {lang === "en" ? "Got It!" : "Faham!"}
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
            <div className="border-t border-slate-100 p-3 bg-slate-50 shrink-0">
              <button
                onClick={skipTour}
                className="w-full text-center text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors"
              >
                {lang === "en" ? "Skip Guide" : "Langkau Panduan"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}