"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import { collectionGroup, collection, onSnapshot, query, where } from "firebase/firestore";
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from "firebase/auth";
import { isAdminEmail } from "@/lib/adminAccess";
import AdminHome from "@/components/admin/AdminHome";
import VendorsTab from "@/components/admin/VendorsTab";
import OrdersTab from "@/components/admin/OrdersTab";
import FinanceTab from "@/components/admin/FinanceTab";
import SiteTab from "@/components/admin/SiteTab";
import AdminSettingsTab from "@/components/admin/SettingsTab";
import type { AdminVendor } from "@/components/admin/types";

export type AdminTab = "home" | "vendors" | "orders" | "money" | "site" | "settings";
export type AdminNavigate = (tab: AdminTab, extra?: Record<string, string>) => void;

const NAV: { id: AdminTab; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "fa-house" },
  { id: "vendors", label: "Vendors", icon: "fa-store" },
  { id: "orders", label: "Orders", icon: "fa-receipt" },
  { id: "money", label: "Money", icon: "fa-wallet" },
  { id: "site", label: "Site", icon: "fa-globe" },
  { id: "settings", label: "Settings", icon: "fa-gear" },
];

// Old tab names keep working
const ALIASES: Record<string, { tab: AdminTab; extra?: Record<string, string> }> = {
  dashboard: { tab: "home" },
  finance: { tab: "money" },
  prospects: { tab: "vendors", extra: { view: "prospects" } },
  content: { tab: "site" },
  campsites: { tab: "site", extra: { section: "campsites" } },
};

function AdminGate({ denied }: { denied: boolean }) {
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  async function login() {
    setLoading(true); setFailed(false);
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch { setFailed(true); }
    finally { setLoading(false); }
  }
  return (
    <div className="fixed inset-0 bg-[#062c24] flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl flex flex-col gap-4">
        <div className="w-14 h-14 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto border border-emerald-100">
          <i className="fas fa-user-shield text-xl" aria-hidden="true"></i>
        </div>
        <div>
          <h1 style={{ textTransform: "none" }} className="text-2xl font-extrabold text-[#062c24]">Pacak Khemah admin</h1>
          <p className="text-sm text-slate-600 mt-1">Sign in with an admin Google account.</p>
        </div>
        <button onClick={login} disabled={loading}
          className="min-h-12 w-full rounded-2xl border border-slate-300 bg-white text-slate-800 text-[15px] font-semibold hover:bg-slate-50 flex items-center justify-center gap-3 disabled:opacity-60">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {loading ? <i className="fas fa-spinner fa-spin" aria-hidden="true"></i> : <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="" />}
          Sign in with Google
        </button>
        {denied && <p role="alert" className="text-sm font-semibold text-red-800">This account does not have admin access.</p>}
        {failed && <p role="alert" className="text-sm font-semibold text-red-800">Sign-in did not finish. Please try again.</p>}
        <Link href="/directory" className="text-sm font-semibold text-emerald-800 min-h-10 flex items-center justify-center">Back to the site</Link>
      </div>
    </div>
  );
}

function useAlertCounts(allVendors: AdminVendor[]) {
  const [topUps, setTopUps] = useState(0);
  const [pendingOrders, setPendingOrders] = useState(0);
  useEffect(() => {
    const a = onSnapshot(query(collection(db, "topups"), where("status", "==", "pending")), s => setTopUps(s.size), () => setTopUps(0));
    // Only pending orders, not the whole collection
    const b = onSnapshot(query(collection(db, "orders"), where("status", "==", "pending")), s => setPendingOrders(s.docs.filter(d => !d.data().deleted).length), () => setPendingOrders(0));
    return () => { a(); b(); };
  }, []);
  const applications = allVendors.filter(v => v.status === "pending").length;
  return { applications, topUps, pendingOrders };
}

