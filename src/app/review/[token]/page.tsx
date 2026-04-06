"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/firebase";
import {
  doc, getDoc, collection, addDoc,
  serverTimestamp,
} from "firebase/firestore";

type OrderData = {
  vendorId: string;
  vendorName: string;
  customerPhone: string;
  customerName?: string;
  items: { name: string; qty: number }[];
  totalAmount: number;
  bookingDates: { start: string; end: string };
  reviewToken: string;
  reviewTokenUsed: boolean;
  status: string;
};

const CATEGORIES = [
  { key: "gearCondition", label: "Gear Condition", labelMy: "Keadaan Peralatan", icon: "fa-campground", desc: "Cleanliness, functionality, as described" },
  { key: "communication", label: "Communication", labelMy: "Komunikasi", icon: "fa-comments", desc: "Responsiveness, friendliness, clarity" },
  { key: "value", label: "Value for Money", labelMy: "Berbaloi", icon: "fa-coins", desc: "Fair pricing for what you received" },
  { key: "convenience", label: "Pickup / Delivery", labelMy: "Kemudahan", icon: "fa-truck-pickup", desc: "Smooth handover, on time, location" },
  { key: "overall", label: "Overall Experience", labelMy: "Keseluruhan", icon: "fa-heart", desc: "Would you rent again?" },
] as const;

type CategoryKey = typeof CATEGORIES[number]["key"];

const SENTIMENTS: Record<number, { label: string; color: string }> = {
  0: { label: "Tap to rate", color: "text-slate-300" },
  1: { label: "Poor", color: "text-red-500" },
  2: { label: "Fair", color: "text-orange-500" },
  3: { label: "Good", color: "text-amber-500" },
  4: { label: "Great", color: "text-emerald-500" },
  5: { label: "Excellent", color: "text-emerald-600" },
};

