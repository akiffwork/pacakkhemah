"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, addDoc, collection, serverTimestamp, updateDoc, increment } from "firebase/firestore";
import { getStorage, ref, uploadBytes } from "firebase/storage";

type VendorData = { name: string; rules?: string[] };
type BookingData = {
  vendorId: string;
  orderId?: string;
  items: { name: string; qty: number }[];
  dates: { start: string; end: string };
  total: number;
};

const DEFAULT_RULES = [
  "Equipment must be returned in the same condition as received.",
  "Renter is liable for full replacement cost of lost or damaged items.",
];

function AgreementContent() {
  const searchParams = useSearchParams();
  const vendorId = searchParams.get("v");

  const [vendor, setVendor] = useState<VendorData | null>(null);
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [custName, setCustName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState("");
  const [backPreview, setBackPreview] = useState("");

  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!vendorId) { setError("Invalid agreement link."); setLoading(false); return; }

    async function init() {
      try {
        const vSnap = await getDoc(doc(db, "vendors", vendorId!));
        if (!vSnap.exists()) { setError("Vendor link expired or invalid."); setLoading(false); return; }
        setVendor(vSnap.data() as VendorData);

        try {
          const stored = localStorage.getItem("current_booking");
          if (stored) {
            const parsed = JSON.parse(stored) as BookingData;
            if (parsed.vendorId === vendorId) setBooking(parsed);
          }
        } catch { /* ignore */ }

        setLoading(false);
      } catch (e) {
        setError("System error. Please try again.");
        setLoading(false);
      }
    }
    init();
  }, [vendorId]);

  function handleFileChange(file: File, side: "front" | "back") {
    const reader = new FileReader();
    reader.onload = e => {
      if (side === "front") { setFrontFile(file); setFrontPreview(e.target?.result as string); }
      else { setBackFile(file); setBackPreview(e.target?.result as string); }
    };
    reader.readAsDataURL(file);
  }

  async function submitAgreement() {
    if (!custName.trim()) return alert("Please enter your full name.");
    if (!frontFile || !backFile) return alert("Please upload BOTH Front and Back of your ID.");
    if (!agreed) return alert("You must agree to the terms to proceed.");

    setSubmitting(true);
    try {
      const storage = getStorage();
      const ts = Date.now();
      const cleanName = custName.replace(/[^a-zA-Z0-9]/g, "");

      const frontStorageRef = ref(storage, `verifications/${vendorId}/${ts}_${cleanName}_FRONT`);
      const backStorageRef = ref(storage, `verifications/${vendorId}/${ts}_${cleanName}_BACK`);

      const [snapFront, snapBack] = await Promise.all([
        uploadBytes(frontStorageRef, frontFile),
        uploadBytes(backStorageRef, backFile),
      ]);

      await addDoc(collection(db, "agreements"), {
        vendorId,
        customerName: custName,
        icFrontPath: snapFront.metadata.fullPath,
        icBackPath: snapBack.metadata.fullPath,
        bookingDetails: booking || "Manual/Chat Booking",
        orderId: booking?.orderId || null,
        timestamp: serverTimestamp(),
        status: "signed",
        userAgent: navigator.userAgent,
      });

      // Update order status to confirmed if orderId exists
      if (booking?.orderId) {
        try {
          await updateDoc(doc(db, "orders", booking.orderId), {
            status: "confirmed",
            customerName: custName,
            agreementSigned: true,
            agreementSignedAt: serverTimestamp(),
          });
        } catch (e) { console.error("Order update error:", e); }
      }

      // Increment vendor order tally
      try {
        await updateDoc(doc(db, "vendors", vendorId!), {
          order_count: increment(1),
          total_orders: increment(1),
        });
      } catch (e) { console.error("Tally update error:", e); }

      setSubmitted(true);
    } catch (e) {
      console.error(e);
      alert("Upload failed. Please check your connection and try again.");
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

  // Success state
  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="bg-white p-10 rounded-[2.5rem] max-w-sm w-full text-center shadow-xl border border-slate-100">
        <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl shadow-lg animate-bounce">
          <i className="fas fa-check"></i>
        </div>
        <h2 className="text-2xl font-black text-[#062c24] uppercase mb-2">Agreement Signed</h2>
        <p className="text-xs text-slate-500 font-medium max-w-xs mx-auto mb-8">
          Your identity has been verified and the booking is now legally bound.
        </p>
        <button onClick={() => window.close()}
          className="bg-slate-100 text-slate-500 px-8 py-3 rounded-xl text-[10px] font-bold uppercase hover:bg-slate-200 transition-all">
          Close Window
        </button>
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
                    placeholder="FULL NAME AS PER IC"
                    className="w-full bg-white border border-slate-200 p-3 rounded-xl font-bold text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-50 transition-all uppercase"
                  />
                </div>
              </div>
              <div className="mt-5 p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3 items-start">
                <i className="fas fa-exclamation-circle text-amber-500 mt-0.5 text-xs shrink-0"></i>
                <p className="text-[9px] text-amber-700 font-bold leading-relaxed">
                  LEGAL NOTICE: This agreement is entered into solely between the Vendor and the Customer. "Pacak Khemah" is a technology platform provider and is NOT a party to this rental contract.
                </p>
              </div>
            </div>

            {/* Section 2 — Items */}
            <div>
              <h2 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-4">
                2. Subject of Rental
              </h2>
              <div className="border border-slate-200 rounded-3xl overflow-hidden">
                <div className="bg-slate-50 px-5 py-3 flex justify-between text-[10px] font-black text-slate-400 uppercase border-b border-slate-200">
                  <span>Item</span><span>Qty</span>
                </div>
                <div className="p-5 space-y-3 bg-white text-sm font-bold text-[#062c24]">
                  {booking?.items?.length ? (
                    booking.items.map((item, i) => (
                      <div key={i} className="flex justify-between border-b border-slate-50 pb-2 last:border-0">
                        <span>{item.name}</span>
                        <span className="text-emerald-600">x{item.qty}</span>
                      </div>
                    ))
                  ) : (
                    <p className="italic text-slate-400 font-normal text-sm">Items as discussed in WhatsApp / Chat Record</p>
                  )}
                </div>
                <div className="bg-slate-50 px-5 py-4 border-t border-slate-200 flex justify-between items-center">
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Rental Period</p>
                    <p className="font-bold text-xs flex items-center gap-2">
                      <span>{booking?.dates?.start || "TBD"}</span>
                      <i className="fas fa-arrow-right text-slate-300 text-[8px]"></i>
                      <span>{booking?.dates?.end || "TBD"}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Total Value</p>
                    <p className="font-black text-xl text-emerald-600">
                      {booking?.total ? `RM ${booking.total}` : "—"}
                    </p>
                  </div>
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

            {/* Section 4 — IC Upload */}
            <div>
              <h2 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-2">
                4. Identity Verification
              </h2>
              <p className="text-[10px] text-slate-400 mb-5 font-medium">
                Upload clear photos of your IC (Front & Back) for security verification.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Front */}
                <div className="cursor-pointer" onClick={() => frontRef.current?.click()}>
                  {frontPreview ? (
                    <div className="relative aspect-video rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-lg">
                      <img src={frontPreview} className="w-full h-full object-cover" alt="IC Front" />
                      <div className="absolute bottom-2 left-2 bg-emerald-500 text-white px-2 py-0.5 rounded-full text-[8px] font-black uppercase">
                        ✓ Front Uploaded
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-video bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center hover:bg-white hover:border-emerald-400 transition-all group">
                      <i className="fas fa-id-card text-3xl text-slate-200 mb-3 group-hover:text-emerald-400 transition-colors"></i>
                      <p className="text-[9px] font-black text-slate-400 uppercase group-hover:text-emerald-600">Tap to Upload Front</p>
                      <p className="text-[8px] text-slate-300 mt-1">IC / MyKad Front Side</p>
                    </div>
                  )}
                  <input ref={frontRef} type="file" className="hidden" accept="image/*" capture="environment"
                    onChange={e => e.target.files?.[0] && handleFileChange(e.target.files[0], "front")} />
                </div>

                {/* Back */}
                <div className="cursor-pointer" onClick={() => backRef.current?.click()}>
                  {backPreview ? (
                    <div className="relative aspect-video rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-lg">
                      <img src={backPreview} className="w-full h-full object-cover" alt="IC Back" />
                      <div className="absolute bottom-2 left-2 bg-emerald-500 text-white px-2 py-0.5 rounded-full text-[8px] font-black uppercase">
                        ✓ Back Uploaded
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-video bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center hover:bg-white hover:border-emerald-400 transition-all group">
                      <i className="fas fa-id-card text-3xl text-slate-200 mb-3 group-hover:text-emerald-400 transition-colors"></i>
                      <p className="text-[9px] font-black text-slate-400 uppercase group-hover:text-emerald-600">Tap to Upload Back</p>
                      <p className="text-[8px] text-slate-300 mt-1">IC / MyKad Back Side</p>
                    </div>
                  )}
                  <input ref={backRef} type="file" className="hidden" accept="image/*" capture="environment"
                    onChange={e => e.target.files?.[0] && handleFileChange(e.target.files[0], "back")} />
                </div>
              </div>
            </div>

            {/* Section 5 — Sign */}
            <div className="pt-6 border-t border-slate-100">
              <label className="flex gap-4 items-start mb-6 cursor-pointer group">
                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                  className="mt-1 w-5 h-5 accent-emerald-600 rounded cursor-pointer shrink-0" />
                <span className="text-[10px] font-bold text-slate-500 leading-relaxed group-hover:text-slate-700 transition-colors">
                  I hereby acknowledge that I have read and agreed to the Terms & Conditions above. I certify that the uploaded ID documents are mine. I understand that my ID will be stored securely for verification purposes by the Vendor.
                </span>
              </label>

              <button onClick={submitAgreement} disabled={submitting}
                className="w-full bg-[#062c24] text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-emerald-900 transition-all flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed">
                {submitting ? (
                  <><i className="fas fa-spinner fa-spin"></i> Securing Data...</>
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