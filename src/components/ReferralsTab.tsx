"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, getDoc,
} from "firebase/firestore";

// ============ TYPES ============
type CustomerReferral = {
  id: string;
  code: string;
  assignedTo: { name: string; phone: string };
  discountType: "percent" | "fixed";
  discountValue: number;
  maxUses: number | null;
  usedCount: number;
  usedBy: { phone: string; name?: string; date: any; orderId?: string }[];
  expiresAt: any | null;
  isActive: boolean;
  createdAt: any;
};

type ReferralsTabProps = {
  vendorId: string;
  vendorName: string;
};

// ============ MAIN COMPONENT ============
export default function ReferralsTab({ vendorId, vendorName }: ReferralsTabProps) {
  const [activeSection, setActiveSection] = useState<"customer" | "vendor">("customer");
  
  // Customer referrals state
  const [referrals, setReferrals] = useState<CustomerReferral[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingReferral, setEditingReferral] = useState<CustomerReferral | null>(null);
  
  // Form state
  const [code, setCode] = useState("");
  const [assignedName, setAssignedName] = useState("");
  const [assignedPhone, setAssignedPhone] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [saving, setSaving] = useState(false);

  // Vendor referral state
  const [myReferralCode, setMyReferralCode] = useState<string | null>(null);
  const [referralStats, setReferralStats] = useState({ referred: 0, creditsEarned: 0 });
  const [copiedCode, setCopiedCode] = useState(false);

  // Load customer referrals
  useEffect(() => {
    const q = query(
      collection(db, "vendors", vendorId, "referrals"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setReferrals(snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomerReferral)));
      setLoading(false);
    });

    return () => unsub();
  }, [vendorId]);

  // Load/generate vendor referral code
  useEffect(() => {
    async function loadVendorReferral() {
      const vendorDoc = await getDoc(doc(db, "vendors", vendorId));
      if (vendorDoc.exists()) {
        const data = vendorDoc.data();
        if (data.myReferralCode) {
          setMyReferralCode(data.myReferralCode);
        } else {
          const newCode = `VEN-${vendorId.substring(0, 6).toUpperCase()}`;
          await updateDoc(doc(db, "vendors", vendorId), { myReferralCode: newCode });
          setMyReferralCode(newCode);
        }
      }
    }
    loadVendorReferral();
  }, [vendorId]);

  function resetForm() {
    setCode("");
    setAssignedName("");
    setAssignedPhone("");
    setDiscountType("percent");
    setDiscountValue("");
    setMaxUses("");
    setEditingReferral(null);
  }

  function generateCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCode(result);
  }

  function openNewReferral() {
    resetForm();
    generateCode();
    setShowModal(true);
  }

  function openEditReferral(ref: CustomerReferral) {
    setEditingReferral(ref);
    setCode(ref.code);
    setAssignedName(ref.assignedTo.name);
    setAssignedPhone(ref.assignedTo.phone);
    setDiscountType(ref.discountType);
    setDiscountValue(String(ref.discountValue));
    setMaxUses(ref.maxUses ? String(ref.maxUses) : "");
    setShowModal(true);
  }

  async function saveReferral() {
    if (!code.trim() || !assignedName.trim() || !discountValue) return;
    setSaving(true);

    try {
      const data = {
        code: code.trim().toUpperCase(),
        assignedTo: { name: assignedName.trim(), phone: assignedPhone.trim() },
        discountType,
        discountValue: Number(discountValue),
        maxUses: maxUses ? Number(maxUses) : null,
        isActive: true,
      };

      if (editingReferral) {
        await updateDoc(doc(db, "vendors", vendorId, "referrals", editingReferral.id), data);
      } else {
        await addDoc(collection(db, "vendors", vendorId, "referrals"), {
          ...data,
          usedCount: 0,
          usedBy: [],
          expiresAt: null,
          createdAt: serverTimestamp(),
        });
      }

      setShowModal(false);
      resetForm();
    } catch (e) {
      console.error(e);
      alert("Failed to save referral code");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(ref: CustomerReferral) {
    try {
      await updateDoc(doc(db, "vendors", vendorId, "referrals", ref.id), {
        isActive: !ref.isActive,
      });
    } catch (e) {
      console.error(e);
    }
  }

  async function deleteReferral(id: string) {
    if (!confirm("Delete this referral code?")) return;
    try {
      await deleteDoc(doc(db, "vendors", vendorId, "referrals", id));
    } catch (e) {
      console.error(e);
    }
  }

  function copyVendorCode() {
    if (myReferralCode) {
      navigator.clipboard.writeText(myReferralCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  }

  function shareVendorCode() {
    const message = `Join Pacak Khemah as a vendor! Use my referral code: ${myReferralCode}\n\nSign up at: https://pacakkhemah.com/register?ref=${myReferralCode}`;
    if (navigator.share) {
      navigator.share({ title: "Join Pacak Khemah", text: message });
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
    }
  }

  const totalUsed = referrals.reduce((sum, r) => sum + r.usedCount, 0);

  return (
    <div className="space-y-6">
      {/* Section Tabs */}
      <div className="flex bg-white rounded-xl p-1 border border-slate-100">
        <button
          onClick={() => setActiveSection("customer")}
          className={`flex-1 py-3 rounded-lg text-xs font-black uppercase transition-all ${
            activeSection === "customer" ? "bg-[#062c24] text-white" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <i className="fas fa-users mr-2"></i>Customer Referrals
        </button>
        <button
          onClick={() => setActiveSection("vendor")}
          className={`flex-1 py-3 rounded-lg text-xs font-black uppercase transition-all ${
            activeSection === "vendor" ? "bg-[#062c24] text-white" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <i className="fas fa-store mr-2"></i>Vendor Referral
        </button>
      </div>

      {/* CUSTOMER REFERRALS SECTION */}
      {activeSection === "customer" && (
        <>
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-black text-[#062c24] uppercase">Customer Referral Codes</h2>
                <p className="text-xs text-slate-400 mt-1">Create promo codes for customers to share</p>
              </div>
              <button
                onClick={openNewReferral}
                className="flex items-center gap-2 bg-[#062c24] text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-800 transition-colors"
              >
                <i className="fas fa-plus"></i>New Code
              </button>
            </div>

            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
                  <i className="fas fa-gift text-emerald-600 text-sm"></i>
                </div>
                <div className="text-xs text-emerald-700">
                  <p className="font-bold mb-1">How Customer Referrals Work</p>
                  <ul className="space-y-1 text-emerald-600">
                    <li>• Create a unique code and assign it to a customer</li>
                    <li>• When someone uses the code, they get a discount</li>
                    <li>• Track which codes are used and by whom</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl p-4 border border-slate-100 text-center">
              <p className="text-2xl font-black text-[#062c24]">{referrals.length}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Total Codes</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-100 text-center">
              <p className="text-2xl font-black text-emerald-600">{totalUsed}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Times Used</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-100 text-center">
              <p className="text-2xl font-black text-blue-600">{referrals.filter(r => r.isActive).length}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Active</p>
            </div>
          </div>

          {/* Referrals List */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <h3 className="text-sm font-black text-[#062c24] uppercase mb-4">Your Codes</h3>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-slate-50 rounded-xl p-4 animate-pulse">
                    <div className="h-4 bg-slate-200 rounded w-1/4 mb-2"></div>
                    <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : referrals.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-xl">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-ticket-alt text-slate-300 text-2xl"></i>
                </div>
                <p className="text-sm font-bold text-slate-400">No referral codes yet</p>
                <p className="text-xs text-slate-300 mt-1 mb-4">Create codes to let customers share discounts</p>
                <button onClick={openNewReferral} className="text-xs font-bold text-emerald-600 hover:text-emerald-700">
                  <i className="fas fa-plus mr-1"></i> Create First Code
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {referrals.map(ref => (
                  <div key={ref.id} className={`rounded-xl border p-4 transition-all ${ref.isActive ? "bg-white border-slate-200" : "bg-slate-50 border-slate-100 opacity-60"}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg font-black text-[#062c24] tracking-wider">{ref.code}</span>
                          {!ref.isActive && <span className="text-[8px] font-bold bg-slate-200 text-slate-500 px-2 py-0.5 rounded uppercase">Disabled</span>}
                        </div>
                        <p className="text-xs text-slate-500">
                          Assigned to: <span className="font-bold">{ref.assignedTo.name}</span>
                          {ref.assignedTo.phone && ` (${ref.assignedTo.phone})`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-emerald-600">
                          {ref.discountType === "percent" ? `${ref.discountValue}%` : `RM${ref.discountValue}`}
                        </p>
                        <p className="text-[9px] text-slate-400">OFF</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-[10px] text-slate-400">
                        <i className="fas fa-check-circle text-emerald-500 mr-1"></i>
                        Used {ref.usedCount} {ref.maxUses ? `/ ${ref.maxUses}` : ""} times
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => toggleActive(ref)} className={`p-2 rounded-lg text-xs transition-colors ${ref.isActive ? "text-amber-500 hover:bg-amber-50" : "text-emerald-500 hover:bg-emerald-50"}`}>
                          <i className={`fas ${ref.isActive ? "fa-pause" : "fa-play"}`}></i>
                        </button>
                        <button onClick={() => openEditReferral(ref)} className="p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 text-xs">
                          <i className="fas fa-pen"></i>
                        </button>
                        <button onClick={() => deleteReferral(ref.id)} className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 text-xs">
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* VENDOR REFERRAL SECTION */}
      {activeSection === "vendor" && (
        <>
          <div className="bg-gradient-to-br from-[#062c24] to-emerald-800 rounded-2xl p-6 text-white">
            <div className="text-center mb-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300 mb-2">Your Vendor Referral Code</p>
              <div className="bg-white/10 backdrop-blur rounded-xl px-6 py-4 inline-block">
                <p className="text-3xl font-black tracking-[0.2em]">{myReferralCode || "..."}</p>
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <button onClick={copyVendorCode} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${copiedCode ? "bg-emerald-400 text-white" : "bg-white/20 hover:bg-white/30"}`}>
                <i className={`fas ${copiedCode ? "fa-check" : "fa-copy"} mr-2`}></i>
                {copiedCode ? "Copied!" : "Copy Code"}
              </button>
              <button onClick={shareVendorCode} className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase bg-emerald-500 hover:bg-emerald-400 transition-all">
                <i className="fas fa-share mr-2"></i>Share
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <h3 className="text-sm font-black text-[#062c24] uppercase mb-4 flex items-center gap-2">
              <i className="fas fa-info-circle text-blue-500"></i>How Vendor Referrals Work
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 text-sm font-black">1</div>
                <p className="text-xs font-bold text-slate-700">Share Your Code</p>
                <p className="text-[10px] text-slate-400 mt-1">Share with friends who want to become vendors</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 text-sm font-black">2</div>
                <p className="text-xs font-bold text-slate-700">They Sign Up</p>
                <p className="text-[10px] text-slate-400 mt-1">They enter your code during registration</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3 text-sm font-black">3</div>
                <p className="text-xs font-bold text-slate-700">Earn Credits</p>
                <p className="text-[10px] text-slate-400 mt-1">Get bonus credits when they're approved</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center">
              <p className="text-3xl font-black text-[#062c24]">{referralStats.referred}</p>
              <p className="text-xs font-bold text-slate-400 uppercase mt-1">Vendors Referred</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center">
              <p className="text-3xl font-black text-emerald-600">{referralStats.creditsEarned}</p>
              <p className="text-xs font-bold text-slate-400 uppercase mt-1">Credits Earned</p>
            </div>
          </div>
        </>
      )}

      {/* CREATE/EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-base font-black text-[#062c24] uppercase">
                {editingReferral ? "Edit Referral Code" : "New Referral Code"}
              </h3>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="w-9 h-9 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase mb-1.5 block">Referral Code *</label>
                <div className="flex gap-2">
                  <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. AHMAD10" maxLength={12}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold uppercase tracking-wider outline-none focus:border-emerald-300" />
                  <button type="button" onClick={generateCode} className="px-3 bg-slate-100 rounded-xl text-slate-500 hover:bg-slate-200">
                    <i className="fas fa-random"></i>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase mb-1.5 block">Customer Name *</label>
                  <input value={assignedName} onChange={(e) => setAssignedName(e.target.value)} placeholder="e.g. Ahmad"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-emerald-300" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase mb-1.5 block">Phone (Optional)</label>
                  <input value={assignedPhone} onChange={(e) => setAssignedPhone(e.target.value)} placeholder="e.g. 60123456789"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-emerald-300" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase mb-1.5 block">Discount Type</label>
                  <select value={discountType} onChange={(e) => setDiscountType(e.target.value as "percent" | "fixed")}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-emerald-300">
                    <option value="percent">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (RM)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase mb-1.5 block">Discount Value *</label>
                  <input type="number" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder={discountType === "percent" ? "e.g. 10" : "e.g. 20"}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-emerald-300" />
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase mb-1.5 block">Max Uses (Leave blank for unlimited)</label>
                <input type="number" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="e.g. 10"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-emerald-300" />
              </div>
            </div>

            <div className="p-5 border-t border-slate-100">
              <button onClick={saveReferral} disabled={!code.trim() || !assignedName.trim() || !discountValue || saving}
                className="w-full bg-[#062c24] text-white py-3.5 rounded-xl text-xs font-black uppercase disabled:opacity-50 hover:bg-emerald-800 transition-colors">
                {saving ? <><i className="fas fa-spinner fa-spin mr-2"></i>Saving...</> : editingReferral ? "Update Code" : "Create Code"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}