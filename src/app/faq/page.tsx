"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

type FAQItem = { question: string; answer: string };
type FAQSection = { title: string; icon: string; items: FAQItem[] };

const DEFAULT_FAQ: FAQSection[] = [
  {
    title: "General Questions",
    icon: "fa-circle-question",
    items: [
      { question: "What is Pacak Khemah?", answer: "Pacak Khemah is Malaysia's dedicated multi-vendor camping gear rental platform." },
    ]
  }
];

function FAQAccordion({ item, isOpen, onClick }: { item: FAQItem; isOpen: boolean; onClick: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <button onClick={onClick} className="w-full flex items-start justify-between p-5 text-left hover:bg-slate-50 transition-colors">
        <p className="font-bold text-[#062c24] pr-4">{item.question}</p>
        <div className={`w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}>
          <i className="fas fa-chevron-down text-sm"></i>
        </div>
      </button>
      {isOpen && (
        <div className="px-5 pb-5 border-t border-slate-100">
          <p className="text-slate-600 leading-relaxed mt-4 whitespace-pre-line">{item.answer}</p>
        </div>
      )}
    </div>
  );
}

export default function FAQPage() {
  const [faq, setFaq] = useState<FAQSection[]>(DEFAULT_FAQ);
  const [loading, setLoading] = useState(true);
  const [openKey, setOpenKey] = useState<string | null>("0-0");

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, "settings", "content"));
        if (snap.exists() && snap.data().faq) {
          setFaq(snap.data().faq);
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
            <i className="fas fa-arrow-left"></i> Back to Home
          </Link>
          <h1 className="text-4xl font-black uppercase tracking-tight mb-2">Frequently Asked Questions</h1>
          <p className="text-emerald-300 text-lg">Soalan Lazim (FAQ)</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10">
        {/* Quick Nav */}
        <div className="bg-white rounded-2xl p-4 mb-8 border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Jump to Section</p>
          <div className="flex flex-wrap gap-2">
            {faq.map((section, idx) => (
              <a 
                key={idx}
                href={`#section-${idx}`}
                className="inline-flex items-center gap-2 bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-700 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
              >
                <i className={`fas ${section.icon}`}></i>
                {section.title}
              </a>
            ))}
          </div>
        </div>

        {/* FAQ Sections */}
        <div className="space-y-10">
          {faq.map((section, sectionIdx) => (
            <section key={sectionIdx} id={`section-${sectionIdx}`} className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                  <i className={`fas ${section.icon}`}></i>
                </div>
                <h2 className="text-lg font-black text-[#062c24] uppercase">{section.title}</h2>
              </div>
              <div className="space-y-3">
                {section.items.map((item, itemIdx) => {
                  const key = `${sectionIdx}-${itemIdx}`;
                  return (
                    <FAQAccordion
                      key={key}
                      item={item}
                      isOpen={openKey === key}
                      onClick={() => setOpenKey(openKey === key ? null : key)}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Still have questions */}
        <div className="mt-12 bg-gradient-to-r from-[#062c24] to-emerald-800 rounded-2xl p-8 text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url('/pattern-chevron.png')", backgroundSize: "200px" }} />
          <div className="relative z-10">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-comments text-2xl"></i>
            </div>
            <h3 className="text-xl font-black uppercase mb-2">Still Have Questions?</h3>
            <p className="text-emerald-200 mb-6">Can't find what you're looking for? Reach out to us!</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href="mailto:hello@pacakkhemah.com" className="inline-flex items-center justify-center gap-2 bg-white text-[#062c24] px-6 py-3 rounded-xl font-bold text-sm hover:bg-emerald-50 transition-colors">
                <i className="fas fa-envelope"></i> Email Us
              </a>
              <a href="https://wa.me/60123456789" className="inline-flex items-center justify-center gap-2 bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-emerald-400 transition-colors">
                <i className="fab fa-whatsapp"></i> WhatsApp
              </a>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-8 grid md:grid-cols-2 gap-4">
          <Link href="/directory" className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all group text-center">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-3 mx-auto group-hover:bg-emerald-500 group-hover:text-white transition-colors">
              <i className="fas fa-search"></i>
            </div>
            <h3 className="font-black text-[#062c24] uppercase mb-1">Browse Vendors</h3>
            <p className="text-slate-500 text-sm">Find camping gear near you</p>
          </Link>
          
          <Link href="/register" className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:border-amber-300 hover:shadow-md transition-all group text-center">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center mb-3 mx-auto group-hover:bg-amber-500 group-hover:text-white transition-colors">
              <i className="fas fa-store"></i>
            </div>
            <h3 className="font-black text-[#062c24] uppercase mb-1">Become a Vendor</h3>
            <p className="text-slate-500 text-sm">Start renting out your gear</p>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#062c24] text-white py-8 mt-10">
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