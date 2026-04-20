"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, query, orderBy, limit } from "firebase/firestore";

// Define the Order type based on your platform's data structure
type Order = {
  id: string;
  vendorId: string;
  vendorName?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  totalAmount: number;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  createdAt: any;
  startDate?: string;
  endDate?: string;
  items?: { name: string; price: number; quantity: number }[];
};

export default function OrdersTab() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Order["status"]>("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    setLoading(true);
    try {
      // Fetch the latest 500 orders
      const q = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(500));
      const snap = await getDocs(q);
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
    } catch (e) {
      console.error("Error loading orders:", e);
    } finally {
      setLoading(false);
    }
  }

  async function updateOrderStatus(orderId: string, newStatus: Order["status"]) {
    if (!confirm(`Are you sure you want to mark this order as ${newStatus}?`)) return;
    
    try {
      await updateDoc(doc(db, "orders", orderId), { status: newStatus });
      // Update local state to reflect the change immediately
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (e) {
      console.error("Error updating order status:", e);
      alert("Failed to update status.");
    }
  }

  // Filter logic
  const filteredOrders = orders.filter(o => {
    const matchesSearch = !search || 
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      o.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      o.vendorName?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || o.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const pendingCount = orders.filter(o => o.status === "pending").length;
  const activeCount = orders.filter(o => o.status === "confirmed").length;
  const completedRevenue = orders.filter(o => o.status === "completed").reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  // Status visual configurations
  const STATUS_CONFIG = {
    pending: { label: "Pending", bg: "bg-amber-100", text: "text-amber-700", icon: "fa-clock" },
    confirmed: { label: "Confirmed", bg: "bg-blue-100", text: "text-blue-700", icon: "fa-calendar-check" },
    completed: { label: "Completed", bg: "bg-emerald-100", text: "text-emerald-700", icon: "fa-check-circle" },
    cancelled: { label: "Cancelled", bg: "bg-red-100", text: "text-red-700", icon: "fa-times-circle" },
  };

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center text-xl">
            <i className="fas fa-hourglass-half"></i>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending Action</p>
            <p className="text-2xl font-black text-[#062c24]">{pendingCount}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center text-xl">
            <i className="fas fa-box-open"></i>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Rentals</p>
            <p className="text-2xl font-black text-[#062c24]">{activeCount}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center text-xl">
            <i className="fas fa-coins"></i>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Completed GMV</p>
            <p className="text-2xl font-black text-[#062c24]">RM {completedRevenue.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm gap-4">
        <div className="relative w-full sm:w-96">
          <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            placeholder="Search Order ID, Customer, or Vendor..."
            className="w-full bg-slate-50 border border-slate-100 pl-10 pr-4 py-3 rounded-xl text-xs font-bold outline-none focus:border-emerald-500 transition-all" 
          />
        </div>
        <div className="flex bg-slate-100 rounded-lg p-1 w-full sm:w-auto overflow-x-auto">
          {(["all", "pending", "confirmed", "completed", "cancelled"] as const).map(status => (
            <button 
              key={status} 
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-md text-[10px] font-black uppercase transition-all whitespace-nowrap ${
                statusFilter === status ? "bg-white text-[#062c24] shadow-sm" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-64 text-slate-300">
            <i className="fas fa-spinner fa-spin text-3xl"></i>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-300">
            <i className="fas fa-receipt text-5xl mb-4"></i>
            <p className="text-sm font-black uppercase tracking-widest text-slate-400">No Orders Found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[900px]">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="p-5 pl-8 text-[10px] font-black uppercase text-slate-400 tracking-wider">Order Info</th>
                  <th className="p-5 text-[10px] font-black uppercase text-slate-400 tracking-wider">Customer</th>
                  <th className="p-5 text-[10px] font-black uppercase text-slate-400 tracking-wider">Vendor</th>
                  <th className="p-5 text-[10px] font-black uppercase text-slate-400 tracking-wider">Amount</th>
                  <th className="p-5 text-[10px] font-black uppercase text-slate-400 tracking-wider">Status</th>
                  <th className="p-5 pr-8 text-right text-[10px] font-black uppercase text-slate-400 tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                {filteredOrders.map(order => {
                  const conf = STATUS_CONFIG[order.status || "pending"];
                  return (
                    <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-5 pl-8">
                        <p className="font-black text-[#062c24] uppercase text-[10px]">#{order.id.slice(-6)}</p>
                        <p className="text-[9px] text-slate-400 font-bold mt-1">
                          {order.createdAt?.toDate().toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </td>
                      <td className="p-5">
                        <p className="font-bold text-slate-700">{order.customerName || "Unknown Customer"}</p>
                        {order.customerPhone && <p className="text-[9px] text-slate-400">{order.customerPhone}</p>}
                      </td>
                      <td className="p-5">
                        <p className="font-bold text-slate-700">{order.vendorName || "Unknown Vendor"}</p>
                      </td>
                      <td className="p-5">
                        <p className="font-black text-emerald-600">RM {order.totalAmount?.toFixed(2) || "0.00"}</p>
                      </td>
                      <td className="p-5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${conf.bg} ${conf.text}`}>
                          <i className={`fas ${conf.icon}`}></i> {conf.label}
                        </span>
                      </td>
                      <td className="p-5 pr-8 text-right">
                        <button 
                          onClick={() => setSelectedOrder(order)}
                          className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-bold uppercase hover:bg-emerald-500 hover:text-white transition-all"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-slate-50 p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-black text-xl text-[#062c24] uppercase flex items-center gap-3">
                  Order #{selectedOrder.id.slice(-6)}
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${STATUS_CONFIG[selectedOrder.status || "pending"].bg} ${STATUS_CONFIG[selectedOrder.status || "pending"].text}`}>
                    {STATUS_CONFIG[selectedOrder.status || "pending"].label}
                  </span>
                </h3>
                <p className="text-[10px] font-bold text-slate-400 mt-1">
                  Placed on {selectedOrder.createdAt?.toDate().toLocaleString('en-MY')}
                </p>
              </div>
              <button 
                onClick={() => setSelectedOrder(null)} 
                className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-200 transition-all"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2"><i className="fas fa-user mr-1"></i> Customer</p>
                  <p className="font-bold text-sm text-slate-700">{selectedOrder.customerName || "N/A"}</p>
                  <p className="text-xs text-slate-500 mt-1">{selectedOrder.customerEmail || "N/A"}</p>
                  <p className="text-xs text-slate-500">{selectedOrder.customerPhone || "N/A"}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2"><i className="fas fa-store mr-1"></i> Vendor</p>
                  <p className="font-bold text-sm text-slate-700">{selectedOrder.vendorName || "N/A"}</p>
                  <p className="text-xs text-slate-500 mt-1">ID: {selectedOrder.vendorId}</p>
                </div>
              </div>

              {/* Rental Dates */}
              {(selectedOrder.startDate || selectedOrder.endDate) && (
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-4">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                    <i className="fas fa-calendar-alt"></i>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Rental Period</p>
                    <p className="font-bold text-emerald-900 text-sm">
                      {selectedOrder.startDate || "?"} <i className="fas fa-arrow-right mx-2 text-[10px]"></i> {selectedOrder.endDate || "?"}
                    </p>
                  </div>
                </div>
              )}

              {/* Order Items */}
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Order Items</p>
                <div className="border border-slate-100 rounded-2xl overflow-hidden">
                  {selectedOrder.items && selectedOrder.items.length > 0 ? (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="p-3 font-bold text-slate-500">Item</th>
                          <th className="p-3 font-bold text-slate-500 text-center">Qty</th>
                          <th className="p-3 font-bold text-slate-500 text-right">Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedOrder.items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="p-3 font-medium text-slate-700">{item.name}</td>
                            <td className="p-3 text-center text-slate-500">{item.quantity}</td>
                            <td className="p-3 text-right font-bold text-slate-700">RM {(item.price * item.quantity).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="p-4 text-xs text-slate-400 italic text-center">No item details available.</p>
                  )}
                  <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-between items-center">
                    <span className="font-black text-slate-500 uppercase text-[10px] tracking-widest">Total Amount</span>
                    <span className="font-black text-lg text-emerald-600">RM {selectedOrder.totalAmount?.toFixed(2) || "0.00"}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Admin Actions Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-2 justify-end shrink-0">
              <p className="w-full text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 text-right">Admin Actions</p>
              
              {selectedOrder.status !== "cancelled" && (
                <button 
                  onClick={() => updateOrderStatus(selectedOrder.id, "cancelled")}
                  className="px-4 py-2 bg-red-100 text-red-600 hover:bg-red-500 hover:text-white rounded-xl text-[10px] font-black uppercase transition-all"
                >
                  Force Cancel
                </button>
              )}
              
              {selectedOrder.status !== "confirmed" && selectedOrder.status !== "completed" && selectedOrder.status !== "cancelled" && (
                <button 
                  onClick={() => updateOrderStatus(selectedOrder.id, "confirmed")}
                  className="px-4 py-2 bg-blue-100 text-blue-600 hover:bg-blue-500 hover:text-white rounded-xl text-[10px] font-black uppercase transition-all"
                >
                  Mark Confirmed
                </button>
              )}

              {selectedOrder.status !== "completed" && selectedOrder.status !== "cancelled" && (
                <button 
                  onClick={() => updateOrderStatus(selectedOrder.id, "completed")}
                  className="px-4 py-2 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl text-[10px] font-black uppercase shadow-sm transition-all"
                >
                  Mark Completed
                </button>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}