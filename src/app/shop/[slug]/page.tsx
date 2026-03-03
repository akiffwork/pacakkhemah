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

// ============ TYPES ============
type VendorData = {
  name: string; tagline?: string; tagline_my?: string; image?: string;
  ig?: string; tiktok?: string; fb?: string; phone?: string; threads?: string;
  pickup?: string[]; city?: string; areas?: string[]; rules?: string[];
  steps?: { title: string; my: string; desc?: string; desc_my?: string }[];
  status?: string; is_vacation?: boolean; credits?: number;
  owner_uid?: string; show_nav?: boolean;
  security_deposit?: number; security_deposit_type?: string;
  allow_stacking?: boolean;
  rating?: number; reviewCount?: number;
};
type GearItem = {
  id: string; name: string; price: number; img?: string;
  desc?: string; category?: string; type?: string;
  stock?: number; inc?: string[]; deleted?: boolean;
};
type CartItem = GearItem & { qty: number };
type AvailRule = { itemId?: string; type?: string; start: string; end?: string; qty?: number };
type Discount = { type: string; trigger_nights?: number; discount_percent: number; code?: string; deleted?: boolean; is_public?: boolean };
type VendorPost = { id: string; content: string; image?: string; pinned?: boolean; createdAt: any };

// ============ FIREWOOD RATING COMPONENT ============
function FirewoodRating({ rating, size = "md" }: { rating: number; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: 40, md: 60, lg: 90 };
  const s = sizes[size];
  const roundedRating = Math.round(rating);
  const flameOpacity = 0.4 + (rating / 5) * 0.6;
  const flameScale = 0.6 + (rating / 5) * 0.4;
  const glowIntensity = Math.round((rating / 5) * 15);

  const logPositions = [
    { x: 5, y: 75, rotation: -5, log: 1 },
    { x: 25, y: 78, rotation: 0, log: 2 },
    { x: 45, y: 75, rotation: 5, log: 3 },
    { x: 12, y: 58, rotation: 20, log: 4 },
    { x: 38, y: 58, rotation: -20, log: 5 },
  ];

  return (
    <svg width={s} height={s} viewBox="0 0 80 90" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="flameGrad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#ff4500" />
          <stop offset="30%" stopColor="#ff6600" />
          <stop offset="60%" stopColor="#ff8c00" />
          <stop offset="100%" stopColor="#ffa500" />
        </linearGradient>
        <linearGradient id="flameInner" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#ffd700" />
          <stop offset="50%" stopColor="#ffec8b" />
          <stop offset="100%" stopColor="#fffacd" />
        </linearGradient>
        <radialGradient id="emberGrad">
          <stop offset="0%" stopColor="#ff4500" />
          <stop offset="60%" stopColor="#ff6600" stopOpacity="0.5" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>

      {roundedRating > 0 && (
        <ellipse cx="40" cy="80" rx={12 + roundedRating * 3} ry="5" fill="url(#emberGrad)" style={{ opacity: 0.3 + (rating / 5) * 0.5 }} />
      )}

      {roundedRating > 0 && (
        <g transform={`translate(40, 28) scale(${flameScale})`} style={{ filter: `drop-shadow(0 0 ${glowIntensity}px rgba(255,100,0,0.8))` }}>
          <path d="M0 28 C-10 18 -14 6 -7 -12 C-5 -6 -2 0 0 -6 C2 0 5 -6 7 -12 C14 6 10 18 0 28Z" fill="url(#flameGrad)" className="animate-pulse" style={{ opacity: flameOpacity }} />
          <path d="M0 24 C-5 16 -7 9 -4 0 C-2 6 0 4 0 -2 C0 4 2 6 4 0 C7 9 5 16 0 24Z" fill="url(#flameInner)" className="animate-pulse" />
          <path d="M0 18 C-2 12 -3 6 -1 2 C0 5 0 3 0 1 C0 3 0 5 1 2 C3 6 2 12 0 18Z" fill="#fff8dc" className="animate-pulse" style={{ opacity: 0.8 }} />
        </g>
      )}

      {logPositions.map((pos, idx) => {
        const isActive = pos.log <= roundedRating;
        const logColor = isActive ? "#8B4513" : "#4a4a4a";
        const logColorDark = isActive ? "#654321" : "#3a3a3a";
        const endColor = isActive ? "#D2691E" : "#5a5a5a";
        return (
          <g key={idx} transform={`translate(${pos.x}, ${pos.y}) rotate(${pos.rotation})`} style={{ opacity: isActive ? 1 : 0.3 }}>
            <ellipse cx="10" cy="4" rx="12" ry="5" fill={logColor} />
            <rect x="-2" y="-1" width="24" height="10" rx="2" fill={logColor} />
            <ellipse cx="10" cy="4" rx="10" ry="4" fill={logColorDark} />
            <ellipse cx="-2" cy="4" rx="5" ry="5" fill={endColor} />
            <ellipse cx="-2" cy="4" rx="3" ry="3" fill={logColorDark} />
            <ellipse cx="-2" cy="4" rx="1.5" ry="1.5" fill={endColor} style={{ opacity: 0.7 }} />
          </g>
        );
      })}
    </svg>
  );
}

