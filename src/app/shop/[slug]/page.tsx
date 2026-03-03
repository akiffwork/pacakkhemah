"use client";

import { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import {
  doc, getDoc, collection, query, where, getDocs,
  runTransaction, serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";

type VendorData = {
  name: string; tagline?: string; tagline_my?: string; image?: string;
  ig?: string; tiktok?: string; fb?: string; phone?: string;
  pickup?: string[]; city?: string; rules?: string[];
  steps?: { title: string; my: string; desc?: string; desc_my?: string }[];
  status?: string; is_vacation?: boolean; credits?: number;
  owner_uid?: string; show_nav?: boolean;
  security_deposit?: number; security_deposit_type?: string;
  allow_stacking?: boolean;
};
type GearItem = {
  id: string; name: string; price: number; img?: string;
  desc?: string; category?: string; type?: string;
  stock?: number; inc?: string[]; deleted?: boolean;
};
type CartItem = GearItem & { qty: number };
type AvailRule = { itemId?: string; type?: string; start: string; end?: string; qty?: number };
type Discount = { type: string; trigger_nights?: number; discount_percent: number; code?: string; deleted?: boolean; is_public?: boolean };

function BlockScreen({ message, icon, iconBg }: { message: string; icon: string; iconBg: string }) {
  return (
    <div className="fixed inset-0 bg-[#062c24]/95 backdrop-blur-md z-[100] flex items-center justify-center p-8 text-center">
      <div>
        <div className={`w-20 h-20 ${iconBg} rounded-full flex items-center justify-center mx-auto mb-6 text-3xl`}>
          <i className={`fas ${icon}`}></i>
        </div>
        <h2 className="text-white text-3xl font-black uppercase mb-2">{message}</h2>
        <Link href="/directory" className="inline-block bg-white text-[#062c24] px-8 py-4 rounded-2xl font-black uppercase text-xs mt-4">Back</Link>
      </div>
    </div>
  );
}

function Section({ title, icon, defaultOpen = true, children }: { title: string; icon: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center text-sm">
            <i className={`fas ${icon}`}></i>
          </div>
          <span className="text-sm font-black text-[#062c24] uppercase tracking-wide">{title}</span>
        </div>
        <i className={`fas fa-chevron-down text-slate-300 text-xs transition-transform duration-200 ${open ? "rotate-180" : ""}`}></i>
      </button>
      {open && (
        <div className="px-4 pb-4">{children}</div>
      )}
    </div>
  );
}

export default function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const searchParams = useSearchParams();
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorData, setVendorData] = useState<VendorData | null>(null);
  const [allGear, setAllGear] = useState<GearItem[]>([]);
  const [availRules, setAvailRules] = useState<AvailRule[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedDates, setSelectedDates] = useState<[Date | null, Date | null]>([null, null]);
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<Discount | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [promoMsg, setPromoMsg] = useState<{ text: string; success: boolean } | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<GearItem | null>(null);
  const [selectedHub, setSelectedHub] = useState("");
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [blockState, setBlockState] = useState<null | "unapproved" | "vacation" | "nocredits">(null);
  const [ownerPreview, setOwnerPreview] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showShareToast, setShowShareToast] = useState(false);
  const [addToast, setAddToast] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const cpRef = useRef<any>(null);
  const opRef = useRef<any>(null);

  useEffect(() => {
    if (showShareToast) { const t = setTimeout(() => setShowShareToast(false), 2000); return () => clearTimeout(t); }
  }, [showShareToast]);

  useEffect(() => {
    const v = searchParams.get("v");
    if (v) { setVendorId(v); }
    else if (slug) { lookupSlug(slug); }
    else { window.location.href = "/directory"; }
  }, [slug, searchParams]);

  async function lookupSlug(slug: string) {
    try {
      const snap = await getDocs(query(collection(db, "vendors"), where("slug", "==", slug)));
      if (!snap.empty) setVendorId(snap.docs[0].id);
      else window.location.href = "/directory";
    } catch { window.location.href = "/directory"; }
  }

  useEffect(() => {
    if (!vendorId) return;
    const unsub = onAuthStateChanged(auth, () => { loadShop(); });
    return () => unsub();
  }, [vendorId]);

  async function loadShop() {
    if (!vendorId) return;
    try {
      const vSnap = await getDoc(doc(db, "vendors", vendorId));
      if (!vSnap.exists()) return;
      const vData = vSnap.data() as VendorData;
      setVendorData(vData);
      setSelectedHub((vData.pickup?.[0] || vData.city) ?? "");
      const user = auth.currentUser;
      const ownerCheck = !!(user && user.uid === vData.owner_uid);
      setIsOwner(ownerCheck);
      const isApproved = vData.status === "approved";
      const isVacation = vData.is_vacation === true;
      const hasCredits = (vData.credits || 0) > 0;
      if (!ownerCheck) {
        if (!isApproved) { setBlockState("unapproved"); return; }
        if (isVacation) { setBlockState("vacation"); return; }
        if (!hasCredits) { setBlockState("nocredits"); return; }
      } else if (!isApproved || isVacation) { setOwnerPreview(true); }
      const [gearSnap, availSnap, discSnap] = await Promise.all([
        getDocs(query(collection(db, "gear"), where("vendorId", "==", vendorId))),
        getDocs(collection(db, "vendors", vendorId, "availability")),
        getDocs(collection(db, "vendors", vendorId, "discounts")),
      ]);
      setAllGear(gearSnap.docs.map(d => ({ id: d.id, ...d.data() } as GearItem)).filter(g => !g.deleted));
      setAvailRules(availSnap.docs.map(d => d.data() as AvailRule));
      setDiscounts(discSnap.docs.map(d => d.data() as Discount).filter(d => !d.deleted));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (!allGear.length) return;
    const blocked = availRules.filter(r => r.type === "block").map(r => ({ from: r.start, to: r.end || r.start }));
    cpRef.current = flatpickr("#checkin-date", {
      minDate: "today", dateFormat: "Y-m-d", disable: blocked,
      onChange: ([d]) => { setSelectedDates(prev => [d, prev[1]]); opRef.current?.set("minDate", d); },
    });
    opRef.current = flatpickr("#checkout-date", {
      minDate: "today", dateFormat: "Y-m-d", disable: blocked,
      onChange: ([d]) => setSelectedDates(prev => [prev[0], d]),
    });
    return () => { cpRef.current?.destroy(); opRef.current?.destroy(); };
  }, [allGear, availRules]);

  const specialOffer = discounts.find(d => d.type === "nightly_discount" && d.is_public !== false);

  function getAvailableStock(itemId: string) {
    if (!selectedDates[0] || !selectedDates[1]) return 999;
    const item = allGear.find(g => g.id === itemId);
    if (!item) return 0;
    const overlapping = availRules.filter(r => r.itemId === itemId && new Date(r.start) <= selectedDates[1]! && new Date(r.end || r.start) >= selectedDates[0]!);
    return Math.max(0, (item.stock || 0) - overlapping.reduce((s, r) => s + (r.qty || 0), 0));
  }

  function addToCart(item: GearItem) {
    setCart(prev => {
      const ex = prev.find(i => i.id === item.id);
      if (ex) return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...item, qty: 1 }];
    });
    setShowItemModal(false);
    setAddToast(item.name);
    setTimeout(() => setAddToast(null), 2000);
  }
  function removeFromCart(id: string) { setCart(prev => prev.filter(i => i.id !== id)); }
  function updateCartQty(id: string, delta: number) {
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0));
  }

  const nights = selectedDates[0] && selectedDates[1] ? Math.max(1, Math.ceil((selectedDates[1].getTime() - selectedDates[0].getTime()) / 86400000)) : 1;
  const dailyTotal = cart.reduce((acc, i) => acc + i.price * i.qty, 0);
  const sub = dailyTotal * nights;
  let autoDisc = 0;
  const rule = discounts.filter(d => d.type === "nightly_discount" && (d.trigger_nights ?? 0) <= nights).sort((a, b) => b.discount_percent - a.discount_percent)[0];
  if (rule) { const fn = (rule.trigger_nights ?? 0) - 1; const dn = nights - fn; if (dn > 0) autoDisc = dailyTotal * dn * (rule.discount_percent / 100); }
  const promoDisc = appliedPromo ? sub * (appliedPromo.discount_percent / 100) : 0;
  const allowStacking = vendorData?.allow_stacking === true;
  let finalDiscount = 0, showAuto = false, showPromo = false;
  if (allowStacking) { finalDiscount = autoDisc + promoDisc; if (autoDisc > 0) showAuto = true; if (promoDisc > 0) showPromo = true; }
  else { finalDiscount = Math.max(autoDisc, promoDisc); if (finalDiscount > 0) { if (promoDisc >= autoDisc && promoDisc > 0) showPromo = true; else showAuto = true; } }
  const subAfterDisc = sub - finalDiscount;
  const dep = vendorData?.security_deposit_type === "percent" ? subAfterDisc * ((vendorData.security_deposit || 0) / 100) : (vendorData?.security_deposit || 50);
  const total = Math.round(subAfterDisc + dep);

  function applyPromo() {
    const code = promoInput.trim().toUpperCase();
    const found = discounts.find(d => d.type === "promo_code" && d.code === code);
    if (found) { setAppliedPromo(found); setPromoMsg({ text: `Success! ${found.discount_percent}% Off Applied`, success: true }); }
    else { setAppliedPromo(null); setPromoMsg({ text: "Invalid Code", success: false }); }
  }

  async function sendWhatsAppOrder() {
    let discText = "";
    if (showAuto) discText += "(Extended Stay Discount Applied) ";
    if (showPromo) discText += "(Promo Code Applied)";
    const pickupDate = (cpRef.current as any)?._input?.value;
    const returnDate = (opRef.current as any)?._input?.value;
    const msg = `Hi ${vendorData?.name}, Booking Request:%0A%0A${cart.map(i => `• ${i.name} (x${i.qty})`).join("%0A")}%0A%0ADates: ${pickupDate} to ${returnDate}%0APickup: ${selectedHub}%0A${discText}%0ATotal: RM ${total}`;
    const storageKey = `click_${vendorId}`;
    const lastClick = localStorage.getItem(storageKey);
    if (!lastClick || Date.now() - Number(lastClick) > 86400000) {
      try {
        await runTransaction(db, async (t) => {
          const vRef = doc(db, "vendors", vendorId!);
          const vDoc = await t.get(vRef);
          const c = vDoc.data()?.credits || 0;
          if (c > 0) {
            t.update(vRef, { credits: c - 1 });
            t.set(doc(collection(db, "analytics")), {
              vendorId, vendorName: vendorData?.name, totalAmount: total,
              timestamp: serverTimestamp(), type: "whatsapp_lead",
              pickupLocation: selectedHub,
              bookingDates: { start: pickupDate, end: returnDate },
              cartItems: cart.map(i => ({ id: i.id, name: i.name, qty: i.qty, price: i.price })),
            });
          }
        });
        localStorage.setItem(storageKey, String(Date.now()));
      } catch (e) { console.error(e); }
    }
    window.open(`https://wa.me/${vendorData?.phone}?text=${msg}`, "_blank");
  }

  const categories = Array.from(new Set(allGear.map(g => g.category || (g.type === "package" ? "Packages" : "Add-ons")))).sort();
  // Auto-select first category if none selected
  useEffect(() => {
    if (categories.length > 0 && !activeCategory) setActiveCategory(categories[0]);
  }, [categories.length]);
  const filteredGear = (cat: string) => allGear.filter(g => (g.category || (g.type === "package" ? "Packages" : "Add-ons")) === cat && g.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const cartCount = cart.reduce((a, i) => a + i.qty, 0);
  const canOrder = cartCount > 0 && selectedDates[0] && selectedDates[1] && termsAgreed;
  const terms = vendorData?.rules?.map(r => (
    <div key={r} className="flex gap-2 items-start text-left">
      <i className="fas fa-check-circle text-emerald-500 mt-0.5 shrink-0 text-xs"></i>
      <span>{r}</span>
    </div>
  ));

  function handleShare() {
    if (navigator.share) navigator.share({ title: vendorData?.name || "Shop", url: window.location.href }).catch(() => {});
    else { navigator.clipboard.writeText(window.location.href); setShowShareToast(true); }
  }

  if (blockState === "unapproved") return <BlockScreen message="Hub Building" icon="fa-hard-hat" iconBg="bg-slate-200 text-slate-400" />;
  if (blockState === "vacation") return <BlockScreen message="On Vacation" icon="fa-umbrella-beach" iconBg="bg-blue-400 text-white" />;
  if (blockState === "nocredits") return <BlockScreen message="Hub Unavailable" icon="fa-store-slash" iconBg="bg-red-500 text-white" />;

  return (
    <div className="pb-8 min-h-screen" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: "#f0f2f1", color: "#0f172a" }}>
      {ownerPreview && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-amber-400 text-[#062c24] px-4 py-2 rounded-full text-[10px] font-black uppercase shadow-xl z-[200] animate-bounce">PREVIEW MODE</div>
      )}

      {/* Hero Header — centered profile layout */}
      <header className="bg-[#062c24] text-white relative overflow-hidden">
        {/* Pattern background */}
        <div className="absolute inset-0 opacity-[0.08]"
          style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/dark-wood.png')" }} />

        {/* Nav row */}
        <div className="relative z-10 flex justify-between items-center px-4 pt-4">
          <Link href="/directory" className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center hover:bg-white hover:text-[#062c24] transition-all">
            <i className="fas fa-arrow-left text-sm"></i>
          </Link>
          <div className="flex gap-2">
            <button onClick={handleShare} className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center hover:bg-white hover:text-[#062c24] transition-all">
              <i className="fas fa-share-alt text-sm"></i>
            </button>
            {isOwner && (
              <Link href="/store" className="px-3 h-10 bg-emerald-500/20 border border-emerald-400/30 backdrop-blur-md rounded-xl flex items-center justify-center gap-2 text-emerald-300 hover:bg-emerald-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest">
                <i className="fas fa-pen text-[9px]"></i> Edit
              </Link>
            )}
          </div>
        </div>

        {/* Centered profile */}
        <div className="relative z-10 flex flex-col items-center text-center px-6 pt-6 pb-2">
          {/* Logo */}
          <div className="w-20 h-20 bg-white rounded-2xl p-1 shadow-2xl mb-4">
            <img src={vendorData?.image || "/pacak-khemah.png"} className="w-full h-full object-cover rounded-[0.9rem]" alt="logo" />
          </div>

          {/* Tagline block */}
          <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl px-5 py-4 max-w-md w-full mb-4">
            {vendorData?.tagline && (
              <p className="text-sm font-bold text-white leading-relaxed">{vendorData.tagline}</p>
            )}
            {vendorData?.tagline_my && (
              <p className="text-xs font-medium text-emerald-300/80 italic mt-1.5 leading-relaxed">{vendorData.tagline_my}</p>
            )}
          </div>

          {/* Social icons */}
          <div className="flex gap-3 mb-4">
            {vendorData?.ig && <a href={vendorData.ig} target="_blank" rel="noreferrer" className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 transition-colors"><i className="fab fa-instagram text-lg"></i></a>}
            {vendorData?.tiktok && <a href={vendorData.tiktok} target="_blank" rel="noreferrer" className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 transition-colors"><i className="fab fa-tiktok text-lg"></i></a>}
            {vendorData?.fb && <a href={vendorData.fb} target="_blank" rel="noreferrer" className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 transition-colors"><i className="fab fa-facebook text-lg"></i></a>}
          </div>
        </div>

        {/* Name bar + verified badge at bottom of header */}
        <div className="relative z-10 bg-white/5 border-t border-white/10 px-5 py-3 flex items-center justify-between">
          <h1 className="text-base font-black uppercase tracking-tight leading-tight">{vendorData?.name || "Loading..."}</h1>
          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest shrink-0 ml-3">
            <i className="fas fa-check-circle mr-1"></i>Verified
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-4 space-y-3">
        {specialOffer && (
          <div className="bg-gradient-to-r from-red-600 to-orange-500 p-3.5 rounded-2xl text-white text-center shadow-lg relative overflow-hidden">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/cubes.png')" }} />
            <p className="relative z-10 text-[10px] font-black uppercase tracking-widest"><i className="fas fa-fire mr-1"></i> SAVE {specialOffer.discount_percent}% ON STAYS OF {specialOffer.trigger_nights}+ NIGHTS!</p>
          </div>
        )}

        {vendorData?.steps && vendorData.steps.length > 0 && (
          <Section title="How to Rent?" icon="fa-list-ol" defaultOpen={false}>
            <div className="space-y-2">
              {vendorData.steps.map((step, i) => (
                <div key={i} className="flex gap-3 items-start p-3 bg-slate-50 rounded-xl">
                  <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center text-xs font-black shrink-0">{i + 1}</div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase text-[#062c24] leading-tight">
                      {step.title}{step.my && <span className="text-emerald-600 italic font-bold ml-2">{step.my}</span>}
                    </p>
                    {step.desc && <p className="text-[9px] text-slate-500 font-medium mt-0.5 leading-relaxed">{step.desc}</p>}
                    {step.desc_my && <p className="text-[8px] text-slate-400 italic leading-relaxed">{step.desc_my}</p>}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section title="Pick Your Date" icon="fa-calendar-alt" defaultOpen={true}>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[9px] font-black text-emerald-600 uppercase block mb-1.5 ml-1">Pick Up Date</label>
              <input id="checkin-date" readOnly className="w-full bg-slate-50 border border-slate-200 text-xs font-bold text-[#062c24] outline-none text-center py-3.5 rounded-xl focus:ring-2 focus:ring-emerald-500 cursor-pointer" placeholder="Select" />
            </div>
            <div className="flex-1">
              <label className="text-[9px] font-black text-emerald-600 uppercase block mb-1.5 ml-1">Return Date</label>
              <input id="checkout-date" readOnly className="w-full bg-slate-50 border border-slate-200 text-xs font-bold text-[#062c24] outline-none text-center py-3.5 rounded-xl focus:ring-2 focus:ring-emerald-500 cursor-pointer" placeholder="Select" />
            </div>
          </div>
        </Section>

        <Section title="Pick Your Gear" icon="fa-campground" defaultOpen={true}>
          <div className="relative mb-3">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search gear..."
              className="w-full bg-slate-50 border border-slate-200 pl-9 pr-4 py-3 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          {/* Category tabs — active tab filters visible items */}
          <div className="flex rounded-xl bg-slate-100 p-1 mb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {categories.map(cat => (
              <button key={cat}
                onClick={() => setActiveCategory(prev => prev === cat ? null : cat)}
                className={`flex-1 min-w-0 px-3 py-2.5 rounded-lg text-[10px] font-black uppercase whitespace-nowrap transition-all ${
                  (activeCategory === cat || (!activeCategory && categories.length === 1))
                    ? "bg-[#062c24] text-white shadow-sm"
                    : "text-slate-500 hover:text-[#062c24]"
                }`}>
                {cat}
              </button>
            ))}
          </div>

          {/* Gear Grid — shows active category or all */}
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-slate-50 p-3 rounded-2xl border border-slate-100 skeleton" style={{ animationDelay: `${i * 80}ms` }}>
                  <div className="aspect-square rounded-xl bg-slate-200 mb-3"></div>
                  <div className="h-3 w-3/4 bg-slate-200 rounded-full mb-2"></div>
                  <div className="flex justify-between items-center"><div className="h-3 w-12 bg-slate-100 rounded-full"></div><div className="w-8 h-8 bg-slate-100 rounded-full"></div></div>
                </div>
              ))}
            </div>
          ) : (categories.filter(c => !activeCategory || c === activeCategory)).map(cat => {
            const items = filteredGear(cat);
            if (!items.length) return null;
            return (
              <div key={cat} id={`cat-${cat}`} className="mb-4 last:mb-0 scroll-mt-24">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">{cat}</p>
                <div className="grid grid-cols-2 gap-3">
                  {items.map((item, idx) => {
                    const avail = getAvailableStock(item.id);
                    const blocked = avail <= 0;
                    const inCart = cart.find(i => i.id === item.id);
                    return (
                      <div key={item.id} onClick={() => { if (!blocked) { setSelectedItem(item); setShowItemModal(true); } }}
                        className={`relative bg-white p-3 pb-4 rounded-2xl border transition-all stagger-in ${blocked ? "opacity-50 grayscale cursor-not-allowed border-slate-100" : "cursor-pointer border-slate-100 hover:border-emerald-300 hover:shadow-md"}`}
                        style={{ animationDelay: `${idx * 50}ms` }}>
                        <div className="aspect-square rounded-xl overflow-hidden bg-slate-100 mb-2.5 relative">
                          <img src={item.img || "/pacak-khemah.png"} className="w-full h-full object-cover" alt={item.name} />
                          {inCart && <div className="absolute top-2 right-2 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-white text-[9px] font-black shadow">{inCart.qty}</div>}
                        </div>
                        <h4 className="text-[10px] font-black uppercase text-[#062c24] truncate mb-2">{item.name}</h4>
                        <div className="flex justify-between items-center">
                          <p className="text-xs font-black text-emerald-600">RM {item.price}</p>
                          <div className="w-9 h-9 rounded-full flex items-center justify-center bg-[#062c24] text-white shrink-0">
                            <i className="fas fa-plus text-[9px]"></i>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </Section>
      </main>

      {cartCount > 0 && (
        <div className="fixed left-4 right-4 z-[200]" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}>
          <button onClick={() => setShowCart(true)} className="w-full bg-[#062c24] text-white p-4 rounded-2xl shadow-2xl flex justify-between items-center border border-white/10 hover:scale-[1.02] active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center font-black text-lg shadow-inner">{cartCount}</div>
              <div className="text-left">
                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400">View Booking</p>
                <p className="text-xl font-black leading-none">RM {total}</p>
              </div>
            </div>
            <div className="w-11 h-11 bg-white/10 rounded-full flex items-center justify-center"><i className="fas fa-arrow-up"></i></div>
          </button>
        </div>
      )}

      {showItemModal && selectedItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowItemModal(false); }}>
          <div className="bg-white rounded-[2rem] w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl relative" style={{ scrollbarWidth: "none" }}>
            <button onClick={() => setShowItemModal(false)} className="absolute top-5 right-5 w-11 h-11 bg-black/20 rounded-full flex items-center justify-center text-white z-10 hover:bg-black/40 transition-colors"><i className="fas fa-times"></i></button>
            <div className="h-64 w-full"><img src={selectedItem.img || "/pacak-khemah.png"} className="w-full h-full object-cover rounded-t-[2rem]" alt={selectedItem.name} /></div>
            <div className="p-6">
              <h3 className="text-xl font-black text-[#062c24] uppercase mb-1">{selectedItem.name}</h3>
              <p className="text-emerald-600 font-black text-lg mb-4">RM {selectedItem.price} <span className="text-[10px] text-slate-400 font-bold">/ NIGHT</span></p>
              <p className="text-slate-600 text-sm leading-relaxed mb-6">{selectedItem.desc}</p>
              {selectedItem.inc && selectedItem.inc.length > 0 && (
                <div className="mb-6 p-3 bg-slate-50 rounded-xl">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Includes:</p>
                  <div className="flex flex-wrap gap-1.5">{selectedItem.inc.map(inc => (<span key={inc} className="bg-white border border-emerald-100 text-emerald-700 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase">{inc}</span>))}</div>
                </div>
              )}
              <button onClick={() => addToCart(selectedItem)} className="w-full bg-[#062c24] text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">Add to Cart</button>
            </div>
          </div>
        </div>
      )}

      {showCart && (
        <div className="fixed inset-0 bg-[#062c24]/95 backdrop-blur-md z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-50 flex justify-between items-center">
              <h3 className="text-lg font-black text-[#062c24] uppercase">Your Cart</h3>
              <button onClick={() => setShowCart(false)} className="w-11 h-11 rounded-full bg-slate-50 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors"><i className="fas fa-times"></i></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5" style={{ scrollbarWidth: "none" }}>
              <div className="space-y-2">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-[10px] font-black uppercase truncate">{item.name}</p>
                      <p className="text-[9px] font-bold text-slate-400">RM {item.price} × {item.qty} = RM {item.price * item.qty}</p>
                    </div>
                    <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-100 p-1">
                      <button onClick={() => updateCartQty(item.id, -1)} className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors font-black">−</button>
                      <span className="text-xs font-black text-[#062c24] w-5 text-center">{item.qty}</span>
                      <button onClick={() => updateCartQty(item.id, 1)} className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors font-black">+</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-slate-50 p-5 rounded-2xl space-y-2 text-[10px] font-bold uppercase">
                <div className="flex justify-between"><span>Duration</span><span className="text-[#062c24]">{nights} Night{nights > 1 ? "s" : ""}</span></div>
                <div className="flex justify-between"><span>Subtotal</span><span className="text-[#062c24]">RM {sub}</span></div>
                {showAuto && <div className="flex justify-between text-emerald-600"><span>Extended Stay</span><span>− RM {Math.round(autoDisc)}</span></div>}
                {showPromo && <div className="flex justify-between text-emerald-600"><span>Promo Code</span><span>− RM {Math.round(promoDisc)}</span></div>}
                <div className="flex justify-between border-t border-slate-200 pt-3"><span>Security Deposit</span><span className="text-slate-400">RM {Math.round(dep)}</span></div>
                <div className="flex justify-between text-xl font-black text-[#062c24] pt-2"><span>Total</span><span>RM {total}</span></div>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-300 uppercase mb-2 block ml-1">Pickup Point</label>
                <div className="relative">
                  <select value={selectedHub} onChange={e => setSelectedHub(e.target.value)} className="w-full bg-slate-50 p-4 rounded-xl text-xs font-bold outline-none border border-slate-100 appearance-none">
                    {(vendorData?.pickup || [vendorData?.city]).filter(Boolean).map(h => (<option key={h} value={h!}>{h}</option>))}
                  </select>
                  <i className="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input type="text" value={promoInput} onChange={e => setPromoInput(e.target.value.toUpperCase())} placeholder="Promo Code" onKeyDown={e => e.key === "Enter" && applyPromo()}
                  className="col-span-2 bg-slate-50 p-4 rounded-xl text-xs font-bold outline-none border border-slate-100 uppercase tracking-widest" />
                <button onClick={applyPromo} className="bg-indigo-50 text-indigo-600 rounded-xl text-[9px] font-black uppercase hover:bg-indigo-100 transition-colors min-h-[44px]">Apply</button>
              </div>
              {promoMsg && <p className={`text-center text-[10px] font-bold ${promoMsg.success ? "text-emerald-500" : "text-red-500"}`}>{promoMsg.text}</p>}
              <div className="bg-white border border-slate-100 p-4 rounded-xl space-y-3">
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest border-b border-slate-50 pb-2">Rental Policy</p>
                <div className="space-y-2 text-[9px] font-bold text-slate-500 uppercase">{terms}</div>
                <label htmlFor="terms-agree" className="flex gap-3 items-center pt-2 cursor-pointer">
                  <input type="checkbox" id="terms-agree" checked={termsAgreed} onChange={e => setTermsAgreed(e.target.checked)} className="w-5 h-5 accent-emerald-500 rounded shrink-0" />
                  <span className="text-[9px] font-bold text-slate-500 uppercase">I agree to the terms above</span>
                </label>
              </div>
            </div>
            <div className="p-5 bg-slate-50 border-t border-slate-100">
              <button onClick={canOrder ? sendWhatsAppOrder : undefined} disabled={!canOrder}
                className={`w-full py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl transition-all ${canOrder ? "bg-[#062c24] text-white hover:bg-emerald-900 active:scale-95" : "bg-slate-200 text-slate-400 cursor-not-allowed"}`}>
                {!cart.length ? "Add Items to Start" : !selectedDates[0] || !selectedDates[1] ? "Select Pickup & Return Dates" : !termsAgreed ? "Agree to Terms to Proceed" : "Submit Order via WhatsApp 🟢"}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="max-w-4xl mx-auto px-5 pt-8 pb-6">
        <div className="flex justify-center mb-6">
          <Link href="/directory" className="inline-flex items-center gap-3 bg-white border border-slate-200 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-[#062c24] hover:border-emerald-300 hover:shadow-md transition-all group">
            <i className="fas fa-compass text-emerald-500 group-hover:rotate-45 transition-transform"></i>Browse More Vendors<i className="fas fa-arrow-right text-slate-300 group-hover:text-emerald-500 transition-colors"></i>
          </Link>
        </div>
        <div className="border-t border-slate-200 pt-6">
          <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mb-4 text-center">Terms of Service</h4>
          <div className="flex flex-col gap-2 mb-6 text-[9px] font-bold text-slate-400 uppercase">{terms}</div>
        </div>
        <p className="text-[8px] font-bold text-slate-300 uppercase text-center">© 2026 Pacak Khemah. All Rights Reserved</p>
      </footer>

      {showShareToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[500] bg-[#062c24] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-toastIn">
          <i className="fas fa-check-circle text-emerald-400"></i><span className="text-[10px] font-black uppercase tracking-widest">Link Copied!</span>
        </div>
      )}
      {addToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[500] bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-toastIn">
          <i className="fas fa-cart-plus"></i><span className="text-[10px] font-black uppercase tracking-widest">{addToast} Added!</span>
        </div>
      )}

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes toastIn { from { opacity: 0; transform: translate(-50%, -20px); } to { opacity: 1; transform: translate(-50%, 0); } }
        .animate-toastIn { animation: toastIn 0.3s ease-out; }
        @keyframes staggerIn { from { opacity: 0; transform: translateY(16px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .stagger-in { opacity: 0; animation: staggerIn 0.4s ease-out forwards; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .skeleton { background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
      `}</style>
    </div>
  );
}