"use client";

import { useEffect, useState, useRef, use, Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import {
  doc, getDoc, collection, query, where, getDocs, getDocsFromServer,
  runTransaction, serverTimestamp, addDoc, orderBy, updateDoc, arrayUnion, increment,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import "flatpickr/dist/flatpickr.min.css";
import AdBanner from "@/components/AdBanner";
import DemoShopGuide from "@/components/DemoShopGuide";
import BlockScreen from "@/components/shop/BlockScreen";
import Section from "@/components/shop/Section";
import ImageCarousel from "@/components/shop/ImageCarousel";
import MockupBanner from "@/components/shop/MockupBanner";
import { Badge, BadgeIcon, BadgePill } from "@/components/shop/Badges";
import { getCartKey, countInCart as countInCartUtil } from "@/lib/cartUtils";

// Item detail modal — dynamically imported so its ~330 lines of JSX + logic
// only load in the browser when a user actually taps a gear card.
// ssr:false because the modal relies on Firestore listeners via parent.
const ItemDetailModal = dynamic(
  () => import("@/components/shop/ItemDetailModal"),
  { ssr: false }
);

// Lazy-load flatpickr JS only when a date picker is actually mounted.
// CSS stays static above so Next.js can route-scope it without TS friction.
// Saves ~40KB JS from the initial bundle.
type FlatpickrFn = typeof import("flatpickr").default;
let _flatpickrPromise: Promise<FlatpickrFn> | null = null;
function loadFlatpickr(): Promise<FlatpickrFn> {
  if (!_flatpickrPromise) {
    _flatpickrPromise = import("flatpickr").then(mod => mod.default);
  }
  return _flatpickrPromise;
}

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
  slug?: string;
  steps?: { title: string; my: string; desc?: string; desc_my?: string }[];
  status?: string; is_vacation?: boolean; credits?: number;
  owner_uid?: string; show_nav?: boolean;
  security_deposit?: number; security_deposit_type?: string;
  allow_stacking?: boolean;
  rating?: number; reviewCount?: number;
  services?: ServicesConfig;
  badges?: Badge[];
  is_mockup?: boolean;
  avg_response_time?: number; // in minutes
  total_orders?: number;
  nearbyCampsiteIds?: string[];
  nearbyCampsites?: { id: string; km: number }[];
};

type FoodItem = { image: string; menuName: string };
type FoodPartner = { id: string; name: string; description?: string; items: FoodItem[]; whatsapp: string };

type GearVariant = {
  id: string;
  color?: { label: string; hex: string };
  size?: string;
  price: number;
  stock: number;
};

type GearItem = {
  id: string; name: string; price: number; img?: string;
  images?: string[];
  desc?: string; category?: string; type?: string;
  stock?: number; inc?: string[];
  linkedItems?: { itemId: string; qty: number; variantId?: string; variantLabel?: string; variantColor?: string }[];
  deleted?: boolean;
  hasVariants?: boolean;
  variants?: GearVariant[];
  setup?: {
    available: boolean;
    fee: number;
    description: string;
  };
  specs?: {
    size?: string;
    maxPax?: number;
    puRating?: string;
    layers?: string;
    weight?: string;
    tentType?: string;
  };
  pickupLocation?: string;
};

type LinkedVariantSelection = { itemId: string; variantId: string; variantLabel: string; variantColor?: string };
type CartItem = GearItem & { qty: number; addSetup?: boolean; selectedVariant?: GearVariant; linkedVariants?: LinkedVariantSelection[] };
type AvailRule = { itemId?: string; variantId?: string; type?: string; start: string; end?: string; qty?: number };
type Discount = { id?: string; type: string; trigger_nights?: number; discount_percent: number; discount_fixed?: number; code?: string; deleted?: boolean; is_public?: boolean; appliesTo?: { type: "all" | "specific"; itemIds?: string[] }; maxUses?: number | null; usedCount?: number; validFrom?: string | null; validUntil?: string | null; };
type VendorPost = { id: string; content: string; image?: string; pinned?: boolean; createdAt: any };
type Review = { id: string; customerName: string; rating: number; comment?: string | null; createdAt: any; isVerified?: boolean };

type FulfillmentType = "pickup" | "delivery";

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// All shop subcomponents (BlockScreen, Section, ImageCarousel, BadgeIcon,
// BadgePill, MockupBanner) live in src/components/shop/ and are imported above.

// Mock-up vendor ID constant
const MOCKUP_VENDOR_ID = "UHdf5wMhsPbwi7qFGPSloXGdbu53";
const ADMIN_WHATSAPP = "601136904336";

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SHOP PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function ShopPage({
  params,
  initialVendor,
  initialVendorId,
}: {
  params: Promise<{ slug: string }>;
  initialVendor?: VendorData | null;
  initialVendorId?: string | null;
}) {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-[#062c24] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
      </div>
    }>
      <ShopPageContent
        params={params}
        initialVendor={initialVendor}
        initialVendorId={initialVendorId}
      />
    </Suspense>
  );
}

