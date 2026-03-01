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

      // Dynamically import html2pdf
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
      {/* Agreement Link Banner */}
      <div className="bg-indigo-50 p-8 rounded-[2.5rem] border border-indigo-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h3 className="text-xl font-black text-indigo-900 uppercase mb-2">Customer Verification Link</h3>
          <p className="text-xs text-indigo-700 max-w-md">
            Send this link to customers via WhatsApp after confirming availability. They will upload their IC and sign the waiver.
          </p>
        </div>
        <div className="flex w-full md:w-auto gap-2">
          <input type="text" readOnly value={agreementLink}
            className="flex-1 md:w-64 bg-white border border-indigo-200 p-3 rounded-xl text-[10px] font-bold text-slate-500 outline-none select-all" />
          <button onClick={copyLink}
            className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg transition-all whitespace-nowrap ${copyMsg ? "bg-emerald-500 text-white" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}>
            {copyMsg ? "Copied!" : "Copy Link"}
          </button>
        </div>
      </div>

      {/* Agreements List */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-6">
          Signed Agreements (Last 30 Days)
        </h3>
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12 text-slate-400 text-xs">Loading documents...</div>
          ) : agreements.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">No signed documents found.</div>
          ) : agreements.map(a => (
            <div key={a.id} className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-5 rounded-2xl border border-slate-100 hover:shadow-md transition-all gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                  <i className="fas fa-file-signature"></i>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-[#062c24]">{a.customerName}</p>
                  <p className="text-[9px] text-slate-400 font-medium">
                    {a.timestamp?.toDate().toLocaleString() || "Syncing..."}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => viewSecureImage(a.icFrontPath)}
                  className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-bold hover:bg-indigo-50 hover:text-indigo-600 transition-all">
                  ID Front
                </button>
                <button onClick={() => viewSecureImage(a.icBackPath)}
                  className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-bold hover:bg-indigo-50 hover:text-indigo-600 transition-all">
                  ID Back
                </button>
                <button onClick={() => downloadAgreementPDF(a)}
                  disabled={pdfLoading === a.id}
                  className="px-4 py-2 bg-[#062c24] text-white rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-emerald-800 flex items-center gap-2 transition-all">
                  {pdfLoading === a.id
                    ? <i className="fas fa-spinner fa-spin"></i>
                    : <><i className="fas fa-file-pdf"></i> PDF</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}