"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

type AboutContent = {
  story: string;
  whatWeDo: string;
  forCampers: string;
  forVendors: string;
  whyChooseUs: { title: string; desc: string; icon: string }[];
  mission: string;
  contactEmail: string;
  contactWhatsApp: string;
};

const DEFAULT_ABOUT: AboutContent = {
  story: "Pacak Khemah was born out of a passion for the outdoors and a desire to make camping accessible to everyone.",
  whatWeDo: "We provide a comprehensive multi-vendor ecosystem specifically designed for the camping community.",
  forCampers: "We offer a seamless browse and book experience for camping gear.",
  forVendors: "We provide a powerful Vendor Studio Command Center.",
  whyChooseUs: [
    { title: "Local Expertise", desc: "We empower local gear owners.", icon: "fa-map-marker-alt" },
    { title: "Simplified Logistics", desc: "We take the stress out of gear coordination.", icon: "fa-truck" },
    { title: "Security & Trust", desc: "Built-in identity verification.", icon: "fa-shield-alt" },
    { title: "Transparent Pricing", desc: "Complex discounting rules.", icon: "fa-tags" },
  ],
  mission: "To become the ultimate companion for every outdoor enthusiast in Malaysia.",
  contactEmail: "hello@pacakkhemah.com",
  contactWhatsApp: "60123456789",
};

export default function AboutPage() {
  const [content, setContent] = useState<AboutContent>(DEFAULT_ABOUT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, "settings", "content"));
        if (snap.exists() && snap.data().about) {
          setContent({ ...DEFAULT_ABOUT, ...snap.data().about });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#062c24] flex items-center justify-center">
        <div className="text-white font-black uppercase text-sm animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f2f1]" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <header className="bg-[#062c24] text-white py-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "url('/pattern-chevron.png')", backgroundSize: "300px" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-[#062c24] via-[#062c24]/80 to-[#062c24]" />
        <div className="max-w-4xl mx-auto px-4 relative z-10">
          <Link href="/" className="inline-flex items-center gap-2 text-emerald-300 text-sm font-bold mb-6 hover:text-white transition-colors">
            <i className="fas fa-arrow-left"></i> Kembali ke Laman Utama
          </Link>
          <h1 className="text-4xl font-black uppercase tracking-tight mb-2">About Pacak Khemah</h1>
          <p className="text-emerald-300 text-lg">Tentang Kami</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10 space-y-8">
        {/* Our Story */}
        <section className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center text-xl">
              <i className="fas fa-book-open"></i>
            </div>
            <h2 className="text-xl font-black text-[#062c24] uppercase">Our Story</h2>
          </div>
          <p className="text-slate-600 leading-relaxed text-lg">{content.story}</p>
        </section>

        {/* What We Do */}
        <section className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center text-xl">
              <i className="fas fa-campground"></i>
            </div>
            <h2 className="text-xl font-black text-[#062c24] uppercase">What We Do</h2>
          </div>
          <p className="text-slate-600 leading-relaxed mb-6">{content.whatWeDo}</p>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-xl border border-emerald-100">
              <div className="w-10 h-10 bg-emerald-500 text-white rounded-lg flex items-center justify-center mb-4">
                <i className="fas fa-hiking"></i>
              </div>
              <h3 className="font-black text-[#062c24] uppercase mb-3">For Campers</h3>
              <p className="text-slate-600 leading-relaxed">{content.forCampers}</p>
            </div>
            
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-xl border border-amber-100">
              <div className="w-10 h-10 bg-amber-500 text-white rounded-lg flex items-center justify-center mb-4">
                <i className="fas fa-store"></i>
              </div>
              <h3 className="font-black text-[#062c24] uppercase mb-3">For Vendors</h3>
              <p className="text-slate-600 leading-relaxed">{content.forVendors}</p>
            </div>
          </div>
        </section>

        {/* Why Choose Us */}
        {content.whyChooseUs.length > 0 && (
          <section className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center text-xl">
                <i className="fas fa-star"></i>
              </div>
              <h2 className="text-xl font-black text-[#062c24] uppercase">Why Choose Us?</h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-5">
              {content.whyChooseUs.map((item, i) => (
                <div key={i} className="flex gap-4 items-start p-4 bg-slate-50 rounded-xl">
                  <div className="w-10 h-10 bg-emerald-500 text-white rounded-lg flex items-center justify-center shrink-0">
                    <i className={`fas ${item.icon}`}></i>
                  </div>
                  <div>
                    <h3 className="font-black text-[#062c24] mb-1">{item.title}</h3>
                    <p className="text-slate-600 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Our Mission */}
        <section className="bg-gradient-to-r from-[#062c24] to-emerald-800 rounded-2xl p-8 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url('/pattern-chevron.png')", backgroundSize: "200px" }} />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-xl">
                <i className="fas fa-bullseye"></i>
              </div>
              <h2 className="text-xl font-black uppercase">Our Mission</h2>
            </div>
            <p className="text-emerald-100 leading-relaxed text-lg">{content.mission}</p>
          </div>
        </section>

        {/* CTA Section */}
        <section className="grid md:grid-cols-2 gap-4">
          <Link href="/directory" className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all group">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
              <i className="fas fa-search"></i>
            </div>
            <h3 className="font-black text-[#062c24] uppercase mb-2">Browse Vendors</h3>
            <p className="text-slate-500 text-sm">Find camping gear from trusted vendors near you</p>
            <span className="inline-flex items-center gap-2 text-emerald-600 font-bold text-sm mt-3 group-hover:gap-3 transition-all">
              Explore <i className="fas fa-arrow-right"></i>
            </span>
          </Link>
          
          <Link href="/register" className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:border-amber-300 hover:shadow-md transition-all group">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-amber-500 group-hover:text-white transition-colors">
              <i className="fas fa-store"></i>
            </div>
            <h3 className="font-black text-[#062c24] uppercase mb-2">Become a Vendor</h3>
            <p className="text-slate-500 text-sm">Start renting out your camping gear today</p>
            <span className="inline-flex items-center gap-2 text-amber-600 font-bold text-sm mt-3 group-hover:gap-3 transition-all">
              Register <i className="fas fa-arrow-right"></i>
            </span>
          </Link>
        </section>

        {/* Contact */}
        <section className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center text-xl">
              <i className="fas fa-envelope"></i>
            </div>
            <h2 className="text-xl font-black text-[#062c24] uppercase">Contact Us</h2>
          </div>
          <p className="text-slate-600 mb-5">Have questions or feedback? We'd love to hear from you!</p>
          <div className="flex flex-wrap gap-4">
            <a href={`mailto:${content.contactEmail}`} className="inline-flex items-center gap-2 bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-700 px-5 py-3 rounded-xl font-bold text-sm transition-colors">
              <i className="fas fa-envelope"></i> {content.contactEmail}
            </a>
            <a href={`https://wa.me/${content.contactWhatsApp}`} className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-3 rounded-xl font-bold text-sm transition-colors">
              <i className="fab fa-whatsapp"></i> WhatsApp Support
            </a>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#062c24] text-white py-8 mt-8">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-emerald-300 font-bold mb-2">Pacak Khemah</p>
          <p className="text-sm text-white/60">© 2026 Pacak Khemah. All Rights Reserved.</p>
          <div className="flex justify-center gap-6 mt-4">
            <Link href="/faq" className="text-white/60 hover:text-emerald-300 text-sm transition-colors">FAQ</Link>
            <Link href="/about" className="text-white/60 hover:text-emerald-300 text-sm transition-colors">About</Link>
            <Link href="/directory" className="text-white/60 hover:text-emerald-300 text-sm transition-colors">Directory</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}