function CategoryRating({
  category,
  value,
  onChange,
}: {
  category: typeof CATEGORIES[number];
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 transition-all hover:border-slate-200">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm ${
          value > 0 ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
        } transition-colors`}>
          <i className={`fas ${category.icon}`}></i>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-[#062c24] uppercase">{category.label}</p>
          <p className="text-[9px] text-slate-400">{category.desc}</p>
        </div>
        <span className={`text-[10px] font-black uppercase ${SENTIMENTS[value].color} transition-colors min-w-[55px] text-right`}>
          {SENTIMENTS[value].label}
        </span>
      </div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            onClick={() => onChange(n === value ? 0 : n)}
            className={`flex-1 h-9 rounded-lg font-black text-xs transition-all active:scale-95 ${
              n <= value
                ? "bg-emerald-500 text-white shadow-sm"
                : "bg-slate-100 text-slate-400 hover:bg-slate-200"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ReviewPage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderData | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  // Form
  const [ratings, setRatings] = useState<Record<CategoryKey, number>>({
    gearCondition: 0, communication: 0, value: 0, convenience: 0, overall: 0,
  });
  const [comment, setComment] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) return;
    loadOrder();
  }, [token]);

  async function loadOrder() {
    try {
      const { getDocs, query, where } = await import("firebase/firestore");
      const snapshot = await getDocs(
        query(collection(db, "orders"), where("reviewToken", "==", token))
      );

      if (snapshot.empty) { setError("invalid"); return; }

      const orderDoc = snapshot.docs[0];
      const orderData = orderDoc.data() as OrderData;

      if (orderData.reviewTokenUsed) { setError("used"); return; }
      if (orderData.status !== "completed") { setError("not_completed"); return; }

      setOrder(orderData);
      setOrderId(orderDoc.id);
      setDisplayName(orderData.customerName || "");
    } catch (e) {
      console.error(e);
      setError("error");
    } finally {
      setLoading(false);
    }
  }

  function setRating(key: CategoryKey, value: number) {
    setRatings(prev => ({ ...prev, [key]: value }));
  }

  const filledCount = Object.values(ratings).filter(v => v > 0).length;
  const avgRating = filledCount > 0
    ? Math.round((Object.values(ratings).reduce((a, b) => a + b, 0) / filledCount) * 10) / 10
    : 0;
  const allFilled = filledCount === CATEGORIES.length;

  function maskPhone(phone: string): string {
    if (!phone || phone.length < 6) return phone;
    return phone.slice(0, 4) + "****" + phone.slice(-2);
  }

  async function handleSubmit() {
    if (!order || !orderId || !allFilled) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, "reviews"), {
        orderId,
        vendorId: order.vendorId,
        customerPhone: maskPhone(order.customerPhone),
        customerName: displayName || "Camper",
        rating: avgRating,
        ratings,
        comment: comment.trim() || null,
        isVerified: true,
        reviewToken: token,
        status: "published",
        createdAt: serverTimestamp(),
      });
      setSubmitted(true);
    } catch (e) {
      console.error(e);
      alert("Failed to submit review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f4f1] flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-emerald-500 text-2xl mb-3"></i>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Loading review...</p>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    const errorContent = {
      invalid: { icon: "fa-link-slash", title: "Invalid Link", message: "This review link is invalid or has expired." },
      used: { icon: "fa-check-circle", title: "Already Reviewed", message: "You've already submitted a review for this order. Thank you!" },
      not_completed: { icon: "fa-clock", title: "Order Not Completed", message: "This order hasn't been marked as completed yet." },
      error: { icon: "fa-exclamation-triangle", title: "Something Went Wrong", message: "We couldn't load your review. Please try again later." },
    }[error] || { icon: "fa-question", title: "Error", message: "Unknown error" };

    return (
      <div className="min-h-screen bg-[#f5f4f1] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-xl">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${error === "used" ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-500"}`}>
            <i className={`fas ${errorContent.icon} text-3xl`}></i>
          </div>
          <h1 className="text-xl font-black text-[#062c24] uppercase mb-2">{errorContent.title}</h1>
          <p className="text-sm text-slate-500 mb-6">{errorContent.message}</p>
          <Link href="/directory" className="inline-block bg-[#062c24] text-white px-6 py-3 rounded-xl font-black uppercase text-xs">
            Browse Vendors
          </Link>
        </div>
      </div>
    );
  }

  // Success
  if (submitted) {
    return (
      <div className="min-h-screen bg-[#f5f4f1] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-xl">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="fas fa-check text-3xl"></i>
          </div>
          <h1 className="text-2xl font-black text-[#062c24] uppercase mb-2">Thank You!</h1>
          <p className="text-sm text-slate-500 mb-1">Your review has been submitted.</p>

          {/* Score Summary */}
          <div className="bg-slate-50 rounded-2xl p-4 my-6 text-left space-y-2">
            {CATEGORIES.map(cat => (
              <div key={cat.key} className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500">{cat.label}</span>
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(n => (
                    <div key={n} className={`w-4 h-4 rounded text-[8px] font-black flex items-center justify-center ${
                      n <= ratings[cat.key] ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"
                    }`}>{n}</div>
                  ))}
                </div>
              </div>
            ))}
            <div className="border-t border-slate-200 pt-2 flex justify-between items-center">
              <span className="text-xs font-black text-[#062c24]">Average</span>
              <span className="text-lg font-black text-emerald-600">{avgRating.toFixed(1)}</span>
            </div>
          </div>

          <p className="text-xs text-slate-400 mb-6">Your feedback helps other campers find great gear!</p>
          <Link href={`/shop?v=${order?.vendorId}`} className="inline-block bg-[#062c24] text-white px-6 py-3 rounded-xl font-black uppercase text-xs">
            View {order?.vendorName}
          </Link>
        </div>
      </div>
    );
  }

  // Review form
  return (
    <div className="min-h-screen bg-[#f5f4f1] py-8 px-4" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="max-w-md mx-auto">

        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black text-[#062c24] uppercase mb-1">Rate Your Experience</h1>
          <p className="text-sm text-slate-500">with <span className="font-bold text-emerald-600">{order?.vendorName}</span></p>
        </div>

        {/* Order Summary */}
        <div className="bg-white rounded-2xl p-4 mb-4 border border-slate-100 shadow-sm">
          <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Your Order</p>
          <div className="space-y-1">
            {order?.items.map((item, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="font-medium text-slate-600">{item.name}</span>
                <span className="text-slate-400">x{item.qty}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100 mt-3 pt-3 flex justify-between text-xs">
            <span className="text-slate-400">{order?.bookingDates.start} → {order?.bookingDates.end}</span>
            <span className="font-bold text-emerald-600">RM {order?.totalAmount}</span>
          </div>
        </div>

        {/* Category Ratings */}
        <div className="space-y-3 mb-4">
          {CATEGORIES.map(cat => (
            <CategoryRating
              key={cat.key}
              category={cat}
              value={ratings[cat.key]}
              onChange={v => setRating(cat.key, v)}
            />
          ))}
        </div>

        {/* Average Display */}
        {filledCount > 0 && (
          <div className="bg-[#062c24] rounded-2xl p-4 mb-4 flex items-center justify-between text-white">
            <div>
              <p className="text-[9px] font-bold text-emerald-300 uppercase tracking-widest">Average Rating</p>
              <p className="text-2xl font-black">{avgRating.toFixed(1)} <span className="text-sm font-bold text-emerald-300">/ 5</span></p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-emerald-200">{filledCount} of {CATEGORIES.length} rated</p>
              <div className="flex gap-1 mt-1 justify-end">
                {CATEGORIES.map(cat => (
                  <div key={cat.key} className={`w-2 h-2 rounded-full ${ratings[cat.key] > 0 ? "bg-emerald-400" : "bg-white/20"}`}></div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Name & Comment */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4 space-y-4">
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block">Display Name (Optional)</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="How should we call you?"
              className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm font-medium outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block">Your Review (Optional)</label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Tell others about your experience..."
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm font-medium outline-none focus:border-emerald-500 resize-none"
            />
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!allFilled || submitting}
          className={`w-full py-4 rounded-2xl font-black uppercase text-sm tracking-wider shadow-lg transition-all ${
            allFilled && !submitting
              ? "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95"
              : "bg-slate-200 text-slate-400 cursor-not-allowed"
          }`}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <i className="fas fa-spinner fa-spin"></i> Submitting...
            </span>
          ) : !allFilled ? (
            `Rate all ${CATEGORIES.length} categories to submit`
          ) : (
            <span className="flex items-center justify-center gap-2">
              <i className="fas fa-paper-plane"></i> Submit Review
            </span>
          )}
        </button>

        <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-slate-400">
          <i className="fas fa-shield-alt text-emerald-500"></i>
          <span>Verified Purchase Review</span>
        </div>

        <p className="text-center text-[10px] text-slate-400 mt-4">
          By submitting, you agree that your review may be displayed publicly.
        </p>
      </div>
    </div>
  );
}