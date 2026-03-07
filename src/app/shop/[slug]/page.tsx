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
import AdBanner from "@/components/AdBanner";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type DeliveryZone = { name: string; fee: number };
type TimeSlot = { time: string; label: string };

type ServicesConfig = {
  delivery: {
    enabled: boolean;
    pricingType: "fixed" | "per_km" | "zones" | "quote";
    fixedFee: number;
    perKmRate: number;
    minFee: number;
    zones: DeliveryZone[];
    freeAbove: number;
    notes: string;
  };
  setup: {
    enabled: boolean;
    fee: number;
    description: string;
  };
  combo: {
    enabled: boolean;
    fee: number;
  };
  timeSlots: {
    enabled: boolean;
    slots: TimeSlot[];
  };
};

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
  services?: ServicesConfig;
};

type GearItem = {
  id: string; name: string; price: number; img?: string;
  images?: string[];
  desc?: string; category?: string; type?: string;
  stock?: number; inc?: string[];
  linkedItems?: { itemId: string; qty: number }[];
  deleted?: boolean;
  setup?: {
    available: boolean;
    fee: number;
    description: string;
  };
};

type CartItem = GearItem & { qty: number; addSetup?: boolean };
type AvailRule = { itemId?: string; type?: string; start: string; end?: string; qty?: number };
type Discount = { type: string; trigger_nights?: number; discount_percent: number; code?: string; deleted?: boolean; is_public?: boolean };
type VendorPost = { id: string; content: string; image?: string; pinned?: boolean; createdAt: any };

