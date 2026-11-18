"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, onSnapshot } from "firebase/firestore";
import {
  signInWithPopup, GoogleAuthProvider,
  signInWithEmailAndPassword, sendPasswordResetEmail, signOut, onAuthStateChanged, User,
} from "firebase/auth";
import HomeTab from "@/components/HomeTab";
import InventoryTab from "@/components/InventoryTab";
import SettingsTab from "@/components/SettingsTab";
import OrdersTab from "@/components/OrdersTab";
import ReviewsTab from "@/components/ReviewsTab";
import MoreTab from "@/components/MoreTab";
import PromotionsTab from "@/components/PromotionsTab";
import PerformanceTab from "@/components/PerformanceTab";
import ShopPageTab from "@/components/ShopPageTab";
import CalendarView from "@/components/calendar/CalendarView";
import { PageHeader, Toast, useToast } from "@/components/ui/kit";
import { isAdminEmail } from "@/lib/adminAccess";
import WelcomeTour from "@/components/vendor/WelcomeTour";
import FirstItemTour from "@/components/vendor/FirstItemTour";
import FirstOrderTour from "@/components/vendor/FirstOrderTour";
import { summarize, getStage, daysUntil, type Order } from "@/lib/orderFlow";
import { refreshPushIfEnabled, clearNotifications, onForegroundAlert } from "@/lib/pushRegistration";

type VendorData = {
  name: string;
  slug?: string;
  credits?: number;
  status?: string;
  tagline?: string;
  tagline_my?: string;
  image?: string;
  ig?: string;
  tiktok?: string;
  fb?: string;
  phone?: string;
  city?: string;
  show_nav?: boolean;
  steps?: { title: string; my: string; desc?: string; desc_my?: string }[];
  rules?: string[];
  rating?: number;
  reviewCount?: number;
  myReferralCode?: string;
  tutorials_completed?: {
    welcome?: boolean;
    welcome_skipped?: boolean;
    welcome_completed_at?: string;
    first_item?: boolean;
    first_item_skipped?: boolean;
    first_item_completed_at?: string;
    first_order?: boolean;
    first_order_skipped?: boolean;
    first_order_completed_at?: string;
  };
  gear_count?: number;
  order_count?: number;
  loyalty?: {
    enabled: boolean;
    tiers: { id: string; minBookings: number; discount: number; label: string }[];
    appliesTo?: { type: "all" | "specific"; itemIds?: string[] };
  };
  [key: string]: any; // pass-through for SettingsTab
};

type Tab = "home" | "orders" | "calendar" | "inventory" | "more" | "promotions" | "performance" | "reviews" | "shop" | "settings";

// --- LOGIN SCREEN ---
function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  async function loginWithGoogle() {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleEmailLogin() {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      setError("Invalid email or password.");
    }
  }

  async function handleForgotPassword() {
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter your email address first.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResetSent(true);
      setError("");
      setTimeout(() => setResetSent(false), 5000);
    } catch {
      setError("Could not send reset email. Check the address and try again.");
    }
  }

  return (
    <div className="fixed inset-0 bg-[#062c24] z-[200] flex items-center justify-center p-6">
      <div className="bg-white p-10 rounded-[2.5rem] max-w-sm w-full text-center shadow-2xl relative">
        <Link href="/directory"
          className="absolute top-5 left-6 w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:text-[#062c24] transition-colors">
          <i className="fas fa-arrow-left text-sm"></i>
        </Link>

        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <i className="fas fa-store text-2xl"></i>
        </div>
        <h2 className="text-3xl mb-2 font-black tracking-tight text-[#062c24]">Vendor Studio</h2>
        <p className="text-slate-400 text-xs mb-8">Manage your rental empire.</p>

        <div className="space-y-4">
          <button onClick={loginWithGoogle}
            className="w-full bg-white border border-slate-200 text-slate-600 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-3">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            Sign In with Google
          </button>

          <div className="relative flex items-center justify-center py-2">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
            <span className="relative bg-white px-2 text-[9px] text-slate-300 uppercase font-bold">Or Email</span>
          </div>

          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email Address"
            className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-[0.85rem] text-sm font-semibold outline-none text-center focus:border-emerald-500 focus:bg-white transition-all" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password"
            className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-[0.85rem] text-sm font-semibold outline-none text-center focus:border-emerald-500 focus:bg-white transition-all" />

          {error && <p className="text-red-500 text-[10px] font-bold">{error}</p>}
          {resetSent && <p className="text-emerald-600 text-[10px] font-bold"><i className="fas fa-check-circle mr-1"></i>Password reset email sent! Check your inbox.</p>}

          <button onClick={handleEmailLogin}
            className="w-full bg-[#062c24] text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-900 shadow-lg">
            Login
          </button>

          <button onClick={handleForgotPassword}
            className="text-[10px] text-emerald-600 font-bold hover:underline">
            Forgot Password?
          </button>

          <p className="text-center text-[10px] text-slate-400 font-medium pt-2">
            Haven&apos;t signed up yet?{" "}
            <a href="/register-vendor" className="text-emerald-600 font-black hover:underline uppercase">Register Here</a>
          </p>
        </div>
      </div>
    </div>
  );
}

