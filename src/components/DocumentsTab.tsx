"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { getStorage, ref, getDownloadURL } from "firebase/storage";
import { generateAgreementPDF, buildAgreementMeta } from "@/lib/agreementPDF";

type DocumentsTabProps = {
  vendorId: string;
  vendorData: { name: string; rules?: string[]; phone?: string; city?: string; slug?: string };
};

type BookingDetails = {
  vendorId: string;
  orderId?: string;
  items: { name: string; qty: number }[];
  dates: { start: string; end: string };
  total: number;
};

type Agreement = {
  id: string;
  customerName: string;
  customerPhone?: string;
  timestamp?: any;
  icFrontPath?: string;
  icBackPath?: string;
  bookingDetails?: BookingDetails | string;
  orderId?: string;
  status?: string;
};

export default function DocumentsTab({ vendorId, vendorData }: DocumentsTabProps) {
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [copyMsg, setCopyMsg] = useState(false);
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
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
    const message = `Sila lengkapkan pengesahan identiti untuk tempahan anda:\n\n${agreementLink}\n\n1. Masukkan nama penuh\n2. Masukkan nombor WhatsApp\n3. Muat naik gambar IC (depan & belakang)\n4. Tandatangan waiver\n\nTerima kasih!`;
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

  function getBooking(a: Agreement): BookingDetails | null {
    if (!a.bookingDetails || typeof a.bookingDetails === "string") return null;
    return a.bookingDetails as BookingDetails;
  }

  async function downloadAgreementPDF(agreement: Agreement) {
    setPdfLoading(agreement.id);
    try {
      const storage = getStorage();
      let fUrl = "", bUrl = "";
      try {
        [fUrl, bUrl] = await Promise.all([
          getDownloadURL(ref(storage, agreement.icFrontPath || "")),
          getDownloadURL(ref(storage, agreement.icBackPath || "")),
        ]);
      } catch { /* IC images may not be accessible */ }

      const booking = getBooking(agreement);
      const ts = agreement.timestamp?.toDate() || new Date();
      const meta = buildAgreementMeta(ts, agreement.id);

      generateAgreementPDF(
        { name: vendorData.name, phone: vendorData.phone, city: vendorData.city },
        { customerName: agreement.customerName, customerPhone: agreement.customerPhone, ...meta },
        booking ? { items: booking.items, dates: booking.dates, total: booking.total } : null,
        vendorData.rules,
        (fUrl && bUrl) ? { frontUrl: fUrl, backUrl: bUrl } : undefined,
      );
    } catch (e) {
      console.error(e);
      alert("Could not generate PDF. Please try again.");
    } finally {
      setPdfLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Customer Verification Section */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="bg-gradient-to-r from-[#062c24] to-emerald-800 p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <i className="fas fa-user-check text-lg"></i>
            </div>
            <h2 className="text-lg font-black uppercase">Customer Verification</h2>
          </div>
          <p className="text-sm text-white/80">
            Collect IC photos, WhatsApp number and waiver signatures from your customers
          </p>
        </div>

        <div className="p-6 border-b border-slate-100">
          <h3 className="text-xs font-black text-slate-500 uppercase mb-4 flex items-center gap-2">
            <i className="fas fa-info-circle text-emerald-500"></i>
            How It Works
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { n: "1", t: "Customer Books", d: "They contact you via WhatsApp to book gear" },
              { n: "2", t: "Send Link", d: "Share the verification link below" },
              { n: "3", t: "Customer Submits", d: "They enter details, upload IC & sign waiver" },
            ].map(s => (
              <div key={s.n} className="flex items-start gap-3">
                <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center text-sm font-black shrink-0">{s.n}</div>
                <div>
                  <p className="text-xs font-bold text-slate-700">{s.t}</p>
                  <p className="text-[10px] text-slate-400">{s.d}</p>
                </div>
              </div>
            ))}
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

        <div className="p-6 bg-slate-50">
          <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Your Verification Link</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input type="text" readOnly value={agreementLink}
              className="flex-1 bg-white border border-slate-200 p-3.5 rounded-xl text-xs font-bold text-slate-600 outline-none select-all" />
            <div className="flex gap-2">
              <button onClick={copyLink}
                className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${copyMsg ? "bg-emerald-500 text-white" : "bg-[#062c24] text-white hover:bg-emerald-800"}`}>
                <i className={`fas ${copyMsg ? "fa-check" : "fa-copy"}`}></i>
                {copyMsg ? "Copied!" : "Copy Link"}
              </button>
              <button onClick={shareViaWhatsApp}
                className="px-5 py-3 rounded-xl text-[10px] font-black uppercase bg-emerald-500 text-white hover:bg-emerald-600 transition-all flex items-center gap-2">
                <i className="fab fa-whatsapp"></i> Share
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
          <h3 className="text-sm font-black text-[#062c24] uppercase">Signed Agreements</h3>
          <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">{agreements.length} documents</span>
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
            {agreements.map(a => {
              const booking = getBooking(a);
              const isExpanded = expanded === a.id;
              return (
                <div key={a.id} className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden hover:border-slate-200 transition-all">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 gap-3 cursor-pointer"
                    onClick={() => setExpanded(isExpanded ? null : a.id)}>
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                        <i className="fas fa-file-signature"></i>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-[#062c24] truncate">{a.customerName}</p>
                        <div className="flex items-center gap-3 flex-wrap">
                          <p className="text-[10px] text-slate-400">
                            {a.timestamp?.toDate().toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" }) || "Syncing..."}
                          </p>
                          {a.customerPhone && (
                            <p className="text-[10px] text-emerald-600 font-bold">
                              <i className="fab fa-whatsapp mr-0.5"></i>{a.customerPhone}
                            </p>
                          )}
                          {booking?.total ? (
                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">RM {booking.total}</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <i className={`fas fa-chevron-down text-slate-300 text-xs transition-transform ${isExpanded ? "rotate-180" : ""}`}></i>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-4">
                      {booking?.items?.length ? (
                        <div className="bg-white rounded-xl p-4 border border-slate-100">
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-3">Rental Items</p>
                          <div className="space-y-2">
                            {booking.items.map((item, i) => (
                              <div key={i} className="flex justify-between text-xs">
                                <span className="font-bold text-[#062c24]">{item.name}</span>
                                <span className="font-black text-emerald-600">x{item.qty}</span>
                              </div>
                            ))}
                          </div>
                          <div className="border-t border-slate-100 mt-3 pt-3 flex justify-between items-center">
                            <div>
                              <p className="text-[9px] font-bold text-slate-400 uppercase">Period</p>
                              <p className="text-xs font-bold text-[#062c24]">{booking.dates?.start || "TBD"} → {booking.dates?.end || "TBD"}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] font-bold text-slate-400 uppercase">Total</p>
                              <p className="text-lg font-black text-emerald-600">RM {booking.total}</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white rounded-xl p-4 border border-slate-100">
                          <p className="text-[10px] text-slate-400 italic">Booking via WhatsApp / Chat (no item details recorded)</p>
                        </div>
                      )}

                      <div className="flex gap-2 flex-wrap">
                        <button onClick={(e) => { e.stopPropagation(); viewSecureImage(a.icFrontPath); }}
                          className="px-3 py-2 bg-white text-slate-600 rounded-lg text-[9px] font-bold border border-slate-200 hover:border-emerald-300 hover:text-emerald-600 transition-all">
                          <i className="fas fa-id-card mr-1"></i> IC Front
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); viewSecureImage(a.icBackPath); }}
                          className="px-3 py-2 bg-white text-slate-600 rounded-lg text-[9px] font-bold border border-slate-200 hover:border-emerald-300 hover:text-emerald-600 transition-all">
                          <i className="fas fa-id-card mr-1"></i> IC Back
                        </button>
                        {a.customerPhone && (
                          <a href={`https://wa.me/${a.customerPhone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="px-3 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-bold border border-emerald-200 hover:bg-emerald-100 transition-all">
                            <i className="fab fa-whatsapp mr-1"></i> WhatsApp
                          </a>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); downloadAgreementPDF(a); }}
                          disabled={pdfLoading === a.id}
                          className="px-4 py-2 bg-[#062c24] text-white rounded-lg text-[9px] font-black uppercase hover:bg-emerald-800 flex items-center gap-2 transition-all disabled:opacity-50 ml-auto">
                          {pdfLoading === a.id ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-file-pdf"></i> Download PDF</>}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}