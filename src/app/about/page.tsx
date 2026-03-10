"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

type AboutContent = {
  story: string;
  story_my?: string;
  whatWeDo: string;
  whatWeDo_my?: string;
  forCampers: string;
  forCampers_my?: string;
  forVendors: string;
  forVendors_my?: string;
  whyChooseUs: { title: string; title_my?: string; desc: string; desc_my?: string; icon: string }[];
  mission: string;
  mission_my?: string;
  contactEmail: string;
  contactWhatsApp: string;
};

const DEFAULT_ABOUT: AboutContent = {
  story: "Pacak Khemah was born out of a passion for the outdoors and a desire to make camping accessible to everyone. We noticed a gap between people who wanted to experience the beauty of nature and the local vendors who own high-quality camping gear. Our platform acts as the digital bridge that connects these two worlds.",
  story_my: "Pacak Khemah lahir daripada minat terhadap alam semula jadi dan keinginan untuk menjadikan perkhemahan boleh diakses oleh semua orang.",
  whatWeDo: "We provide a comprehensive multi-vendor ecosystem specifically designed for the camping community.",
  whatWeDo_my: "Kami menyediakan ekosistem berbilang vendor yang komprehensif khusus untuk komuniti perkhemahan.",
  forCampers: "We offer a seamless browse and book experience. From tents and power stations to complete camping packages, users can find everything they need in one place and communicate directly with vendors via WhatsApp.",
  forCampers_my: "Kami menawarkan pengalaman layari dan tempah yang lancar. Pengguna boleh mencari semua yang mereka perlukan di satu tempat.",
  forVendors: "We provide a powerful Vendor Studio Command Center. Our tools allow gear owners to manage inventory, track analytics, set custom rental policies, and verify customer identities.",
  forVendors_my: "Kami menyediakan Pusat Kawalan Vendor Studio yang berkuasa untuk mengurus inventori dan analitik.",
  whyChooseUs: [
    { title: "Local Expertise", title_my: "Kepakaran Tempatan", desc: "We empower local gear owners and small businesses to reach a wider audience.", desc_my: "Kami memperkasakan pemilik peralatan tempatan.", icon: "fa-map-marker-alt" },
    { title: "Simplified Logistics", title_my: "Logistik Mudah", desc: "Dynamic pickup hubs and integrated rental steps take the stress out of coordination.", desc_my: "Hab pengambilan dinamik menghilangkan tekanan.", icon: "fa-truck" },
    { title: "Security & Trust", title_my: "Keselamatan", desc: "Built-in identity verification and standardized agreements protect both parties.", desc_my: "Pengesahan identiti melindungi kedua-dua pihak.", icon: "fa-shield-alt" },
    { title: "Transparent Pricing", title_my: "Harga Telus", desc: "Complex discounting rules including nightly discounts and promo codes.", desc_my: "Diskaun dan kod promo yang fleksibel.", icon: "fa-tags" },
  ],
  mission: "To become the ultimate companion for every outdoor enthusiast in Malaysia. Whether you are a first-time camper or a seasoned trekker, Pacak Khemah ensures you have the right gear for your next adventure.",
  mission_my: "Menjadi teman utama bagi setiap peminat aktiviti luar di Malaysia.",
  contactEmail: "support.pacakkhemah@gmail.com",
  contactWhatsApp: "601136904336",
};

