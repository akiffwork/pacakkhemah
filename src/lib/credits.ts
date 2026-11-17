// src/lib/credits.ts
// Credit top-ups through ToyyibPay. The browser never sees the gateway key and
// never adds credits itself: the createTopUpBill / confirmTopUp Cloud Functions
// (functions/topup.ts) create the bill and add credits only after ToyyibPay
// confirms the payment.

import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase";

export type CreditPackage = { credits: number; price: number };
type PaymentConfig = { packages?: CreditPackage[]; categoryCode?: string; isSandbox?: boolean };

export const DEFAULT_PACKAGES: CreditPackage[] = [
  { credits: 10, price: 10 },
  { credits: 50, price: 45 },
  { credits: 100, price: 80 },
];

/** Public payment settings (packages and prices only). */
export async function loadPaymentConfig(): Promise<PaymentConfig | null> {
  try { const snap = await getDoc(doc(db, "settings", "payment_config")); return snap.exists() ? (snap.data() as PaymentConfig) : null; }
  catch { return null; }
}

/** Ask the server for a ToyyibPay bill, then go to the payment page. */
export async function startTopUp(vendorId: string, pkg: CreditPackage): Promise<void> {
  const create = httpsCallable<{ vendorId: string; credits: number; origin: string }, { url: string }>(functions, "createTopUpBill");
  const { data } = await create({ vendorId, credits: pkg.credits, origin: window.location.origin });
  if (!data?.url) throw new Error("No payment page");
  window.location.href = data.url;
}

export type TopUpResult = { status: "paid" | "pending" | "failed"; credits: number };

const RETURN_PARAMS = ["status_id", "billcode", "order_id", "msg", "transaction_id", "add_credits"];

/**
 * When ToyyibPay sends the vendor back (?billcode=…), ask the server to check
 * the payment. Returns null when this page load is not a payment return.
 */
export async function handleTopUpReturn(): Promise<TopUpResult | null> {
  const params = new URLSearchParams(window.location.search);
  const billCode = params.get("billcode");
  if (!billCode) return null;
  RETURN_PARAMS.forEach(k => params.delete(k));
  window.history.replaceState({}, "", `${window.location.pathname}${params.toString() ? `?${params}` : ""}`);
  const confirm = httpsCallable<{ billCode: string }, TopUpResult>(functions, "confirmTopUp");
  const { data } = await confirm({ billCode });
  return data;
}
