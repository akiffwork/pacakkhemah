"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, getDocsFromServer, query, orderBy, limit } from "firebase/firestore";

type View = "dashboard" | "vendors" | "orders" | "finance" | "content" | "settings";

type Vendor = {
  id: string;
  name: string;
  status: string;
  credits?: number;
  createdAt?: any;
  city?: string;
  is_vacation?: boolean;
  phone?: string;
};

type Transaction = {
  id: string;
  vendorId: string;
  vendorName?: string;
  amount: number;
  credits: number;
  type: string;
  createdAt: any;
};

type StatCard = {
  label: string;
  value: string | number;
  change?: string;
  changeType?: "up" | "down" | "neutral";
  icon: string;
  color: string;
};

type Props = {
  allVendors: Vendor[];
  onNavigate?: (tab: View) => void;
};

export default function DashboardTab({ allVendors, onNavigate }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [platformOrders, setPlatformOrders] = useState<{ vendorId: string; vendorName?: string; totalAmount: number; status: string; items: any[]; createdAt: any }[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");

  useEffect(() => {
    loadTransactions();
    loadPlatformOrders();
  }, []);

  async function loadTransactions() {
    try {
      const snap = await getDocsFromServer(query(collection(db, "transactions"), orderBy("createdAt", "desc"), limit(100)));
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadPlatformOrders() {
    try {
      const snap = await getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(500)));
      setPlatformOrders(snap.docs.map(d => d.data() as any).filter(o => !o.deleted));
    } catch (e) { console.error("Platform orders error:", e); }
  }

  const now = new Date();
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  
  const activeVendors = allVendors.filter(v => v.status === "approved" && (v.credits || 0) > 0 && !v.is_vacation);
  const pendingVendors = allVendors.filter(v => v.status === "pending");
  const lowCreditVendors = allVendors.filter(v => v.status === "approved" && (v.credits || 0) <= 5 && (v.credits || 0) > 0);
  const unconfirmedOrders = platformOrders.filter(o => o.status === "pending");
  
  const rangeDays = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
  const rangeStart = daysAgo(rangeDays);
  
  const recentTransactions = transactions.filter(t => t.createdAt?.toDate() >= rangeStart);
  const totalRevenue = recentTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalCredits = recentTransactions.reduce((sum, t) => sum + (t.credits || 0), 0);
  
  const newVendors = allVendors.filter(v => v.createdAt?.toDate() >= rangeStart);

  const prevStart = daysAgo(rangeDays * 2);
  const prevEnd = rangeStart;
  const prevTransactions = transactions.filter(t => {
    const date = t.createdAt?.toDate();
    return date >= prevStart && date < prevEnd;
  });
  const prevRevenue = prevTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const revenueChange = prevRevenue > 0 ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100) : 0;

  const chartDays = 7;
  const chartData = Array.from({ length: chartDays }, (_, i) => {
    const date = daysAgo(chartDays - 1 - i);
    const dayStart = new Date(date.setHours(0, 0, 0, 0));
    const dayEnd = new Date(date.setHours(23, 59, 59, 999));
    const dayTransactions = transactions.filter(t => {
      const tDate = t.createdAt?.toDate();
      return tDate >= dayStart && tDate <= dayEnd;
    });
    return {
      day: dayStart.toLocaleDateString("en", { weekday: "short" }),
      revenue: dayTransactions.reduce((sum, t) => sum + (t.amount || 0), 0),
    };
  });
  const maxRevenue = Math.max(...chartData.map(d => d.revenue), 1);

  const topVendors = [...allVendors]
    .filter(v => v.status === "approved")
    .sort((a, b) => (b.credits || 0) - (a.credits || 0))
    .slice(0, 5);

  const locationCounts: Record<string, number> = {};
  allVendors.filter(v => v.status === "approved").forEach(v => {
    const city = v.city || "Unknown";
    locationCounts[city] = (locationCounts[city] || 0) + 1;
  });
  const topLocations = Object.entries(locationCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const stats: StatCard[] = [
    {
      label: "Total Revenue",
      value: `RM ${totalRevenue.toLocaleString()}`,
      change: revenueChange !== 0 ? `${revenueChange > 0 ? "+" : ""}${revenueChange}%` : undefined,
      changeType: revenueChange > 0 ? "up" : revenueChange < 0 ? "down" : "neutral",
      icon: "fa-coins",
      color: "emerald",
    },
    {
      label: "Active Vendors",
      value: activeVendors.length,
      icon: "fa-store",
      color: "blue",
    },
    {
      label: "Pending Approval",
      value: pendingVendors.length,
      icon: "fa-clock",
      color: "amber",
    },
    {
      label: "New Vendors",
      value: newVendors.length,
      change: `Last ${rangeDays}d`,
      changeType: "neutral",
      icon: "fa-user-plus",
      color: "purple",
    },
  ];

  const colorClasses: Record<string, { bg: string; text: string; light: string }> = {
    emerald: { bg: "bg-emerald-500", text: "text-emerald-600", light: "bg-emerald-50" },
    blue: { bg: "bg-blue-500", text: "text-blue-600", light: "bg-blue-50" },
    amber: { bg: "bg-amber-500", text: "text-amber-600", light: "bg-amber-50" },
    purple: { bg: "bg-purple-500", text: "text-purple-600", light: "bg-purple-50" },
    red: { bg: "bg-red-500", text: "text-red-600", light: "bg-red-50" },
  };

  return (
    <div className="space-y-6">
      {/* Header & Time Range */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-sm font-black text-[#062c24] uppercase">HQ Overview</h3>
          <p className="text-[10px] font-bold text-slate-400">At-a-glance metrics and action items</p>
        </div>
        <div className="flex bg-white rounded-lg border border-slate-200 p-1">
          {(["7d", "30d", "90d"] as const).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all ${
                timeRange === range ? "bg-[#062c24] text-white" : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Command Center: Quick Actions & Alerts merged */}
      <div className="bg-[#062c24] rounded-2xl p-6 shadow-sm">
        <h4 className="text-xs font-black uppercase text-white mb-4">Command Center</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          
          <button onClick={() => onNavigate?.("vendors")} className="bg-white/10 hover:bg-white/20 border border-white/5 p-4 rounded-xl text-left transition-all group relative overflow-hidden">
            <div className="flex items-start justify-between mb-2 text-white">
              <i className="fas fa-user-check text-xl"></i>
              {pendingVendors.length > 0 && <span className="bg-amber-500 text-[#062c24] text-[10px] font-black px-2 py-0.5 rounded-full">{pendingVendors.length} New</span>}
            </div>
            <p className="text-[10px] font-bold text-emerald-100/70 uppercase">Vendors</p>
            <p className="text-sm font-black text-white">Approvals</p>
          </button>

          <button onClick={() => onNavigate?.("orders")} className="bg-white/10 hover:bg-white/20 border border-white/5 p-4 rounded-xl text-left transition-all group relative overflow-hidden">
            <div className="flex items-start justify-between mb-2 text-white">
              <i className="fas fa-receipt text-xl"></i>
              {unconfirmedOrders.length > 0 && <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{unconfirmedOrders.length} Pending</span>}
            </div>
            <p className="text-[10px] font-bold text-emerald-100/70 uppercase">Platform</p>
            <p className="text-sm font-black text-white">Orders</p>
          </button>

          <button onClick={() => {
              if (lowCreditVendors.length === 0) return alert("✅ All vendors have sufficient credits!");
              const vendor = lowCreditVendors[0];
              if (vendor.phone) {
                const msg = encodeURIComponent(`Hi ${vendor.name}! 👋\n\nThis is a friendly reminder from Pacak Khemah. Your credit balance is running low (${vendor.credits || 0} credits remaining).\n\nTop up now to keep your shop visible in the directory!\n\n- Pacak Khemah Team`);
                window.open(`https://wa.me/${vendor.phone.replace(/\D/g, "")}?text=${msg}`, "_blank");
              } else {
                alert(`📋 Low Credit Vendors:\n\n${lowCreditVendors.map(v => `• ${v.name}: ${v.credits || 0} credits`).join("\n")}`);
              }
            }} className="bg-white/10 hover:bg-white/20 border border-white/5 p-4 rounded-xl text-left transition-all group relative overflow-hidden">
            <div className="flex items-start justify-between mb-2 text-white">
              <i className="fas fa-bell text-xl"></i>
              {lowCreditVendors.length > 0 && <span className="bg-amber-500 text-[#062c24] text-[10px] font-black px-2 py-0.5 rounded-full">{lowCreditVendors.length} Low</span>}
            </div>
            <p className="text-[10px] font-bold text-emerald-100/70 uppercase">Vendors</p>
            <p className="text-sm font-black text-white">Reminders</p>
          </button>

          <button onClick={() => {
              const data = { exportedAt: new Date().toISOString(), summary: { totalVendors: allVendors.length, activeVendors: activeVendors.length, pendingVendors: pendingVendors.length, totalRevenue, totalCredits }, vendors: allVendors.map(v => ({ name: v.name, city: v.city, credits: v.credits, status: v.status })), recentTransactions: transactions.slice(0, 50).map(t => ({ vendor: t.vendorName, amount: t.amount, credits: t.credits, type: t.type, date: t.createdAt?.toDate?.()?.toISOString() || null })) };
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `pacakkhemah-report-${new Date().toISOString().split("T")[0]}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }} className="bg-emerald-500 hover:bg-emerald-400 p-4 rounded-xl text-left transition-all group relative overflow-hidden">
            <div className="flex items-start justify-between mb-2 text-[#062c24]">
              <i className="fas fa-file-export text-xl"></i>
            </div>
            <p className="text-[10px] font-bold text-[#062c24]/70 uppercase">System</p>
            <p className="text-sm font-black text-[#062c24]">Export Data</p>
          </button>

        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const colors = colorClasses[stat.color];
          return (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 ${colors.light} ${colors.text} rounded-xl flex items-center justify-center`}>
                  <i className={`fas ${stat.icon}`}></i>
                </div>
                {stat.change && (
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                    stat.changeType === "up" ? "bg-emerald-100 text-emerald-600" :
                    stat.changeType === "down" ? "bg-red-100 text-red-600" :
                    "bg-slate-100 text-slate-500"
                  }`}>
                    {stat.changeType === "up" && <i className="fas fa-arrow-up mr-1"></i>}
                    {stat.changeType === "down" && <i className="fas fa-arrow-down mr-1"></i>}
                    {stat.change}
                  </span>
                )}
              </div>
              <p className="text-2xl font-black text-[#062c24] mb-1">{stat.value}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Platform Bookings Metrics */}
      {(() => {
        const completedOrders = platformOrders.filter(o => o.status === "completed");
        const confirmedOrders = platformOrders.filter(o => o.status === "confirmed");
        const gmv = completedOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
        const pendingGmv = confirmedOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);

        const vendorRevenue: Record<string, { name: string; revenue: number; orders: number }> = {};
        completedOrders.forEach(o => {
          const vid = o.vendorId;
          if (!vendorRevenue[vid]) {
            const vendor = allVendors.find(v => v.id === vid);
            vendorRevenue[vid] = { name: vendor?.name || o.vendorName || "Unknown", revenue: 0, orders: 0 };
          }
          vendorRevenue[vid].revenue += o.totalAmount || 0;
          vendorRevenue[vid].orders += 1;
        });
        const rankedVendors = Object.values(vendorRevenue).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

        return (
          <div className="space-y-4">
            <h4 className="text-xs font-black text-[#062c24] uppercase">Platform Bookings</h4>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-3">
                  <i className="fas fa-shopping-bag"></i>
                </div>
                <p className="text-2xl font-black text-[#062c24]">RM {gmv.toLocaleString()}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase">GMV (Completed)</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-3">
                  <i className="fas fa-hourglass-half"></i>
                </div>
                <p className="text-2xl font-black text-amber-600">RM {pendingGmv.toLocaleString()}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Pending Revenue</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-3">
                  <i className="fas fa-receipt"></i>
                </div>
                <p className="text-2xl font-black text-[#062c24]">{platformOrders.length}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Total Orders</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-3">
                  <i className="fas fa-trophy"></i>
                </div>
                <p className="text-2xl font-black text-[#062c24]">{Object.keys(vendorRevenue).length}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Active Sellers</p>
              </div>
            </div>

            {/* Top performing vendors row */}
            {rankedVendors.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                <h4 className="text-xs font-black text-[#062c24] uppercase mb-4">Vendor Performance (by Revenue)</h4>
                <div className="space-y-3">
                  {rankedVendors.map((v, i) => (
                    <div key={v.name} className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black ${
                        i === 0 ? "bg-amber-100 text-amber-600" : i === 1 ? "bg-slate-200 text-slate-600" : i === 2 ? "bg-orange-100 text-orange-600" : "bg-slate-100 text-slate-400"
                      }`}>{i + 1}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-[#062c24] truncate">{v.name}</p>
                        <p className="text-[9px] text-slate-400">{v.orders} completed order{v.orders > 1 ? "s" : ""}</p>
                      </div>
                      <span className="text-xs font-black text-emerald-600">RM {v.revenue.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <h4 className="text-xs font-black text-[#062c24] uppercase mb-4">Revenue (Last 7 Days)</h4>
          {transactions.length === 0 || totalRevenue === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-300">
              <i className="fas fa-chart-bar text-4xl mb-3"></i>
              <p className="text-xs font-bold">No transactions yet</p>
            </div>
          ) : (
            <div className="flex items-end gap-3" style={{ height: "120px" }}>
              {chartData.map((d, i) => {
                const heightPercent = maxRevenue > 0 ? (d.revenue / maxRevenue) * 100 : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center h-full">
                    <div className="w-full flex-1 flex items-end">
                      <div
                        className={`w-full rounded-t-md transition-all duration-500 ${heightPercent > 0 ? "bg-gradient-to-t from-emerald-500 to-emerald-400" : "bg-slate-100"}`}
                        style={{ height: heightPercent > 0 ? `${Math.max(heightPercent, 8)}%` : "4px" }}
                      />
                    </div>
                    <span className="text-[9px] font-bold text-slate-400 mt-2 shrink-0">{d.day}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <h4 className="text-xs font-black text-[#062c24] uppercase mb-4">Top Vendors (by Credits)</h4>
          {topVendors.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-8">No vendors yet</p>
          ) : (
            <div className="space-y-3">
              {topVendors.map((v, i) => (
                <div key={v.id} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                    i === 0 ? "bg-amber-100 text-amber-600" : i === 1 ? "bg-slate-200 text-slate-600" : i === 2 ? "bg-orange-100 text-orange-600" : "bg-slate-100 text-slate-400"
                  }`}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[#062c24] truncate">{v.name}</p>
                    <p className="text-[9px] text-slate-400">{v.city || "Unknown"}</p>
                  </div>
                  <span className="text-xs font-black text-emerald-600">{v.credits || 0}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <h4 className="text-xs font-black text-[#062c24] uppercase mb-4">Vendors by Location</h4>
          {topLocations.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-8">No data yet</p>
          ) : (
            <div className="space-y-3">
              {topLocations.map(([loc, count]) => {
                const percentage = Math.round((count / activeVendors.length) * 100);
                return (
                  <div key={loc}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-slate-600">{loc}</span>
                      <span className="text-[10px] font-bold text-slate-400">{count} ({percentage}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full" style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <h4 className="text-xs font-black text-[#062c24] uppercase mb-4">Recent Transactions</h4>
          {loading ? (
            <div className="flex justify-center py-8">
              <i className="fas fa-spinner fa-spin text-slate-300"></i>
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-8">No transactions yet</p>
          ) : (
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {transactions.slice(0, 10).map(t => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-xs font-bold text-[#062c24]">{t.vendorName || "Unknown"}</p>
                    <p className="text-[9px] text-slate-400">
                      {t.createdAt?.toDate().toLocaleDateString("en", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-emerald-600">+RM {t.amount}</p>
                    <p className="text-[9px] text-slate-400">{t.credits} credits</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}