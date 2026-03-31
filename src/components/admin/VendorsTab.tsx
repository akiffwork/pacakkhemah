"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, updateDoc, increment, arrayUnion, arrayRemove, collection, query, where, getDocs, getDoc } from "firebase/firestore";

type Badge = "verified" | "id_verified" | "top_rated" | "fast_responder" | "premium";

type Vendor = { 
  id: string; 
  name: string; 
  email?: string; 
  phone?: string; 
  status?: string; 
  credits?: number; 
  slug?: string;
  badges?: Badge[];
  total_orders?: number;
  rating?: number;
  avg_response_time?: number;
  is_mockup?: boolean;
  referredBy?: string;
  referralRewarded?: boolean;
};

// Badge configuration
const BADGE_CONFIG: Record<Badge, { label: string; icon: string; bg: string; text: string; type: "auto" | "manual" }> = {
  verified: { label: "Verified", icon: "fa-check-circle", bg: "bg-emerald-50", text: "text-emerald-600", type: "auto" },
  id_verified: { label: "ID Verified", icon: "fa-id-card", bg: "bg-teal-50", text: "text-teal-600", type: "manual" },
  top_rated: { label: "Top Rated", icon: "fa-star", bg: "bg-amber-50", text: "text-amber-600", type: "auto" },
  fast_responder: { label: "Fast Responder", icon: "fa-bolt", bg: "bg-blue-50", text: "text-blue-600", type: "auto" },
  premium: { label: "Premium", icon: "fa-trophy", bg: "bg-purple-50", text: "text-purple-600", type: "manual" },
};

const MANUAL_BADGES: Badge[] = ["id_verified", "premium"];

