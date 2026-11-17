// src/lib/credits.ts
// Credit top-ups through ToyyibPay, moved from the old Analytics tab
// unchanged in behaviour.
//
// WARNING (pre-existing, not introduced here): the gateway secret key is
// read from Firestore by the browser, and credits are added by the browser
// when it returns with ?status_id=1&add_credits=N. Both need to move to a
// server route that verifies the bill with ToyyibPay before adding credits.

import { doc, getDoc, increment, updateDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "@/lib/firebase";

export type CreditPackage = { credits: number; price: number };
type PaymentConfig = { packages?: CreditPackage[]; secretKey?: string; categoryCode?: string; isSandbox?: boolean };

export const DEFAULT_PACKAGES: CreditPackage[] = [
  { credits: 10, price: 10 },
  { credits: 50, price: 45 },
  { credits: 100, price: 80 },
];

export async function loadPaymentConfig(): Promise<PaymentConfig | null> {
  try { const snap = await getDoc(doc(db, "settings", "payment_config")); return snap.exists() ? (snap.data() as PaymentConfig) : null; }
  catch { return null; }
}

export async function startTopUp(config: PaymentConfig, pkg: CreditPackage, vendorName: string): Promise<void> {
  const returnUrl = new URL(window.location.href);
  returnUrl.searchParams.set("add_credits", String(pkg.credits));
  const url = config.isSandbox ? "https://dev.toyyibpay.com/index.php/api/createBill" : "https://toyyibpay.com/index.php/api/createBill";
  const form = new FormData();
  form.append("userSecretKey", config.secretKey || "");
  form.append("categoryCode", config.categoryCode || "");
  form.append("billName", `TopUp: ${pkg.credits} Credits`);
  form.append("billDescription", "Lead Credits Top Up");
  form.append("billPriceSetting", "1");
  form.append("billPayorInfo", "1");
  form.append("billAmount", String(pkg.price * 100));
  form.append("billReturnUrl", returnUrl.toString());
  form.append("billCallbackUrl", returnUrl.toString());
  form.append("billTo", vendorName);
  form.append("billEmail", getAuth().currentUser?.email || "");
  form.append("billPhone", "0123456789");
  const res = await fetch(url, { method: "POST", body: form });
  const data = await res.json();
  if (!data?.[0]?.BillCode) throw new Error("No bill code");
  window.location.href = (config.isSandbox ? "https://dev.toyyibpay.com/" : "https://toyyibpay.com/") + data[0].BillCode;
}

/** Handle the payment return wherever the vendor lands. Returns credits added, or 0. */
export async function handleTopUpReturn(vendorId: string): Promise<number> {
  const params = new URLSearchParams(window.location.search);
  if (params.get("status_id") !== "1" || !params.has("add_credits")) return 0;
  const toAdd = parseInt(params.get("add_credits")!, 10);
  if (!toAdd || toAdd < 0) return 0;
  await updateDoc(doc(db, "vendors", vendorId), { credits: increment(toAdd) });
  ["status_id", "add_credits", "billcode", "order_id", "msg", "transaction_id"].forEach(k => params.delete(k));
  window.history.replaceState({}, "", `${window.location.pathname}${params.toString() ? `?${params}` : ""}`);
  return toAdd;
}
