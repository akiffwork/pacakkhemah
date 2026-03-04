"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

type FAQItem = { question: string; question_my?: string; answer: string; answer_my?: string };
type FAQSection = { title: string; title_my?: string; icon: string; items: FAQItem[] };

const DEFAULT_FAQ: FAQSection[] = [
  {
    title: "General",
    title_my: "Umum",
    icon: "fa-circle-info",
    items: [
      { 
        question: "What is Pacak Khemah?", 
        question_my: "Apa itu Pacak Khemah?",
        answer: "Pacak Khemah is Malaysia's dedicated multi-vendor camping gear rental platform. We connect outdoor enthusiasts with local gear owners, making it easier to rent high-quality equipment like tents, power stations, and complete camping sets.",
        answer_my: "Pacak Khemah adalah platform sewaan peralatan perkhemahan berbilang vendor di Malaysia. Kami menghubungkan peminat aktiviti luar dengan pemilik peralatan tempatan."
      },
      { 
        question: "Is Pacak Khemah a rental shop?", 
        question_my: "Adakah Pacak Khemah sebuah kedai sewaan?",
        answer: "No. We are a technology platform that hosts multiple independent vendors. When you rent gear, you are renting directly from the shop owner listed on the page.",
        answer_my: "Tidak. Kami adalah platform teknologi yang menempatkan berbilang vendor bebas. Apabila anda menyewa, anda menyewa terus daripada pemilik kedai."
      },
    ]
  },
  {
    title: "For Customers",
    title_my: "Untuk Pelanggan",
    icon: "fa-user",
    items: [
      { 
        question: "How do I make a booking?", 
        question_my: "Bagaimana cara membuat tempahan?",
        answer: "1. Browse the gear on a vendor's storefront\n2. Select your pickup and return dates\n3. Add items to your cart\n4. Click \"Submit Order via WhatsApp\"\n5. Finalize details directly with the vendor",
        answer_my: "1. Layari peralatan di kedai vendor\n2. Pilih tarikh ambil dan pulang\n3. Tambah item ke troli\n4. Klik \"Hantar Pesanan via WhatsApp\"\n5. Selesaikan butiran dengan vendor"
      },
      { 
        question: "Why do I need to upload my IC?", 
        question_my: "Kenapa perlu muat naik IC?",
        answer: "To ensure security of high-value equipment, vendors require identity verification. After booking confirmation, you'll receive a link to upload your ID and sign the rental agreement.",
        answer_my: "Untuk memastikan keselamatan peralatan bernilai tinggi, vendor memerlukan pengesahan identiti. Selepas pengesahan tempahan, anda akan menerima pautan untuk memuat naik IC."
      },
      { 
        question: "Is my data safe?", 
        question_my: "Adakah data saya selamat?",
        answer: "Yes. Your ID copies are stored in a secure, restricted folder. Only your specific vendor can view your documents, and they are used solely for verification purposes.",
        answer_my: "Ya. Salinan IC anda disimpan dalam folder selamat dan terhad. Hanya vendor anda boleh melihat dokumen anda."
      },
      { 
        question: "How do I pay?", 
        question_my: "Bagaimana cara bayar?",
        answer: "Payment is handled directly between you and the vendor. Most vendors accept bank transfers or E-Wallets. Details will be provided via WhatsApp.",
        answer_my: "Pembayaran diuruskan terus antara anda dan vendor. Kebanyakan vendor menerima pindahan bank atau E-Wallet."
      },
      { 
        question: "Is there a security deposit?", 
        question_my: "Ada deposit keselamatan?",
        answer: "Yes. Most vendors require a refundable deposit. The amount depends on the vendor's policy and is clearly shown in your cart summary.",
        answer_my: "Ya. Kebanyakan vendor memerlukan deposit yang boleh dikembalikan. Jumlah bergantung pada polisi vendor dan ditunjukkan dalam ringkasan troli."
      },
    ]
  },
  {
    title: "For Vendors",
    title_my: "Untuk Vendor",
    icon: "fa-store",
    items: [
      { 
        question: "How do I list my gear?", 
        question_my: "Bagaimana senaraikan peralatan?",
        answer: "Log in to your Vendor Studio and navigate to the Inventory tab. You can add items, set prices, upload photos, and manage stock levels.",
        answer_my: "Log masuk ke Vendor Studio dan pergi ke tab Inventori. Anda boleh menambah item, tetapkan harga, muat naik foto, dan urus stok."
      },
      { 
        question: "How do I verify customers?", 
        question_my: "Bagaimana sahkan pelanggan?",
        answer: "In Vendor Studio, go to the Documents tab. Copy your unique verification link and send it to customers via WhatsApp. Once they sign and upload ID, their record appears in your dashboard.",
        answer_my: "Dalam Vendor Studio, pergi ke tab Dokumen. Salin pautan pengesahan unik anda dan hantar kepada pelanggan melalui WhatsApp."
      },
      { 
        question: "How do I manage availability?", 
        question_my: "Bagaimana urus ketersediaan?",
        answer: "Use the Calendar feature to block dates when gear is rented or your shop is closed. This prevents customers from selecting unavailable dates.",
        answer_my: "Gunakan ciri Kalendar untuk menyekat tarikh apabila peralatan disewa atau kedai ditutup."
      },
      { 
        question: "What if gear is damaged?", 
        question_my: "Bagaimana jika peralatan rosak?",
        answer: "Your rental agreement includes customizable House Rules in Settings. These terms legally bind customers to your damage policies. Keep the signed PDF as record.",
        answer_my: "Perjanjian sewaan anda termasuk Peraturan Rumah yang boleh disesuaikan. Terma ini mengikat pelanggan secara sah kepada polisi kerosakan anda."
      },
    ]
  },
  {
    title: "Cancellations",
    title_my: "Pembatalan",
    icon: "fa-calendar-xmark",
    items: [
      { 
        question: "What is the cancellation policy?", 
        question_my: "Apakah polisi pembatalan?",
        answer: "Since vendors are independent, cancellation policies vary. Check the Terms of Service on the vendor's page or ask them directly via WhatsApp before payment.",
        answer_my: "Oleh kerana vendor adalah bebas, polisi pembatalan berbeza. Semak Syarat Perkhidmatan di halaman vendor atau tanya terus melalui WhatsApp."
      },
    ]
  },
];