// --- MAIN DASHBOARD SHELL ---
// Five places in the bottom bar (Home, Orders, Calendar, Inventory, More);
// everything else opens from More and shows a back link to it.
const PRIMARY: { id: Tab; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "fa-home" },
  { id: "orders", label: "Orders", icon: "fa-shopping-bag" },
  { id: "calendar", label: "Calendar", icon: "fa-calendar-alt" },
  { id: "inventory", label: "Inventory", icon: "fa-boxes" },
  { id: "more", label: "More", icon: "fa-th-large" },
];
const UNDER_MORE: Tab[] = ["promotions", "performance", "reviews", "shop", "settings"];

// Old tab names from links, tours and bookmarks, mapped to where they live now.
const ALIASES: Record<string, { tab: Tab; extra?: Record<string, string> }> = {
  analytics: { tab: "performance" },
  insights: { tab: "performance" },
  referrals: { tab: "promotions", extra: { section: "referrals" } },
  updates: { tab: "shop", extra: { section: "posts" } },
  food_partners: { tab: "shop", extra: { section: "food" } },
  order_guide: { tab: "shop", extra: { section: "guide" } },
  storefront: { tab: "shop", extra: { section: "storefront" } },
  documents: { tab: "orders", extra: { view: "agreements" } },
  profile: { tab: "settings" },
};
const ALL_TABS: Tab[] = ["home", "orders", "calendar", "inventory", "more", ...UNDER_MORE];

function resolveTab(raw: string | null): { tab: Tab; extra?: Record<string, string> } {
  if (!raw) return { tab: "home" };
  if ((ALL_TABS as string[]).includes(raw)) return { tab: raw as Tab };
  return ALIASES[raw] || { tab: "home" };
}

