"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDoc, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { getDownloadURL, getStorage, ref } from "firebase/storage";
import { db } from "@/lib/firebase";
import { generateAgreementPDF, buildAgreementMeta } from "@/lib/agreementPDF";
import { Private, usePrivacy } from "@/lib/privacy";
import { summaryFromLegacy, summaryFromOrder, type LegacyBooking, type RentalSummary } from "@/lib/rentalSummary";
import type { Order } from "@/lib/orderFlow";
import { vendorTerms, generalTerms, type AgreementVendor } from "@/lib/agreementDocument";
import { EmptyState, SectionTitle, Chip, smallBtn, hintCls } from "@/components/ui/kit";

export type Agreement = {
  id: string;
  customerName: string;
  customerPhone?: string;
  timestamp?: { toDate?: () => Date };
  /** "ic" | "passport". Set on agreements signed after photo uploads were removed. */
  idType?: string;
  idNumber?: string;
  /** Older agreements only: private IC photo paths. */
  icFrontPath?: string;
  icBackPath?: string;
  /** The cart as the customer saw it when signing (newer agreements). */
  rentalSummary?: RentalSummary | null;
  /** Older agreements: a small summary, or "Manual/Chat Booking". */
  bookingDetails?: LegacyBooking | string;
  orderId?: string | null;
  /** Signing record (newer agreements): exactly what both parties signed. */
  vendorTerms?: string[];
  generalTerms?: string[];
  customerSignature?: string;
  customerSignedAt?: string;
  vendorSignedAt?: string;
  verificationCode?: string;
};

type VendorBits = Partial<AgreementVendor>;

/** Open a private IC photo (older agreements) in a new tab. */
export async function openIcPhoto(path?: string): Promise<boolean> {
  if (!path) return false;
  try { window.open(await getDownloadURL(ref(getStorage(), path)), "_blank"); return true; }
  catch { return false; }
}

/** Build and download the signed agreement PDF (with IC photos for older agreements). */
export async function downloadAgreement(a: Agreement, vendor: VendorBits): Promise<void> {
  let frontUrl = "", backUrl = "";
  if (a.icFrontPath && a.icBackPath) {
    try {
      const storage = getStorage();
      [frontUrl, backUrl] = await Promise.all([getDownloadURL(ref(storage, a.icFrontPath)), getDownloadURL(ref(storage, a.icBackPath))]);
    } catch (e) { console.warn("IC photos unavailable for PDF:", e); }
  }
  const rental = await agreementSummary(a);
  const ts = a.timestamp?.toDate?.() || new Date();
  const signedAt = a.customerSignedAt ? new Date(a.customerSignedAt) : ts;
  generateAgreementPDF({
    vendor: { ...vendor, name: vendor.name || "" },
    customer: { name: a.customerName, phone: a.customerPhone, idType: a.idType, idNumber: a.idNumber },
    rental,
    // The terms as signed; older agreements fall back to the vendor's current rules.
    vendorTerms: a.vendorTerms?.length ? a.vendorTerms : vendorTerms(vendor.rules),
    generalTerms: a.generalTerms?.length ? a.generalTerms : generalTerms(),
    refNo: buildAgreementMeta(signedAt, a.id).refNo,
    vendorSignedAt: a.vendorSignedAt ? new Date(a.vendorSignedAt) : signedAt,
    customerSignedAt: signedAt,
    customerSignature: a.customerSignature || a.customerName,
    verificationCode: a.verificationCode,
    photos: frontUrl && backUrl ? { frontUrl, backUrl } : undefined,
  });
}

/** What was rented: the copy saved at signing, else the linked order, else the old summary. */
export async function agreementSummary(a: Agreement): Promise<RentalSummary | null> {
  if (a.rentalSummary) return a.rentalSummary;
  if (a.orderId) {
    try {
      const snap = await getDoc(doc(db, "orders", a.orderId));
      if (snap.exists()) return summaryFromOrder({ id: snap.id, ...snap.data() } as Order);
    } catch { /* fall through */ }
  }
  return a.bookingDetails && typeof a.bookingDetails !== "string" ? summaryFromLegacy(a.bookingDetails) : null;
}

export function useVendorBits(vendorId: string): VendorBits {
  const [v, setV] = useState<VendorBits>({});
  useEffect(() => { if (!vendorId) return; getDoc(doc(db, "vendors", vendorId)).then(s => setV((s.data() || {}) as VendorBits)).catch(() => {}); }, [vendorId]);
  return v;
}