export default function VendorsTab({ allVendors }: { allVendors: Vendor[] }) {
  const [search, setSearch] = useState("");
  const [badgeModalVendor, setBadgeModalVendor] = useState<Vendor | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "premium" | "mockup">("all");
  const [referralReward, setReferralReward] = useState(5);
  const [rewardingId, setRewardingId] = useState<string | null>(null);

  // Load referral reward setting
  useEffect(() => {
    getDoc(doc(db, "settings", "referral_config")).then(snap => {
      if (snap.exists() && snap.data().rewardCredits) {
        setReferralReward(snap.data().rewardCredits);
      }
    }).catch(() => {});
  }, []);

  // Count pending for badge
  const pendingCount = allVendors.filter(v => v.status === "pending").length;

  // Filter vendors (now shows ALL vendors, not just approved)
  const filtered = allVendors.filter(v => {
    const matchSearch = !search ||
      v.name?.toLowerCase().includes(search.toLowerCase()) ||
      v.email?.toLowerCase().includes(search.toLowerCase()) ||
      v.phone?.includes(search);
    
    if (filter === "pending") return matchSearch && v.status === "pending";
    if (filter === "premium") return matchSearch && v.badges?.includes("premium");
    if (filter === "mockup") return matchSearch && v.is_mockup === true;
    return matchSearch;
  });

  async function manualTopUp(id: string, name: string) {
    const amt = prompt(`Add credits for ${name}:`, "10");
    if (amt && !isNaN(Number(amt))) {
      await updateDoc(doc(db, "vendors", id), { credits: increment(Number(amt)) });
    }
  }

  async function suspendVendor(id: string) {
    if (confirm("Suspend this vendor?"))
      await updateDoc(doc(db, "vendors", id), { status: "pending" });
  }

  async function approveVendor(id: string) {
    if (!confirm("Approve this vendor?")) return;
    await updateDoc(doc(db, "vendors", id), { status: "approved" });
    
    // Auto-reward referrer
    const vendor = allVendors.find(v => v.id === id);
    if (vendor?.referredBy && !vendor.referralRewarded) {
      await rewardReferrer(id, vendor.referredBy);
    }
  }

  async function rewardReferrer(vendorId: string, refCode: string) {
    setRewardingId(vendorId);
    try {
      // Find referrer vendor by their myReferralCode
      const snap = await getDocs(query(collection(db, "vendors"), where("myReferralCode", "==", refCode)));
      if (!snap.empty) {
        const referrerId = snap.docs[0].id;
        const referrerName = snap.docs[0].data().name || "Vendor";
        
        // Add credits to referrer
        await updateDoc(doc(db, "vendors", referrerId), {
          credits: increment(referralReward),
          referral_total_referred: increment(1),
          referral_total_credits: increment(referralReward),
        });

        // Mark as rewarded on the referred vendor
        await updateDoc(doc(db, "vendors", vendorId), {
          referralRewarded: true,
          referralRewardedAt: new Date().toISOString(),
        });

        alert(`Rewarded ${referrerName} with ${referralReward} credits for referral!`);
      } else {
        alert(`Referral code "${refCode}" not found. No reward given.`);
        // Still mark as processed so it doesn't retry
        await updateDoc(doc(db, "vendors", vendorId), { referralRewarded: true });
      }
    } catch (e) {
      console.error("Referral reward error:", e);
      alert("Failed to process referral reward.");
    } finally {
      setRewardingId(null);
    }
  }

  async function toggleBadge(vendorId: string, badge: Badge, currentlyHas: boolean) {
    if (currentlyHas) {
      await updateDoc(doc(db, "vendors", vendorId), { badges: arrayRemove(badge) });
    } else {
      await updateDoc(doc(db, "vendors", vendorId), { badges: arrayUnion(badge) });
    }
  }

  async function toggleMockup(vendorId: string, currentlyMockup: boolean) {
    await updateDoc(doc(db, "vendors", vendorId), { is_mockup: !currentlyMockup });
  }

  // Calculate auto badges for display
  function getAutoBadges(v: Vendor): Badge[] {
    const badges: Badge[] = [];
    if (v.status === "approved") badges.push("verified");
    if ((v.total_orders || 0) >= 30 && (v.rating || 0) >= 4.7) badges.push("top_rated");
    if ((v.avg_response_time || 999) <= 120) badges.push("fast_responder");
    return badges;
  }

  function getAllBadges(v: Vendor): Badge[] {
    return [...new Set([...getAutoBadges(v), ...(v.badges || [])])];
  }

  return (
    <div className="space-y-6">
      {/* Search + Filter Bar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm gap-4">
        <div className="relative w-full lg:w-96">
          <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email or phone..."
            className="w-full bg-slate-50 border border-slate-100 pl-10 pr-4 py-3 rounded-xl text-xs font-bold outline-none focus:border-emerald-500 transition-all" />
        </div>
        <div className="flex items-center gap-3">
          {/* Filter Pills */}
          <div className="flex bg-slate-100 rounded-lg p-1">
            {([
              { id: "all" as const, label: "All" },
              { id: "pending" as const, label: "Pending", icon: "fa-clock", count: pendingCount },
              { id: "premium" as const, label: "Premium", icon: "fa-trophy" },
              { id: "mockup" as const, label: "Mock-up", icon: "fa-flask" },
            ]).map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase transition-all flex items-center gap-1.5 ${
                  filter === f.id 
                    ? f.id === "pending" && f.count && f.count > 0
                      ? "bg-amber-500 text-white shadow-sm" 
                      : "bg-white text-[#062c24] shadow-sm" 
                    : f.id === "pending" && f.count && f.count > 0
                      ? "text-amber-600 bg-amber-50"
                      : "text-slate-400 hover:text-slate-600"
                }`}>
                {f.icon && <i className={`fas ${f.icon} text-[8px]`}></i>}
                {f.label}
                {f.count !== undefined && f.count > 0 && (
                  <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[8px] ${filter === f.id ? "bg-white/30" : "bg-amber-500 text-white"}`}>
                    {f.count}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{filtered.length} Partners</span>
          </div>
        </div>
      </div>

      {/* Vendor Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-wider">
              <tr>
                <th className="p-5 pl-8">Vendor</th>
                <th className="p-5">Status / Badges</th>
                <th className="p-5">Contact</th>
                <th className="p-5">Credits</th>
                <th className="p-5">Shop</th>
                <th className="p-5 text-right pr-8">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs font-bold text-slate-600">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-10 text-center text-slate-300 text-[10px] uppercase font-black">No vendors found</td></tr>
              ) : filtered.map(v => {
                const allBadges = getAllBadges(v);
                const isPending = v.status === "pending";
                return (
                  <tr key={v.id} className={`hover:bg-slate-50 transition-colors ${isPending ? "bg-amber-50/30" : ""}`}>
                    <td className="p-5 pl-8">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 relative ${isPending ? "bg-amber-500 text-white" : "bg-[#062c24] text-white"}`}>
                          {v.name?.[0]?.toUpperCase()}
                          {v.is_mockup && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                              <i className="fas fa-flask text-white text-[6px]"></i>
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-black uppercase text-[#062c24] text-[11px] flex items-center gap-1.5">
                            {v.name}
                            {v.is_mockup && <span className="text-[8px] text-purple-500 font-bold normal-case">(Demo)</span>}
                          </p>
                          <p className="text-[9px] text-slate-400 font-medium">{v.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-5">
                      <div className="flex items-center gap-1 flex-wrap">
                        {/* Show Pending badge prominently */}
                        {isPending && (
                          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full text-[8px] font-black border border-amber-200">
                            <i className="fas fa-clock"></i>
                            Pending Approval
                          </span>
                        )}
                        {/* Referral badge */}
                        {v.referredBy && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-bold border ${v.referralRewarded ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-purple-50 text-purple-600 border-purple-200"}`}>
                            <i className={`fas ${v.referralRewarded ? "fa-check-circle" : "fa-gift"}`}></i>
                            Ref: {v.referredBy}
                            {v.referralRewarded && <span className="opacity-60">(Rewarded)</span>}
                          </span>
                        )}
                        {/* Show other badges */}
                        {!isPending && allBadges.length > 0 ? (
                          allBadges.map(badge => {
                            const config = BADGE_CONFIG[badge];
                            return (
                              <span key={badge} className={`inline-flex items-center gap-1 ${config.bg} ${config.text} px-2 py-0.5 rounded-full text-[8px] font-bold`}>
                                <i className={`fas ${config.icon}`}></i>
                                {config.label}
                              </span>
                            );
                          })
                        ) : !isPending && (
                          <span className="text-[9px] text-slate-300">No badges</span>
                        )}
                      </div>
                    </td>
                    <td className="p-5">
                      <p className="text-[10px] font-bold text-slate-600">{v.phone || "—"}</p>
                    </td>
                    <td className="p-5">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-black ${(v.credits || 0) > 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {v.credits || 0}
                        </span>
                        <span className="text-[9px] text-slate-300 font-medium">credits</span>
                      </div>
                    </td>
                    <td className="p-5">
                      {v.slug ? (
                        <a href={`/shop/${v.slug}`} target="_blank"
                          className="text-[9px] font-bold text-emerald-600 hover:underline flex items-center gap-1">
                          <i className="fas fa-external-link-alt text-[8px]"></i> /shop/{v.slug}
                        </a>
                      ) : <span className="text-[9px] text-slate-300">No slug</span>}
                    </td>
                    <td className="p-5 text-right pr-8">
                      <div className="flex justify-end gap-2">
                        {/* Approve Button (for pending vendors) */}
                        {isPending && (
                          <button onClick={() => approveVendor(v.id)}
                            className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-all shadow-sm" title="Approve Vendor">
                            <i className="fas fa-check text-[10px]"></i>
                          </button>
                        )}
                        {/* Manual Referral Reward Button */}
                        {v.referredBy && !v.referralRewarded && !isPending && (
                          <button onClick={() => rewardReferrer(v.id, v.referredBy!)}
                            disabled={rewardingId === v.id}
                            className="w-8 h-8 rounded-lg bg-purple-50 text-purple-500 flex items-center justify-center hover:bg-purple-500 hover:text-white transition-all disabled:opacity-50" title={`Reward referrer (${referralReward} credits)`}>
                            <i className={`fas ${rewardingId === v.id ? "fa-spinner fa-spin" : "fa-gift"} text-[10px]`}></i>
                          </button>
                        )}
                        {/* Badge Manager Button */}
                        <button onClick={() => setBadgeModalVendor(v)}
                          className="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center hover:bg-amber-500 hover:text-white transition-all" title="Manage Badges">
                          <i className="fas fa-award text-[10px]"></i>
                        </button>
                        <a href={`/store?admin_override=${v.id}`} target="_blank"
                          className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-all" title="View as Vendor">
                          <i className="fas fa-key text-[10px]"></i>
                        </a>
                        <button onClick={() => manualTopUp(v.id, v.name)}
                          className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all" title="Add Credits">
                          <i className="fas fa-plus text-[10px]"></i>
                        </button>
                        {!isPending ? (
                          <button onClick={() => suspendVendor(v.id)}
                            className="w-8 h-8 rounded-lg bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all" title="Suspend">
                            <i className="fas fa-ban text-[10px]"></i>
                          </button>
                        ) : (
                          <button onClick={() => { if(confirm("Reject and delete this vendor?")) { /* delete logic */ } }}
                            className="w-8 h-8 rounded-lg bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all" title="Reject">
                            <i className="fas fa-times text-[10px]"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Badge Management Modal */}
      {badgeModalVendor && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center font-black text-xl">
                    {badgeModalVendor.name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-black uppercase text-lg">{badgeModalVendor.name}</h3>
                    <p className="text-white/70 text-[10px] font-medium">{badgeModalVendor.email}</p>
                  </div>
                </div>
                <button onClick={() => setBadgeModalVendor(null)} className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Auto Badges (Read Only) */}
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                  <i className="fas fa-robot mr-1"></i> Auto Badges (System Calculated)
                </p>
                <div className="space-y-2">
                  {(["verified", "top_rated", "fast_responder"] as Badge[]).map(badge => {
                    const config = BADGE_CONFIG[badge];
                    const hasIt = getAutoBadges(badgeModalVendor).includes(badge);
                    return (
                      <div key={badge} className={`flex items-center justify-between p-3 rounded-xl border ${hasIt ? `${config.bg} ${config.text} border-current/20` : "bg-slate-50 border-slate-100 text-slate-300"}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${hasIt ? "bg-white/50" : "bg-slate-100"}`}>
                            <i className={`fas ${config.icon}`}></i>
                          </div>
                          <div>
                            <p className="text-xs font-black">{config.label}</p>
                            <p className="text-[9px] opacity-70">
                              {badge === "verified" && "Approved vendor status"}
                              {badge === "top_rated" && "30+ orders, 4.7+ rating"}
                              {badge === "fast_responder" && "Avg reply ≤ 2 hours"}
                            </p>
                          </div>
                        </div>
                        {hasIt ? (
                          <span className="text-[9px] font-black uppercase bg-white/50 px-2 py-1 rounded-full">Active</span>
                        ) : (
                          <span className="text-[9px] font-bold uppercase">Not Earned</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Manual Badges (Admin Can Toggle) */}
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                  <i className="fas fa-hand-pointer mr-1"></i> Manual Badges (Admin Assigned)
                </p>
                <div className="space-y-2">
                  {MANUAL_BADGES.map(badge => {
                    const config = BADGE_CONFIG[badge];
                    const hasIt = badgeModalVendor.badges?.includes(badge) || false;
                    return (
                      <div key={badge} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${hasIt ? `${config.bg} ${config.text} border-current/20` : "bg-slate-50 border-slate-100"}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${hasIt ? "bg-white/50" : "bg-slate-100"} ${hasIt ? config.text : "text-slate-400"}`}>
                            <i className={`fas ${config.icon}`}></i>
                          </div>
                          <div>
                            <p className={`text-xs font-black ${hasIt ? "" : "text-slate-600"}`}>{config.label}</p>
                            <p className="text-[9px] text-slate-400">
                              {badge === "id_verified" && "IC/SSM document verified"}
                              {badge === "premium" && "Premium partner status"}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={() => toggleBadge(badgeModalVendor.id, badge, hasIt)}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${hasIt ? "bg-red-100 text-red-500 hover:bg-red-500 hover:text-white" : "bg-emerald-100 text-emerald-600 hover:bg-emerald-500 hover:text-white"}`}>
                          {hasIt ? "Remove" : "Assign"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Mock-up Toggle */}
              <div className="border-t border-slate-100 pt-6">
                <div className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${badgeModalVendor.is_mockup ? "bg-purple-50 border-purple-200" : "bg-slate-50 border-slate-100"}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${badgeModalVendor.is_mockup ? "bg-purple-500 text-white" : "bg-slate-200 text-slate-400"}`}>
                      <i className="fas fa-flask"></i>
                    </div>
                    <div>
                      <p className="text-sm font-black text-[#062c24]">Demo Shop Mode</p>
                      <p className="text-[10px] text-slate-400">Enable mock-up shop for sales demos</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => toggleMockup(badgeModalVendor.id, badgeModalVendor.is_mockup || false)}
                    className={`relative w-14 h-7 rounded-full transition-all ${badgeModalVendor.is_mockup ? "bg-purple-500" : "bg-slate-200"}`}>
                    <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all ${badgeModalVendor.is_mockup ? "left-8" : "left-1"}`}></span>
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 p-4 bg-slate-50">
              <button onClick={() => setBadgeModalVendor(null)} className="w-full bg-[#062c24] text-white py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-emerald-800 transition-all">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}