"use client";

import { useEffect, useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { type VendorSettings, type TaxProfile, invoiceSummary, taxProfileComplete } from "@/lib/vendorSettings";
import { type CreditPackage, DEFAULT_PACKAGES, loadPaymentConfig, startTopUp } from "@/lib/credits";
import { enablePush, disablePush, pushPermission, pushSupported } from "@/lib/pushRegistration";
import { Card, H2, Field, Section, SwitchRow, inputCls, hintCls, smallBtn, primarySmallBtn } from "./ui";

type Props = {
  vendorId: string;
  v: VendorSettings;
  set: (fields: Partial<VendorSettings>) => void;
  openSection: string | null;
  setOpenSection: (s: string | null) => void;
  toast: (msg: string, type?: "success" | "error") => void;
  onRestartTour?: () => void;
  onNavigate?: (tab: string) => void;
};

const SUPPORT_WA = "https://wa.me/601136904336?text=Hi%20Pacak%20Khemah,%20I%20need%20help%20with%20my%20vendor%20account";

export default function AccountGroup({ vendorId, v, set, openSection, setOpenSection, toast, onRestartTour }: Props) {
  const [packages, setPackages] = useState<CreditPackage[]>(DEFAULT_PACKAGES);
  const [config, setConfig] = useState<Awaited<ReturnType<typeof loadPaymentConfig>>>(null);
  const [paying, setPaying] = useState<number | null>(null);
  const refCode = (v as { myReferralCode?: string }).myReferralCode || "";
  const refLink = refCode ? `https://pacakkhemah.com/register-vendor?ref=${refCode}` : "";

  useEffect(() => {
    loadPaymentConfig().then(c => { setConfig(c); if (c?.packages?.length) setPackages(c.packages); });
  }, []);

  // Older vendors may not have an invite code yet
  useEffect(() => {
    if (!refCode && vendorId) set({ myReferralCode: `VEN-${vendorId.substring(0, 6).toUpperCase()}` } as Partial<VendorSettings>);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refCode, vendorId]);

  async function topUp(p: CreditPackage) {
    if (!config) { toast("Payments are not available right now. Please try again later.", "error"); return; }
    setPaying(p.credits);
    try { await startTopUp(config, p, v.name || "Vendor"); }
    catch { toast("Could not open the payment page", "error"); setPaying(null); }
  }
  const toggle = (s: string) => setOpenSection(openSection === s ? null : s);
  const [resetSent, setResetSent] = useState(false);
  const [pushState, setPushState] = useState<"checking" | "unsupported" | "blocked" | "ready">("checking");
  const [pushBusy, setPushBusy] = useState(false);
  const tp: TaxProfile = v.taxProfile || {};
  const setTax = (fields: Partial<TaxProfile>) => set({ taxProfile: { ...tp, ...fields } });

  useEffect(() => {
    pushSupported().then(ok => setPushState(!ok ? "unsupported" : pushPermission() === "denied" ? "blocked" : "ready"));
  }, []);

  async function sendReset() {
    const email = auth.currentUser?.email;
    if (!email) return;
    try { await sendPasswordResetEmail(auth, email); setResetSent(true); toast("Password reset email sent"); }
    catch { toast("Could not send the reset email", "error"); }
  }

  async function togglePush(on: boolean) {
    setPushBusy(true);
    try {
      if (on) {
        const token = await enablePush(vendorId);
        if (!token) { setPushState(pushPermission() === "denied" ? "blocked" : "ready"); toast("Notifications were not allowed by the browser", "error"); }
        else { set({ fcmToken: token }); toast("New order alerts are on for this device"); }
      } else {
        await disablePush(vendorId);
        set({ fcmToken: undefined });
        toast("Alerts turned off on this device");
      }
    } catch (e) { console.error(e); toast("Could not change notifications", "error"); }
    finally { setPushBusy(false); }
  }

  const pushOn = !!v.fcmToken && pushPermission() === "granted";

  return (
    <>
      <p className={hintCls}>Private. Nothing here is shown to customers.</p>

      <Card className="scroll-mt-4">
        <div id="section-contact"><H2>Contact</H2></div>
        <Field id="phone" label="WhatsApp number" hint="Customers' booking requests are sent here. Also used for your WhatsApp button.">
          <input id="phone" type="tel" inputMode="tel" value={v.phone || ""} onChange={e => set({ phone: e.target.value.replace(/[^0-9+]/g, "") })} placeholder="60123456789" className={inputCls} />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">Login email</span>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[15px] text-slate-900 break-all">{auth.currentUser?.email || "-"}</span>
            <button type="button" onClick={sendReset} disabled={resetSent} className={`${smallBtn} shrink-0`}>{resetSent ? "Reset link sent" : "Reset password"}</button>
          </div>
        </div>
      </Card>

      <Section id="section-invoice" title="Invoice details" summary={invoiceSummary(tp)} warn={!taxProfileComplete(tp)} open={openSection === "invoice"} onToggle={() => toggle("invoice")}>
        <p className={hintCls}>Printed on the invoices and receipts you generate from an order. TIN, business name and address are required by LHDN.</p>
        <Field id="tin" label="TIN (Tax Identification Number)"><input id="tin" value={tp.tin || ""} onChange={e => setTax({ tin: e.target.value })} placeholder="e.g. D1234567890" className={inputCls} /></Field>
        <Field id="legal-name" label="Registered business name (SSM)"><input id="legal-name" value={tp.legalName || ""} onChange={e => setTax({ legalName: e.target.value })} placeholder="e.g. KEMAH GEARS ENTERPRISE" className={inputCls} /></Field>
        <Field id="tax-address" label="Business address"><textarea id="tax-address" rows={2} value={tp.address || ""} onChange={e => setTax({ address: e.target.value })} placeholder="No. 1, Jalan Contoh, 25000 Kuantan, Pahang" className={`${inputCls} py-2.5 resize-none`} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="brn" label="BRN (SSM number)"><input id="brn" value={tp.brn || ""} onChange={e => setTax({ brn: e.target.value })} placeholder="SA0123456-X" className={inputCls} /></Field>
          <Field id="sst" label="SST number (if any)"><input id="sst" value={tp.sstNo || ""} onChange={e => setTax({ sstNo: e.target.value })} className={inputCls} /></Field>
        </div>
        <div className="grid grid-cols-[96px_1fr] gap-3">
          <Field id="msic" label="MSIC code"><input id="msic" value={tp.msicCode ?? "7721"} onChange={e => setTax({ msicCode: e.target.value })} className={inputCls} /></Field>
          <Field id="msic-act" label="Business activity"><input id="msic-act" value={tp.msicActivity ?? "Rental and leasing of recreational and sports goods"} onChange={e => setTax({ msicActivity: e.target.value })} className={inputCls} /></Field>
        </div>
      </Section>

      <Card className="scroll-mt-4">
        <div id="section-credits" className="flex items-center justify-between">
          <H2>Credits</H2>
          <span className="text-xl font-bold text-[#062c24]">{v.credits ?? 0}</span>
        </div>
        <p className={hintCls}>One credit is used each time a new customer sends you a booking request. You get one back when a completed order receives a review.</p>
        <div className="grid grid-cols-3 gap-2">
          {packages.map(p => (
            <button key={p.credits} type="button" disabled={!!paying} onClick={() => topUp(p)}
              className="min-h-[72px] rounded-xl border border-slate-300 bg-white hover:border-[#062c24] flex flex-col items-center justify-center gap-0.5 disabled:opacity-50">
              <span className="text-lg font-bold text-[#062c24]">{p.credits}</span>
              <span className="text-xs text-slate-600">{paying === p.credits ? "Opening payment" : `RM ${p.price}`}</span>
            </button>
          ))}
        </div>
        <p className={hintCls}>Paid securely through ToyyibPay (FPX online banking).</p>
      </Card>

      <Card>
        <H2>Invite another vendor</H2>
        <p className={hintCls}>Share your link with someone who rents out camping gear. You get bonus credits when their shop is approved.</p>
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 flex items-center justify-between gap-3">
          <span className="text-lg font-bold tracking-widest text-[#062c24]">{refCode || "…"}</span>
          <button type="button" disabled={!refCode} onClick={() => { navigator.clipboard.writeText(refLink); toast("Invite link copied"); }} className={smallBtn}>Copy link</button>
        </div>
        <a href={`https://wa.me/?text=${encodeURIComponent(`Join Pacak Khemah as a vendor and rent out your camping gear. Sign up with my code ${refCode}: ${refLink}`)}`}
          target="_blank" rel="noreferrer" className={`${smallBtn} min-h-11 flex items-center justify-center`}>
          <i className="fab fa-whatsapp mr-1.5" aria-hidden="true"></i>Share on WhatsApp
        </a>
        <p className="text-[13px] text-slate-700">{(v as { referral_total_referred?: number }).referral_total_referred || 0} vendors joined · {(v as { referral_total_credits?: number }).referral_total_credits || 0} credits earned</p>
      </Card>

      <Card>
        <H2>Notifications</H2>
        <SwitchRow title="New order alerts on this device" hint={
          pushState === "unsupported" ? "Not available in this browser. On iPhone, add the dashboard to your Home Screen first."
          : pushState === "blocked" ? "Blocked in your browser settings. Allow notifications for this site to turn it on."
          : "A notification when a customer books, signs the agreement or leaves a review"}
          checked={pushOn} onChange={togglePush} disabled={pushBusy || pushState !== "ready"} />
      </Card>

      <div className="flex flex-col pt-1">
        <a href={SUPPORT_WA} target="_blank" rel="noreferrer" className="min-h-11 flex items-center text-sm font-semibold text-emerald-800">Help and support on WhatsApp</a>
        <a href="/faq" className="min-h-11 flex items-center text-sm font-semibold text-emerald-800">FAQ and help articles</a>
        {onRestartTour && <button type="button" onClick={onRestartTour} className="min-h-11 flex items-center text-sm font-semibold text-emerald-800 text-left">Replay the welcome tour</button>}
      </div>
    </>
  );
}