function AdminShell({ user, allVendors }: { user: User; allVendors: AdminVendor[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("tab") || "home";
  const alias = ALIASES[raw];
  const tab: AdminTab = alias?.tab || (NAV.some(n => n.id === raw) ? raw as AdminTab : "home");
  const param = (k: string) => alias?.extra?.[k] || params.get(k) || undefined;

  const navigate: AdminNavigate = useCallback((next, extra = {}) => {
    const q = new URLSearchParams({ tab: next, ...extra });
    router.push(`/admin?${q.toString()}`);
    document.getElementById("admin-main")?.scrollTo({ top: 0 });
  }, [router]);

  const counts = useAlertCounts(allVendors);
  const badge: Partial<Record<AdminTab, number>> = { vendors: counts.applications, money: counts.topUps, orders: counts.pendingOrders };
  const label = NAV.find(n => n.id === tab)!.label;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 bg-[#062c24] text-white flex-col justify-between sticky top-0 h-screen">
        <div>
          <div className="px-5 py-5 flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-400 rounded-xl flex items-center justify-center font-extrabold text-[#062c24]">P</div>
            <div>
              <p className="text-[15px] font-bold leading-tight">Pacak Khemah</p>
              <p className="text-xs text-emerald-200">Admin</p>
            </div>
          </div>
          <nav aria-label="Admin" className="px-3 flex flex-col gap-1">
            {NAV.map(n => (
              <button key={n.id} type="button" onClick={() => navigate(n.id)} aria-current={tab === n.id ? "page" : undefined}
                className={`min-h-11 px-3 rounded-xl text-sm flex items-center gap-3 ${tab === n.id ? "bg-white/15 font-bold text-white" : "font-semibold text-emerald-100 hover:bg-white/10"}`}>
                <i className={`fas ${n.icon} w-5 text-center`} aria-hidden="true"></i>
                <span className="flex-1 text-left">{n.label}</span>
                {!!badge[n.id] && <span className="min-w-6 h-6 px-1.5 rounded-full bg-amber-400 text-[#062c24] text-xs font-bold flex items-center justify-center">{badge[n.id]}</span>}
              </button>
            ))}
          </nav>
        </div>
        <div className="px-5 py-4 border-t border-white/10 flex flex-col gap-2">
          <p className="text-xs text-emerald-100 truncate">{user.email}</p>
          <div className="flex gap-2">
            <Link href="/directory" target="_blank" className="flex-1 min-h-10 rounded-xl bg-white/10 hover:bg-white/20 text-[13px] font-semibold flex items-center justify-center">View site</Link>
            <button type="button" onClick={() => signOut(auth)} className="flex-1 min-h-10 rounded-xl bg-white/10 hover:bg-red-600 text-[13px] font-semibold">Log out</button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden bg-white border-b border-slate-200 sticky top-0 z-40">
          <div className="px-4 py-2.5 flex items-center gap-3">
            <div className="w-10 h-10 bg-[#062c24] text-emerald-300 rounded-xl flex items-center justify-center font-extrabold">P</div>
            <p className="flex-1 text-[15px] font-bold text-[#062c24]">Admin · {label}</p>
            <Link href="/directory" target="_blank" aria-label="View the site"
              className="w-10 h-10 rounded-xl border border-slate-200 text-slate-700 flex items-center justify-center hover:bg-slate-100">
              <i className="fas fa-external-link-alt text-sm" aria-hidden="true"></i>
            </Link>
            <button type="button" onClick={() => signOut(auth)} aria-label="Log out"
              className="w-10 h-10 rounded-xl border border-slate-200 text-slate-700 flex items-center justify-center hover:bg-slate-100">
              <i className="fas fa-right-from-bracket text-sm" aria-hidden="true"></i>
            </button>
          </div>
        </header>

        <main id="admin-main" className="max-w-xl lg:max-w-5xl mx-auto px-4 lg:px-8 pt-4 lg:pt-8 pb-28 lg:pb-12">
          {tab === "home" && <AdminHome allVendors={allVendors} counts={counts} onNavigate={navigate} />}
          {tab === "vendors" && <VendorsTab key={param("view") || "v"} allVendors={allVendors} initialView={param("view")} initialSearch={param("q")} />}
          {tab === "orders" && <OrdersTab key={param("status") || "o"} initialStatus={param("status")} />}
          {tab === "money" && <FinanceTab allVendors={allVendors} />}
          {tab === "site" && <SiteTab key={param("section") || "s"} initialSection={param("section")} />}
          {tab === "settings" && <AdminSettingsTab key={param("section") || "st"} initialSection={param("section")} />}
        </main>

        {/* Mobile bottom nav */}
        <nav aria-label="Admin" className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200">
          <div className="max-w-xl mx-auto grid grid-cols-6">
            {NAV.map(n => (
              <button key={n.id} type="button" onClick={() => navigate(n.id)} aria-current={tab === n.id ? "page" : undefined}
                className={`relative min-h-[58px] flex flex-col items-center justify-center gap-1 text-xs ${tab === n.id ? "text-[#062c24] font-bold" : "text-slate-600 font-semibold"}`}>
                {tab === n.id && <span className="absolute top-0 left-3 right-3 h-[3px] rounded-b bg-[#062c24]" aria-hidden="true"></span>}
                <i className={`fas ${n.icon} text-lg`} aria-hidden="true"></i>
                {n.label}
                {!!badge[n.id] && <span className="absolute top-1.5 right-[18%] min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center">{badge[n.id]! > 9 ? "9+" : badge[n.id]}</span>}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}

function AdminPageInner() {
  const [user, setUser] = useState<User | null>(null);
  const [allVendors, setAllVendors] = useState<AdminVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let stopVendors: (() => void) | null = null;
    const unsub = onAuthStateChanged(auth, async (u) => {
      stopVendors?.(); stopVendors = null;
      if (u && await isAdminEmail(u.email)) {
        setUser(u); setDenied(false);
        // Private details (login email) live in vendors/{id}/privateInfo.
        let vendorDocs: AdminVendor[] = [];
        let emails: Record<string, string> = {};
        let lastActive: Record<string, number> = {};
        const merge = () => setAllVendors(vendorDocs.map(v => ({ ...v, email: emails[v.id] ?? v.email, lastActiveAt: lastActive[v.id] })));
        const stopA = onSnapshot(collection(db, "vendors"), snap => {
          vendorDocs = snap.docs.map(d => ({ id: d.id, ...d.data() } as AdminVendor));
          merge();
        });
        const stopB = onSnapshot(collectionGroup(db, "privateInfo"), snap => {
          emails = {}; lastActive = {};
          snap.docs.forEach(d => {
            const id = d.ref.parent.parent?.id; if (!id) return;
            if (d.id === "presence") {
              // A just-written serverTimestamp is null locally until confirmed; estimate it as now.
              const t = d.get("lastActiveAt", { serverTimestamps: "estimate" });
              if (t?.toMillis) lastActive[id] = t.toMillis();
              return;
            }
            const e = d.data().email; if (e) emails[id] = e;
          });
          merge();
        }, e => console.warn("Private details:", e));
        stopVendors = () => { stopA(); stopB(); };
      } else {
        if (u) { setDenied(true); await signOut(auth); }
        setUser(null);
      }
      setLoading(false);
    });
    return () => { unsub(); stopVendors?.(); };
  }, []);

  if (loading) return (
    <div className="fixed inset-0 bg-[#062c24] flex items-center justify-center" role="status">
      <i className="fas fa-spinner fa-spin text-2xl text-emerald-300" aria-hidden="true"></i>
      <span className="sr-only">Loading</span>
    </div>
  );
  if (!user) return <AdminGate denied={denied} />;
  return <AdminShell user={user} allVendors={allVendors} />;
}

export default function AdminPage() {
  return <Suspense fallback={null}><AdminPageInner /></Suspense>;
}
