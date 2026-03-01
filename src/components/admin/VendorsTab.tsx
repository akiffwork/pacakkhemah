"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { doc, updateDoc, increment } from "firebase/firestore";

type Vendor = { id: string; name: string; email?: string; phone?: string; status?: string; credits?: number; slug?: string };

export default function VendorsTab({ allVendors }: { allVendors: Vendor[] }) {
  const [search, setSearch] = useState("");

  const active = allVendors.filter(v => v.status === "approved");
  const filtered = active.filter(v =>
    !search ||
    v.name?.toLowerCase().includes(search.toLowerCase()) ||
    v.email?.toLowerCase().includes(search.toLowerCase()) ||
    v.phone?.includes(search)
  );

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

  return (
    <div className="space-y-6">
      {/* Search + Count Bar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm gap-4">
        <div className="relative w-full lg:w-96">
          <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email or phone..."
            className="w-full bg-slate-50 border border-slate-100 pl-10 pr-4 py-3 rounded-xl text-xs font-bold outline-none focus:border-emerald-500 transition-all" />
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{filtered.length} Active Partners</span>
        </div>
      </div>

      {/* Vendor Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-wider">
              <tr>
                <th className="p-5 pl-8">Vendor</th>
                <th className="p-5">Contact</th>
                <th className="p-5">Credits</th>
                <th className="p-5">Shop</th>
                <th className="p-5 text-right pr-8">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs font-bold text-slate-600">
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="p-10 text-center text-slate-300 text-[10px] uppercase font-black">No vendors found</td></tr>
              ) : filtered.map(v => (
                <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-5 pl-8">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-[#062c24] text-white rounded-xl flex items-center justify-center font-black text-sm shrink-0">
                        {v.name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-black uppercase text-[#062c24] text-[11px]">{v.name}</p>
                        <p className="text-[9px] text-slate-400 font-medium">{v.email}</p>
                      </div>
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
                      <a href={`/store?admin_override=${v.id}`} target="_blank"
                        className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-all" title="View as Vendor">
                        <i className="fas fa-key text-[10px]"></i>
                      </a>
                      <button onClick={() => manualTopUp(v.id, v.name)}
                        className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all" title="Add Credits">
                        <i className="fas fa-plus text-[10px]"></i>
                      </button>
                      <button onClick={() => suspendVendor(v.id)}
                        className="w-8 h-8 rounded-lg bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all" title="Suspend">
                        <i className="fas fa-ban text-[10px]"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}