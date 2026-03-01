"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

export default function AdminSettingsTab() {
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [status, setStatus] = useState("active");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "global_announcement"), snap => {
      if (snap.exists()) {
        const d = snap.data();
        setMessage(d.message || "");
        setType(d.type || "info");
        setStatus(d.isActive ? "active" : "inactive");
      }
    });
    return () => unsub();
  }, []);

  async function saveAnnouncement() {
    await setDoc(doc(db, "settings", "global_announcement"), {
      message, type, isActive: status === "active",
    }, { merge: true });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const typeConfig = {
    info: { label: "Info", color: "bg-blue-500", preview: "bg-blue-50 border-blue-200 text-blue-800" },
    warning: { label: "Alert", color: "bg-amber-500", preview: "bg-amber-50 border-amber-200 text-amber-800" },
    promo: { label: "Promo", color: "bg-emerald-500", preview: "bg-emerald-50 border-emerald-200 text-emerald-800" },
  };

  return (
    <div className="max-w-2xl space-y-6">

      {/* Announcement Banner */}
      <div className="bg-gradient-to-br from-[#062c24] to-emerald-900 p-8 rounded-[2.5rem] shadow-xl text-white">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-white/10 text-emerald-300 flex items-center justify-center">
            <i className="fas fa-bullhorn"></i>
          </div>
          <div>
            <h3 className="text-sm font-black uppercase">Global Announcement</h3>
            <p className="text-[9px] text-emerald-300/70 font-medium">Shows as banner on directory page</p>
          </div>
        </div>

        <div className="space-y-4">
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
            placeholder="Write your announcement here..."
            className="w-full bg-black/20 border border-white/10 rounded-2xl p-4 text-sm font-medium text-white placeholder:text-white/30 outline-none resize-none focus:border-emerald-400 transition-all" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[8px] font-bold text-emerald-300 uppercase block mb-1.5">Banner Type</label>
              <select value={type} onChange={e => setType(e.target.value)}
                className="w-full bg-black/20 border border-white/10 text-white text-xs font-bold uppercase rounded-xl px-4 py-3 outline-none">
                <option value="info">Info (Blue)</option>
                <option value="warning">Alert (Amber)</option>
                <option value="promo">Promo (Green)</option>
              </select>
            </div>
            <div>
              <label className="text-[8px] font-bold text-emerald-300 uppercase block mb-1.5">Visibility</label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="w-full bg-black/20 border border-white/10 text-white text-xs font-bold uppercase rounded-xl px-4 py-3 outline-none">
                <option value="active">Active (Visible)</option>
                <option value="inactive">Inactive (Hidden)</option>
              </select>
            </div>
          </div>

          <button onClick={saveAnnouncement}
            className={`w-full py-4 rounded-xl font-black uppercase text-xs transition-all shadow-lg ${saved ? "bg-emerald-400 text-white" : "bg-white text-[#062c24] hover:bg-emerald-50"}`}>
            {saved ? "✓ Published!" : "Publish Update"}
          </button>
        </div>
      </div>

      {/* Live Preview */}
      {message && (
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Live Preview</p>
          <div className={`p-4 rounded-2xl border text-sm font-medium flex items-center gap-3 ${typeConfig[type as keyof typeof typeConfig]?.preview}`}>
            <i className={`fas ${type === "info" ? "fa-info-circle" : type === "warning" ? "fa-exclamation-triangle" : "fa-tag"}`}></i>
            <span>{message}</span>
            {status === "inactive" && <span className="ml-auto text-[9px] font-black opacity-50 uppercase">(Hidden)</span>}
          </div>
        </div>
      )}
    </div>
  );
}