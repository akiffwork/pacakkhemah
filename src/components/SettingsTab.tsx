"use client";

import { useState } from "react";
import { db, auth } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import {
  sendPasswordResetEmail,
} from "firebase/auth";

type SettingsTabProps = {
  vendorId: string;
  vendorData: {
    name?: string; phone?: string; slug?: string; city?: string;
    areas?: string[]; pickup?: string[];
    security_deposit?: number; security_deposit_type?: string;
    is_vacation?: boolean; allow_stacking?: boolean; rules?: string[];
  };
};

const inputCls = "w-full bg-slate-50 border border-slate-200 p-3.5 rounded-[0.85rem] text-sm font-semibold outline-none focus:border-emerald-500 focus:bg-white transition-all";

export default function SettingsTab({ vendorId, vendorData }: SettingsTabProps) {
  // Account fields
  const [name, setName] = useState(vendorData.name || "");
  const [phone, setPhone] = useState(vendorData.phone || "");
  const [slug, setSlug] = useState(vendorData.slug || "");

  // Logistics fields
  const [city, setCity] = useState(vendorData.city || "");
  const [areas, setAreas] = useState((vendorData.areas || []).join(", "));
  const [hubs, setHubs] = useState((vendorData.pickup || []).join(", "));
  const [depositVal, setDepositVal] = useState(String(vendorData.security_deposit || 50));
  const [depositType, setDepositType] = useState(vendorData.security_deposit_type || "fixed");
  const [isVacation, setIsVacation] = useState(vendorData.is_vacation || false);
  const [allowStacking, setAllowStacking] = useState(vendorData.allow_stacking || false);
  const [rules, setRules] = useState<string[]>(vendorData.rules || []);

  // Save states
  const [savedAccount, setSavedAccount] = useState(false);
  const [savedLogistics, setSavedLogistics] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function saveAccount() {
    if (!name || !phone) return alert("Shop Name and Phone are required.");
    const cleanSlug = slug.trim().toLowerCase().replace(/ /g, "-");
    await updateDoc(doc(db, "vendors", vendorId), {
      name, phone, slug: cleanSlug,
    });
    setSavedAccount(true);
    setTimeout(() => setSavedAccount(false), 2000);
  }

  async function saveLogistics() {
    await updateDoc(doc(db, "vendors", vendorId), {
      city,
      areas: areas.split(",").map(s => s.trim()).filter(Boolean),
      pickup: hubs.split(",").map(s => s.trim()).filter(Boolean),
      security_deposit: Number(depositVal),
      security_deposit_type: depositType,
      rules: rules.filter(Boolean),
      is_vacation: isVacation,
      allow_stacking: allowStacking,
    });
    setSavedLogistics(true);
    setTimeout(() => setSavedLogistics(false), 2000);
  }

  async function sendPasswordReset() {
    const email = auth.currentUser?.email;
    if (!email) return;
    await sendPasswordResetEmail(auth, email);
    setResetSent(true);
    setTimeout(() => setResetSent(false), 3000);
  }

  async function deleteAccount() {
    if (!confirm("CRITICAL WARNING: This will permanently delete your shop data. Continue?")) return;
    const check = prompt("Type 'DELETE' to confirm:");
    if (check !== "DELETE") return;
    try {
      await updateDoc(doc(db, "vendors", vendorId), { deleted: true });
      await auth.currentUser?.delete();
      window.location.href = "/";
    } catch {
      alert("Error deleting. Try re-logging in first.");
    }
  }

  function loadDefaultRules() {
    setRules([
      "Security Deposit is fully refundable within 24 hours of return, provided items are damage-free.",
      "All equipment must be returned clean, dry, and packed as received.",
      "Strictly NO SMOKING inside tents or near fabric gear. Burn marks will incur full replacement cost.",
      "No pets allowed on rental equipment.",
      "Late returns are charged at RM 20 per hour delay.",
      "Do not exceed the stated capacity for tents/furniture.",
      "Renter is liable for the full replacement value of any lost or irreparably damaged items.",
      "Vendor is not liable for accidents/injuries during equipment use.",
    ]);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

      {/* Account & Profile */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-6">
          Account & Profile
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-[9px] font-bold text-slate-400 uppercase">Email</label>
            <input readOnly value={auth.currentUser?.email || ""} className={`${inputCls} opacity-60 cursor-not-allowed`} />
          </div>
          <div>
            <label className="text-[9px] font-bold text-slate-400 uppercase">Shop Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-[9px] font-bold text-slate-400 uppercase">WhatsApp Number</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="601XXXXXXXX" className={inputCls} />
          </div>
          <div>
            <label className="text-[9px] font-bold text-slate-400 uppercase">
              Shop URL Slug
              <span className="text-emerald-500 ml-1 normal-case font-medium">/shop/{slug || "your-slug"}</span>
            </label>
            <input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/ /g, "-"))}
              placeholder="your-shop-name" className={inputCls} />
          </div>

          <button onClick={saveAccount}
            className={`w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg transition-all ${savedAccount ? "bg-emerald-500 text-white" : "bg-[#062c24] text-white hover:bg-emerald-900"}`}>
            {savedAccount ? "✓ Account Saved!" : "Save Account"}
          </button>

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <button onClick={sendPasswordReset}
              className={`w-full py-3 rounded-2xl font-black uppercase text-[10px] transition-all border ${resetSent ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-slate-50 text-slate-500 hover:bg-slate-100 border-slate-200"}`}>
              {resetSent ? "✓ Reset Link Sent!" : "Send Password Reset Email"}
            </button>
            <button onClick={deleteAccount}
              className="w-full py-3 rounded-2xl font-black uppercase text-[10px] bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all border border-red-100">
              Delete Account & Shop
            </button>
          </div>
        </div>
      </div>

      {/* Logistics & Rules */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-6">
          Logistics & Rules
        </h3>
        <div className="space-y-4">

          {/* Toggles */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`p-4 rounded-2xl border cursor-pointer transition-all ${isVacation ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-100"}`}
              onClick={() => setIsVacation(!isVacation)}>
              <div className="flex justify-between items-center mb-1">
                <i className={`fas fa-umbrella-beach text-sm ${isVacation ? "text-blue-500" : "text-slate-300"}`}></i>
                <input type="checkbox" checked={isVacation} onChange={() => {}}
                  className="w-4 h-4 accent-blue-500" />
              </div>
              <p className="text-[9px] font-black uppercase text-left">Vacation Mode</p>
              <p className="text-[8px] text-slate-400">Temporarily close shop</p>
            </div>
            <div className={`p-4 rounded-2xl border cursor-pointer transition-all ${allowStacking ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-100"}`}
              onClick={() => setAllowStacking(!allowStacking)}>
              <div className="flex justify-between items-center mb-1">
                <i className={`fas fa-layer-group text-sm ${allowStacking ? "text-emerald-500" : "text-slate-300"}`}></i>
                <input type="checkbox" checked={allowStacking} onChange={() => {}}
                  className="w-4 h-4 accent-emerald-500" />
              </div>
              <p className="text-[9px] font-black uppercase text-left">Stack Discounts</p>
              <p className="text-[8px] text-slate-400">Combine all offers</p>
            </div>
          </div>

          <div>
            <label className="text-[9px] font-bold text-slate-400 uppercase">Main City</label>
            <input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Kuantan" className={inputCls} />
          </div>
          <div>
            <label className="text-[9px] font-bold text-slate-400 uppercase">Service Areas (comma separated)</label>
            <input value={areas} onChange={e => setAreas(e.target.value)} placeholder="Kuantan, Kemaman, Kuala Lumpur" className={inputCls} />
          </div>
          <div>
            <label className="text-[9px] font-bold text-slate-400 uppercase">Pickup Points (comma separated)</label>
            <input value={hubs} onChange={e => setHubs(e.target.value)} placeholder="Hub A, Hub B" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase">Security Deposit</label>
              <input type="number" value={depositVal} onChange={e => setDepositVal(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase">Type</label>
              <select value={depositType} onChange={e => setDepositType(e.target.value)} className={inputCls}>
                <option value="fixed">Fixed (RM)</option>
                <option value="percent">Percent (%)</option>
              </select>
            </div>
          </div>

          {/* Rules */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-[9px] font-bold text-slate-400 uppercase">Rental Rules</label>
              <button onClick={loadDefaultRules}
                className="text-[8px] font-bold text-emerald-600 hover:underline">
                Load Defaults
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1" style={{ scrollbarWidth: "none" }}>
              {rules.map((rule, i) => (
                <div key={i} className="flex gap-2">
                  <input value={rule} onChange={e => setRules(prev => prev.map((r, j) => j === i ? e.target.value : r))}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-[10px] font-bold outline-none focus:border-emerald-300" />
                  <button onClick={() => setRules(prev => prev.filter((_, j) => j !== i))}
                    className="text-red-400 px-3 hover:bg-red-50 rounded-xl">
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              ))}
            </div>
            <button onClick={() => setRules(prev => [...prev, ""])}
              className="mt-2 text-[9px] font-bold text-emerald-600 hover:underline">
              + Add Rule
            </button>
          </div>

          <button onClick={saveLogistics}
            className={`w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg transition-all ${savedLogistics ? "bg-emerald-500 text-white" : "bg-[#062c24] text-white hover:bg-emerald-900"}`}>
            {savedLogistics ? "✓ Settings Saved!" : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}