function ShopPageContent({
  params,
  initialVendor,
  initialVendorId,
}: {
  params: Promise<{ slug: string }>;
  initialVendor?: VendorData | null;
  initialVendorId?: string | null;
}) {
  const searchParams = useSearchParams();
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;
  
  // Core state — seed from server if available
  const [vendorId, setVendorId] = useState<string | null>(initialVendorId ?? null);
  const [vendorData, setVendorData] = useState<VendorData | null>(initialVendor ?? null);
  const [allGear, setAllGear] = useState<GearItem[]>([]);
  const [availRules, setAvailRules] = useState<AvailRule[]>([]);
  const [weeklyOff, setWeeklyOff] = useState<Record<number, boolean>>({});
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [posts, setPosts] = useState<VendorPost[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedDates, setSelectedDates] = useState<[Date | null, Date | null]>([null, null]);
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<Discount | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [promoMsg, setPromoMsg] = useState<{ text: string; success: boolean } | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<GearItem | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<GearVariant | null>(null);
  const [linkedVarSelections, setLinkedVarSelections] = useState<Record<string, GearVariant | null>>({});
  const [selectedHub, setSelectedHub] = useState("");
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [blockState, setBlockState] = useState<null | "unapproved" | "vacation" | "nocredits">(null);
  const [ownerPreview, setOwnerPreview] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showShareToast, setShowShareToast] = useState(false);
  const [addToast, setAddToast] = useState<string | null>(null);
  const [itemShareToast, setItemShareToast] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [nearbyCampsites, setNearbyCampsites] = useState<{ id: string; name: string; location?: string; state?: string; direction?: string; carousel?: string[]; km?: number }[]>([]);
  const [foodPartners, setFoodPartners] = useState<FoodPartner[]>([]);
  const [selectedFoodPartner, setSelectedFoodPartner] = useState<FoodPartner | null>(null);
  const [fpCarouselIdx, setFpCarouselIdx] = useState(0);
  const [mainTab, setMainTab] = useState<"gear" | "updates" | "reviews">("gear");
  
  // ═══ NEW: Fulfillment state ═══
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null);
  const [deliveryDistance, setDeliveryDistance] = useState("");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);
  const [useCombo, setUseCombo] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // ── My Bookings (customer order history for this vendor) ──
  const [myBookings, setMyBookings] = useState<{ id: string; items: { name: string; qty: number; price: number; variantLabel?: string }[]; totalAmount: number; rentalAmount?: number; depositAmount?: number; bookingDates: { start: string; end: string }; status: string; createdAt: string }[]>([]);
  const [myBookingsPhone, setMyBookingsPhone] = useState("");
  const [myBookingsLoading, setMyBookingsLoading] = useState(false);
  const [myBookingsSearched, setMyBookingsSearched] = useState(false);
  
  const cpRef = useRef<any>(null);
  const opRef = useRef<any>(null);
  const cartCpRef = useRef<any>(null);
  const cartOpRef = useRef<any>(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // EFFECTS
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (showShareToast) { const t = setTimeout(() => setShowShareToast(false), 2000); return () => clearTimeout(t); }
  }, [showShareToast]);

  useEffect(() => {
    // If server already provided vendorId, skip the client-side lookup.
    if (initialVendorId) { setVendorId(initialVendorId); return; }

    const v = searchParams.get("v");
    if (v) { 
      // Direct vendor ID from query param
      setVendorId(v); 
    } else if (slug === "_") {
      // Special route /shop/_/vendorId - get vendorId from next path segment
      // This is handled by the redirect page, but just in case
      window.location.href = "/directory";
    } else if (slug) { 
      // Check if slug is actually a vendorId (for /shop/_/[vendorId] route)
      // Or lookup by slug name
      lookupSlugOrId(slug); 
    } else { 
      window.location.href = "/directory"; 
    }
  }, [slug, searchParams, initialVendorId]);

  async function lookupSlugOrId(slugOrId: string) {
    try {
      // First try to find by slug
      const snap = await getDocs(query(collection(db, "vendors"), where("slug", "==", slugOrId)));
      if (!snap.empty) {
        setVendorId(snap.docs[0].id);
        return;
      }
      
      // If not found by slug, check if it's a direct vendor ID
      const directSnap = await getDoc(doc(db, "vendors", slugOrId));
      if (directSnap.exists()) {
        setVendorId(slugOrId);
        return;
      }
      
      // Not found at all
      window.location.href = "/directory";
    } catch { 
      window.location.href = "/directory"; 
    }
  }

  useEffect(() => {
    if (!vendorId) return;
    // Load shop immediately. Don't wait for auth.
    loadShop();
    return;
  }, [vendorId]);

  // Separate auth listener: only re-evaluates ownership when user or vendorData changes.
  // No refetch — ownership is a boolean flip, not a data reload.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!vendorData?.owner_uid) return;
      setIsOwner(!!(user && user.uid === vendorData.owner_uid));
    });
    return () => unsub();
  }, [vendorData?.owner_uid]);

  async function loadShop() {
    if (!vendorId) return;
    try {
      // If vendor was seeded from the server, reuse it; otherwise fetch it.
      let vData: VendorData;
      if (vendorData) {
        vData = vendorData;
      } else {
        const vSnap = await getDoc(doc(db, "vendors", vendorId));
        if (!vSnap.exists()) return;
        vData = vSnap.data() as VendorData;
        setVendorData(vData);
      }

      setSelectedHub((vData.pickup?.[0] || vData.city) ?? "");

      // Load nearby campsites — prefer {id, km} list, fallback to ids-only list
      const campsiteRefs = vData.nearbyCampsites ?? vData.nearbyCampsiteIds?.map(id => ({ id, km: undefined }));
      if (campsiteRefs?.length) {
        const csSnaps = await Promise.all(campsiteRefs.map(c => getDoc(doc(db, "campsites", c.id))));
        setNearbyCampsites(
          csSnaps.filter(s => s.exists()).map((s, i) => ({
            id: s.id, ...s.data(),
            km: campsiteRefs[i]?.km,
          } as { id: string; name: string; location?: string; state?: string; direction?: string; carousel?: string[]; km?: number }))
        );
      }

      // Load food partners
      const fpSnap = await getDocs(collection(db, "vendors", vendorId, "foodPartners"));
      setFoodPartners(fpSnap.docs.filter(s => !s.data().deleted).map(s => ({ id: s.id, ...s.data() } as FoodPartner)));

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
      
      const [gearSnap, availSnap, discSnap, postsSnap, reviewsSnap, weeklyOffSnap] = await Promise.all([
        // Gear rarely changes — use cached read (falls back to server if no cache)
        getDocs(query(collection(db, "gear"), where("vendorId", "==", vendorId))),
        // Availability MUST be fresh to prevent double-booking
        getDocsFromServer(collection(db, "vendors", vendorId, "availability")),
        // Discounts rarely change
        getDocs(collection(db, "vendors", vendorId, "discounts")),
        // Posts rarely change
        getDocs(collection(db, "vendors", vendorId, "posts")),
        // Reviews rarely change
        getDocs(query(collection(db, "reviews"), where("vendorId", "==", vendorId), where("status", "==", "published"), orderBy("createdAt", "desc"))),
        // Parallelize weeklyOff instead of awaiting serially after
        getDoc(doc(db, "vendors", vendorId, "settings", "weeklyOff")).catch(() => null),
      ]);
      setAllGear(gearSnap.docs.map(d => ({ id: d.id, ...d.data() } as GearItem)).filter(g => !g.deleted));
      setAvailRules(availSnap.docs.map(d => d.data() as AvailRule));
      setWeeklyOff(weeklyOffSnap?.exists() ? weeklyOffSnap.data() as Record<number, boolean> : {});
      setDiscounts(discSnap.docs.map(d => ({ id: d.id, ...d.data() } as Discount)).filter(d => !d.deleted));
      setPosts(postsSnap.docs.map(d => ({ id: d.id, ...d.data() } as VendorPost)).sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      }));
      setReviews(reviewsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Review)));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (!vendorData) return;
    let cancelled = false;
    const blocked: any[] = availRules.filter(r => r.type === "block").map(r => ({ from: r.start, to: r.end || r.start }));
    const offDays = Object.entries(weeklyOff).filter(([, v]) => v).map(([k]) => Number(k));
    if (offDays.length) blocked.push((date: Date) => offDays.includes(date.getDay()));
    loadFlatpickr().then(flatpickr => {
      if (cancelled) return;
      cpRef.current = flatpickr("#checkin-date", {
        minDate: "today", dateFormat: "Y-m-d", disable: blocked,
        onChange: ([d]) => { setSelectedDates(prev => [d, prev[1]]); opRef.current?.set("minDate", d); },
      });
      opRef.current = flatpickr("#checkout-date", {
        minDate: "today", dateFormat: "Y-m-d", disable: blocked,
        onChange: ([d]) => setSelectedDates(prev => [prev[0], d]),
      });
    });
    return () => { cancelled = true; cpRef.current?.destroy(); opRef.current?.destroy(); };
  }, [vendorData, availRules, weeklyOff]);

  // Cart modal date pickers
  useEffect(() => {
    if (!showCart || !vendorData) return;
    let cancelled = false;
    const blocked: any[] = availRules.filter(r => r.type === "block").map(r => ({ from: r.start, to: r.end || r.start }));
    const offDays = Object.entries(weeklyOff).filter(([, v]) => v).map(([k]) => Number(k));
    if (offDays.length) blocked.push((date: Date) => offDays.includes(date.getDay()));

    loadFlatpickr().then(flatpickr => {
      if (cancelled) return;
      // defer one tick so the modal inputs are in the DOM
      setTimeout(() => {
        if (cancelled) return;
        cartCpRef.current = flatpickr("#cart-checkin-date", {
          minDate: "today", dateFormat: "Y-m-d", disable: blocked,
          defaultDate: selectedDates[0] || undefined,
          onChange: ([d]) => {
            setSelectedDates(prev => [d, prev[1]]);
            cpRef.current?.setDate(d);
            opRef.current?.set("minDate", d);
            cartOpRef.current?.set("minDate", d);
          },
        });
        cartOpRef.current = flatpickr("#cart-checkout-date", {
          minDate: selectedDates[0] || "today", dateFormat: "Y-m-d", disable: blocked,
          defaultDate: selectedDates[1] || undefined,
          onChange: ([d]) => {
            setSelectedDates(prev => [prev[0], d]);
            opRef.current?.setDate(d);
          },
        });
      }, 50);
    });

    return () => { cancelled = true; cartCpRef.current?.destroy(); cartOpRef.current?.destroy(); };
  }, [showCart, vendorData, availRules, weeklyOff]);

  // Auto-open item modal from URL param
  useEffect(() => {
    const itemParam = searchParams.get("item");
    if (itemParam && allGear.length > 0) {
      const item = allGear.find(g => g.id === itemParam);
      if (item) {
        setSelectedItem(item);
        setSelectedVariant(null);
        setLinkedVarSelections({});
        setShowItemModal(true);
      }
    }
  }, [allGear, searchParams]);

  function getItemShareUrl(item: GearItem): string {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const shopPath = vendorData?.slug ? `/shop/${vendorData.slug}` : `/shop/${vendorId}`;
    return `${base}${shopPath}?item=${item.id}`;
  }

  async function shareItem(item: GearItem) {
    const url = getItemShareUrl(item);
    const text = `${item.name} — RM${item.price}/night @ ${vendorData?.name || "Pacak Khemah"}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: item.name, text, url });
        return;
      } catch { /* user cancelled or not supported */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setItemShareToast(true);
      setTimeout(() => setItemShareToast(false), 2000);
    } catch { /* ignore */ }
  }

  const specialOffer = discounts.find(d => d.type === "nightly_discount" && d.is_public !== false);

  // ═══════════════════════════════════════════════════════════════════════════
  // CART FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── My Bookings: auto-load from localStorage ──
  useEffect(() => {
    if (!vendorId) return;
    try {
      const saved = localStorage.getItem("pk_customer");
      if (saved) {
        const { phone } = JSON.parse(saved);
        if (phone) {
          const local = phone.startsWith("60") ? "0" + phone.slice(2) : phone;
          setMyBookingsPhone(local);
          lookupMyBookings(phone);
        }
      }
    } catch { /* ignore */ }
  }, [vendorId]);

  async function lookupMyBookings(rawPhone?: string) {
    const digits = (rawPhone || myBookingsPhone).replace(/\D/g, "");
    const searchPhone = digits.startsWith("60") ? digits : digits.startsWith("0") ? "60" + digits.slice(1) : "60" + digits;
    if (searchPhone.length < 10) return;

    setMyBookingsLoading(true);
    setMyBookingsSearched(true);
    try {
      const q = query(collection(db, "orders"), where("vendorId", "==", vendorId), where("customerPhone", "==", searchPhone));
      const snap = await getDocs(q);
      const results = snap.docs.filter(d => !d.data().deleted).map(d => {
        const data = d.data();
        return {
          id: d.id,
          items: data.items || [],
          totalAmount: data.totalAmount || 0,
          rentalAmount: data.rentalAmount,
          depositAmount: data.depositAmount,
          bookingDates: data.bookingDates || { start: "", end: "" },
          status: data.status || "pending",
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() || "",
        };
      });
      // Sort by date descending (client-side to avoid composite index)
      results.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      setMyBookings(results);
    } catch (e) { console.error("Bookings lookup:", e); }
    finally { setMyBookingsLoading(false); }
  }

  function getItemStock(itemId: string, variantId?: string): number {
    const item = allGear.find(g => g.id === itemId);
    if (!item) return 0;

    const totalStock = item.stock || 0;

    if (!selectedDates[0] || !selectedDates[1]) {
      // No dates selected — show raw stock
      return variantId && item.variants?.length
        ? (item.variants.find(v => v.id === variantId)?.stock || 0)
        : totalStock;
    }

    // Calculate total booked for this item across all variants
    const overlapping = availRules.filter(r => r.itemId === itemId && new Date(r.start) <= selectedDates[1]! && new Date(r.end || r.start) >= selectedDates[0]!);
    const totalBooked = overlapping.reduce((s, r) => s + (r.qty || 0), 0);
    const totalRemaining = Math.max(0, totalStock - totalBooked);

    if (!variantId || !item.variants?.length) {
      return totalRemaining;
    }

    // Calculate how many of THIS specific variant are booked on these dates
    const variantBooked = overlapping
      .filter(r => r.variantId === variantId)
      .reduce((s, r) => s + (r.qty || 0), 0);

    const variantStock = item.variants.find(v => v.id === variantId)?.stock || 0;
    const variantRemaining = Math.max(0, variantStock - variantBooked);

    // Variant: can't exceed its own stock OR total remaining
    return Math.min(variantRemaining, totalRemaining);
  }

  function getAvailableStock(itemId: string, variantId?: string) {
    const item = allGear.find(g => g.id === itemId);
    if (!item) return 0;

    // Package: check all linked child items (with variant awareness)
    if (item.linkedItems && item.linkedItems.length > 0) {
      let minPackages = Infinity;
      for (const li of item.linkedItems) {
        if (li.qty <= 0) continue;
        // FIX 1: Use locked variantId for stock check
        const childStock = getItemStock(li.itemId, li.variantId || undefined);
        // FIX 2: Subtract child items already consumed by cart (addons + other packages)
        const childInCart = getEffectiveInCart(li.itemId, li.variantId || undefined);
        const childAvailable = Math.max(0, childStock - childInCart);
        const canFulfill = Math.floor(childAvailable / li.qty);
        minPackages = Math.min(minPackages, canFulfill);
      }
      if (minPackages === Infinity) minPackages = 0;
      return Math.min(minPackages, item.stock || 0);
    }

    // Regular item (with optional variant)
    return getItemStock(itemId, variantId);
  }

  // Revalidate cart quantities when dates change
  useEffect(() => {
    if (!selectedDates[0] || !selectedDates[1]) return;
    setCart(prev => {
      let changed = false;
      const clamped = prev.map(item => {
        const vid = item.selectedVariant?.id;
        const maxAvail = getAvailableStock(item.id, vid);
        if (item.qty > maxAvail) { changed = true; return { ...item, qty: maxAvail }; }
        return item;
      }).filter(i => i.qty > 0);
      return changed ? revalidateCart(clamped) : prev;
    });
  }, [selectedDates, availRules]);

  function countInCart(cartArr: CartItem[], itemId: string, variantId?: string): number {
    return countInCartUtil(cartArr, itemId, variantId);
  }

  // After any cart change, clamp packages whose shared children are over-consumed
  function revalidateCart(cartArr: CartItem[]): CartItem[] {
    let changed = false;
    const result = cartArr.map(ci => {
      const gear = allGear.find(g => g.id === ci.id);
      if (!gear?.linkedItems?.length) return ci;

      let maxPkgs = Infinity;
      for (const li of gear.linkedItems) {
        if (li.qty <= 0) continue;
        const childStock = getItemStock(li.itemId, li.variantId || undefined);
        const childUsed = countInCart(cartArr, li.itemId, li.variantId || undefined);
        // How many of THIS child does THIS package consume?
        const thisConsumes = (li.qty || 1) * ci.qty;
        // Available for this package = childStock - (childUsed - thisConsumes) → then /li.qty
        const usedByOthers = childUsed - thisConsumes;
        const availForThis = Math.max(0, childStock - usedByOthers);
        maxPkgs = Math.min(maxPkgs, Math.floor(availForThis / li.qty));
      }
      const cap = Math.min(maxPkgs === Infinity ? 0 : maxPkgs, gear.stock || 0);
      if (ci.qty > cap) { changed = true; return { ...ci, qty: cap }; }
      return ci;
    }).filter(i => i.qty > 0);
    return changed ? result : cartArr;
  }

  function addToCart(item: GearItem, variant?: GearVariant, keepOpen?: boolean, linkedVars?: LinkedVariantSelection[]) {
    const cartKey = variant ? `${item.id}__${variant.id}` :
      linkedVars?.length ? `${item.id}__pkg_${linkedVars.map(v => v.variantId).sort().join("_")}` : item.id;
    const cartPrice = variant ? variant.price : item.price;
    setCart(prev => {
      let next: CartItem[];
      const ex = prev.find(i => getCartKey(i) === cartKey);
      if (ex) {
        next = prev.map(i => getCartKey(i) === cartKey ? { ...i, qty: i.qty + 1 } : i);
      } else {
        next = [...prev, { ...item, price: cartPrice, qty: 1, addSetup: false, selectedVariant: variant, linkedVariants: linkedVars }];
      }
      return revalidateCart(next);
    });
    if (!keepOpen) {
      setShowItemModal(false);
      setSelectedVariant(null);
      setLinkedVarSelections({});
    }
    setAddToast(variant ? `${item.name} (${[variant.color?.label, variant.size].filter(Boolean).join(", ")})` : item.name);
    setTimeout(() => setAddToast(null), 2000);
  }

  function removeFromCart(key: string) { setCart(prev => prev.filter(i => getCartKey(i) !== key)); }

  // Count how many of an item are "reserved" in the cart — both direct + via packages
  function getEffectiveInCart(itemId: string, variantId?: string): number {
    let count = 0;
    for (const ci of cart) {
      // Direct cart entry for this item
      if (ci.id === itemId) {
        if (!variantId || ci.selectedVariant?.id === variantId) count += ci.qty;
      }
      // Package in cart that links to this item
      if (ci.linkedItems) {
        for (const li of ci.linkedItems) {
          if (li.itemId === itemId) {
            // Check variant from vendor-locked (linkedItems.variantId) or customer-picked (linkedVariants)
            const resolvedVariantId = li.variantId || ci.linkedVariants?.find(lv => lv.itemId === itemId)?.variantId;
            if (!variantId || resolvedVariantId === variantId) count += (li.qty || 1) * ci.qty;
          }
        }
      }
    }
    return count;
  }
  
  function updateCartQty(key: string, delta: number) {
    if (delta > 0) {
      const cartItem = cart.find(i => getCartKey(i) === key);
      if (cartItem) {
        const vid = cartItem.selectedVariant?.id;
        
        const variantAvail = vid ? getAvailableStock(cartItem.id, vid) : getAvailableStock(cartItem.id);
        const totalAvail = getAvailableStock(cartItem.id);
        const totalItemInCart = getEffectiveInCart(cartItem.id);

        // FIX 3: Variant-level cross-deduction (addons consumed by packages and vice versa)
        if (vid) {
          const variantInCart = getEffectiveInCart(cartItem.id, vid);
          if (variantInCart >= variantAvail) return;
        }

        // Block if hitting variant ceiling or overall item ceiling
        if (cartItem.qty >= variantAvail || totalItemInCart >= totalAvail) {
          return; 
        }
      }
    }

    setCart(prev => {
      const updated = prev.map(i => getCartKey(i) === key ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0);
      return revalidateCart(updated);
    });
  }

  function toggleItemSetup(cartKey: string) {
    setCart(prev => prev.map(i => getCartKey(i) === cartKey ? { ...i, addSetup: !i.addSetup } : i));
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
  const rule = discounts.filter(d => {
    if (d.type !== "nightly_discount" || (d.trigger_nights ?? 0) > nights) return false;
    if (d.maxUses != null && (d.usedCount ?? 0) >= d.maxUses) return false;
    const now = new Date();
    if (d.validFrom && now < new Date(d.validFrom)) return false;
    if (d.validUntil && now > new Date(d.validUntil)) return false;
    return true;
  }).sort((a, b) => b.discount_percent - a.discount_percent)[0];
  if (rule) { const fn = (rule.trigger_nights ?? 0) - 1; const dn = nights - fn; if (dn > 0) autoDisc = dailyTotal * dn * (rule.discount_percent / 100); }
  
  // Promo discount
  // Promo discount — respects appliesTo for item-specific codes
  const promoDisc = (() => {
    if (!appliedPromo) return 0;
    
    // Calculate eligible subtotal based on appliesTo
    let eligibleSub = sub;
    if (appliedPromo.appliesTo?.type === "specific" && appliedPromo.appliesTo.itemIds?.length) {
      const eligibleIds = new Set(appliedPromo.appliesTo.itemIds);
      eligibleSub = cart.reduce((s, i) => eligibleIds.has(i.id) ? s + (i.price * i.qty * nights) : s, 0);
    }
    
    if (appliedPromo.discount_fixed) return Math.min(appliedPromo.discount_fixed, eligibleSub);
    return eligibleSub * (appliedPromo.discount_percent / 100);
  })();
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

  async function applyPromo() {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;

    // 1. Check vendor discounts first
    const found = discounts.find(d => d.type === "promo_code" && d.code === code);
    if (found) {
      if (found.maxUses != null && (found.usedCount ?? 0) >= found.maxUses) {
        setAppliedPromo(null); setPromoMsg({ text: "This code has reached its usage limit", success: false }); return;
      }
      const now = new Date();
      if (found.validFrom && now < new Date(found.validFrom)) {
        setAppliedPromo(null); setPromoMsg({ text: "This code is not yet active", success: false }); return;
      }
      if (found.validUntil && now > new Date(found.validUntil)) {
        setAppliedPromo(null); setPromoMsg({ text: "This code has expired", success: false }); return;
      }
      setAppliedPromo(found);
      setPromoMsg({ text: `Success! ${found.discount_percent}% Off Applied`, success: true });
      return;
    }

    // 2. Fallback: check customer referral codes
    if (!vendorId) { setAppliedPromo(null); setPromoMsg({ text: "Invalid Code", success: false }); return; }
    try {
      const refSnap = await getDocsFromServer(
        query(collection(db, "vendors", vendorId, "referrals"), where("code", "==", code))
      );
      if (!refSnap.empty) {
        const ref = refSnap.docs[0].data();
        if (!ref.isActive) { setAppliedPromo(null); setPromoMsg({ text: "This code is no longer active", success: false }); return; }
        if (ref.maxUses && ref.usedCount >= ref.maxUses) { setAppliedPromo(null); setPromoMsg({ text: "This code has reached its usage limit", success: false }); return; }
        if (ref.expiresAt && ref.expiresAt.toDate() < new Date()) { setAppliedPromo(null); setPromoMsg({ text: "This code has expired", success: false }); return; }

        const asDiscount: Discount = {
          type: "promo_code",
          code: ref.code,
          discount_percent: ref.discountType === "percent" ? ref.discountValue : 0,
          discount_fixed: ref.discountType === "fixed" ? ref.discountValue : 0,
          ...(ref.appliesTo ? { appliesTo: ref.appliesTo } : {}),
        };
        setAppliedPromo(asDiscount);
        const label = ref.discountType === "percent" ? `${ref.discountValue}% Off` : `RM${ref.discountValue} Off`;
        const itemNote = ref.appliesTo?.type === "specific" ? " (selected items only)" : "";
        setPromoMsg({ text: `Success! ${label} Applied${itemNote}`, success: true });
        return;
      }
    } catch (e) {
      console.error("Referral lookup error:", e);
    }

    setAppliedPromo(null);
    setPromoMsg({ text: "Invalid Code", success: false });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WHATSAPP ORDER
  // ═══════════════════════════════════════════════════════════════════════════

  async function sendWhatsAppOrder() {
    if (isSending) return;
    setIsSending(true);

    const pickupDate = (cpRef.current as any)?._input?.value;
    const returnDate = (opRef.current as any)?._input?.value;
    
    // Build cart items with prices and setup
    const cartLines = cart.map(i => {
      const variantLabel = i.selectedVariant
        ? ` [${[i.selectedVariant.color?.label, i.selectedVariant.size].filter(Boolean).join(", ")}]`
        : "";
      let line = `• ${i.name}${variantLabel} (x${i.qty}) - RM${i.price * i.qty}`;
      // Show package included items
      if (i.linkedItems && i.linkedItems.length > 0) {
        const includedNames = i.linkedItems.map(li => {
          const gear = allGear.find(g => g.id === li.itemId);
          const vLabel = li.variantId
            ? (li.variantLabel || i.linkedVariants?.find(lv => lv.itemId === li.itemId)?.variantLabel || "")
            : (i.linkedVariants?.find(lv => lv.itemId === li.itemId)?.variantLabel || "");
          return `${gear?.name || "Item"} x${li.qty}${vLabel ? ` [${vLabel}]` : ""}`;
        });
        line += `%0A  ↳ Includes: ${includedNames.join(", ")}`;
      } else if (i.linkedVariants?.length) {
        line += `%0A  ↳ ${i.linkedVariants.map(lv => lv.variantLabel).join(", ")}`;
      }
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

    // Mock-up shop: Different message for demo inquiries
    const isMockupShop = vendorId === MOCKUP_VENDOR_ID || vendorData?.is_mockup === true;
    
    let msg: string;
    if (isMockupShop) {
      msg = `Hi Pacak Khemah,%0A%0AI just tried the DEMO SHOP and I'm interested in becoming a vendor!%0A%0A📦 *DEMO ORDER PREVIEW*%0A${cartLines}` +
        `%0A%0A📅 *DATES*%0APick-up: ${pickupDate}%0AReturn: ${returnDate}%0ADuration: ${nights} night${nights > 1 ? "s" : ""}` +
        fulfillmentSection +
        pricingSection +
        `%0A%0A----%0A🚀 I want to register my own shop like this!`;
    } else {
      msg = `Hi ${vendorData?.name}, Booking Request:%0A` +
        `%0A📦 *ITEMS*%0A${cartLines}` +
        `%0A%0A📅 *DATES*%0APick-up: ${pickupDate}%0AReturn: ${returnDate}%0ADuration: ${nights} night${nights > 1 ? "s" : ""}` +
        fulfillmentSection +
        pricingSection;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // CRITICAL: Open WhatsApp NOW — synchronously, before any await.
    // Mobile browsers (esp. Chrome/Safari on iOS + some Android builds) block
    // window.open() as a popup if it runs AFTER an await. By opening here we
    // keep the call inside the user-gesture window. All Firestore writes
    // happen in the background after the tab is already navigating.
    // ═════════════════════════════════════════════════════════════════════════
    const rawPhone = isMockupShop ? ADMIN_WHATSAPP : (vendorData?.phone || "");
    const cleanPhone = rawPhone.replace(/[\s\-\+\(\)]/g, "");
    window.open(`https://wa.me/${cleanPhone}?text=${msg}`, "_blank");

    // Background writes — wrap in try/finally so the button always re-enables.
    try {
      // Analytics & credits - Skip for mock-up shops
      if (!isMockupShop) {
      // Visitor fingerprint for repeat lead detection
      let visitorId = localStorage.getItem("pk_visitor_id");
      if (!visitorId) {
        visitorId = crypto.randomUUID();
        localStorage.setItem("pk_visitor_id", visitorId);
      }
      const visitKey = `pk_visited_${vendorId}`;
      const hasVisitedBefore = !!localStorage.getItem(visitKey);
      localStorage.setItem(visitKey, "1");

      // Always log analytics lead for every order
      try {
        await addDoc(collection(db, "analytics"), {
          vendorId, vendorName: vendorData?.name, totalAmount: total,
          timestamp: serverTimestamp(), type: "whatsapp_lead",
          visitorId,
          isRepeatVisitor: hasVisitedBefore,
          fulfillmentType,
          deliveryAddress: fulfillmentType === "delivery" ? deliveryAddress : null,
          deliveryZone: selectedZone?.name || null,
          timeSlot: selectedTimeSlot?.label || null,
          bookingDates: { start: pickupDate, end: returnDate },
          cartItems: cart.map(i => ({ 
            id: i.id, name: i.name, qty: i.qty, price: i.price,
            addSetup: i.addSetup || false,
            setupFee: i.addSetup && i.setup?.fee ? i.setup.fee : 0,
            ...(i.selectedVariant ? { variantId: i.selectedVariant.id, variantLabel: [i.selectedVariant.color?.label, i.selectedVariant.size].filter(Boolean).join(", ") } : {}),
            ...(i.linkedVariants?.length ? { linkedVariants: i.linkedVariants } : {}),
          })),
        });
      } catch (e) { console.error("Analytics write error:", e); }

      // Credit deduction - 1 per unique customer per 24hrs
      const storageKey = `click_${vendorId}`;
      const lastClick = localStorage.getItem(storageKey);
      if (!lastClick || Date.now() - Number(lastClick) > 86400000) {
        try {
          let deducted = false;
          await runTransaction(db, async (t) => {
            const vRef = doc(db, "vendors", vendorId!);
            const vDoc = await t.get(vRef);
            const c = vDoc.data()?.credits || 0;
            if (c > 0) {
              t.update(vRef, { credits: c - 1 });
              deducted = true;
            }
          });
          if (deducted) localStorage.setItem(storageKey, String(Date.now()));
        } catch (e) { console.error("Credit deduction error:", e); }
      }

      // ═══ Create order in orders collection ═══
      try {
        // Pre-fill customer info from localStorage (saved during previous agreement)
        let savedPhone = "";
        let savedName = "";
        try {
          const pk = localStorage.getItem("pk_customer");
          if (pk) {
            const parsed = JSON.parse(pk);
            savedPhone = parsed.phone || "";
            savedName = parsed.name || "";
          }
        } catch { /* ignore */ }

        const orderData = {
          vendorId,
          vendorName: vendorData?.name || "",
          vendorSlug: vendorData?.slug || "",
          customerPhone: savedPhone,
          customerName: savedName,
          items: cart.map(i => ({
            id: i.id, name: i.name, qty: i.qty, price: i.price,
            addSetup: i.addSetup || false,
            setupFee: i.addSetup && i.setup?.fee ? i.setup.fee : 0,
            ...(i.selectedVariant ? {
              variantId: i.selectedVariant.id,
              variantLabel: [i.selectedVariant.color?.label, i.selectedVariant.size].filter(Boolean).join(", "),
              variantColor: i.selectedVariant.color?.hex || null,
            } : {}),
            ...(i.linkedVariants?.length ? { linkedVariants: i.linkedVariants } : {}),
            ...(i.linkedItems?.length ? {
              linkedItems: i.linkedItems.map(li => {
                const linkedGear = allGear.find(g => g.id === li.itemId);
                const customerVariant = i.linkedVariants?.find(lv => lv.itemId === li.itemId);
                const resolvedVariantId = li.variantId || customerVariant?.variantId;
                const resolvedVariant = linkedGear?.variants?.find(v => v.id === resolvedVariantId);
                const resolvedLabel = resolvedVariant
                  ? [resolvedVariant.color?.label, resolvedVariant.size].filter(Boolean).join(", ")
                  : li.variantLabel || customerVariant?.variantLabel;
                return {
                  itemId: li.itemId,
                  name: linkedGear?.name || li.itemId,
                  qty: li.qty,
                  ...(resolvedVariantId ? {
                    variantId: resolvedVariantId,
                    variantLabel: resolvedLabel,
                    variantColor: resolvedVariant?.color?.hex || li.variantColor || null,
                  } : {}),
                };
              }),
            } : {}),
          })),
          totalAmount: total,
          depositAmount: Math.round(dep),
          rentalAmount: Math.round(total - dep),
          pickupLocation: fulfillmentType === "pickup" ? selectedHub : deliveryAddress,
          fulfillmentType,
          deliveryZone: selectedZone?.name || null,
          timeSlot: selectedTimeSlot?.label || null,
          bookingDates: { start: pickupDate, end: returnDate },
          status: "pending" as const,
          createdAt: serverTimestamp(),
          ...(appliedPromo ? {
            promoCode: appliedPromo.code,
            promoDiscount: Math.round(promoDisc),
            promoType: appliedPromo.discount_fixed ? "fixed" : "percent",
          } : {}),
          ...(showAuto ? { autoDiscount: Math.round(autoDisc) } : {}),
        };
        const orderRef = await addDoc(collection(db, "orders"), orderData);

        // Track usage on vendor discount / nightly discount rules
        const usageEntry = { phone: savedPhone, name: savedName, orderId: orderRef.id, date: new Date().toISOString() };
        if (appliedPromo?.id && vendorId) {
          await updateDoc(doc(db, "vendors", vendorId, "discounts", appliedPromo.id), {
            usedCount: increment(1),
            usedBy: arrayUnion(usageEntry),
          }).catch(() => {});
        }
        if (showAuto && rule?.id && vendorId) {
          await updateDoc(doc(db, "vendors", vendorId, "discounts", rule.id), {
            usedCount: increment(1),
            usedBy: arrayUnion(usageEntry),
          }).catch(() => {});
        }

        // Note: Calendar blocking handled by vendor via OrdersTab "Create Booking"
        // or automatically by Cloud Function when agreement is signed

        // Save booking data to localStorage for agreement page
        localStorage.setItem("current_booking", JSON.stringify({
          vendorId,
          orderId: orderRef.id,
          items: cart.map(i => {
            let name = i.name;
            if (i.selectedVariant) name += ` (${[i.selectedVariant.color?.label, i.selectedVariant.size].filter(Boolean).join(", ")})`;
            if (i.linkedVariants?.length) name += ` [${i.linkedVariants.map(lv => lv.variantLabel).join(", ")}]`;
            return { name, qty: i.qty, price: i.price };
          }),
          dates: { start: pickupDate, end: returnDate },
          total,
        }));
      } catch (e) { console.error("Order creation error:", e); }
      
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
    }
    } finally {
      setIsSending(false);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  // Sort categories: Packages first, then main items, then add-ons/accessories last
  const sortCategories = (cats: string[]): string[] => {
    const packagesFirst = ["Packages", "Package", "Pakej"];
    const accessoriesLast = ["Add-ons", "Add-on", "Addon", "Accessories", "Accessory", "Aksesori", "Others", "Lain-lain"];
    
    return cats.sort((a, b) => {
      const aIsPackage = packagesFirst.some(p => a.toLowerCase().includes(p.toLowerCase()));
      const bIsPackage = packagesFirst.some(p => b.toLowerCase().includes(p.toLowerCase()));
      const aIsAccessory = accessoriesLast.some(p => a.toLowerCase().includes(p.toLowerCase()));
      const bIsAccessory = accessoriesLast.some(p => b.toLowerCase().includes(p.toLowerCase()));
      
      if (aIsPackage && !bIsPackage) return -1;
      if (!aIsPackage && bIsPackage) return 1;
      if (aIsAccessory && !bIsAccessory) return 1;
      if (!aIsAccessory && bIsAccessory) return -1;
      return a.localeCompare(b);
    });
  };
  
  const categories = sortCategories(Array.from(new Set(allGear.map(g => g.category || (g.type === "package" ? "Packages" : "Add-ons")))));
  
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

  function getLinkedItemsData(item: GearItem): { item: GearItem; qty: number; lockedVariantId?: string; lockedVariantLabel?: string; lockedVariantColor?: string }[] {
    if (!item.linkedItems || item.linkedItems.length === 0) return [];
    return item.linkedItems
      .map(li => {
        const linkedItem = allGear.find(g => g.id === li.itemId);
        return linkedItem ? { item: linkedItem, qty: li.qty, lockedVariantId: li.variantId, lockedVariantLabel: li.variantLabel, lockedVariantColor: li.variantColor } : null;
      })
      .filter(Boolean) as { item: GearItem; qty: number; lockedVariantId?: string; lockedVariantLabel?: string; lockedVariantColor?: string }[];
  }

  const rating = vendorData?.rating || 0;
  const reviewCount = vendorData?.reviewCount || 0;
  
  // Mock-up detection
  const isMockup = vendorId === MOCKUP_VENDOR_ID || vendorData?.is_mockup === true;
  const whatsappNumber = (isMockup ? ADMIN_WHATSAPP : vendorData?.phone)?.replace(/[\s\-\+\(\)]/g, "");
  
  // Auto-calculate badges based on vendor data
  const calculatedBadges: Badge[] = [];
  if (vendorData?.status === "approved") calculatedBadges.push("verified");
  if ((vendorData?.total_orders || 0) >= 30 && rating >= 4.7) calculatedBadges.push("top_rated");
  if ((vendorData?.avg_response_time || 999) <= 120) calculatedBadges.push("fast_responder");
  
  // Combine auto badges with manual badges from Firestore
  const allBadges: Badge[] = [...new Set([...calculatedBadges, ...(vendorData?.badges || [])])];

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
      {/* Mock-up Banner */}
      {isMockup && <MockupBanner />}
      {isMockup && <DemoShopGuide />}
      
      {ownerPreview && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-amber-400 text-[#062c24] px-4 py-2 rounded-full text-[10px] font-black uppercase shadow-xl z-[200] animate-bounce">PREVIEW MODE</div>
      )}

      {/* Hero Header */}
      <header className="bg-[#062c24] text-white relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'><path fill='none' stroke='white' stroke-width='1.2' d='M0 30 L30 0 L60 30 M0 60 L30 30 L60 60'/></svg>\")",
            backgroundSize: "60px 60px",
          }}
        />
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
        <div id="demo-hero" className="relative z-10 flex flex-col items-center text-center px-6 pt-6 pb-2">
          <div className="w-20 h-20 bg-white rounded-2xl p-1 shadow-2xl mb-4">
            <img src={vendorData?.image || "/pacak-khemah.png"} className="w-full h-full object-cover rounded-[0.9rem]" alt="logo" />
          </div>
          
          {/* Vendor Name + Badges */}
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-xl font-black uppercase tracking-tight">{vendorData?.name || "Loading..."}</h1>
            {allBadges.length > 0 && (
              <div className="flex items-center gap-1">
                {allBadges.slice(0, 3).map(badge => (
                  <BadgeIcon key={badge} badge={badge} size="sm" />
                ))}
                {allBadges.length > 3 && (
                  <span className="text-[9px] text-white/60 font-bold">+{allBadges.length - 3}</span>
                )}
              </div>
            )}
          </div>
          
          {allBadges.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5 mb-3">
              {allBadges.map(badge => (
                <BadgePill key={badge} badge={badge} />
              ))}
            </div>
          )}

          {reviewCount > 0 && (
            <div className="bg-orange-500/20 text-orange-300 border border-orange-500/30 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide flex items-center gap-1.5 mb-3">
              <i className="fas fa-fire"></i>
              <span>{rating.toFixed(1)}</span>
              <span className="text-orange-200/60">({reviewCount} reviews)</span>
            </div>
          )}

          <div id="demo-services" className="flex flex-wrap justify-center gap-2 text-[9px] font-bold uppercase mb-3">
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

          <div className="flex gap-2 mb-2">
            {whatsappNumber && <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer" className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center hover:bg-emerald-500 transition-colors border border-white/10"><i className="fab fa-whatsapp text-sm"></i></a>}
            {vendorData?.tiktok && <a href={vendorData.tiktok} target="_blank" rel="noreferrer" className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors border border-white/10"><i className="fab fa-tiktok text-sm"></i></a>}
            {vendorData?.ig && <a href={vendorData.ig} target="_blank" rel="noreferrer" className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors border border-white/10"><i className="fab fa-instagram text-sm"></i></a>}
            {vendorData?.threads && <a href={vendorData.threads} target="_blank" rel="noreferrer" className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors border border-white/10"><i className="fab fa-threads text-sm"></i></a>}
            {vendorData?.fb && <a href={vendorData.fb} target="_blank" rel="noreferrer" className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors border border-white/10"><i className="fab fa-facebook text-sm"></i></a>}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-4 space-y-3">
        {specialOffer && (
          <div id="demo-offer" className="bg-gradient-to-r from-red-600 to-orange-500 p-3.5 rounded-2xl text-white text-center shadow-lg relative overflow-hidden">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/cubes.png')" }} />
            <p className="relative z-10 text-[10px] font-black uppercase tracking-widest"><i className="fas fa-fire mr-1"></i> SAVE {specialOffer.discount_percent}% ON STAYS OF {specialOffer.trigger_nights}+ NIGHTS!</p>
          </div>
        )}

        {/* Main Tabs */}
        <div id="demo-tabs" className="flex bg-white rounded-2xl p-1.5 border border-slate-100 shadow-sm">
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
            {(vendorData?.tagline || vendorData?.tagline_my) && (
              <div id="demo-about">
              <Section title="About Us" icon="fa-info-circle" defaultOpen={false}>
                <div className="space-y-3">
                  {vendorData.tagline && <p className="text-sm text-slate-700 leading-relaxed">{vendorData.tagline}</p>}
                  {vendorData.tagline_my && <p className="text-sm text-emerald-700 italic leading-relaxed">{vendorData.tagline_my}</p>}
                </div>
              </Section>
              </div>
            )}

            {vendorData?.steps && vendorData.steps.length > 0 && (
              <div id="demo-howto">
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
              </div>
            )}

            {/* My Bookings Section */}
            <Section title="My Bookings" icon="fa-receipt" defaultOpen={false}>
              {!myBookingsSearched ? (
                <div className="space-y-2">
                  <p className="text-[10px] text-slate-400 font-medium">Pernah booking sini? Masukkan nombor WhatsApp untuk lihat sejarah tempahan.</p>
                  <div className="flex gap-2">
                    <div className="flex-1 flex">
                      <span className="flex items-center bg-slate-100 border border-r-0 border-slate-200 px-2.5 rounded-l-xl text-[10px] font-bold text-slate-500 shrink-0">+60</span>
                      <input type="tel" value={myBookingsPhone} onChange={e => setMyBookingsPhone(e.target.value.replace(/[^0-9\-\s]/g, ""))}
                        placeholder="012-345 6789"
                        className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-r-xl text-xs font-bold outline-none focus:border-emerald-400"
                        onKeyDown={e => e.key === "Enter" && lookupMyBookings()} />
                    </div>
                    <button onClick={() => lookupMyBookings()} className="bg-[#062c24] text-white px-4 rounded-xl text-[10px] font-black uppercase shrink-0 hover:bg-emerald-800 transition-colors">
                      <i className="fas fa-search"></i>
                    </button>
                  </div>
                </div>
              ) : myBookingsLoading ? (
                <div className="py-6 text-center"><i className="fas fa-spinner fa-spin text-slate-300 text-lg"></i></div>
              ) : myBookings.length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-[10px] text-slate-400 font-bold">Tiada tempahan dijumpai</p>
                  <button onClick={() => { setMyBookingsSearched(false); setMyBookingsPhone(""); }}
                    className="text-[9px] font-bold text-emerald-600 mt-1 hover:underline">Cuba nombor lain</button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[9px] font-bold text-slate-400">{myBookings.length} tempahan dijumpai</p>
                  {myBookings.slice(0, 5).map(b => {
                    const statusStyle: Record<string, string> = {
                      pending: "bg-amber-50 text-amber-600", confirmed: "bg-blue-50 text-blue-600",
                      completed: "bg-emerald-50 text-emerald-600", cancelled: "bg-red-50 text-red-500",
                    };
                    return (
                      <div key={b.id} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-[#062c24]">
                              {b.bookingDates.start ? new Date(b.bookingDates.start).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "2-digit" }) : "—"}
                            </span>
                            <span className="text-[8px] text-slate-300">→</span>
                            <span className="text-[10px] font-bold text-[#062c24]">
                              {b.bookingDates.end ? new Date(b.bookingDates.end).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "2-digit" }) : "—"}
                            </span>
                          </div>
                          <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase ${statusStyle[b.status] || "bg-slate-100 text-slate-400"}`}>
                            {b.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] text-slate-500 truncate flex-1">{b.items.map(i => `${i.name} ×${i.qty}`).join(", ")}</p>
                          <span className="text-[10px] font-black text-emerald-600 ml-2 shrink-0">RM{b.rentalAmount ?? b.totalAmount}</span>
                        </div>
                      </div>
                    );
                  })}
                  {myBookings.length > 5 && (
                    <p className="text-[9px] text-center text-slate-400 font-bold">+ {myBookings.length - 5} lagi tempahan</p>
                  )}
                  <button onClick={() => { setMyBookingsSearched(false); setMyBookingsPhone(""); }}
                    className="text-[9px] font-bold text-emerald-600 hover:underline">Tukar nombor</button>
                </div>
              )}
            </Section>

            <Section title="Pick Your Date" icon="fa-calendar-alt" defaultOpen={true}>
              <div id="demo-dates" className="flex gap-3">
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
              
              <div className="relative mb-3">
                <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none rounded-l-xl" />
                <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none rounded-r-xl" />
                <div className="flex gap-2 overflow-x-auto py-2 px-1 scrollbar-hide" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
                  {categories.map(cat => (
                    <button key={cat} onClick={() => setActiveCategory(cat)}
                      className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase whitespace-nowrap transition-all ${activeCategory === cat ? "bg-[#062c24] text-white shadow-lg" : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-[#062c24]"}`}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Gear grid */}
              <div id="demo-gear" className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredGear(activeCategory || categories[0] || "").map((item, idx) => {
                  const avail = getAvailableStock(item.id);
                  const inCart = getEffectiveInCart(item.id);
                  const canAdd = avail > inCart;
                  const hasSetupOption = item.setup?.available;
                  const hasMultipleImages = (item.images?.length || 0) > 1;
                  const linkedItems = getLinkedItemsData(item);
                  const hasVars = item.hasVariants && item.variants && item.variants.length > 0;
                  const pricedVars = hasVars ? item.variants!.filter(v => v.price > 0) : [];
                  const priceRange = pricedVars.length > 0
                    ? { min: Math.min(...pricedVars.map(v => v.price)), max: Math.max(...pricedVars.map(v => v.price)) }
                    : null;
                  
                  return (
                    <div key={item.id} className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm stagger-in relative" style={{ animationDelay: `${idx * 50}ms` }}>
                      <div className="aspect-square relative cursor-pointer" onClick={() => { setSelectedItem(item); setSelectedVariant(null); setLinkedVarSelections({}); setShowItemModal(true); }}>
                        <img src={item.images?.[0] || item.img || "/placeholder.jpg"} className="w-full h-full object-cover" alt={item.name} loading="lazy" />
                        {hasMultipleImages && (
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                            {item.images!.slice(0, 5).map((_, i) => (
                              <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === 0 ? "bg-white" : "bg-white/50"}`} />
                            ))}
                          </div>
                        )}
                        <div className="absolute top-2 left-2 flex flex-col gap-1">
                          {item.type === "package" && <span className="bg-purple-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-md uppercase"><i className="fas fa-box mr-0.5"></i>Package</span>}
                          {hasSetupOption && <span className="bg-blue-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-md uppercase"><i className="fas fa-tools mr-0.5"></i>Setup</span>}
                          {linkedItems.length > 0 && <span className="bg-amber-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-md uppercase"><i className="fas fa-link mr-0.5"></i>{linkedItems.length} items</span>}
                        </div>
                        <div className="absolute top-2 right-2 flex flex-col items-end gap-1 z-10">
                          {inCart > 0 && (
                            <span className="bg-emerald-500 text-white text-[9px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow-lg">{inCart}</span>
                          )}
                          {/* Available stock indicator for packages */}
                          {item.type === "package" && avail > 0 && avail <= 3 && !inCart && (
                            <span className="bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-lg">{avail} left</span>
                          )}
                          {item.type === "package" && avail === 0 && !inCart && (
                            <span className="bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-lg">Sold Out</span>
                          )}
                          {!inCart && (
                            <button
                              onClick={(e) => { e.stopPropagation(); shareItem(item); }}
                              className="w-8 h-8 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/60 shadow-md transition-all"
                            >
                              <i className="fas fa-share-alt text-[10px]"></i>
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="p-3">
                        <p className="text-[10px] font-black uppercase truncate text-[#062c24]">{item.name}</p>
                        {/* Color swatches */}
                        {hasVars && (
                          <div className="flex gap-1 mt-1.5">
                            {item.variants!.slice(0, 6).map(v => (
                              <div key={v.id} className="w-4 h-4 rounded-full border border-slate-200 shadow-sm" style={{ backgroundColor: v.color?.hex || "#ccc" }} title={v.color?.label || v.size || ""} />
                            ))}
                            {item.variants!.length > 6 && <span className="text-[8px] text-slate-400 font-bold self-center">+{item.variants!.length - 6}</span>}
                          </div>
                        )}
                        {/* Spec pills */}
                        {!hasVars && item.specs && (item.specs.maxPax || item.specs.size || item.specs.puRating || item.specs.layers || item.specs.weight || item.specs.tentType) && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.specs.tentType ? <span className="text-[7px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">{item.specs.tentType}</span> : null}
                            {item.specs.maxPax ? <span className="text-[7px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">{item.specs.maxPax}P</span> : null}
                            {item.specs.puRating ? <span className="text-[7px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">{item.specs.puRating}</span> : null}
                            {item.specs.layers ? <span className="text-[7px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">{item.specs.layers === "Double Layer" ? "Double" : "Single"}</span> : null}
                            {item.specs.size ? <span className="text-[7px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">{item.specs.size}</span> : null}
                            {item.specs.weight ? <span className="text-[7px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">{item.specs.weight}</span> : null}
                          </div>
                        )}
                        {item.pickupLocation && (
                          <p className="text-[7px] font-bold text-emerald-600 mt-1"><i className="fas fa-map-marker-alt mr-1"></i>{item.pickupLocation}</p>
                        )}
                        {/* Price */}
                        <p className="text-[10px] font-bold text-emerald-600 mt-1">
                          {priceRange && priceRange.min !== priceRange.max
                            ? `RM ${priceRange.min} – ${priceRange.max}/night`
                            : `RM ${item.price}/night`
                          }
                        </p>
                        {/* Add to cart / Select variant */}
                        {hasVars ? (
                          <button onClick={() => { setSelectedItem(item); setSelectedVariant(null); setLinkedVarSelections({}); setShowItemModal(true); }}
                            className="w-full mt-2 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all bg-[#062c24] text-white hover:bg-emerald-800 active:scale-95">
                            Select Variant
                          </button>
                        ) : inCart > 0 ? (
                          <div className="flex items-center mt-2 gap-1">
                            <button onClick={(e) => { e.stopPropagation(); updateCartQty(item.id, -1); }}
                              className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-500 flex items-center justify-center text-sm font-black transition-colors">
                              {inCart === 1 ? <i className="fas fa-trash text-[9px]"></i> : "−"}
                            </button>
                            <span className="flex-1 text-center text-xs font-black text-[#062c24]">{inCart}</span>
                            <button onClick={(e) => { e.stopPropagation(); canAdd && addToCart(item); }} disabled={!canAdd}
                              className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black transition-colors ${canAdd ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" : "bg-slate-50 text-slate-300 cursor-not-allowed"}`}>
                              +
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => canAdd && addToCart(item)} disabled={!canAdd}
                            className={`w-full mt-2 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${canAdd ? "bg-[#062c24] text-white hover:bg-emerald-800 active:scale-95" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}>
                            {canAdd ? "Add to Cart" : avail === 0 ? "Sold Out" : "Max Added"}
                          </button>
                        )}
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
                  {post.pinned && <span className="inline-block bg-amber-100 text-amber-600 text-[8px] font-black px-2 py-0.5 rounded-md uppercase mb-2"><i className="fas fa-thumbtack mr-1"></i>Pinned</span>}
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{post.content}</p>
                  {post.image && <img src={post.image} className="mt-3 rounded-xl w-full max-h-64 object-cover" alt="" loading="lazy" />}
                  <p className="text-[9px] text-slate-400 mt-2">{post.createdAt?.seconds ? formatTimeAgo(new Date(post.createdAt.seconds * 1000)) : ""}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* REVIEWS TAB */}
        {mainTab === "reviews" && (
          <div className="space-y-4">
            {/* Rating Summary */}
            {reviewCount > 0 && (
              <div className="bg-white rounded-2xl p-6 border border-slate-100">
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-4xl font-black text-[#062c24]">{rating.toFixed(1)}</p>
                    <div className="flex gap-0.5 justify-center my-1">
                      {[1,2,3,4,5].map(s => (
                        <i key={s} className={`fas fa-star text-xs ${s <= Math.round(rating) ? "text-amber-400" : "text-slate-200"}`}></i>
                      ))}
                    </div>
                    <p className="text-[9px] text-slate-400 font-bold">{reviewCount} reviews</p>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    {[5,4,3,2,1].map(s => {
                      const count = (vendorData as any)?.ratingBreakdown?.[s] || 0;
                      const pct = reviewCount > 0 ? (count / reviewCount) * 100 : 0;
                      return (
                        <div key={s} className="flex items-center gap-2">
                          <span className="text-[9px] font-bold text-slate-400 w-3">{s}</span>
                          <i className="fas fa-star text-[8px] text-amber-400"></i>
                          <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div className="bg-amber-400 h-full rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                          </div>
                          <span className="text-[8px] font-bold text-slate-300 w-5 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Review Cards */}
            {reviews.length > 0 ? (
              <div className="space-y-3">
                {reviews.map(r => (
                  <div key={r.id} className="bg-white rounded-2xl p-5 border border-slate-100">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-black text-sm">
                          {(r.customerName || "C")[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#062c24]">
                            {r.customerName || "Camper"}
                            {r.isVerified && <i className="fas fa-check-circle text-emerald-500 text-[9px] ml-1.5"></i>}
                          </p>
                          <div className="flex gap-0.5 mt-0.5">
                            {[1,2,3,4,5].map(s => (
                              <i key={s} className={`fas fa-star text-[9px] ${s <= r.rating ? "text-amber-400" : "text-slate-200"}`}></i>
                            ))}
                          </div>
                        </div>
                      </div>
                      <span className="text-[8px] text-slate-300 font-bold">
                        {r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" }) : ""}
                      </span>
                    </div>
                    {r.comment && <p className="text-xs text-slate-500 leading-relaxed">{r.comment}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
                <i className="fas fa-star text-amber-300 text-4xl mb-3"></i>
                <p className="text-slate-400 text-sm font-bold">No reviews yet</p>
                <p className="text-[10px] text-slate-300 mt-1">Be the first to rent and leave a review!</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Cart Button */}
      {cartCount > 0 && (
        <button id="demo-cart-btn" onClick={() => setShowCart(true)}
          className="fixed bottom-6 right-6 bg-[#062c24] text-white w-16 h-16 rounded-2xl shadow-2xl flex items-center justify-center z-[100] hover:bg-emerald-800 active:scale-95 transition-all">
          <i className="fas fa-shopping-cart text-xl"></i>
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center">{cartCount}</span>
        </button>
      )}

      {/* Item Modal — dynamically imported, only loads when a gear card is tapped */}
      {showItemModal && selectedItem && (
        <ItemDetailModal
          selectedItem={selectedItem}
          selectedVariant={selectedVariant}
          linkedVarSelections={linkedVarSelections}
          cart={cart}
          onClose={() => setShowItemModal(false)}
          onShare={shareItem}
          onSelectVariant={setSelectedVariant}
          onSelectLinkedVariant={(itemId, variant) =>
            setLinkedVarSelections(prev => ({ ...prev, [itemId]: variant }))
          }
          getAvailableStock={getAvailableStock}
          getEffectiveInCart={getEffectiveInCart}
          getLinkedItemsData={getLinkedItemsData}
          getCartKey={getCartKey}
          updateCartQty={updateCartQty}
          addToCart={addToCart}
        />
      )}

      {/* CART MODAL */}
      {showCart && (
        <div className="fixed inset-0 bg-[#062c24]/95 backdrop-blur-md z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-50 flex justify-between items-center">
              <h3 className="text-lg font-black text-[#062c24] uppercase">Your Cart</h3>
              <button onClick={() => setShowCart(false)} className="w-11 h-11 rounded-full bg-slate-50 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors"><i className="fas fa-times"></i></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-5" style={{ scrollbarWidth: "none" }}>
              <div className="space-y-2">
                {cart.map(item => {
                  const key = getCartKey(item);
                  const variantLabel = item.selectedVariant
                    ? [item.selectedVariant.color?.label, item.selectedVariant.size].filter(Boolean).join(", ")
                    : null;
                  return (
                    <div key={key} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0 mr-3">
                          <div className="flex items-center gap-1.5">
                            {item.selectedVariant?.color?.hex && (
                              <span className="w-3.5 h-3.5 rounded-full border border-slate-200 shrink-0" style={{ backgroundColor: item.selectedVariant.color.hex }}></span>
                            )}
                            <p className="text-[10px] font-black uppercase truncate">{item.name}</p>
                          </div>
                          {variantLabel && <p className="text-[8px] font-bold text-teal-600 mt-0.5">{variantLabel}</p>}
                          {item.linkedVariants && item.linkedVariants.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {item.linkedVariants.map(lv => (
                                <span key={lv.itemId} className="text-[7px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5">
                                  {lv.variantColor && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: lv.variantColor }}></span>}
                                  {lv.variantLabel}
                                </span>
                              ))}
                            </div>
                          )}
                          {/* Package included items */}
                          {item.linkedItems && item.linkedItems.length > 0 && (
                            <div className="mt-1.5 pl-2 border-l-2 border-purple-200 space-y-0.5">
                              {item.linkedItems.map(li => {
                                const linkedGear = allGear.find(g => g.id === li.itemId);
                                if (!linkedGear) return null;
                                const resolvedVariant = li.variantId
                                  ? li.variantLabel || linkedGear.variants?.find(v => v.id === li.variantId)?.color?.label
                                  : item.linkedVariants?.find(lv => lv.itemId === li.itemId)?.variantLabel;
                                return (
                                  <div key={li.itemId} className="flex items-center gap-1.5">
                                    <span className="text-[7px] text-purple-400">↳</span>
                                    <span className="text-[8px] font-bold text-slate-500">{linkedGear.name} ×{li.qty}</span>
                                    {resolvedVariant && (
                                      <span className="text-[7px] font-bold text-teal-500 bg-teal-50 px-1 py-0.5 rounded">{resolvedVariant}</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <p className="text-[9px] font-bold text-slate-400">RM {item.price} × {item.qty} = RM {item.price * item.qty}</p>
                        </div>
                        <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-100 p-1">
                          <button onClick={() => updateCartQty(key, -1)} className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors font-black">−</button>
                          <span className="text-xs font-black text-[#062c24] w-5 text-center">{item.qty}</span>
                          <button onClick={() => updateCartQty(key, 1)} className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors font-black">+</button>
                        </div>
                      </div>
                      {fulfillmentType === "delivery" && item.setup?.available && !useCombo && (
                        <label className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100 cursor-pointer">
                          <input type="checkbox" checked={item.addSetup || false} onChange={() => toggleItemSetup(getCartKey(item))} className="w-4 h-4 accent-blue-500 rounded" />
                          <span className="text-[9px] font-bold text-blue-600 uppercase"><i className="fas fa-tools mr-1"></i>Add Setup +RM{item.setup.fee}</span>
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Date Selection */}
              <div className="bg-gradient-to-br from-emerald-50/50 to-slate-50 p-4 rounded-2xl border border-emerald-100">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-3 flex items-center gap-2"><i className="fas fa-calendar-alt text-emerald-500"></i>Rental Dates</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[8px] font-black text-slate-400 uppercase block mb-1 ml-1">Pickup</label>
                    <input id="cart-checkin-date" readOnly className="w-full bg-white border border-slate-200 text-xs font-bold text-[#062c24] outline-none text-center py-3 rounded-xl focus:ring-2 focus:ring-emerald-500 cursor-pointer" placeholder="Select" />
                  </div>
                  <div>
                    <label className="text-[8px] font-black text-emerald-600 uppercase block mb-1 ml-1">Return</label>
                    <input id="cart-checkout-date" readOnly className="w-full bg-white border border-slate-200 text-xs font-bold text-[#062c24] outline-none text-center py-3 rounded-xl focus:ring-2 focus:ring-emerald-500 cursor-pointer" placeholder="Select" />
                  </div>
                </div>
                {nights > 0 && <p className="text-[9px] font-bold text-emerald-600 text-center mt-2"><i className="fas fa-moon mr-1"></i>{nights} Night{nights > 1 ? "s" : ""}</p>}
              </div>

              {hasDelivery && (
                <div className="bg-gradient-to-br from-slate-50 to-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-3 flex items-center gap-2"><i className="fas fa-truck text-emerald-500"></i>Fulfillment Method</p>
                  <div className="flex gap-2 mb-3">
                    <button onClick={() => { setFulfillmentType("pickup"); setUseCombo(false); }}
                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${fulfillmentType === "pickup" ? "bg-[#062c24] text-white shadow-lg" : "bg-white text-slate-500 border border-slate-200 hover:border-emerald-300"}`}>
                      <i className="fas fa-store mr-1.5"></i>Self Pickup
                    </button>
                    <button onClick={() => setFulfillmentType("delivery")}
                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${fulfillmentType === "delivery" ? "bg-[#062c24] text-white shadow-lg" : "bg-white text-slate-500 border border-slate-200 hover:border-emerald-300"}`}>
                      <i className="fas fa-shipping-fast mr-1.5"></i>Delivery
                    </button>
                  </div>
                  {fulfillmentType === "pickup" && (
                    <div className="relative">
                      <label className="text-[9px] font-black text-slate-300 uppercase mb-1.5 block ml-1">Pickup Point</label>
                      <select value={selectedHub} onChange={e => setSelectedHub(e.target.value)} className="w-full bg-white p-3.5 rounded-xl text-xs font-bold outline-none border border-slate-200 appearance-none">
                        {(vendorData?.pickup || [vendorData?.city]).filter(Boolean).map(h => (<option key={h} value={h!}>{h}</option>))}
                      </select>
                      <i className="fas fa-chevron-down absolute right-4 bottom-4 text-slate-400 text-xs pointer-events-none"></i>
                    </div>
                  )}
                  {fulfillmentType === "delivery" && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[9px] font-black text-slate-300 uppercase mb-1.5 block ml-1"><i className="fas fa-map-marker-alt text-red-400 mr-1"></i>Delivery Address</label>
                        <textarea value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder="Enter campsite / delivery address..." rows={2}
                          className="w-full bg-white p-3.5 rounded-xl text-xs font-bold outline-none border border-slate-200 resize-none focus:border-emerald-500" />
                      </div>
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
                      {services?.delivery?.pricingType === "per_km" && (
                        <div>
                          <label className="text-[9px] font-black text-slate-300 uppercase mb-1.5 block ml-1">Distance (km) • RM{services.delivery?.perKmRate ?? 0}/km, min RM{services.delivery?.minFee ?? 0}</label>
                          <input type="number" value={deliveryDistance} onChange={e => setDeliveryDistance(e.target.value)} placeholder="Enter distance in km"
                            className="w-full bg-white p-3.5 rounded-xl text-xs font-bold outline-none border border-slate-200 focus:border-emerald-500" />
                          {deliveryDistance && <p className="text-[10px] font-bold text-emerald-600 mt-1 ml-1">Delivery Fee: RM {deliveryFee}</p>}
                        </div>
                      )}
                      {services?.delivery?.pricingType === "fixed" && (
                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                          <p className="text-[10px] font-bold text-slate-500"><i className="fas fa-truck text-emerald-500 mr-1"></i>Delivery Fee: <span className="text-emerald-600 font-black">RM {services.delivery?.fixedFee ?? 0}</span></p>
                          {(services.delivery?.freeAbove ?? 0) > 0 && subAfterDisc < (services.delivery?.freeAbove ?? 0) && (
                            <p className="text-[9px] text-amber-600 mt-1"><i className="fas fa-info-circle mr-1"></i>Free delivery for orders above RM {services.delivery?.freeAbove ?? 0}</p>
                          )}
                        </div>
                      )}
                      {services?.delivery?.pricingType === "quote" && (
                        <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                          <p className="text-[10px] font-bold text-amber-700"><i className="fas fa-comments mr-1"></i>Delivery fee will be confirmed via WhatsApp</p>
                        </div>
                      )}
                      {services?.delivery?.notes && <p className="text-[9px] text-slate-400 italic px-1">{services.delivery.notes}</p>}
                      {hasTimeSlots && (services?.timeSlots?.slots?.length ?? 0) > 0 && (
                        <div>
                          <label className="text-[9px] font-black text-slate-300 uppercase mb-1.5 block ml-1"><i className="fas fa-clock text-blue-400 mr-1"></i>Preferred Time Slot</label>
                          <div className="grid grid-cols-3 gap-2">
                            {services?.timeSlots?.slots?.map(slot => (
                              <button key={slot.time} onClick={() => setSelectedTimeSlot(slot)}
                                className={`p-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${selectedTimeSlot?.time === slot.time ? "bg-blue-500 text-white shadow-lg" : "bg-white text-slate-500 border border-slate-200 hover:border-blue-300"}`}>
                                {slot.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {hasCombo && hasAnySetupSelected && (
                        <div className={`p-4 rounded-xl border-2 transition-all ${useCombo ? "bg-gradient-to-r from-emerald-50 to-blue-50 border-emerald-400" : "bg-white border-dashed border-slate-300"}`}>
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input type="checkbox" checked={useCombo} onChange={e => setUseCombo(e.target.checked)} className="w-5 h-5 accent-emerald-500 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-xs font-black text-emerald-700 uppercase"><i className="fas fa-gift mr-1"></i>Bundle & Save!</p>
                              <p className="text-[10px] text-slate-600 mt-0.5">Delivery + All Setup for just <span className="font-black text-emerald-600">RM {services?.combo?.fee}</span></p>
                              {comboSavings > 0 && <span className="inline-block mt-1 bg-red-100 text-red-600 text-[9px] font-black px-2 py-0.5 rounded-full">SAVE RM {comboSavings}!</span>}
                            </div>
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

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

              <div className="bg-slate-50 p-5 rounded-2xl space-y-2 text-[10px] font-bold uppercase">
                <div className="flex justify-between"><span>Duration</span><span className="text-[#062c24]">{nights} Night{nights > 1 ? "s" : ""}</span></div>
                <div className="flex justify-between"><span>Subtotal</span><span className="text-[#062c24]">RM {sub}</span></div>
                {showAuto && <div className="flex justify-between text-emerald-600"><span>Extended Stay</span><span>− RM {Math.round(autoDisc)}</span></div>}
                {showPromo && <div className="flex justify-between text-emerald-600"><span>Promo Code</span><span>− RM {Math.round(promoDisc)}</span></div>}
                {fulfillmentType === "delivery" && (
                  <>
                    {useCombo && hasCombo ? (
                      <div className="flex justify-between text-blue-600"><span><i className="fas fa-gift mr-1"></i>Delivery + Setup Combo</span><span>RM {comboFee}</span></div>
                    ) : (
                      <>
                        {deliveryFee > 0 && <div className="flex justify-between text-slate-600"><span><i className="fas fa-truck mr-1"></i>Delivery Fee</span><span>RM {deliveryFee}</span></div>}
                        {services?.delivery?.pricingType === "quote" && <div className="flex justify-between text-amber-600"><span><i className="fas fa-truck mr-1"></i>Delivery Fee</span><span>TBD</span></div>}
                        {setupFee > 0 && <div className="flex justify-between text-blue-600"><span><i className="fas fa-tools mr-1"></i>Setup Fee</span><span>RM {setupFee}</span></div>}
                      </>
                    )}
                    {comboSavings > 0 && useCombo && <div className="flex justify-between text-red-500"><span>Bundle Savings</span><span>− RM {comboSavings}</span></div>}
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

            <div className="p-5 bg-slate-50 border-t border-slate-100 space-y-4">
              <button onClick={canOrder && !isSending ? sendWhatsAppOrder : undefined} disabled={!canOrder || isSending}
                className={`w-full py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl transition-all ${canOrder && !isSending ? "bg-[#062c24] text-white hover:bg-emerald-900 active:scale-95" : "bg-slate-200 text-slate-400 cursor-not-allowed"}`}>
                {isSending ? "Processing..." 
                  : !cart.length ? "Add Items to Start" 
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

      {/* Nearby Campsites */}
      {nearbyCampsites.length > 0 && (
        <section className="max-w-4xl mx-auto px-5 pt-8 pb-6">
          {/* Section divider header */}
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <i className="fas fa-campground text-emerald-600 text-sm"></i>
            </div>
            <div>
              <p className="text-sm font-black text-[#062c24] uppercase tracking-tight leading-tight">Nearby Campsites</p>
              <p className="text-[9px] text-slate-400 font-medium">Community suggestions · not bookable through this vendor</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {nearbyCampsites.slice(0, 4).map(cs => (
              <div key={cs.id} className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                {/* Image */}
                <div className="relative h-28">
                  {cs.carousel?.[0]
                    ? <img src={cs.carousel[0]} alt={cs.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center text-3xl">🏕️</div>
                  }
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  {cs.km != null && (
                    <span className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white px-1.5 py-0.5 rounded-full text-[8px] font-black">
                      ~{cs.km} km
                    </span>
                  )}
                </div>
                {/* Info + action */}
                <div className="p-2.5 flex items-center justify-between gap-1.5">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-[#062c24] truncate uppercase leading-tight">{cs.name}</p>
                    <p className="text-[9px] text-slate-400 truncate">{cs.location || cs.state}</p>
                  </div>
                  <a href={cs.direction || "#"} target="_blank" rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center hover:bg-emerald-600 transition-colors shadow-sm">
                    <i className="fas fa-location-arrow text-white text-[9px]"></i>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Food Delivery */}
      {foodPartners.length > 0 && (
        <section className="max-w-4xl mx-auto px-5 pt-8 pb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <i className="fas fa-utensils text-orange-500 text-sm"></i>
            </div>
            <div>
              <p className="text-sm font-black text-[#062c24] uppercase tracking-tight leading-tight">Food Delivery</p>
              <p className="text-[9px] text-slate-400 font-medium">Independent vendors · orders placed directly, not involving this shop</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {foodPartners.slice(0, 4).map(fp => {
              const firstItem = fp.items?.[0];
              return (
                <div key={fp.id} className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm cursor-pointer active:scale-95 transition-transform"
                  onClick={() => { setSelectedFoodPartner(fp); setFpCarouselIdx(0); }}>
                  {/* Image with menu name overlay */}
                  <div className="relative h-28">
                    {firstItem?.image
                      ? <img src={firstItem.image} alt={firstItem.menuName || fp.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-gradient-to-br from-orange-50 to-amber-100 flex items-center justify-center text-3xl">🍱</div>
                    }
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    {firstItem?.menuName && (
                      <p className="absolute bottom-2 left-2 right-2 text-[9px] font-black text-white uppercase leading-tight truncate drop-shadow">
                        {firstItem.menuName}
                      </p>
                    )}
                    {(fp.items?.length ?? 0) > 1 && (
                      <span className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">
                        +{fp.items.length - 1} more
                      </span>
                    )}
                  </div>
                  {/* Info + pre-order */}
                  <div className="p-2.5">
                    <p className="text-[10px] font-black text-[#062c24] truncate uppercase leading-tight">{fp.name}</p>
                    {fp.description && (
                      <p className="text-[9px] text-slate-400 truncate mt-0.5">{fp.description}</p>
                    )}
                    <a href={`https://wa.me/${fp.whatsapp}?text=${encodeURIComponent(`Hi! I'm a customer from ${vendorData?.name || "a camping gear shop"} on Pacak Khemah. I'd like to pre-order food delivery to my campsite. Can you assist?`)}`}
                      target="_blank" rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 bg-orange-500 text-white py-1.5 rounded-lg text-[9px] font-black uppercase hover:bg-orange-600 transition-colors shadow-sm">
                      <i className="fab fa-whatsapp text-[11px]"></i> Pre-order
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
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

      {/* Food Partner Detail Modal */}
      {selectedFoodPartner && (
        <div className="fixed inset-0 z-[600] flex items-end justify-center" onClick={() => setSelectedFoodPartner(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg bg-white rounded-t-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>
            {/* Carousel */}
            {(selectedFoodPartner.items?.length ?? 0) > 0 && (
              <div className="relative flex-shrink-0">
                <div className="relative h-56 bg-slate-100 overflow-hidden">
                  {selectedFoodPartner.items[fpCarouselIdx]?.image
                    ? <img src={selectedFoodPartner.items[fpCarouselIdx].image}
                        alt={selectedFoodPartner.items[fpCarouselIdx].menuName || selectedFoodPartner.name}
                        className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-gradient-to-br from-orange-50 to-amber-100 flex items-center justify-center text-5xl">🍱</div>
                  }
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  {selectedFoodPartner.items[fpCarouselIdx]?.menuName && (
                    <p className="absolute bottom-3 left-4 right-4 text-[11px] font-black text-white uppercase drop-shadow-lg">
                      {selectedFoodPartner.items[fpCarouselIdx].menuName}
                    </p>
                  )}
                  {selectedFoodPartner.items.length > 1 && (
                    <>
                      <button onClick={() => setFpCarouselIdx(i => (i - 1 + selectedFoodPartner.items.length) % selectedFoodPartner.items.length)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors">
                        <i className="fas fa-chevron-left text-[10px]"></i>
                      </button>
                      <button onClick={() => setFpCarouselIdx(i => (i + 1) % selectedFoodPartner.items.length)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors">
                        <i className="fas fa-chevron-right text-[10px]"></i>
                      </button>
                      {/* Dot indicators */}
                      <div className="absolute top-3 right-3 flex gap-1">
                        {selectedFoodPartner.items.map((_, i) => (
                          <button key={i} onClick={() => setFpCarouselIdx(i)}
                            className={`w-1.5 h-1.5 rounded-full transition-all ${i === fpCarouselIdx ? "bg-white w-3" : "bg-white/50"}`} />
                        ))}
                      </div>
                    </>
                  )}
                </div>
                {/* Thumbnail strip */}
                {selectedFoodPartner.items.length > 1 && (
                  <div className="flex gap-1.5 px-4 py-2.5 overflow-x-auto bg-white border-b border-slate-100">
                    {selectedFoodPartner.items.map((item, i) => (
                      <button key={i} onClick={() => setFpCarouselIdx(i)}
                        className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${i === fpCarouselIdx ? "border-orange-500" : "border-transparent opacity-60"}`}>
                        {item.image
                          ? <img src={item.image} alt={item.menuName} className="w-full h-full object-cover" />
                          : <div className="w-full h-full bg-orange-50 flex items-center justify-center text-lg">🍱</div>
                        }
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {/* Info */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-base font-black text-[#062c24] uppercase tracking-tight">{selectedFoodPartner.name}</p>
                  {selectedFoodPartner.description && (
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{selectedFoodPartner.description}</p>
                  )}
                </div>
                <button onClick={() => setSelectedFoodPartner(null)}
                  className="flex-shrink-0 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors">
                  <i className="fas fa-times text-sm"></i>
                </button>
              </div>
              {/* Menu list */}
              {selectedFoodPartner.items.length > 0 && (
                <div className="mb-4">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Menu</p>
                  <div className="flex flex-col gap-1.5">
                    {selectedFoodPartner.items.map((item, i) => (
                      <div key={i} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-colors cursor-pointer ${i === fpCarouselIdx ? "border-orange-200 bg-orange-50" : "border-slate-100 bg-white"}`}
                        onClick={() => setFpCarouselIdx(i)}>
                        {item.image
                          ? <img src={item.image} alt={item.menuName} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                          : <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center text-lg flex-shrink-0">🍱</div>
                        }
                        <p className="text-[11px] font-bold text-[#062c24] truncate">{item.menuName || `Item ${i + 1}`}</p>
                        {i === fpCarouselIdx && <i className="fas fa-eye text-[9px] text-orange-400 ml-auto flex-shrink-0"></i>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-[9px] text-slate-400 mb-4">Independent food vendor · orders placed directly via WhatsApp, not involving this shop</p>
            </div>
            {/* Pre-order CTA */}
            <div className="px-5 pb-6 pt-3 bg-white border-t border-slate-100 flex-shrink-0">
              <a href={`https://wa.me/${selectedFoodPartner.whatsapp}?text=${encodeURIComponent(`Hi! I'm a customer from ${vendorData?.name || "a camping gear shop"} on Pacak Khemah. I'd like to pre-order food delivery to my campsite. Can you assist?`)}`}
                target="_blank" rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-colors shadow-lg shadow-orange-500/30">
                <i className="fab fa-whatsapp text-base"></i> Pre-order via WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}

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
      {itemShareToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[500] bg-[#062c24] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-toastIn">
          <i className="fas fa-link text-emerald-400"></i><span className="text-[10px] font-black uppercase tracking-widest">Item Link Copied!</span>
        </div>
      )}

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
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