export default function FAQPage() {
  const [faq, setFaq] = useState<FAQSection[]>(DEFAULT_FAQ);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<"en" | "my">("en");
  const [activeSection, setActiveSection] = useState(0);
  const [openItem, setOpenItem] = useState<number | null>(0);

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, "settings", "content"));
        if (snap.exists() && snap.data().faq) {
          setFaq(snap.data().faq);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const t = (en: string, my?: string) => lang === "my" && my ? my : en;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0f2f1] flex items-center justify-center">
        <i className="fas fa-spinner fa-spin text-emerald-600 text-2xl"></i>
      </div>
    );
  }

  const currentSection = faq[activeSection];

  return (
    <div className="min-h-screen bg-[#f0f2f1]" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Compact Header */}
      <header className="bg-[#062c24] text-white sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/directory" className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 transition-colors">
            <i className="fas fa-arrow-left text-sm"></i>
          </Link>
          <h1 className="text-xs font-black uppercase tracking-widest">FAQ</h1>
          <div className="flex bg-white/10 rounded-lg p-0.5">
            <button onClick={() => setLang("en")} className={`px-2.5 py-1 rounded-md text-[9px] font-black transition-all ${lang === "en" ? "bg-white text-[#062c24]" : "text-white/60"}`}>EN</button>
            <button onClick={() => setLang("my")} className={`px-2.5 py-1 rounded-md text-[9px] font-black transition-all ${lang === "my" ? "bg-white text-[#062c24]" : "text-white/60"}`}>BM</button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Section Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
          {faq.map((section, i) => (
            <button
              key={i}
              onClick={() => { setActiveSection(i); setOpenItem(0); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase whitespace-nowrap transition-all ${
                activeSection === i 
                  ? "bg-[#062c24] text-white shadow-lg" 
                  : "bg-white text-slate-500 border border-slate-100 hover:border-emerald-300"
              }`}
            >
              <i className={`fas ${section.icon}`}></i>
              {t(section.title, section.title_my)}
            </button>
          ))}
        </div>

        {/* Questions */}
        <div className="space-y-2">
          {currentSection.items.map((item, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <button
                onClick={() => setOpenItem(openItem === i ? null : i)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
              >
                <span className="text-sm font-bold text-[#062c24] pr-4">{t(item.question, item.question_my)}</span>
                <div className={`w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center shrink-0 transition-transform ${openItem === i ? "rotate-180" : ""}`}>
                  <i className="fas fa-chevron-down text-xs"></i>
                </div>
              </button>
              {openItem === i && (
                <div className="px-4 pb-4 border-t border-slate-100">
                  <p className="text-sm text-slate-600 leading-relaxed pt-4 whitespace-pre-line">{t(item.answer, item.answer_my)}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Contact Card */}
        <div className="mt-6 bg-gradient-to-br from-[#062c24] to-emerald-800 rounded-2xl p-5 text-white text-center">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <i className="fas fa-comments text-lg"></i>
          </div>
          <h3 className="text-sm font-black uppercase mb-1">{lang === "en" ? "Still Have Questions?" : "Masih Ada Soalan?"}</h3>
          <p className="text-xs opacity-80 mb-4">{lang === "en" ? "We're here to help!" : "Kami sedia membantu!"}</p>
          <div className="flex gap-2 justify-center">
            <a href="mailto:hello@pacakkhemah.com" className="bg-white/20 hover:bg-white/30 px-4 py-2.5 rounded-xl text-[10px] font-bold transition-colors">
              <i className="fas fa-envelope mr-2"></i>Email
            </a>
            <a href="https://wa.me/60123456789" className="bg-emerald-500 hover:bg-emerald-400 px-4 py-2.5 rounded-xl text-[10px] font-bold transition-colors">
              <i className="fab fa-whatsapp mr-2"></i>WhatsApp
            </a>
          </div>
        </div>

        {/* CTAs */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link href="/directory" className="bg-white rounded-2xl border border-slate-100 p-4 text-center hover:border-emerald-300 hover:shadow-md transition-all group">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-2 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <i className="fas fa-search"></i>
            </div>
            <p className="text-[10px] font-black text-[#062c24] uppercase">{lang === "en" ? "Find Vendors" : "Cari Vendor"}</p>
          </Link>
          <Link href="/register" className="bg-white rounded-2xl border border-slate-100 p-4 text-center hover:border-emerald-300 hover:shadow-md transition-all group">
            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mx-auto mb-2 group-hover:bg-amber-500 group-hover:text-white transition-colors">
              <i className="fas fa-store"></i>
            </div>
            <p className="text-[10px] font-black text-[#062c24] uppercase">{lang === "en" ? "Become Vendor" : "Jadi Vendor"}</p>
          </Link>
        </div>
      </main>

      {/* Simple Footer */}
      <footer className="text-center py-6 border-t border-slate-200 bg-white mt-6">
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Pacak Khemah</p>
        <div className="flex justify-center gap-4 mb-3">
          <Link href="/directory" className="text-[9px] font-bold text-slate-400 hover:text-emerald-600">Directory</Link>
          <Link href="/about" className="text-[9px] font-bold text-slate-400 hover:text-emerald-600">About</Link>
        </div>
        <p className="text-[8px] text-slate-300">© 2026 Pacak Khemah</p>
      </footer>

      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}