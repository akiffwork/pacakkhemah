"use client";

// Admin › Settings: payments and credits, site info, social links, defaults
// for new shops, admin access, and data tools.

import { useEffect, useRef, useState } from "react";
import { collection, deleteField, doc, getDoc, getDocs, limit, query, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { DEFAULT_ACCOUNT_NAME, DEFAULT_ADMIN_WHATSAPP, DEFAULT_PACKAGES, DEFAULT_QR, type CreditPackage } from "@/lib/credits";
import { DEFAULT_POLICIES, DEFAULT_SITE, type DefaultPolicies, type SiteSettings } from "@/lib/siteSettings";
import { OWNER_EMAIL, loadAdminEmails, saveAdminEmails } from "@/lib/adminAccess";
import {
  Card, Choice, ConfirmSheet, Field, H2, NumberInput, PageHeader, Segments, SwitchRow, Toast, hintCls, inputCls, primaryBtn, smallBtn, useToast,
} from "@/components/ui/kit";

type Section = "payments" | "site" | "social" | "defaults" | "admins" | "data";
type Social = { instagram: string; tiktok: string; facebook: string; threads: string; whatsapp: string };
type Payments = { packages: CreditPackage[]; startingCredits: number; accountName: string; adminWhatsApp: string; qrImageUrl: string };
type Referral = { rewardCredits: number; enabled: boolean };

const SECTIONS: { key: Section; label: string }[] = [
  { key: "payments", label: "Payments and credits" },
  { key: "site", label: "Site info" },
  { key: "social", label: "Social links" },
  { key: "defaults", label: "New shop defaults" },
  { key: "admins", label: "Admin access" },
  { key: "data", label: "Data" },
];
const EMPTY_SOCIAL: Social = { instagram: "", tiktok: "", facebook: "", threads: "", whatsapp: "" };
const SOCIAL_FIELDS: { key: keyof Social; label: string; placeholder: string }[] = [
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/yourpage" },
  { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@yourpage" },
  { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/yourpage" },
  { key: "threads", label: "Threads", placeholder: "https://threads.net/@yourpage" },
  { key: "whatsapp", label: "WhatsApp channel", placeholder: "https://whatsapp.com/channel/..." },
];

export default function AdminSettingsTab({ initialSection }: { initialSection?: string }) {
  const [section, setSection] = useState<Section>(SECTIONS.some(s => s.key === initialSection) ? initialSection as Section : "payments");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast, show } = useToast();

  const [pay, setPay] = useState<Payments>({ packages: DEFAULT_PACKAGES, startingCredits: 10, accountName: DEFAULT_ACCOUNT_NAME, adminWhatsApp: DEFAULT_ADMIN_WHATSAPP, qrImageUrl: "" });
  const [oldKey, setOldKey] = useState(false);
  const [referral, setReferral] = useState<Referral>({ rewardCredits: 5, enabled: true });
  const [site, setSite] = useState<SiteSettings>(DEFAULT_SITE);
  const [social, setSocial] = useState<Social>(EMPTY_SOCIAL);
  const [policies, setPolicies] = useState<DefaultPolicies>(DEFAULT_POLICIES);
  const [admins, setAdmins] = useState<string[]>([]);
  const [newAdmin, setNewAdmin] = useState("");
  const [uploading, setUploading] = useState(false);
  const [danger, setDanger] = useState<"clear" | "reset" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const get = (id: string) => getDoc(doc(db, "settings", id)).then(s => (s.exists() ? s.data() : null)).catch(() => null);
        const [p, r, si, so, po, ad] = await Promise.all([get("payment_config"), get("referral_config"), get("site"), get("social_links"), get("default_policies"), loadAdminEmails()]);
        if (p) {
          setPay(cur => ({ ...cur, ...p, packages: p.packages?.length ? p.packages : DEFAULT_PACKAGES }));
          setOldKey(!!p.secretKey);
        }
        if (r) setReferral(cur => ({ ...cur, ...r }));
        if (si) setSite({ ...DEFAULT_SITE, ...si });
        if (so) setSocial({ ...EMPTY_SOCIAL, ...so });
        if (po) setPolicies({ ...DEFAULT_POLICIES, ...po });
        setAdmins(ad);
      } finally { setLoading(false); }
    })();
  }, []);

  async function save(fn: () => Promise<unknown>, msg = "Saved") {
    setSaving(true);
    try { await fn(); show(msg); }
    catch (e) { console.error(e); show("Could not save. Please try again.", "error"); }
    finally { setSaving(false); }
  }

  const savePayments = () => save(async () => {
    const packages = pay.packages.filter(p => p.credits > 0 && p.price > 0).sort((a, b) => a.credits - b.credits);
    if (!packages.length) throw new Error("No packages");
    await setDoc(doc(db, "settings", "payment_config"), {
      packages, startingCredits: pay.startingCredits, accountName: pay.accountName.trim(),
      adminWhatsApp: pay.adminWhatsApp.replace(/\D/g, ""), qrImageUrl: pay.qrImageUrl || "",
    }, { merge: true });
    await setDoc(doc(db, "settings", "referral_config"), referral, { merge: true });
  });

  async function uploadQr(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) { show("Use an image under 5 MB", "error"); return; }
    setUploading(true);
    try {
      const r = storageRef(storage, `site/payment-qr-${Date.now()}.${(file.name.split(".").pop() || "png").toLowerCase()}`);
      await uploadBytes(r, file, { contentType: file.type });
      const url = await getDownloadURL(r);
      setPay(p => ({ ...p, qrImageUrl: url }));
      show("QR uploaded. Save to use it.");
    } catch (e) { console.error(e); show("Could not upload the QR", "error"); }
    finally { setUploading(false); }
  }

  async function exportData() {
    const [vendors, txs, settings] = await Promise.all([
      getDocs(collection(db, "vendors")), getDocs(collection(db, "transactions")), getDocs(collection(db, "settings")),
    ]);
    const data = {
      exportedAt: new Date().toISOString(),
      vendors: vendors.docs.map(d => ({ id: d.id, ...d.data() })),
      transactions: txs.docs.map(d => ({ id: d.id, ...d.data() })),
      settings: Object.fromEntries(settings.docs.map(d => [d.id, d.data()])),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = `pacakkhemah-export-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  async function clearTransactions() {
    for (;;) {
      const snap = await getDocs(query(collection(db, "transactions"), limit(400)));
      if (snap.empty) break;
      const b = writeBatch(db); snap.docs.forEach(d => b.delete(d.ref)); await b.commit();
    }
  }

  async function resetSettings() {
    await Promise.all([
      setDoc(doc(db, "settings", "site"), DEFAULT_SITE),
      setDoc(doc(db, "settings", "social_links"), EMPTY_SOCIAL),
      setDoc(doc(db, "settings", "default_policies"), DEFAULT_POLICIES),
      setDoc(doc(db, "settings", "referral_config"), { rewardCredits: 5, enabled: true }),
    ]);
    setSite(DEFAULT_SITE); setSocial(EMPTY_SOCIAL); setPolicies(DEFAULT_POLICIES); setReferral({ rewardCredits: 5, enabled: true });
  }

  const saveButton = (onClick: () => void, label = "Save") => (
    <button type="button" onClick={onClick} disabled={saving || loading} className={primaryBtn}>{saving ? "Saving" : label}</button>
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Settings" subtitle="How the platform works" />
      <Segments label="Settings sections" value={section} onChange={setSection} items={SECTIONS} />
      {loading && <p className="text-sm text-slate-600" role="status">Loading settings</p>}

      {!loading && section === "payments" && (
        <>
          {oldKey && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col gap-2">
              <p className="text-sm font-bold text-red-900">The old ToyyibPay secret key is still saved</p>
              <p className="text-[13px] text-red-900">Anyone can read it. It is no longer used, so remove it, then change the key in ToyyibPay.</p>
              <button type="button" className={`${smallBtn} self-start`} onClick={() => save(async () => { await updateDoc(doc(db, "settings", "payment_config"), { secretKey: deleteField(), categoryCode: deleteField(), isSandbox: deleteField() }); setOldKey(false); }, "Old key removed")}>Remove the old key</button>
            </div>
          )}
          <Card>
            <H2>Credit packages</H2>
            <p className={hintCls}>What vendors can buy in Settings › Account › Credits.</p>
            {pay.packages.map((p, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                <Field id={`pk-c-${i}`} label="Credits"><NumberInput id={`pk-c-${i}`} value={p.credits} min={1} onChange={n => setPay(s => ({ ...s, packages: s.packages.map((x, j) => j === i ? { ...x, credits: n } : x) }))} /></Field>
                <Field id={`pk-p-${i}`} label="Price"><NumberInput id={`pk-p-${i}`} value={p.price} min={1} suffix="RM" onChange={n => setPay(s => ({ ...s, packages: s.packages.map((x, j) => j === i ? { ...x, price: n } : x) }))} /></Field>
                <button type="button" aria-label={`Remove the ${p.credits} credits package`} disabled={pay.packages.length <= 1}
                  onClick={() => setPay(s => ({ ...s, packages: s.packages.filter((_, j) => j !== i) }))}
                  className="w-11 h-11 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40"><i className="fas fa-trash" aria-hidden="true"></i></button>
              </div>
            ))}
            {pay.packages.length < 6 && <button type="button" className={`${smallBtn} self-start`} onClick={() => setPay(s => ({ ...s, packages: [...s.packages, { credits: 0, price: 0 }] }))}>+ Add a package</button>}
            <Field id="start-credits" label="Free credits for a new shop" hint="Given when a vendor signs up.">
              <NumberInput id="start-credits" value={pay.startingCredits} onChange={n => setPay(s => ({ ...s, startingCredits: n }))} />
            </Field>
          </Card>
          <Card>
            <H2>Bank QR</H2>
            <p className={hintCls}>Vendors scan this to pay for credits.</p>
            <div className="flex items-start gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pay.qrImageUrl || DEFAULT_QR} alt="Payment QR" className="w-28 h-28 object-contain rounded-xl border border-slate-200 bg-white" />
              <div className="flex flex-col gap-2">
                <button type="button" className={smallBtn} disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? "Uploading" : "Upload a new QR"}</button>
                {pay.qrImageUrl && <button type="button" className={smallBtn} onClick={() => setPay(s => ({ ...s, qrImageUrl: "" }))}>Use the built-in QR</button>}
                <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={e => { uploadQr(e.target.files?.[0]); e.target.value = ""; }} />
              </div>
            </div>
            <Field id="acct-name" label="Account name shown to vendors"><input id="acct-name" value={pay.accountName} onChange={e => setPay(s => ({ ...s, accountName: e.target.value }))} className={inputCls} /></Field>
            <Field id="admin-wa" label="WhatsApp for receipts" hint="Vendors send their top-up request here. Country code first, e.g. 60123456789.">
              <input id="admin-wa" inputMode="tel" value={pay.adminWhatsApp} onChange={e => setPay(s => ({ ...s, adminWhatsApp: e.target.value }))} className={inputCls} />
            </Field>
          </Card>
          <Card>
            <H2>Vendor referrals</H2>
            <SwitchRow title="Reward vendors who invite other vendors" hint="Given when you approve the invited shop" checked={referral.enabled} onChange={on => setReferral(r => ({ ...r, enabled: on }))} />
            {referral.enabled && (
              <Field id="ref-reward" label="Credits per approved shop"><NumberInput id="ref-reward" value={referral.rewardCredits} min={1} onChange={n => setReferral(r => ({ ...r, rewardCredits: n }))} /></Field>
            )}
          </Card>
          {saveButton(savePayments)}
        </>
      )}

      {!loading && section === "site" && (
        <>
          <Card>
            <H2>Site info</H2>
            <Field id="site-name" label="Site name"><input id="site-name" value={site.siteName} onChange={e => setSite(s => ({ ...s, siteName: e.target.value }))} className={inputCls} /></Field>
            <Field id="site-tag" label="Tagline" hint="Under the logo on the homepage."><input id="site-tag" value={site.tagline} onChange={e => setSite(s => ({ ...s, tagline: e.target.value }))} className={inputCls} /></Field>
            <Field id="site-email" label="Contact email" hint="Shown on the About page."><input id="site-email" type="email" value={site.contactEmail} onChange={e => setSite(s => ({ ...s, contactEmail: e.target.value }))} className={inputCls} /></Field>
            <Field id="site-wa" label="Contact WhatsApp" hint="Shown on the About page. Country code first."><input id="site-wa" inputMode="tel" value={site.contactWhatsApp} onChange={e => setSite(s => ({ ...s, contactWhatsApp: e.target.value }))} className={inputCls} /></Field>
          </Card>
          <Card>
            <H2>Maintenance notice</H2>
            <SwitchRow title="Show a maintenance notice" hint="A yellow bar on every customer page. The vendor dashboard and admin are not affected." checked={site.maintenanceMode} onChange={on => setSite(s => ({ ...s, maintenanceMode: on }))} />
            {site.maintenanceMode && (
              <Field id="maint-msg" label="Message"><textarea id="maint-msg" rows={2} value={site.maintenanceMessage} onChange={e => setSite(s => ({ ...s, maintenanceMessage: e.target.value }))} className={`${inputCls} py-2.5 resize-none`} /></Field>
            )}
          </Card>
          {saveButton(() => save(() => setDoc(doc(db, "settings", "site"), site)))}
        </>
      )}

      {!loading && section === "social" && (
        <>
          <Card>
            <H2>Social links</H2>
            <p className={hintCls}>Shown in the homepage footer. Leave a field empty to hide it.</p>
            {SOCIAL_FIELDS.map(f => (
              <Field key={f.key} id={`soc-${f.key}`} label={f.label}>
                <input id={`soc-${f.key}`} type="url" value={social[f.key]} placeholder={f.placeholder} onChange={e => setSocial(s => ({ ...s, [f.key]: e.target.value }))} className={inputCls} />
              </Field>
            ))}
          </Card>
          {saveButton(() => save(() => setDoc(doc(db, "settings", "social_links"), social)))}
        </>
      )}

      {!loading && section === "defaults" && (
        <>
          <Card>
            <H2>New shop defaults</H2>
            <p className={hintCls}>What a new shop starts with. Vendors can change these in their own settings. Existing shops are not changed.</p>
            <Choice label="Deposit type" value={policies.securityDepositType} onChange={t => setPolicies(p => ({ ...p, securityDepositType: t }))}
              options={[{ value: "fixed", label: "Fixed amount" }, { value: "percentage", label: "Percent of rental" }]} />
            <Field id="def-dep" label="Security deposit"><NumberInput id="def-dep" value={policies.securityDeposit} suffix={policies.securityDepositType === "fixed" ? "RM" : "%"} onChange={n => setPolicies(p => ({ ...p, securityDeposit: n }))} /></Field>
            <Field id="def-cancel" label="Cancel at least this many hours before pickup" hint="Added to the shop's rules. Use 0 to leave it out.">
              <NumberInput id="def-cancel" value={policies.cancellationHours} suffix="hours" onChange={n => setPolicies(p => ({ ...p, cancellationHours: n }))} />
            </Field>
            <Field id="def-damage" label="Damage rule" hint="Added to the shop's rules and the rental agreement.">
              <textarea id="def-damage" rows={3} value={policies.damagePolicy} onChange={e => setPolicies(p => ({ ...p, damagePolicy: e.target.value }))} className={`${inputCls} py-2.5 resize-none`} />
            </Field>
          </Card>
          {saveButton(() => save(() => setDoc(doc(db, "settings", "default_policies"), policies)))}
        </>
      )}

      {!loading && section === "admins" && (
        <>
          <Card>
            <H2>Admin access</H2>
            <p className={hintCls}>These Google accounts can open this admin panel and approve credits. Only add people you trust.</p>
            <div className="flex items-center justify-between gap-3 border border-slate-200 rounded-xl px-3.5 py-2.5">
              <span className="text-sm font-semibold truncate">{OWNER_EMAIL}</span><span className="text-xs text-slate-600 shrink-0">Owner, always an admin</span>
            </div>
            {admins.map(e => (
              <div key={e} className="flex items-center justify-between gap-3 border border-slate-200 rounded-xl px-3.5 py-2">
                <span className="text-sm font-semibold truncate">{e}</span>
                <button type="button" className={smallBtn} onClick={() => setAdmins(a => a.filter(x => x !== e))}>Remove</button>
              </div>
            ))}
            <div className="flex gap-2">
              <label htmlFor="new-admin" className="sr-only">Email to add</label>
              <input id="new-admin" type="email" value={newAdmin} onChange={e => setNewAdmin(e.target.value)} placeholder="name@gmail.com" className={inputCls} />
              <button type="button" className={smallBtn} disabled={!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newAdmin.trim())}
                onClick={() => { const e = newAdmin.trim().toLowerCase(); if (!admins.includes(e) && e !== OWNER_EMAIL) setAdmins(a => [...a, e]); setNewAdmin(""); }}>Add</button>
            </div>
          </Card>
          {saveButton(() => save(() => saveAdminEmails(admins), "Admin list saved"))}
        </>
      )}

      {!loading && section === "data" && (
        <>
          <Card>
            <H2>Export</H2>
            <p className={hintCls}>Download all shops, transactions and settings as a JSON file.</p>
            <button type="button" className={`${smallBtn} self-start`} onClick={() => exportData().catch(() => show("Could not export", "error"))}><i className="fas fa-download mr-1.5" aria-hidden="true"></i>Download export</button>
          </Card>
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col gap-3">
            <H2>Danger zone</H2>
            <p className="text-[13px] text-red-900">These cannot be undone. Download an export first.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={`${smallBtn} text-red-800 border-red-300`} onClick={() => setDanger("clear")}>Delete all transactions</button>
              <button type="button" className={`${smallBtn} text-red-800 border-red-300`} onClick={() => setDanger("reset")}>Reset settings to defaults</button>
            </div>
          </div>
        </>
      )}

      {danger === "clear" && (
        <ConfirmSheet title="Delete all transactions?" confirmLabel="Delete all transactions" tone="danger" typeToConfirm="DELETE" busy={saving}
          body={<p>The whole credit history goes, including purchases, bonuses and refunds. Vendors keep their current credit balance.</p>}
          onClose={() => setDanger(null)} onConfirm={() => save(clearTransactions, "All transactions deleted").then(() => setDanger(null))} />
      )}
      {danger === "reset" && (
        <ConfirmSheet title="Reset settings?" confirmLabel="Reset settings" tone="danger" typeToConfirm="RESET" busy={saving}
          body={<p>Site info, social links, new shop defaults and referral settings go back to their defaults. Payments, admins and site content are not changed.</p>}
          onClose={() => setDanger(null)} onConfirm={() => save(resetSettings, "Settings reset").then(() => setDanger(null))} />
      )}
      <Toast toast={toast} />
    </div>
  );
}