/** All signed agreements, with the general link for walk-in customers. */
export default function AgreementsView({ vendorId, onOpenOrder, toast }: { vendorId: string; onOpenOrder: (orderId: string) => void; toast: (m: string, t?: "success" | "error") => void }) {
  const [list, setList] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const vendor = useVendorBits(vendorId);
  const privacy = usePrivacy();
  const link = typeof window !== "undefined" ? `${window.location.origin}/agreement?v=${vendorId}` : "";

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "agreements"), where("vendorId", "==", vendorId), orderBy("timestamp", "desc")),
      snap => { setList(snap.docs.map(d => ({ id: d.id, ...d.data() } as Agreement))); setLoading(false); },
      e => { console.error("Agreements listener error:", e); setLoading(false); });
    return () => unsub();
  }, [vendorId]);

  function pdf(a: Agreement) {
    privacy.guard(() => { void pdfNow(a); }, "The agreement shows the customer's name, number, ID and the amounts.");
  }

  async function pdfNow(a: Agreement) {
    setBusy(a.id);
    try { await downloadAgreement(a, vendor); } catch { toast("Could not create the PDF", "error"); }
    finally { setBusy(null); }
  }

  const unlinked = list.filter(a => !a.orderId).length;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-2.5">
        <span className="text-[15px] font-bold text-[#062c24]">Agreement link for walk-in customers</span>
        <p className={hintCls}>For bookings made outside your shop page. Customers fill in their name, WhatsApp, IC or passport number and sign. For shop orders, send the link from the order instead, so it links automatically.</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => { navigator.clipboard.writeText(link); toast("Link copied"); }} className={`${smallBtn} flex-1`}>
            <i className="fas fa-copy mr-1.5" aria-hidden="true"></i>Copy link
          </button>
          <a href={`https://wa.me/?text=${encodeURIComponent(`Hi, please complete the rental agreement for your booking:\n\n${link}\n\nEnter your name, WhatsApp number and IC or passport number, then sign. Thank you!`)}`}
            target="_blank" rel="noreferrer" className={`${smallBtn} flex-1 flex items-center justify-center`}>
            <i className="fab fa-whatsapp mr-1.5" aria-hidden="true"></i>Share on WhatsApp
          </a>
        </div>
      </div>

      <SectionTitle>{`Signed agreements · ${list.length}`}{unlinked ? ` (${unlinked} not linked to an order)` : ""}</SectionTitle>

      {loading ? (
        <div className="h-24 bg-white border border-slate-200 rounded-2xl animate-pulse" />
      ) : list.length === 0 ? (
        <EmptyState icon="fa-file-signature" title="No signed agreements yet" body="They appear here as soon as a customer signs." />
      ) : list.map(a => {
        const when = a.timestamp?.toDate?.();
        return (
          <div key={a.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-slate-900 truncate"><Private kind="name" text={a.customerName}>{a.customerName}</Private></p>
                {a.idNumber && <p className="text-[13px] text-slate-800 font-semibold tracking-wide">{a.idType === "passport" ? "Passport No." : "IC No."} <Private kind="id">{a.idNumber}</Private></p>}
                <p className="text-[13px] text-slate-600">
                  {a.customerPhone && <><Private kind="phone">{a.customerPhone}</Private>{when ? " · " : ""}</>}
                  {when?.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              {a.orderId ? <Chip tone="good">Linked</Chip> : <Chip tone="warn">Not linked</Chip>}
            </div>
            <div className="flex flex-wrap gap-2">
              {a.orderId && <button type="button" onClick={() => onOpenOrder(a.orderId!)} className={smallBtn}>Open order</button>}
              <button type="button" disabled={busy === a.id} onClick={() => pdf(a)} className={smallBtn}>{busy === a.id ? "Creating PDF" : "Download PDF"}</button>
              {a.icFrontPath && <button type="button" onClick={() => privacy.guard(async () => { if (!(await openIcPhoto(a.icFrontPath))) toast("Could not open the photo", "error"); }, "This opens the customer's IC photo.")} className={smallBtn}>IC front</button>}
              {a.icBackPath && <button type="button" onClick={() => privacy.guard(async () => { if (!(await openIcPhoto(a.icBackPath))) toast("Could not open the photo", "error"); }, "This opens the customer's IC photo.")} className={smallBtn}>IC back</button>}
            </div>
            {!a.orderId && <p className={hintCls}>To link it, open the order and choose &ldquo;Link a signed agreement&rdquo;.</p>}
          </div>
        );
      })}
    </div>
  );
}
