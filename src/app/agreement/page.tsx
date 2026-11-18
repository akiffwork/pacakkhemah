"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { generateAgreementPDF, buildAgreementMeta } from "@/lib/agreementPDF";
import { formatIdNumber, idNumberError, type IdType } from "@/lib/customerId";
import { summaryFromOrder, summaryFromLegacy, durationLabel, formatLongDate, type LegacyBooking, type RentalSummary } from "@/lib/rentalSummary";
import type { Order } from "@/lib/orderFlow";
import RentalItems from "@/components/orders/RentalItems";

type VendorData = { name: string; rules?: string[] };
/** What is being rented, and the order it belongs to (if any). */
type BookingData = { orderId?: string; summary: RentalSummary | null };

const DEFAULT_RULES = [
  "Equipment must be returned in the same condition as received.",
  "Renter is liable for full replacement cost of lost or damaged items.",
];

function AgreementContent() {
  const searchParams = useSearchParams();
  const vendorId = searchParams.get("v");
  const orderIdParam = searchParams.get("o");
  const dataParam = searchParams.get("d");

  const [vendor, setVendor] = useState<VendorData | null>(null);
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [idType, setIdType] = useState<IdType>("ic");
  const [idNumber, setIdNumber] = useState("");
  const [idTouched, setIdTouched] = useState(false);
  const idError = idNumberError(idType, idNumber);

  useEffect(() => {
    if (!vendorId) { setError("Invalid agreement link."); setLoading(false); return; }

    async function init() {
      try {
        const vSnap = await getDoc(doc(db, "vendors", vendorId!));
        if (!vSnap.exists()) { setError("Vendor link expired or invalid."); setLoading(false); return; }
        setVendor(vSnap.data() as VendorData);

        // The order is the source of truth: it holds the cart exactly as the
        // customer saw it. Order docs are readable by ID (the ID is the link's
        // bearer token). Older links also carried a small summary (?d=), used
        // only if the order can't be read.
        const fromOrder = async (orderId: string): Promise<RentalSummary | null> => {
          try {
            const snap = await getDoc(doc(db, "orders", orderId));
            if (snap.exists()) {
              const o = { id: snap.id, ...snap.data() } as Order;
              if (o.vendorId && o.vendorId !== vendorId) return null;
              return summaryFromOrder(o);
            }
          } catch { /* fall back below */ }
          return null;
        };
        const fromData = (): RentalSummary | null => {
          if (!dataParam) return null;
          try { return summaryFromLegacy(JSON.parse(decodeURIComponent(escape(atob(dataParam)))) as LegacyBooking); }
          catch { return null; }
        };

        if (orderIdParam) {
          // Keep the orderId even if nothing loads, so the Cloud Function still links it.
          setBooking({ orderId: orderIdParam, summary: (await fromOrder(orderIdParam)) || fromData() });
        } else {
          // Same-browser flow right after checkout
          try {
            const stored = localStorage.getItem("current_booking");
            const parsed = stored ? JSON.parse(stored) : null;
            if (parsed?.vendorId === vendorId) {
              const summary = (parsed.orderId && await fromOrder(parsed.orderId)) || summaryFromLegacy(parsed as LegacyBooking);
              setBooking({ orderId: parsed.orderId, summary });
            }
          } catch { /* ignore */ }
        }

        // Auto-fill returning customer info
        try {
          const savedCustomer = localStorage.getItem("pk_customer");
          if (savedCustomer) {
            const { name, phone } = JSON.parse(savedCustomer);
            if (name && !custName) setCustName(name);
            if (phone && !custPhone) {
              // Convert stored 60123456789 back to local 0123456789 for display
              const localPhone = phone.startsWith("60") ? "0" + phone.slice(2) : phone;
              setCustPhone(localPhone);
            }
          }
        } catch { /* ignore */ }

        setLoading(false);
      } catch (e) {
        setError("System error. Please try again.");
        setLoading(false);
      }
    }
    init();
  }, [vendorId, orderIdParam, dataParam]);

  // Convert local phone (012-345 6789) to international (60123456789)
  function formatPhone(raw: string): string {
    const digits = raw.replace(/\D/g, "");
    if (digits.startsWith("60")) return digits; // already international
    if (digits.startsWith("0")) return "60" + digits.slice(1); // 012... → 6012...
    return "60" + digits; // bare number
  }

  async function submitAgreement() {
    if (!custName.trim()) return alert("Please enter your full name.");
    if (!custPhone.trim()) return alert("Please enter your WhatsApp number.");
    if (idError) { setIdTouched(true); return alert(idError); }
    if (!agreed) return alert("You must agree to the terms to proceed.");

    setSubmitting(true);
    try {
      await addDoc(collection(db, "agreements"), {
        vendorId,
        customerName: custName,
        customerPhone: formatPhone(custPhone),
        idType,
        idNumber: idNumber.trim(),
        // What the customer saw and signed for, kept with the agreement.
        rentalSummary: booking?.summary ? JSON.parse(JSON.stringify(booking.summary)) : null,
        orderId: booking?.orderId || null,
        timestamp: serverTimestamp(),
        status: "signed",
        userAgent: navigator.userAgent,
      });

      // Agreement saved — Cloud Function handles:
      // 1. Linking to order (updates status, customerName, customerPhone)
      // 2. Incrementing vendor order tally
      // 3. Sending push notification

      setSubmitted(true);

      // Save customer info for repeat visits
      try {
        localStorage.setItem("pk_customer", JSON.stringify({
          name: custName,
          phone: formatPhone(custPhone),
          lastVisit: new Date().toISOString(),
        }));
      } catch { /* ignore */ }
    } catch (e) {
      console.error(e);
      alert("Could not submit. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Error state
  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="bg-white p-10 rounded-[2.5rem] max-w-sm w-full text-center shadow-xl border border-slate-100">
        <i className="fas fa-exclamation-circle text-4xl text-red-400 mb-4 block"></i>
        <h2 className="text-xl font-black text-[#062c24] uppercase mb-2">Invalid Link</h2>
        <p className="text-xs text-slate-500 font-medium">{error}</p>
      </div>
    </div>
  );

  function downloadPDF() {
    const now = new Date();
    const meta = buildAgreementMeta(now, `${now.getHours()}${now.getMinutes()}`);

    generateAgreementPDF(
      { name: vendor?.name || "—" },
      { customerName: custName || "—", customerPhone: formatPhone(custPhone) || undefined, idType, idNumber: idNumber.trim() || undefined, ...meta },
      booking?.summary || null,
      vendor?.rules,
    );
  }

  // Success state
  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="bg-white p-10 rounded-[2.5rem] max-w-sm w-full text-center shadow-xl border border-slate-100">
        <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl shadow-lg animate-bounce">
          <i className="fas fa-check"></i>
        </div>
        <h2 className="text-2xl font-black text-[#062c24] uppercase mb-2">Agreement Signed</h2>
        <p className="text-xs text-slate-500 font-medium max-w-xs mx-auto mb-8">
          Your agreement has been recorded and the booking is now confirmed.
        </p>
        <div className="space-y-3">
          <button onClick={downloadPDF}
            className="w-full bg-[#062c24] text-white px-8 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-900 transition-all flex items-center justify-center gap-2 shadow-lg">
            <i className="fas fa-file-pdf"></i> Download Agreement PDF
          </button>
          <button onClick={() => window.close()}
            className="w-full bg-slate-100 text-slate-500 px-8 py-3 rounded-xl text-[10px] font-bold uppercase hover:bg-slate-200 transition-all">
            Close Window
          </button>
        </div>
      </div>
    </div>
  );

  const rules = vendor?.rules?.length ? vendor.rules : DEFAULT_RULES;

  return (
    <div className="min-h-screen py-12 px-4 bg-slate-50" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="max-w-2xl mx-auto bg-white p-8 md:p-12 rounded-[2.5rem] shadow-xl border border-slate-100 relative overflow-hidden">

        {/* Top accent bar */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-400 to-teal-500" />

        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl shadow-inner border border-emerald-100">
            <i className="fas fa-file-contract"></i>
          </div>
          <h1 className="text-3xl font-black uppercase mb-2 tracking-tight text-[#062c24]">Rental Agreement</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 inline-block px-3 py-1 rounded-full">
            Official Binding Document
          </p>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <i className="fas fa-spinner fa-spin text-3xl text-slate-200"></i>
          </div>
        ) : (
          <div className="space-y-8">

            {/* Section 1 — Parties */}
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
              <h2 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-5">
                1. Contracting Parties
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">The Vendor (Owner)</p>
                  <p className="font-black text-xl text-[#062c24]">{vendor?.name}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">The Customer (Renter)</p>
                  <input
                    type="text"
                    value={custName}
                    onChange={e => setCustName(e.target.value.toUpperCase())}
                    placeholder="FULL NAME AS PER IC / PASSPORT"
                    className="w-full bg-white border border-slate-200 p-3 rounded-xl font-bold text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-50 transition-all uppercase mb-2"
                  />
                  <div className="relative flex">
                    <span className="flex items-center gap-1.5 bg-slate-100 border border-r-0 border-slate-200 px-3 rounded-l-xl text-sm font-bold text-slate-500 shrink-0">
                      <i className="fab fa-whatsapp text-emerald-500"></i> +60
                    </span>
                    <input
                      type="tel"
                      value={custPhone}
                      onChange={e => setCustPhone(e.target.value.replace(/[^0-9\-\s]/g, ""))}
                      placeholder="012-345 6789"
                      className="w-full bg-white border border-slate-200 p-3 rounded-r-xl font-bold text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-50 transition-all"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-5 p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3 items-start">
                <i className="fas fa-exclamation-circle text-amber-500 mt-0.5 text-xs shrink-0"></i>
                <p className="text-[9px] text-amber-700 font-bold leading-relaxed">
                  LEGAL NOTICE: This agreement is entered into solely between the Vendor and the Customer. &ldquo;Pacak Khemah&rdquo; is a technology platform provider and is NOT a party to this rental contract.
                </p>
              </div>
            </div>

            {/* Section 2 — Items: the cart exactly as the customer saw it */}
            <div>
              <h2 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-4">
                2. Subject of Rental
              </h2>
              <div className="border border-slate-200 rounded-3xl overflow-hidden text-slate-900">
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <p className="text-sm font-bold text-[#062c24] flex items-center gap-2">
                    <i className="fas fa-calendar-alt text-emerald-600 text-xs" aria-hidden="true"></i>
                    {booking?.summary?.dates ? `${formatLongDate(booking.summary.dates.start)} – ${formatLongDate(booking.summary.dates.end)}` : "Dates as agreed in chat"}
                  </p>
                  {booking?.summary?.nights != null && (
                    <span className="text-xs font-bold text-slate-600">{durationLabel(booking.summary.nights)}</span>
                  )}
                </div>
                <div className="p-5 bg-white">
                  {booking?.summary
                    ? <RentalItems summary={booking.summary} emptyText="Items as discussed in WhatsApp / chat" />
                    : <p className="italic text-slate-500 text-sm">Items as discussed in WhatsApp / chat</p>}
                </div>
              </div>
            </div>

            {/* Section 3 — Rules */}
            <div>
              <h2 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-4">
                3. Terms & Conditions
              </h2>
              <ul className="space-y-2.5">
                {rules.map((rule, i) => (
                  <li key={i} className="flex gap-3 items-start text-xs font-medium text-slate-600">
                    <span className="w-5 h-5 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-black text-[9px] shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    {rule}
                  </li>
                ))}
              </ul>
            </div>

            {/* Section 4 — Identity */}
            <div>
              <h2 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-2">
                4. Identity Details
              </h2>
              <p className="text-[10px] text-slate-400 mb-4 font-medium">
                Enter your MyKad (IC) number. Not Malaysian? Choose Passport.
              </p>
              <div role="radiogroup" aria-label="ID type" className="inline-flex bg-slate-100 p-1 rounded-xl mb-3">
                {([["ic", "MyKad (IC)"], ["passport", "Passport"]] as const).map(([t, label]) => (
                  <button key={t} type="button" role="radio" aria-checked={idType === t}
                    onClick={() => { if (t !== idType) { setIdType(t); setIdNumber(""); setIdTouched(false); } }}
                    className={`px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-wide transition-all ${idType === t ? "bg-white text-[#062c24] shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>
                    {label}
                  </button>
                ))}
              </div>
              <label htmlFor="id-number" className="sr-only">{idType === "ic" ? "IC number" : "Passport number"}</label>
              <div className="relative">
                <i className="fas fa-id-card absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" aria-hidden="true"></i>
                <input
                  id="id-number"
                  type="text"
                  inputMode={idType === "ic" ? "numeric" : "text"}
                  autoComplete="off"
                  value={idNumber}
                  onChange={e => setIdNumber(formatIdNumber(idType, e.target.value))}
                  onBlur={() => setIdTouched(true)}
                  placeholder={idType === "ic" ? "900101-14-5678" : "e.g. A12345678"}
                  aria-invalid={idTouched && !!idError}
                  aria-describedby="id-help"
                  className={`w-full bg-white border p-3 pl-11 rounded-xl font-bold text-sm tracking-wider outline-none focus:ring-2 transition-all ${idTouched && idError ? "border-red-300 focus:border-red-400 focus:ring-red-50" : "border-slate-200 focus:border-emerald-500 focus:ring-emerald-50"}`}
                />
              </div>
              <p id="id-help" className={`text-[10px] mt-2 font-medium ${idTouched && idError ? "text-red-500" : "text-slate-400"}`}>
                {idTouched && idError ? idError : idType === "ic" ? "12 digits. The dashes are added for you." : "As printed on your passport."}
              </p>
            </div>

            {/* Section 5 — Sign */}
            <div className="pt-6 border-t border-slate-100">
              <label className="flex gap-4 items-start mb-6 cursor-pointer group">
                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                  className="mt-1 w-5 h-5 accent-emerald-600 rounded cursor-pointer shrink-0" />
                <span className="text-[10px] font-bold text-slate-500 leading-relaxed group-hover:text-slate-700 transition-colors">
                  I hereby acknowledge that I have read and agreed to the Terms & Conditions above. I certify that the identity number given above is mine and correct. I understand it will be kept by the Vendor for this rental only.
                </span>
              </label>

              <button onClick={submitAgreement} disabled={submitting}
                className="w-full bg-[#062c24] text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-emerald-900 transition-all flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed">
                {submitting ? (
                  <><i className="fas fa-spinner fa-spin"></i> Submitting...</>
                ) : (
                  <><span>Sign & Confirm Booking</span><i className="fas fa-signature"></i></>
                )}
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

export default function AgreementPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <i className="fas fa-spinner fa-spin text-3xl text-slate-300"></i>
      </div>
    }>
      <AgreementContent />
    </Suspense>
  );
}