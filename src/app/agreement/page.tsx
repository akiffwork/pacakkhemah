"use client";

import { useEffect, useState, Suspense, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { generateAgreementPDF, buildAgreementMeta } from "@/lib/agreementPDF";
import { formatIdNumber, idNumberError, idLine, type IdType } from "@/lib/customerId";
import { summaryFromOrder, summaryFromLegacy, durationLabel, formatLongDate, type LegacyBooking, type RentalSummary } from "@/lib/rentalSummary";
import {
  AGREEMENT_TITLE, SECTION_TITLES, vendorTerms, generalTerms, declarationText, shopAddress, socialLinks,
  formatSignedAt, verificationCode, signatureMatches, type AgreementVendor, type AgreementDoc,
} from "@/lib/agreementDocument";
import { toMillis, type Order } from "@/lib/orderFlow";
import RentalItems from "@/components/orders/RentalItems";
import AgreementIcon from "@/components/AgreementIcon";

/** What is being rented, the order it belongs to, and when the vendor issued it. */
type BookingData = { orderId?: string; summary: RentalSummary | null; issuedAt?: Date };
type Signed = { refNo: string; signedAt: Date; vendorSignedAt: Date; code: string };

const inputCls = "w-full bg-white border border-slate-300 px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 transition-all";

// Convert local phone (012-345 6789) to international (60123456789)
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("60")) return digits;
  if (digits.startsWith("0")) return "60" + digits.slice(1);
  return digits ? "60" + digits : "";
}

function Section({ n, children, aside }: { n: number; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="mt-8 break-inside-avoid" aria-labelledby={`sec-${n}`}>
      <div className="flex items-center gap-2.5 mb-3">
        <span className="text-[10px] font-extrabold text-white bg-[#062c24] rounded px-1.5 py-0.5 tracking-wide">{String(n).padStart(2, "0")}</span>
        <h2 id={`sec-${n}`} className="text-[12px] font-extrabold text-[#062c24] uppercase tracking-[0.12em]" style={{ textTransform: "uppercase" }}>{SECTION_TITLES[n - 1]}</h2>
        <span className="flex-1 h-px bg-slate-200" />
        {aside}
      </div>
      {children}
    </section>
  );
}

function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{children}</label>;
}

function Stamp({ pending }: { pending?: boolean }) {
  return pending
    ? <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">Awaiting signature</span>
    : <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5"><AgreementIcon name="check" />Digitally signed</span>;
}

