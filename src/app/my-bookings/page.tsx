"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";

type SavedOrder = {
  id: string;
  vendorId: string;
  vendorName?: string;
  vendorSlug?: string;
  items: { name: string; qty: number; price: number; variantLabel?: string }[];
  totalAmount: number;
  rentalAmount?: number;
  depositAmount?: number;
  bookingDates: { start: string; end: string };
  status: string;
  paymentStatus?: string;
  createdAt: string;
  customerName?: string;
  customerPhone?: string;
};

function formatDate(str: string): string {
  if (!str) return "—";
  try { return new Date(str).toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short", year: "numeric" }); }
  catch { return str; }
}

function getNights(start: string, end: string): number {
  try { return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000); }
  catch { return 0; }
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-50 text-amber-600 border-amber-200",
  confirmed: "bg-blue-50 text-blue-600 border-blue-200",
  completed: "bg-emerald-50 text-emerald-600 border-emerald-200",
  cancelled: "bg-red-50 text-red-500 border-red-200",
  conflict: "bg-red-50 text-red-500 border-red-200",
};

const statusIcons: Record<string, string> = {
  pending: "fa-clock",
  confirmed: "fa-check-circle",
  completed: "fa-flag-checkered",
  cancelled: "fa-times-circle",
  conflict: "fa-exclamation-triangle",
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  conflict: "Conflict",
};

