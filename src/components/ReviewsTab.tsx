"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection, query, where, onSnapshot, orderBy, doc, updateDoc, serverTimestamp,
} from "firebase/firestore";

type Review = {
  id: string;
  customerName: string;
  customerPhone?: string;
  rating: number;
  ratings?: Record<string, number>;
  comment?: string | null;
  status: "published" | "hidden";
  isVerified?: boolean;
  createdAt: any;
  vendorReply?: string;
  vendorRepliedAt?: any;
  orderId?: string;
};

const CATEGORIES = [
  { key: "gearCondition", label: "Gear", icon: "fa-campground" },
  { key: "communication", label: "Comms", icon: "fa-comments" },
  { key: "value", label: "Value", icon: "fa-coins" },
  { key: "convenience", label: "Pickup", icon: "fa-truck-pickup" },
  { key: "overall", label: "Overall", icon: "fa-heart" },
];

type Filter = "all" | "published" | "hidden" | "unreplied";

export default function ReviewsTab({ vendorId }: { vendorId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "reviews"), where("vendorId", "==", vendorId), orderBy("createdAt", "desc")),
      (snap) => setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() } as Review)))
    );
    return () => unsub();
  }, [vendorId]);

  const filtered = reviews.filter(r => {
    if (filter === "published") return r.status === "published";
    if (filter === "hidden") return r.status === "hidden";
    if (filter === "unreplied") return !r.vendorReply;
    return true;
  });

  const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const publishedCount = reviews.filter(r => r.status === "published").length;
  const hiddenCount = reviews.filter(r => r.status === "hidden").length;
  const unrepliedCount = reviews.filter(r => !r.vendorReply).length;

  async function toggleStatus(review: Review) {
    const newStatus = review.status === "published" ? "hidden" : "published";
    try {
      await updateDoc(doc(db, "reviews", review.id), { status: newStatus });
    } catch (e) { console.error("Toggle status error:", e); }
  }

  async function saveReply(reviewId: string) {
    if (!replyText.trim()) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "reviews", reviewId), {
        vendorReply: replyText.trim(),
        vendorRepliedAt: serverTimestamp(),
      });
      setReplyingTo(null);
      setReplyText("");
    } catch (e) { console.error("Save reply error:", e); }
    finally { setSaving(false); }
  }

  async function deleteReply(reviewId: string) {
    if (!confirm("Remove your reply?")) return;
    try {
      await updateDoc(doc(db, "reviews", reviewId), {
        vendorReply: null,
        vendorRepliedAt: null,
      });
    } catch (e) { console.error("Delete reply error:", e); }
  }

  function formatDate(ts: any): string {
    if (!ts?.toDate) return "-";
    return ts.toDate().toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
  }

  function openWhatsApp(phone?: string) {
    if (!phone) return;
    const clean = phone.replace(/[\s\-\+\(\)]/g, "");
    window.open(`https://wa.me/${clean}`, "_blank");
  }

  return (
    <div className="space-y-6 pb-20">

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-100 text-center">
          <p className="text-3xl font-black text-[#062c24]">{avgRating.toFixed(1)}</p>
          <div className="flex justify-center gap-0.5 my-1">
            {[1,2,3,4,5].map(s => (
              <i key={s} className={`fas fa-star text-[10px] ${s <= Math.round(avgRating) ? "text-amber-400" : "text-slate-200"}`}></i>
            ))}
          </div>
          <p className="text-[9px] font-bold text-slate-400 uppercase">Average Rating</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 text-center">
          <p className="text-3xl font-black text-[#062c24]">{reviews.length}</p>
          <p className="text-[9px] font-bold text-slate-400 uppercase mt-2">Total Reviews</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 text-center">
          <p className="text-3xl font-black text-emerald-600">{publishedCount}</p>
          <p className="text-[9px] font-bold text-slate-400 uppercase mt-2">Published</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 text-center">
          <p className="text-3xl font-black text-amber-600">{unrepliedCount}</p>
          <p className="text-[9px] font-bold text-slate-400 uppercase mt-2">Unreplied</p>
        </div>
      </div>

      {/* Category Averages */}
      {reviews.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-slate-100">
          <p className="text-[9px] font-black text-slate-400 uppercase mb-3">Performance by Category</p>
          <div className="space-y-2.5">
            {CATEGORIES.map(cat => {
              const rated = reviews.filter(r => r.ratings?.[cat.key]);
              const avg = rated.length > 0 ? rated.reduce((s, r) => s + (r.ratings?.[cat.key] || 0), 0) / rated.length : 0;
              return (
                <div key={cat.key} className="flex items-center gap-3">
                  <i className={`fas ${cat.icon} text-[10px] text-slate-400 w-4 text-center`}></i>
                  <span className="text-[10px] font-bold text-slate-600 w-16">{cat.label}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div className={`h-full rounded-full ${avg >= 4 ? "bg-emerald-400" : avg >= 3 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${(avg / 5) * 100}%` }}></div>
                  </div>
                  <span className="text-[10px] font-black text-[#062c24] w-7 text-right">{avg.toFixed(1)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {([
          { id: "all" as Filter, label: "All", count: reviews.length },
          { id: "published" as Filter, label: "Published", count: publishedCount },
          { id: "hidden" as Filter, label: "Hidden", count: hiddenCount },
          { id: "unreplied" as Filter, label: "Unreplied", count: unrepliedCount },
        ]).map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase whitespace-nowrap shrink-0 transition-all ${
              filter === f.id ? "bg-[#062c24] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}>
            {f.label}
            {f.count > 0 && <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${filter === f.id ? "bg-white/20" : "bg-slate-200"}`}>{f.count}</span>}
          </button>
        ))}
      </div>

      {/* Review Cards */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
          <i className="fas fa-star text-slate-200 text-4xl mb-3"></i>
          <p className="text-sm font-bold text-slate-400">
            {filter === "all" ? "No reviews yet" : `No ${filter} reviews`}
          </p>
          <p className="text-[10px] text-slate-300 mt-1">
            {filter === "all" ? "Reviews will appear here when customers submit them" : "Try viewing all reviews"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(review => (
            <div key={review.id} className={`bg-white rounded-2xl border overflow-hidden transition-all ${
              review.status === "hidden" ? "border-red-100 opacity-70" : "border-slate-100"
            }`}>
              <div className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-black text-sm">
                      {(review.customerName || "C")[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#062c24]">
                        {review.customerName || "Camper"}
                        {review.isVerified && <i className="fas fa-check-circle text-emerald-500 text-[9px] ml-1.5"></i>}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex gap-0.5">
                          {[1,2,3,4,5].map(s => (
                            <i key={s} className={`fas fa-star text-[10px] ${s <= review.rating ? "text-amber-400" : "text-slate-200"}`}></i>
                          ))}
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">{review.rating.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[8px] text-slate-300 font-bold">{formatDate(review.createdAt)}</p>
                    <span className={`inline-block mt-1 text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${
                      review.status === "published" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
                    }`}>
                      {review.status}
                    </span>
                  </div>
                </div>

                {/* Category mini bars */}
                {review.ratings && (
                  <div className="flex gap-1.5 mb-3">
                    {CATEGORIES.map(cat => {
                      const val = review.ratings?.[cat.key] || 0;
                      return (
                        <div key={cat.key} className="flex-1 text-center">
                          <div className="bg-slate-100 rounded-md h-1.5 overflow-hidden mb-0.5">
                            <div className={`h-full rounded-md ${val >= 4 ? "bg-emerald-400" : val >= 3 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${(val / 5) * 100}%` }}></div>
                          </div>
                          <p className="text-[7px] font-bold text-slate-400">{cat.label}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Comment */}
                {review.comment && (
                  <p className="text-xs text-slate-600 leading-relaxed mb-3 bg-slate-50 p-3 rounded-xl">{review.comment}</p>
                )}

                {/* Vendor Reply */}
                {review.vendorReply && replyingTo !== review.id && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[9px] font-black text-emerald-700 uppercase"><i className="fas fa-reply mr-1"></i>Your Reply</p>
                      <div className="flex gap-2">
                        <button onClick={() => { setReplyingTo(review.id); setReplyText(review.vendorReply || ""); }}
                          className="text-[8px] font-bold text-emerald-600 hover:text-emerald-800">Edit</button>
                        <button onClick={() => deleteReply(review.id)}
                          className="text-[8px] font-bold text-red-400 hover:text-red-600">Remove</button>
                      </div>
                    </div>
                    <p className="text-xs text-emerald-800">{review.vendorReply}</p>
                    <p className="text-[8px] text-emerald-500 mt-1">{formatDate(review.vendorRepliedAt)}</p>
                  </div>
                )}

                {/* Reply Editor */}
                {replyingTo === review.id && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-2"><i className="fas fa-reply mr-1"></i>Write a Reply</p>
                    <textarea
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder="Thank you for your feedback..."
                      rows={3}
                      className="w-full bg-white border border-slate-200 p-3 rounded-xl text-xs outline-none focus:border-emerald-500 resize-none"
                    />
                    <div className="flex justify-end gap-2 mt-2">
                      <button onClick={() => { setReplyingTo(null); setReplyText(""); }}
                        className="px-4 py-2 rounded-lg text-[10px] font-black text-slate-500 bg-white border border-slate-200 hover:bg-slate-50">
                        Cancel
                      </button>
                      <button onClick={() => saveReply(review.id)} disabled={!replyText.trim() || saving}
                        className="px-4 py-2 rounded-lg text-[10px] font-black text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">
                        {saving ? "Saving..." : "Post Reply"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button onClick={() => toggleStatus(review)}
                    className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-1.5 transition-all ${
                      review.status === "published"
                        ? "bg-red-50 text-red-500 hover:bg-red-100 border border-red-100"
                        : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100"
                    }`}>
                    <i className={`fas ${review.status === "published" ? "fa-eye-slash" : "fa-eye"}`}></i>
                    {review.status === "published" ? "Hide" : "Publish"}
                  </button>
                  {!review.vendorReply && replyingTo !== review.id && (
                    <button onClick={() => { setReplyingTo(review.id); setReplyText(""); }}
                      className="flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100 flex items-center justify-center gap-1.5">
                      <i className="fas fa-reply"></i> Reply
                    </button>
                  )}
                  {review.customerPhone && (
                    <button onClick={() => openWhatsApp(review.customerPhone)}
                      className="py-2.5 px-4 rounded-xl text-[9px] font-black uppercase bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100 flex items-center justify-center gap-1.5">
                      <i className="fab fa-whatsapp"></i> Follow Up
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}