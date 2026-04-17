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
import AnalyticsTab from "@/components/AnalyticsTab";
import HomeTab from "@/components/HomeTab";
import DocumentsTab from "@/components/DocumentsTab";
import InventoryTab from "@/components/InventoryTab";
import StorefrontTab from "@/components/StorefrontTab";
import SettingsTab from "@/components/SettingsTab";
import OrdersTab from "@/components/OrdersTab";
import ReviewsTab from "@/components/ReviewsTab";
import InsightsTab from "@/components/InsightsTab";
import UpdatesTab from "@/components/UpdatesTab";
import ReferralsTab from "@/components/ReferralsTab";
import WelcomeTour from "@/components/vendor/WelcomeTour";
import FirstItemTour from "@/components/vendor/FirstItemTour";
import FirstOrderTour from "@/components/vendor/FirstOrderTour";

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
};

type Tab = "home" | "calendar" | "orders" | "reviews" | "insights" | "analytics" | "updates" | "documents" | "inventory" | "storefront" | "referrals" | "settings";

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
function Dashboard({ user, vendorData, vendorId, isAdminOverride }: { user: User; vendorData: VendorData; vendorId: string; isAdminOverride?: boolean }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab") as Tab | null;
  const adminOverride = searchParams.get("admin_override");
  const [activeTab, setActiveTab] = useState<Tab>(tabParam || "home");
  const [menuOpen, setMenuOpen] = useState(false);
  
  // Tour states
  const [showWelcomeTour, setShowWelcomeTour] = useState(false);
  const [showFirstItemTour, setShowFirstItemTour] = useState(false);
  const [showFirstOrderTour, setShowFirstOrderTour] = useState(false);
  const [showAddGearModal, setShowAddGearModal] = useState(false);

  // Check which tour should be shown (skip for admin override)
  useEffect(() => {
    if (isAdminOverride) return;
    
    const tutorials = vendorData?.tutorials_completed;
    
    // Priority 1: Welcome tour (if not completed)
    if (!tutorials?.welcome) {
      const timer = setTimeout(() => setShowWelcomeTour(true), 500);
      return () => clearTimeout(timer);
    }
    
    // Priority 2: First item tour (if welcome done, no gear, and not completed)
    if (tutorials?.welcome && !tutorials?.first_item && (vendorData?.gear_count || 0) === 0) {
      const timer = setTimeout(() => setShowFirstItemTour(true), 500);
      return () => clearTimeout(timer);
    }
    
    // Priority 3: First order tour (if first item done, has first order, and not completed)
    // This would be triggered manually when first order comes in
    
  }, [vendorData, isAdminOverride]);

  function handleTabChange(tab: Tab) {
    // Calendar is a full-screen route (too large to embed)
    if (tab === "calendar") {
      const params = new URLSearchParams();
      if (adminOverride) params.set("v", adminOverride);
      router.push(`/calendar${params.toString() ? "?" + params.toString() : ""}`);
      return;
    }
    setActiveTab(tab);
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (adminOverride) params.set("admin_override", adminOverride);
    router.push(`/store?${params.toString()}`, { scroll: false });
  }

  function handleTourNavigate(tab: string) {
    const tabMap: Record<string, Tab> = {
      profile: "settings",
      storefront: "storefront",
      inventory: "inventory",
      settings: "settings",
    };
    const targetTab = tabMap[tab] || "home";
    setActiveTab(targetTab);
    // Preserve admin_override parameter if present
    const params = new URLSearchParams();
    params.set("tab", targetTab);
    if (adminOverride) params.set("admin_override", adminOverride);
    router.push(`/store?${params.toString()}`, { scroll: false });
  }
  
  function handleFirstItemTourComplete() {
    setShowFirstItemTour(false);
    // Navigate to inventory tab and trigger add modal
    setActiveTab("inventory");
    const params = new URLSearchParams();
    params.set("tab", "inventory");
    if (adminOverride) params.set("admin_override", adminOverride);
    router.push(`/store?${params.toString()}`, { scroll: false });
  }
  
  function handleRestartWelcomeTour() {
    setShowWelcomeTour(true);
  }

  useEffect(() => {
    if (tabParam && tabParam !== activeTab) setActiveTab(tabParam);
  }, [tabParam]);

  async function logout() {
    await signOut(auth);
  }

  // Compute today/tomorrow for calendar badge
  const [pendingCount, setPendingCount] = useState(0);
  const [todayCalendarCount, setTodayCalendarCount] = useState(0);

  useEffect(() => {
    if (!vendorId) return;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const ordersQuery = query(collection(db, "orders"), where("vendorId", "==", vendorId));
    const unsub = onSnapshot(ordersQuery, (snap) => {
      let pending = 0, todayCount = 0;
      snap.docs.forEach((d) => {
        const o = d.data();
        if (o.deleted) return;
        if (o.status === "pending") pending++;
        if ((o.status === "confirmed" || o.status === "pending") &&
            (o.bookingDates?.start === todayStr || o.bookingDates?.end === todayStr)) {
          todayCount++;
        }
      });
      setPendingCount(pending);
      setTodayCalendarCount(todayCount);
    });
    return () => unsub();
  }, [vendorId]);

  const primaryTabs: { id: Tab; label: string; icon: string; badge?: number }[] = [
    { id: "home", label: "Home", icon: "fa-home" },
    { id: "calendar", label: "Calendar", icon: "fa-calendar-alt", badge: todayCalendarCount || undefined },
    { id: "orders", label: "Orders", icon: "fa-shopping-bag", badge: pendingCount || undefined },
    { id: "reviews", label: "Reviews", icon: "fa-star" },
    { id: "insights", label: "Insights", icon: "fa-brain" },
  ];

  const shopUrl = vendorData.slug ? `/shop/${vendorData.slug}` : `/shop?v=${vendorId}`;
  const credits = vendorData.credits || 0;
  const creditColor = credits > 10 ? "text-emerald-600 bg-emerald-50 border-emerald-100" : credits > 0 ? "text-amber-600 bg-amber-50 border-amber-100" : "text-red-600 bg-red-50 border-red-100";

  return (
    <div className="min-h-screen pb-24" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: "#f8fafc", color: "#062c24" }}>

      {/* Welcome Tour */}
      <WelcomeTour
        vendorId={vendorId}
        isOpen={showWelcomeTour}
        onClose={() => setShowWelcomeTour(false)}
        onNavigateTab={handleTourNavigate}
      />
      
      {/* First Item Tour */}
      <FirstItemTour
        vendorId={vendorId}
        isOpen={showFirstItemTour}
        onClose={() => setShowFirstItemTour(false)}
        onOpenAddModal={handleFirstItemTourComplete}
      />
      
      {/* First Order Tour */}
      <FirstOrderTour
        vendorId={vendorId}
        isOpen={showFirstOrderTour}
        onClose={() => setShowFirstOrderTour(false)}
      />

      {/* Menu overlay */}
      {menuOpen && (
        <div className="fixed inset-0 bg-black/40 z-[60]" onClick={() => setMenuOpen(false)}>
          <div className="absolute top-0 right-0 w-72 max-w-[85vw] h-full bg-white shadow-2xl p-5 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-black uppercase">More</h3>
              <button onClick={() => setMenuOpen(false)} className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center">
                <i className="fas fa-times text-sm text-slate-400"></i>
              </button>
            </div>
            <div className="space-y-1.5">
              <MenuItem icon="fa-chart-line" label="Analytics" onClick={() => { handleTabChange("analytics"); setMenuOpen(false); }} />
              <MenuItem icon="fa-boxes" label="Inventory" onClick={() => { handleTabChange("inventory"); setMenuOpen(false); }} />
              <MenuItem icon="fa-store" label="Storefront" onClick={() => { handleTabChange("storefront"); setMenuOpen(false); }} />
              <MenuItem icon="fa-bullhorn" label="Updates" onClick={() => { handleTabChange("updates"); setMenuOpen(false); }} />
              <MenuItem icon="fa-file-contract" label="Documents" onClick={() => { handleTabChange("documents"); setMenuOpen(false); }} />
              <MenuItem icon="fa-gift" label="Referrals" onClick={() => { handleTabChange("referrals"); setMenuOpen(false); }} />
              <MenuItem icon="fa-cog" label="Settings" onClick={() => { handleTabChange("settings"); setMenuOpen(false); }} />
              <div className="border-t border-slate-100 my-3"></div>
              <a href={shopUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 transition-colors">
                <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
                  <i className="fas fa-external-link-alt text-xs"></i>
                </div>
                <span className="text-sm font-bold text-[#062c24]">View Live Shop</span>
              </a>
              <button onClick={() => { logout(); setMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-red-50 transition-colors">
                <div className="w-9 h-9 bg-red-50 text-red-500 rounded-lg flex items-center justify-center">
                  <i className="fas fa-power-off text-xs"></i>
                </div>
                <span className="text-sm font-bold text-red-500">Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Header - Compact */}
      <header className="bg-white/95 backdrop-blur-xl border border-slate-100 shadow-sm sticky top-2 z-40 mx-3 mt-3 rounded-[1.5rem] p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {vendorData.image ? (
              <img src={vendorData.image} alt={vendorData.name} className="w-10 h-10 rounded-xl object-cover shrink-0 border border-slate-100" />
            ) : (
              <div className="w-10 h-10 bg-[#062c24] text-white rounded-xl flex items-center justify-center font-black text-sm shrink-0">
                {vendorData.name?.charAt(0) || "V"}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-xs font-black text-[#062c24] uppercase leading-none truncate">{vendorData.name}</h1>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${creditColor}`}>
                  <i className="fas fa-coins mr-0.5"></i>{credits}
                </span>
                {vendorData.status === "pending" && (
                  <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-100">Pending</span>
                )}
              </div>
            </div>
          </div>

          <button onClick={() => setMenuOpen(true)} className="w-10 h-10 flex items-center justify-center bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all shrink-0 relative">
            <i className="fas fa-bars text-sm"></i>
          </button>
        </div>
      </header>

      {/* Bottom Tab Bar - Mobile-first Primary Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.04)]" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="max-w-xl mx-auto flex items-center justify-around px-1 py-1.5">
          {primaryTabs.map(t => {
            const isActive = activeTab === t.id;
            return (
              <button key={t.id} onClick={() => handleTabChange(t.id)}
                className={`relative flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[52px] px-2 py-1.5 rounded-xl transition-all ${
                  isActive ? "text-[#062c24]" : "text-slate-400 hover:text-slate-600"
                }`}>
                <div className="relative">
                  <i className={`fas ${t.icon} text-base`}></i>
                  {t.badge !== undefined && (
                    <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[8px] font-black min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center shadow-sm">
                      {t.badge > 9 ? "9+" : t.badge}
                    </span>
                  )}
                </div>
                <span className={`text-[9px] font-black uppercase leading-none ${isActive ? "opacity-100" : "opacity-70"}`}>{t.label}</span>
                {isActive && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#062c24] rounded-full"></span>}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-3 mt-4">
        {activeTab === "home" && <HomeTab vendorId={vendorId} vendorData={vendorData} onNavigate={(tab: string) => handleTabChange(tab as Tab)} />}
        {activeTab === "analytics" && <AnalyticsTab vendorId={vendorId} vendorData={vendorData} />}
        {activeTab === "orders" && <OrdersTab vendorId={vendorId} vendorName={vendorData.name} />}
        {activeTab === "reviews" && <ReviewsTab vendorId={vendorId} />}
        {activeTab === "insights" && <InsightsTab vendorId={vendorId} />}
        {activeTab === "updates" && <UpdatesTab vendorId={vendorId} />}
        {activeTab === "documents" && <DocumentsTab vendorId={vendorId} vendorData={vendorData} />}
        {activeTab === "inventory" && <InventoryTab vendorId={vendorId} />}
        {activeTab === "storefront" && <StorefrontTab vendorId={vendorId} vendorData={vendorData} />}
        {activeTab === "referrals" && <ReferralsTab vendorId={vendorId} vendorName={vendorData.name} />}
        {activeTab === "settings" && <SettingsTab vendorId={vendorId} vendorData={vendorData} onRestartTour={handleRestartWelcomeTour} />}
      </div>
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

  const ADMIN_EMAIL = "akiff.work@gmail.com";
  const adminOverrideId = searchParams.get("admin_override");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(true);
      setNoVendor(false);
      setIsAdminOverride(false);
      
      if (u) {
        const isAdmin = u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

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
function MenuItem({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 transition-colors active:scale-95">
      <div className="w-9 h-9 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center shrink-0">
        <i className={`fas ${icon} text-xs`}></i>
      </div>
      <span className="text-sm font-bold text-[#062c24]">{label}</span>
    </button>
  );
}