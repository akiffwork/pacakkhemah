"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection, query, onSnapshot, orderBy, limit, doc, updateDoc, getDoc, increment,
} from "firebase/firestore";

type Vendor = { id: string; name: string; email: string; phone?: string; status?: string; credits?: number };
type Lead = { vendorName?: string; totalAmount?: number; timestamp?: any };

type Props = { allVendors: Vendor[] };

export default function DashboardTab({ allVendors }: Props) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);

  const active = allVendors.filter(v => v.status === "approved");
  const pending = allVendors.filter(v => v.status === "pending");
  const totalRevenue = allVendors.reduce((sum, v) => sum + (v.credits || 0), 0);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "analytics"), orderBy("timestamp", "desc"), limit(20)),
      snap => {
        setLeads(snap.docs.map(d => d.data() as Lead));
        setTotalLeads(snap.size);
      }
    );
    return () => unsub();
  }, []);

  async function approveVendor(id: string, depositEl: string) {
    const dep = (document.getElementById(depositEl) as HTMLInputElement)?.value || "50";
    const config = await getDoc(doc(db, "settings", "payment_config"));
    const startCredits = config.exists() ? config.data().startingCredits || 10 : 10;
    await updateDoc(doc(db, "vendors", id), {
      status: "approved",
      security_deposit: Number(dep),
      credits: startCredits,
    });
  }

  const stats = [
    { label: "Credit Pool", value: totalRevenue, prefix: "", color: "text-[#062c24]", bg: "bg-emerald-50", icon: "fa-coins", iconColor: "text-emerald-600" },
    { label: "Active Vendors", value: active.length, prefix: "", color: "text-[#062c24]", bg: "bg-blue-50", icon: "fa-store", iconColor: "text-blue-500" },
    { label: "Pending", value: pending.length, prefix: "", color: "text-amber-500", bg: "bg-amber-50", icon: "fa-clock", iconColor: "text-amber-500" },
    { label: "Total Leads", value: `${totalLeads}+`, prefix: "", color: "text-emerald-500", bg: "bg-emerald-50", icon: "fa-bolt", iconColor: "text-emerald-500" },
  ];

  return (
    <div className="space-y-8">

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white p-5 lg:p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
            <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center mb-4`}>
              <i className={`fas ${s.icon} ${s.iconColor}`}></i>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
            <h3 className={`text-2xl lg:text-3xl font-black ${s.color}`}>{s.prefix}{s.value}</h3>
          </div>
        ))}
      </div>

      {/* Pending Applications */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
            Pending Applications
            {pending.length > 0 && (
              <span className="ml-2 bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full text-[9px]">{pending.length}</span>
            )}
          </h3>
        </div>
        {pending.length === 0 ? (
          <div className="bg-white rounded-[2rem] border border-slate-100 p-8 text-center">
            <i className="fas fa-check-circle text-3xl text-emerald-200 mb-3 block"></i>
            <p className="text-[10px] font-bold text-slate-400 uppercase">No pending applications</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {pending.map(v => (
              <div key={v.id} className="bg-amber-50 p-5 rounded-2xl border border-amber-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center font-black text-sm">
                    {v.name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-black uppercase text-xs text-amber-900">{v.name}</h4>
                    <p className="text-[9px] text-amber-700/70 font-medium">{v.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="flex items-center gap-1.5 bg-white rounded-xl px-3 py-2 border border-amber-100">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Dep. RM</span>
                    <input id={`dep-${v.id}`} type="number" defaultValue={50}
                      className="w-12 text-center text-[10px] font-black outline-none text-[#062c24]" />
                  </div>
                  <button onClick={() => approveVendor(v.id, `dep-${v.id}`)}
                    className="flex-1 sm:flex-none bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-[9px] font-black uppercase shadow-sm hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                    <i className="fas fa-check"></i> Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Live Lead Feed */}
      <section className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse inline-block"></span>
            Live Lead Feed
          </h3>
          <span className="text-[9px] font-bold text-slate-300 uppercase">Last 20 leads</span>
        </div>
        <div className="divide-y divide-slate-50">
          {leads.length === 0 ? (
            <div className="p-8 text-center text-[10px] font-bold text-slate-300 uppercase">No leads yet</div>
          ) : leads.map((l, i) => (
            <div key={i} className="flex justify-between items-center p-4 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <i className="fab fa-whatsapp text-sm"></i>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-700">{l.vendorName || "Unknown Vendor"}</p>
                  <p className="text-[9px] text-slate-400 font-medium">
                    {l.timestamp?.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) || "Now"}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg">
                RM {l.totalAmount || 0}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}