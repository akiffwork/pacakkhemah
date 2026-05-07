"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, limit } from "firebase/firestore";
import { getStorage, ref, getDownloadURL } from "firebase/storage";
import { generateAgreementPDF, buildAgreementMeta } from "@/lib/agreementPDF";

type DocumentsTabProps = {
  vendorId: string;
  vendorData: { name: string; rules?: string[]; phone?: string; city?: string; slug?: string };
};

type BookingDetails = {
  vendorId: string;
  orderId?: string;
  items: { name: string; qty: number; price?: number; variantLabel?: string; variantColor?: string }[];
  dates: { start: string; end: string };
  subtotal?: number;
  discounts?: { label: string; amount: number }[];
  serviceFee?: number;
  rentalAmount?: number;
  depositAmount?: number;
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

type PendingOrder = {
  id: string;
  customerName?: string;
  customerPhone?: string;
  items: { name: string; qty: number; price?: number; variantLabel?: string; variantColor?: string }[];
  totalAmount: number;
  rentalAmount?: number;
  depositAmount?: number;
  promoCode?: string;
  promoDiscount?: number;
  promoType?: string;
  autoDiscount?: number;
  serviceFee?: number;
  bookingDates: { start: string; end: string };
  status: string;
  agreementSigned?: boolean;
  deleted?: boolean;
  createdAt: any;
};

export default function DocumentsTab({ vendorId, vendorData }: DocumentsTabProps) {
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const agreementLink = typeof window !== "undefined"
    ? `${window.location.origin}/agreement?v=${vendorId}`
    : "";

  useEffect(() => {
    const unsubAgreements = onSnapshot(
      query(collection(db, "agreements"), where("vendorId", "==", vendorId), orderBy("timestamp", "desc")),
      (snap) => {
        setAgreements(snap.docs.map(d => ({ id: d.id, ...d.data() } as Agreement)));
        setLoading(false);
      }
    );

    const unsubOrders = onSnapshot(
      query(collection(db, "orders"), where("vendorId", "==", vendorId), orderBy("createdAt", "desc"), limit(60)),
      (snap) => {
        const orders = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as PendingOrder))
          .filter(o => !o.deleted && !o.agreementSigned);
        setPendingOrders(orders);
      }
    );

    return () => { unsubAgreements(); unsubOrders(); };
  }, [vendorId]);

  function copyLink(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopyMsg(key);
    setTimeout(() => setCopyMsg(null), 2000);
  }

  function getOrderAgreementLink(order: PendingOrder): string {
    const base = `${window.location.origin}/agreement?v=${vendorId}&o=${order.id}`;
    try {
      const discounts: { label: string; amount: number }[] = [];
      if (order.autoDiscount) discounts.push({ label: "Extended Stay Discount", amount: order.autoDiscount });
      if (order.promoCode && order.promoDiscount) {
        const lbl = order.promoType === "fixed"
          ? `Promo Code "${order.promoCode}" (RM${order.promoDiscount} off)`
          : `Promo Code "${order.promoCode}"`;
        discounts.push({ label: lbl, amount: order.promoDiscount });
      }
      const total = order.totalAmount;
      const depositAmount = order.depositAmount;
      const rentalAmount = order.rentalAmount ?? (depositAmount != null ? total - depositAmount : undefined);
      const summary = {
        items: order.items.map(i => ({
          name: i.name, qty: i.qty, price: i.price,
          ...(i.variantLabel ? { variantLabel: i.variantLabel, variantColor: i.variantColor } : {}),
        })),
        dates: order.bookingDates,
        ...(discounts.length ? { discounts } : {}),
        ...(order.serviceFee ? { serviceFee: order.serviceFee } : {}),
        ...(rentalAmount != null ? { rentalAmount } : {}),
        ...(depositAmount != null ? { depositAmount } : {}),
        total,
      };
      return `${base}&d=${btoa(unescape(encodeURIComponent(JSON.stringify(summary))))}`;
    } catch {
      return base;
    }
  }

  function sendOrderAgreementWhatsApp(order: PendingOrder) {
    const link = getOrderAgreementLink(order);
    const name = order.customerName ? ` untuk ${order.customerName}` : "";
    const msg = `Sila lengkapkan pengesahan identiti${name} untuk tempahan anda:\n\n${link}\n\n1. Masukkan nama penuh\n2. Masukkan nombor WhatsApp\n3. Muat naik gambar IC (depan & belakang)\n4. Tandatangan waiver\n\nTerima kasih!`;
    const phone = order.customerPhone?.replace(/\D/g, "");
    window.open(`https://wa.me/${phone || ""}?text=${encodeURIComponent(msg)}`, "_blank");
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

  async function storageToDataUrl(path: string): Promise<string> {
    const storage = getStorage();
    const url = await getDownloadURL(ref(storage, path));
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function downloadAgreementPDF(agreement: Agreement) {
    setPdfLoading(agreement.id);
    try {
      let fDataUrl = "", bDataUrl = "";
      if (agreement.icFrontPath && agreement.icBackPath) {
        try {
          [fDataUrl, bDataUrl] = await Promise.all([
            storageToDataUrl(agreement.icFrontPath),
            storageToDataUrl(agreement.icBackPath),
          ]);
        } catch (e) {
          console.warn("Could not load IC images for PDF:", e);
        }
      }

      const booking = getBooking(agreement);
      const ts = agreement.timestamp?.toDate() || new Date();
      const meta = buildAgreementMeta(ts, agreement.id);

      generateAgreementPDF(
        { name: vendorData.name, phone: vendorData.phone, city: vendorData.city },
        { customerName: agreement.customerName, customerPhone: agreement.customerPhone, ...meta },
        booking ? {
          items: booking.items,
          dates: booking.dates,
          subtotal: booking.subtotal,
          discounts: booking.discounts,
          serviceFee: booking.serviceFee,
          rentalAmount: booking.rentalAmount,
          deposit: booking.depositAmount,
          total: booking.total,
        } : null,
        vendorData.rules,
        (fDataUrl && bDataUrl) ? { frontUrl: fDataUrl, backUrl: bDataUrl } : undefined,
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
              <button onClick={() => copyLink(agreementLink, "generic")}
                className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${copyMsg === "generic" ? "bg-emerald-500 text-white" : "bg-[#062c24] text-white hover:bg-emerald-800"}`}>
                <i className={`fas ${copyMsg === "generic" ? "fa-check" : "fa-copy"}`}></i>
                {copyMsg === "generic" ? "Copied!" : "Copy Link"}
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

      {/* Pending Agreements */}
      {pendingOrders.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center">
                <i className="fas fa-clock text-sm"></i>
              </div>
              <h3 className="text-sm font-black text-[#062c24] uppercase">Awaiting Agreement</h3>
            </div>
            <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
              {pendingOrders.length} pending
            </span>
          </div>

          <div className="divide-y divide-slate-50">
            {pendingOrders.map(order => {
              const itemSummary = order.items?.length
                ? order.items[0].name + (order.items.length > 1 ? ` +${order.items.length - 1} more` : "")
                : "—";
              const orderLink = getOrderAgreementLink(order);
              const isCopied = copyMsg === order.id;

              return (
                <div key={order.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                        <i className="fas fa-box text-slate-400 text-sm"></i>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className="text-sm font-black text-[#062c24] truncate">
                            {order.customerName || order.customerPhone || "Unknown Customer"}
                          </p>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            order.status === "confirmed"
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-slate-100 text-slate-500"
                          }`}>{order.status}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate mb-0.5">{itemSummary}</p>
                        <div className="flex items-center gap-3 flex-wrap">
                          {order.bookingDates?.start && (
                            <span className="text-[10px] text-slate-400">
                              <i className="fas fa-calendar-alt mr-1"></i>
                              {order.bookingDates.start} → {order.bookingDates.end}
                            </span>
                          )}
                          <span className="text-[10px] font-black text-emerald-600">RM {order.totalAmount}</span>
                          {order.depositAmount != null && order.depositAmount > 0 && (
                            <span className="text-[9px] text-amber-600">
                              <i className="fas fa-shield-alt mr-0.5"></i>RM {order.depositAmount} deposit
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button onClick={() => sendOrderAgreementWhatsApp(order)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase hover:bg-emerald-600 transition-all">
                        <i className="fab fa-whatsapp text-sm"></i> Send
                      </button>
                      <button onClick={() => copyLink(orderLink, order.id)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${isCopied ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                        <i className={`fas ${isCopied ? "fa-check" : "fa-link"} text-sm`}></i>
                        {isCopied ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                              <div key={i} className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {item.variantColor && <span className="w-3 h-3 rounded-full border border-slate-200 shrink-0" style={{ backgroundColor: item.variantColor }}></span>}
                                  <span className="font-bold text-[#062c24] truncate">
                                    {item.name}
                                    {item.variantLabel && <span className="text-[9px] text-teal-600 ml-1">({item.variantLabel})</span>}
                                  </span>
                                </div>
                                <span className="font-black text-emerald-600 shrink-0 ml-2">x{item.qty}</span>
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