export default function MyBookingsPage() {
  const [orders, setOrders] = useState<SavedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [searched, setSearched] = useState(false);
  const [filter, setFilter] = useState<"all" | "upcoming" | "past">("all");

  // Auto-load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("pk_customer");
      if (saved) {
        const { phone: savedPhone } = JSON.parse(saved);
        if (savedPhone) {
          setPhone(savedPhone.startsWith("60") ? "0" + savedPhone.slice(2) : savedPhone);
          lookupOrders(savedPhone);
          return;
        }
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  function formatPhoneForLookup(raw: string): string {
    const digits = raw.replace(/\D/g, "");
    if (digits.startsWith("60")) return digits;
    if (digits.startsWith("0")) return "60" + digits.slice(1);
    return "60" + digits;
  }

  async function lookupOrders(rawPhone?: string) {
    const searchPhone = rawPhone || formatPhoneForLookup(phone);
    if (!searchPhone || searchPhone.length < 10) return;

    setLoading(true);
    setSearched(true);
    try {
      const q = query(
        collection(db, "orders"),
        where("customerPhone", "==", searchPhone),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      const results: SavedOrder[] = [];

      for (const d of snap.docs) {
        const data = d.data();
        if (data.deleted) continue;
        results.push({
          id: d.id,
          vendorId: data.vendorId,
          vendorName: data.vendorName,
          vendorSlug: data.vendorSlug,
          items: data.items || [],
          totalAmount: data.totalAmount || 0,
          rentalAmount: data.rentalAmount,
          depositAmount: data.depositAmount,
          bookingDates: data.bookingDates || { start: "", end: "" },
          status: data.status || "pending",
          paymentStatus: data.paymentStatus,
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() || "",
          customerName: data.customerName,
          customerPhone: data.customerPhone,
        });
      }

      setOrders(results);

      // Save phone for next visit
      try {
        const existing = JSON.parse(localStorage.getItem("pk_customer") || "{}");
        localStorage.setItem("pk_customer", JSON.stringify({ ...existing, phone: searchPhone }));
      } catch { /* ignore */ }
    } catch (e) {
      console.error("Lookup error:", e);
    } finally {
      setLoading(false);
    }
  }

  // Filter orders
  const today = new Date().toISOString().split("T")[0];
  const filtered = orders.filter(o => {
    if (filter === "upcoming") return o.bookingDates.start >= today && o.status !== "cancelled";
    if (filter === "past") return o.bookingDates.end < today || o.status === "completed" || o.status === "cancelled";
    return true;
  });

  const upcomingCount = orders.filter(o => o.bookingDates.start >= today && o.status !== "cancelled").length;
  const totalSpent = orders.filter(o => o.status !== "cancelled").reduce((s, o) => s + (o.rentalAmount ?? o.totalAmount ?? 0), 0);

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: "#f8fafc" }}>
      {/* Header */}
      <header className="bg-[#062c24] text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "url('/pattern-chevron.png')", backgroundSize: "300px" }}></div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#062c24] via-[#062c24]/50 to-[#062c24]/90"></div>
        <div className="relative z-10 max-w-2xl mx-auto px-4 pt-6 pb-8">
          <div className="flex justify-between items-center mb-6">
            <Link href="/directory" className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 transition-colors">
              <i className="fas fa-arrow-left text-sm"></i>
            </Link>
            <h1 className="text-xs font-black uppercase tracking-widest">My Bookings</h1>
            <div className="w-10"></div>
          </div>

          {/* Phone Input */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
            <p className="text-[9px] font-black text-emerald-300 uppercase tracking-widest mb-2">Find your bookings</p>
            <div className="flex gap-2">
              <div className="flex-1 flex">
                <span className="flex items-center gap-1 bg-white/10 border border-r-0 border-white/20 px-3 rounded-l-xl text-xs font-bold text-white/60 shrink-0">
                  <i className="fab fa-whatsapp text-emerald-400"></i> +60
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/[^0-9\-\s]/g, ""))}
                  placeholder="012-345 6789"
                  className="w-full bg-white/10 border border-white/20 p-3 rounded-r-xl text-sm font-bold text-white outline-none placeholder:text-white/30 focus:border-emerald-400"
                  onKeyDown={e => e.key === "Enter" && lookupOrders()}
                />
              </div>
              <button onClick={() => lookupOrders()}
                className="bg-emerald-500 hover:bg-emerald-400 text-white px-5 rounded-xl font-black uppercase text-[10px] transition-colors shrink-0">
                <i className="fas fa-search"></i>
              </button>
            </div>
            <p className="text-[8px] text-white/40 mt-2">Enter the WhatsApp number you used to book</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <i className="fas fa-spinner fa-spin text-2xl text-slate-300"></i>
          </div>
        ) : !searched ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-search text-slate-300 text-2xl"></i>
            </div>
            <p className="text-sm font-black text-slate-400 uppercase">Enter your phone number</p>
            <p className="text-xs text-slate-300 mt-1">We'll look up your booking history</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-inbox text-slate-300 text-2xl"></i>
            </div>
            <p className="text-sm font-black text-slate-400 uppercase">No bookings found</p>
            <p className="text-xs text-slate-300 mt-1">Make sure you entered the right number</p>
            <Link href="/directory" className="inline-block mt-4 bg-[#062c24] text-white px-6 py-3 rounded-xl text-xs font-black uppercase hover:bg-emerald-800 transition-colors">
              <i className="fas fa-search mr-2"></i>Find Vendors
            </Link>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white rounded-2xl p-3 border border-slate-100 text-center">
                <p className="text-lg font-black text-[#062c24]">{orders.length}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase">Total</p>
              </div>
              <div className="bg-white rounded-2xl p-3 border border-slate-100 text-center">
                <p className="text-lg font-black text-emerald-600">{upcomingCount}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase">Upcoming</p>
              </div>
              <div className="bg-white rounded-2xl p-3 border border-slate-100 text-center">
                <p className="text-lg font-black text-[#062c24]">RM{totalSpent.toLocaleString()}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase">Spent</p>
              </div>
            </div>

            {/* Filter */}
            <div className="flex gap-2">
              {(["all", "upcoming", "past"] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                    filter === f ? "bg-[#062c24] text-white" : "bg-white text-slate-500 border border-slate-200"
                  }`}>
                  {f === "all" ? `All (${orders.length})` : f === "upcoming" ? `Upcoming (${upcomingCount})` : `Past (${orders.length - upcomingCount})`}
                </button>
              ))}
            </div>

            {/* Order List */}
            <div className="space-y-3">
              {filtered.map(order => {
                const nights = getNights(order.bookingDates.start, order.bookingDates.end);
                const isUpcoming = order.bookingDates.start >= today && order.status !== "cancelled";
                return (
                  <div key={order.id} className={`bg-white rounded-2xl border overflow-hidden ${isUpcoming ? "border-emerald-200 shadow-sm" : "border-slate-100"}`}>
                    {/* Vendor Header */}
                    <div className="flex items-center justify-between px-4 pt-4 pb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 bg-[#062c24] text-white rounded-lg flex items-center justify-center font-black text-xs shrink-0">
                          {(order.vendorName || "V")[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-[#062c24] truncate">{order.vendorName || "Vendor"}</p>
                          <p className="text-[8px] text-slate-400">{formatDate(order.createdAt)}</p>
                        </div>
                      </div>
                      <span className={`text-[8px] font-black px-2 py-1 rounded-full uppercase border ${statusColors[order.status] || "bg-slate-50 text-slate-400 border-slate-200"}`}>
                        <i className={`fas ${statusIcons[order.status] || "fa-circle"} mr-1`}></i>
                        {statusLabels[order.status] || order.status}
                      </span>
                    </div>

                    {/* Dates */}
                    <div className="px-4 py-2 flex items-center gap-3">
                      <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl flex-1">
                        <i className="fas fa-arrow-up text-emerald-500 text-[10px]"></i>
                        <div>
                          <p className="text-[7px] text-slate-400 font-bold uppercase">Pickup</p>
                          <p className="text-[10px] font-black text-[#062c24]">{formatDate(order.bookingDates.start)}</p>
                        </div>
                      </div>
                      <div className="text-[8px] font-black text-slate-300">{nights}N</div>
                      <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl flex-1">
                        <i className="fas fa-arrow-down text-blue-500 text-[10px]"></i>
                        <div>
                          <p className="text-[7px] text-slate-400 font-bold uppercase">Return</p>
                          <p className="text-[10px] font-black text-[#062c24]">{formatDate(order.bookingDates.end)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="px-4 py-2">
                      {order.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate-600">{item.name}</span>
                            {item.variantLabel && <span className="text-[8px] text-teal-600 bg-teal-50 px-1 py-0.5 rounded">{item.variantLabel}</span>}
                            <span className="text-[9px] text-slate-400">×{item.qty}</span>
                          </div>
                          <span className="text-[10px] font-bold text-slate-500">RM{item.price * item.qty}</span>
                        </div>
                      ))}
                    </div>

                    {/* Total + Actions */}
                    <div className="px-4 py-3 bg-slate-50 flex items-center justify-between border-t border-slate-100">
                      <div>
                        {order.depositAmount ? (
                          <>
                            <p className="text-[8px] text-slate-400">Rental RM{order.rentalAmount ?? (order.totalAmount - order.depositAmount)} + Deposit RM{order.depositAmount}</p>
                            <p className="text-sm font-black text-[#062c24]">Total: RM{order.totalAmount}</p>
                          </>
                        ) : (
                          <p className="text-sm font-black text-[#062c24]">RM{order.totalAmount}</p>
                        )}
                      </div>
                      {order.vendorSlug && (
                        <Link href={`/shop/${order.vendorSlug}`}
                          className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl uppercase hover:bg-emerald-100 transition-colors">
                          <i className="fas fa-redo mr-1"></i>Book Again
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-6 border-t border-slate-200 bg-white mt-6">
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Pacak Khemah</p>
        <div className="flex justify-center gap-4 mb-3">
          <Link href="/directory" className="text-[9px] font-bold text-slate-400 hover:text-emerald-600">Directory</Link>
          <Link href="/faq" className="text-[9px] font-bold text-slate-400 hover:text-emerald-600">FAQ</Link>
          <Link href="/about" className="text-[9px] font-bold text-slate-400 hover:text-emerald-600">About</Link>
        </div>
        <p className="text-[8px] text-slate-300">© 2026 Pacak Khemah</p>
      </footer>
    </div>
  );
}