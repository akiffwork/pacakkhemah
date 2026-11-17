"use client";

// Admin › Vendors: live shops, applications, suspended shops and prospects.

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, increment, query, updateDoc, where, writeBatch,
} from "firebase/firestore";
import { adjustCredits } from "@/lib/credits";
import {
  BottomSheet, Chip, ConfirmSheet, EmptyState, PageHeader, SearchInput, Segments, SwitchRow, Toast, hintCls, smallBtn, primarySmallBtn, useToast,
} from "@/components/ui/kit";
import ProspectsTab from "./ProspectsTab";
import CreditChangeSheet from "./CreditChangeSheet";
import type { AdminVendor, Badge } from "./types";

type View = "active" | "applications" | "suspended" | "prospects";
type Filter = "all" | "low" | "premium" | "demo";

const BADGES: Record<Badge, { label: string; icon: string; rule: string; manual: boolean }> = {
  verified: { label: "Verified", icon: "fa-check-circle", rule: "Shop is approved", manual: false },
  top_rated: { label: "Top rated", icon: "fa-star", rule: "30+ orders and 4.7+ rating", manual: false },
  fast_responder: { label: "Fast responder", icon: "fa-bolt", rule: "Replies within 2 hours on average", manual: false },
  id_verified: { label: "ID verified", icon: "fa-id-card", rule: "You checked their IC or SSM", manual: true },
  premium: { label: "Premium", icon: "fa-trophy", rule: "Premium partner", manual: true },
};

function autoBadges(v: AdminVendor): Badge[] {
  const out: Badge[] = [];
  if (v.status === "approved") out.push("verified");
  if ((v.total_orders || 0) >= 30 && (v.rating || 0) >= 4.7) out.push("top_rated");
  if ((v.avg_response_time || 999) <= 120) out.push("fast_responder");
  return out;
}

type Pending =
  | { kind: "approve" | "suspend" | "reactivate" | "delete" | "reward"; vendor: AdminVendor }
  | { kind: "credits" | "badges"; vendor: AdminVendor }
  | null;

