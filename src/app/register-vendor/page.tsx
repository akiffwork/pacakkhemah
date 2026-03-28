"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp, collection, getCountFromServer, query, where } from "firebase/firestore";
import {
  signInWithPopup, GoogleAuthProvider,
  createUserWithEmailAndPassword, sendEmailVerification, User,
} from "firebase/auth";

type Lang = "en" | "my";

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

const MOCKUP_VENDOR_ID = "UHdf5wMhsPbwi7qFGPSloXGdbu53";

export default function RegisterVendorPage() {
  const [lang, setLang] = useState<Lang>("my");
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

  const tx = (en: string, my: string) => lang === "en" ? en : my;

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
    if (!email || password.length < 6) { setError(tx("Valid email & password (min 6 chars) required.", "Email dan kata laluan (min 6 aksara) diperlukan.")); return; }
    if (!phone.trim()) { setError(tx("WhatsApp number is required.", "Nombor WhatsApp diperlukan.")); return; }
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
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
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
        alert(tx("Account created! Please wait for admin approval.", "Akaun berjaya dicipta! Sila tunggu kelulusan admin."));
      }
      window.location.href = "/store";
    } catch (e: any) { setError(e.message); setGoogleLoading(false); }
  }

  const strength = getPasswordStrength(password);

  // ═══ Data arrays with bilingual content ═══

  const steps = [
    { icon: "fa-store", color: "bg-emerald-100 text-emerald-600", num: "01",
      en: { title: "Register & Set Up Shop", desc: "Sign up for free, upload your gear photos, set prices per night, and customize your shop page." },
      my: { title: "Daftar & Sediakan Kedai", desc: "Daftar percuma, muat naik gambar gear, tetapkan harga semalam, dan ubah suai halaman kedai anda." },
    },
    { icon: "fa-bell", color: "bg-blue-100 text-blue-600", num: "02",
      en: { title: "Receive Bookings", desc: "Customers find you in our directory and book via WhatsApp. You get notified instantly." },
      my: { title: "Terima Tempahan", desc: "Pelanggan jumpa anda di direktori dan tempah melalui WhatsApp. Anda dapat notifikasi serta-merta." },
    },
    { icon: "fa-money-bill-wave", color: "bg-amber-100 text-amber-600", num: "03",
      en: { title: "Earn Money", desc: "Confirm bookings, hand over gear, and earn money from equipment that would otherwise sit idle." },
      my: { title: "Jana Pendapatan", desc: "Sahkan tempahan, serahkan gear, dan jana pendapatan dari peralatan yang biasanya tak digunakan." },
    },
  ];

  const benefits = [
    { icon: "fa-coins",
      en: { title: "No Monthly Fees", desc: "No subscription, no hidden fees. You only spend 1 credit when a real customer contacts you." },
      my: { title: "Tiada Yuran Bulanan", desc: "Tiada langganan, tiada caj tersembunyi. Anda hanya guna 1 kredit bila pelanggan sebenar hubungi anda." },
    },
    { icon: "fa-store",
      en: { title: "Your Own Online Shop", desc: "Your own branded shop page with photos, categories, pricing, and availability calendar." },
      my: { title: "Kedai Online Anda Sendiri", desc: "Halaman kedai berjenama anda dengan gambar, kategori, harga, dan kalendar ketersediaan." },
    },
    { icon: "fa-chart-line",
      en: { title: "Dashboard & Analytics", desc: "Track views, clicks, bookings, and revenue. Know exactly how your shop performs." },
      my: { title: "Dashboard & Analitik", desc: "Jejak tontonan, klik, tempahan, dan hasil. Ketahui prestasi kedai anda dengan tepat." },
    },
    { icon: "fa-shield-alt",
      en: { title: "Vendor Protection", desc: "Digital agreements, IC verification, and security deposits to protect your gear." },
      my: { title: "Perlindungan Vendor", desc: "Perjanjian digital, pengesahan IC, dan deposit keselamatan untuk melindungi gear anda." },
    },
    { icon: "fa-calendar-alt",
      en: { title: "Availability Calendar", desc: "Block dates, set off-days, manage availability per item — all from your phone." },
      my: { title: "Kalendar Pengurusan", desc: "Blok tarikh, tetapkan hari cuti, urus ketersediaan setiap item — semua dari telefon anda." },
    },
    { icon: "fa-star",
      en: { title: "Customer Reviews", desc: "Verified customer reviews build trust and get you more bookings over time." },
      my: { title: "Review Pelanggan", desc: "Review pelanggan yang disahkan membina kepercayaan dan membawa lebih banyak tempahan." },
    },
  ];

  const pricingFeatures = [
    { en: `${startingCredits} free credits to get started`, my: `${startingCredits} kredit percuma untuk bermula`, highlight: true },
    { en: "1 credit = 1 customer clicks WhatsApp", my: "1 kredit = 1 pelanggan klik WhatsApp", highlight: false },
    { en: "Repeat clicks in 24hrs = only 1 charge", my: "Klik berulang 24 jam = hanya 1 caj", highlight: false },
    { en: "Listing gear & views are completely free", my: "Listing gear & tontonan sepenuhnya percuma", highlight: false },
    { en: "Shop active as long as credits > 0", my: "Kedai aktif selagi kredit > 0", highlight: false },
    { en: "Top up credits anytime you need", my: "Top up kredit bila-bila masa", highlight: false },
  ];

  const termsItems = [
    { num: "1", color: "emerald",
      en: { title: "Performance-Based Model", text: "You acknowledge that Pacak Khemah operates on a Pay-Per-Result basis. There are no monthly subscription fees. You strictly use Credits to receive actionable customer leads." },
      my: { title: "Model Berasaskan Prestasi", text: "Anda mengakui bahawa Pacak Khemah beroperasi secara Bayar-Ikut-Hasil. Tiada yuran langganan bulanan. Anda menggunakan Kredit untuk menerima petunjuk pelanggan." },
    },
    { num: "2", color: "emerald",
      en: { title: 'The "Intent" Charge', text: 'One (1) Credit is deducted only when a customer clicks "WhatsApp Owner" or "Book Now". Listing gear and receiving page views is completely free.' },
      my: { title: 'Caj "Niat"', text: 'Satu (1) Kredit ditolak hanya apabila pelanggan klik "WhatsApp Owner" atau "Book Now". Menyenarai gear dan menerima tontonan adalah percuma sepenuhnya.' },
    },
    { num: "3", color: "emerald",
      en: { title: "Fairness Guarantee", text: "We employ Session Fingerprinting to protect your wallet. If the same customer clicks multiple times within 24 hours, you are charged only once." },
      my: { title: "Jaminan Keadilan", text: "Kami menggunakan Session Fingerprinting untuk melindungi dompet anda. Jika pelanggan yang sama klik berkali-kali dalam 24 jam, anda hanya dikenakan sekali." },
    },
    { num: "4", color: "emerald",
      en: { title: "Active Status Rule", text: "Your shop listing remains active as long as your Credit Balance is positive (>0). If your wallet hits zero, your listing is automatically paused." },
      my: { title: "Peraturan Status Aktif", text: "Penyenaraian kedai anda kekal aktif selagi Baki Kredit positif (>0). Jika dompet kosong, penyenaraian dijeda secara automatik." },
    },
    { num: "5", color: "red",
      en: { title: "No Refunds on Credits", text: "All Credit top-ups are final and non-refundable. Credits act as a prepaid service fee. Any remaining balance is forfeited if you close your store or violate policies." },
      my: { title: "Tiada Bayaran Balik Kredit", text: "Semua top-up Kredit adalah muktamad dan tidak boleh dikembalikan. Kredit bertindak sebagai yuran perkhidmatan prabayar. Baki yang tinggal dilucuthakkan jika anda menutup kedai atau melanggar polisi." },
    },
  ];

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
            {/* Language toggle */}
            <button onClick={() => setLang(l => l === "en" ? "my" : "en")}
              className="flex items-center gap-1.5 bg-white/10 border border-white/20 px-3 py-2 rounded-xl active:bg-white/20 transition-all">
              <i className="fas fa-globe text-emerald-400 text-[9px]"></i>
              <span className="text-[9px] font-black text-white uppercase">{lang === "en" ? "EN" : "BM"}</span>
            </button>
            <Link href="/directory" className="text-white/60 hover:text-white text-[9px] font-bold uppercase tracking-widest transition-colors px-3 py-2 hidden sm:block">
              {tx("Directory", "Direktori")}
            </Link>
            <button onClick={scrollToForm} className="bg-white text-[#062c24] px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all shadow-lg">
              {tx("Register Now", "Daftar Sekarang")}
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
              <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-300">
                {tx("#1 Camping Gear Rental Platform in Malaysia", "Platform Sewa Gear Camping #1 Malaysia")}
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-black uppercase leading-[0.95] mb-5">
              {tx("Rent Out", "Sewakan")}
              <br />
              {tx("Your Camping", "Gear Camping")}
              <br />
              {tx("Gear.", "Anda.")}{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-teal-200">
                {tx("Earn Money.", "Jana Pendapatan.")}
              </span>
            </h1>

            <p className="text-white/50 text-sm max-w-md mb-10 leading-relaxed">
              {tx(
                "Turn your camping equipment into a rental business. Get your own online shop, manage bookings, and receive customers — all through one platform.",
                "Tukarkan peralatan camping anda jadi bisnes rental. Dapatkan kedai online sendiri, urus tempahan, dan terima pelanggan — semua melalui satu platform."
              )}
            </p>

            <div className="flex flex-wrap gap-3 mb-12">
              <button onClick={scrollToForm} className="group bg-white text-[#062c24] px-7 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-100 transition-all shadow-xl flex items-center gap-3">
                <i className="fas fa-rocket"></i>
                {tx("Register Free", "Daftar Percuma")}
                <i className="fas fa-arrow-right text-[9px] group-hover:translate-x-1 transition-transform"></i>
              </button>
              <Link href={`/shop/${MOCKUP_VENDOR_ID}`} className="group bg-white/10 backdrop-blur-sm border border-white/20 text-white px-7 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-white/20 transition-all flex items-center gap-3">
                <i className="fas fa-eye"></i>
                {tx("View Demo Shop", "Lihat Demo Shop")}
              </Link>
            </div>

            <div className="flex gap-8">
              <div>
                <p className="text-2xl font-black text-emerald-400">RM0</p>
                <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest">{tx("Registration Cost", "Kos Daftar")}</p>
              </div>
              {vendorCount > 0 && (
                <div>
                  <p className="text-2xl font-black text-emerald-400">{vendorCount}+</p>
                  <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest">{tx("Active Vendors", "Vendor Aktif")}</p>
                </div>
              )}
              <div>
                <p className="text-2xl font-black text-emerald-400">{startingCredits}</p>
                <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest">{tx("Free Credits", "Kredit Percuma")}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
          <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Scroll</span>
          <i className="fas fa-chevron-down text-white/20 text-xs"></i>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="py-20 px-5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-[0.3em] block mb-3">{tx("How It Works", "Macam Mana Ia Berfungsi")}</span>
            <h2 className="text-2xl sm:text-3xl font-black text-[#062c24] uppercase">{tx("Three Simple Steps", "Tiga Langkah Mudah")}</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {steps.map((step, i) => (
              <div key={i} className="bg-white rounded-3xl p-7 border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all relative overflow-hidden group">
                <span className="absolute -top-3 -right-2 text-[60px] font-black text-slate-50 leading-none group-hover:text-emerald-50 transition-colors">{step.num}</span>
                <div className={`w-12 h-12 ${step.color} rounded-2xl flex items-center justify-center text-lg mb-5 relative z-10 group-hover:scale-110 transition-transform`}>
                  <i className={`fas ${step.icon}`}></i>
                </div>
                <h3 className="text-sm font-black text-[#062c24] uppercase mb-2 relative z-10">{step[lang].title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed relative z-10">{step[lang].desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ WHY PACAK KHEMAH ═══ */}
      <section className="bg-[#062c24] text-white py-20 px-5 relative overflow-hidden">
        <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "url('/pattern-chevron.png')", backgroundSize: "250px" }} />
        <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/5 rounded-full blur-[80px]" />

        <div className="max-w-4xl mx-auto relative z-10">
          <div className="text-center mb-14">
            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.3em] block mb-3">{tx("Why Pacak Khemah?", "Kenapa Pacak Khemah?")}</span>
            <h2 className="text-2xl sm:text-3xl font-black uppercase">
              {tx("Everything You Need", "Semua Yang Anda Perlukan")}<br/>
              <span className="text-emerald-400">{tx("To Succeed", "Untuk Berjaya")}</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {benefits.map((item, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-all group">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <i className={`fas ${item.icon} text-sm`}></i>
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase mb-1">{item[lang].title}</h3>
                    <p className="text-[11px] text-white/40 leading-relaxed">{item[lang].desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section className="py-20 px-5">
        <div className="max-w-sm mx-auto">
          <div className="text-center mb-12">
            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-[0.3em] block mb-3">{tx("Pricing Model", "Model Harga")}</span>
            <h2 className="text-2xl sm:text-3xl font-black text-[#062c24] uppercase">{tx("Pay Only For Results", "Bayar Ikut Hasil Sahaja")}</h2>
            <p className="text-slate-500 text-xs mt-3">{tx("No monthly fees, no risk. Pay only when customers contact you.", "Tiada yuran bulanan, tiada risiko. Bayar hanya bila pelanggan hubungi anda.")}</p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-[#062c24] to-emerald-800 p-8 text-white text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300 mb-2">{tx("Vendor Plan", "Pelan Vendor")}</p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-5xl font-black">RM0</span>
                <span className="text-white/50 text-sm font-bold">/{tx("month", "bulan")}</span>
              </div>
              <p className="text-white/40 text-xs mt-2">{tx("Free forever. Seriously.", "Percuma selamanya. Serius.")}</p>
            </div>

            <div className="p-8 space-y-4">
              {pricingFeatures.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${item.highlight ? "bg-emerald-500 text-white" : "bg-emerald-100 text-emerald-600"}`}>
                    <i className="fas fa-check text-[9px]"></i>
                  </div>
                  <span className={`text-xs font-bold ${item.highlight ? "text-[#062c24]" : "text-slate-600"}`}>{item[lang]}</span>
                </div>
              ))}
            </div>

            <div className="px-8 pb-8">
              <button onClick={scrollToForm} className="w-full bg-[#062c24] text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-900 transition-all shadow-lg">
                <i className="fas fa-rocket mr-2"></i>{tx("Start Now — Free", "Mula Sekarang — Percuma")}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ DEMO SHOP CTA ═══ */}
      <section className="bg-[#062c24] py-16 px-5 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url('/pattern-chevron.png')", backgroundSize: "250px" }} />
        <div className="max-w-3xl mx-auto relative z-10 text-center">
          <span className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.3em] block mb-3">{tx("See For Yourself", "Lihat Sendiri")}</span>
          <h2 className="text-2xl sm:text-3xl font-black text-white uppercase mb-4">{tx("This Is How Your Shop Looks", "Inilah Rupa Kedai Anda")}</h2>
          <p className="text-white/40 text-xs mb-8 max-w-md mx-auto">
            {tx(
              "Visit our demo shop to see exactly what your customers will experience. Full gear listing, cart, WhatsApp booking — everything.",
              "Layari demo shop kami untuk lihat apa yang pelanggan anda akan alami. Senarai gear penuh, troli, tempahan WhatsApp — semuanya."
            )}
          </p>
          <Link href={`/shop/${MOCKUP_VENDOR_ID}`} className="inline-flex items-center gap-3 bg-white text-[#062c24] px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-100 transition-all shadow-xl">
            <i className="fas fa-external-link-alt"></i>
            {tx("Open Demo Shop", "Buka Demo Shop")}
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
                <h2 className="text-2xl font-black text-[#062c24] uppercase mb-2">{tx("Register Now", "Daftar Sekarang")}</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{tx("Free. Always free.", "Percuma. Sentiasa percuma.")}</p>
              </div>

              <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100">
                <div className="space-y-4">
                  {/* WhatsApp */}
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
                      <i className="fab fa-whatsapp text-emerald-500 mr-1"></i>{tx("Your WhatsApp Number", "Nombor WhatsApp Anda")}
                    </p>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500">
                        <i className="fab fa-whatsapp text-sm"></i>
                      </div>
                      <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                        placeholder={tx("e.g. 60123456789", "cth. 60123456789")} disabled={!termsAccepted}
                        className="w-full bg-slate-50 p-4 pl-10 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all disabled:opacity-50" />
                    </div>
                    <p className="text-[8px] text-slate-300 font-medium mt-1.5 px-1">{tx("Customers will contact you on this number", "Pelanggan akan menghubungi anda di nombor ini")}</p>
                  </div>

                  {/* Google */}
                  <button onClick={() => {
                    if (!phone.trim()) { setError(tx("Please enter your WhatsApp number first.", "Sila masukkan nombor WhatsApp anda.")); return; }
                    handleGoogleReg();
                  }} disabled={!termsAccepted || googleLoading}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-600 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100">
                    {googleLoading
                      ? <i className="fas fa-spinner fa-spin"></i>
                      : <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />}
                    {tx("Sign up with Google", "Daftar dengan Google")}
                  </button>

                  <div className="relative flex items-center justify-center py-2">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                    <span className="relative bg-white px-2 text-[9px] text-slate-300 uppercase font-bold">{tx("Or Use Email", "Atau Guna Email")}</span>
                  </div>

                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder={tx("Email Address", "Alamat Email")} disabled={!termsAccepted}
                    className="w-full bg-slate-50 p-4 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all disabled:opacity-50" />

                  <div>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                      placeholder={tx("Password (Min 6 chars)", "Kata Laluan (Min 6 aksara)")} disabled={!termsAccepted}
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
                        }`}>{strength.label}</p>
                      </div>
                    )}
                  </div>

                  {/* Terms */}
                  <div onClick={() => setShowTerms(true)}
                    className="bg-amber-50 border border-amber-100 rounded-2xl p-5 text-center relative overflow-hidden group hover:border-amber-300 transition-colors cursor-pointer">
                    <div className="absolute -right-4 -top-4 w-12 h-12 bg-amber-100 rounded-full blur-xl group-hover:bg-amber-200 transition-all"></div>
                    <i className="fas fa-file-contract text-amber-500 text-xl mb-2 block"></i>
                    <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-1">{tx("Service Agreement", "Perjanjian Perkhidmatan")}</p>
                    <p className="text-[9px] text-amber-700/70 font-medium">{tx("Read & Accept to Unlock", "Baca & Terima untuk Buka Kunci")}</p>
                    {termsAccepted && (
                      <div className="mt-3 inline-flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-amber-200 shadow-sm">
                        <i className="fas fa-check-circle text-emerald-500 text-xs"></i>
                        <span className="text-[9px] font-bold text-emerald-600 uppercase">{tx("Accepted", "Diterima")}</span>
                      </div>
                    )}
                  </div>

                  {error && <p className="text-red-500 text-[10px] font-bold text-center">{error}</p>}

                  <button onClick={handleEmailReg} disabled={!termsAccepted || loading}
                    className="w-full bg-[#062c24] text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-900 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                    {loading ? <i className="fas fa-spinner fa-spin"></i> : tx("Create Account", "Cipta Akaun")}
                  </button>

                  <p className="text-center text-[10px] text-slate-400 font-medium mt-2">
                    {tx("Already have an account?", "Sudah ada akaun?")}{" "}
                    <Link href="/store" className="text-emerald-600 font-bold hover:underline">{tx("Log In", "Log Masuk")}</Link>
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
                <h2 className="text-2xl font-black text-[#062c24]">{tx("Verify Your Email", "Sahkan Email Anda")}</h2>
                <p className="text-xs text-slate-500 mt-2 max-w-xs mx-auto">
                  {tx("We sent a verification link to", "Kami telah menghantar pautan pengesahan ke")}{" "}
                  <span className="font-bold text-[#062c24]">{displayEmail}</span>.
                </p>
              </div>
              <div className="bg-amber-50 p-4 rounded-2xl text-[10px] text-amber-800 font-medium border border-amber-100">
                <div className="flex items-center justify-center gap-2 mb-1 text-amber-600 font-bold uppercase">
                  <i className="fas fa-exclamation-circle"></i> {tx("Important", "Penting")}
                </div>
                {tx(
                  "Don't see the email? Check your Spam or Junk folder.",
                  "Tak nampak email? Semak folder Spam atau Junk anda."
                )}
              </div>
              <Link href="/store"
                className="block w-full bg-slate-100 text-slate-500 py-4 rounded-2xl font-black uppercase text-[10px] hover:bg-slate-200 transition-all">
                {tx("Go to Login", "Pergi ke Log Masuk")}
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
            <Link href="/directory" className="hover:text-white/60 transition-colors">{tx("Directory", "Direktori")}</Link>
            <Link href="/about" className="hover:text-white/60 transition-colors">{tx("About", "Tentang")}</Link>
            <Link href="/faq" className="hover:text-white/60 transition-colors">FAQ</Link>
          </div>
        </div>
      </footer>

      {/* ═══ TERMS MODAL ═══ */}
      {showTerms && (
        <div className="fixed inset-0 bg-[#062c24]/95 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl relative flex flex-col max-h-[85vh]">
            <div className="p-8 pb-4 border-b border-slate-100">
              <h2 className="text-2xl font-black text-[#062c24] uppercase">{tx("Service Agreement", "Perjanjian Perkhidmatan")}</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{tx("Please read carefully", "Sila baca dengan teliti")}</p>
            </div>
            <div className="p-8 overflow-y-auto space-y-6 flex-1 text-xs text-slate-600 leading-relaxed font-medium">
              {termsItems.map(item => (
                <div key={item.num} className="flex gap-4">
                  <span className={`shrink-0 w-8 h-8 bg-${item.color}-100 text-${item.color}-${item.color === "red" ? "500" : "600"} rounded-lg flex items-center justify-center font-black text-[10px]`}>
                    {item.num}
                  </span>
                  <div>
                    <h4 className={`font-black uppercase mb-1 ${item.color === "red" ? "text-red-600" : "text-[#062c24]"}`}>{item[lang].title}</h4>
                    <p>{item[lang].text}</p>
                  </div>
                </div>
              ))}
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                <p className="text-emerald-800 font-bold text-center">
                  {tx(
                    "By continuing, you agree to these terms including the No-Refund policy.",
                    "Dengan meneruskan, anda bersetuju dengan terma ini termasuk polisi Tiada Bayaran Balik."
                  )}
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-[2.5rem] flex gap-3">
              <button onClick={() => setShowTerms(false)}
                className="flex-1 py-4 bg-white border border-slate-200 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 transition-all">
                {tx("Cancel", "Batal")}
              </button>
              <button onClick={() => { setTermsAccepted(true); setShowTerms(false); }}
                className="flex-[2] py-4 bg-[#062c24] text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-900 shadow-lg transition-all">
                {tx("I Accept & Agree", "Saya Terima & Setuju")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}