function AgreementContent() {
  const searchParams = useSearchParams();
  const vendorId = searchParams.get("v");
  const orderIdParam = searchParams.get("o");
  const dataParam = searchParams.get("d");

  const [vendor, setVendor] = useState<AgreementVendor | null>(null);
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signed, setSigned] = useState<Signed | null>(null);

  // Customer details
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [idType, setIdType] = useState<IdType>("ic");
  const [idNumber, setIdNumber] = useState("");
  const [idTouched, setIdTouched] = useState(false);
  const idError = idNumberError(idType, idNumber);
  // Signature
  const [signature, setSignature] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!vendorId) { setError("Invalid agreement link."); setLoading(false); return; }

    async function init() {
      try {
        const vSnap = await getDoc(doc(db, "vendors", vendorId!));
        if (!vSnap.exists()) { setError("Vendor link expired or invalid."); setLoading(false); return; }
        const v = vSnap.data() as AgreementVendor;
        setVendor({ name: v.name || "Vendor", slug: v.slug, image: v.image, phone: v.phone, city: v.city, ig: v.ig, tiktok: v.tiktok, fb: v.fb, threads: v.threads, rules: v.rules });

        // The order is the source of truth: it holds the cart exactly as the
        // customer saw it. Order docs are readable by ID (the ID is the link's
        // bearer token). Older links also carried a small summary (?d=), used
        // only if the order can't be read.
        const fromOrder = async (orderId: string): Promise<Omit<BookingData, "orderId"> | null> => {
          try {
            const snap = await getDoc(doc(db, "orders", orderId));
            if (snap.exists()) {
              const o = { id: snap.id, ...snap.data() } as Order;
              if (o.vendorId && o.vendorId !== vendorId) return null;
              const ms = toMillis(o.agreementSentAt) || toMillis(o.confirmedAt) || toMillis(o.createdAt);
              return { summary: summaryFromOrder(o), issuedAt: ms ? new Date(ms) : undefined };
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
          const o = await fromOrder(orderIdParam);
          setBooking({ orderId: orderIdParam, summary: o?.summary || fromData(), issuedAt: o?.issuedAt });
        } else {
          // Same-browser flow right after checkout
          try {
            const stored = localStorage.getItem("current_booking");
            const parsed = stored ? JSON.parse(stored) : null;
            if (parsed?.vendorId === vendorId) {
              const o = parsed.orderId ? await fromOrder(parsed.orderId) : null;
              setBooking({ orderId: parsed.orderId, summary: o?.summary || summaryFromLegacy(parsed as LegacyBooking), issuedAt: o?.issuedAt });
            }
          } catch { /* ignore */ }
        }

        // Auto-fill returning customer info
        try {
          const saved = localStorage.getItem("pk_customer");
          if (saved) {
            const { name, phone } = JSON.parse(saved);
            if (name) setCustName(n => n || name);
            if (phone) setCustPhone(p => p || (phone.startsWith("60") ? "0" + phone.slice(2) : phone));
          }
        } catch { /* ignore */ }

        setLoading(false);
      } catch {
        setError("System error. Please try again.");
        setLoading(false);
      }
    }
    init();
  }, [vendorId, orderIdParam, dataParam]);

  const terms = vendorTerms(vendor?.rules);
  const general = generalTerms();
  const idText = idNumber && !idError ? idLine(idType, idNumber.trim()) : "";
  const sigOk = signatureMatches(signature, custName);

  const problems = [
    !custName.trim() && "Enter your full name in Section 1.",
    !custPhone.trim() && "Enter your WhatsApp number in Section 1.",
    idError && `${idError.replace(/\.$/, "")} (Section 1).`,
    !sigOk && (signature.trim() ? "Your signature must match your full name exactly." : "Type your full name to sign."),
    !agreed && "Tick the box to confirm you agree.",
  ].filter(Boolean) as string[];

  function buildDoc(s?: Signed): AgreementDoc {
    return {
      vendor: vendor || { name: "Vendor" },
      customer: { name: custName.trim(), phone: formatPhone(custPhone) || undefined, idType, idNumber: idNumber.trim() || undefined },
      rental: booking?.summary || null,
      vendorTerms: terms,
      generalTerms: general,
      refNo: s?.refNo,
      vendorSignedAt: s?.vendorSignedAt || booking?.issuedAt,
      customerSignedAt: s?.signedAt,
      customerSignature: s ? signature.trim() : undefined,
      verificationCode: s?.code,
    };
  }

  async function submitAgreement() {
    setTried(true);
    if (problems.length) { if (idError) setIdTouched(true); return; }
    setSubmitting(true);
    try {
      const signedAt = new Date();
      const vendorSignedAt = booking?.issuedAt || signedAt;
      const customer = { name: custName.trim(), phone: formatPhone(custPhone), idType, idNumber: idNumber.trim() };
      const rentalSummary = booking?.summary ? JSON.parse(JSON.stringify(booking.summary)) : null;
      // Fingerprint of exactly what was signed, printed on the agreement.
      const code = await verificationCode({
        vendorId, orderId: booking?.orderId || null, vendor: vendor?.name, customer, signature: signature.trim(),
        rental: rentalSummary, vendorTerms: terms, generalTerms: general,
        vendorSignedAt: vendorSignedAt.toISOString(), customerSignedAt: signedAt.toISOString(),
      });

      const ref = await addDoc(collection(db, "agreements"), {
        vendorId,
        customerName: customer.name,
        customerPhone: customer.phone,
        idType,
        idNumber: customer.idNumber,
        orderId: booking?.orderId || null,
        // What the customer saw and signed for, kept with the agreement.
        rentalSummary,
        vendorTerms: terms,
        generalTerms: general,
        customerSignature: signature.trim(),
        customerSignedAt: signedAt.toISOString(),
        vendorSignedAt: vendorSignedAt.toISOString(),
        verificationCode: code,
        timestamp: serverTimestamp(),
        status: "signed",
        userAgent: navigator.userAgent,
      });
      // Cloud Function links the order, bumps the vendor's tally and notifies them.

      setSigned({ refNo: buildAgreementMeta(signedAt, ref.id).refNo, signedAt, vendorSignedAt, code });
      window.scrollTo({ top: 0, behavior: "smooth" });

      try {
        localStorage.setItem("pk_customer", JSON.stringify({ name: customer.name, phone: customer.phone, lastVisit: signedAt.toISOString() }));
      } catch { /* ignore */ }
    } catch (e) {
      console.error(e);
      alert("Could not submit. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-100">
      <div className="bg-white p-10 rounded-2xl max-w-sm w-full text-center shadow-sm border border-slate-200">
        <i className="fas fa-exclamation-circle text-4xl text-red-500 mb-4 block" aria-hidden="true"></i>
        <h1 className="text-xl font-extrabold text-[#062c24] mb-2" style={{ textTransform: "none" }}>Invalid link</h1>
        <p className="text-sm text-slate-600">{error}</p>
      </div>
    </div>
  );

  const v = vendor;
  const summary = booking?.summary || null;
  const links = v ? socialLinks(v) : [];
  const ro = !!signed; // read-only once signed
  const period = summary?.dates
    ? `${formatLongDate(summary.dates.start)} – ${formatLongDate(summary.dates.end)}${summary.nights != null ? ` · ${durationLabel(summary.nights)}` : ""}`
    : "As agreed in chat";

  return (
    <div className="min-h-screen bg-slate-100 py-6 sm:py-10 px-3 sm:px-6" style={{ fontFamily: "'Inter', sans-serif" }}>
      {signed && (
        <div role="status" className="max-w-[820px] mx-auto mb-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-start gap-3 flex-1">
            <AgreementIcon name="check" className="text-2xl text-emerald-600 mt-0.5" />
            <div>
              <h1 className="text-base font-extrabold text-[#062c24]" style={{ textTransform: "none" }}>Agreement signed</h1>
              <p className="text-sm text-slate-700">Both parties have signed. {v?.name} has been notified. Keep a copy for your records.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => generateAgreementPDF(buildDoc(signed))}
              className="bg-[#062c24] text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-900 transition-colors flex items-center gap-2">
              <i className="fas fa-file-pdf" aria-hidden="true"></i>Download PDF
            </button>
          </div>
        </div>
      )}

      <article className="max-w-[820px] mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Header */}
        <header className="px-5 sm:px-10 pt-6 sm:pt-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-[#062c24]">
            <div className="flex items-center gap-3 min-w-0">
              {v?.image
                ? <img src={v.image} alt="" className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-contain border border-slate-200 bg-white shrink-0" />
                : <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#062c24] text-white font-extrabold flex items-center justify-center shrink-0">{(v?.name || "PK").split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase()}</div>}
              <div className="min-w-0">
                <p className="text-base sm:text-lg font-extrabold text-[#062c24] leading-tight break-words">{v?.name || " "}</p>
                <a href={`https://${shopAddress(v?.slug)}`} target="_blank" rel="noreferrer" className="text-xs text-slate-600 hover:text-emerald-700 inline-flex items-center gap-1.5 break-all">
                  <AgreementIcon name="globe" className="text-emerald-600" />{shopAddress(v?.slug)}
                </a>
                {v?.city && <p className="text-xs text-slate-500">{v.city}</p>}
              </div>
            </div>
            <div className="flex sm:flex-col items-baseline sm:items-end gap-x-3 flex-wrap shrink-0 sm:text-right">
              <p className="text-[10px] font-extrabold tracking-[0.15em] text-emerald-700 uppercase">Rental Agreement</p>
              {signed
                ? <p className="text-xs text-slate-700">Ref <span className="font-mono font-bold">{signed.refNo}</span></p>
                : booking?.orderId ? <p className="text-xs text-slate-600">Order <span className="font-mono font-bold">{booking.orderId.slice(0, 6).toUpperCase()}</span></p> : null}
              <p className="text-xs text-slate-500">{formatLongDate(new Date(signed?.signedAt || Date.now()).toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" }))}</p>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="py-24 text-center"><i className="fas fa-spinner fa-spin text-3xl text-slate-300" aria-hidden="true"></i><span className="sr-only">Loading</span></div>
        ) : (
          <div className="px-5 sm:px-10 pb-8">
            <div className="mt-6">
              <h1 className="text-2xl font-extrabold text-[#062c24] tracking-tight" style={{ textTransform: "none" }}>{AGREEMENT_TITLE}</h1>
              <p className="text-sm text-slate-600 mt-1">Between {v?.name} and {custName.trim() || "the Customer"} · {period}</p>
            </div>

            {/* 01 Parties */}
            <Section n={1}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="border border-slate-200 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">The Vendor (Owner)</p>
                  <p className="text-base font-extrabold text-[#062c24]">{v?.name}</p>
                  <p className="text-sm text-slate-700">{shopAddress(v?.slug)}</p>
                  {v?.phone && <p className="text-sm text-slate-700">Phone: {v.phone}</p>}
                  {v?.city && <p className="text-sm text-slate-700">{v.city}</p>}
                </div>
                <div className="border border-slate-200 rounded-xl p-4 flex flex-col gap-2.5">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">The Customer (Renter)</p>
                  {ro ? (
                    <>
                      <p className="text-base font-extrabold text-[#062c24] -mt-1.5">{custName}</p>
                      <p className="text-sm text-slate-700">Phone: {formatPhone(custPhone)}</p>
                      <p className="text-sm text-slate-700">{idLine(idType, idNumber.trim())}</p>
                    </>
                  ) : (
                    <>
                      <div>
                        <Label htmlFor="cust-name">Full name (as per IC / passport)</Label>
                        <input id="cust-name" type="text" value={custName} autoComplete="name"
                          onChange={e => setCustName(e.target.value.toUpperCase())} placeholder="FULL NAME" className={`${inputCls} uppercase`} />
                      </div>
                      <div>
                        <Label htmlFor="cust-phone">WhatsApp number</Label>
                        <div className="flex">
                          <span className="flex items-center gap-1.5 bg-slate-100 border border-r-0 border-slate-300 px-3 rounded-l-lg text-sm font-semibold text-slate-600 shrink-0">
                            <AgreementIcon name="whatsapp" className="text-emerald-600" />+60
                          </span>
                          <input id="cust-phone" type="tel" value={custPhone} autoComplete="tel"
                            onChange={e => setCustPhone(e.target.value.replace(/[^0-9\-\s]/g, ""))} placeholder="012-345 6789" className={`${inputCls} rounded-l-none`} />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label htmlFor="id-number" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{idType === "ic" ? "IC number" : "Passport number"}</label>
                          <div role="radiogroup" aria-label="ID type" className="inline-flex bg-slate-100 p-0.5 rounded-lg">
                            {([["ic", "MyKad (IC)"], ["passport", "Passport"]] as const).map(([t, label]) => (
                              <button key={t} type="button" role="radio" aria-checked={idType === t}
                                onClick={() => { if (t !== idType) { setIdType(t); setIdNumber(""); setIdTouched(false); } }}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${idType === t ? "bg-white text-[#062c24] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <input id="id-number" type="text" inputMode={idType === "ic" ? "numeric" : "text"} autoComplete="off"
                          value={idNumber} onChange={e => setIdNumber(formatIdNumber(idType, e.target.value))} onBlur={() => setIdTouched(true)}
                          placeholder={idType === "ic" ? "900101-14-5678" : "e.g. A12345678"}
                          aria-invalid={idTouched && !!idError} aria-describedby="id-help"
                          className={`${inputCls} tracking-wider ${idTouched && idError ? "border-red-400 focus:border-red-500 focus:ring-red-100" : ""}`} />
                        <p id="id-help" className={`text-[11px] mt-1 ${idTouched && idError ? "text-red-600 font-semibold" : "text-slate-500"}`}>
                          {idTouched && idError ? idError : idType === "ic" ? "12 digits. The dashes are added for you." : "As printed on your passport."}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </Section>

            {/* 02 Subject of rental — the cart exactly as the customer saw it */}
            <Section n={2}>
              <div className="border border-slate-200 rounded-xl overflow-hidden text-slate-900">
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Rental period</p>
                  <p className="text-sm font-bold text-[#062c24]">{period}</p>
                </div>
                <div className="p-4">
                  {summary
                    ? <RentalItems summary={summary} />
                    : <p className="italic text-slate-500 text-sm">Items as discussed in WhatsApp / chat</p>}
                </div>
              </div>
            </Section>

            {/* 03 Vendor's rules */}
            <Section n={3}>
              <p className="text-sm text-slate-500 mb-2">Set by {v?.name}.</p>
              <ol className="list-decimal pl-5 flex flex-col gap-1.5 text-sm text-slate-700 marker:text-slate-400 marker:font-semibold">
                {terms.map((t, i) => <li key={i} className="pl-1">{t}</li>)}
              </ol>
            </Section>

            {/* 04 Validity */}
            <Section n={4}>
              <ol className="list-decimal pl-5 flex flex-col gap-1.5 text-sm text-slate-700 marker:text-slate-400 marker:font-semibold">
                {general.map((t, i) => {
                  const m = t.match(/^([^.]{2,40})\.\s+(.*)$/);
                  return <li key={i} className="pl-1">{m ? <><b className="text-slate-900">{m[1]}.</b> {m[2]}</> : t}</li>;
                })}
              </ol>
            </Section>

            {/* 05 Declaration */}
            <Section n={5}>
              <p className="text-sm text-slate-800 leading-relaxed bg-slate-50 border-l-[3px] border-emerald-600 rounded-r-lg px-4 py-3">
                {declarationText({ name: custName.trim() }, idText)}
              </p>
            </Section>

            {/* 06 Digital signatures */}
            <Section n={6}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="border border-slate-300 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">The Vendor (Owner)</p>
                  <p className="font-serif italic text-xl sm:text-2xl leading-snug text-slate-900 border-b border-slate-400 pt-2 pb-1 mt-1 mb-2 break-words">{v?.name}</p>
                  <Stamp />
                  <p className="text-sm text-slate-700 mt-2">{formatSignedAt(signed?.vendorSignedAt || booking?.issuedAt) || "Signed on issue"}</p>
                  <p className="text-xs text-slate-500">Issued through the Vendor&apos;s Pacak Khemah account</p>
                </div>

                <div className={`border rounded-xl p-4 ${ro ? "border-slate-300" : "border-emerald-600 ring-2 ring-emerald-50"}`}>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">The Customer (Renter)</p>
                  {ro ? (
                    <>
                      <p className="font-serif italic text-xl sm:text-2xl leading-snug text-slate-900 border-b border-slate-400 pt-2 pb-1 mt-1 mb-2 break-words">{signature.trim()}</p>
                      <Stamp />
                      <p className="text-sm text-slate-700 mt-2">{formatSignedAt(signed!.signedAt)}</p>
                      <p className="text-xs text-slate-500">{custName} · {idLine(idType, idNumber.trim())}</p>
                    </>
                  ) : (
                    <>
                      <label htmlFor="signature" className="sr-only">Type your full name to sign</label>
                      <input id="signature" type="text" value={signature} autoComplete="off"
                        onChange={e => setSignature(e.target.value.toUpperCase())}
                        placeholder="Type your full name to sign"
                        aria-invalid={tried && !sigOk}
                        className={`w-full font-serif italic text-2xl text-slate-900 placeholder:text-base placeholder:not-italic placeholder:font-sans placeholder:text-slate-400 border-0 border-b ${tried && !sigOk ? "border-red-400" : "border-slate-400"} bg-transparent pt-2 pb-1 mt-1 mb-2 outline-none focus:border-emerald-600`} />
                      <Stamp pending />
                      <p className={`text-xs mt-2 ${signature.trim() && !sigOk ? "text-red-600 font-semibold" : "text-slate-500"}`}>
                        {signature.trim() && !sigOk ? "Must match your full name in Section 1." : "Typing your full name is your digital signature. The date and time are added when you sign."}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {ro ? (
                <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600 border border-dashed border-slate-300 rounded-lg px-3 py-2.5">
                  <span className="flex items-center gap-2"><AgreementIcon name="shield" className="text-[#062c24]" />Signed electronically on Pacak Khemah. Valid without a handwritten signature.</span>
                  <span className="whitespace-nowrap">Verification <span className="font-mono font-bold text-slate-900">{signed!.code}</span></span>
                </div>
              ) : (
                <div className="mt-5">
                  <label className="flex gap-3 items-start cursor-pointer">
                    <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                      className="mt-0.5 w-5 h-5 accent-emerald-700 rounded cursor-pointer shrink-0" />
                    <span className="text-sm text-slate-700 leading-relaxed">
                      I have read this agreement and agree to all its terms. I understand that signing electronically is legally binding, the same as signing by hand.
                    </span>
                  </label>

                  {tried && problems.length > 0 && (
                    <div role="alert" className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                      <p className="text-sm font-bold text-red-700 mb-1">Before you sign:</p>
                      <ul className="list-disc pl-5 text-sm text-red-700">{problems.map(p => <li key={p}>{p}</li>)}</ul>
                    </div>
                  )}

                  <button type="button" onClick={submitAgreement} disabled={submitting}
                    className="mt-5 w-full bg-[#062c24] text-white py-4 rounded-xl font-bold text-sm tracking-wide shadow-sm hover:bg-emerald-900 transition-colors flex items-center justify-center gap-2.5 disabled:opacity-60 disabled:cursor-not-allowed">
                    {submitting
                      ? <><i className="fas fa-spinner fa-spin" aria-hidden="true"></i>Signing…</>
                      : <><i className="fas fa-signature" aria-hidden="true"></i>Sign agreement</>}
                  </button>
                </div>
              )}
            </Section>
          </div>
        )}

        {/* Footer */}
        <footer className="px-5 sm:px-10 pb-6">
          <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {links.map(l => (
                <a key={l.icon} href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-slate-600 hover:text-emerald-700">
                  <AgreementIcon name={l.icon} className="text-[#062c24]" />{l.label}
                </a>
              ))}
            </div>
            <span>Issued via <b className="text-[#062c24]">Pacak Khemah</b> · pacakkhemah.com</span>
          </div>
        </footer>
      </article>
    </div>
  );
}

export default function AgreementPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <i className="fas fa-spinner fa-spin text-3xl text-slate-300" aria-hidden="true"></i>
      </div>
    }>
      <AgreementContent />
    </Suspense>
  );
}