// ============ BLOCK SCREEN ============
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

// ============ COLLAPSIBLE SECTION ============
function Section({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors">
        <span className="text-sm font-black text-[#062c24] uppercase tracking-wide">{title}</span>
        <i className={`fas fa-chevron-down text-slate-300 text-xs transition-transform duration-300 ${open ? "rotate-180" : ""}`}></i>
      </button>
      <div className={`transition-all duration-300 ease-out ${open ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0 overflow-hidden"}`}>
        <div className="px-4 pb-4">{children}</div>
      </div>
    </div>
  );
}

// ============ VENDOR POST COMPONENT ============
function VendorPostCard({ post }: { post: VendorPost }) {
  const timeAgo = post.createdAt?.toDate ? formatTimeAgo(post.createdAt.toDate()) : "Just now";
  return (
    <div className={`p-4 rounded-xl border transition-all ${post.pinned ? "bg-amber-50/50 border-amber-200" : "bg-slate-50 border-slate-100"}`}>
      {post.pinned && (
        <div className="flex items-center gap-1.5 text-amber-600 text-[9px] font-black uppercase mb-2">
          <i className="fas fa-thumbtack"></i><span>Pinned</span>
        </div>
      )}
      <p className="text-sm text-slate-700 leading-relaxed">{post.content}</p>
      {post.image && (
        <div className="mt-3 rounded-xl overflow-hidden">
          <img src={post.image} alt="" className="w-full h-40 object-cover" />
        </div>
      )}
      <p className="text-[10px] text-slate-400 mt-3">{timeAgo}</p>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return date.toLocaleDateString();
}

// ============ MAIN SHOP PAGE ============
export default function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const searchParams = useSearchParams();
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;

  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorData, setVendorData] = useState<VendorData | null>(null);
  const [allGear, setAllGear] = useState<GearItem[]>([]);
  const [availRules, setAvailRules] = useState<AvailRule[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [posts, setPosts] = useState<VendorPost[]>([]);
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
  const [activeTab, setActiveTab] = useState<"gear" | "updates" | "reviews">("gear");
  const cpRef = useRef<any>(null);
  const opRef = useRef<any>(null);

  // Toast timers
  useEffect(() => {
    if (showShareToast) { const t = setTimeout(() => setShowShareToast(false), 2000); return () => clearTimeout(t); }
  }, [showShareToast]);
  useEffect(() => {
    if (addToast) { const t = setTimeout(() => setAddToast(null), 2000); return () => clearTimeout(t); }
  }, [addToast]);

  // Slug lookup
  useEffect(() => {
    const v = searchParams.get("v");
    if (v) setVendorId(v);
    else if (slug) lookupSlug(slug);
    else window.location.href = "/directory";
  }, [slug, searchParams]);

  async function lookupSlug(slug: string) {
    try {
      const snap = await getDocs(query(collection(db, "vendors"), where("slug", "==", slug)));
      if (!snap.empty) setVendorId(snap.docs[0].id);
      else window.location.href = "/directory";
    } catch { window.location.href = "/directory"; }
  }

  // Load shop data
  useEffect(() => {
    if (!vendorId) return;
    const unsub = onAuthStateChanged(auth, () => loadShop());
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
      } else if (!isApproved || isVacation) setOwnerPreview(true);

      const [gearSnap, availSnap, discSnap, postsSnap] = await Promise.all([
        getDocs(query(collection(db, "gear"), where("vendorId", "==", vendorId))),
        getDocs(collection(db, "vendors", vendorId, "availability")),
        getDocs(collection(db, "vendors", vendorId, "discounts")),
        getDocs(collection(db, "vendors", vendorId, "posts")),
      ]);

      setAllGear(gearSnap.docs.map(d => ({ id: d.id, ...d.data() } as GearItem)).filter(g => !g.deleted));
      setAvailRules(availSnap.docs.map(d => d.data() as AvailRule));
      setDiscounts(discSnap.docs.map(d => d.data() as Discount).filter(d => !d.deleted));
      setPosts(postsSnap.docs.map(d => ({ id: d.id, ...d.data() } as VendorPost)).sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      }));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  // Date pickers
  useEffect(() => {
    if (!vendorData) return;
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
  }, [vendorData, availRules]);

  // Calculations
  const specialOffer = discounts.find(d => d.type === "nightly_discount" && d.is_public !== false);
  const categories = Array.from(new Set(allGear.map(g => g.category || (g.type === "package" ? "Packages" : "Add-ons")))).sort();
  const filteredGear = (cat: string) => allGear.filter(g => (g.category || (g.type === "package" ? "Packages" : "Add-ons")) === cat && g.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const cartCount = cart.reduce((a, i) => a + i.qty, 0);

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
  }

  function updateCartQty(id: string, delta: number) {
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0));
  }

  // Pricing
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
  const canOrder = cartCount > 0 && selectedDates[0] && selectedDates[1] && termsAgreed;

  function applyPromo() {
    const code = promoInput.trim().toUpperCase();
    const found = discounts.find(d => d.type === "promo_code" && d.code === code);
    if (found) { setAppliedPromo(found); setPromoMsg({ text: `Success! ${found.discount_percent}% Off`, success: true }); }
    else { setAppliedPromo(null); setPromoMsg({ text: "Invalid Code", success: false }); }
  }

  async function sendWhatsAppOrder() {
    let discText = "";
    if (showAuto) discText += "(Extended Stay Discount) ";
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

  function handleShare(itemId?: string) {
    const url = itemId ? `${window.location.href}?item=${itemId}` : window.location.href;
    const title = itemId ? allGear.find(g => g.id === itemId)?.name : vendorData?.name;
    if (navigator.share) navigator.share({ title: title || "Shop", url }).catch(() => {});
    else { navigator.clipboard.writeText(url); setShowShareToast(true); }
  }

  const terms = vendorData?.rules?.map(r => (
    <div key={r} className="flex gap-2 items-start text-left">
      <i className="fas fa-check-circle text-emerald-500 mt-0.5 shrink-0 text-xs"></i>
      <span>{r}</span>
    </div>
  ));

  // Block states
  if (blockState === "unapproved") return <BlockScreen message="Hub Building" icon="fa-hard-hat" iconBg="bg-slate-200 text-slate-400" />;
  if (blockState === "vacation") return <BlockScreen message="On Vacation" icon="fa-umbrella-beach" iconBg="bg-blue-400 text-white" />;
  if (blockState === "nocredits") return <BlockScreen message="Hub Unavailable" icon="fa-store-slash" iconBg="bg-red-500 text-white" />;

  const rating = vendorData?.rating || 4.5;
  const reviewCount = vendorData?.reviewCount || 0;

  return (
    <div className="pb-8 min-h-screen" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: "#f0f2f1", color: "#0f172a" }}>
      {ownerPreview && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-amber-400 text-[#062c24] px-4 py-2 rounded-full text-[10px] font-black uppercase shadow-xl z-[200] animate-bounce">PREVIEW MODE</div>
      )}

      {/* ========== HERO HEADER ========== */}
      <header className="bg-[#062c24] text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 0 L40 20 L20 40 L0 20 Z' fill='none' stroke='%23ffffff' stroke-width='1'/%3E%3C/svg%3E")`, backgroundSize: "25px 25px" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#062c24]/30 to-[#062c24]" />

        {/* Nav */}
        <div className="relative z-10 flex justify-between items-center px-4 pt-4">
          <Link href="/directory" className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center hover:bg-white hover:text-[#062c24] transition-all">
            <i className="fas fa-arrow-left text-sm"></i>
          </Link>
          <div className="flex gap-2">
            <button onClick={() => handleShare()} className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center hover:bg-white hover:text-[#062c24] transition-all">
              <i className="fas fa-share-alt text-sm"></i>
            </button>
            {isOwner && (
              <Link href="/store" className="px-3 h-10 bg-emerald-500/20 border border-emerald-400/30 backdrop-blur-md rounded-xl flex items-center justify-center gap-2 text-emerald-300 hover:bg-emerald-500 hover:text-white transition-all text-[10px] font-black uppercase">
                <i className="fas fa-pen text-[9px]"></i> Edit
              </Link>
            )}
          </div>
        </div>

        {/* Profile */}
        <div className="relative z-10 flex flex-col items-center text-center px-6 pt-4 pb-6">
          <div className="relative mb-4">
            <div className="w-24 h-24 bg-white rounded-full p-1.5 shadow-2xl ring-4 ring-white/20">
              <img src={vendorData?.image || "/pacak-khemah.png"} className="w-full h-full object-cover rounded-full" alt={vendorData?.name} />
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white shadow-lg">
              <i className="fas fa-check text-white text-xs"></i>
            </div>
          </div>

          <h1 className="text-xl font-black uppercase tracking-tight mb-1">{vendorData?.name || "Loading..."}</h1>

          <div className="flex items-center gap-3 text-sm mb-4">
            <span className="flex items-center gap-1.5 text-emerald-300">
              <i className="fas fa-map-marker-alt text-xs"></i>
              <span className="font-medium">Based in {vendorData?.city}</span>
            </span>
            <span className="text-white/30">•</span>
            <div className="flex items-center gap-1">
              <FirewoodRating rating={rating} size="sm" />
              <span className="text-emerald-300 font-bold text-xs ml-1">({reviewCount})</span>
            </div>
          </div>

          {/* Info Pills */}
          <div className="flex flex-wrap justify-center gap-2 text-[10px] font-bold uppercase mb-4">
            <span className="bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
              <i className="fas fa-truck text-emerald-400 mr-1.5"></i>Pickup at {vendorData?.pickup?.join(", ") || vendorData?.city}
            </span>
            {vendorData?.areas && (
              <span className="bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
                <i className="fas fa-map text-emerald-400 mr-1.5"></i>Covers {vendorData.areas.join(", ")}
              </span>
            )}
          </div>

          {/* Social Icons */}
          <div className="flex items-center justify-center gap-2">
            {vendorData?.phone && (
              <a href={`https://wa.me/${vendorData.phone}`} target="_blank" rel="noreferrer" className="w-8 h-8 bg-white/10 backdrop-blur-sm rounded-lg flex items-center justify-center hover:bg-emerald-500 transition-all border border-white/10">
                <i className="fab fa-whatsapp text-sm"></i>
              </a>
            )}
            {vendorData?.tiktok && (
              <a href={vendorData.tiktok} target="_blank" rel="noreferrer" className="w-8 h-8 bg-white/10 backdrop-blur-sm rounded-lg flex items-center justify-center hover:bg-white hover:text-black transition-all border border-white/10">
                <i className="fab fa-tiktok text-sm"></i>
              </a>
            )}
            {vendorData?.ig && (
              <a href={vendorData.ig} target="_blank" rel="noreferrer" className="w-8 h-8 bg-white/10 backdrop-blur-sm rounded-lg flex items-center justify-center hover:bg-gradient-to-br hover:from-purple-500 hover:via-pink-500 hover:to-orange-400 transition-all border border-white/10">
                <i className="fab fa-instagram text-sm"></i>
              </a>
            )}
            {vendorData?.threads && (
              <a href={vendorData.threads} target="_blank" rel="noreferrer" className="w-8 h-8 bg-white/10 backdrop-blur-sm rounded-lg flex items-center justify-center hover:bg-white hover:text-black transition-all border border-white/10">
                <i className="fab fa-threads text-sm"></i>
              </a>
            )}
            {vendorData?.fb && (
              <a href={vendorData.fb} target="_blank" rel="noreferrer" className="w-8 h-8 bg-white/10 backdrop-blur-sm rounded-lg flex items-center justify-center hover:bg-blue-600 transition-all border border-white/10">
                <i className="fab fa-facebook-f text-sm"></i>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* ========== MAIN CONTENT ========== */}
      <main className="max-w-2xl mx-auto px-4 -mt-3 relative z-20 space-y-3">
        {/* Special Offer Banner */}
        {specialOffer && (
          <div className="bg-gradient-to-r from-red-600 to-orange-500 p-3.5 rounded-2xl text-white text-center shadow-lg relative overflow-hidden">
            <p className="relative z-10 text-[10px] font-black uppercase tracking-widest">
              <i className="fas fa-fire mr-1"></i> SAVE {specialOffer.discount_percent}% ON STAYS OF {specialOffer.trigger_nights}+ NIGHTS!
            </p>
          </div>
        )}

        {/* About Section */}
        {vendorData?.tagline && (
          <Section title="About Us?" defaultOpen={false}>
            <p className="text-sm text-slate-700 leading-relaxed font-medium">{vendorData.tagline}</p>
            {vendorData.tagline_my && <p className="text-xs text-slate-500 italic leading-relaxed mt-2">{vendorData.tagline_my}</p>}
          </Section>
        )}

        {/* How to Rent */}
        {vendorData?.steps && vendorData.steps.length > 0 && (
          <Section title="How to Rent?" defaultOpen={false}>
            <div className="space-y-2">
              {vendorData.steps.map((step, i) => (
                <div key={i} className="flex gap-3 items-start p-3 bg-slate-50 rounded-xl">
                  <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center text-xs font-black shrink-0">{i + 1}</div>
                  <div>
                    <p className="text-xs font-black uppercase text-[#062c24]">
                      {step.title}
                      {step.my && <span className="text-emerald-600 font-bold ml-2 normal-case italic">{step.my}</span>}
                    </p>
                    {step.desc && <p className="text-[11px] text-slate-500 mt-0.5">{step.desc}</p>}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Tab Navigation */}
        <div className="flex bg-white rounded-2xl p-1.5 border border-slate-100 shadow-sm">
          {([
            { id: "gear" as const, label: "Gear", icon: "fa-campground", badge: 0 },
            { id: "updates" as const, label: "Updates", icon: "fa-bullhorn", badge: posts.length },
            { id: "reviews" as const, label: "Reviews", icon: "fa-fire", badge: reviewCount },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase transition-all ${activeTab === tab.id ? "bg-[#062c24] text-white shadow-lg" : "text-slate-400 hover:text-slate-600"}`}
            >
              <i className={`fas ${tab.icon} text-[10px]`}></i>
              <span>{tab.label}</span>
              {tab.badge > 0 && (
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? "bg-white/20" : "bg-slate-100"}`}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* GEAR TAB */}
        {activeTab === "gear" && (
          <div className="space-y-3">
            <Section title="Pick Your Date" defaultOpen={true}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black text-emerald-600 uppercase block mb-1.5">Pickup</label>
                  <input id="checkin-date" readOnly className="w-full bg-slate-50 border border-slate-200 px-3 py-3.5 rounded-xl text-xs font-bold text-center outline-none focus:border-emerald-500 cursor-pointer" placeholder="Select" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-emerald-600 uppercase block mb-1.5">Return</label>
                  <input id="checkout-date" readOnly className="w-full bg-slate-50 border border-slate-200 px-3 py-3.5 rounded-xl text-xs font-bold text-center outline-none focus:border-emerald-500 cursor-pointer" placeholder="Select" />
                </div>
              </div>
            </Section>

            <Section title="Pick Your Gear" defaultOpen={true}>
              <div className="relative mb-3">
                <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
                <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search gear..." className="w-full bg-slate-50 border border-slate-200 pl-9 pr-4 py-3 rounded-xl text-xs font-bold outline-none focus:border-emerald-500" />
              </div>

              {loading ? (
                <div className="grid grid-cols-2 gap-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-slate-100 rounded-2xl aspect-square animate-pulse"></div>
                  ))}
                </div>
              ) : categories.map(cat => {
                const items = filteredGear(cat);
                if (!items.length) return null;
                return (
                  <div key={cat} className="mb-6 last:mb-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{cat}</p>
                    <div className="grid grid-cols-2 gap-3">
                      {items.map(item => {
                        const avail = getAvailableStock(item.id);
                        const blocked = avail <= 0;
                        const inCart = cart.find(i => i.id === item.id);
                        return (
                          <div
                            key={item.id}
                            onClick={() => { if (!blocked) { setSelectedItem(item); setShowItemModal(true); } }}
                            className={`bg-white rounded-2xl border overflow-hidden cursor-pointer group transition-all ${blocked ? "opacity-50 grayscale border-slate-100" : "border-slate-100 hover:border-emerald-300 hover:shadow-lg"}`}
                          >
                            <div className="aspect-square relative overflow-hidden">
                              <img src={item.img || "/pacak-khemah.png"} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={item.name} />
                              {inCart && <div className="absolute top-2 right-2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white text-[10px] font-black shadow-lg">{inCart.qty}</div>}
                              <button onClick={e => { e.stopPropagation(); handleShare(item.id); }} className="absolute top-2 left-2 w-7 h-7 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-emerald-600">
                                <i className="fas fa-share-alt text-[10px]"></i>
                              </button>
                            </div>
                            <div className="p-3">
                              <h4 className="text-[11px] font-black uppercase text-[#062c24] truncate mb-1">{item.name}</h4>
                              <div className="flex justify-between items-center">
                                <p className="text-sm font-black text-emerald-600">RM {item.price}</p>
                                <button onClick={e => { e.stopPropagation(); if (!blocked) addToCart(item); }} className="w-8 h-8 bg-[#062c24] text-white rounded-full flex items-center justify-center hover:bg-emerald-700 transition-colors">
                                  <i className="fas fa-plus text-[10px]"></i>
                                </button>
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
          </div>
        )}

        {/* UPDATES TAB */}
        {activeTab === "updates" && (
          <div className="bg-white rounded-2xl border border-slate-100 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-[#062c24] uppercase">From the Vendor</h3>
              <span className="text-[9px] font-bold text-slate-400">{posts.length} updates</span>
            </div>
            {posts.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-bullhorn text-slate-300 text-xl"></i>
                </div>
                <p className="text-sm font-bold text-slate-400">No updates yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map(post => <VendorPostCard key={post.id} post={post} />)}
              </div>
            )}
          </div>
        )}

        {/* REVIEWS TAB */}
        {activeTab === "reviews" && (
          <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center">
            <div className="flex justify-center mb-2">
              <FirewoodRating rating={rating} size="lg" />
            </div>
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="text-3xl font-black text-[#062c24]">{rating}</span>
              <span className="text-sm font-bold text-slate-400">/ 5</span>
            </div>
            <p className="text-xs text-slate-400 font-bold uppercase">Based on {reviewCount} reviews</p>

            <div className="mt-8 p-6 bg-slate-50 rounded-2xl">
              <p className="text-sm font-bold text-slate-600 mb-2">Share Your Experience</p>
              <p className="text-xs text-slate-400 mb-4">Help others by rating this vendor!</p>
              <button className="bg-[#062c24] text-white px-6 py-3 rounded-xl text-xs font-black uppercase hover:bg-emerald-800 transition-colors">
                <i className="fas fa-fire mr-2"></i>Write Review
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Floating Cart */}
      {cartCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-50 max-w-2xl mx-auto">
          <button onClick={() => setShowCart(true)} className="w-full bg-[#062c24] text-white p-4 rounded-2xl shadow-2xl flex justify-between items-center border border-white/10 hover:scale-[1.02] active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center font-black text-lg shadow-inner">{cartCount}</div>
              <div className="text-left">
                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400">View Booking</p>
                <p className="text-xl font-black">RM {total}</p>
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={() => setShowItemModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="relative h-64">
              <img src={selectedItem.img || "/pacak-khemah.png"} alt={selectedItem.name} className="w-full h-full object-cover" />
              <button onClick={() => setShowItemModal(false)} className="absolute top-4 right-4 w-10 h-10 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white">
                <i className="fas fa-times"></i>
              </button>
              <button onClick={() => handleShare(selectedItem.id)} className="absolute top-4 left-4 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center text-slate-500 hover:text-emerald-600">
                <i className="fas fa-share-alt text-sm"></i>
              </button>
            </div>
            <div className="p-6">
              <h3 className="text-xl font-black text-[#062c24] uppercase mb-1">{selectedItem.name}</h3>
              <p className="text-emerald-600 font-black text-lg mb-4">RM {selectedItem.price} <span className="text-[10px] text-slate-400 font-bold">/ NIGHT</span></p>
              <p className="text-slate-600 text-sm leading-relaxed mb-6">{selectedItem.desc}</p>
              {selectedItem.inc && selectedItem.inc.length > 0 && (
                <div className="mb-6 p-3 bg-slate-50 rounded-xl">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Includes:</p>
                  <div className="flex flex-wrap gap-1.5">{selectedItem.inc.map(inc => <span key={inc} className="bg-white border border-emerald-100 text-emerald-700 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase">{inc}</span>)}</div>
                </div>
              )}
              <button onClick={() => addToCart(selectedItem)} className="w-full bg-[#062c24] text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-emerald-900 active:scale-95 transition-all">Add to Cart</button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Modal */}
      {showCart && (
        <div className="fixed inset-0 bg-[#062c24]/95 backdrop-blur-md z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-50 flex justify-between items-center">
              <h3 className="text-lg font-black text-[#062c24] uppercase">Your Cart</h3>
              <button onClick={() => setShowCart(false)} className="w-11 h-11 rounded-full bg-slate-50 text-slate-400 hover:text-red-500 flex items-center justify-center"><i className="fas fa-times"></i></button>
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
                      <button onClick={() => updateCartQty(item.id, -1)} className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-red-500 rounded-lg font-black">−</button>
                      <span className="text-xs font-black text-[#062c24] w-5 text-center">{item.qty}</span>
                      <button onClick={() => updateCartQty(item.id, 1)} className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-emerald-600 rounded-lg font-black">+</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-slate-50 p-5 rounded-2xl space-y-2 text-[10px] font-bold uppercase">
                <div className="flex justify-between"><span>Duration</span><span>{nights} Night{nights > 1 ? "s" : ""}</span></div>
                <div className="flex justify-between"><span>Subtotal</span><span>RM {sub}</span></div>
                {showAuto && <div className="flex justify-between text-emerald-600"><span>Extended Stay</span><span>− RM {Math.round(autoDisc)}</span></div>}
                {showPromo && <div className="flex justify-between text-emerald-600"><span>Promo Code</span><span>− RM {Math.round(promoDisc)}</span></div>}
                <div className="flex justify-between border-t border-slate-200 pt-3"><span>Security Deposit</span><span className="text-slate-400">RM {Math.round(dep)}</span></div>
                <div className="flex justify-between text-xl font-black text-[#062c24] pt-2"><span>Total</span><span>RM {total}</span></div>
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-300 uppercase mb-2 block">Pickup Point</label>
                <select value={selectedHub} onChange={e => setSelectedHub(e.target.value)} className="w-full bg-slate-50 p-4 rounded-xl text-xs font-bold outline-none border border-slate-100 appearance-none">
                  {(vendorData?.pickup || [vendorData?.city]).filter(Boolean).map(h => <option key={h} value={h!}>{h}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <input type="text" value={promoInput} onChange={e => setPromoInput(e.target.value.toUpperCase())} placeholder="Promo Code" onKeyDown={e => e.key === "Enter" && applyPromo()} className="col-span-2 bg-slate-50 p-4 rounded-xl text-xs font-bold outline-none border border-slate-100 uppercase" />
                <button onClick={applyPromo} className="bg-indigo-50 text-indigo-600 rounded-xl text-[9px] font-black uppercase hover:bg-indigo-100">Apply</button>
              </div>
              {promoMsg && <p className={`text-center text-[10px] font-bold ${promoMsg.success ? "text-emerald-500" : "text-red-500"}`}>{promoMsg.text}</p>}

              <div className="bg-white border border-slate-100 p-4 rounded-xl space-y-3">
                <p className="text-[9px] font-black text-slate-300 uppercase border-b border-slate-50 pb-2">Rental Policy</p>
                <div className="space-y-2 text-[9px] font-bold text-slate-500 uppercase">{terms}</div>
                <label className="flex gap-3 items-center pt-2 cursor-pointer">
                  <input type="checkbox" checked={termsAgreed} onChange={e => setTermsAgreed(e.target.checked)} className="w-5 h-5 accent-emerald-500 rounded shrink-0" />
                  <span className="text-[9px] font-bold text-slate-500 uppercase">I agree to the terms above</span>
                </label>
              </div>
            </div>

            <div className="p-5 bg-slate-50 border-t border-slate-100">
              <button onClick={canOrder ? sendWhatsAppOrder : undefined} disabled={!canOrder} className={`w-full py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl transition-all ${canOrder ? "bg-[#062c24] text-white hover:bg-emerald-900 active:scale-95" : "bg-slate-200 text-slate-400 cursor-not-allowed"}`}>
                {!cart.length ? "Add Items" : !selectedDates[0] || !selectedDates[1] ? "Select Dates" : !termsAgreed ? "Agree to Terms" : "Submit via WhatsApp 🟢"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toasts */}
      {showShareToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[500] bg-[#062c24] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3">
          <i className="fas fa-check-circle text-emerald-400"></i>
          <span className="text-[10px] font-black uppercase tracking-widest">Link Copied!</span>
        </div>
      )}
      {addToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[500] bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3">
          <i className="fas fa-cart-plus"></i>
          <span className="text-[10px] font-black uppercase tracking-widest">{addToast} Added!</span>
        </div>
      )}
    </div>
  );
}