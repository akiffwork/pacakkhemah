"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/firebase";
import {
  doc, getDoc, collection, addDoc, updateDoc, runTransaction,
  serverTimestamp, increment,
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

// ============ INTERACTIVE FIREWOOD RATING ============
function FirewoodRatingInput({ 
  value, 
  onChange 
}: { 
  value: number; 
  onChange: (rating: number) => void;
}) {
  const [hoverRating, setHoverRating] = useState(0);
  const displayRating = hoverRating || value;
  
  const flameOpacity = 0.4 + (displayRating / 5) * 0.6;
  const flameScale = 0.5 + (displayRating / 5) * 0.5;
  const glowIntensity = Math.round((displayRating / 5) * 20);

  const logPositions = [
    { x: 5, y: 75, rotation: -5, log: 1, label: "Poor" },
    { x: 25, y: 78, rotation: 0, log: 2, label: "Fair" },
    { x: 45, y: 75, rotation: 5, log: 3, label: "Good" },
    { x: 12, y: 58, rotation: 20, log: 4, label: "Great" },
    { x: 38, y: 58, rotation: -20, log: 5, label: "Amazing" },
  ];

  const ratingLabels: Record<number, { text: string; emoji: string }> = {
    0: { text: "Tap a log to rate", emoji: "🪵" },
    1: { text: "Poor Experience", emoji: "😞" },
    2: { text: "Could Be Better", emoji: "😐" },
    3: { text: "Good", emoji: "🙂" },
    4: { text: "Great Experience!", emoji: "😄" },
    5: { text: "Amazing! 🔥", emoji: "🤩" },
  };

  return (
    <div className="flex flex-col items-center">
      {/* Rating Label */}
      <div className="mb-4 text-center min-h-[60px] flex flex-col justify-center">
        <span className="text-4xl mb-1">{ratingLabels[displayRating].emoji}</span>
        <span className={`text-sm font-bold uppercase tracking-wide transition-colors ${displayRating > 0 ? "text-orange-600" : "text-slate-400"}`}>
          {ratingLabels[displayRating].text}
        </span>
      </div>

      {/* Interactive Firewood */}
      <div 
        className="relative cursor-pointer select-none"
        onMouseLeave={() => setHoverRating(0)}
      >
        <svg width={180} height={180} viewBox="0 0 80 90" style={{ overflow: "visible" }}>
          <defs>
            <linearGradient id="flameGradInput" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#ff4500" />
              <stop offset="30%" stopColor="#ff6600" />
              <stop offset="60%" stopColor="#ff8c00" />
              <stop offset="100%" stopColor="#ffa500" />
            </linearGradient>
            <linearGradient id="flameInnerInput" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#ffd700" />
              <stop offset="50%" stopColor="#ffec8b" />
              <stop offset="100%" stopColor="#fffacd" />
            </linearGradient>
            <radialGradient id="emberGradInput">
              <stop offset="0%" stopColor="#ff4500" />
              <stop offset="60%" stopColor="#ff6600" stopOpacity="0.5" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>

          {/* Ember glow */}
          {displayRating > 0 && (
            <ellipse 
              cx="40" cy="82" 
              rx={10 + displayRating * 4} ry="6" 
              fill="url(#emberGradInput)" 
              style={{ opacity: 0.3 + (displayRating / 5) * 0.5 }}
              className="transition-all duration-300"
            />
          )}

          {/* Flame */}
          {displayRating > 0 && (
            <g 
              transform={`translate(40, 25) scale(${flameScale})`} 
              style={{ 
                filter: `drop-shadow(0 0 ${glowIntensity}px rgba(255,100,0,0.8))`,
                transformOrigin: "center bottom",
              }}
              className="transition-all duration-300"
            >
              <path 
                d="M0 32 C-12 20 -16 6 -8 -15 C-6 -8 -3 0 0 -8 C3 0 6 -8 8 -15 C16 6 12 20 0 32Z" 
                fill="url(#flameGradInput)" 
                className="animate-pulse"
                style={{ opacity: flameOpacity }} 
              />
              <path 
                d="M0 28 C-6 18 -8 10 -5 0 C-3 7 0 5 0 -3 C0 5 3 7 5 0 C8 10 6 18 0 28Z" 
                fill="url(#flameInnerInput)" 
                className="animate-pulse"
              />
              <path 
                d="M0 22 C-3 14 -4 8 -2 3 C0 6 0 4 0 2 C0 4 0 6 2 3 C4 8 3 14 0 22Z" 
                fill="#fff8dc" 
                className="animate-pulse"
                style={{ opacity: 0.9 }}
              />
            </g>
          )}

          {/* Interactive Logs */}
          {logPositions.map((pos, idx) => {
            const isActive = pos.log <= displayRating;
            const isHovered = pos.log === hoverRating;
            const logColor = isActive ? "#8B4513" : "#4a4a4a";
            const logColorDark = isActive ? "#654321" : "#3a3a3a";
            const endColor = isActive ? "#D2691E" : "#5a5a5a";
            
            return (
              <g 
                key={idx}
                transform={`translate(${pos.x}, ${pos.y}) rotate(${pos.rotation})`}
                style={{ 
                  opacity: isActive ? 1 : 0.4,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  transform: `translate(${pos.x}px, ${pos.y}px) rotate(${pos.rotation}deg) scale(${isHovered ? 1.1 : 1})`,
                }}
                onMouseEnter={() => setHoverRating(pos.log)}
                onClick={() => onChange(pos.log)}
              >
                <ellipse cx="10" cy="4" rx="12" ry="5" fill={logColor} />
                <rect x="-2" y="-1" width="24" height="10" rx="2" fill={logColor} />
                <ellipse cx="10" cy="4" rx="10" ry="4" fill={logColorDark} />
                <ellipse cx="-2" cy="4" rx="5" ry="5" fill={endColor} />
                <ellipse cx="-2" cy="4" rx="3" ry="3" fill={logColorDark} />
                <ellipse cx="-2" cy="4" rx="1.5" ry="1.5" fill={endColor} style={{ opacity: 0.7 }} />
                
                {/* Hover indicator */}
                {isHovered && (
                  <circle cx="10" cy="4" r="15" fill="none" stroke="#ff6600" strokeWidth="2" strokeDasharray="4 2" opacity="0.5">
                    <animate attributeName="stroke-dashoffset" from="0" to="12" dur="0.5s" repeatCount="indefinite" />
                  </circle>
                )}
              </g>
            );
          })}
        </svg>

        {/* Log labels */}
        <div className="absolute -bottom-8 left-0 right-0 flex justify-between px-2 text-[8px] font-bold text-slate-400 uppercase">
          <span>1</span>
          <span>2</span>
          <span>3</span>
          <span>4</span>
          <span>5</span>
        </div>
      </div>
    </div>
  );
}

// ============ MAIN REVIEW PAGE ============
export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderData | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  // Form state
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Load order by token
  useEffect(() => {
    if (!token) return;
    loadOrder();
  }, [token]);

  async function loadOrder() {
    try {
      // Query orders collection for matching token
      const { getDocs, query, where } = await import("firebase/firestore");
      const ordersQuery = query(
        collection(db, "orders"),
        where("reviewToken", "==", token)
      );
      const snapshot = await getDocs(ordersQuery);

      if (snapshot.empty) {
        setError("invalid");
        return;
      }

      const orderDoc = snapshot.docs[0];
      const orderData = orderDoc.data() as OrderData;

      if (orderData.reviewTokenUsed) {
        setError("used");
        return;
      }

      if (orderData.status !== "completed") {
        setError("not_completed");
        return;
      }

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

  async function handleSubmit() {
    if (!order || !orderId || rating === 0) return;

    setSubmitting(true);
    try {
      // Use transaction to ensure atomicity
      await runTransaction(db, async (transaction) => {
        // 1. Create review
        const reviewRef = doc(collection(db, "reviews"));
        transaction.set(reviewRef, {
          orderId,
          vendorId: order.vendorId,
          customerPhone: maskPhone(order.customerPhone),
          customerName: displayName || "Camper",
          rating,
          comment: comment.trim() || null,
          isVerified: true,
          reviewToken: token,
          status: "published",
          createdAt: serverTimestamp(),
        });

        // 2. Mark token as used
        const orderRef = doc(db, "orders", orderId);
        transaction.update(orderRef, {
          reviewTokenUsed: true,
        });

        // 3. Update vendor rating aggregates
        const vendorRef = doc(db, "vendors", order.vendorId);
        const vendorDoc = await transaction.get(vendorRef);
        const vendorData = vendorDoc.data();
        
        const currentCount = vendorData?.reviewCount || 0;
        const currentRating = vendorData?.rating || 0;
        const currentBreakdown = vendorData?.ratingBreakdown || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

        // Calculate new average
        const newCount = currentCount + 1;
        const newRating = ((currentRating * currentCount) + rating) / newCount;
        const newBreakdown = { ...currentBreakdown, [rating]: (currentBreakdown[rating] || 0) + 1 };

        transaction.update(vendorRef, {
          reviewCount: newCount,
          rating: Math.round(newRating * 10) / 10, // Round to 1 decimal
          ratingBreakdown: newBreakdown,
        });
      });

      setSubmitted(true);
    } catch (e) {
      console.error(e);
      alert("Failed to submit review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function maskPhone(phone: string): string {
    if (phone.length < 8) return phone;
    return phone.slice(0, 4) + "****" + phone.slice(-3);
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0f2f1] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm font-bold text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Error states
  if (error) {
    const errorContent = {
      invalid: {
        icon: "fa-link-slash",
        title: "Invalid Link",
        message: "This review link is invalid or has expired.",
      },
      used: {
        icon: "fa-check-circle",
        title: "Already Reviewed",
        message: "You've already submitted a review for this order. Thank you!",
      },
      not_completed: {
        icon: "fa-clock",
        title: "Order Not Completed",
        message: "This order hasn't been marked as completed yet. Please wait for the vendor to confirm.",
      },
      error: {
        icon: "fa-exclamation-triangle",
        title: "Something Went Wrong",
        message: "We couldn't load your review. Please try again later.",
      },
    }[error] || { icon: "fa-question", title: "Error", message: "Unknown error" };

    return (
      <div className="min-h-screen bg-[#f0f2f1] flex items-center justify-center p-6">
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

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen bg-[#f0f2f1] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-xl">
          <div className="w-24 h-24 mx-auto mb-6">
            <svg viewBox="0 0 80 90" className="w-full h-full">
              <defs>
                <linearGradient id="flameSuccess" x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="#ff4500" />
                  <stop offset="100%" stopColor="#ffa500" />
                </linearGradient>
              </defs>
              <g transform="translate(40, 20)" style={{ filter: "drop-shadow(0 0 15px rgba(255,100,0,0.8))" }}>
                <path d="M0 35 C-12 22 -16 8 -8 -15 C-6 -8 -3 0 0 -8 C3 0 6 -8 8 -15 C16 8 12 22 0 35Z" fill="url(#flameSuccess)" className="animate-pulse" />
                <path d="M0 28 C-6 18 -8 10 -5 0 C-3 7 0 5 0 -3 C0 5 3 7 5 0 C8 10 6 18 0 28Z" fill="#ffd700" className="animate-pulse" />
              </g>
              {[1, 2, 3, 4, 5].map((log, i) => {
                const positions = [
                  { x: 5, y: 75, r: -5 },
                  { x: 25, y: 78, r: 0 },
                  { x: 45, y: 75, r: 5 },
                  { x: 12, y: 58, r: 20 },
                  { x: 38, y: 58, r: -20 },
                ];
                const p = positions[i];
                return (
                  <g key={i} transform={`translate(${p.x}, ${p.y}) rotate(${p.r})`}>
                    <ellipse cx="10" cy="4" rx="12" ry="5" fill="#8B4513" />
                    <rect x="-2" y="-1" width="24" height="10" rx="2" fill="#8B4513" />
                    <ellipse cx="10" cy="4" rx="10" ry="4" fill="#654321" />
                    <ellipse cx="-2" cy="4" rx="5" ry="5" fill="#D2691E" />
                  </g>
                );
              })}
            </svg>
          </div>
          <h1 className="text-2xl font-black text-[#062c24] uppercase mb-2">Thank You! 🔥</h1>
          <p className="text-sm text-slate-500 mb-2">Your {rating}-log review has been submitted.</p>
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
    <div className="min-h-screen bg-[#f0f2f1] py-8 px-4" style={{ fontFamily: "'Inter', sans-serif" }}>
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

        {/* Rating Card */}
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100">
          {/* Firewood Rating */}
          <div className="mb-8">
            <FirewoodRatingInput value={rating} onChange={setRating} />
          </div>

          {/* Display Name */}
          <div className="mb-4">
            <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block">Display Name (Optional)</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="How should we call you?"
              className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm font-medium outline-none focus:border-emerald-500"
            />
          </div>

          {/* Comment */}
          <div className="mb-6">
            <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block">Your Review (Optional)</label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Tell others about your experience..."
              rows={4}
              className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm font-medium outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={rating === 0 || submitting}
            className={`w-full py-4 rounded-xl font-black uppercase text-sm tracking-wider shadow-lg transition-all ${
              rating > 0 && !submitting
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 active:scale-95"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <i className="fas fa-spinner fa-spin"></i> Submitting...
              </span>
            ) : rating === 0 ? (
              "Select a Rating to Continue"
            ) : (
              <span className="flex items-center justify-center gap-2">
                <i className="fas fa-fire"></i> Submit {rating}-Log Review
              </span>
            )}
          </button>

          {/* Verified Badge */}
          <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-slate-400">
            <i className="fas fa-shield-check text-emerald-500"></i>
            <span>Verified Purchase Review</span>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-slate-400 mt-6">
          By submitting, you agree that your review may be displayed publicly.
        </p>
      </div>
    </div>
  );
}