"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db, auth } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from "firebase/auth";
import DashboardTab from "@/components/admin/DashboardTab";
import VendorsTab from "@/components/admin/VendorsTab";
import FinanceTab from "@/components/admin/FinanceTab";
import ContentTab from "@/components/admin/ContentTab";
import AdminSettingsTab from "@/components/admin/SettingsTab";

const ADMIN_EMAIL = "akiff.work@gmail.com";
type View = "dashboard" | "vendors" | "finance" | "content" | "settings";

const NAV_ITEMS: { id: View; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "fa-chart-pie" },
  { id: "vendors", label: "Vendors", icon: "fa-store" },
  { id: "finance", label: "Finance", icon: "fa-wallet" },
  { id: "content", label: "Content", icon: "fa-layer-group" },
  { id: "settings", label: "Settings", icon: "fa-cog" },
];

const PAGE_TITLES: Record<View, string> = {
  dashboard: "Overview", vendors: "Vendor Management",
  finance: "Financials", content: "Content Manager", settings: "System Settings",
};

function AdminGate({ onError }: { onError: boolean }) {
  const [loading, setLoading] = useState(false);
  async function login() {
    setLoading(true);
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch { alert("Login Failed"); }
    finally { setLoading(false); }
  }
  return (
    <div className="fixed inset-0 bg-[#062c24] z-[500] flex items-center justify-center p-6">
      <div className="bg-white p-10 rounded-[2.5rem] max-w-sm w-full text-center shadow-2xl relative">
        <Link href="/directory" className="absolute top-6 right-8 text-slate-300 hover:text-red-500 transition-colors">
          <i className="fas fa-times text-xl"></i>
        </Link>
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-emerald-100">
          <i className="fas fa-user-shield text-2xl"></i>
        </div>
        <h2 className="text-3xl mb-2 font-black tracking-tight text-[#062c24]">Admin HQ</h2>
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-8 tracking-widest">Authorized Personnel Only</p>
        <button onClick={login} disabled={loading}
          className="w-full bg-white text-slate-600 border border-slate-200 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-50">
          {loading ? <i className="fas fa-spinner fa-spin"></i> : <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="G" />}
          Sign in with Google
        </button>
        {onError && <p className="text-[10px] text-red-500 font-bold mt-4 uppercase tracking-widest">Access Denied</p>}
      </div>
    </div>
  );
}

function AdminShell({ user, allVendors }: { user: User; allVendors: any[] }) {
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const pending = allVendors.filter(v => v.status === "pending").length;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50" style={{ fontFamily: "'Inter', sans-serif" }}>
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-20 lg:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-[#062c24] text-white flex flex-col justify-between shadow-2xl transition-transform duration-300 lg:translate-x-0 lg:static shrink-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div>
          <div className="p-8 flex items-center justify-between lg:justify-start gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center font-black text-[#062c24]">P</div>
              <span className="font-black text-lg tracking-tight uppercase">Pacak HQ</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/50 hover:text-white"><i className="fas fa-times"></i></button>
          </div>
          <nav className="space-y-1 px-4">
            {NAV_ITEMS.map(item => (
              <button key={item.id} onClick={() => { setActiveView(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center justify-between gap-4 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${activeView === item.id ? "bg-white/10 border-l-4 border-emerald-500 text-white" : "text-emerald-100/70 hover:bg-white/5 hover:text-white"}`}>
                <span className="flex items-center gap-3"><i className={`fas ${item.icon} w-5`}></i> {item.label}</span>
                {item.id === "vendors" && pending > 0 && (
                  <span className="bg-amber-400 text-[#062c24] text-[8px] font-black px-1.5 py-0.5 rounded-full">{pending}</span>
                )}
              </button>
            ))}
          </nav>
        </div>
        <div className="p-6 border-t border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-emerald-900 flex items-center justify-center text-[10px] font-bold">A</div>
            <div className="overflow-hidden">
              <p className="text-[10px] font-bold text-emerald-100 truncate">{user.email}</p>
              <p className="text-[8px] text-emerald-500 uppercase font-black">Super Admin</p>
            </div>
          </div>
          <button onClick={() => signOut(auth)} className="w-full bg-red-500/20 text-red-300 py-2 rounded-lg text-[9px] font-black uppercase hover:bg-red-500 hover:text-white transition-all">Logout</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden w-full">
        <header className="bg-white/80 backdrop-blur-md h-16 lg:h-20 flex items-center justify-between px-4 lg:px-8 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden w-10 h-10 bg-white border border-slate-200 rounded-xl text-slate-500 flex items-center justify-center">
              <i className="fas fa-bars"></i>
            </button>
            <h2 className="text-lg lg:text-xl font-black text-[#062c24] uppercase tracking-tight">{PAGE_TITLES[activeView]}</h2>
          </div>
          <Link href="/directory" target="_blank" className="px-3 py-2 lg:px-4 bg-slate-100 text-slate-500 rounded-xl text-[9px] lg:text-[10px] font-bold uppercase hover:bg-emerald-50 hover:text-emerald-600 transition-all flex items-center gap-2">
            <i className="fas fa-external-link-alt"></i><span className="hidden sm:inline">Directory</span>
          </Link>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8" style={{ scrollbarWidth: "thin" }}>
          {activeView === "dashboard" && <DashboardTab allVendors={allVendors} onNavigate={setActiveView} />}
          {activeView === "vendors" && <VendorsTab allVendors={allVendors} />}
          {activeView === "finance" && <FinanceTab />}
          {activeView === "content" && <ContentTab />}
          {activeView === "settings" && <AdminSettingsTab />}
        </div>
      </main>
    </div>
  );
}

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [allVendors, setAllVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u && u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        setUser(u);
        setAccessDenied(false);
        // Start vendor listener
        onSnapshot(collection(db, "vendors"), snap => {
          setAllVendors(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
      } else {
        if (u) { setAccessDenied(true); await signOut(auth); }
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) return (
    <div className="fixed inset-0 bg-[#062c24] flex items-center justify-center">
      <div className="text-white font-black uppercase text-sm animate-pulse">Loading...</div>
    </div>
  );

  if (!user) return <AdminGate onError={accessDenied} />;
  return <AdminShell user={user} allVendors={allVendors} />;
}