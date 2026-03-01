"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";

const sections = [
  { id: "registration", label: "1. Registration" },
  { id: "customer-view", label: "2. Customer View" },
  { id: "credits", label: "3. Credits" },
  { id: "inventory", label: "4. Inventory" },
  { id: "calendar", label: "5. Calendar" },
  { id: "analytics", label: "6. Analytics" },
];

export default function TutorialPage() {
  const [activeSection, setActiveSection] = useState("registration");

  useEffect(() => {
    const handleScroll = () => {
      const sectionEls = document.querySelectorAll("section[id]");
      let current = "";
      sectionEls.forEach(section => {
        if (window.scrollY >= (section as HTMLElement).offsetTop - 250) {
          current = section.getAttribute("id") || "";
        }
      });
      if (current) setActiveSection(current);
    };

    // Run once on mount so deep links like /tutorial#credits activate the correct pill
    handleScroll();

    // Also handle hash on load
    if (window.location.hash) {
      const id = window.location.hash.replace("#", "");
      const el = document.getElementById(id);
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          setActiveSection(id);
        }, 100);
      }
    }

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="pb-32 min-h-screen" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: "#f8fafc", color: "#062c24", scrollBehavior: "smooth" }}>

      {/* Exit button */}
      <Link href="/directory"
        className="fixed top-6 right-6 z-[100] w-12 h-12 bg-black/20 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center text-white hover:bg-red-500 hover:border-red-500 hover:scale-110 transition-all shadow-2xl">
        <i className="fas fa-times text-lg"></i>
      </Link>

      {/* Hero Header */}
      <header className="bg-[#062c24] text-white pt-20 pb-32 rounded-b-[3rem] relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/cubes.png')" }}></div>
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <div className="inline-block px-4 py-1 rounded-full bg-white/10 text-emerald-300 text-[10px] font-black uppercase tracking-widest mb-4 border border-white/10 animate-pulse">
            Vendor Academy
          </div>
          <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tight mb-6">Master Your Rental Shop</h1>
          <p className="text-slate-300 text-sm max-w-xl mx-auto leading-relaxed">
            Everything you need to know about setting up your store, understanding the Pay-Per-Lead system, and getting your first booking.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mt-10">
            <a href="#registration"
              className="bg-emerald-500 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-lg">
              Start Learning
            </a>
            <Link href="/store"
              className="bg-transparent border border-white/20 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">
              Go to Studio <i className="fas fa-arrow-right ml-2"></i>
            </Link>
          </div>
        </div>
      </header>

      {/* Sticky Nav */}
      <div className="sticky top-4 z-50 max-w-4xl mx-auto px-4 -mt-16">
        <div className="bg-white/90 backdrop-blur-md p-2 rounded-2xl shadow-2xl border border-emerald-100 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {sections.map(s => (
            <a key={s.id} href={`#${s.id}`}
              className={`flex-shrink-0 px-6 py-3 rounded-xl text-[9px] font-black uppercase border transition-all ${activeSection === s.id ? "bg-[#062c24] text-white border-[#062c24]" : "text-slate-400 border-transparent hover:text-[#062c24]"}`}>
              {s.label}
            </a>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 mt-20 space-y-32">

        {/* Section 1 — Registration */}
        <section id="registration" className="scroll-mt-40">
          <SectionHeader num="1" color="slate" title="Getting Started" sub="Registration & Setup" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StepCard title="1. Sign Up">
              <p className="text-[10px] text-slate-500 leading-relaxed mb-4">Create an account using Google or Email. You will be asked to read our <b>Service Agreement</b> before proceeding.</p>
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
                <p className="text-[9px] font-bold text-amber-800"><i className="fas fa-file-contract mr-1"></i> Agreement Essential</p>
                <p className="text-[9px] text-amber-700/70 mt-1">You must accept the Pay-Per-Lead terms to unlock the form.</p>
              </div>
            </StepCard>
            <StepCard title="2. Verification">
              <p className="text-[10px] text-slate-500 leading-relaxed">If using Email, check your inbox for a verification link. You cannot log in until you verify.</p>
            </StepCard>
            <StepCard title="3. Profile Setup">
              <p className="text-[10px] text-slate-500 leading-relaxed mb-4">Once logged in, upload your logo and set your <b>Custom Shop Link</b> (e.g., /shop/camp-king).</p>
              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                <p className="text-[9px] font-bold text-emerald-800"><i className="fas fa-gift mr-1"></i> Bonus</p>
                <p className="text-[9px] text-emerald-700/70 mt-1">New accounts get <b>10 Free Credits</b> automatically.</p>
              </div>
            </StepCard>
          </div>
        </section>

        {/* Section 2 — Customer View */}
        <section id="customer-view" className="scroll-mt-40">
          <SectionHeader num="2" color="indigo" title="The Customer Journey" sub="How they book you" />
          <div className="bg-[#062c24] rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
            <div className="hidden md:block absolute top-16 left-10 right-10 h-0.5 bg-white/10 z-0"></div>
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
              {[
                { icon: "fa-search", title: "1. Search", text: "Customer finds your shop via Directory or your direct link." },
                { icon: "fa-calendar-alt", title: "2. Filter", text: "They select travel dates. Blocked items disappear here." },
                { icon: "fa-whatsapp", title: "3. Contact", text: 'They click "Book Now". This opens WhatsApp.', highlight: true },
                { icon: "fa-comments", title: "4. Deal", text: "You receive a pre-filled message. Confirm payment & logistics directly." },
              ].map((step, i) => (
                <div key={i} className="relative">
                  <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4 border ${step.highlight ? "bg-emerald-500 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)] animate-pulse" : "bg-white/10 border-white/10"}`}>
                    <i className={`fa${step.icon === "fa-whatsapp" ? "b" : "s"} ${step.icon} text-lg`}></i>
                  </div>
                  <h4 className={`text-xs font-black uppercase mb-2 ${step.highlight ? "text-emerald-400" : ""}`}>{step.title}</h4>
                  <p className="text-[10px] text-slate-400">{step.text}</p>
                  {step.highlight && (
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-white text-[#062c24] px-2 py-1 rounded text-[8px] font-black uppercase whitespace-nowrap">
                      Credit Deducted Here
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 3 — Credits */}
        <section id="credits" className="scroll-mt-40">
          <SectionHeader num="3" color="emerald" title="The Credit System" sub="Pay-Per-Lead Model" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 hover:-translate-y-1 hover:border-emerald-500 transition-all">
              <h3 className="text-lg font-black text-[#062c24] mb-4 uppercase">Fairness Rules</h3>
              <ul className="space-y-4">
                {[
                  { num: "1", color: "emerald", title: "Intent-Based Billing", text: "You pay 1 Credit per unique customer contact. Views are free." },
                  { num: "2", color: "emerald", title: "Spam Protection", text: "If the same customer clicks 10 times in 24 hours, you are charged only once." },
                  { num: "3", color: "red", title: "Zero Balance = Paused", text: "If credits run out, customers cannot contact you. Top up to reactivate." },
                ].map(item => (
                  <li key={item.num} className="flex gap-4">
                    <div className={`w-8 h-8 rounded-full bg-${item.color}-50 text-${item.color}-${item.color === "red" ? "500" : "600"} flex items-center justify-center font-black text-xs shrink-0`}>{item.num}</div>
                    <div>
                      <h5 className="text-xs font-bold text-[#062c24]">{item.title}</h5>
                      <p className="text-[10px] text-slate-500 mt-1">{item.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-8 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden flex flex-col justify-center text-center"
              style={{ background: "linear-gradient(135deg, #062c24 0%, #047857 100%)" }}>
              <h3 className="text-xl font-black uppercase mb-2">Lead Wallet</h3>
              <p className="text-xs text-emerald-200/80 mb-6">Manage your budget anytime in the Vendor Studio.</p>
              <div className="inline-flex items-center justify-center gap-3 bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/10 mx-auto">
                <span className="text-4xl font-black">50</span>
                <div className="text-left">
                  <p className="text-[9px] font-bold uppercase text-emerald-300">Credits</p>
                  <p className="text-[9px] font-medium text-slate-300">~50 Customers</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4 — Inventory */}
        <section id="inventory" className="scroll-mt-40">
          <SectionHeader num="4" color="blue" title="Smart Inventory" sub="Packages & Add-ons" />
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { icon: "fa-box", hoverColor: "blue", title: "1. Full Packages", text: 'Create "Sets" (e.g., Tent + 2 Chairs + Stove). These appear at the top of your shop.' },
                { icon: "fa-plus", hoverColor: "amber", title: "2. Single Add-ons", text: 'List items individually (e.g., "Power Station", "Cooler Box") for extra upsell revenue.' },
                { icon: "fa-wand-magic-sparkles", hoverColor: "purple", title: "3. Themed Setups", text: 'Offer "Picnic Style" or "Birthday Decor" as a premium service category.' },
              ].map(item => (
                <div key={item.title} className="text-center group">
                  <div className={`w-16 h-16 mx-auto bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-4 text-2xl group-hover:bg-${item.hoverColor}-50 group-hover:text-${item.hoverColor}-500 transition-colors`}>
                    <i className={`fas ${item.icon}`}></i>
                  </div>
                  <h4 className="text-xs font-black text-[#062c24] uppercase mb-2">{item.title}</h4>
                  <p className="text-[10px] text-slate-500 leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 5 — Calendar */}
        <section id="calendar" className="scroll-mt-40">
          <SectionHeader num="5" color="purple" title="Availability Calendar" sub="Prevent Double Bookings" />
          <div className="flex flex-col md:flex-row gap-8 items-center bg-white p-8 rounded-[2.5rem] border border-slate-100">
            <div className="flex-1">
              <h3 className="text-lg font-black text-[#062c24] uppercase mb-3">How it works</h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                You don't need to manage every single unit manually. Just use the calendar to <b>Block Dates</b> when your gear is fully booked or under maintenance.
              </p>
              <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100">
                <h4 className="text-[10px] font-black text-purple-700 uppercase mb-1"><i className="fas fa-filter mr-1"></i> Auto-Hide</h4>
                <p className="text-[10px] text-purple-600/80">When a customer searches for a date you blocked, your items are automatically hidden from results.</p>
              </div>
            </div>
            <div className="w-full md:w-64 bg-white p-4 rounded-3xl shadow-lg border border-slate-100 -rotate-3 hover:rotate-0 transition-transform">
              <div className="text-center font-bold text-xs mb-2">Availability Manager</div>
              <div className="grid grid-cols-7 gap-1 text-[8px] text-center text-slate-400 mb-2">
                {["M","T","W","T","F","S","S"].map((d, i) => <span key={i}>{d}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-1 text-[10px] font-bold text-slate-600 text-center">
                {[1,2,3,4,5,6,7].map(d => <span key={d} className="p-1">{d}</span>)}
                {[8,9].map(d => <span key={d} className="p-1 bg-red-100 text-red-500 rounded">{d}</span>)}
                {[10,11,12,13,14].map(d => <span key={d} className="p-1">{d}</span>)}
              </div>
              <div className="mt-3 text-[8px] text-center text-red-400 font-bold uppercase">Dates Blocked</div>
            </div>
          </div>
        </section>

        {/* Section 6 — Analytics */}
        <section id="analytics" className="scroll-mt-40">
          <SectionHeader num="6" color="amber" title="Analytics" sub="Measure Success" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StepCard title="Click-Through Rate">
              <p className="text-[10px] text-slate-600 leading-relaxed">High views but low WhatsApp clicks? Your photos might be blurry, or your price is too high compared to others.</p>
            </StepCard>
            <StepCard title="Closing Rate">
              <p className="text-[10px] text-slate-600 leading-relaxed">If you get many WhatsApp messages but no bookings, try improving your reply speed. <b>Replies under 5 mins win 80% of deals.</b></p>
            </StepCard>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="mt-32 py-12 text-center bg-white border-t border-slate-100">
        <p className="text-slate-400 text-[10px] font-bold uppercase mb-6">Ready to launch?</p>
        <Link href="/store"
          className="inline-block bg-[#062c24] text-white px-10 py-5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-900 transition-all shadow-xl hover:scale-105">
          Enter Vendor Studio
        </Link>
      </footer>
    </div>
  );
}

// --- Helper Components ---
function SectionHeader({ num, color, title, sub }: { num: string; color: string; title: string; sub: string }) {
  const colorMap: Record<string, string> = {
    slate: "bg-slate-100 text-slate-600",
    indigo: "bg-indigo-100 text-indigo-600",
    emerald: "bg-emerald-100 text-emerald-600",
    blue: "bg-blue-100 text-blue-600",
    purple: "bg-purple-100 text-purple-600",
    amber: "bg-amber-100 text-amber-600",
  };
  return (
    <div className="flex items-center gap-4 mb-8">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black shadow-sm ${colorMap[color]}`}>{num}</div>
      <div>
        <h2 className="text-2xl font-black text-[#062c24] uppercase">{title}</h2>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{sub}</p>
      </div>
    </div>
  );
}

function StepCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 hover:-translate-y-1 hover:border-emerald-500 hover:shadow-lg transition-all">
      <h4 className="text-xs font-black text-[#062c24] uppercase mb-2">{title}</h4>
      {children}
      <BottomNav />
    </div>
  );
}