"use client";

// Admin › Finance: QR top-up requests waiting for approval.

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  type TopUpRequest, approveTopUp, loadPaymentConfig, matchesPackage, paymentDetails, rejectTopUp,
} from "@/lib/credits";
import { toMillis } from "@/lib/orderFlow";

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
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    loadPaymentConfig().then(c => setPackages(paymentDetails(c).packages));
    return onSnapshot(query(collection(db, "topups"), where("status", "==", "pending")), snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as TopUpRequest)).sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt)));
    }, () => setItems([]));
  }, []);

  async function approve(r: TopUpRequest) {
    if (!confirm(`Add ${r.credits} credits to ${r.vendorName}?\n\nOnly approve if RM ${r.price} with reference ${r.reference} is in the bank account.`)) return;
    setBusy(r.id);
    try {
      const res = await approveTopUp(r.id);
      notify(res === "approved" ? `${r.credits} credits added to ${r.vendorName}` : "Already handled");
      onChanged();
    } catch (e) { console.error(e); notify("Could not approve", "error"); }
    finally { setBusy(null); }
  }

  async function reject(r: TopUpRequest) {
    setBusy(r.id);
    try { await rejectTopUp(r.id, reason); notify("Request rejected"); setRejecting(null); setReason(""); }
    catch (e) { console.error(e); notify("Could not reject", "error"); }
    finally { setBusy(null); }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h4 style={{ textTransform: "none" }} className="text-base font-bold text-[#062c24]">Top-up requests</h4>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${items.length ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
          {items.length ? `${items.length} waiting` : "None waiting"}
        </span>
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
                    <a href={r.receiptUrl} target="_blank" rel="noreferrer" className="shrink-0 min-h-10 px-3 rounded-xl border border-slate-300 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 flex items-center">
                      <i className="fas fa-receipt mr-1.5" aria-hidden="true"></i>Receipt
                    </a>
                  ) : <span className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600">No receipt</span>}
                </div>
                {!ok && (
                  <p className="text-xs font-semibold text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    This price does not match any package. Check the amount paid before approving.
                  </p>
                )}
                {rejecting === r.id ? (
                  <div className="flex flex-col gap-2">
                    <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason shown to the vendor, e.g. Payment not found"
                      className="w-full min-h-11 border border-slate-400 rounded-xl px-3 text-sm outline-none focus:border-[#062c24]" />
                    <div className="flex gap-2">
                      <button type="button" disabled={busy === r.id} onClick={() => reject(r)} className="flex-1 min-h-10 rounded-xl bg-red-700 text-white text-[13px] font-bold disabled:opacity-60">Reject</button>
                      <button type="button" onClick={() => { setRejecting(null); setReason(""); }} className="flex-1 min-h-10 rounded-xl border border-slate-300 text-[13px] font-semibold text-slate-700">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button type="button" disabled={busy === r.id} onClick={() => approve(r)} className="flex-1 min-h-10 rounded-xl bg-[#062c24] text-white text-[13px] font-bold hover:bg-[#0a4135] disabled:opacity-60">
                      {busy === r.id ? "Adding" : `Approve · add ${r.credits}`}
                    </button>
                    <button type="button" disabled={busy === r.id} onClick={() => setRejecting(r.id)} className="min-h-10 px-4 rounded-xl border border-slate-300 text-[13px] font-semibold text-slate-700 hover:bg-slate-50">Reject</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