export default function VendorsTab({ allVendors, initialView, initialSearch }: { allVendors: AdminVendor[]; initialView?: string; initialSearch?: string }) {
  const start: View = (["active", "applications", "suspended", "prospects"] as View[]).includes(initialView as View) ? initialView as View : "active";
  const [view, setView] = useState<View>(start);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState(initialSearch || "");
  const [reward, setReward] = useState(5);
  const [rewardOn, setRewardOn] = useState(true);
  const [open, setOpen] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast();

  useEffect(() => {
    getDoc(doc(db, "settings", "referral_config")).then(s => {
      if (!s.exists()) return;
      if (s.data().rewardCredits) setReward(s.data().rewardCredits);
      if (s.data().enabled === false) setRewardOn(false);
    }).catch(() => {});
  }, []);

  // Sheets read the live copy, so toggles show at once
  const live = (v: AdminVendor) => allVendors.find(x => x.id === v.id) || v;

  const byView = {
    active: allVendors.filter(v => v.status === "approved"),
    applications: allVendors.filter(v => v.status === "pending"),
    suspended: allVendors.filter(v => v.status === "suspended"),
  };
  const q = search.trim().toLowerCase();
  const list = view === "prospects" ? [] : byView[view]
    .filter(v => !q || [v.name, v.email, v.phone, v.slug, v.city].some(x => x?.toLowerCase().includes(q)))
    .filter(v => view !== "active" || filter === "all"
      || (filter === "low" && (v.credits || 0) <= 5)
      || (filter === "premium" && v.badges?.includes("premium"))
      || (filter === "demo" && v.is_mockup))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    try { await fn(); show(ok); setOpen(null); }
    catch (e) { console.error(e); show("Something went wrong. Please try again.", "error"); }
    finally { setBusy(false); }
  }

  async function rewardReferrer(v: AdminVendor) {
    const snap = await getDocs(query(collection(db, "vendors"), where("myReferralCode", "==", v.referredBy)));
    if (snap.empty) { await updateDoc(doc(db, "vendors", v.id), { referralRewarded: true }); return `Code ${v.referredBy} not found, marked as done`; }
    const ref = snap.docs[0];
    await adjustCredits({ vendorId: ref.id, vendorName: ref.data().name || "Vendor", type: "bonus", credits: reward, note: `Referral: ${v.name} approved` });
    await updateDoc(doc(db, "vendors", ref.id), { referral_total_referred: increment(1), referral_total_credits: increment(reward) });
    await updateDoc(doc(db, "vendors", v.id), { referralRewarded: true, referralRewardedAt: new Date().toISOString() });
    return `${ref.data().name || "The referrer"} got ${reward} credits`;
  }

  async function approve(v: AdminVendor) {
    setBusy(true);
    try {
      await updateDoc(doc(db, "vendors", v.id), { status: "approved" });
      const extra = rewardOn && v.referredBy && !v.referralRewarded ? await rewardReferrer(v).catch(() => "Referral reward failed, use Reward referrer") : "";
      show(`${v.name} approved${extra ? `. ${extra}` : ""}`);
      setOpen(null);
    } catch (e) { console.error(e); show("Could not approve", "error"); }
    finally { setBusy(false); }
  }

  async function deleteVendor(v: AdminVendor) {
    const wipe = async (col: string) => {
      const snap = await getDocs(query(collection(db, col), where("vendorId", "==", v.id)));
      for (let i = 0; i < snap.docs.length; i += 400) {
        const b = writeBatch(db); snap.docs.slice(i, i + 400).forEach(d => b.delete(d.ref)); await b.commit();
      }
    };
    for (const col of ["gear", "orders", "analytics", "reviews", "agreements"]) await wipe(col);
    for (const sub of ["availability", "settings", "discounts", "referrals", "posts", "foodPartners", "wizard"]) {
      const snap = await getDocs(collection(db, "vendors", v.id, sub));
      if (!snap.empty) { const b = writeBatch(db); snap.docs.forEach(d => b.delete(d.ref)); await b.commit(); }
    }
    await deleteDoc(doc(db, "vendors", v.id));
  }

  const tabs = [
    { key: "active" as View, label: `Live · ${byView.active.length}` },
    { key: "applications" as View, label: `Applications · ${byView.applications.length}`, tone: byView.applications.length ? "warn" as const : undefined },
    { key: "suspended" as View, label: `Suspended · ${byView.suspended.length}` },
    { key: "prospects" as View, label: "Prospects" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Vendors" subtitle="Shops, applications and vendors you are reaching out to" />
      <Segments label="Vendor lists" value={view} onChange={setView} items={tabs} />

      {view === "prospects" ? <ProspectsTab allVendors={allVendors} /> : (
        <>
          <SearchInput id="vendor-search" value={search} onChange={setSearch} placeholder="Search name, email, phone or city" />
          {view === "active" && (
            <Segments label="Filter shops" role="group" value={filter} onChange={setFilter} items={[
              { key: "all", label: "All" },
              { key: "low", label: "5 credits or fewer" },
              { key: "premium", label: "Premium" },
              { key: "demo", label: "Demo shops" },
            ]} />
          )}

          {list.length === 0 ? (
            <EmptyState icon="fa-store" title={q ? "No shops match your search" : view === "applications" ? "No applications waiting" : view === "suspended" ? "No suspended shops" : "No shops here"} />
          ) : (
            <div className="grid lg:grid-cols-2 gap-3">
              {list.map(v => {
                const badges = [...new Set([...autoBadges(v), ...(v.badges || [])])];
                const credits = v.credits || 0;
                return (
                  <article key={v.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      {v.image
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={v.image} alt="" className="w-11 h-11 rounded-xl object-cover border border-slate-200 shrink-0" />
                        : <span className="w-11 h-11 rounded-xl bg-[#062c24] text-white font-bold flex items-center justify-center shrink-0" aria-hidden="true">{(v.name || "?")[0].toUpperCase()}</span>}
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-bold text-slate-900 truncate">{v.name}</p>
                        <p className="text-[13px] text-slate-600 truncate">{[v.city, v.phone].filter(Boolean).join(" · ") || v.email || "No contact details"}</p>
                      </div>
                      <span className={`text-right shrink-0 ${credits <= 0 ? "text-red-800" : credits <= 5 ? "text-amber-800" : "text-emerald-800"}`}>
                        <span className="block text-lg font-bold leading-tight">{credits}</span><span className="text-xs">credits</span>
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {v.status === "pending" && <Chip tone="warn">Waiting for approval</Chip>}
                      {v.status === "suspended" && <Chip tone="danger">Suspended</Chip>}
                      {v.is_mockup && <Chip tone="violet">Demo shop</Chip>}
                      {v.is_vacation && <Chip>On holiday</Chip>}
                      {v.status !== "pending" && badges.map(b => BADGES[b] && <Chip key={b} tone={b === "premium" ? "violet" : "good"}>{BADGES[b].label}</Chip>)}
                      {v.referredBy && <Chip tone={v.referralRewarded ? "neutral" : "info"}>Invited by {v.referredBy}{v.referralRewarded ? " · rewarded" : ""}</Chip>}
                    </div>

                    {v.slug
                      ? <a href={`/shop/${v.slug}`} target="_blank" rel="noreferrer" className="text-[13px] font-semibold text-emerald-800 truncate">pacakkhemah.com/shop/{v.slug}</a>
                      : <p className={hintCls}>No shop link yet</p>}

                    <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
                      {v.status === "pending" && <button type="button" className={primarySmallBtn} onClick={() => setOpen({ kind: "approve", vendor: v })}>Approve</button>}
                      {v.status === "suspended" && <button type="button" className={primarySmallBtn} onClick={() => setOpen({ kind: "reactivate", vendor: v })}>Reactivate</button>}
                      <button type="button" className={smallBtn} onClick={() => setOpen({ kind: "credits", vendor: v })}><i className="fas fa-coins mr-1.5" aria-hidden="true"></i>Credits</button>
                      <button type="button" className={smallBtn} onClick={() => setOpen({ kind: "badges", vendor: v })}><i className="fas fa-award mr-1.5" aria-hidden="true"></i>Badges</button>
                      <a href={`/store?admin_override=${v.id}`} target="_blank" rel="noreferrer" className={`${smallBtn} flex items-center`}><i className="fas fa-key mr-1.5" aria-hidden="true"></i>Open dashboard</a>
                      {rewardOn && v.referredBy && !v.referralRewarded && v.status === "approved" && (
                        <button type="button" className={smallBtn} onClick={() => setOpen({ kind: "reward", vendor: v })}><i className="fas fa-gift mr-1.5" aria-hidden="true"></i>Reward referrer</button>
                      )}
                      {v.status === "approved" && <button type="button" className={smallBtn} onClick={() => setOpen({ kind: "suspend", vendor: v })}>Suspend</button>}
                      <button type="button" className={`${smallBtn} text-red-800 border-red-200`} onClick={() => setOpen({ kind: "delete", vendor: v })}>{v.status === "pending" ? "Reject and delete" : "Delete"}</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {open?.kind === "approve" && (
        <ConfirmSheet title={`Approve ${open.vendor.name}?`} confirmLabel="Approve shop" busy={busy} onClose={() => setOpen(null)} onConfirm={() => approve(open.vendor)}
          body={<>
            <p>The shop goes live in the directory and can receive booking requests.</p>
            {rewardOn && open.vendor.referredBy && !open.vendor.referralRewarded && <p>The vendor who invited them ({open.vendor.referredBy}) gets <b>{reward} credits</b>.</p>}
          </>} />
      )}
      {open?.kind === "reward" && (
        <ConfirmSheet title="Reward the referrer?" confirmLabel={`Give ${reward} credits`} busy={busy} onClose={() => setOpen(null)}
          body={<p>The vendor who owns code <b>{open.vendor.referredBy}</b> gets {reward} credits for inviting {open.vendor.name}.</p>}
          onConfirm={() => run(async () => { await rewardReferrer(open.vendor); }, "Referrer rewarded")} />
      )}
      {open?.kind === "suspend" && (
        <ConfirmSheet title={`Suspend ${open.vendor.name}?`} confirmLabel="Suspend shop" tone="danger" busy={busy} onClose={() => setOpen(null)}
          body={<p>The shop disappears from the directory and cannot take bookings. Their data is kept and you can reactivate them any time.</p>}
          reason={{ label: "Reason, for your records", placeholder: "e.g. Complaints from customers" }}
          onConfirm={reason => run(() => updateDoc(doc(db, "vendors", open.vendor.id), { status: "suspended", suspendedAt: new Date().toISOString(), suspendReason: reason }), `${open.vendor.name} suspended`)} />
      )}
      {open?.kind === "reactivate" && (
        <ConfirmSheet title={`Reactivate ${open.vendor.name}?`} confirmLabel="Reactivate shop" busy={busy} onClose={() => setOpen(null)}
          body={<p>The shop goes back into the directory and can take bookings again.</p>}
          onConfirm={() => run(() => updateDoc(doc(db, "vendors", open.vendor.id), { status: "approved", suspendReason: null }), `${open.vendor.name} is live again`)} />
      )}
      {open?.kind === "delete" && (
        <ConfirmSheet title={`Delete ${open.vendor.name}?`} confirmLabel="Delete everything" tone="danger" busy={busy} typeToConfirm={open.vendor.name} onClose={() => setOpen(null)}
          body={<>
            <p>This permanently deletes the shop and all of its gear, orders, agreements, reviews, analytics, calendar, discounts, posts and settings. It cannot be undone.</p>
            {open.vendor.status !== "pending" && <p>If you only want to stop them taking bookings, suspend the shop instead.</p>}
          </>}
          onConfirm={() => run(() => deleteVendor(open.vendor), `${open.vendor.name} deleted`)} />
      )}
      {open?.kind === "credits" && <CreditChangeSheet vendor={live(open.vendor)} onClose={() => setOpen(null)} onDone={show} />}
      {open?.kind === "badges" && <BadgesSheet vendor={live(open.vendor)} onClose={() => setOpen(null)} notify={show} />}
      <Toast toast={toast} />
    </div>
  );
}

function BadgesSheet({ vendor, onClose, notify }: { vendor: AdminVendor; onClose: () => void; notify: (m: string, t?: "success" | "error") => void }) {
  const auto = autoBadges(vendor);
  async function save(fields: Record<string, unknown>, msg: string) {
    try { await updateDoc(doc(db, "vendors", vendor.id), fields); notify(msg); }
    catch { notify("Could not update", "error"); }
  }
  return (
    <BottomSheet title={`Badges for ${vendor.name}`} onClose={onClose}>
      <div className="flex flex-col gap-2">
        <p className="text-[13px] font-semibold text-slate-700">Earned automatically</p>
        {(["verified", "top_rated", "fast_responder"] as Badge[]).map(b => (
          <div key={b} className="flex items-center justify-between gap-3 border border-slate-200 rounded-xl px-3.5 py-2.5">
            <span className="flex flex-col"><span className="text-sm font-semibold">{BADGES[b].label}</span><span className={hintCls}>{BADGES[b].rule}</span></span>
            <Chip tone={auto.includes(b) ? "good" : "neutral"}>{auto.includes(b) ? "Has it" : "Not yet"}</Chip>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-[13px] font-semibold text-slate-700">Given by you</p>
        {(["id_verified", "premium"] as Badge[]).map(b => {
          const has = !!vendor.badges?.includes(b);
          return <SwitchRow key={b} title={BADGES[b].label} hint={BADGES[b].rule} checked={has}
            onChange={on => save({ badges: on ? arrayUnion(b) : arrayRemove(b) }, `${BADGES[b].label} ${on ? "given" : "removed"}`)} />;
        })}
        <SwitchRow title="Demo shop" hint="A sample shop for showing how Pacak Khemah works" checked={!!vendor.is_mockup}
          onChange={on => save({ is_mockup: on }, on ? "Marked as a demo shop" : "No longer a demo shop")} />
      </div>
    </BottomSheet>
  );
}
