"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

type Order = {
  id: string;
  customerName?: string;
  customerPhone?: string;
  items: { name: string; qty: number }[];
  totalAmount: number;
  rentalAmount?: number;
  bookingDates: { start: string; end: string };
  status: string;
  paymentStatus?: string;
  createdAt: any;
};

type HomeTabProps = {
  vendorId: string;
  vendorData: any;
  onNavigate: (tab: string) => void;
};

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatShortDate(str: string): string {
  try { return new Date(str).toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short" }); }
  catch { return str; }
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Selamat Pagi";
  if (h < 18) return "Selamat Tengah Hari";
  return "Selamat Petang";
}

export default function HomeTab({ vendorId, vendorData, onNavigate }: HomeTabProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "orders"), where("vendorId", "==", vendorId));
    const unsub = onSnapshot(q, snap => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)).filter(o => !(o as any).deleted));
      setLoading(false);
    });
    return () => unsub();
  }, [vendorId]);

  // ═══════════════════════════════════════════════════════════
  // TODAY & THIS WEEK ANALYSIS
  // ═══════════════════════════════════════════════════════════
  const today = todayISO();
  const tomorrow = tomorrowISO();

  const activeOrders = orders.filter(o => o.status === "confirmed" || o.status === "pending");

  const todayPickups = activeOrders.filter(o => o.bookingDates?.start === today);
  const todayReturns = activeOrders.filter(o => o.bookingDates?.end === today);
  const tomorrowPickups = activeOrders.filter(o => o.bookingDates?.start === tomorrow);
  const tomorrowReturns = activeOrders.filter(o => o.bookingDates?.end === tomorrow);

  const pendingOrders = orders.filter(o => o.status === "pending");

  // This month revenue
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthOrders = orders.filter(o => {
    const d = o.createdAt?.toDate?.();
    return d && d >= monthStart && o.status !== "cancelled";
  });
  const monthCompleted = thisMonthOrders.filter(o => o.status === "completed");
  const monthConfirmed = thisMonthOrders.filter(o => o.status === "confirmed");
  const monthRevenue = monthCompleted.reduce((s, o) => s + (o.rentalAmount ?? o.totalAmount ?? 0), 0);
  const monthPendingRevenue = monthConfirmed.reduce((s, o) => s + (o.rentalAmount ?? o.totalAmount ?? 0), 0);

  const credits = vendorData.credits || 0;
  const lowCredits = credits <= 5;

  return (
    <div className="space-y-5 pb-20">
      {/* ═══════════════════════════════════════════════════════════
          GREETING + ALERT BAR
          ═══════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-br from-[#062c24] to-emerald-800 rounded-2xl p-5 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url('/pattern-chevron.png')", backgroundSize: "200px" }}></div>
        <div className="relative z-10">
          <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest">{getGreeting()}</p>
          <h2 className="text-lg font-black uppercase leading-tight mt-0.5">{vendorData.name}</h2>
          {(todayPickups.length > 0 || todayReturns.length > 0) ? (
            <p className="text-xs text-white/80 mt-2">
              <i className="fas fa-calendar-day mr-1.5 text-emerald-400"></i>
              Hari ini: {todayPickups.length > 0 && `${todayPickups.length} pickup`}
              {todayPickups.length > 0 && todayReturns.length > 0 && " • "}
              {todayReturns.length > 0 && `${todayReturns.length} return`}
            </p>
          ) : (
            <p className="text-xs text-white/60 mt-2">Tiada booking untuk hari ini</p>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          REVENUE SNAPSHOT
          ═══════════════════════════════════════════════════════════ */}
      <div>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2.5 px-1">This Month</p>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-2xl p-3 border border-slate-100">
            <p className="text-[8px] font-black text-slate-400 uppercase">Revenue</p>
            <p className="text-lg font-black text-emerald-600 leading-tight mt-1">RM{monthRevenue.toLocaleString()}</p>
            <p className="text-[7px] text-slate-300 mt-0.5">{monthCompleted.length} completed</p>
          </div>
          <div className="bg-white rounded-2xl p-3 border border-slate-100">
            <p className="text-[8px] font-black text-slate-400 uppercase">Pending</p>
            <p className="text-lg font-black text-amber-600 leading-tight mt-1">RM{monthPendingRevenue.toLocaleString()}</p>
            <p className="text-[7px] text-slate-300 mt-0.5">{monthConfirmed.length} confirmed</p>
          </div>
          <div className="bg-white rounded-2xl p-3 border border-slate-100">
            <p className="text-[8px] font-black text-slate-400 uppercase">New Orders</p>
            <p className="text-lg font-black text-[#062c24] leading-tight mt-1">{pendingOrders.length}</p>
            <p className="text-[7px] text-slate-300 mt-0.5">awaiting action</p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          TODAY'S ACTION LIST
          ═══════════════════════════════════════════════════════════ */}
      {(todayPickups.length > 0 || todayReturns.length > 0 || tomorrowPickups.length > 0) && (
        <div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2.5 px-1 flex items-center justify-between">
            <span><i className="fas fa-bolt text-amber-500 mr-1.5"></i>Action Required</span>
            <button onClick={() => onNavigate("calendar")} className="text-emerald-600 hover:underline normal-case font-bold">View calendar →</button>
          </p>
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden divide-y divide-slate-50">
            {todayPickups.map(o => (
              <div key={"p" + o.id} className="flex items-center gap-3 p-3.5">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                  <i className="fas fa-arrow-up text-sm"></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Pickup today</p>
                  <p className="text-sm font-black text-[#062c24] truncate">{o.customerName || "Customer"}</p>
                  <p className="text-[10px] text-slate-400 font-bold truncate">{o.items?.map(i => `${i.name} ×${i.qty}`).join(", ")}</p>
                </div>
                {o.customerPhone && (
                  <a href={`https://wa.me/${o.customerPhone}`} target="_blank" rel="noreferrer"
                    className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0 hover:bg-emerald-100 transition-colors">
                    <i className="fab fa-whatsapp"></i>
                  </a>
                )}
              </div>
            ))}
            {todayReturns.map(o => (
              <div key={"r" + o.id} className="flex items-center gap-3 p-3.5">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                  <i className="fas fa-arrow-down text-sm"></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest">Return today</p>
                  <p className="text-sm font-black text-[#062c24] truncate">{o.customerName || "Customer"}</p>
                  <p className="text-[10px] text-slate-400 font-bold truncate">{o.items?.map(i => `${i.name} ×${i.qty}`).join(", ")}</p>
                </div>
                {o.customerPhone && (
                  <a href={`https://wa.me/${o.customerPhone}`} target="_blank" rel="noreferrer"
                    className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0 hover:bg-emerald-100 transition-colors">
                    <i className="fab fa-whatsapp"></i>
                  </a>
                )}
              </div>
            ))}
            {tomorrowPickups.map(o => (
              <div key={"tp" + o.id} className="flex items-center gap-3 p-3.5 bg-amber-50/30">
                <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                  <i className="fas fa-clock text-sm"></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest">Pickup tomorrow</p>
                  <p className="text-sm font-black text-[#062c24] truncate">{o.customerName || "Customer"}</p>
                  <p className="text-[10px] text-slate-400 font-bold truncate">{o.items?.map(i => `${i.name} ×${i.qty}`).join(", ")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          PENDING ORDERS ALERT
          ═══════════════════════════════════════════════════════════ */}
      {pendingOrders.length > 0 && (
        <button onClick={() => onNavigate("orders")}
          className="w-full bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 hover:shadow-md transition-all">
          <div className="w-11 h-11 bg-amber-500 text-white rounded-xl flex items-center justify-center shrink-0">
            <i className="fas fa-exclamation text-lg"></i>
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-black text-amber-900">{pendingOrders.length} pending order{pendingOrders.length > 1 ? "s" : ""}</p>
            <p className="text-[10px] text-amber-700 font-bold">Tap to review and confirm</p>
          </div>
          <i className="fas fa-chevron-right text-amber-600 text-sm"></i>
        </button>
      )}

      {/* ═══════════════════════════════════════════════════════════
          LOW CREDITS ALERT
          ═══════════════════════════════════════════════════════════ */}
      {lowCredits && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-11 h-11 bg-red-500 text-white rounded-xl flex items-center justify-center shrink-0">
            <i className="fas fa-coins"></i>
          </div>
          <div className="flex-1">
            <p className="text-sm font-black text-red-900">Credit rendah: {credits}</p>
            <p className="text-[10px] text-red-700 font-bold">Top up untuk terima lead baru</p>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          MANAGE SHOP TILES
          ═══════════════════════════════════════════════════════════ */}
      <div>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2.5 px-1"><i className="fas fa-tools mr-1.5"></i>Manage Shop</p>
        <div className="grid grid-cols-3 gap-2">
          <ShortcutTile icon="fa-boxes" color="emerald" label="Inventory" onClick={() => onNavigate("inventory")} />
          <ShortcutTile icon="fa-store" color="blue" label="Storefront" onClick={() => onNavigate("storefront")} />
          <ShortcutTile icon="fa-bullhorn" color="purple" label="Updates" onClick={() => onNavigate("updates")} />
          <ShortcutTile icon="fa-file-contract" color="slate" label="Documents" onClick={() => onNavigate("documents")} />
          <ShortcutTile icon="fa-gift" color="amber" label="Referrals" onClick={() => onNavigate("referrals")} />
          <ShortcutTile icon="fa-cog" color="slate" label="Settings" onClick={() => onNavigate("settings")} />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          QUICK STATS (bottom strip)
          ═══════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Quick Stats</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
              <i className="fas fa-star text-xs"></i>
            </div>
            <div>
              <p className="text-sm font-black text-[#062c24]">{vendorData.rating?.toFixed(1) || "—"}</p>
              <p className="text-[8px] text-slate-400 font-bold">{vendorData.reviewCount || 0} reviews</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
              <i className="fas fa-coins text-xs"></i>
            </div>
            <div>
              <p className="text-sm font-black text-[#062c24]">{credits}</p>
              <p className="text-[8px] text-slate-400 font-bold">credits left</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SHORTCUT TILE
// ═══════════════════════════════════════════════════════════
function ShortcutTile({ icon, color, label, onClick }: { icon: string; color: string; label: string; onClick: () => void }) {
  const colors: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-purple-50 text-purple-600",
    amber: "bg-amber-50 text-amber-600",
    slate: "bg-slate-50 text-slate-600",
    red: "bg-red-50 text-red-600",
  };
  return (
    <button onClick={onClick}
      className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-col items-center gap-2 hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-95 min-h-[88px]">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
        <i className={`fas ${icon} text-sm`}></i>
      </div>
      <span className="text-[9px] font-black text-[#062c24] uppercase">{label}</span>
    </button>
  );
}