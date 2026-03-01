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
import BottomNav from "@/components/BottomNav";

// --- TYPES ---
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

// --- BLOCK SCREEN ---
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

// --- MAIN PAGE ---
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
  const [loading, setLoading] = useState(true);
  const cpRef = useRef<any>(null);
  const opRef = useRef<any>(null);

  // --- RESOLVE VENDOR ID ---
  // Priority: ?v= query param (admin override) → slug from URL params
  useEffect(() => {
    const v = searchParams.get("v");
    if (v) {
      setVendorId(v);
    } else if (slug) {
      lookupSlug(slug);
    } else {
      window.location.href = "/directory";
    }
  }, [slug, searchParams]);

  async function lookupSlug(slug: string) {
    try {
      const snap = await getDocs(query(collection(db, "vendors"), where("slug", "==", slug)));
      if (!snap.empty) setVendorId(snap.docs[0].id);
      else window.location.href = "/directory";
    } catch {
      window.location.href = "/directory";
    }
  }

  // --- LOAD SHOP WHEN VENDOR ID IS READY ---
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
      const isOwner = user && user.uid === vData.owner_uid;
      const isApproved = vData.status === "approved";
      const isVacation = vData.is_vacation === true;
      const hasCredits = (vData.credits || 0) > 0;

      if (!isOwner) {
        if (!isApproved) { setBlockState("unapproved"); return; }
        if (isVacation) { setBlockState("vacation"); return; }
        if (!hasCredits) { setBlockState("nocredits"); return; }
      } else if (!isApproved || isVacation) {
        setOwnerPreview(true);
      }

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

  // --- DATE PICKER ---
  useEffect(() => {
    if (!allGear.length) return;
    const blocked = availRules.filter(r => r.type === "block").map(r => ({ from: r.start, to: r.end || r.start }));
    cpRef.current = flatpickr("#checkin-date", {
      minDate: "today", dateFormat: "Y-m-d", disable: blocked,
      onChange: ([d]) => {
        setSelectedDates(prev => [d, prev[1]]);
        opRef.current?.set("minDate", d);
      },
    });
    opRef.current = flatpickr("#checkout-date", {
      minDate: "today", dateFormat: "Y-m-d", disable: blocked,
      onChange: ([d]) => setSelectedDates(prev => [prev[0], d]),
    });
    return () => { cpRef.current?.destroy(); opRef.current?.destroy(); };
  }, [allGear, availRules]);

  // --- SPECIAL OFFER BANNER ---
  const specialOffer = discounts.find(d => d.type === "nightly_discount" && d.is_public !== false);

  // --- STOCK AVAILABILITY ---
  function getAvailableStock(itemId: string) {
    if (!selectedDates[0] || !selectedDates[1]) return 999;
    const item = allGear.find(g => g.id === itemId);
    if (!item) return 0;
    const overlapping = availRules.filter(r =>
      r.itemId === itemId &&
      new Date(r.start) <= selectedDates[1]! &&
      new Date(r.end || r.start) >= selectedDates[0]!
    );
    return Math.max(0, (item.stock || 0) - overlapping.reduce((s, r) => s + (r.qty || 0), 0));
  }

  // --- CART ---
  function addToCart(item: GearItem) {
    setCart(prev => {
      const ex = prev.find(i => i.id === item.id);
      if (ex) return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...item, qty: 1 }];
    });
    setShowItemModal(false);
  }

  function removeFromCart(id: string) {
    setCart(prev => prev.filter(i => i.id !== id));
  }

  function updateCartQty(id: string, delta: number) {
    setCart(prev => prev
      .map(i => i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i)
      .filter(i => i.qty > 0)
    );
  }

  // --- TOTALS ---
  const nights = selectedDates[0] && selectedDates[1]
    ? Math.max(1, Math.ceil((selectedDates[1].getTime() - selectedDates[0].getTime()) / 86400000))
    : 1;
  const dailyTotal = cart.reduce((acc, i) => acc + i.price * i.qty, 0);
  const sub = dailyTotal * nights;

  let autoDisc = 0;
  const rule = discounts
    .filter(d => d.type === "nightly_discount" && (d.trigger_nights ?? 0) <= nights)
    .sort((a, b) => b.discount_percent - a.discount_percent)[0];
  if (rule) {
    const fullNights = (rule.trigger_nights ?? 0) - 1;
    const discNights = nights - fullNights;
    if (discNights > 0) autoDisc = dailyTotal * discNights * (rule.discount_percent / 100);
  }

  const promoDisc = appliedPromo ? sub * (appliedPromo.discount_percent / 100) : 0;
  const allowStacking = vendorData?.allow_stacking === true;
  let finalDiscount = 0, showAuto = false, showPromo = false;
  if (allowStacking) {
    finalDiscount = autoDisc + promoDisc;
    if (autoDisc > 0) showAuto = true;
    if (promoDisc > 0) showPromo = true;
  } else {
    finalDiscount = Math.max(autoDisc, promoDisc);
    if (finalDiscount > 0) {
      if (promoDisc >= autoDisc && promoDisc > 0) showPromo = true;
      else showAuto = true;
    }
  }
  const subAfterDisc = sub - finalDiscount;
  const dep = vendorData?.security_deposit_type === "percent"
    ? subAfterDisc * ((vendorData.security_deposit || 0) / 100)
    : (vendorData?.security_deposit || 50);
  const total = Math.round(subAfterDisc + dep);

  // --- PROMO ---
  function applyPromo() {
    const code = promoInput.trim().toUpperCase();
    const found = discounts.find(d => d.type === "promo_code" && d.code === code);
    if (found) { setAppliedPromo(found); setPromoMsg({ text: `Success! ${found.discount_percent}% Off Applied`, success: true }); }
    else { setAppliedPromo(null); setPromoMsg({ text: "Invalid Code", success: false }); }
  }

  // --- WHATSAPP ORDER ---
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

  // --- CATEGORIES ---
  const categories = Array.from(new Set(
    allGear.map(g => g.category || (g.type === "package" ? "Packages" : "Add-ons"))
  )).sort();

  const filteredGear = (cat: string) => allGear.filter(g =>
    (g.category || (g.type === "package" ? "Packages" : "Add-ons")) === cat &&
    g.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const cartCount = cart.reduce((a, i) => a + i.qty, 0);
  const canOrder = cartCount > 0 && selectedDates[0] && selectedDates[1] && termsAgreed;

  const terms = vendorData?.rules?.map(r => (
    <div key={r} className="flex gap-2 items-start text-left">
      <i className="fas fa-check-circle text-emerald-500 mt-0.5 shrink-0 text-xs"></i>
      <span>{r}</span>
    </div>
  ));

  // --- BLOCK SCREENS ---
  if (blockState === "unapproved") return <BlockScreen message="Hub Building" icon="fa-hard-hat" iconBg="bg-slate-200 text-slate-400" />;
  if (blockState === "vacation") return <BlockScreen message="On Vacation" icon="fa-umbrella-beach" iconBg="bg-blue-400 text-white" />;
  if (blockState === "nocredits") return <BlockScreen message="Hub Unavailable" icon="fa-store-slash" iconBg="bg-red-500 text-white" />;

  const heroBg = vendorData?.image
    ? { backgroundImage: `linear-gradient(rgba(6,44,36,0.85),rgba(6,44,36,0.85)),url(${vendorData.image})` }
    : {};

  return (
    <div className="pb-32" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: "#f8fafc", color: "#0f172a" }}>

      {/* Owner Preview Banner */}
      {ownerPreview && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-amber-400 text-[#062c24] px-4 py-2 rounded-full text-[10px] font-black uppercase shadow-xl z-[200] animate-bounce">
          PREVIEW MODE
        </div>
      )}

      {/* Top Nav */}
      <nav className="fixed top-0 left-0 right-0 z-[100] p-4 flex justify-between items-center pointer-events-none">
        <Link href="/directory" className="pointer-events-auto w-11 h-11 bg-white/20 backdrop-blur-md border border-white/10 rounded-xl flex items-center justify-center text-white hover:bg-white hover:text-[#062c24] transition-all shadow-xl">
          <i className="fas fa-arrow-left"></i>
        </Link>
        <Link href="/store" className="pointer-events-auto px-4 py-2.5 bg-white/20 backdrop-blur-md border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-white hover:text-[#062c24] transition-all shadow-xl flex items-center gap-2">
          <i className="fas fa-store text-emerald-400"></i> Vendor Login
        </Link>
      </nav>

      {/* Hero */}
      <header className="relative h-[50vh] bg-[#062c24] text-white overflow-hidden bg-cover bg-center flex flex-col justify-end pb-8" style={heroBg}>
        <div className="absolute inset-0 bg-gradient-to-t from-[#062c24] via-[#062c24]/60 to-transparent" />
        <div className="relative z-10 px-6 max-w-4xl mx-auto w-full text-center">
          <div className="w-20 h-20 mx-auto bg-white p-1 rounded-[1.5rem] shadow-2xl mb-4 hover:scale-105 transition-transform">
            <img src={vendorData?.image || "/pacak-khemah.png"} className="w-full h-full object-cover rounded-[1.3rem]" alt="logo" />
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight uppercase mb-1">{vendorData?.name || "Loading..."}</h1>
          <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest mb-1">{vendorData?.tagline}</p>
          <p className="text-[9px] font-medium text-white/60 italic mb-4">{vendorData?.tagline_my}</p>
          <div className="flex justify-center items-center gap-2 mb-4">
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest">Verified Hub</span>
          </div>
          <div className="flex justify-center gap-4 text-white/80">
            {vendorData?.ig && <a href={vendorData.ig} target="_blank" rel="noreferrer" className="w-11 h-11 flex items-center justify-center hover:text-emerald-400 transition-colors"><i className="fab fa-instagram text-xl"></i></a>}
            {vendorData?.tiktok && <a href={vendorData.tiktok} target="_blank" rel="noreferrer" className="w-11 h-11 flex items-center justify-center hover:text-emerald-400 transition-colors"><i className="fab fa-tiktok text-xl"></i></a>}
            {vendorData?.fb && <a href={vendorData.fb} target="_blank" rel="noreferrer" className="w-11 h-11 flex items-center justify-center hover:text-emerald-400 transition-colors"><i className="fab fa-facebook text-xl"></i></a>}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 -mt-6 relative z-20 space-y-6">

        {/* Promo Banner */}
        {specialOffer && (
          <div className="bg-gradient-to-r from-red-600 to-orange-500 p-4 rounded-3xl text-white text-center shadow-xl animate-pulse relative overflow-hidden">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/cubes.png')" }} />
            <p className="relative z-10 text-[10px] font-black uppercase tracking-widest">
              SAVE {specialOffer.discount_percent}% ON STAYS OF {specialOffer.trigger_nights}+ NIGHTS!
            </p>
          </div>
        )}

        {/* How-to Steps */}
        {vendorData?.steps && vendorData.steps.length > 0 && (
          <div className="relative overflow-hidden">
            <div className="overflow-x-auto flex gap-3 pb-2 pr-8" style={{ scrollbarWidth: "none" }}>
              {vendorData.steps.map((step, i) => (
                <div key={i} className="shrink-0 w-40 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-start text-left relative hover:border-emerald-300 transition-all">
                  <div className="absolute top-4 right-4 text-[40px] font-black text-slate-100 leading-none">{i + 1}</div>
                  <div className="relative z-10 w-full">
                    <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center text-xs font-black mb-3 border border-emerald-200">{i + 1}</div>
                    <p className="text-[9px] font-black uppercase text-[#062c24] leading-tight mb-0.5">{step.title}</p>
                    <p className="text-[8px] font-bold text-emerald-600 uppercase italic mb-3">{step.my}</p>
                    <p className="text-[8px] text-slate-600 font-medium leading-relaxed">{step.desc}</p>
                    <p className="text-[7px] text-slate-400 italic leading-relaxed">{step.desc_my}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Date Picker */}
        <div className="bg-white p-1 rounded-[2rem] shadow-xl border border-slate-100 flex items-center relative z-30">
          <div className="flex-1 border-r border-slate-100 p-3">
            <label className="text-[8px] font-black text-slate-400 uppercase block mb-1 ml-2">Pickup</label>
            <input id="checkin-date" readOnly className="w-full bg-transparent text-xs font-bold text-[#062c24] outline-none text-center py-1" placeholder="Select Date" />
          </div>
          <div className="flex-1 p-3">
            <label className="text-[8px] font-black text-slate-400 uppercase block mb-1 ml-2">Return</label>
            <input id="checkout-date" readOnly className="w-full bg-transparent text-xs font-bold text-[#062c24] outline-none text-center py-1" placeholder="Select Date" />
          </div>
        </div>

        {/* Search + Category Nav */}
        <div className="sticky top-0 z-40 bg-[#f8fafc]/95 backdrop-blur-xl py-2 -mx-4 px-4 border-b border-slate-100/50 space-y-3">
          <div className="relative">
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search gear..."
              className="w-full bg-white border border-slate-200 pl-10 pr-4 py-3 rounded-xl text-xs font-bold shadow-sm outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div className="overflow-x-auto flex gap-2" style={{ scrollbarWidth: "none" }}>
            {categories.map(cat => (
              <button key={cat}
                onClick={() => document.getElementById(`cat-${cat}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                className="shrink-0 px-4 py-2.5 bg-white border border-slate-100 rounded-xl text-[10px] font-black uppercase text-slate-500 shadow-sm whitespace-nowrap min-h-[44px]">
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Inventory */}
        <div className="space-y-6 pb-20">
          {loading ? (
            <div className="text-center py-20 text-slate-400 text-sm font-bold uppercase animate-pulse">Loading...</div>
          ) : categories.map(cat => {
            const items = filteredGear(cat);
            if (!items.length) return null;
            return (
              <div key={cat} id={`cat-${cat}`} className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm scroll-mt-24">
                <div className="p-5 bg-white border-b border-slate-50">
                  <span className="text-xs font-black text-[#062c24] uppercase tracking-widest">{cat}</span>
                </div>
                <div className="bg-slate-50 p-4 grid grid-cols-2 gap-3">
                  {items.map(item => {
                    const avail = getAvailableStock(item.id);
                    const blocked = avail <= 0;
                    const inCart = cart.find(i => i.id === item.id);
                    return (
                      <div key={item.id}
                        onClick={() => { if (!blocked) { setSelectedItem(item); setShowItemModal(true); } }}
                        className={`relative bg-white p-3 rounded-2xl border transition-all ${blocked ? "opacity-50 grayscale cursor-not-allowed border-slate-100" : "cursor-pointer border-slate-100 hover:border-emerald-300 hover:shadow-md"}`}>
                        <div className="aspect-square rounded-xl overflow-hidden bg-slate-100 mb-3 relative">
                          <img src={item.img || "/pacak-khemah.png"} className="w-full h-full object-cover" alt={item.name} />
                          {inCart && (
                            <div className="absolute top-2 right-2 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-white text-[9px] font-black shadow">
                              {inCart.qty}
                            </div>
                          )}
                        </div>
                        <h4 className="text-[10px] font-black uppercase text-[#062c24] truncate mb-1">{item.name}</h4>
                        <div className="flex justify-between items-center">
                          <p className="text-[10px] font-black text-emerald-600">RM {item.price}</p>
                          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[#062c24] text-white">
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
        </div>
      </main>

      {/* ✅ PRIORITY #2 — iOS safe area floating cart bar */}
      {cartCount > 0 && (
        <div
          className="fixed left-4 right-4 z-[200]"
          style={{
            bottom: `calc(env(safe-area-inset-bottom, 0px) + 5.5rem)`,
          }}
        >
          <button onClick={() => setShowCart(true)}
            className="w-full bg-[#062c24] text-white p-4 rounded-[2rem] shadow-2xl flex justify-between items-center border border-white/10 hover:scale-[1.02] active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center font-black text-lg shadow-inner">{cartCount}</div>
              <div className="text-left">
                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400">View Booking</p>
                <p className="text-xl font-black leading-none">RM {total}</p>
              </div>
            </div>
            <div className="w-11 h-11 bg-white/10 rounded-full flex items-center justify-center">
              <i className="fas fa-arrow-up"></i>
            </div>
          </button>
        </div>
      )}

      {/* Item Modal */}
      {showItemModal && selectedItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowItemModal(false); }}>
          <div className="bg-white rounded-[3rem] w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl relative" style={{ scrollbarWidth: "none" }}>
            <button onClick={() => setShowItemModal(false)}
              className="absolute top-6 right-6 w-11 h-11 bg-black/20 rounded-full flex items-center justify-center text-white z-10 hover:bg-black/40 transition-colors">
              <i className="fas fa-times"></i>
            </button>
            <div className="h-72 w-full">
              <img src={selectedItem.img || "/pacak-khemah.png"} className="w-full h-full object-cover rounded-t-[3rem]" alt={selectedItem.name} />
            </div>
            <div className="p-8">
              <h3 className="text-2xl font-black text-[#062c24] uppercase mb-1">{selectedItem.name}</h3>
              <p className="text-emerald-600 font-black text-xl mb-6">
                RM {selectedItem.price} <span className="text-[10px] text-slate-400 font-bold">/ NIGHT</span>
              </p>
              <p className="text-slate-600 text-sm leading-relaxed mb-8">{selectedItem.desc}</p>
              {selectedItem.inc && selectedItem.inc.length > 0 && (
                <div className="mb-8 p-4 bg-slate-50 rounded-2xl">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-3">Includes:</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedItem.inc.map(inc => (
                      <span key={inc} className="bg-white border border-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase">{inc}</span>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={() => addToCart(selectedItem)}
                className="w-full bg-[#062c24] text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Modal */}
      {showCart && (
        <div className="fixed inset-0 bg-[#062c24]/95 backdrop-blur-md z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center">
              <h3 className="text-xl font-black text-[#062c24] uppercase">Your Cart</h3>
              {/* ✅ PRIORITY #3 — 44px close button */}
              <button onClick={() => setShowCart(false)}
                className="w-11 h-11 rounded-full bg-slate-50 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6" style={{ scrollbarWidth: "none" }}>
              {/* Cart Items with qty controls */}
              <div className="space-y-3">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-[10px] font-black uppercase truncate">{item.name}</p>
                      <p className="text-[9px] font-bold text-slate-400">RM {item.price} × {item.qty} = RM {item.price * item.qty}</p>
                    </div>
                    {/* ✅ PRIORITY #3 — 44px qty buttons */}
                    <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-100 p-1">
                      <button onClick={() => updateCartQty(item.id, -1)}
                        className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors font-black">
                        −
                      </button>
                      <span className="text-xs font-black text-[#062c24] w-5 text-center">{item.qty}</span>
                      <button onClick={() => updateCartQty(item.id, 1)}
                        className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors font-black">
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="bg-slate-50 p-6 rounded-[2rem] space-y-2 text-[10px] font-bold uppercase">
                <div className="flex justify-between"><span>Duration</span><span className="text-[#062c24]">{nights} Night{nights > 1 ? "s" : ""}</span></div>
                <div className="flex justify-between"><span>Subtotal</span><span className="text-[#062c24]">RM {sub}</span></div>
                {showAuto && <div className="flex justify-between text-emerald-600"><span>Extended Stay</span><span>− RM {Math.round(autoDisc)}</span></div>}
                {showPromo && <div className="flex justify-between text-emerald-600"><span>Promo Code</span><span>− RM {Math.round(promoDisc)}</span></div>}
                <div className="flex justify-between border-t border-slate-200 pt-3">
                  <span>Security Deposit</span><span className="text-slate-400">RM {Math.round(dep)}</span>
                </div>
                <div className="flex justify-between text-xl font-black text-[#062c24] pt-2">
                  <span>Total</span><span>RM {total}</span>
                </div>
              </div>

              {/* Pickup Hub */}
              <div>
                <label className="text-[9px] font-black text-slate-300 uppercase mb-2 block ml-1">Pickup Point</label>
                <div className="relative">
                  <select value={selectedHub} onChange={e => setSelectedHub(e.target.value)}
                    className="w-full bg-slate-50 p-4 rounded-2xl text-xs font-bold outline-none border border-slate-100 appearance-none">
                    {(vendorData?.pickup || [vendorData?.city]).filter(Boolean).map(h => (
                      <option key={h} value={h!}>{h}</option>
                    ))}
                  </select>
                  <i className="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
                </div>
              </div>

              {/* Promo Code */}
              <div className="grid grid-cols-3 gap-2">
                <input type="text" value={promoInput} onChange={e => setPromoInput(e.target.value.toUpperCase())}
                  placeholder="Promo Code" onKeyDown={e => e.key === "Enter" && applyPromo()}
                  className="col-span-2 bg-slate-50 p-4 rounded-2xl text-xs font-bold outline-none border border-slate-100 uppercase tracking-widest" />
                <button onClick={applyPromo}
                  className="bg-indigo-50 text-indigo-600 rounded-2xl text-[9px] font-black uppercase hover:bg-indigo-100 transition-colors min-h-[44px]">
                  Apply
                </button>
              </div>
              {promoMsg && (
                <p className={`text-center text-[10px] font-bold ${promoMsg.success ? "text-emerald-500" : "text-red-500"}`}>
                  {promoMsg.text}
                </p>
              )}

              {/* Terms */}
              <div className="bg-white border border-slate-100 p-4 rounded-2xl space-y-3">
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest border-b border-slate-50 pb-2">Rental Policy</p>
                <div className="space-y-2 text-[9px] font-bold text-slate-500 uppercase">{terms}</div>
                <label htmlFor="terms-agree" className="flex gap-3 items-center pt-2 cursor-pointer">
                  <input type="checkbox" id="terms-agree" checked={termsAgreed} onChange={e => setTermsAgreed(e.target.checked)}
                    className="w-5 h-5 accent-emerald-500 rounded shrink-0" />
                  <span className="text-[9px] font-bold text-slate-500 uppercase">I agree to the terms above</span>
                </label>
              </div>
            </div>

            {/* CTA */}
            <div className="p-6 bg-slate-50 border-t border-slate-100">
              <button onClick={canOrder ? sendWhatsAppOrder : undefined} disabled={!canOrder}
                className={`w-full py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl transition-all ${canOrder ? "bg-[#062c24] text-white hover:bg-emerald-900 active:scale-95" : "bg-slate-200 text-slate-400 cursor-not-allowed"}`}>
                {!cart.length ? "Add Items to Start"
                  : !selectedDates[0] || !selectedDates[1] ? "Select Pickup & Return Dates"
                  : !termsAgreed ? "Agree to Terms to Proceed"
                  : "Submit Order via WhatsApp 🟢"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-6 py-12 border-t border-slate-100 text-left">
        <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mb-6">Terms of Service</h4>
        <div className="flex flex-col gap-3 mb-10 text-[9px] font-bold text-slate-400 uppercase">{terms}</div>
        <p className="text-[8px] font-bold text-slate-300 uppercase text-center mt-12">© 2026 Pacak Khemah. All Rights Reserved</p>
      </footer>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <BottomNav />
    </div>
  );
}