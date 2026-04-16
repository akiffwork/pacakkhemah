"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";

type Order = {
  id: string;
  customerName?: string;
  customerPhone?: string;
  items: { name: string; qty: number; price: number }[];
  totalAmount: number;
  rentalAmount?: number;
  depositAmount?: number;
  bookingDates: { start: string; end: string };
  status: string;
  paymentStatus?: string;
  createdAt: any;
  completedAt?: any;
};

type Review = {
  id: string;
  rating: number;
  ratings?: Record<string, number>;
  customerName?: string;
};

type Customer = {
  name: string;
  phone: string;
  totalSpent: number;
  bookings: number;
  completedBookings: number;
  lastBooking: string;
  firstBooking: string;
  avgOrderValue: number;
  favoriteItems: { name: string; count: number }[];
  status: "active" | "at_risk" | "lost";
};

type ItemPerf = {
  name: string;
  timesRented: number;
  totalRevenue: number;
  avgRating: number;
  reviewCount: number;
  utilizationDays: number;
  lastRented: string;
};

type View = "customers" | "heatmap" | "items";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function InsightsTab({ vendorId }: { vendorId: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("customers");
  const [custSearch, setCustSearch] = useState("");
  const [custSort, setCustSort] = useState<"spent" | "bookings" | "recent">("spent");

  useEffect(() => {
    const q1 = query(collection(db, "orders"), where("vendorId", "==", vendorId), orderBy("createdAt", "desc"));
    const q2 = query(collection(db, "reviews"), where("vendorId", "==", vendorId));

    const unsub1 = onSnapshot(q1, snap => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)).filter(o => !(o as any).deleted));
      setLoading(false);
    });
    const unsub2 = onSnapshot(q2, snap => {
      setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() } as Review)));
    });
    return () => { unsub1(); unsub2(); };
  }, [vendorId]);

  // ═══════════════════════════════════════════════════════════
  // CUSTOMER DATABASE — aggregate from orders
  // ═══════════════════════════════════════════════════════════
  const customers: Customer[] = (() => {
    const map: Record<string, Customer> = {};
    const validOrders = orders.filter(o => o.customerPhone && o.status !== "cancelled");

    for (const o of validOrders) {
      const key = o.customerPhone!.replace(/\D/g, "");
      if (!key) continue;

      if (!map[key]) {
        map[key] = {
          name: o.customerName || "Unknown",
          phone: key,
          totalSpent: 0,
          bookings: 0,
          completedBookings: 0,
          lastBooking: "",
          firstBooking: "",
          avgOrderValue: 0,
          favoriteItems: [],
          status: "active",
        };
      }

      const c = map[key];
      if (o.customerName && c.name === "Unknown") c.name = o.customerName;
      const revenue = o.rentalAmount ?? o.totalAmount ?? 0;
      c.totalSpent += revenue;
      c.bookings += 1;
      if (o.status === "completed") c.completedBookings += 1;

      const dateStr = o.createdAt?.toDate?.()?.toISOString?.() || o.bookingDates?.start || "";
      if (!c.firstBooking || dateStr < c.firstBooking) c.firstBooking = dateStr;
      if (!c.lastBooking || dateStr > c.lastBooking) c.lastBooking = dateStr;

      // Track item preferences
      for (const item of o.items || []) {
        const existing = c.favoriteItems.find(f => f.name === item.name);
        if (existing) existing.count += item.qty;
        else c.favoriteItems.push({ name: item.name, count: item.qty });
      }
    }

    // Calculate status and avg
    const now = Date.now();
    for (const c of Object.values(map)) {
      c.avgOrderValue = c.bookings > 0 ? Math.round(c.totalSpent / c.bookings) : 0;
      c.favoriteItems.sort((a, b) => b.count - a.count);
      const lastMs = c.lastBooking ? new Date(c.lastBooking).getTime() : 0;
      const daysSince = lastMs ? Math.floor((now - lastMs) / 86400000) : 999;
      c.status = daysSince > 120 ? "lost" : daysSince > 60 ? "at_risk" : "active";
    }

    let list = Object.values(map);
    if (custSearch) {
      const q = custSearch.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
    }
    if (custSort === "spent") list.sort((a, b) => b.totalSpent - a.totalSpent);
    else if (custSort === "bookings") list.sort((a, b) => b.bookings - a.bookings);
    else list.sort((a, b) => (b.lastBooking || "").localeCompare(a.lastBooking || ""));

    return list;
  })();

  // ═══════════════════════════════════════════════════════════
  // BOOKING HEATMAP — monthly + day-of-week patterns
  // ═══════════════════════════════════════════════════════════
  const heatmapData = (() => {
    const validOrders = orders.filter(o => o.status !== "cancelled" && o.bookingDates?.start);

    // Monthly bookings (last 12 months)
    const monthly: { month: string; bookings: number; revenue: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const m = d.getMonth();
      const y = d.getFullYear();
      const label = `${MONTHS[m]} ${String(y).slice(2)}`;
      const monthOrders = validOrders.filter(o => {
        const ts = o.createdAt?.toDate?.();
        return ts && ts.getMonth() === m && ts.getFullYear() === y;
      });
      monthly.push({
        month: label,
        bookings: monthOrders.length,
        revenue: monthOrders.reduce((s, o) => s + (o.rentalAmount ?? o.totalAmount ?? 0), 0),
      });
    }

    // Day-of-week distribution (pickup days)
    const dayDist = new Array(7).fill(0);
    for (const o of validOrders) {
      const d = new Date(o.bookingDates.start);
      if (!isNaN(d.getTime())) {
        const day = (d.getDay() + 6) % 7; // Mon=0, Sun=6
        dayDist[day]++;
      }
    }
    const maxDay = Math.max(...dayDist, 1);

    // Peak dates (most popular booking dates)
    const dateCounts: Record<string, number> = {};
    for (const o of validOrders) {
      const start = o.bookingDates.start;
      if (start) dateCounts[start] = (dateCounts[start] || 0) + 1;
    }
    const peakDates = Object.entries(dateCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([date, count]) => ({ date, count }));

    // Average booking duration
    let totalNights = 0;
    let countDurations = 0;
    for (const o of validOrders) {
      if (o.bookingDates.start && o.bookingDates.end) {
        const nights = Math.round((new Date(o.bookingDates.end).getTime() - new Date(o.bookingDates.start).getTime()) / 86400000);
        if (nights > 0 && nights < 30) { totalNights += nights; countDurations++; }
      }
    }
    const avgNights = countDurations > 0 ? (totalNights / countDurations).toFixed(1) : "—";

    return { monthly, dayDist, maxDay, peakDates, avgNights };
  })();

  // ═══════════════════════════════════════════════════════════
  // ITEM PERFORMANCE — per gear stats
  // ═══════════════════════════════════════════════════════════
  const itemPerformance: ItemPerf[] = (() => {
    const map: Record<string, ItemPerf> = {};
    const validOrders = orders.filter(o => o.status !== "cancelled");

    for (const o of validOrders) {
      for (const item of o.items || []) {
        if (!map[item.name]) {
          map[item.name] = { name: item.name, timesRented: 0, totalRevenue: 0, avgRating: 0, reviewCount: 0, utilizationDays: 0, lastRented: "" };
        }
        const p = map[item.name];
        p.timesRented += item.qty;
        p.totalRevenue += item.price * item.qty;
        const dateStr = o.createdAt?.toDate?.()?.toISOString?.() || "";
        if (!p.lastRented || dateStr > p.lastRented) p.lastRented = dateStr;

        // Calculate rental days
        if (o.bookingDates?.start && o.bookingDates?.end) {
          const nights = Math.round((new Date(o.bookingDates.end).getTime() - new Date(o.bookingDates.start).getTime()) / 86400000);
          if (nights > 0) p.utilizationDays += nights * item.qty;
        }
      }
    }

    return Object.values(map).sort((a, b) => b.totalRevenue - a.totalRevenue);
  })();

  // ═══════════════════════════════════════════════════════════
  // SUMMARY STATS
  // ═══════════════════════════════════════════════════════════
  const totalCustomers = customers.length;
  const repeatCustomers = customers.filter(c => c.bookings > 1).length;
  const repeatRate = totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 100) : 0;
  const atRiskCount = customers.filter(c => c.status === "at_risk").length;
  const topItem = itemPerformance[0];

  function formatDate(str: string): string {
    if (!str) return "—";
    try { return new Date(str).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" }); }
    catch { return "—"; }
  }

  function daysSince(str: string): number {
    if (!str) return 999;
    return Math.floor((Date.now() - new Date(str).getTime()) / 86400000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <i className="fas fa-spinner fa-spin text-2xl text-slate-300"></i>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-black text-[#062c24] uppercase">Insights</h2>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer data, demand patterns & item performance</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-100">
          <p className="text-[9px] font-black text-slate-400 uppercase">Total Customers</p>
          <p className="text-2xl font-black text-[#062c24]">{totalCustomers}</p>
          <p className="text-[8px] text-slate-300 mt-1">{repeatCustomers} repeat ({repeatRate}%)</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100">
          <p className="text-[9px] font-black text-amber-600 uppercase">At Risk</p>
          <p className="text-2xl font-black text-amber-600">{atRiskCount}</p>
          <p className="text-[8px] text-amber-500 mt-1">60+ days inactive</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100">
          <p className="text-[9px] font-black text-slate-400 uppercase">Avg Duration</p>
          <p className="text-2xl font-black text-[#062c24]">{heatmapData.avgNights}</p>
          <p className="text-[8px] text-slate-300 mt-1">Nights per booking</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100">
          <p className="text-[9px] font-black text-slate-400 uppercase">Top Item</p>
          <p className="text-sm font-black text-[#062c24] truncate">{topItem?.name || "—"}</p>
          <p className="text-[8px] text-emerald-600 mt-1">{topItem ? `RM${topItem.totalRevenue} • ${topItem.timesRented}x rented` : ""}</p>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2">
        {([
          { id: "customers" as View, label: "Customers", icon: "fa-users" },
          { id: "heatmap" as View, label: "Demand", icon: "fa-chart-bar" },
          { id: "items" as View, label: "Items", icon: "fa-box" },
        ]).map(v => (
          <button key={v.id} onClick={() => setView(v.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${
              view === v.id ? "bg-[#062c24] text-white shadow-md" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
            }`}>
            <i className={`fas ${v.icon}`}></i> {v.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          CUSTOMERS VIEW
          ═══════════════════════════════════════════════════════════ */}
      {view === "customers" && (
        <div className="space-y-3">
          {/* Search + Sort */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
              <input value={custSearch} onChange={e => setCustSearch(e.target.value)}
                placeholder="Search customer..."
                className="w-full bg-white border border-slate-200 pl-9 pr-3 py-2.5 rounded-xl text-xs font-bold outline-none focus:border-emerald-400" />
            </div>
            <select value={custSort} onChange={e => setCustSort(e.target.value as any)}
              className="bg-white border border-slate-200 px-3 py-2.5 rounded-xl text-[10px] font-bold text-slate-600 outline-none appearance-none">
              <option value="spent">Top Spent</option>
              <option value="bookings">Most Bookings</option>
              <option value="recent">Most Recent</option>
            </select>
          </div>

          {customers.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
              <i className="fas fa-users text-slate-200 text-4xl mb-3"></i>
              <p className="text-sm font-bold text-slate-400">No customer data yet</p>
              <p className="text-[10px] text-slate-300 mt-1">Customer profiles are built from completed orders</p>
            </div>
          ) : (
            customers.map(c => (
              <div key={c.phone} className={`bg-white rounded-2xl border overflow-hidden transition-all ${
                c.status === "at_risk" ? "border-amber-200" : c.status === "lost" ? "border-red-200" : "border-slate-100"
              }`}>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm ${
                        c.status === "active" ? "bg-emerald-100 text-emerald-600" :
                        c.status === "at_risk" ? "bg-amber-100 text-amber-600" : "bg-red-100 text-red-500"
                      }`}>
                        {c.name[0]?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <p className="text-sm font-black text-[#062c24]">{c.name}</p>
                        <p className="text-[9px] text-slate-400 font-bold">{c.phone}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${
                        c.status === "active" ? "bg-emerald-50 text-emerald-600" :
                        c.status === "at_risk" ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-500"
                      }`}>
                        {c.status === "active" ? "Active" : c.status === "at_risk" ? "At Risk" : "Lost"}
                      </span>
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    <div className="text-center bg-slate-50 rounded-lg py-2">
                      <p className="text-xs font-black text-[#062c24]">RM{c.totalSpent.toLocaleString()}</p>
                      <p className="text-[7px] text-slate-400 font-bold uppercase">Spent</p>
                    </div>
                    <div className="text-center bg-slate-50 rounded-lg py-2">
                      <p className="text-xs font-black text-[#062c24]">{c.bookings}</p>
                      <p className="text-[7px] text-slate-400 font-bold uppercase">Bookings</p>
                    </div>
                    <div className="text-center bg-slate-50 rounded-lg py-2">
                      <p className="text-xs font-black text-[#062c24]">RM{c.avgOrderValue}</p>
                      <p className="text-[7px] text-slate-400 font-bold uppercase">Avg Order</p>
                    </div>
                    <div className="text-center bg-slate-50 rounded-lg py-2">
                      <p className="text-xs font-black text-[#062c24]">{daysSince(c.lastBooking)}d</p>
                      <p className="text-[7px] text-slate-400 font-bold uppercase">Last Visit</p>
                    </div>
                  </div>

                  {/* Favorite Items */}
                  {c.favoriteItems.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {c.favoriteItems.slice(0, 3).map(f => (
                        <span key={f.name} className="text-[8px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full">
                          {f.name} ×{f.count}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <a href={`https://wa.me/${c.phone}`} target="_blank" rel="noreferrer"
                      className="flex-1 py-2 rounded-xl text-[9px] font-black uppercase bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center gap-1.5 hover:bg-emerald-100 transition-colors">
                      <i className="fab fa-whatsapp"></i> Message
                    </a>
                    {c.status !== "active" && (
                      <a href={`https://wa.me/${c.phone}?text=${encodeURIComponent(`Hi ${c.name}! 👋\n\nLama tak camping! Kami ada promosi khas untuk pelanggan setia.\n\nJom check out gear terbaru kami 🏕️`)}`}
                        target="_blank" rel="noreferrer"
                        className="flex-1 py-2 rounded-xl text-[9px] font-black uppercase bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center gap-1.5 hover:bg-amber-100 transition-colors">
                        <i className="fas fa-bell"></i> Re-engage
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          DEMAND HEATMAP VIEW
          ═══════════════════════════════════════════════════════════ */}
      {view === "heatmap" && (
        <div className="space-y-4">
          {/* Monthly Chart */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100">
            <p className="text-[9px] font-black text-slate-400 uppercase mb-4">Monthly Bookings (12 Months)</p>
            <div className="flex items-end gap-1.5 h-36">
              {heatmapData.monthly.map((m, i) => {
                const maxBookings = Math.max(...heatmapData.monthly.map(x => x.bookings), 1);
                const h = (m.bookings / maxBookings) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    {m.bookings > 0 && <p className="text-[7px] font-bold text-slate-500">{m.bookings}</p>}
                    <div className="w-full bg-slate-50 rounded-t-md relative" style={{ height: "100%" }}>
                      <div className="absolute bottom-0 w-full bg-emerald-400 rounded-t-md transition-all duration-500"
                        style={{ height: `${h}%`, minHeight: m.bookings > 0 ? "4px" : "0" }}></div>
                    </div>
                    <p className="text-[6px] font-bold text-slate-400 leading-none">{m.month}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Day of Week */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100">
            <p className="text-[9px] font-black text-slate-400 uppercase mb-4">Pickup Day Distribution</p>
            <div className="space-y-2">
              {DAYS.map((day, i) => (
                <div key={day} className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-slate-500 w-8">{day}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${i >= 4 ? "bg-emerald-500" : "bg-emerald-300"}`}
                      style={{ width: `${(heatmapData.dayDist[i] / heatmapData.maxDay) * 100}%` }}></div>
                  </div>
                  <span className="text-[10px] font-black text-[#062c24] w-6 text-right">{heatmapData.dayDist[i]}</span>
                </div>
              ))}
            </div>
            <p className="text-[8px] text-slate-400 mt-3 text-center">
              <i className="fas fa-lightbulb text-amber-400 mr-1"></i>
              {heatmapData.dayDist[4] + heatmapData.dayDist[5] > heatmapData.dayDist[0] + heatmapData.dayDist[1]
                ? "Weekends are your busiest — consider premium pricing for Fri–Sun"
                : "Bookings are spread evenly — good for steady cash flow"}
            </p>
          </div>

          {/* Peak Dates */}
          {heatmapData.peakDates.length > 0 && (
            <div className="bg-white rounded-2xl p-5 border border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-3">Most Popular Dates</p>
              <div className="space-y-2">
                {heatmapData.peakDates.map((p, i) => (
                  <div key={p.date} className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-black ${
                      i === 0 ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-400"
                    }`}>{i + 1}</span>
                    <span className="text-xs font-bold text-[#062c24] flex-1">{formatDate(p.date)}</span>
                    <span className="text-[10px] font-black text-emerald-600">{p.count} booking{p.count > 1 ? "s" : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Insights */}
          <div className="bg-gradient-to-br from-[#062c24] to-emerald-800 rounded-2xl p-5 text-white">
            <p className="text-[9px] font-black text-emerald-400 uppercase mb-3"><i className="fas fa-brain mr-1"></i>Auto Insights</p>
            <div className="space-y-2 text-xs text-white/80">
              {repeatRate >= 30 && <p>✅ Strong repeat rate ({repeatRate}%) — your customers keep coming back.</p>}
              {repeatRate > 0 && repeatRate < 30 && <p>⚠️ Low repeat rate ({repeatRate}%). Consider loyalty promos or follow-up messages.</p>}
              {atRiskCount > 0 && <p>⚠️ {atRiskCount} customer{atRiskCount > 1 ? "s" : ""} haven't booked in 60+ days. Send a re-engagement message.</p>}
              {heatmapData.avgNights !== "—" && Number(heatmapData.avgNights) < 2 && <p>💡 Avg booking is short ({heatmapData.avgNights} nights). Consider multi-night discount to boost duration.</p>}
              {heatmapData.avgNights !== "—" && Number(heatmapData.avgNights) >= 3 && <p>✅ Customers book longer trips ({heatmapData.avgNights} nights avg). Great for revenue per booking.</p>}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          ITEM PERFORMANCE VIEW
          ═══════════════════════════════════════════════════════════ */}
      {view === "items" && (
        <div className="space-y-3">
          {itemPerformance.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
              <i className="fas fa-box text-slate-200 text-4xl mb-3"></i>
              <p className="text-sm font-bold text-slate-400">No rental data yet</p>
            </div>
          ) : (
            itemPerformance.map((item, i) => {
              const maxRev = itemPerformance[0]?.totalRevenue || 1;
              const revBar = (item.totalRevenue / maxRev) * 100;
              const lastDays = daysSince(item.lastRented);
              const isDead = lastDays > 60 && item.timesRented < 3;
              return (
                <div key={item.name} className={`bg-white rounded-2xl border p-4 ${isDead ? "border-red-200" : "border-slate-100"}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black ${
                        i === 0 ? "bg-amber-100 text-amber-600" : i === 1 ? "bg-slate-200 text-slate-600" : i === 2 ? "bg-orange-100 text-orange-600" : "bg-slate-100 text-slate-400"
                      }`}>{i + 1}</span>
                      <div>
                        <p className="text-sm font-black text-[#062c24]">{item.name}</p>
                        <p className="text-[8px] text-slate-400 font-bold">Last rented: {lastDays < 999 ? `${lastDays}d ago` : "Never"}</p>
                      </div>
                    </div>
                    {isDead && (
                      <span className="text-[8px] font-black bg-red-50 text-red-500 px-2 py-0.5 rounded-full uppercase">Dead Stock</span>
                    )}
                  </div>

                  {/* Revenue bar */}
                  <div className="mb-3">
                    <div className="bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${revBar}%` }}></div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center bg-slate-50 rounded-lg py-2">
                      <p className="text-xs font-black text-emerald-600">RM{item.totalRevenue.toLocaleString()}</p>
                      <p className="text-[7px] text-slate-400 font-bold uppercase">Revenue</p>
                    </div>
                    <div className="text-center bg-slate-50 rounded-lg py-2">
                      <p className="text-xs font-black text-[#062c24]">{item.timesRented}×</p>
                      <p className="text-[7px] text-slate-400 font-bold uppercase">Rented</p>
                    </div>
                    <div className="text-center bg-slate-50 rounded-lg py-2">
                      <p className="text-xs font-black text-[#062c24]">{item.utilizationDays}d</p>
                      <p className="text-[7px] text-slate-400 font-bold uppercase">Total Days</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}