export default function AboutPage() {
  const [content, setContent] = useState<AboutContent>(DEFAULT_ABOUT);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<"en" | "my">("en");

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, "settings", "content"));
        if (snap.exists() && snap.data().about) {
          setContent({ ...DEFAULT_ABOUT, ...snap.data().about });
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

  return (
    <div className="min-h-screen bg-[#f0f2f1]" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Compact Header */}
      <header className="bg-[#062c24] text-white sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/directory" className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 transition-colors">
            <i className="fas fa-arrow-left text-sm"></i>
          </Link>
          <h1 className="text-xs font-black uppercase tracking-widest">{lang === "en" ? "About Us" : "Tentang Kami"}</h1>
          <div className="flex bg-white/10 rounded-lg p-0.5">
            <button onClick={() => setLang("en")} className={`px-2.5 py-1 rounded-md text-[9px] font-black transition-all ${lang === "en" ? "bg-white text-[#062c24]" : "text-white/60"}`}>EN</button>
            <button onClick={() => setLang("my")} className={`px-2.5 py-1 rounded-md text-[9px] font-black transition-all ${lang === "my" ? "bg-white text-[#062c24]" : "text-white/60"}`}>BM</button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Hero Card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <img src="/pacak-khemah.png" alt="Logo" className="w-10 h-10 object-contain" />
          </div>
          <h2 className="text-lg font-black text-[#062c24] uppercase mb-1">Pacak Khemah</h2>
          <p className="text-xs text-slate-400 font-medium">{lang === "en" ? "Malaysia's Camping Gear Rental Platform" : "Platform Sewaan Gear Camping Malaysia"}</p>
        </div>

        {/* Our Story */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center text-sm">
              <i className="fas fa-book-open"></i>
            </div>
            <h3 className="text-xs font-black text-[#062c24] uppercase">{lang === "en" ? "Our Story" : "Kisah Kami"}</h3>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">{t(content.story, content.story_my)}</p>
        </div>

        {/* What We Do - Two Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-emerald-600 rounded-2xl p-5 text-white">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center mb-3">
              <i className="fas fa-hiking text-sm"></i>
            </div>
            <h4 className="text-[10px] font-black uppercase tracking-wide mb-2 opacity-80">{lang === "en" ? "For Campers" : "Untuk Pekhemah"}</h4>
            <p className="text-xs leading-relaxed opacity-90">{t(content.forCampers, content.forCampers_my)}</p>
          </div>
          <div className="bg-[#062c24] rounded-2xl p-5 text-white">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center mb-3">
              <i className="fas fa-store text-sm"></i>
            </div>
            <h4 className="text-[10px] font-black uppercase tracking-wide mb-2 opacity-80">{lang === "en" ? "For Vendors" : "Untuk Vendor"}</h4>
            <p className="text-xs leading-relaxed opacity-90">{t(content.forVendors, content.forVendors_my)}</p>
          </div>
        </div>

        {/* Why Choose Us */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center text-sm">
              <i className="fas fa-star"></i>
            </div>
            <h3 className="text-xs font-black text-[#062c24] uppercase">{lang === "en" ? "Why Choose Us" : "Kenapa Pilih Kami"}</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {content.whyChooseUs.map((item, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="w-8 h-8 bg-slate-100 text-slate-500 rounded-lg flex items-center justify-center shrink-0">
                  <i className={`fas ${item.icon} text-xs`}></i>
                </div>
                <div>
                  <p className="text-[10px] font-black text-[#062c24] uppercase mb-0.5">{t(item.title, item.title_my)}</p>
                  <p className="text-[10px] text-slate-500 leading-relaxed">{t(item.desc, item.desc_my)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mission */}
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-5 text-white">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <i className="fas fa-bullseye text-sm"></i>
            </div>
            <h3 className="text-xs font-black uppercase">{lang === "en" ? "Our Mission" : "Misi Kami"}</h3>
          </div>
          <p className="text-sm leading-relaxed opacity-95">{t(content.mission, content.mission_my)}</p>
        </div>

        {/* Contact */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center text-sm">
              <i className="fas fa-envelope"></i>
            </div>
            <h3 className="text-xs font-black text-[#062c24] uppercase">{lang === "en" ? "Get In Touch" : "Hubungi Kami"}</h3>
          </div>
          <div className="flex gap-2">
            <a href={`mailto:${content.contactEmail}`} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-xl text-[10px] font-bold text-center transition-colors">
              <i className="fas fa-envelope mr-2"></i>{content.contactEmail}
            </a>
            <a href={`https://wa.me/${content.contactWhatsApp}`} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl text-[10px] font-bold transition-colors">
              <i className="fab fa-whatsapp mr-2"></i>WhatsApp
            </a>
          </div>
        </div>

        {/* CTAs */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/directory" className="bg-white rounded-2xl border border-slate-100 p-4 text-center hover:border-emerald-300 hover:shadow-md transition-all group">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-2 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <i className="fas fa-search"></i>
            </div>
            <p className="text-[10px] font-black text-[#062c24] uppercase">{lang === "en" ? "Find Vendors" : "Cari Vendor"}</p>
          </Link>
          <Link href="/register-vendor" className="bg-white rounded-2xl border border-slate-100 p-4 text-center hover:border-emerald-300 hover:shadow-md transition-all group">
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
          <Link href="/faq" className="text-[9px] font-bold text-slate-400 hover:text-emerald-600">FAQ</Link>
        </div>
        <p className="text-[8px] text-slate-300">© 2026 Pacak Khemah</p>
      </footer>
    </div>
  );
}