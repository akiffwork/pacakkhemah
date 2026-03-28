"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp, collection, getCountFromServer, query, where } from "firebase/firestore";
import {
  signInWithPopup, GoogleAuthProvider,
  createUserWithEmailAndPassword, sendEmailVerification, User,
} from "firebase/auth";

/* ── Password strength helper ── */
function getPasswordStrength(pwd: string): { score: number; label: string; color: string } {
  if (!pwd) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pwd.length >= 6) score++;
  if (pwd.length >= 10) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { score, label: "Weak", color: "bg-red-400" };
  if (score <= 2) return { score, label: "Fair", color: "bg-amber-400" };
  if (score <= 3) return { score, label: "Good", color: "bg-blue-400" };
  return { score, label: "Strong", color: "bg-emerald-500" };
}

// Mock-up vendor ID for demo shop
const MOCKUP_VENDOR_ID = "UHdf5wMhsPbwi7qFGPSloXGdbu53";

export default function RegisterVendorPage() {
  /* ── State ── */
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [displayEmail, setDisplayEmail] = useState("");
  const [startingCredits, setStartingCredits] = useState(10);
  const [error, setError] = useState("");
  const [vendorCount, setVendorCount] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getDoc(doc(db, "settings", "payment_config")).then(snap => {
      if (snap.exists()) setStartingCredits(snap.data().startingCredits || 10);
    });
    getCountFromServer(query(collection(db, "vendors"), where("status", "==", "approved")))
      .then(snap => setVendorCount(snap.data().count))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  /* ── Firebase helpers ── */
  async function createVendorShell(user: User, whatsappPhone?: string) {
    await setDoc(doc(db, "vendors", user.uid), {
      owner_uid: user.uid,
      name: user.displayName || "New Vendor",
      email: user.email,
      phone: whatsappPhone || user.phoneNumber || "",
      image: user.photoURL || "",
      status: "pending",
      credits: startingCredits,
      joinedAt: serverTimestamp(),
      setup_complete: false,
      security_deposit: 50,
    });
  }

  async function handleEmailReg() {
    setError("");
    if (!email || password.length < 6) {
      setError("Valid email & password (min 6 chars) required.");
      return;
    }
    if (!phone.trim()) {
      setError("WhatsApp number is required.");
      return;
    }
    setLoading(true);
    try {
      const cleanPhone = phone.replace(/[^0-9]/g, "");
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await createVendorShell(cred.user, cleanPhone);
      await sendEmailVerification(cred.user);
      fetch("/api/notify-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorName: cred.user.displayName || "New Vendor", email: cred.user.email, phone: cleanPhone, method: "Email" }),
      }).catch(() => {});
      setDisplayEmail(email);
      setSuccess(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleReg() {
    setError("");
    setGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      const user = res.user;
      const docSnap = await getDoc(doc(db, "vendors", user.uid));
      if (!docSnap.exists()) {
        const cleanPhone = phone.replace(/[^0-9]/g, "");
        await createVendorShell(user, cleanPhone);
        fetch("/api/notify-telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vendorName: user.displayName || "New Vendor", email: user.email, phone: cleanPhone, method: "Google" }),
        }).catch(() => {});
        alert("Account created! Please wait for admin approval to activate your shop.");
      }
      window.location.href = "/store";
    } catch (e: any) {
      setError(e.message);
      setGoogleLoading(false);
    }
  }

  const strength = getPasswordStrength(password);

  return (
    <div className="min-h-screen bg-[#f0f2f1]" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ═══ FLOATING NAV ═══ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-[#062c24]/95 backdrop-blur-md shadow-2xl py-3" : "bg-transparent py-4"}`}>
        <div className="max-w-5xl mx-auto px-5 flex items-center justify-between">
          <Link href="/directory" className="flex items-center gap-2.5">
            <img src="/pacak-khemah.png" className="w-8 h-8 rounded-lg" alt="Logo" />
            <span className="text-white font-black text-xs uppercase tracking-widest hidden sm:block">Pacak Khemah</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/directory" className="text-white/60 hover:text-white text-[9px] font-bold uppercase tracking-widest transition-colors px-3 py-2 hidden sm:block">
              Directory
            </Link>
            <button onClick={scrollToForm} className="bg-white text-[#062c24] px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all shadow-lg">
              Daftar Sekarang
            </button>
          </div>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section className="relative min-h-[100vh] bg-[#062c24] text-white flex items-center overflow-hidden">
        <div className="absolute inset-0 opacity-25" style={{ backgroundImage: "url('/pattern-chevron.png')", backgroundSize: "280px" }} />
        <div className="absolute inset-0 bg-gradient-to-br from-[#062c24] via-[#062c24]/80 to-emerald-900/50" />
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-emerald-500/8 rounded-full blur-[100px]" />

        <div className="relative z-10 max-w-5xl mx-auto px-5 py-28 w-full">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/10 px-4 py-2 rounded-full mb-8">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-300">Platform Sewa Gear Camping #1 Malaysia</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-black uppercase leading-[0.95] mb-5">
              Sewakan
              <br />
              Gear Camping
              <br />
              Anda.{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-teal-200">Jana Pendapatan.</span>
            </h1>

            <p className="text-white/50 text-sm max-w-md mb-10 leading-relaxed">
              Turn your camping equipment into a rental business. Get your own online shop, manage bookings, and receive customers — all through one platform.
            </p>

            <div className="flex flex-wrap gap-3 mb-12">
              <button onClick={scrollToForm} className="group bg-white text-[#062c24] px-7 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-100 transition-all shadow-xl flex items-center gap-3">
                <i className="fas fa-rocket"></i>
                Daftar Percuma
                <i className="fas fa-arrow-right text-[9px] group-hover:translate-x-1 transition-transform"></i>
              </button>
              <Link href={`/shop/${MOCKUP_VENDOR_ID}`} className="group bg-white/10 backdrop-blur-sm border border-white/20 text-white px-7 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-white/20 transition-all flex items-center gap-3">
                <i className="fas fa-eye"></i>
                Lihat Demo Shop
              </Link>
            </div>

            <div className="flex gap-8">
              <div>
                <p className="text-2xl font-black text-emerald-400">RM0</p>
                <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest">Kos Daftar</p>
              </div>
              {vendorCount > 0 && (
                <div>
                  <p className="text-2xl font-black text-emerald-400">{vendorCount}+</p>
                  <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest">Vendor Aktif</p>
                </div>
              )}
              <div>
                <p className="text-2xl font-black text-emerald-400">{startingCredits}</p>
                <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest">Kredit Percuma</p>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
          <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Scroll</span>
          <i className="fas fa-chevron-down text-white/20 text-xs"></i>
        </div>
      </section>

      {/* ═══ MACAM MANA IA BERFUNGSI ═══ */}
      <section className="py-20 px-5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-[0.3em] block mb-3">Macam Mana Ia Berfungsi</span>
            <h2 className="text-2xl sm:text-3xl font-black text-[#062c24] uppercase">Tiga Langkah Mudah</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { icon: "fa-store", color: "bg-emerald-100 text-emerald-600", num: "01", title: "Daftar & Sediakan Kedai", desc: "Sign up for free, upload your gear photos, set prices per night, and customize your shop page." },
              { icon: "fa-bell", color: "bg-blue-100 text-blue-600", num: "02", title: "Terima Tempahan", desc: "Customers find you in our directory and book via WhatsApp. You get notified instantly." },
              { icon: "fa-money-bill-wave", color: "bg-amber-100 text-amber-600", num: "03", title: "Jana Pendapatan", desc: "Confirm bookings, hand over gear, and earn money from equipment that would otherwise sit idle." },
            ].map((step, i) => (
              <div key={i} className="bg-white rounded-3xl p-7 border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all relative overflow-hidden group">
                <span className="absolute -top-3 -right-2 text-[60px] font-black text-slate-50 leading-none group-hover:text-emerald-50 transition-colors">{step.num}</span>
                <div className={`w-12 h-12 ${step.color} rounded-2xl flex items-center justify-center text-lg mb-5 relative z-10 group-hover:scale-110 transition-transform`}>
                  <i className={`fas ${step.icon}`}></i>
                </div>
                <h3 className="text-sm font-black text-[#062c24] uppercase mb-2 relative z-10">{step.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed relative z-10">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ KENAPA PACAK KHEMAH ═══ */}
      <section className="bg-[#062c24] text-white py-20 px-5 relative overflow-hidden">
        <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "url('/pattern-chevron.png')", backgroundSize: "250px" }} />
        <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/5 rounded-full blur-[80px]" />

        <div className="max-w-4xl mx-auto relative z-10">
          <div className="text-center mb-14">
            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.3em] block mb-3">Kenapa Pacak Khemah?</span>
            <h2 className="text-2xl sm:text-3xl font-black uppercase">Semua Yang Anda Perlukan<br/><span className="text-emerald-400">Untuk Berjaya</span></h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: "fa-coins", title: "Tiada Yuran Bulanan", desc: "No subscription, no hidden fees. You only spend 1 credit when a real customer contacts you." },
              { icon: "fa-store", title: "Kedai Online Anda Sendiri", desc: "Your own branded shop page with photos, categories, pricing, and availability calendar." },
              { icon: "fa-chart-line", title: "Dashboard & Analytics", desc: "Track views, clicks, bookings, and revenue. Know exactly how your shop performs." },
              { icon: "fa-shield-alt", title: "Perlindungan Vendor", desc: "Digital agreements, IC verification, and security deposits to protect your gear." },
              { icon: "fa-calendar-alt", title: "Kalendar Pengurusan", desc: "Block dates, set off-days, manage availability per item — all from your phone." },
              { icon: "fa-star", title: "Sistem Review Pelanggan", desc: "Verified customer reviews build trust and get you more bookings over time." },
            ].map((item, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-all group">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <i className={`fas ${item.icon} text-sm`}></i>
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase mb-1">{item.title}</h3>
                    <p className="text-[11px] text-white/40 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ MODEL HARGA ═══ */}
      <section className="py-20 px-5">
        <div className="max-w-sm mx-auto">
          <div className="text-center mb-12">
            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-[0.3em] block mb-3">Model Harga</span>
            <h2 className="text-2xl sm:text-3xl font-black text-[#062c24] uppercase">Bayar Ikut Hasil Sahaja</h2>
            <p className="text-slate-500 text-xs mt-3">No monthly fees, no risk. Pay only when customers contact you.</p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-[#062c24] to-emerald-800 p-8 text-white text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300 mb-2">Pelan Vendor</p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-5xl font-black">RM0</span>
                <span className="text-white/50 text-sm font-bold">/bulan</span>
              </div>
              <p className="text-white/40 text-xs mt-2">Percuma selamanya. Serius.</p>
            </div>

            <div className="p-8 space-y-4">
              {[
                { text: `${startingCredits} kredit percuma untuk bermula`, highlight: true },
                { text: "1 kredit = 1 pelanggan klik WhatsApp", highlight: false },
                { text: "Klik berulang 24 jam = hanya 1 caj", highlight: false },
                { text: "Listing gear & views sepenuhnya percuma", highlight: false },
                { text: "Kedai aktif selagi kredit > 0", highlight: false },
                { text: "Top up kredit bila-bila masa", highlight: false },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${item.highlight ? "bg-emerald-500 text-white" : "bg-emerald-100 text-emerald-600"}`}>
                    <i className="fas fa-check text-[9px]"></i>
                  </div>
                  <span className={`text-xs font-bold ${item.highlight ? "text-[#062c24]" : "text-slate-600"}`}>{item.text}</span>
                </div>
              ))}
            </div>

            <div className="px-8 pb-8">
              <button onClick={scrollToForm} className="w-full bg-[#062c24] text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-900 transition-all shadow-lg">
                <i className="fas fa-rocket mr-2"></i>Mula Sekarang — Percuma
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ DEMO SHOP CTA ═══ */}
      <section className="bg-[#062c24] py-16 px-5 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url('/pattern-chevron.png')", backgroundSize: "250px" }} />
        <div className="max-w-3xl mx-auto relative z-10 text-center">
          <span className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.3em] block mb-3">Lihat Sendiri</span>
          <h2 className="text-2xl sm:text-3xl font-black text-white uppercase mb-4">Inilah Rupa Kedai Anda</h2>
          <p className="text-white/40 text-xs mb-8 max-w-md mx-auto">Visit our demo shop to see exactly what your customers will experience. Full gear listing, cart, WhatsApp booking — everything.</p>
          <Link href={`/shop/${MOCKUP_VENDOR_ID}`} className="inline-flex items-center gap-3 bg-white text-[#062c24] px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-100 transition-all shadow-xl">
            <i className="fas fa-external-link-alt"></i>
            Buka Demo Shop
            <i className="fas fa-arrow-right text-[9px]"></i>
          </Link>
        </div>
      </section>

      {/* ═══ REGISTRATION FORM ═══ */}
      <section className="py-20 px-5" id="register">
        <div ref={formRef} className="max-w-sm mx-auto">

          {!success ? (
            <div>
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-5 text-2xl">
                  <i className="fas fa-store"></i>
                </div>
                <h2 className="text-2xl font-black text-[#062c24] uppercase mb-2">Daftar Sekarang</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Percuma. Sentiasa percuma.</p>
              </div>

              <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100">
                <div className="space-y-4">
                  {/* WhatsApp Number */}
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
                      <i className="fab fa-whatsapp text-emerald-500 mr-1"></i>Nombor WhatsApp Anda
                    </p>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-emerald-500">
                        <i className="fab fa-whatsapp text-sm"></i>
                      </div>
                      <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                        placeholder="cth. 60123456789" disabled={!termsAccepted}
                        className="w-full bg-slate-50 p-4 pl-10 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all disabled:opacity-50" />
                    </div>
                    <p className="text-[8px] text-slate-300 font-medium mt-1.5 px-1">Pelanggan akan menghubungi anda di nombor ini</p>
                  </div>

                  {/* Google Sign Up */}
                  <button onClick={() => {
                    if (!phone.trim()) { setError("Sila masukkan nombor WhatsApp anda."); return; }
                    handleGoogleReg();
                  }} disabled={!termsAccepted || googleLoading}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-600 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100">
                    {googleLoading
                      ? <i className="fas fa-spinner fa-spin"></i>
                      : <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />}
                    Sign up with Google
                  </button>

                  <div className="relative flex items-center justify-center py-2">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                    <span className="relative bg-white px-2 text-[9px] text-slate-300 uppercase font-bold">Atau Guna Email</span>
                  </div>

                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="Email Address" disabled={!termsAccepted}
                    className="w-full bg-slate-50 p-4 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all disabled:opacity-50" />

                  <div>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="Password (Min 6 chars)" disabled={!termsAccepted}
                      className="w-full bg-slate-50 p-4 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all disabled:opacity-50" />
                    {password.length > 0 && (
                      <div className="mt-2 px-1">
                        <div className="flex gap-1 mb-1">
                          {[1, 2, 3, 4].map(i => (
                            <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= strength.score ? strength.color : "bg-slate-200"}`} />
                          ))}
                        </div>
                        <p className={`text-[9px] font-black uppercase tracking-widest ${
                          strength.label === "Weak" ? "text-red-400" :
                          strength.label === "Fair" ? "text-amber-400" :
                          strength.label === "Good" ? "text-blue-400" : "text-emerald-500"
                        }`}>{strength.label} Password</p>
                      </div>
                    )}
                  </div>

                  {/* Terms Box */}
                  <div onClick={() => setShowTerms(true)}
                    className="bg-amber-50 border border-amber-100 rounded-2xl p-5 text-center relative overflow-hidden group hover:border-amber-300 transition-colors cursor-pointer">
                    <div className="absolute -right-4 -top-4 w-12 h-12 bg-amber-100 rounded-full blur-xl group-hover:bg-amber-200 transition-all"></div>
                    <i className="fas fa-file-contract text-amber-500 text-xl mb-2 block"></i>
                    <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-1">Perjanjian Perkhidmatan</p>
                    <p className="text-[9px] text-amber-700/70 font-medium">Baca & Terima untuk Buka Kunci</p>
                    {termsAccepted && (
                      <div className="mt-3 inline-flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-amber-200 shadow-sm">
                        <i className="fas fa-check-circle text-emerald-500 text-xs"></i>
                        <span className="text-[9px] font-bold text-emerald-600 uppercase">Diterima</span>
                      </div>
                    )}
                  </div>

                  {error && <p className="text-red-500 text-[10px] font-bold text-center">{error}</p>}

                  <button onClick={handleEmailReg} disabled={!termsAccepted || loading}
                    className="w-full bg-[#062c24] text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-900 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                    {loading ? <i className="fas fa-spinner fa-spin"></i> : "Cipta Akaun"}
                  </button>

                  <p className="text-center text-[10px] text-slate-400 font-medium mt-2">
                    Sudah ada akaun?{" "}
                    <Link href="/store" className="text-emerald-600 font-bold hover:underline">Log Masuk</Link>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-6 py-6">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
                <i className="fas fa-envelope text-3xl"></i>
              </div>
              <div>
                <h2 className="text-2xl font-black text-[#062c24]">Sahkan Email Anda</h2>
                <p className="text-xs text-slate-500 mt-2 max-w-xs mx-auto">
                  Kami telah menghantar pautan pengesahan ke{" "}
                  <span className="font-bold text-[#062c24]">{displayEmail}</span>.
                </p>
              </div>
              <div className="bg-amber-50 p-4 rounded-2xl text-[10px] text-amber-800 font-medium border border-amber-100">
                <div className="flex items-center justify-center gap-2 mb-1 text-amber-600 font-bold uppercase">
                  <i className="fas fa-exclamation-circle"></i> Penting
                </div>
                Tak nampak email? Semak folder <span className="font-black">Spam</span> atau{" "}
                <span className="font-black">Junk</span> anda.
              </div>
              <Link href="/store"
                className="block w-full bg-slate-100 text-slate-500 py-4 rounded-2xl font-black uppercase text-[10px] hover:bg-slate-200 transition-all">
                Pergi ke Log Masuk
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="bg-[#062c24] text-white/30 py-10 px-5">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/pacak-khemah.png" className="w-6 h-6 rounded-md opacity-50" alt="Logo" />
            <span className="text-[8px] font-bold uppercase tracking-widest">© 2026 Pacak Khemah</span>
          </div>
          <div className="flex gap-6 text-[9px] font-bold uppercase tracking-widest">
            <Link href="/directory" className="hover:text-white/60 transition-colors">Directory</Link>
            <Link href="/about" className="hover:text-white/60 transition-colors">About</Link>
            <Link href="/faq" className="hover:text-white/60 transition-colors">FAQ</Link>
          </div>
        </div>
      </footer>

      {/* ═══ TERMS MODAL ═══ */}
      {showTerms && (
        <div className="fixed inset-0 bg-[#062c24]/95 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl relative flex flex-col max-h-[85vh]">
            <div className="p-8 pb-4 border-b border-slate-100">
              <h2 className="text-2xl font-black text-[#062c24] uppercase">Perjanjian Perkhidmatan</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sila baca dengan teliti</p>
            </div>
            <div className="p-8 overflow-y-auto space-y-6 flex-1 text-xs text-slate-600 leading-relaxed font-medium">
              {[
                { num: "1", color: "emerald", title: "Model Berasaskan Prestasi", text: "You acknowledge that Pacak Khemah operates on a Pay-Per-Result basis. There are no monthly subscription fees. You strictly use Credits to receive actionable customer leads." },
                { num: "2", color: "emerald", title: 'Caj "Niat"', text: 'One (1) Credit is deducted from your wallet only when a customer clicks "WhatsApp Owner" or "Book Now". Listing your gear and receiving page views is completely free.' },
                { num: "3", color: "emerald", title: "Jaminan Keadilan", text: "We employ Session Fingerprinting to protect your wallet. If the same customer clicks your link multiple times within 24 hours, you are charged only once." },
                { num: "4", color: "emerald", title: "Peraturan Status Aktif", text: "Your shop listing remains active as long as your Credit Balance is positive (>0). If your wallet hits zero, your listing is automatically paused." },
                { num: "5", color: "red", title: "Tiada Bayaran Balik Kredit", text: "All Credit top-ups are final and non-refundable. Credits act as a prepaid service fee for lead generation. Any remaining balance is forfeited if you close your store or violate policies." },
              ].map(item => (
                <div key={item.num} className="flex gap-4">
                  <span className={`shrink-0 w-8 h-8 bg-${item.color}-100 text-${item.color}-${item.color === "red" ? "500" : "600"} rounded-lg flex items-center justify-center font-black text-[10px]`}>
                    {item.num}
                  </span>
                  <div>
                    <h4 className={`font-black uppercase mb-1 ${item.color === "red" ? "text-red-600" : "text-[#062c24]"}`}>{item.title}</h4>
                    <p>{item.text}</p>
                  </div>
                </div>
              ))}
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                <p className="text-emerald-800 font-bold text-center">Dengan meneruskan, anda bersetuju dengan terma ini termasuk polisi Tiada Bayaran Balik.</p>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-[2.5rem] flex gap-3">
              <button onClick={() => setShowTerms(false)}
                className="flex-1 py-4 bg-white border border-slate-200 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 transition-all">
                Batal
              </button>
              <button onClick={() => { setTermsAccepted(true); setShowTerms(false); }}
                className="flex-[2] py-4 bg-[#062c24] text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-900 shadow-lg transition-all">
                Saya Terima & Setuju
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}