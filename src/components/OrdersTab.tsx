"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection, query, where, onSnapshot, doc, updateDoc,
  orderBy, serverTimestamp,
} from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";

type Order = {
  id: string;
  customerPhone: string;
  customerName?: string;
  items: { name: string; qty: number; price: number }[];
  totalAmount: number;
  pickupLocation: string;
  bookingDates: { start: string; end: string };
  status: "pending" | "confirmed" | "completed" | "cancelled";
  reviewToken?: string;
  reviewTokenUsed?: boolean;
  reviewTokenSentAt?: any;
  createdAt: any;
  completedAt?: any;
};

type OrdersTabProps = {
  vendorId: string;
  vendorName: string;
};

const statusColors = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

const statusIcons = {
  pending: "fa-clock",
  confirmed: "fa-check",
  completed: "fa-flag-checkered",
  cancelled: "fa-times",
};

export default function OrdersTab({ vendorId, vendorName }: OrdersTabProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Order["status"]>("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [sendingReviewLink, setSendingReviewLink] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Real-time orders listener
  useEffect(() => {
    const q = query(
      collection(db, "orders"),
      where("vendorId", "==", vendorId),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
      setLoading(false);
    });

    return () => unsub();
  }, [vendorId]);

  // Filter orders
  const filteredOrders = filter === "all" 
    ? orders 
    : orders.filter(o => o.status === filter);

  // Update order status
  async function updateStatus(orderId: string, newStatus: Order["status"]) {
    const updates: any = { status: newStatus };
    
    if (newStatus === "completed") {
      // Generate review token
      const token = uuidv4();
      updates.completedAt = serverTimestamp();
      updates.reviewToken = token;
      updates.reviewTokenUsed = false;
    }

    await updateDoc(doc(db, "orders", orderId), updates);
    setShowModal(false);
  }

  // Generate review link
  function getReviewLink(order: Order): string {
    if (!order.reviewToken) return "";
    // Replace with your actual domain
    return `${window.location.origin}/review/${order.reviewToken}`;
  }

  // Copy review link
  function copyReviewLink(order: Order) {
    const link = getReviewLink(order);
    navigator.clipboard.writeText(link);
    setCopiedLink(order.id);
    setTimeout(() => setCopiedLink(null), 2000);
  }

  // Send review link via WhatsApp
  async function sendReviewLinkWhatsApp(order: Order) {
    setSendingReviewLink(true);
    
    const link = getReviewLink(order);
    const message = encodeURIComponent(
      `🏕️ Thanks for camping with ${vendorName}!\n\n` +
      `We hope you had an amazing experience.\n\n` +
      `🔥 Rate your rental:\n${link}\n\n` +
      `Your feedback helps other campers find great gear!`
    );

    // Mark as sent
    await updateDoc(doc(db, "orders", order.id), {
      reviewTokenSentAt: serverTimestamp(),
    });

    // Open WhatsApp
    window.open(`https://wa.me/${order.customerPhone}?text=${message}`, "_blank");
    setSendingReviewLink(false);
  }

  // Format date
  function formatDate(timestamp: any): string {
    if (!timestamp?.toDate) return "-";
    return timestamp.toDate().toLocaleDateString("en-MY", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  // Stats
  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === "pending").length,
    confirmed: orders.filter(o => o.status === "confirmed").length,
    completed: orders.filter(o => o.status === "completed").length,
    awaitingReview: orders.filter(o => o.status === "completed" && !o.reviewTokenUsed).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-[#062c24] uppercase">Orders</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Manage bookings & send review requests
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl p-4 border border-slate-100">
          <p className="text-[9px] font-black text-slate-400 uppercase">Total</p>
          <p className="text-2xl font-black text-[#062c24]">{stats.total}</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
          <p className="text-[9px] font-black text-amber-600 uppercase">Pending</p>
          <p className="text-2xl font-black text-amber-700">{stats.pending}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <p className="text-[9px] font-black text-blue-600 uppercase">Confirmed</p>
          <p className="text-2xl font-black text-blue-700">{stats.confirmed}</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
          <p className="text-[9px] font-black text-emerald-600 uppercase">Completed</p>
          <p className="text-2xl font-black text-emerald-700">{stats.completed}</p>
        </div>
        <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
          <p className="text-[9px] font-black text-orange-600 uppercase">Awaiting Review</p>
          <p className="text-2xl font-black text-orange-700">{stats.awaitingReview}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
        {(["all", "pending", "confirmed", "completed", "cancelled"] as const).map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase whitespace-nowrap transition-all ${
              filter === status
                ? "bg-[#062c24] text-white"
                : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300"
            }`}
          >
            {status === "all" ? "All Orders" : status}
            {status !== "all" && (
              <span className="ml-2 opacity-60">
                ({orders.filter(o => o.status === status).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl p-4 border border-slate-100 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-1/3 mb-3"></div>
              <div className="h-3 bg-slate-100 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-inbox text-slate-300 text-2xl"></i>
          </div>
          <p className="text-sm font-bold text-slate-400">No orders yet</p>
          <p className="text-xs text-slate-300 mt-1">Orders will appear here when customers book</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(order => (
            <div
              key={order.id}
              className="bg-white rounded-xl p-4 border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Left: Order Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${statusColors[order.status]}`}>
                      <i className={`fas ${statusIcons[order.status]} mr-1`}></i>
                      {order.status}
                    </span>
                    {order.status === "completed" && !order.reviewTokenUsed && (
                      <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase bg-orange-100 text-orange-600">
                        <i className="fas fa-star mr-1"></i> Review Pending
                      </span>
                    )}
                    {order.status === "completed" && order.reviewTokenUsed && (
                      <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase bg-emerald-100 text-emerald-600">
                        <i className="fas fa-check mr-1"></i> Reviewed
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-black text-[#062c24]">
                      {order.customerName || order.customerPhone}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-500">
                      {order.bookingDates.start} → {order.bookingDates.end}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 mt-1">
                    {order.items.map(i => `${i.name} x${i.qty}`).join(", ")}
                  </div>
                </div>

                {/* Right: Amount & Actions */}
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-lg font-black text-emerald-600">RM {order.totalAmount}</p>
                    <p className="text-[9px] text-slate-400">{formatDate(order.createdAt)}</p>
                  </div>

                  <button
                    onClick={() => { setSelectedOrder(order); setShowModal(true); }}
                    className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                  >
                    <i className="fas fa-ellipsis-v"></i>
                  </button>
                </div>
              </div>

              {/* Review Link Section (for completed orders) */}
              {order.status === "completed" && !order.reviewTokenUsed && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black text-orange-600 uppercase mb-1">
                      <i className="fas fa-fire mr-1"></i> Send Review Request
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {getReviewLink(order)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyReviewLink(order)}
                      className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${
                        copiedLink === order.id
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      <i className={`fas ${copiedLink === order.id ? "fa-check" : "fa-copy"} mr-1`}></i>
                      {copiedLink === order.id ? "Copied!" : "Copy"}
                    </button>
                    <button
                      onClick={() => sendReviewLinkWhatsApp(order)}
                      disabled={sendingReviewLink}
                      className="px-3 py-2 rounded-lg text-[9px] font-black uppercase bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                    >
                      <i className="fab fa-whatsapp mr-1"></i>
                      {order.reviewTokenSentAt ? "Resend" : "Send"} via WhatsApp
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Order Detail Modal */}
      {showModal && selectedOrder && (
        <div className="fixed inset-0 bg-[#062c24]/90 backdrop-blur-sm z-[500] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-[#062c24] uppercase">Order Details</h3>
              <button
                onClick={() => setShowModal(false)}
                className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Status Badge */}
            <div className="mb-4">
              <span className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase ${statusColors[selectedOrder.status]}`}>
                <i className={`fas ${statusIcons[selectedOrder.status]} mr-1`}></i>
                {selectedOrder.status}
              </span>
            </div>

            {/* Customer Info */}
            <div className="bg-slate-50 rounded-xl p-4 mb-4">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Customer</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                  <i className="fas fa-user"></i>
                </div>
                <div>
                  <p className="font-bold text-[#062c24]">{selectedOrder.customerName || "Customer"}</p>
                  <p className="text-xs text-slate-500">{selectedOrder.customerPhone}</p>
                </div>
              </div>
            </div>

            {/* Booking Details */}
            <div className="bg-slate-50 rounded-xl p-4 mb-4">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Booking</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Dates</span>
                  <span className="font-bold">{selectedOrder.bookingDates.start} → {selectedOrder.bookingDates.end}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Pickup</span>
                  <span className="font-bold">{selectedOrder.pickupLocation}</span>
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="bg-slate-50 rounded-xl p-4 mb-4">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Items</p>
              <div className="space-y-2">
                {selectedOrder.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-slate-600">{item.name} x{item.qty}</span>
                    <span className="font-bold">RM {item.price * item.qty}</span>
                  </div>
                ))}
                <div className="border-t border-slate-200 pt-2 flex justify-between">
                  <span className="font-black text-[#062c24]">Total</span>
                  <span className="font-black text-emerald-600 text-lg">RM {selectedOrder.totalAmount}</span>
                </div>
              </div>
            </div>

            {/* Status Actions */}
            <div className="space-y-2">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Update Status</p>
              
              {selectedOrder.status === "pending" && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => updateStatus(selectedOrder.id, "confirmed")}
                    className="py-3 rounded-xl font-black uppercase text-xs bg-blue-500 text-white hover:bg-blue-600"
                  >
                    <i className="fas fa-check mr-2"></i>Confirm
                  </button>
                  <button
                    onClick={() => updateStatus(selectedOrder.id, "cancelled")}
                    className="py-3 rounded-xl font-black uppercase text-xs bg-red-100 text-red-600 hover:bg-red-200"
                  >
                    <i className="fas fa-times mr-2"></i>Cancel
                  </button>
                </div>
              )}

              {selectedOrder.status === "confirmed" && (
                <button
                  onClick={() => updateStatus(selectedOrder.id, "completed")}
                  className="w-full py-3 rounded-xl font-black uppercase text-xs bg-emerald-500 text-white hover:bg-emerald-600"
                >
                  <i className="fas fa-flag-checkered mr-2"></i>Mark as Completed
                </button>
              )}

              {selectedOrder.status === "completed" && !selectedOrder.reviewTokenUsed && (
                <button
                  onClick={() => sendReviewLinkWhatsApp(selectedOrder)}
                  className="w-full py-3 rounded-xl font-black uppercase text-xs bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600"
                >
                  <i className="fas fa-fire mr-2"></i>Send Review Request
                </button>
              )}

              {selectedOrder.status === "completed" && selectedOrder.reviewTokenUsed && (
                <div className="text-center py-4 bg-emerald-50 rounded-xl">
                  <i className="fas fa-check-circle text-emerald-500 text-2xl mb-2"></i>
                  <p className="text-sm font-bold text-emerald-700">Customer has reviewed!</p>
                </div>
              )}
            </div>

            {/* Contact Customer */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <a
                href={`https://wa.me/${selectedOrder.customerPhone}`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 rounded-xl font-black uppercase text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-200 flex items-center justify-center gap-2"
              >
                <i className="fab fa-whatsapp"></i>Contact Customer
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}