function Dashboard({ vendorData, vendorId, isAdminOverride }: { user: User; vendorData: VendorData; vendorId: string; isAdminOverride?: boolean }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const adminOverride = searchParams.get("admin_override");
  const resolved = resolveTab(searchParams.get("tab"));
  const activeTab = resolved.tab;
  const param = (k: string) => searchParams.get(k) || resolved.extra?.[k] || null;

  // Tour states
  const [showWelcomeTour, setShowWelcomeTour] = useState(false);
  const [showFirstItemTour, setShowFirstItemTour] = useState(false);
  const [showFirstOrderTour, setShowFirstOrderTour] = useState(false);

  // Keep the push token fresh for vendors who turned alerts on (Settings › Account)
  useEffect(() => {
    if (isAdminOverride || !vendorId) return;
    refreshPushIfEnabled(vendorId, !!vendorData?.fcmToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId, isAdminOverride]);

  // Opening the app (or switching back to it) clears its alerts from the phone's tray
  useEffect(() => {
    if (isAdminOverride) return;
    clearNotifications();
    const onVisible = () => { if (document.visibilityState === "visible") clearNotifications(); };
    // Tapping an alert for a page the worker can't navigate sends the URL here
    const onSwMessage = (e: MessageEvent) => {
      if (e.data?.type === "OPEN_URL" && typeof e.data.url === "string") {
        const u = new URL(e.data.url);
        if (u.origin === window.location.origin) router.push(u.pathname + u.search);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    navigator.serviceWorker?.addEventListener("message", onSwMessage);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      navigator.serviceWorker?.removeEventListener("message", onSwMessage);
    };
  }, [isAdminOverride, router]);

  // Which tour to show (skipped in admin override)
  useEffect(() => {
    if (isAdminOverride) return;
    const tutorials = vendorData?.tutorials_completed;
    if (!tutorials?.welcome) {
      const timer = setTimeout(() => setShowWelcomeTour(true), 500);
      return () => clearTimeout(timer);
    }
    if (tutorials?.welcome && !tutorials?.first_item && (vendorData?.gear_count || 0) === 0) {
      const timer = setTimeout(() => setShowFirstItemTour(true), 500);
      return () => clearTimeout(timer);
    }
  }, [vendorData, isAdminOverride]);

  function navigate(tab: string, extra?: Record<string, string>) {
    const r = resolveTab(tab);
    const params = new URLSearchParams();
    params.set("tab", r.tab);
    for (const [k, v] of Object.entries({ ...(r.extra || {}), ...(extra || {}) })) params.set(k, v);
    if (adminOverride) params.set("admin_override", adminOverride);
    router.push(`/store?${params.toString()}`, { scroll: false });
    window.scrollTo({ top: 0 });
  }

  async function logout() {
    await signOut(auth);
  }

  const { toast, show: showToast } = useToast();

  // Alerts that arrive while the dashboard is on screen show as a toast, not in the tray
  useEffect(() => {
    if (isAdminOverride) return;
    return onForegroundAlert(({ title, body }) => showToast(body ? `${title} ${body}` : title));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminOverride]);

  // Badges: orders needing action, gear moving today, reviews to reply to
  const [actionCount, setActionCount] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [unreplied, setUnreplied] = useState(0);

  useEffect(() => {
    if (!vendorId) return;
    const unsubOrders = onSnapshot(query(collection(db, "orders"), where("vendorId", "==", vendorId)), (snap) => {
      const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order)).filter(o => !o.deleted);
      setActionCount(summarize(orders).action);
      setTodayCount(orders.filter(o => {
        const st = getStage(o);
        return (st === "confirmed" && daysUntil(o.bookingDates?.start) === 0) || (st === "picked_up" && daysUntil(o.bookingDates?.end) === 0);
      }).length);
    });
    const unsubReviews = onSnapshot(query(collection(db, "reviews"), where("vendorId", "==", vendorId)), (snap) => {
      setUnreplied(snap.docs.filter(d => !d.data().vendorReply).length);
    }, () => {});
    return () => { unsubOrders(); unsubReviews(); };
  }, [vendorId]);

  const badges: Partial<Record<Tab, number>> = { orders: actionCount, calendar: todayCount, more: unreplied };
  const shopUrl = vendorData.slug ? `/shop/${vendorData.slug}` : `/shop?v=${vendorId}`;
  const credits = vendorData.credits || 0;
  const inMore = UNDER_MORE.includes(activeTab);
  const highlighted: Tab = inMore ? "more" : activeTab;

  return (
    <div className="min-h-screen pb-24 bg-slate-50 text-slate-900" style={{ fontFamily: "'Inter', sans-serif" }}>

      <WelcomeTour vendorId={vendorId} isOpen={showWelcomeTour} onClose={() => setShowWelcomeTour(false)} onNavigateTab={(tab: string) => navigate(tab)} />
      <FirstItemTour vendorId={vendorId} isOpen={showFirstItemTour} onClose={() => setShowFirstItemTour(false)} onOpenAddModal={() => { setShowFirstItemTour(false); navigate("inventory"); }} />
      <FirstOrderTour vendorId={vendorId} isOpen={showFirstOrderTour} onClose={() => setShowFirstOrderTour(false)} />

      {/* Header */}
      <header className="bg-white/95 backdrop-blur border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-xl lg:max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-3">
          {vendorData.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={vendorData.image} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0 border border-slate-200" />
          ) : (
            <div className="w-10 h-10 bg-[#062c24] text-white rounded-xl flex items-center justify-center font-bold shrink-0" aria-hidden="true">{vendorData.name?.charAt(0) || "V"}</div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold text-[#062c24] truncate">{vendorData.name}</p>
            {vendorData.status === "pending" && <p className="text-xs font-semibold text-amber-800">Account waiting for approval</p>}
            {vendorData.status === "suspended" && <p className="text-xs font-semibold text-red-800">Shop suspended. Contact support.</p>}
          </div>
          <button type="button" onClick={() => navigate("settings", { group: "account", section: "credits" })}
            className={`min-h-10 px-3 rounded-xl text-[13px] font-bold flex items-center gap-1.5 border ${credits > 10 ? "bg-emerald-50 border-emerald-200 text-emerald-900" : credits > 0 ? "bg-amber-100 border-amber-300 text-amber-900" : "bg-red-50 border-red-200 text-red-900"}`}
            aria-label={`${credits} credits. Open credits`}>
            <i className="fas fa-coins" aria-hidden="true"></i>{credits}
          </button>
          <a href={shopUrl} target="_blank" rel="noreferrer" aria-label="View your live shop"
            className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-700 flex items-center justify-center hover:bg-slate-100">
            <i className="fas fa-external-link-alt text-sm" aria-hidden="true"></i>
          </a>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-xl lg:max-w-5xl mx-auto px-4 pt-4">
        {inMore && (
          <button type="button" onClick={() => navigate("more")} className="min-h-10 -ml-1 mb-1 px-1 flex items-center gap-2 text-[13px] font-semibold text-slate-700 hover:text-[#062c24]">
            <i className="fas fa-chevron-left text-xs" aria-hidden="true"></i>More
          </button>
        )}
        {activeTab === "home" && <HomeTab vendorId={vendorId} vendorData={vendorData} onNavigate={navigate} />}
        {activeTab === "orders" && <OrdersTab key={param("order") || "orders"} vendorId={vendorId} vendorName={vendorData.name} initialOrderId={param("order")} initialView={param("view") === "agreements" ? "agreements" : undefined} onOpenCalendar={(orderId: string) => navigate("calendar", { order: orderId })} />}
        {activeTab === "calendar" && (
          <div className="space-y-4">
            <PageHeader title="Calendar" subtitle="Bookings and days off. Tap a date to see what goes out." />
            <CalendarView key={param("order") || "cal"} vendorId={vendorId} orderId={param("order")} />
          </div>
        )}
        {activeTab === "inventory" && <InventoryTab vendorId={vendorId} onOpenPromotions={() => navigate("promotions")} />}
        {activeTab === "more" && <MoreTab shopUrl={shopUrl} credits={credits} unrepliedReviews={unreplied} onNavigate={navigate} onRestartTour={isAdminOverride ? undefined : () => setShowWelcomeTour(true)} onLogout={logout} />}
        {activeTab === "promotions" && <PromotionsTab vendorId={vendorId} vendorName={vendorData.name} initialSection={param("section")} />}
        {activeTab === "performance" && <PerformanceTab vendorId={vendorId} />}
        {activeTab === "reviews" && <ReviewsTab vendorId={vendorId} />}
        {activeTab === "shop" && <ShopPageTab vendorId={vendorId} vendorData={vendorData} initialSection={param("section")} />}
        {activeTab === "settings" && (
          <SettingsTab key={`${param("group")}-${param("section")}`} vendorId={vendorId} vendorData={vendorData}
            initialGroup={param("group") === "account" ? "account" : "rules"} initialSection={param("section")}
            onRestartTour={() => setShowWelcomeTour(true)} onNavigate={(tab: string) => navigate(tab)} />
        )}
      </main>

      {/* Bottom bar */}
      <nav aria-label="Dashboard" className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="max-w-xl mx-auto grid grid-cols-5 px-1 py-1.5">
          {PRIMARY.map(t => {
            const on = highlighted === t.id;
            const badge = badges[t.id];
            return (
              <button key={t.id} type="button" onClick={() => navigate(t.id)} aria-current={on ? "page" : undefined}
                className={`relative min-h-[54px] flex flex-col items-center justify-center gap-1 rounded-xl ${on ? "text-[#062c24]" : "text-slate-600 hover:text-slate-900"}`}>
                <span className="relative">
                  <i className={`fas ${t.icon} text-lg`} aria-hidden="true"></i>
                  {!!badge && (
                    <span className="absolute -top-1.5 -right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-red-700 text-white text-[11px] font-bold flex items-center justify-center" aria-label={`${badge} waiting`}>
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </span>
                <span className={`text-xs ${on ? "font-bold" : "font-semibold"}`}>{t.label}</span>
                {on && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-[#062c24] rounded-full" aria-hidden="true"></span>}
              </button>
            );
          })}
        </div>
      </nav>
      <Toast toast={toast} />
    </div>
  );
}

// --- ROOT PAGE CONTENT ---
function StorePageContent() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [vendorData, setVendorData] = useState<VendorData | null>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [noVendor, setNoVendor] = useState(false);
  const [isAdminOverride, setIsAdminOverride] = useState(false);

  const adminOverrideId = searchParams.get("admin_override");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(true);
      setNoVendor(false);
      setIsAdminOverride(false);
      
      if (u) {
        const isAdmin = adminOverrideId ? await isAdminEmail(u.email) : false;

        // If admin is using override parameter
        if (adminOverrideId && isAdmin) {
          try {
            const vendorDoc = await getDoc(doc(db, "vendors", adminOverrideId));
            if (vendorDoc.exists()) {
              setVendorId(adminOverrideId);
              setVendorData(vendorDoc.data() as VendorData);
              setIsAdminOverride(true);
              setLoading(false);
              return;
            }
          } catch (e) {
            console.error("Admin override error:", e);
          }
        }
        
        // Normal vendor login
        const { collection, query, where, getDocs } = await import("firebase/firestore");
        const q = query(collection(db, "vendors"), where("owner_uid", "==", u.uid));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setVendorId(snap.docs[0].id);
          setVendorData(snap.docs[0].data() as VendorData);
        } else {
          // Only show "no vendor" if NOT admin with override
          if (!(adminOverrideId && isAdmin)) {
            setNoVendor(true);
          }
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, [adminOverrideId]);

  // Keep vendor data live so the header, credits and Home reflect changes made anywhere
  useEffect(() => {
    if (!vendorId) return;
    const unsub = onSnapshot(doc(db, "vendors", vendorId), snap => {
      if (snap.exists()) setVendorData(snap.data() as VendorData);
    }, () => {});
    return () => unsub();
  }, [vendorId]);

  if (loading) return (
    <div className="fixed inset-0 bg-[#062c24] flex flex-col items-center justify-center gap-4">
      <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center">
        <i className="fas fa-store text-emerald-400 text-2xl animate-pulse"></i>
      </div>
      <p className="text-white/60 font-black uppercase text-[10px] tracking-widest animate-pulse">Loading Vendor Studio...</p>
    </div>
  );

  if (!user) return <LoginScreen />;

  if (noVendor) return (
    <div className="fixed inset-0 bg-[#062c24] flex items-center justify-center p-6 text-center">
      <div>
        <div className="w-16 h-16 bg-red-100 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl">
          <i className="fas fa-store-slash"></i>
        </div>
        <h2 className="text-white text-2xl font-black uppercase mb-2">No Vendor Found</h2>
        <p className="text-white/60 text-sm mb-8">This account is not linked to any vendor profile.</p>
        <div className="flex flex-col gap-3 items-center">
          <Link href="/register-vendor" className="inline-block bg-white text-[#062c24] px-8 py-4 rounded-2xl font-black uppercase text-xs">Register as Vendor</Link>
          <Link href="/directory" className="text-[10px] font-bold text-white/40 hover:text-white/80 uppercase tracking-widest transition-colors">← Back to Directory</Link>
        </div>
      </div>
    </div>
  );

  if (!vendorData || !vendorId) return null;

  return (
    <>
      {/* Admin Override Banner */}
      {isAdminOverride && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-2 px-4 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest">
            <i className="fas fa-user-shield mr-2"></i>
            Admin Mode: Viewing as {vendorData.name}
            <Link href="/admin" className="ml-4 underline hover:no-underline">← Back to Admin</Link>
          </p>
        </div>
      )}
      <div className={isAdminOverride ? "pt-8" : ""}>
        <Dashboard user={user} vendorData={vendorData} vendorId={vendorId} isAdminOverride={isAdminOverride} />
      </div>
    </>
  );
}

// --- ROOT PAGE WITH SUSPENSE ---
export default function StorePage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-[#062c24] flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center">
          <i className="fas fa-store text-emerald-400 text-2xl animate-pulse"></i>
        </div>
        <p className="text-white/60 font-black uppercase text-[10px] tracking-widest animate-pulse">Loading Vendor Studio...</p>
      </div>
    }>
      <StorePageContent />
    </Suspense>
  );
}

// ═══════════════════════════════════════════════════════════
// MENU ITEM (drawer)
// ═══════════════════════════════════════════════════════════
