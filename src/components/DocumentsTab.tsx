"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { getStorage, ref, getDownloadURL } from "firebase/storage";

type DocumentsTabProps = {
  vendorId: string;
  vendorData: { name: string; rules?: string[] };
};

type Agreement = {
  id: string;
  customerName: string;
  timestamp?: any;
  icFrontPath?: string;
  icBackPath?: string;
};

export default function DocumentsTab({ vendorId, vendorData }: DocumentsTabProps) {
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [copyMsg, setCopyMsg] = useState(false);
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const agreementLink = typeof window !== "undefined"
    ? `${window.location.origin}/agreement?v=${vendorId}`
    : "";

  useEffect(() => {
    const q = query(
      collection(db, "agreements"),
      where("vendorId", "==", vendorId),
      orderBy("timestamp", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setAgreements(snap.docs.map(d => ({ id: d.id, ...d.data() } as Agreement)));
      setLoading(false);
    });
    return () => unsub();
  }, [vendorId]);

  function copyLink() {
    navigator.clipboard.writeText(agreementLink);
    setCopyMsg(true);
    setTimeout(() => setCopyMsg(false), 2000);
  }

  function shareViaWhatsApp() {
    const message = `Sila lengkapkan pengesahan identiti untuk tempahan anda:\n\n${agreementLink}\n\n1. Masukkan nama penuh\n2. Muat naik gambar IC (depan & belakang)\n3. Tandatangan waiver\n\nTerima kasih! 🏕️`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  }

  async function viewSecureImage(path?: string) {
    if (!path) return alert("No image path found.");
    try {
      const storage = getStorage();
      const url = await getDownloadURL(ref(storage, path));
      window.open(url, "_blank");
    } catch { alert("Permission Denied."); }
  }

  async function downloadAgreementPDF(agreement: Agreement) {
    setPdfLoading(agreement.id);
    try {
      const storage = getStorage();
      const [fUrl, bUrl] = await Promise.all([
        getDownloadURL(ref(storage, agreement.icFrontPath || "")),
        getDownloadURL(ref(storage, agreement.icBackPath || "")),
      ]);

      const html2pdf = (await import("html2pdf.js")).default;

      const rules = (vendorData.rules || []).map(r => `<p style="margin-bottom:5px;">• ${r}</p>`).join("");

      const element = document.createElement("div");
      element.style.cssText = "padding:40px;font-family:'Inter',sans-serif;color:#062c24;line-height:1.5;";
      element.innerHTML = `
        <h1 style="text-transform:uppercase;font-size:24px;border-bottom:2px solid #062c24;padding-bottom:10px;">Equipment Rental Agreement</h1>
        <p style="font-size:9px;color:#64748b;margin-top:5px;">Platform: Pacak Khemah | Ref: ${agreement.id.substring(0, 8).toUpperCase()}</p>
        <div style="margin-top:30px;display:flex;justify-content:space-between;">
          <div style="flex:1;">
            <p style="font-size:9px;color:#94a3b8;text-transform:uppercase;font-weight:800;">Vendor (Owner)</p>
            <p style="font-size:14px;font-weight:900;">${vendorData.name}</p>
          </div>
          <div style="flex:1;">
            <p style="font-size:9px;color:#94a3b8;text-transform:uppercase;font-weight:800;">Customer (Renter)</p>
            <p style="font-size:14px;font-weight:900;">${agreement.customerName}</p>
            <p style="font-size:10px;color:#64748b;">${agreement.timestamp?.toDate().toLocaleString() || ""}</p>
          </div>
        </div>
        <div style="margin-top:30px;background:#f8fafc;padding:20px;border-radius:15px;">
          <h3 style="text-transform:uppercase;font-size:12px;margin-bottom:10px;border-bottom:1px solid #e2e8f0;padding-bottom:5px;">Rental Policies & Terms</h3>
          <div style="font-size:10px;color:#475569;">${rules}</div>
        </div>
        <div style="margin-top:30px;">
          <h3 style="text-transform:uppercase;font-size:12px;margin-bottom:15px;">Identity Verification Documents</h3>
          <div style="display:flex;gap:20px;">
            <div style="flex:1;text-align:center;">
              <p style="font-size:8px;font-weight:800;color:#94a3b8;margin-bottom:5px;">FRONT ID IMAGE</p>
              <img src="${fUrl}" style="width:100%;border-radius:12px;border:1px solid #e2e8f0;">
            </div>
            <div style="flex:1;text-align:center;">
              <p style="font-size:8px;font-weight:800;color:#94a3b8;margin-bottom:5px;">BACK ID IMAGE</p>
              <img src="${bUrl}" style="width:100%;border-radius:12px;border:1px solid #e2e8f0;">
            </div>
          </div>
        </div>
        <div style="margin-top:40px;border-top:1px solid #e2e8f0;padding-top:10px;font-size:8px;color:#94a3b8;text-align:center;">
          This document is a legally binding record entered into solely between the Vendor and Customer. Pacak Khemah acts as a technology facilitator and is not a party to this agreement.
        </div>
      `;

      await html2pdf().set({
        margin: 10,
        filename: `Agreement_${agreement.customerName.replace(/\s+/g, "_")}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      }).from(element).save();

    } catch (e) {
      console.error(e);
      alert("Could not generate PDF. Please try again.");
    } finally {
      setPdfLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Customer Verification Section - Improved */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <i className="fas fa-user-check text-lg"></i>
            </div>
            <h2 className="text-lg font-black uppercase">Customer Verification</h2>
          </div>
          <p className="text-sm text-white/80">
            Collect IC photos and waiver signatures from your customers
          </p>
        </div>

        {/* How It Works */}
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-xs font-black text-slate-500 uppercase mb-4 flex items-center gap-2">
            <i className="fas fa-info-circle text-blue-500"></i>
            How It Works
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center text-sm font-black shrink-0">1</div>
              <div>
                <p className="text-xs font-bold text-slate-700">Customer Books</p>
                <p className="text-[10px] text-slate-400">They contact you via WhatsApp to book gear</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center text-sm font-black shrink-0">2</div>
              <div>
                <p className="text-xs font-bold text-slate-700">Send Link</p>
                <p className="text-[10px] text-slate-400">Share the verification link below</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center text-sm font-black shrink-0">3</div>
              <div>
                <p className="text-xs font-bold text-slate-700">Customer Submits</p>
                <p className="text-[10px] text-slate-400">They upload IC & sign the waiver</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center text-sm font-black shrink-0">
                <i className="fas fa-check text-xs"></i>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-700">You're Protected</p>
                <p className="text-[10px] text-slate-400">Agreement appears here automatically</p>
              </div>
            </div>
          </div>
        </div>

        {/* Link Section */}
        <div className="p-6 bg-slate-50">
          <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">
            Your Verification Link
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input 
              type="text" 
              readOnly 
              value={agreementLink}
              className="flex-1 bg-white border border-slate-200 p-3.5 rounded-xl text-xs font-bold text-slate-600 outline-none select-all" 
            />
            <div className="flex gap-2">
              <button 
                onClick={copyLink}
                className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${
                  copyMsg 
                    ? "bg-emerald-500 text-white" 
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}
              >
                <i className={`fas ${copyMsg ? "fa-check" : "fa-copy"}`}></i>
                {copyMsg ? "Copied!" : "Copy Link"}
              </button>
              <button 
                onClick={shareViaWhatsApp}
                className="px-5 py-3 rounded-xl text-[10px] font-black uppercase bg-emerald-500 text-white hover:bg-emerald-600 transition-all flex items-center gap-2"
              >
                <i className="fab fa-whatsapp"></i>
                Share
              </button>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-3">
            <i className="fas fa-lightbulb text-amber-500 mr-1"></i>
            Tip: Send this link via WhatsApp after confirming availability and before pickup
          </p>
        </div>
      </div>

      {/* Agreements List */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-black text-[#062c24] uppercase">
            Signed Agreements
          </h3>
          <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
            {agreements.length} documents
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-slate-50 rounded-xl p-4 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-slate-100 rounded w-1/4"></div>
              </div>
            ))}
          </div>
        ) : agreements.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-xl">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-file-signature text-slate-300 text-2xl"></i>
            </div>
            <p className="text-sm font-bold text-slate-400">No signed agreements yet</p>
            <p className="text-xs text-slate-300 mt-1">When customers complete verification, their documents will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {agreements.map(a => (
              <div 
                key={a.id} 
                className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50 p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-all gap-4"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                    <i className="fas fa-file-signature"></i>
                  </div>
                  <div>
                    <p className="text-sm font-black text-[#062c24]">{a.customerName}</p>
                    <p className="text-[10px] text-slate-400">
                      {a.timestamp?.toDate().toLocaleString() || "Syncing..."}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button 
                    onClick={() => viewSecureImage(a.icFrontPath)}
                    className="px-3 py-2 bg-white text-slate-600 rounded-lg text-[9px] font-bold border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 transition-all"
                  >
                    <i className="fas fa-id-card mr-1"></i> IC Front
                  </button>
                  <button 
                    onClick={() => viewSecureImage(a.icBackPath)}
                    className="px-3 py-2 bg-white text-slate-600 rounded-lg text-[9px] font-bold border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 transition-all"
                  >
                    <i className="fas fa-id-card mr-1"></i> IC Back
                  </button>
                  <button 
                    onClick={() => downloadAgreementPDF(a)}
                    disabled={pdfLoading === a.id}
                    className="px-4 py-2 bg-[#062c24] text-white rounded-lg text-[9px] font-black uppercase hover:bg-emerald-800 flex items-center gap-2 transition-all disabled:opacity-50"
                  >
                    {pdfLoading === a.id 
                      ? <i className="fas fa-spinner fa-spin"></i>
                      : <><i className="fas fa-file-pdf"></i> Download PDF</>
                    }
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}