"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import {
  signInWithPopup, GoogleAuthProvider,
  signInWithEmailAndPassword, signOut, onAuthStateChanged, User,
} from "firebase/auth";
import AnalyticsTab from "@/components/AnalyticsTab";
import DocumentsTab from "@/components/DocumentsTab";
import InventoryTab from "@/components/InventoryTab";
import StorefrontTab from "@/components/StorefrontTab";
import SettingsTab from "@/components/SettingsTab";
import OrdersTab from "@/components/OrdersTab";
import UpdatesTab from "@/components/UpdatesTab";
import ReferralsTab from "@/components/ReferralsTab";
import WelcomeTour from "@/components/vendor/WelcomeTour";

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
  };
};

type Tab = "analytics" | "orders" | "updates" | "documents" | "inventory" | "storefront" | "referrals" | "settings";

// --- LOGIN SCREEN ---
function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

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

          <button onClick={handleEmailLogin}
            className="w-full bg-[#062c24] text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-900 shadow-lg">
            Login
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
function Dashboard({ user, vendorData, vendorId }: { user: User; vendorData: VendorData; vendorId: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab") as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(tabParam || "analytics");
  const [showTour, setShowTour] = useState(false);

  // Check if welcome tour should be shown
  useEffect(() => {
    if (vendorData && !vendorData.tutorials_completed?.welcome) {
      const timer = setTimeout(() => setShowTour(true), 500);
      return () => clearTimeout(timer);
    }
  }, [vendorData]);

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    router.push(`/store?tab=${tab}`, { scroll: false });
  }

  function handleTourNavigate(tab: string) {
    const tabMap: Record<string, Tab> = {
      profile: "settings",
      storefront: "storefront",
      inventory: "inventory",
      settings: "settings",
    };
    const targetTab = tabMap[tab] || "analytics";
    setActiveTab(targetTab);
    router.push(`/store?tab=${targetTab}`, { scroll: false });
  }

  useEffect(() => {
    if (tabParam && tabParam !== activeTab) setActiveTab(tabParam);
  }, [tabParam]);

  async function logout() {
    await signOut(auth);
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "analytics", label: "Dashboard", icon: "fa-chart-line" },
    { id: "orders", label: "Orders", icon: "fa-shopping-bag" },
    { id: "updates", label: "Updates", icon: "fa-bullhorn" },
    { id: "documents", label: "Documents", icon: "fa-file-contract" },
    { id: "inventory", label: "Inventory", icon: "fa-boxes" },
    { id: "storefront", label: "Storefront", icon: "fa-store" },
    { id: "referrals", label: "Referrals", icon: "fa-gift" },
    { id: "settings", label: "Settings", icon: "fa-cog" },
  ];

  const shopUrl = vendorData.slug ? `/shop/${vendorData.slug}` : `/shop?v=${vendorId}`;
  const credits = vendorData.credits || 0;
  const creditColor = credits > 10 ? "text-emerald-600 bg-emerald-50 border-emerald-100" : credits > 0 ? "text-amber-600 bg-amber-50 border-amber-100" : "text-red-600 bg-red-50 border-red-100";

  return (
    <div className="min-h-screen pb-32" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: "#f8fafc", color: "#062c24" }}>

      {/* Welcome Tour */}
      <WelcomeTour
        vendorId={vendorId}
        isOpen={showTour}
        onClose={() => setShowTour(false)}
        onNavigateTab={handleTourNavigate}
      />

      {/* Sticky Header */}
      <header className="bg-white/90 backdrop-blur-xl border border-slate-100 shadow-sm sticky top-4 z-40 mx-4 mt-4 rounded-[2rem] p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {vendorData.image ? (
              <img src={vendorData.image} alt={vendorData.name} className="w-11 h-11 rounded-2xl object-cover shrink-0 border border-slate-100" />
            ) : (
              <div className="w-11 h-11 bg-[#062c24] text-white rounded-2xl flex items-center justify-center font-black text-lg shrink-0">
                {vendorData.name?.charAt(0) || "V"}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-sm font-black text-[#062c24] uppercase leading-none truncate">{vendorData.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${creditColor}`}>
                  <i className="fas fa-coins mr-1"></i>{credits} Credits
                </span>
                {vendorData.status === "pending" && (
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-100">Pending</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            <Link href="/calendar" className="w-11 h-11 flex items-center justify-center bg-blue-50 text-blue-500 rounded-xl hover:bg-blue-100 border border-blue-100 transition-all" title="Availability Calendar">
              <i className="fas fa-calendar-alt text-sm"></i>
            </Link>
            <Link href={shopUrl} target="_blank" className="w-11 h-11 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 border border-emerald-100 transition-all" title="View Live Shop">
              <i className="fas fa-external-link-alt text-sm"></i>
            </Link>
            <button onClick={logout} className="w-11 h-11 flex items-center justify-center bg-red-50 text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-all">
              <i className="fas fa-power-off text-sm"></i>
            </button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => handleTabChange(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase whitespace-nowrap shrink-0 transition-all min-h-[44px] ${
                activeTab === t.id ? "bg-[#062c24] text-white shadow-md" : "bg-slate-100 text-slate-500 hover:text-[#062c24] hover:bg-slate-200"
              }`}>
              <i className={`fas ${t.icon}`}></i>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 mt-6">
        {activeTab === "analytics" && <AnalyticsTab vendorId={vendorId} vendorData={vendorData} />}
        {activeTab === "orders" && <OrdersTab vendorId={vendorId} vendorName={vendorData.name} />}
        {activeTab === "updates" && <UpdatesTab vendorId={vendorId} />}
        {activeTab === "documents" && <DocumentsTab vendorId={vendorId} vendorData={vendorData} />}
        {activeTab === "inventory" && <InventoryTab vendorId={vendorId} />}
        {activeTab === "storefront" && <StorefrontTab vendorId={vendorId} vendorData={vendorData} />}
        {activeTab === "referrals" && <ReferralsTab vendorId={vendorId} vendorName={vendorData.name} />}
        {/* @ts-ignore - onRestartTour prop added in new SettingsTab */}
        {activeTab === "settings" && <SettingsTab vendorId={vendorId} vendorData={vendorData} onRestartTour={() => setShowTour(true)} />}
      </div>
    </div>
  );
}

// --- ROOT PAGE ---
export default function StorePage() {
  const [user, setUser] = useState<User | null>(null);
  const [vendorData, setVendorData] = useState<VendorData | null>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [noVendor, setNoVendor] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const { collection, query, where, getDocs } = await import("firebase/firestore");
        const q = query(collection(db, "vendors"), where("owner_uid", "==", u.uid));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setVendorId(snap.docs[0].id);
          setVendorData(snap.docs[0].data() as VendorData);
        } else {
          setNoVendor(true);
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

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

  return <Dashboard user={user} vendorData={vendorData} vendorId={vendorId} />;
}