"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, limit, where, addDoc, serverTimestamp } from "firebase/firestore";

type Transaction = {
  id: string;
  vendorId: string;
  vendorName: string;
  amount: number;
  credits: number;
  type: "purchase" | "bonus" | "refund" | "adjustment";
  note?: string;
  createdAt: any;
};

type Vendor = {
  id: string;
  name: string;
  credits?: number;
  status: string;
};

export default function FinanceTab() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "purchase" | "bonus" | "refund">("all");
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTx, setNewTx] = useState<{ vendorId: string; amount: number; credits: number; type: "purchase" | "bonus" | "refund"; note: string }>({ vendorId: "", amount: 0, credits: 0, type: "purchase", note: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [txSnap, vendorSnap] = await Promise.all([
        getDocs(query(collection(db, "transactions"), orderBy("createdAt", "desc"), limit(500))),
        getDocs(query(collection(db, "vendors"), where("status", "==", "approved")))
      ]);
      setTransactions(txSnap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
      setVendors(vendorSnap.docs.map(d => ({ id: d.id, ...d.data() } as Vendor)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function addTransaction() {
    if (!newTx.vendorId || newTx.amount <= 0) return alert("Please fill all fields");
    setSaving(true);
    try {
      const vendor = vendors.find(v => v.id === newTx.vendorId);
      await addDoc(collection(db, "transactions"), {
        ...newTx,
        vendorName: vendor?.name || "Unknown",
        createdAt: serverTimestamp(),
      });
      setShowAddModal(false);
      setNewTx({ vendorId: "", amount: 0, credits: 0, type: "purchase", note: "" });
      loadData();
    } catch (e) {
      console.error(e);
      alert("Failed to add transaction");
    } finally {
      setSaving(false);
    }
  }

  // Filter transactions
  const now = new Date();
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  
  const rangeStart = timeRange === "7d" ? daysAgo(7) : timeRange === "30d" ? daysAgo(30) : timeRange === "90d" ? daysAgo(90) : null;
  
  const filteredTx = transactions.filter(t => {
    const typeMatch = filter === "all" || t.type === filter;
    const dateMatch = !rangeStart || (t.createdAt?.toDate() >= rangeStart);
    return typeMatch && dateMatch;
  });

  // Stats
  const totalRevenue = filteredTx.filter(t => t.type === "purchase").reduce((sum, t) => sum + t.amount, 0);
  const totalCredits = filteredTx.filter(t => t.type === "purchase").reduce((sum, t) => sum + t.credits, 0);
  const totalRefunds = filteredTx.filter(t => t.type === "refund").reduce((sum, t) => sum + t.amount, 0);
  const avgTransaction = filteredTx.length > 0 ? Math.round(totalRevenue / filteredTx.filter(t => t.type === "purchase").length) : 0;

  // Vendors needing attention (low credits)
  const lowCreditVendors = vendors.filter(v => (v.credits || 0) <= 5).sort((a, b) => (a.credits || 0) - (b.credits || 0));

  // Monthly breakdown
  const monthlyData: Record<string, number> = {};
  transactions.forEach(t => {
    if (t.type === "purchase" && t.createdAt) {
      const month = t.createdAt.toDate().toLocaleDateString("en", { month: "short", year: "2-digit" });
      monthlyData[month] = (monthlyData[month] || 0) + t.amount;
    }
  });
  const monthlyEntries = Object.entries(monthlyData).slice(0, 6).reverse();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-sm font-black text-[#062c24] uppercase">Financial Overview</h3>
        <div className="flex gap-2">
          <div className="flex bg-white rounded-lg border border-slate-200 p-1">
            {(["7d", "30d", "90d", "all"] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all ${
                  timeRange === range ? "bg-[#062c24] text-white" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {range === "all" ? "All" : range}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-colors"
          >
            <i className="fas fa-plus mr-2"></i>Add
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Revenue", value: `RM ${totalRevenue.toLocaleString()}`, icon: "fa-coins", color: "emerald" },
          { label: "Credits Sold", value: totalCredits.toLocaleString(), icon: "fa-ticket", color: "blue" },
          { label: "Refunds", value: `RM ${totalRefunds.toLocaleString()}`, icon: "fa-rotate-left", color: "red" },
          { label: "Avg Transaction", value: `RM ${avgTransaction}`, icon: "fa-chart-line", color: "purple" },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
              stat.color === "emerald" ? "bg-emerald-50 text-emerald-600" :
              stat.color === "blue" ? "bg-blue-50 text-blue-600" :
              stat.color === "red" ? "bg-red-50 text-red-600" :
              "bg-purple-50 text-purple-600"
            }`}>
              <i className={`fas ${stat.icon}`}></i>
            </div>
            <p className="text-2xl font-black text-[#062c24] mb-1">{stat.value}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Monthly Revenue */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <h4 className="text-xs font-black text-[#062c24] uppercase mb-4">Monthly Revenue</h4>
          {monthlyEntries.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-8">No data yet</p>
          ) : (
            <div className="space-y-3">
              {monthlyEntries.map(([month, amount]) => {
                const maxAmount = Math.max(...Object.values(monthlyData));
                const percentage = Math.round((amount / maxAmount) * 100);
                return (
                  <div key={month}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-slate-600">{month}</span>
                      <span className="text-xs font-black text-emerald-600">RM {amount.toLocaleString()}</span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Low Credit Vendors */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <h4 className="text-xs font-black text-[#062c24] uppercase mb-4">
            <i className="fas fa-exclamation-triangle text-amber-500 mr-2"></i>
            Low Credit Vendors
          </h4>
          {lowCreditVendors.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-8">All vendors have sufficient credits ✓</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {lowCreditVendors.map(v => (
                <div key={v.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <div>
                    <p className="text-xs font-bold text-[#062c24]">{v.name}</p>
                    <p className="text-[9px] text-amber-600 font-bold">{v.credits || 0} credits left</p>
                  </div>
                  <button className="text-[9px] font-bold text-emerald-600 bg-white px-3 py-1.5 rounded-lg hover:bg-emerald-50 border border-emerald-200">
                    Add Credits
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h4 className="text-xs font-black text-[#062c24] uppercase">Transaction History</h4>
          <div className="flex gap-2">
            {(["all", "purchase", "bonus", "refund"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-[9px] font-bold uppercase rounded-lg transition-all ${
                  filter === f ? "bg-[#062c24] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <i className="fas fa-spinner fa-spin text-2xl text-slate-300"></i>
          </div>
        ) : filteredTx.length === 0 ? (
          <div className="text-center py-12">
            <i className="fas fa-receipt text-4xl text-slate-200 mb-3 block"></i>
            <p className="text-xs text-slate-400 font-bold">No transactions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left text-[9px] font-black text-slate-400 uppercase px-5 py-3">Date</th>
                  <th className="text-left text-[9px] font-black text-slate-400 uppercase px-5 py-3">Vendor</th>
                  <th className="text-left text-[9px] font-black text-slate-400 uppercase px-5 py-3">Type</th>
                  <th className="text-right text-[9px] font-black text-slate-400 uppercase px-5 py-3">Amount</th>
                  <th className="text-right text-[9px] font-black text-slate-400 uppercase px-5 py-3">Credits</th>
                  <th className="text-left text-[9px] font-black text-slate-400 uppercase px-5 py-3">Note</th>
                </tr>
              </thead>
              <tbody>
                {filteredTx.slice(0, 50).map(t => (
                  <tr key={t.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {t.createdAt?.toDate().toLocaleDateString("en", { day: "numeric", month: "short", year: "2-digit" })}
                    </td>
                    <td className="px-5 py-3 text-xs font-bold text-[#062c24]">{t.vendorName}</td>
                    <td className="px-5 py-3">
                      <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded-full ${
                        t.type === "purchase" ? "bg-emerald-100 text-emerald-600" :
                        t.type === "bonus" ? "bg-blue-100 text-blue-600" :
                        t.type === "refund" ? "bg-red-100 text-red-600" :
                        "bg-slate-100 text-slate-600"
                      }`}>
                        {t.type}
                      </span>
                    </td>
                    <td className={`px-5 py-3 text-xs font-black text-right ${
                      t.type === "refund" ? "text-red-500" : "text-emerald-600"
                    }`}>
                      {t.type === "refund" ? "-" : "+"}RM {t.amount}
                    </td>
                    <td className="px-5 py-3 text-xs font-bold text-slate-500 text-right">{t.credits}</td>
                    <td className="px-5 py-3 text-xs text-slate-400 truncate max-w-[150px]">{t.note || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-[#062c24] uppercase">Add Transaction</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-red-500">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Vendor</label>
                <select
                  value={newTx.vendorId}
                  onChange={e => setNewTx({ ...newTx, vendorId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none"
                >
                  <option value="">Select vendor...</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Amount (RM)</label>
                  <input
                    type="number"
                    value={newTx.amount || ""}
                    onChange={e => setNewTx({ ...newTx, amount: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Credits</label>
                  <input
                    type="number"
                    value={newTx.credits || ""}
                    onChange={e => setNewTx({ ...newTx, credits: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none"
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["purchase", "bonus", "refund"] as ("purchase" | "bonus" | "refund")[]).map(type => (
                    <button
                      key={type}
                      onClick={() => setNewTx({ ...newTx, type })}
                      className={`py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${
                        newTx.type === type
                          ? type === "purchase" ? "bg-emerald-500 text-white" :
                            type === "bonus" ? "bg-blue-500 text-white" :
                            "bg-red-500 text-white"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Note (optional)</label>
                <input
                  type="text"
                  value={newTx.note}
                  onChange={e => setNewTx({ ...newTx, note: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none"
                  placeholder="Add a note..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={addTransaction}
                disabled={saving}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50"
              >
                {saving ? <i className="fas fa-spinner fa-spin"></i> : "Add Transaction"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}