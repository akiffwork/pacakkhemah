"use client";

import { useEffect, useState } from "react";
import { sendPasswordResetEmail, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { type VendorSettings, type TaxProfile, invoiceSummary, taxProfileComplete } from "@/lib/vendorSettings";
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
  onOpenCredits?: () => void;
};

const SUPPORT_WA = "https://wa.me/601136904336?text=Hi%20Pacak%20Khemah,%20I%20need%20help%20with%20my%20vendor%20account";

export default function AccountGroup({ vendorId, v, set, openSection, setOpenSection, toast, onRestartTour, onOpenCredits }: Props) {
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

      <Card>
        <H2>Contact</H2>
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

      <Card>
        <div className="flex items-center justify-between">
          <H2>Credits</H2>
          <span className="text-xl font-bold text-[#062c24]">{v.credits ?? 0}</span>
        </div>
        <p className={hintCls}>One credit is used per new customer enquiry. You get one back when a completed order receives a review.</p>
        {onOpenCredits && <button type="button" onClick={onOpenCredits} className={`${primarySmallBtn} min-h-11`}>Top up credits</button>}
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
        <button type="button" onClick={() => signOut(auth)} className="min-h-11 flex items-center text-sm font-semibold text-red-800 text-left">Log out</button>
      </div>
    </>
  );
}
