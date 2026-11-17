"use client";

// Admin › Finance: QR top-up requests waiting for approval.

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  type TopUpRequest, approveTopUp, loadPaymentConfig, matchesPackage, paymentDetails, rejectTopUp,
} from "@/lib/credits";
import { toMillis } from "@/lib/orderFlow";
import { Chip, ConfirmSheet, primarySmallBtn, smallBtn } from "@/components/ui/kit";

function ago(ts: unknown): string {
  const ms = toMillis(ts);
  if (!ms) return "just now";
  const mins = Math.round((Date.now() - ms) / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs} h ago` : new Date(ms).toLocaleDateString("en-MY", { day: "numeric", month: "short" });
}

export default function TopUpRequests({ onChanged, notify }: { onChanged: () => void; notify: (m: string, t?: "success" | "error") => void }) {
  const [items, setItems] = useState<TopUpRequest[]>([]);
  const [packages, setPackages] = useState(paymentDetails(null).packages);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ r: TopUpRequest; kind: "approve" | "reject" } | null>(null);

  useEffect(() => {
    loadPaymentConfig().then(c => setPackages(paymentDetails(c).packages));
    return onSnapshot(query(collection(db, "topups"), where("status", "==", "pending")), snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as TopUpRequest)).sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt)));
    }, () => setItems([]));
  }, []);

  async function approve(r: TopUpRequest) {
    setBusy(r.id);
    try {
      const res = await approveTopUp(r.id);
      notify(res === "approved" ? `${r.credits} credits added to ${r.vendorName}` : "Already handled");
      onChanged();
    } catch (e) { console.error(e); notify("Could not approve", "error"); }
    finally { setBusy(null); setConfirming(null); }
  }

  async function reject(r: TopUpRequest, reason: string) {
    setBusy(r.id);
    try { await rejectTopUp(r.id, reason); notify("Request rejected"); setConfirming(null); }
    catch (e) { console.error(e); notify("Could not reject", "error"); }
    finally { setBusy(null); }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 style={{ textTransform: "none" }} className="text-[15px] font-bold text-[#062c24]">Top-up requests</h2>
        <Chip tone={items.length ? "warn" : "neutral"}>{items.length ? `${items.length} waiting` : "None waiting"}</Chip>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-600">When a vendor pays by QR and uploads a receipt, it shows here for you to approve.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map(r => {
            const ok = matchesPackage(r, packages);
            return (
              <div key={r.id} className="border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-slate-900 truncate">{r.vendorName}</p>
                    <p className="text-[13px] text-slate-600">{r.credits} credits · <b className="text-slate-900">RM {r.price}</b> · {ago(r.createdAt)}</p>
                    <p className="text-[13px] text-slate-600">Reference <b className="text-slate-900 tracking-wider">{r.reference}</b></p>
                  </div>
                  {r.receiptUrl ? (
                    <a href={r.receiptUrl} target="_blank" rel="noreferrer" className={`${smallBtn} shrink-0 flex items-center`}>
                      <i className="fas fa-receipt mr-1.5" aria-hidden="true"></i>Receipt
                    </a>
                  ) : <Chip>No receipt</Chip>}
                </div>
                {!ok && (
                  <p className="text-xs font-semibold text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    This price does not match any package. Check the amount paid before approving.
                  </p>
                )}
                <div className="flex gap-2">
                  <button type="button" disabled={busy === r.id} onClick={() => setConfirming({ r, kind: "approve" })} className={`${primarySmallBtn} flex-1`}>
                    {busy === r.id ? "Adding" : `Approve · add ${r.credits}`}
                  </button>
                  <button type="button" disabled={busy === r.id} onClick={() => setConfirming({ r, kind: "reject" })} className={smallBtn}>Reject</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {confirming?.kind === "approve" && (
        <ConfirmSheet title={`Add ${confirming.r.credits} credits to ${confirming.r.vendorName}?`} confirmLabel="Approve and add credits"
          busy={busy === confirming.r.id} onClose={() => setConfirming(null)} onConfirm={() => approve(confirming.r)}
          body={<p>Only approve if <b>RM {confirming.r.price}</b> with reference <b>{confirming.r.reference}</b> is in the bank account.</p>} />
      )}
      {confirming?.kind === "reject" && (
        <ConfirmSheet title="Reject this request?" confirmLabel="Reject request" tone="danger"
          busy={busy === confirming.r.id} onClose={() => setConfirming(null)} onConfirm={reason => reject(confirming.r, reason)}
          reason={{ label: "Reason the vendor will see", placeholder: "e.g. Payment not found in the bank account", required: true }} />
      )}
    </div>
  );
}
