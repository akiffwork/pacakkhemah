"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection, query, where, onSnapshot, doc, updateDoc,
  orderBy, serverTimestamp, getDocs, deleteDoc,
} from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";

type Order = {
  id: string;
  customerPhone: string;
  customerName?: string;
  items: { name: string; qty: number; price: number; variantId?: string; variantLabel?: string; variantColor?: string }[];
  totalAmount: number;
  rentalAmount?: number;
  depositAmount?: number;
  pickupLocation: string;
  bookingDates: { start: string; end: string };
  status: "pending" | "confirmed" | "completed" | "cancelled" | "conflict";
  paymentStatus?: "unpaid" | "deposit_paid" | "full_paid" | "refunded";
  agreementSigned?: boolean;
  agreementSignedAt?: any;
  agreementId?: string;
  calendarLinked?: boolean;
  stockConflict?: boolean;
  stockConflictDetails?: string[];
  reviewToken?: string;
  reviewTokenUsed?: boolean;
  reviewTokenSentAt?: any;
  createdAt: any;
  completedAt?: any;
  deleted?: boolean;
};

type OrdersTabProps = {
  vendorId: string;
  vendorName: string;
};

type UnlinkedAgreement = {
  id: string;
  customerName: string;
  customerPhone?: string;
  timestamp?: any;
  orderId?: string | null;
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
  conflict: "bg-red-100 text-red-700",
};

const statusIcons: Record<string, string> = {
  pending: "fa-clock",
  confirmed: "fa-check",
  completed: "fa-flag-checkered",
  cancelled: "fa-times",
  conflict: "fa-exclamation-triangle",
};

const paymentColors: Record<string, string> = {
  unpaid: "bg-red-50 text-red-500 border-red-100",
  deposit_paid: "bg-amber-50 text-amber-600 border-amber-100",
  full_paid: "bg-emerald-50 text-emerald-600 border-emerald-100",
  refunded: "bg-slate-100 text-slate-500 border-slate-200",
};

const paymentLabels: Record<string, string> = {
  unpaid: "Unpaid",
  deposit_paid: "Deposit Paid",
  full_paid: "Full Paid",
  refunded: "Refunded",
};

