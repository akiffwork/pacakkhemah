"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

type Package = { credits: number; price: number };
type PaymentConfig = {
  categoryCode?: string; secretKey?: string;
  isSandbox?: boolean; leadCost?: number;
  startingCredits?: number; packages?: Package[];
};

export default function FinanceTab() {
  const [config, setConfig] = useState<PaymentConfig>({});
  const [packages, setPackages] = useState<Package[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "payment_config"), snap => {
      if (snap.exists()) {
        const d = snap.data() as PaymentConfig;
        setConfig(d);
        setPackages(d.packages || []);
      }
    });
    return () => unsub();
  }, []);

  async function saveConfig() {
    await setDoc(doc(db, "settings", "payment_config"), {
      ...config, packages,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function updatePkg(i: number, field: "credits" | "price", val: number) {
    setPackages(prev => prev.map((p, j) => j === i ? { ...p, [field]: val } : p));
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

      {/* Left — Transaction placeholder */}
      <div className="lg:col-span-8 space-y-6">
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-6">
          <h3 className="text-sm font-black text-[#062c24] uppercase mb-6 flex items-center gap-3">
            <i className="fas fa-receipt text-slate-300"></i> Transaction Ledger
          </h3>
          <div className="min-h-[200px] flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-2xl text-slate-300">
            <i className="fas fa-file-invoice-dollar text-4xl mb-3 opacity-30"></i>
            <p className="text-[10px] font-black uppercase">No Transactions Recorded Yet</p>
            <p className="text-[9px] font-medium mt-1">Transactions will appear here as vendors top up</p>
          </div>
        </div>

        {/* Package Preview */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-6">
          <h3 className="text-sm font-black text-[#062c24] uppercase mb-4 flex items-center gap-3">
            <i className="fas fa-boxes-stacked text-slate-300"></i> Credit Package Preview
          </h3>
          {packages.length === 0 ? (
            <p className="text-[10px] font-bold text-slate-300 uppercase text-center py-6">No packages configured</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {packages.map((pkg, i) => (
                <div key={i} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-center">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-black text-sm mx-auto mb-2">{pkg.credits}</div>
                  <p className="text-[10px] font-black uppercase text-[#062c24]">Credits</p>
                  <p className="text-lg font-black text-emerald-600 mt-1">RM {pkg.price}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right — Config */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-indigo-900 p-6 rounded-[2.5rem] shadow-xl text-white">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
              <i className="fas fa-sliders-h text-indigo-300"></i>
            </div>
            <h3 className="text-sm font-black uppercase">Pricing Config</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[8px] font-bold text-indigo-300 uppercase block mb-1">Cost Per Lead (Credits)</label>
              <input type="number" value={config.leadCost || ""} onChange={e => setConfig(p => ({ ...p, leadCost: Number(e.target.value) }))}
                className="w-full bg-black/20 border border-white/10 p-2.5 rounded-xl text-xs font-bold text-white outline-none" />
            </div>

            <div>
              <label className="text-[8px] font-bold text-indigo-300 uppercase block mb-1">Starting Credits (New Vendors)</label>
              <input type="number" value={config.startingCredits || ""} onChange={e => setConfig(p => ({ ...p, startingCredits: Number(e.target.value) }))}
                className="w-full bg-black/20 border border-white/10 p-2.5 rounded-xl text-xs font-bold text-white outline-none" />
            </div>

            {/* Packages */}
            <div className="bg-black/20 p-4 rounded-xl">
              <div className="flex justify-between items-center mb-3">
                <label className="text-[8px] font-bold text-indigo-300 uppercase">Credit Packages</label>
                <button onClick={() => setPackages(p => [...p, { credits: 10, price: 10 }])}
                  className="text-[8px] bg-indigo-500 px-2 py-1 rounded-lg font-bold hover:bg-indigo-400 transition-all">
                  + Add
                </button>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                {packages.map((pkg, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input type="number" value={pkg.credits} onChange={e => updatePkg(i, "credits", Number(e.target.value))}
                      placeholder="Credits" className="w-1/2 bg-black/20 p-2 rounded-lg text-[9px] text-white outline-none font-bold" />
                    <input type="number" value={pkg.price} onChange={e => updatePkg(i, "price", Number(e.target.value))}
                      placeholder="RM" className="w-1/2 bg-black/20 p-2 rounded-lg text-[9px] text-white outline-none font-bold" />
                    <button onClick={() => setPackages(p => p.filter((_, j) => j !== i))}
                      className="text-red-400 hover:text-red-300 shrink-0">
                      <i className="fas fa-times text-xs"></i>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[8px] font-bold text-indigo-300 uppercase block mb-1">Category Code</label>
                <input value={config.categoryCode || ""} onChange={e => setConfig(p => ({ ...p, categoryCode: e.target.value }))}
                  className="w-full bg-black/20 p-2.5 rounded-xl text-[9px] text-white outline-none font-bold border border-white/10" />
              </div>
              <div>
                <label className="text-[8px] font-bold text-indigo-300 uppercase block mb-1">Secret Key</label>
                <input type="password" value={config.secretKey || ""} onChange={e => setConfig(p => ({ ...p, secretKey: e.target.value }))}
                  className="w-full bg-black/20 p-2.5 rounded-xl text-[9px] text-white outline-none font-bold border border-white/10" />
              </div>
            </div>

            <div className="flex items-center gap-2 bg-black/10 p-3 rounded-xl">
              <input type="checkbox" id="sandbox" checked={config.isSandbox || false}
                onChange={e => setConfig(p => ({ ...p, isSandbox: e.target.checked }))}
                className="w-4 h-4 accent-indigo-400" />
              <label htmlFor="sandbox" className="text-[9px] font-bold text-indigo-200 cursor-pointer">Sandbox Mode (ToyyibPay Dev)</label>
            </div>

            <button onClick={saveConfig}
              className={`w-full py-3 rounded-xl font-black uppercase text-[10px] mt-2 shadow-lg transition-all ${saved ? "bg-emerald-400 text-white" : "bg-white text-indigo-900 hover:bg-indigo-50"}`}>
              {saved ? "✓ Saved!" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}