type FulfillmentType = "pickup" | "delivery";

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SHOP PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const searchParams = useSearchParams();
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;
  
  // Core state
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
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<"gear" | "updates" | "reviews">("gear");
  
  // ═══ NEW: Fulfillment state ═══
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null);
  const [deliveryDistance, setDeliveryDistance] = useState("");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);
  const [useCombo, setUseCombo] = useState(false);
  
  const cpRef = useRef<any>(null);
  const opRef = useRef<any>(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // EFFECTS
  // ═══════════════════════════════════════════════════════════════════════════

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
      
      // Set default zone if zones exist
      if (vData.services?.delivery?.zones?.length) {
        setSelectedZone(vData.services.delivery.zones[0]);
      }
      // Set default time slot if enabled
      if (vData.services?.timeSlots?.slots?.length) {
        setSelectedTimeSlot(vData.services.timeSlots.slots[0]);
      }
      
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

  const specialOffer = discounts.find(d => d.type === "nightly_discount" && d.is_public !== false);

  // ═══════════════════════════════════════════════════════════════════════════
  // CART FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

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
      return [...prev, { ...item, qty: 1, addSetup: false }];
    });
    setShowItemModal(false);
    setAddToast(item.name);
    setTimeout(() => setAddToast(null), 2000);
  }

  function removeFromCart(id: string) { setCart(prev => prev.filter(i => i.id !== id)); }
  
  function updateCartQty(id: string, delta: number) {
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0));
  }

  function toggleItemSetup(id: string) {
    setCart(prev => prev.map(i => i.id === id ? { ...i, addSetup: !i.addSetup } : i));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRICING CALCULATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const services = vendorData?.services;
  const hasDelivery = services?.delivery?.enabled ?? false;
  const hasSetup = services?.setup?.enabled ?? false;
  const hasCombo = services?.combo?.enabled ?? false;
  const hasTimeSlots = services?.timeSlots?.enabled ?? false;

  const nights = selectedDates[0] && selectedDates[1] ? Math.max(1, Math.ceil((selectedDates[1].getTime() - selectedDates[0].getTime()) / 86400000)) : 1;
  const dailyTotal = cart.reduce((acc, i) => acc + i.price * i.qty, 0);
  const sub = dailyTotal * nights;

  // Auto discount calculation
  let autoDisc = 0;
  const rule = discounts.filter(d => d.type === "nightly_discount" && (d.trigger_nights ?? 0) <= nights).sort((a, b) => b.discount_percent - a.discount_percent)[0];
  if (rule) { const fn = (rule.trigger_nights ?? 0) - 1; const dn = nights - fn; if (dn > 0) autoDisc = dailyTotal * dn * (rule.discount_percent / 100); }
  
  // Promo discount
  const promoDisc = appliedPromo ? sub * (appliedPromo.discount_percent / 100) : 0;
  const allowStacking = vendorData?.allow_stacking === true;
  let finalDiscount = 0, showAuto = false, showPromo = false;
  if (allowStacking) { finalDiscount = autoDisc + promoDisc; if (autoDisc > 0) showAuto = true; if (promoDisc > 0) showPromo = true; }
  else { finalDiscount = Math.max(autoDisc, promoDisc); if (finalDiscount > 0) { if (promoDisc >= autoDisc && promoDisc > 0) showPromo = true; else showAuto = true; } }
  const subAfterDisc = sub - finalDiscount;

  // ═══ Delivery fee calculation ═══
  function calculateDeliveryFee(): number {
    if (fulfillmentType !== "delivery" || !services?.delivery?.enabled) return 0;
    
    // Check free delivery threshold
    if ((services.delivery.freeAbove ?? 0) > 0 && subAfterDisc >= services.delivery.freeAbove) return 0;
    
    switch (services.delivery.pricingType) {
      case "fixed":
        return services.delivery.fixedFee ?? 0;
      case "per_km":
        const km = parseFloat(deliveryDistance) || 0;
        const calculated = km * (services.delivery.perKmRate ?? 0);
        return Math.max(calculated, services.delivery.minFee ?? 0);
      case "zones":
        return selectedZone?.fee ?? 0;
      case "quote":
        return 0; // Price TBD
      default:
        return 0;
    }
  }

  // ═══ Setup fee calculation (per item) ═══
  function calculateSetupFee(): number {
    if (fulfillmentType !== "delivery") return 0; // Setup only with delivery
    
    // If using combo, don't add individual setup fees
    if (useCombo && hasCombo) return 0;
    
    return cart.reduce((total, item) => {
      if (item.addSetup && item.setup?.available) {
        return total + (item.setup.fee || 0);
      }
      return total;
    }, 0);
  }

  // ═══ Combo fee (delivery + setup bundle) ═══
  function calculateComboFee(): number {
    if (!useCombo || !hasCombo || fulfillmentType !== "delivery") return 0;
    return services?.combo?.fee || 0;
  }

  const deliveryFee = calculateDeliveryFee();
  const setupFee = calculateSetupFee();
  const comboFee = calculateComboFee();
  
  // Calculate combo savings
  const normalDeliveryPlusSetup = deliveryFee + cart.reduce((t, i) => i.addSetup && i.setup?.available ? t + (i.setup.fee || 0) : t, 0);
  const comboSavings = useCombo && hasCombo ? Math.max(0, normalDeliveryPlusSetup - comboFee) : 0;

  // Final service fee
  const serviceFee = useCombo && hasCombo ? comboFee : (deliveryFee + setupFee);

  // Deposit
  const dep = vendorData?.security_deposit_type === "percent" ? subAfterDisc * ((vendorData.security_deposit || 0) / 100) : (vendorData?.security_deposit || 50);
  
  // Total
  const total = Math.round(subAfterDisc + serviceFee + dep);

  // Check if any cart item has setup selected
  const hasAnySetupSelected = cart.some(i => i.addSetup && i.setup?.available);

  function applyPromo() {
    const code = promoInput.trim().toUpperCase();
    const found = discounts.find(d => d.type === "promo_code" && d.code === code);
    if (found) { setAppliedPromo(found); setPromoMsg({ text: `Success! ${found.discount_percent}% Off Applied`, success: true }); }
    else { setAppliedPromo(null); setPromoMsg({ text: "Invalid Code", success: false }); }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WHATSAPP ORDER
  // ═══════════════════════════════════════════════════════════════════════════

  async function sendWhatsAppOrder() {
    const pickupDate = (cpRef.current as any)?._input?.value;
    const returnDate = (opRef.current as any)?._input?.value;
    
    // Build cart items with prices and setup
    const cartLines = cart.map(i => {
      let line = `• ${i.name} (x${i.qty}) - RM${i.price * i.qty}`;
      if (i.addSetup && i.setup?.available) {
        line += ` + Setup RM${i.setup.fee}`;
      }
      return line;
    }).join("%0A");
    
    // Build discount text
    let discountLines = "";
    if (showAuto) discountLines += `%0AExtended Stay Discount: -RM${Math.round(autoDisc)}`;
    if (showPromo && appliedPromo) discountLines += `%0APromo Code (${appliedPromo.code}): -RM${Math.round(promoDisc)}`;
    
    // Build fulfillment section
    let fulfillmentSection = "";
    if (fulfillmentType === "pickup") {
      fulfillmentSection = `%0A%0A📍 *PICKUP*%0ALocation: ${selectedHub}`;
    } else {
      fulfillmentSection = `%0A%0A🚚 *DELIVERY*%0AAddress: ${deliveryAddress}`;
      
      if (services?.delivery?.pricingType === "zones" && selectedZone) {
        fulfillmentSection += `%0AZone: ${selectedZone.name}`;
      } else if (services?.delivery?.pricingType === "per_km" && deliveryDistance) {
        fulfillmentSection += `%0ADistance: ${deliveryDistance} km`;
      } else if (services?.delivery?.pricingType === "quote") {
        fulfillmentSection += `%0A⚠️ Delivery fee to be quoted`;
      }
      
      if (selectedTimeSlot) {
        fulfillmentSection += `%0ATime Slot: ${selectedTimeSlot.label} (${selectedTimeSlot.time})`;
      }
      
      if (useCombo && hasCombo) {
        fulfillmentSection += `%0A🎁 Bundle: Delivery + Setup Combo`;
      }
    }
    
    // Build pricing section
    let pricingSection = `%0A%0A💰 *PRICING*%0ASubtotal: RM${sub}${discountLines}`;
    if (fulfillmentType === "delivery") {
      if (useCombo && hasCombo) {
        pricingSection += `%0ADelivery + Setup Combo: RM${comboFee}`;
        if (comboSavings > 0) pricingSection += ` (Save RM${comboSavings})`;
      } else {
        if (deliveryFee > 0) pricingSection += `%0ADelivery Fee: RM${deliveryFee}`;
        if (setupFee > 0) pricingSection += `%0ASetup Fee: RM${setupFee}`;
        if (services?.delivery?.pricingType === "quote") pricingSection += `%0ADelivery Fee: TBD`;
      }
    }
    pricingSection += `%0ASecurity Deposit: RM${Math.round(dep)}`;
    pricingSection += `%0A%0A*TOTAL: RM${total}*`;
    if (services?.delivery?.pricingType === "quote" && fulfillmentType === "delivery") {
      pricingSection += ` (excl. delivery)`;
    }

    const msg = `Hi ${vendorData?.name}, Booking Request:%0A` +
      `%0A📦 *ITEMS*%0A${cartLines}` +
      `%0A%0A📅 *DATES*%0APick-up: ${pickupDate}%0AReturn: ${returnDate}%0ADuration: ${nights} night${nights > 1 ? "s" : ""}` +
      fulfillmentSection +
      pricingSection;

    // Analytics & credits
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
              fulfillmentType,
              deliveryAddress: fulfillmentType === "delivery" ? deliveryAddress : null,
              deliveryZone: selectedZone?.name || null,
              timeSlot: selectedTimeSlot?.label || null,
              bookingDates: { start: pickupDate, end: returnDate },
              cartItems: cart.map(i => ({ 
                id: i.id, name: i.name, qty: i.qty, price: i.price,
                addSetup: i.addSetup || false,
                setupFee: i.addSetup && i.setup?.fee ? i.setup.fee : 0
              })),
            });
          }
        });
        localStorage.setItem(storageKey, String(Date.now()));
      } catch (e) { console.error(e); }
    }
    
    if (typeof window !== "undefined" && typeof (window as any).gtag === "function") {
      (window as any).gtag("event", "whatsapp_booking", {
        currency: "MYR",
        value: total,
        vendor_id: vendorId,
        vendor_name: vendorData?.name,
        fulfillment_type: fulfillmentType,
        items_count: cartCount
      });
    }
    
    window.open(`https://wa.me/${vendorData?.phone}?text=${msg}`, "_blank");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  const categories = Array.from(new Set(allGear.map(g => g.category || (g.type === "package" ? "Packages" : "Add-ons")))).sort();
  
  useEffect(() => {
    if (categories.length > 0 && !activeCategory) setActiveCategory(categories[0]);
  }, [categories.length]);
  
  const filteredGear = (cat: string) => allGear.filter(g => (g.category || (g.type === "package" ? "Packages" : "Add-ons")) === cat && g.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const cartCount = cart.reduce((a, i) => a + i.qty, 0);
  
  // Can order validation
  const needsAddress = fulfillmentType === "delivery" && !deliveryAddress.trim();
  const needsDistance = fulfillmentType === "delivery" && services?.delivery?.pricingType === "per_km" && !deliveryDistance;
  const canOrder = cartCount > 0 && selectedDates[0] && selectedDates[1] && termsAgreed && !needsAddress && !needsDistance;
  
  const terms = vendorData?.rules?.map(r => (
    <div key={r} className="flex gap-2 items-start text-left">
      <i className="fas fa-check-circle text-emerald-500 mt-0.5 shrink-0 text-xs"></i>
      <span>{r}</span>
    </div>
  ));

  function getLinkedItemsData(item: GearItem): { item: GearItem; qty: number }[] {
    if (!item.linkedItems || item.linkedItems.length === 0) return [];
    return item.linkedItems
      .map(li => {
        const linkedItem = allGear.find(g => g.id === li.itemId);
        return linkedItem ? { item: linkedItem, qty: li.qty } : null;
      })
      .filter(Boolean) as { item: GearItem; qty: number }[];
  }

  const rating = vendorData?.rating || 0;
  const reviewCount = vendorData?.reviewCount || 0;

  function handleShare(itemId?: string) {
    const url = itemId ? `${window.location.href}?item=${itemId}` : window.location.href;
    const title = itemId ? allGear.find(g => g.id === itemId)?.name : vendorData?.name;
    if (navigator.share) navigator.share({ title: title || "Shop", url }).catch(() => {});
    else { navigator.clipboard.writeText(url); setShowShareToast(true); }
  }

  function formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  if (blockState === "unapproved") return <BlockScreen message="Hub Building" icon="fa-hard-hat" iconBg="bg-slate-200 text-slate-400" />;
  if (blockState === "vacation") return <BlockScreen message="On Vacation" icon="fa-umbrella-beach" iconBg="bg-blue-400 text-white" />;
  if (blockState === "nocredits") return <BlockScreen message="Hub Unavailable" icon="fa-store-slash" iconBg="bg-red-500 text-white" />;

  return (
    <div className="pb-8 min-h-screen" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: "#f0f2f1", color: "#0f172a" }}>
      {ownerPreview && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-amber-400 text-[#062c24] px-4 py-2 rounded-full text-[10px] font-black uppercase shadow-xl z-[200] animate-bounce">PREVIEW MODE</div>
      )}

      {/* Hero Header */}
      <header className="bg-[#062c24] text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "url('/pattern-chevron.png')", backgroundSize: "300px" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-[#062c24] via-[#062c24]/50 to-[#062c24]/90" />

        {/* Nav row */}
        <div className="relative z-10 flex justify-between items-center px-4 pt-4">
          <Link href="/directory" className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center hover:bg-white hover:text-[#062c24] transition-all">
            <i className="fas fa-arrow-left text-sm"></i>
          </Link>
          <div className="flex gap-2">
            <button onClick={() => handleShare()} className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center hover:bg-white hover:text-[#062c24] transition-all">
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
          <div className="w-20 h-20 bg-white rounded-2xl p-1 shadow-2xl mb-4">
            <img src={vendorData?.image || "/pacak-khemah.png"} className="w-full h-full object-cover rounded-[0.9rem]" alt="logo" />
          </div>
          
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-xl font-black uppercase tracking-tight">{vendorData?.name || "Loading..."}</h1>
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase">
              <i className="fas fa-check-circle mr-1"></i>Verified
            </span>
          </div>

          {reviewCount > 0 && (
            <div className="bg-orange-500/20 text-orange-300 border border-orange-500/30 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide flex items-center gap-1.5 mb-3">
              <i className="fas fa-fire"></i>
              <span>{rating.toFixed(1)}</span>
              <span className="text-orange-200/60">({reviewCount} reviews)</span>
            </div>
          )}

          {/* Service badges */}
          <div className="flex flex-wrap justify-center gap-2 text-[9px] font-bold uppercase mb-3">
            <span className="bg-white/10 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/10">
              <i className="fas fa-truck text-emerald-400 mr-1"></i>Pickup: {vendorData?.pickup?.join(", ") || vendorData?.city}
            </span>
            {hasDelivery && (
              <span className="bg-emerald-500/20 backdrop-blur-sm px-2.5 py-1 rounded-full border border-emerald-400/30 text-emerald-300">
                <i className="fas fa-shipping-fast mr-1"></i>Delivery Available
              </span>
            )}
            {hasSetup && (
              <span className="bg-blue-500/20 backdrop-blur-sm px-2.5 py-1 rounded-full border border-blue-400/30 text-blue-300">
                <i className="fas fa-campground mr-1"></i>Setup Service
              </span>
            )}
            {vendorData?.areas && vendorData.areas.length > 0 && (
              <span className="bg-white/10 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/10">
                <i className="fas fa-map text-emerald-400 mr-1"></i>Covers: {vendorData.areas.join(", ")}
              </span>
            )}
          </div>

          {/* Social icons */}
          <div className="flex gap-2 mb-2">
            {vendorData?.phone && <a href={`https://wa.me/${vendorData.phone}`} target="_blank" rel="noreferrer" className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center hover:bg-emerald-500 transition-colors border border-white/10"><i className="fab fa-whatsapp text-sm"></i></a>}
            {vendorData?.tiktok && <a href={vendorData.tiktok} target="_blank" rel="noreferrer" className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors border border-white/10"><i className="fab fa-tiktok text-sm"></i></a>}
            {vendorData?.ig && <a href={vendorData.ig} target="_blank" rel="noreferrer" className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors border border-white/10"><i className="fab fa-instagram text-sm"></i></a>}
            {vendorData?.threads && <a href={vendorData.threads} target="_blank" rel="noreferrer" className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors border border-white/10"><i className="fab fa-threads text-sm"></i></a>}
            {vendorData?.fb && <a href={vendorData.fb} target="_blank" rel="noreferrer" className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors border border-white/10"><i className="fab fa-facebook text-sm"></i></a>}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-4 space-y-3">
        {specialOffer && (
          <div className="bg-gradient-to-r from-red-600 to-orange-500 p-3.5 rounded-2xl text-white text-center shadow-lg relative overflow-hidden">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/cubes.png')" }} />
            <p className="relative z-10 text-[10px] font-black uppercase tracking-widest"><i className="fas fa-fire mr-1"></i> SAVE {specialOffer.discount_percent}% ON STAYS OF {specialOffer.trigger_nights}+ NIGHTS!</p>
          </div>
        )}

        {/* Main Tabs */}
        <div className="flex bg-white rounded-2xl p-1.5 border border-slate-100 shadow-sm">
          {([
            { id: "gear" as const, label: "Gear", icon: "fa-campground", badge: 0 },
            { id: "updates" as const, label: "Updates", icon: "fa-bullhorn", badge: posts.length },
            { id: "reviews" as const, label: "Reviews", icon: "fa-fire", badge: reviewCount },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setMainTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase transition-all ${mainTab === tab.id ? "bg-[#062c24] text-white shadow-lg" : "text-slate-400 hover:text-slate-600"}`}
            >
              <i className={`fas ${tab.icon} text-[10px]`}></i>
              <span>{tab.label}</span>
              {tab.badge > 0 && (
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${mainTab === tab.id ? "bg-white/20" : "bg-slate-100"}`}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* GEAR TAB CONTENT */}
        {mainTab === "gear" && (
          <>
            {/* About Us Section */}
            {(vendorData?.tagline || vendorData?.tagline_my) && (
              <Section title="About Us" icon="fa-info-circle" defaultOpen={false}>
                <div className="space-y-3">
                  {vendorData.tagline && (
                    <p className="text-sm text-slate-700 leading-relaxed">{vendorData.tagline}</p>
                  )}
                  {vendorData.tagline_my && (
                    <p className="text-sm text-emerald-700 italic leading-relaxed">{vendorData.tagline_my}</p>
                  )}
                </div>
              </Section>
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
              
              {/* Category tabs */}
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

              {/* Gear grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredGear(activeCategory || categories[0] || "").map((item, idx) => {
                  const avail = getAvailableStock(item.id);
                  const inCart = cart.find(c => c.id === item.id)?.qty || 0;
                  const canAdd = avail > inCart;
                  const hasSetupOption = item.setup?.available;
                  
                  return (
                    <div key={item.id} className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm stagger-in relative" style={{ animationDelay: `${idx * 50}ms` }}>
                      <div className="aspect-square relative cursor-pointer" onClick={() => { setSelectedItem(item); setShowItemModal(true); }}>
                        <img src={item.img || "/placeholder.jpg"} className="w-full h-full object-cover" alt={item.name} />
                        {hasSetupOption && (
                          <span className="absolute top-2 left-2 bg-blue-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-md uppercase">
                            <i className="fas fa-tools mr-0.5"></i>Setup
                          </span>
                        )}
                        {inCart > 0 && (
                          <span className="absolute top-2 right-2 bg-emerald-500 text-white text-[9px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow-lg">{inCart}</span>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-[10px] font-black uppercase truncate text-[#062c24]">{item.name}</p>
                        <p className="text-[10px] font-bold text-emerald-600">RM {item.price}/night</p>
                        <button onClick={() => canAdd && addToCart(item)} disabled={!canAdd}
                          className={`w-full mt-2 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${canAdd ? "bg-[#062c24] text-white hover:bg-emerald-800 active:scale-95" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}>
                          {canAdd ? "Add to Cart" : avail === 0 ? "Sold Out" : "Max Added"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          </>
        )}

        {/* UPDATES TAB */}
        {mainTab === "updates" && (
          <div className="space-y-3">
            {posts.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
                <i className="fas fa-bullhorn text-slate-200 text-4xl mb-3"></i>
                <p className="text-slate-400 text-sm font-bold">No updates yet</p>
              </div>
            ) : (
              posts.map(post => (
                <div key={post.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                  {post.pinned && (
                    <span className="inline-block bg-amber-100 text-amber-600 text-[8px] font-black px-2 py-0.5 rounded-md uppercase mb-2">
                      <i className="fas fa-thumbtack mr-1"></i>Pinned
                    </span>
                  )}
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{post.content}</p>
                  {post.image && (
                    <img src={post.image} className="mt-3 rounded-xl w-full max-h-64 object-cover" alt="" />
                  )}
                  <p className="text-[9px] text-slate-400 mt-2">
                    {post.createdAt?.seconds ? formatTimeAgo(new Date(post.createdAt.seconds * 1000)) : ""}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {/* REVIEWS TAB */}
        {mainTab === "reviews" && (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
            <i className="fas fa-star text-amber-300 text-4xl mb-3"></i>
            <p className="text-slate-400 text-sm font-bold">Reviews coming soon</p>
            {reviewCount > 0 && (
              <p className="text-[10px] text-slate-300 mt-2">{reviewCount} reviews • {rating.toFixed(1)} avg rating</p>
            )}
          </div>
        )}
      </main>

      {/* Floating Cart Button */}
      {cartCount > 0 && (
        <button onClick={() => setShowCart(true)}
          className="fixed bottom-6 right-6 bg-[#062c24] text-white w-16 h-16 rounded-2xl shadow-2xl flex items-center justify-center z-[100] hover:bg-emerald-800 active:scale-95 transition-all">
          <i className="fas fa-shopping-cart text-xl"></i>
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center">{cartCount}</span>
        </button>
      )}

      {/* Item Modal */}
      {showItemModal && selectedItem && (
        <div className="fixed inset-0 bg-[#062c24]/95 backdrop-blur-md z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="relative">
              <img src={selectedItem.img || "/placeholder.jpg"} className="w-full aspect-square object-cover rounded-t-[2rem]" alt={selectedItem.name} />
              <button onClick={() => setShowItemModal(false)} className="absolute top-4 right-4 w-10 h-10 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 shadow-lg">
                <i className="fas fa-times"></i>
              </button>
              {selectedItem.setup?.available && (
                <span className="absolute top-4 left-4 bg-blue-500 text-white text-[9px] font-black px-2 py-1 rounded-lg uppercase shadow-lg">
                  <i className="fas fa-tools mr-1"></i>Setup Available
                </span>
              )}
            </div>
            <div className="p-6">
              <h3 className="text-lg font-black uppercase text-[#062c24] mb-1">{selectedItem.name}</h3>
              <p className="text-emerald-600 font-black text-xl mb-3">RM {selectedItem.price}<span className="text-xs text-slate-400 font-bold">/night</span></p>
              {selectedItem.desc && <p className="text-slate-500 text-sm mb-4 leading-relaxed">{selectedItem.desc}</p>}
              
              {/* Setup info */}
              {selectedItem.setup?.available && (
                <div className="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-[9px] font-black text-blue-600 uppercase mb-1"><i className="fas fa-tools mr-1"></i>Setup Service Available</p>
                  <p className="text-xs text-blue-700 font-bold">+RM {selectedItem.setup.fee}</p>
                  {selectedItem.setup.description && (
                    <p className="text-[10px] text-blue-600 mt-1">{selectedItem.setup.description}</p>
                  )}
                </div>
              )}
              
              {selectedItem.inc && selectedItem.inc.length > 0 && (
                <div className="mb-6 p-3 bg-slate-50 rounded-xl">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Also Includes:</p>
                  <div className="flex flex-wrap gap-1.5">{selectedItem.inc.map(inc => (<span key={inc} className="bg-white border border-emerald-100 text-emerald-700 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase">{inc}</span>))}</div>
                </div>
              )}
              
              <button onClick={() => addToCart(selectedItem)} className="w-full bg-[#062c24] text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">Add to Cart</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* CART MODAL - WITH DELIVERY & SETUP OPTIONS */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {showCart && (
        <div className="fixed inset-0 bg-[#062c24]/95 backdrop-blur-md z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-50 flex justify-between items-center">
              <h3 className="text-lg font-black text-[#062c24] uppercase">Your Cart</h3>
              <button onClick={() => setShowCart(false)} className="w-11 h-11 rounded-full bg-slate-50 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors"><i className="fas fa-times"></i></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-5" style={{ scrollbarWidth: "none" }}>
              
              {/* Cart Items with Setup Checkboxes */}
              <div className="space-y-2">
                {cart.map(item => (
                  <div key={item.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between">
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
                    
                    {/* Per-item Setup Checkbox - only show if delivery selected and item has setup */}
                    {fulfillmentType === "delivery" && item.setup?.available && !useCombo && (
                      <label className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100 cursor-pointer">
                        <input type="checkbox" checked={item.addSetup || false} onChange={() => toggleItemSetup(item.id)} className="w-4 h-4 accent-blue-500 rounded" />
                        <span className="text-[9px] font-bold text-blue-600 uppercase">
                          <i className="fas fa-tools mr-1"></i>Add Setup +RM{item.setup.fee}
                        </span>
                      </label>
                    )}
                  </div>
                ))}
              </div>

              {/* ═══ FULFILLMENT SELECTOR ═══ */}
              {hasDelivery && (
                <div className="bg-gradient-to-br from-slate-50 to-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-3 flex items-center gap-2">
                    <i className="fas fa-truck text-emerald-500"></i>Fulfillment Method
                  </p>
                  
                  <div className="flex gap-2 mb-3">
                    <button 
                      onClick={() => { setFulfillmentType("pickup"); setUseCombo(false); }}
                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${fulfillmentType === "pickup" ? "bg-[#062c24] text-white shadow-lg" : "bg-white text-slate-500 border border-slate-200 hover:border-emerald-300"}`}>
                      <i className="fas fa-store mr-1.5"></i>Self Pickup
                    </button>
                    <button 
                      onClick={() => setFulfillmentType("delivery")}
                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${fulfillmentType === "delivery" ? "bg-[#062c24] text-white shadow-lg" : "bg-white text-slate-500 border border-slate-200 hover:border-emerald-300"}`}>
                      <i className="fas fa-shipping-fast mr-1.5"></i>Delivery
                    </button>
                  </div>

                  {/* Pickup Location */}
                  {fulfillmentType === "pickup" && (
                    <div className="relative">
                      <label className="text-[9px] font-black text-slate-300 uppercase mb-1.5 block ml-1">Pickup Point</label>
                      <select value={selectedHub} onChange={e => setSelectedHub(e.target.value)} className="w-full bg-white p-3.5 rounded-xl text-xs font-bold outline-none border border-slate-200 appearance-none">
                        {(vendorData?.pickup || [vendorData?.city]).filter(Boolean).map(h => (<option key={h} value={h!}>{h}</option>))}
                      </select>
                      <i className="fas fa-chevron-down absolute right-4 bottom-4 text-slate-400 text-xs pointer-events-none"></i>
                    </div>
                  )}

                  {/* Delivery Options */}
                  {fulfillmentType === "delivery" && (
                    <div className="space-y-3">
                      {/* Delivery Address */}
                      <div>
                        <label className="text-[9px] font-black text-slate-300 uppercase mb-1.5 block ml-1">
                          <i className="fas fa-map-marker-alt text-red-400 mr-1"></i>Delivery Address
                        </label>
                        <textarea 
                          value={deliveryAddress} 
                          onChange={e => setDeliveryAddress(e.target.value)}
                          placeholder="Enter campsite / delivery address..."
                          rows={2}
                          className="w-full bg-white p-3.5 rounded-xl text-xs font-bold outline-none border border-slate-200 resize-none focus:border-emerald-500"
                        />
                      </div>

                      {/* Zone Selection (if zone-based pricing) */}
                      {services?.delivery?.pricingType === "zones" && (services.delivery.zones?.length ?? 0) > 0 && (
                        <div>
                          <label className="text-[9px] font-black text-slate-300 uppercase mb-1.5 block ml-1">Select Zone</label>
                          <div className="space-y-2">
                            {services.delivery.zones?.map(zone => (
                              <label key={zone.name} className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${selectedZone?.name === zone.name ? "bg-emerald-100 border-2 border-emerald-500" : "bg-white border border-slate-200 hover:border-emerald-300"}`}>
                                <div className="flex items-center gap-2">
                                  <input type="radio" name="zone" checked={selectedZone?.name === zone.name} onChange={() => setSelectedZone(zone)} className="accent-emerald-500" />
                                  <span className="text-xs font-bold text-slate-700">{zone.name}</span>
                                </div>
                                <span className="text-xs font-black text-emerald-600">RM {zone.fee}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Distance Input (if per-km pricing) */}
                      {services?.delivery?.pricingType === "per_km" && (
                        <div>
                          <label className="text-[9px] font-black text-slate-300 uppercase mb-1.5 block ml-1">
                            Distance (km) • RM{services.delivery?.perKmRate ?? 0}/km, min RM{services.delivery?.minFee ?? 0}
                          </label>
                          <input 
                            type="number" 
                            value={deliveryDistance} 
                            onChange={e => setDeliveryDistance(e.target.value)}
                            placeholder="Enter distance in km"
                            className="w-full bg-white p-3.5 rounded-xl text-xs font-bold outline-none border border-slate-200 focus:border-emerald-500"
                          />
                          {deliveryDistance && (
                            <p className="text-[10px] font-bold text-emerald-600 mt-1 ml-1">
                              Delivery Fee: RM {deliveryFee}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Fixed Fee Display */}
                      {services?.delivery?.pricingType === "fixed" && (
                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                          <p className="text-[10px] font-bold text-slate-500">
                            <i className="fas fa-truck text-emerald-500 mr-1"></i>
                            Delivery Fee: <span className="text-emerald-600 font-black">RM {services.delivery?.fixedFee ?? 0}</span>
                          </p>
                          {(services.delivery?.freeAbove ?? 0) > 0 && subAfterDisc < (services.delivery?.freeAbove ?? 0) && (
                            <p className="text-[9px] text-amber-600 mt-1">
                              <i className="fas fa-info-circle mr-1"></i>
                              Free delivery for orders above RM {services.delivery?.freeAbove ?? 0}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Quote Notice */}
                      {services?.delivery?.pricingType === "quote" && (
                        <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                          <p className="text-[10px] font-bold text-amber-700">
                            <i className="fas fa-comments mr-1"></i>
                            Delivery fee will be confirmed via WhatsApp
                          </p>
                        </div>
                      )}

                      {/* Delivery Notes */}
                      {services?.delivery?.notes && (
                        <p className="text-[9px] text-slate-400 italic px-1">{services.delivery.notes}</p>
                      )}

                      {/* Time Slot Selection */}
                      {hasTimeSlots && (services?.timeSlots?.slots?.length ?? 0) > 0 && (
                        <div>
                          <label className="text-[9px] font-black text-slate-300 uppercase mb-1.5 block ml-1">
                            <i className="fas fa-clock text-blue-400 mr-1"></i>Preferred Time Slot
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {services?.timeSlots?.slots?.map(slot => (
                              <button 
                                key={slot.time}
                                onClick={() => setSelectedTimeSlot(slot)}
                                className={`p-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${selectedTimeSlot?.time === slot.time ? "bg-blue-500 text-white shadow-lg" : "bg-white text-slate-500 border border-slate-200 hover:border-blue-300"}`}>
                                {slot.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Combo Bundle Option */}
                      {hasCombo && hasAnySetupSelected && (
                        <div className={`p-4 rounded-xl border-2 transition-all ${useCombo ? "bg-gradient-to-r from-emerald-50 to-blue-50 border-emerald-400" : "bg-white border-dashed border-slate-300"}`}>
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input type="checkbox" checked={useCombo} onChange={e => setUseCombo(e.target.checked)} className="w-5 h-5 accent-emerald-500 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-xs font-black text-emerald-700 uppercase">
                                <i className="fas fa-gift mr-1"></i>Bundle & Save!
                              </p>
                              <p className="text-[10px] text-slate-600 mt-0.5">
                                Delivery + All Setup for just <span className="font-black text-emerald-600">RM {services?.combo?.fee}</span>
                              </p>
                              {comboSavings > 0 && (
                                <span className="inline-block mt-1 bg-red-100 text-red-600 text-[9px] font-black px-2 py-0.5 rounded-full">
                                  SAVE RM {comboSavings}!
                                </span>
                              )}
                            </div>
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* If no delivery service, show pickup only */}
              {!hasDelivery && (
                <div>
                  <label className="text-[9px] font-black text-slate-300 uppercase mb-2 block ml-1">Pickup Point</label>
                  <div className="relative">
                    <select value={selectedHub} onChange={e => setSelectedHub(e.target.value)} className="w-full bg-slate-50 p-4 rounded-xl text-xs font-bold outline-none border border-slate-100 appearance-none">
                      {(vendorData?.pickup || [vendorData?.city]).filter(Boolean).map(h => (<option key={h} value={h!}>{h}</option>))}
                    </select>
                    <i className="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
                  </div>
                </div>
              )}

              {/* Price Breakdown */}
              <div className="bg-slate-50 p-5 rounded-2xl space-y-2 text-[10px] font-bold uppercase">
                <div className="flex justify-between"><span>Duration</span><span className="text-[#062c24]">{nights} Night{nights > 1 ? "s" : ""}</span></div>
                <div className="flex justify-between"><span>Subtotal</span><span className="text-[#062c24]">RM {sub}</span></div>
                {showAuto && <div className="flex justify-between text-emerald-600"><span>Extended Stay</span><span>− RM {Math.round(autoDisc)}</span></div>}
                {showPromo && <div className="flex justify-between text-emerald-600"><span>Promo Code</span><span>− RM {Math.round(promoDisc)}</span></div>}
                
                {/* Service Fees */}
                {fulfillmentType === "delivery" && (
                  <>
                    {useCombo && hasCombo ? (
                      <div className="flex justify-between text-blue-600">
                        <span><i className="fas fa-gift mr-1"></i>Delivery + Setup Combo</span>
                        <span>RM {comboFee}</span>
                      </div>
                    ) : (
                      <>
                        {deliveryFee > 0 && (
                          <div className="flex justify-between text-slate-600">
                            <span><i className="fas fa-truck mr-1"></i>Delivery Fee</span>
                            <span>RM {deliveryFee}</span>
                          </div>
                        )}
                        {services?.delivery?.pricingType === "quote" && (
                          <div className="flex justify-between text-amber-600">
                            <span><i className="fas fa-truck mr-1"></i>Delivery Fee</span>
                            <span>TBD</span>
                          </div>
                        )}
                        {setupFee > 0 && (
                          <div className="flex justify-between text-blue-600">
                            <span><i className="fas fa-tools mr-1"></i>Setup Fee</span>
                            <span>RM {setupFee}</span>
                          </div>
                        )}
                      </>
                    )}
                    {comboSavings > 0 && useCombo && (
                      <div className="flex justify-between text-red-500">
                        <span>Bundle Savings</span>
                        <span>− RM {comboSavings}</span>
                      </div>
                    )}
                  </>
                )}
                
                <div className="flex justify-between border-t border-slate-200 pt-3"><span>Security Deposit</span><span className="text-slate-400">RM {Math.round(dep)}</span></div>
                <div className="flex justify-between text-xl font-black text-[#062c24] pt-2">
                  <span>Total</span>
                  <span>RM {total}{services?.delivery?.pricingType === "quote" && fulfillmentType === "delivery" ? "*" : ""}</span>
                </div>
                {services?.delivery?.pricingType === "quote" && fulfillmentType === "delivery" && (
                  <p className="text-[8px] text-amber-600 normal-case">*Excluding delivery fee (to be quoted)</p>
                )}
              </div>

              {/* Promo Code */}
              <div className="grid grid-cols-3 gap-2">
                <input type="text" value={promoInput} onChange={e => setPromoInput(e.target.value.toUpperCase())} placeholder="Promo Code" onKeyDown={e => e.key === "Enter" && applyPromo()}
                  className="col-span-2 bg-slate-50 p-4 rounded-xl text-xs font-bold outline-none border border-slate-100 uppercase tracking-widest" />
                <button onClick={applyPromo} className="bg-indigo-50 text-indigo-600 rounded-xl text-[9px] font-black uppercase hover:bg-indigo-100 transition-colors min-h-[44px]">Apply</button>
              </div>
              {promoMsg && <p className={`text-center text-[10px] font-bold ${promoMsg.success ? "text-emerald-500" : "text-red-500"}`}>{promoMsg.text}</p>}

              {/* Terms */}
              <div className="bg-white border border-slate-100 p-4 rounded-xl space-y-3">
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest border-b border-slate-50 pb-2">Rental Policy</p>
                <div className="space-y-2 text-[9px] font-bold text-slate-500 uppercase">{terms}</div>
                <label htmlFor="terms-agree" className="flex gap-3 items-center pt-2 cursor-pointer">
                  <input type="checkbox" id="terms-agree" checked={termsAgreed} onChange={e => setTermsAgreed(e.target.checked)} className="w-5 h-5 accent-emerald-500 rounded shrink-0" />
                  <span className="text-[9px] font-bold text-slate-500 uppercase">I agree to the terms above</span>
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <div className="p-5 bg-slate-50 border-t border-slate-100 space-y-4">
              <button onClick={canOrder ? sendWhatsAppOrder : undefined} disabled={!canOrder}
                className={`w-full py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl transition-all ${canOrder ? "bg-[#062c24] text-white hover:bg-emerald-900 active:scale-95" : "bg-slate-200 text-slate-400 cursor-not-allowed"}`}>
                {!cart.length ? "Add Items to Start" 
                  : !selectedDates[0] || !selectedDates[1] ? "Select Pickup & Return Dates" 
                  : needsAddress ? "Enter Delivery Address"
                  : needsDistance ? "Enter Delivery Distance"
                  : !termsAgreed ? "Agree to Terms to Proceed" 
                  : "Submit Order via WhatsApp 🟢"}
              </button>
              
              <AdBanner variant="inline" />
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

      {/* Toasts */}
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