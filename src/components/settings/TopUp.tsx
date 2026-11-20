"use client";

// Credit top-up by bank QR: the payment sheet and the vendor's request list.

import { usePrivacy } from "@/lib/privacy";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  type CreditPackage, type TopUpRequest, isReceiptFile, makeReference, submitTopUpRequest, topUpWhatsAppLink,
} from "@/lib/credits";
import { BottomSheet, Chip, hintCls, primaryBtn, secondaryBtn, smallBtn } from "@/components/ui/kit";
import { toMillis } from "@/lib/orderFlow";

type Details = { qrImageUrl: string; accountName: string; adminWhatsApp: string };

export function TopUpSheet({ pkg, details, vendorId, vendorName, onClose, toast }: {
  pkg: CreditPackage; details: Details; vendorId: string; vendorName: string;
  onClose: () => void; toast: (m: string, t?: "success" | "error") => void;
}) {
  const [reference] = useState(() => makeReference());
  const [receipt, setReceipt] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ receiptUrl: string | null } | null>(null);

  function pick(f: File | undefined) {
    if (!f) return;
    if (!isReceiptFile(f)) { setFileError("Use a photo, screenshot or PDF under 5 MB."); setReceipt(null); return; }
    setFileError(""); setReceipt(f);
  }

  async function submit() {
    const uid = auth.currentUser?.uid;
    if (!uid || !receipt) return;
    setBusy(true);
    try { setSent(await submitTopUpRequest({ vendorId, vendorName, uid, pkg, reference, receipt })); }
    catch { toast("Could not send your request. Please try again.", "error"); }
    finally { setBusy(false); }
  }

  const waLink = topUpWhatsAppLink(details.adminWhatsApp, { vendorName, credits: pkg.credits, price: pkg.price, reference, receiptUrl: sent?.receiptUrl });

  if (sent) {
    return (
      <BottomSheet title="Request sent" onClose={onClose}>
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex gap-3">
          <i className="fas fa-check-circle text-emerald-700 mt-0.5" aria-hidden="true"></i>
          <p className="text-sm text-emerald-900">We will add <b>{pkg.credits} credits</b> once your payment is checked. You will see it here.</p>
        </div>
        <p className="text-sm text-slate-700">Last step: send it to us on WhatsApp so we can approve it faster.</p>
        <a href={waLink} target="_blank" rel="noreferrer" className={`${primaryBtn} flex items-center justify-center`}>
          <i className="fab fa-whatsapp mr-2" aria-hidden="true"></i>Send on WhatsApp
        </a>
        <button type="button" onClick={onClose} className={secondaryBtn}>Done</button>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet title={`Buy ${pkg.credits} credits`} onClose={onClose}>
      <div className="bg-[#062c24] text-white rounded-2xl px-4 py-3.5 flex items-center justify-between">
        <div>
          <p className="text-xs text-emerald-100">Pay</p>
          <p className="text-[26px] font-bold leading-tight">RM {pkg.price}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-emerald-100">To</p>
          <p className="text-[15px] font-bold">{details.accountName}</p>
        </div>
      </div>

      <ol className="flex flex-col gap-4">
        <li className="flex flex-col gap-2">
          <p className="text-sm font-bold text-slate-900">1. Scan the QR in your banking app</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={details.qrImageUrl} alt={`DuitNow QR for ${details.accountName}`} className="w-full max-w-[260px] self-center rounded-2xl border border-slate-200" />
          <a href={details.qrImageUrl} download="pacak-khemah-payment-qr.png" className={`${smallBtn} self-center flex items-center`}>
            <i className="fas fa-download mr-1.5" aria-hidden="true"></i>Save QR image
          </a>
          <p className={hintCls}>Paying from this phone? Save the QR, then in your banking app choose Scan and pick it from your photos.</p>
        </li>

        <li className="flex flex-col gap-2">
          <p className="text-sm font-bold text-slate-900">2. Put this as the payment reference</p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 flex items-center justify-between gap-3">
            <span className="text-lg font-bold tracking-widest text-[#062c24]">{reference}</span>
            <button type="button" className={smallBtn} onClick={() => { navigator.clipboard?.writeText(reference); toast("Reference copied"); }}>Copy</button>
          </div>
        </li>

        <li className="flex flex-col gap-2">
          <p className="text-sm font-bold text-slate-900">3. Upload your receipt</p>
          <label className={`min-h-[60px] rounded-xl border-2 border-dashed px-3.5 py-3 flex items-center gap-3 cursor-pointer ${receipt ? "border-emerald-400 bg-emerald-50" : "border-slate-300 bg-white hover:bg-slate-50"}`}>
            <i className={`fas ${receipt ? "fa-file-circle-check text-emerald-700" : "fa-receipt text-slate-500"} text-lg`} aria-hidden="true"></i>
            <span className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-slate-900 truncate">{receipt ? receipt.name : "Choose a screenshot or PDF"}</span>
              <span className={hintCls}>{receipt ? "Tap to change" : "The confirmation screen from your bank"}</span>
            </span>
            <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={e => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {fileError && <p className="text-xs font-semibold text-red-700">{fileError}</p>}
        </li>
      </ol>

      <button type="button" onClick={submit} disabled={!receipt || busy} className={primaryBtn}>
        {busy ? "Sending" : "I have paid, send for approval"}
      </button>
      <p className={`${hintCls} text-center`}>Credits are added after we check the payment, usually within a few hours.</p>
    </BottomSheet>
  );
}

const STATUS: Record<TopUpRequest["status"], { label: string; tone: "warn" | "good" | "danger" }> = {
  pending: { label: "Waiting for approval", tone: "warn" },
  approved: { label: "Added", tone: "good" },
  rejected: { label: "Not approved", tone: "danger" },
};

/** The vendor's recent requests, live. */
export function TopUpRequests({ vendorId, adminWhatsApp }: { vendorId: string; adminWhatsApp: string }) {
  const [items, setItems] = useState<TopUpRequest[]>([]);
  const privacy = usePrivacy();
  useEffect(() => {
    if (!vendorId) return;
    return onSnapshot(query(collection(db, "topups"), where("vendorId", "==", vendorId)), snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as TopUpRequest)));
    }, () => setItems([]));
  }, [vendorId]);

  const recent = [...items].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)).slice(0, 3);
  if (!recent.length) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] font-semibold text-slate-700">Recent top-ups</p>
      {recent.map(r => (
        <div key={r.id} className="border border-slate-200 rounded-xl px-3.5 py-2.5 flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-slate-900">{privacy.on ? "•• credits · RM ••••" : `${r.credits} credits · RM ${r.price}`}</span>
            <Chip tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Chip>
          </div>
          <span className={hintCls}>Reference {r.reference}{r.status === "rejected" && r.rejectReason ? ` · ${r.rejectReason}` : ""}</span>
          {r.status === "pending" && (
            <a href={topUpWhatsAppLink(adminWhatsApp, r)} target="_blank" rel="noreferrer" className="text-[13px] font-semibold text-emerald-800 min-h-9 flex items-center">
              <i className="fab fa-whatsapp mr-1.5" aria-hidden="true"></i>Remind us on WhatsApp
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