export default function OrdersTab({ vendorId, vendorName }: OrdersTabProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Order["status"]>("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [sendingReviewLink, setSendingReviewLink] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [unlinkedAgreements, setUnlinkedAgreements] = useState<UnlinkedAgreement[]>([]);
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  function showToast(msg: string, type: "success" | "error" = "success") { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); }

  // Real-time orders listener
  useEffect(() => {
    const q = query(
      collection(db, "orders"),
      where("vendorId", "==", vendorId),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)).filter(o => !o.deleted));
      setLoading(false);
    });

    return () => unsub();
  }, [vendorId]);

  // Real-time unlinked agreements listener
  useEffect(() => {
    const q = query(
      collection(db, "agreements"),
      where("vendorId", "==", vendorId),
      orderBy("timestamp", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setUnlinkedAgreements(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() } as UnlinkedAgreement))
          .filter(a => !a.orderId)
      );
    });
    return () => unsub();
  }, [vendorId]);

  // Generate agreement link with orderId and embedded booking data
  function getAgreementLink(order: Order) {
    if (typeof window === "undefined") return "";
    const base = `${window.location.origin}/agreement?v=${vendorId}&o=${order.id}`;
    try {
      const summary = {
        items: order.items.map(i => ({
          name: i.name, qty: i.qty, price: i.price,
          ...(i.variantLabel ? { variantLabel: i.variantLabel, variantColor: i.variantColor } : {}),
        })),
        dates: order.bookingDates,
        total: (order as any).manualPrice || order.totalAmount,
      };
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(summary))));
      return `${base}&d=${encoded}`;
    } catch {
      return base;
    }
  }

  // Share agreement link via WhatsApp
  function sendAgreementWhatsApp(order: Order) {
    const link = getAgreementLink(order);
    const msg = `Sila lengkapkan pengesahan identiti untuk tempahan anda:\n\n${link}\n\n1. Masukkan nama penuh\n2. Masukkan nombor WhatsApp\n3. Muat naik gambar IC (depan & belakang)\n4. Tandatangan waiver\n\nTerima kasih!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

  // Manual link: attach an unlinked agreement to this order
  async function linkAgreementToOrder(agreementId: string, order: Order) {
    try {
      const agSnap = unlinkedAgreements.find(a => a.id === agreementId);
      if (!agSnap) return;

      // Update order with customer info from agreement
      await updateDoc(doc(db, "orders", order.id), {
        customerName: agSnap.customerName,
        customerPhone: agSnap.customerPhone || "",
        agreementSigned: true,
        agreementSignedAt: serverTimestamp(),
        agreementId,
      });

      // Update agreement with orderId
      await updateDoc(doc(db, "agreements", agreementId), {
        orderId: order.id,
      });

      // Update calendar entries with real customer name
      try {
        const availSnap = await getDocs(
          query(collection(db, "vendors", vendorId, "availability"), where("orderId", "==", order.id))
        );
        for (const d of availSnap.docs) {
          if (d.data().customer === "Pending Order") {
            await updateDoc(doc(db, "vendors", vendorId, "availability", d.id), {
              customer: agSnap.customerName,
              phone: agSnap.customerPhone || "",
            });
          }
        }
      } catch (e) { console.error("Calendar update error:", e); }

      setShowLinkPicker(false);
      showToast("Agreement linked!");
    } catch (e) {
      console.error("Link error:", e);
      showToast("Failed to link agreement.", "error");
    }
  }

  // Filter orders
  const filteredOrders = filter === "all" 
    ? orders 
    : orders.filter(o => o.status === filter);

  // Update order status
  async function updateStatus(orderId: string, newStatus: Order["status"]) {
    const updates: any = { status: newStatus };
    
    if (newStatus === "completed") {
      const token = uuidv4();
      updates.completedAt = serverTimestamp();
      updates.reviewToken = token;
      updates.reviewTokenUsed = false;
    }

    await updateDoc(doc(db, "orders", orderId), updates);

    // Sync calendar availability
    try {
      const availSnap = await getDocs(
        query(collection(db, "vendors", vendorId, "availability"), where("orderId", "==", orderId))
      );

      if (newStatus === "cancelled") {
        // Delete all availability entries for this order
        for (const d of availSnap.docs) {
          await deleteDoc(doc(db, "vendors", vendorId, "availability", d.id));
        }
      } else if (newStatus === "completed") {
        // Clean up availability — gear is returned, free the stock
        for (const d of availSnap.docs) {
          await deleteDoc(doc(db, "vendors", vendorId, "availability", d.id));
        }
      } else if (newStatus === "confirmed") {
        // Update "Pending Order" to actual customer name
        const order = orders.find(o => o.id === orderId);
        const customerName = order?.customerName || order?.customerPhone || "Customer";
        for (const d of availSnap.docs) {
          if (d.data().customer === "Pending Order") {
            await updateDoc(doc(db, "vendors", vendorId, "availability", d.id), {
              customer: customerName,
            });
          }
        }
      }
    } catch (e) {
      console.error("Calendar sync error:", e);
    }

    setShowModal(false);
    const labels: Record<string, string> = { pending: "Pending", confirmed: "✅ Confirmed", completed: "🏁 Completed", cancelled: "❌ Cancelled", conflict: "⚠️ Conflict" };
    showToast(labels[newStatus] || newStatus);
  }

  async function deleteOrder(orderId: string) {
    if (!confirm("Delete this order? This action cannot be undone.")) return;
    try {
      await updateDoc(doc(db, "orders", orderId), { deleted: true });

      // Clean up calendar entries
      try {
        const availSnap = await getDocs(
          query(collection(db, "vendors", vendorId, "availability"), where("orderId", "==", orderId))
        );
        for (const d of availSnap.docs) {
          await deleteDoc(doc(db, "vendors", vendorId, "availability", d.id));
        }
      } catch (e) { console.error("Calendar cleanup error:", e); }

      setShowModal(false);
      setSelectedOrder(null);
      showToast("Order deleted!");
    } catch (e) { console.error("Delete order error:", e); }
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
    conflict: orders.filter(o => o.status === "conflict").length,
    confirmed: orders.filter(o => o.status === "confirmed").length,
    completed: orders.filter(o => o.status === "completed").length,
    awaitingReview: orders.filter(o => o.status === "completed" && !o.reviewTokenUsed).length,
    unpaid: orders.filter(o => !o.paymentStatus || o.paymentStatus === "unpaid").filter(o => o.status !== "cancelled").length,
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
          <p className="text-[8px] text-slate-300 mt-1">All time orders</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
          <p className="text-[9px] font-black text-amber-600 uppercase">Pending</p>
          <p className="text-2xl font-black text-amber-700">{stats.pending}{stats.conflict > 0 ? <span className="text-red-600 text-sm ml-1">+{stats.conflict}</span> : ""}</p>
          <p className="text-[8px] text-amber-500 mt-1">Needs your action</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <p className="text-[9px] font-black text-blue-600 uppercase">Confirmed</p>
          <p className="text-2xl font-black text-blue-700">{stats.confirmed}</p>
          <p className="text-[8px] text-blue-500 mt-1">Active bookings</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
          <p className="text-[9px] font-black text-emerald-600 uppercase">Completed</p>
          <p className="text-2xl font-black text-emerald-700">{stats.completed}</p>
          <p className="text-[8px] text-emerald-500 mt-1">Gear returned</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 border border-red-100">
          <p className="text-[9px] font-black text-red-600 uppercase">Unpaid</p>
          <p className="text-2xl font-black text-red-700">{stats.unpaid}</p>
          <p className="text-[8px] text-red-500 mt-1">Awaiting payment</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
        {(["all", "pending", "conflict", "confirmed", "completed", "cancelled"] as const).map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase whitespace-nowrap transition-all ${
              filter === status
                ? status === "conflict" ? "bg-red-600 text-white" : "bg-[#062c24] text-white"
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
        <div className="bg-white rounded-2xl border border-slate-100 p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-inbox text-slate-300 text-2xl"></i>
            </div>
            <p className="text-sm font-bold text-slate-400">
              {filter === "all" ? "No orders yet" : `No ${filter} orders`}
            </p>
            <p className="text-xs text-slate-300 mt-1">
              {filter === "all" 
                ? "Orders will appear here when customers book via WhatsApp" 
                : "Try viewing all orders instead"}
            </p>
          </div>

          {/* Order Flow Guide - Only show when no orders at all */}
          {filter === "all" && orders.length === 0 && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5">
              <h4 className="text-xs font-black text-emerald-700 uppercase mb-4 flex items-center gap-2">
                <i className="fas fa-route"></i> How Orders Work
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-2 text-sm font-black">1</div>
                  <p className="text-[10px] font-black text-slate-600 uppercase">Pending</p>
                  <p className="text-[9px] text-slate-400 mt-1">Customer submits order via WhatsApp</p>
                </div>
                <div className="text-center">
                  <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2 text-sm font-black">2</div>
                  <p className="text-[10px] font-black text-slate-600 uppercase">Confirmed</p>
                  <p className="text-[9px] text-slate-400 mt-1">You accept the booking</p>
                </div>
                <div className="text-center">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2 text-sm font-black">3</div>
                  <p className="text-[10px] font-black text-slate-600 uppercase">Completed</p>
                  <p className="text-[9px] text-slate-400 mt-1">Gear returned, mark as done</p>
                </div>
                <div className="text-center">
                  <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-2 text-sm font-black">
                    <i className="fas fa-star text-xs"></i>
                  </div>
                  <p className="text-[10px] font-black text-slate-600 uppercase">Review</p>
                  <p className="text-[9px] text-slate-400 mt-1">Customer rates their experience</p>
                </div>
              </div>
              <p className="text-[10px] text-emerald-600 text-center mt-4 font-medium">
                <i className="fas fa-lightbulb mr-1"></i>
                Mark orders "Completed" to automatically send review requests!
              </p>
            </div>
          )}
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
                    {order.agreementSigned ? (
                      <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase bg-emerald-50 text-emerald-600">
                        <i className="fas fa-file-signature mr-1"></i> Signed
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase bg-slate-100 text-slate-400">
                        <i className="fas fa-file-signature mr-1"></i> Unsigned
                      </span>
                    )}
                    {order.calendarLinked && (
                      <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase bg-blue-50 text-blue-600">
                        <i className="fas fa-calendar-check mr-1"></i> Booked
                      </span>
                    )}
                    {order.paymentStatus && order.paymentStatus !== "unpaid" && (
                      <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase border ${paymentColors[order.paymentStatus]}`}>
                        <i className="fas fa-money-bill-wave mr-1"></i>{paymentLabels[order.paymentStatus]}
                      </span>
                    )}
                    {order.stockConflict && (
                      <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase bg-red-100 text-red-600 animate-pulse">
                        <i className="fas fa-exclamation-triangle mr-1"></i> Stock Conflict
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <span className={`font-black ${order.customerName ? "text-[#062c24]" : "text-slate-400 italic"}`}>
                      {order.customerName || "Customer (awaiting agreement)"}
                    </span>
                    {order.customerPhone && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span className="text-emerald-600 text-xs font-bold">
                          <i className="fab fa-whatsapp mr-0.5"></i>{order.customerPhone}
                        </span>
                      </>
                    )}
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-500">
                      {order.bookingDates.start} → {order.bookingDates.end}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 mt-1">
                    {order.items.map(i => `${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ""} x${i.qty}`).join(", ")}
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
            <div className="mb-4 flex flex-wrap gap-2">
              <span className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase ${statusColors[selectedOrder.status]}`}>
                <i className={`fas ${statusIcons[selectedOrder.status]} mr-1`}></i>
                {selectedOrder.status}
              </span>
              {selectedOrder.agreementSigned ? (
                <span className="px-3 py-1.5 rounded-lg text-xs font-black uppercase bg-emerald-50 text-emerald-600">
                  <i className="fas fa-file-signature mr-1"></i> Agreement Signed
                </span>
              ) : (
                <span className="px-3 py-1.5 rounded-lg text-xs font-black uppercase bg-slate-100 text-slate-400">
                  <i className="fas fa-file-signature mr-1"></i> Awaiting Agreement
                </span>
              )}
              {selectedOrder.calendarLinked && (
                <span className="px-3 py-1.5 rounded-lg text-xs font-black uppercase bg-blue-50 text-blue-600">
                  <i className="fas fa-calendar-check mr-1"></i> Calendar Booked
                </span>
              )}
            </div>

            {/* Customer Info */}
            <div className="bg-slate-50 rounded-xl p-4 mb-4">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Customer</p>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selectedOrder.customerName ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-400"}`}>
                  <i className="fas fa-user"></i>
                </div>
                <div>
                  <p className={`font-bold ${selectedOrder.customerName ? "text-[#062c24]" : "text-slate-400 italic"}`}>
                    {selectedOrder.customerName || "Customer (awaiting agreement)"}
                  </p>
                  {selectedOrder.customerPhone ? (
                    <p className="text-xs text-slate-500"><i className="fab fa-whatsapp text-emerald-500 mr-1"></i>{selectedOrder.customerPhone}</p>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Awaiting agreement sign</p>
                  )}
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
                  <div key={i} className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {item.variantColor && <span className="w-3 h-3 rounded-full border border-slate-200 shrink-0" style={{ backgroundColor: item.variantColor }}></span>}
                      <span className="text-slate-600 truncate">
                        {item.name} x{item.qty}
                        {item.variantLabel && <span className="text-[9px] text-teal-600 ml-1">({item.variantLabel})</span>}
                      </span>
                    </div>
                    <span className="font-bold shrink-0 ml-2">RM {item.price * item.qty}</span>
                  </div>
                ))}
                <div className="border-t border-slate-200 pt-2 space-y-1">
                  {selectedOrder.depositAmount ? (
                    <>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Rental</span>
                        <span className="font-bold text-[#062c24]">RM {selectedOrder.rentalAmount ?? (selectedOrder.totalAmount - selectedOrder.depositAmount)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Deposit (Refundable)</span>
                        <span className="font-bold text-slate-400">RM {selectedOrder.depositAmount}</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-slate-100">
                        <span className="font-black text-[#062c24]">Total</span>
                        <span className="font-black text-emerald-600 text-lg">RM {selectedOrder.totalAmount}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between">
                      <span className="font-black text-[#062c24]">Total</span>
                      <span className="font-black text-emerald-600 text-lg">RM {selectedOrder.totalAmount}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Stock Conflict Warning */}
            {selectedOrder.stockConflict && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                <p className="text-xs font-black text-red-700 uppercase mb-2"><i className="fas fa-exclamation-triangle mr-1"></i>Stock Conflict Detected</p>
                <div className="space-y-1">
                  {(selectedOrder.stockConflictDetails || []).map((detail, i) => (
                    <p key={i} className="text-[10px] text-red-600">• {detail}</p>
                  ))}
                </div>
                <p className="text-[9px] text-red-500 mt-2">Please check inventory or cancel this order.</p>
              </div>
            )}

            {/* Payment Status */}
            <div className="mb-4">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Payment Status</p>
              <div className="grid grid-cols-4 gap-1.5">
                {(["unpaid", "deposit_paid", "full_paid", "refunded"] as const).map(ps => (
                  <button
                    key={ps}
                    onClick={async () => {
                      try {
                        await updateDoc(doc(db, "orders", selectedOrder.id), { paymentStatus: ps });
                        showToast(`Payment: ${paymentLabels[ps]}`);
                      } catch (e) { console.error("Payment status error:", e); showToast("Failed to update payment", "error"); }
                    }}
                    className={`py-2.5 rounded-xl text-[8px] font-black uppercase text-center transition-all border ${
                      (selectedOrder.paymentStatus || "unpaid") === ps
                        ? paymentColors[ps] + " ring-2 ring-offset-1 ring-current"
                        : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                    }`}
                  >
                    {paymentLabels[ps]}
                  </button>
                ))}
              </div>
            </div>

            {/* Status Actions */}
            <div className="space-y-2">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Update Status</p>
              
              {selectedOrder.status === "pending" && (
                <>
                  <p className="text-[10px] text-slate-400 mb-2">
                    <i className="fas fa-info-circle mr-1"></i>
                    This order is waiting for your confirmation
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => updateStatus(selectedOrder.id, "confirmed")}
                      className="py-3 rounded-xl font-black uppercase text-xs bg-blue-500 text-white hover:bg-blue-600"
                      title="Accept this booking"
                    >
                      <i className="fas fa-check mr-2"></i>Confirm
                    </button>
                    <button
                      onClick={() => updateStatus(selectedOrder.id, "cancelled")}
                      className="py-3 rounded-xl font-black uppercase text-xs bg-red-100 text-red-600 hover:bg-red-200"
                      title="Reject or cancel this booking"
                    >
                      <i className="fas fa-times mr-2"></i>Cancel
                    </button>
                  </div>
                </>
              )}

              {selectedOrder.status === "conflict" && (
                <>
                  <p className="text-[10px] text-red-500 mb-2">
                    <i className="fas fa-exclamation-triangle mr-1"></i>
                    Stock conflict detected. Confirm to override or cancel.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={async () => {
                        await updateDoc(doc(db, "orders", selectedOrder.id), { stockConflict: false });
                        await updateStatus(selectedOrder.id, "confirmed");
                      }}
                      className="py-3 rounded-xl font-black uppercase text-xs bg-amber-500 text-white hover:bg-amber-600"
                    >
                      <i className="fas fa-check mr-2"></i>Override & Confirm
                    </button>
                    <button
                      onClick={() => updateStatus(selectedOrder.id, "cancelled")}
                      className="py-3 rounded-xl font-black uppercase text-xs bg-red-100 text-red-600 hover:bg-red-200"
                    >
                      <i className="fas fa-times mr-2"></i>Cancel
                    </button>
                  </div>
                </>
              )}

              {selectedOrder.status === "confirmed" && (
                <>
                  <p className="text-[10px] text-slate-400 mb-2">
                    <i className="fas fa-info-circle mr-1"></i>
                    Mark as completed after gear is returned
                  </p>
                  <button
                    onClick={() => updateStatus(selectedOrder.id, "completed")}
                    className="w-full py-3 rounded-xl font-black uppercase text-xs bg-emerald-500 text-white hover:bg-emerald-600"
                    title="Mark as done - sends review link to customer"
                  >
                    <i className="fas fa-flag-checkered mr-2"></i>Mark as Completed
                  </button>
                </>
              )}

              {selectedOrder.status === "completed" && !selectedOrder.reviewTokenUsed && (
                <>
                  <p className="text-[10px] text-slate-400 mb-2">
                    <i className="fas fa-info-circle mr-1"></i>
                    Remind customer to leave a review
                  </p>
                  <button
                    onClick={() => sendReviewLinkWhatsApp(selectedOrder)}
                    className="w-full py-3 rounded-xl font-black uppercase text-xs bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600"
                    title="Send review link via WhatsApp"
                  >
                    <i className="fas fa-fire mr-2"></i>Send Review Request
                  </button>
                </>
              )}

              {selectedOrder.status === "completed" && selectedOrder.reviewTokenUsed && (
                <div className="text-center py-4 bg-emerald-50 rounded-xl">
                  <i className="fas fa-check-circle text-emerald-500 text-2xl mb-2"></i>
                  <p className="text-sm font-bold text-emerald-700">Customer has reviewed!</p>
                </div>
              )}
            </div>

            {/* Calendar Booking */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-3">Calendar Booking</p>
              
              {selectedOrder.calendarLinked ? (
                <div className="bg-blue-50 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                    <i className="fas fa-calendar-check"></i>
                  </div>
                  <div>
                    <p className="text-xs font-black text-blue-700">Booking Created</p>
                    <p className="text-[10px] text-blue-600">
                      Items blocked on calendar
                      {(selectedOrder as any).calendarDates?.start ? ` • ${(selectedOrder as any).calendarDates.start} → ${(selectedOrder as any).calendarDates.end}` : ""}
                    </p>
                  </div>
                </div>
              ) : (
                <a
                  href={`/calendar?order=${selectedOrder.id}`}
                  className="w-full py-3 rounded-xl font-black uppercase text-xs bg-blue-500 text-white hover:bg-blue-600 flex items-center justify-center gap-2 transition-all"
                >
                  <i className="fas fa-calendar-plus"></i> Create Booking on Calendar
                </a>
              )}
            </div>

            {/* Agreement Section */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-3">Agreement</p>
              
              {selectedOrder.agreementSigned ? (
                <div className="bg-emerald-50 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                    <i className="fas fa-file-signature"></i>
                  </div>
                  <div>
                    <p className="text-xs font-black text-emerald-700">Agreement Signed</p>
                    <p className="text-[10px] text-emerald-600">
                      {selectedOrder.customerName} • {selectedOrder.agreementSignedAt?.toDate?.()?.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" }) || ""}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Send agreement link via WhatsApp */}
                  <button
                    onClick={() => sendAgreementWhatsApp(selectedOrder)}
                    className="w-full py-3 rounded-xl font-black uppercase text-xs bg-indigo-100 text-indigo-700 hover:bg-indigo-200 flex items-center justify-center gap-2 transition-all"
                  >
                    <i className="fas fa-paper-plane"></i> Send Agreement Link
                  </button>

                  {/* Manual link from unlinked agreements */}
                  {unlinkedAgreements.length > 0 && (
                    <>
                      <button
                        onClick={() => setShowLinkPicker(!showLinkPicker)}
                        className="w-full py-3 rounded-xl font-black uppercase text-[10px] bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center gap-2 transition-all"
                      >
                        <i className="fas fa-link"></i> Link Existing Agreement ({unlinkedAgreements.length})
                      </button>
                      {showLinkPicker && (
                        <div className="bg-slate-50 rounded-xl p-3 space-y-2 max-h-40 overflow-y-auto border border-slate-200">
                          {unlinkedAgreements.map(a => (
                            <button
                              key={a.id}
                              onClick={() => linkAgreementToOrder(a.id, selectedOrder)}
                              className="w-full flex items-center justify-between bg-white p-3 rounded-lg border border-slate-100 hover:border-indigo-300 transition-all text-left"
                            >
                              <div>
                                <p className="text-xs font-bold text-[#062c24]">{a.customerName}</p>
                                <p className="text-[9px] text-slate-400">
                                  {a.timestamp?.toDate?.()?.toLocaleDateString("en-MY", { day: "numeric", month: "short" }) || ""}
                                  {a.customerPhone ? ` • ${a.customerPhone}` : ""}
                                </p>
                              </div>
                              <i className="fas fa-arrow-right text-slate-300 text-xs"></i>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* WhatsApp Quick Messages */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-3"><i className="fab fa-whatsapp text-emerald-500 mr-1"></i>Quick Messages</p>
              {selectedOrder.customerPhone ? (() => {
                const phone = selectedOrder.customerPhone.replace(/[\s\-\+\(\)]/g, "");
                const name = selectedOrder.customerName || "pelanggan";
                const items = selectedOrder.items.map(i => i.name).join(", ");
                const dates = selectedOrder.bookingDates;
                const total = selectedOrder.totalAmount;
                const rental = selectedOrder.rentalAmount ?? total;
                const deposit = selectedOrder.depositAmount ?? Math.round(total - rental);

                const templates = [
                  {
                    label: "Confirm Booking",
                    icon: "fa-check-circle",
                    color: "bg-blue-50 text-blue-700 border-blue-100",
                    show: selectedOrder.status === "pending" || selectedOrder.status === "confirmed",
                    msg: `Assalamualaikum ${name} 👋\n\n✅ *Tempahan anda telah disahkan!*\n\n📦 Item: ${items}\n📅 Tarikh: ${dates.start} → ${dates.end}\n💰 Sewaan: RM${rental}\n💳 Deposit: RM${deposit}\n💵 Jumlah: RM${total}\n\nSila buat bayaran deposit RM${deposit} ke akaun berikut untuk mengesahkan tempahan:\n\n🏦 [Bank/No Akaun]\n\nSelepas bayaran, sila hantar bukti pembayaran di sini.\n\nTerima kasih! 🏕️`,
                  },
                  {
                    label: "Deposit Received",
                    icon: "fa-money-bill-wave",
                    color: "bg-emerald-50 text-emerald-700 border-emerald-100",
                    show: true,
                    msg: `Assalamualaikum ${name} 👋\n\n💚 *Deposit telah diterima!*\n\nTempahan anda kini telah dikunci:\n📦 ${items}\n📅 ${dates.start} → ${dates.end}\n\nKami akan hubungi anda sehari sebelum tarikh pickup untuk pengesahan lokasi dan masa.\n\nTerima kasih! 🏕️`,
                  },
                  {
                    label: "Pickup Reminder",
                    icon: "fa-map-marker-alt",
                    color: "bg-amber-50 text-amber-700 border-amber-100",
                    show: selectedOrder.status === "confirmed",
                    msg: `Assalamualaikum ${name} 👋\n\n📍 *Peringatan Pickup Esok!*\n\n📦 Item: ${items}\n📅 Tarikh Pickup: ${dates.start}\n📍 Lokasi: ${selectedOrder.pickupLocation || "TBD"}\n\nSila hubungi kami jika ada sebarang perubahan.\n\nJumpa esok! 🏕️`,
                  },
                  {
                    label: "Return Reminder",
                    icon: "fa-undo",
                    color: "bg-orange-50 text-orange-700 border-orange-100",
                    show: selectedOrder.status === "confirmed",
                    msg: `Assalamualaikum ${name} 👋\n\n🔄 *Peringatan Pemulangan*\n\n📦 Item: ${items}\n📅 Tarikh Pulang: ${dates.end}\n📍 Lokasi: ${selectedOrder.pickupLocation || "TBD"}\n\nSila pastikan semua peralatan dalam keadaan baik dan bersih.\n\nTerima kasih atas sokongan anda! 🙏`,
                  },
                  {
                    label: "Gear Ready",
                    icon: "fa-box-open",
                    color: "bg-teal-50 text-teal-700 border-teal-100",
                    show: selectedOrder.status === "confirmed",
                    msg: `Assalamualaikum ${name} 👋\n\n📦 *Peralatan anda sudah siap!*\n\n✅ ${items}\n\nSemua item telah diperiksa dan dalam keadaan baik. Anda boleh pickup pada:\n📅 ${dates.start}\n📍 ${selectedOrder.pickupLocation || "TBD"}\n\nSelamat berkemah! 🏕️🔥`,
                  },
                  {
                    label: "Full Payment",
                    icon: "fa-receipt",
                    color: "bg-purple-50 text-purple-700 border-purple-100",
                    show: true,
                    msg: `Assalamualaikum ${name} 👋\n\n💰 *Peringatan Baki Bayaran*\n\nBaki yang perlu dijelaskan:\n📦 ${items}\n💵 Sewaan: RM${rental}\n💳 Deposit dibayar: RM${deposit}\n💰 Baki sewaan: RM${rental - deposit > 0 ? rental - deposit : 0}\n💵 Jumlah keseluruhan: RM${total}\n\nSila buat bayaran sebelum tarikh pickup.\n\n🏦 [Bank/No Akaun]\n\nTerima kasih! 🙏`,
                  },
                  {
                    label: "Thank You",
                    icon: "fa-heart",
                    color: "bg-pink-50 text-pink-700 border-pink-100",
                    show: selectedOrder.status === "completed",
                    msg: `Assalamualaikum ${name} 👋\n\n🙏 *Terima kasih!*\n\nKami harap anda menikmati pengalaman berkemah dengan peralatan kami! 🏕️\n\nJika anda berpuas hati, kami amat menghargai jika anda boleh tinggalkan ulasan:\n⭐ ${typeof window !== "undefined" ? window.location.origin : ""}/review/${selectedOrder.reviewToken || ""}\n\nJumpa lagi di trip seterusnya! 🔥`,
                  },
                  {
                    label: "Custom Message",
                    icon: "fa-comment-dots",
                    color: "bg-slate-50 text-slate-700 border-slate-200",
                    show: true,
                    msg: `Assalamualaikum ${name} 👋\n\n`,
                  },
                ].filter(t => t.show);

                return (
                  <div className="grid grid-cols-2 gap-2">
                    {templates.map(t => (
                      <a
                        key={t.label}
                        href={`https://wa.me/${phone}?text=${encodeURIComponent(t.msg)}`}
                        target="_blank"
                        rel="noreferrer"
                        className={`py-2.5 px-3 rounded-xl text-[9px] font-black uppercase flex items-center gap-1.5 transition-all border hover:shadow-sm ${t.color}`}
                      >
                        <i className={`fas ${t.icon} text-[10px]`}></i>
                        <span className="truncate">{t.label}</span>
                      </a>
                    ))}
                  </div>
                );
              })() : (
                <div className="w-full py-3 rounded-xl font-black uppercase text-xs bg-slate-100 text-slate-400 flex items-center justify-center gap-2">
                  <i className="fab fa-whatsapp"></i>No Phone Number Yet
                </div>
              )}
            </div>

            {/* Delete Order */}
            <button
              onClick={() => deleteOrder(selectedOrder.id)}
              className="w-full mt-2 py-3 rounded-xl font-black uppercase text-[10px] bg-white border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 flex items-center justify-center gap-2 transition-all"
            >
              <i className="fas fa-trash-alt"></i>Delete Order
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[500] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-white text-[10px] font-black uppercase tracking-widest ${
          toast.type === "success" ? "bg-emerald-600" : "bg-red-500"
        }`} style={{ animation: "toastIn 0.3s ease-out" }}>
          <i className={`fas ${toast.type === "success" ? "fa-check-circle" : "fa-exclamation-circle"}`}></i>
          {toast.msg}
        </div>
      )}
      <style>{`@keyframes toastIn { from { opacity: 0; transform: translate(-50%, 20px); } to { opacity: 1; transform: translate(-50%, 0); } }`}</style>
    </div>
  );
}