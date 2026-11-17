// src/lib/credits.ts
// Credit top-ups by bank QR, approved by the admin.
//
//  1. The vendor picks a package, pays by scanning the Maybank QR, uploads the
//     receipt and submits. This creates topups/{id} with status "pending".
//  2. The vendor sends the request to the admin on WhatsApp (receipt link and
//     reference included).
//  3. The admin checks the bank statement and approves in Admin › Finance.
//     Approval adds the credits and logs a `transactions` row, once.
//
// Vendors can create a pending request but never change credits: Firestore
// rules only let the admin approve requests and change vendors.credits.

import {
  addDoc, collection, doc, getDoc, increment, runTransaction, serverTimestamp, updateDoc,
} from "firebase/firestore";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";

export type CreditPackage = { credits: number; price: number };

export type PaymentConfig = {
  packages?: CreditPackage[];
  qrImageUrl?: string;
  accountName?: string;
  adminWhatsApp?: string;
};

export type TopUpStatus = "pending" | "approved" | "rejected";

export type TopUpRequest = {
  id: string;
  vendorId: string;
  vendorName: string;
  uid: string;
  credits: number;
  price: number;
  reference: string;
  status: TopUpStatus;
  receiptUrl?: string | null;
  receiptPath?: string | null;
  rejectReason?: string;
  createdAt?: unknown;
  decidedAt?: unknown;
};

export const DEFAULT_PACKAGES: CreditPackage[] = [
  { credits: 10, price: 10 },
  { credits: 50, price: 45 },
  { credits: 100, price: 80 },
];
export const DEFAULT_QR = "/payment/maybank-qr.png";
export const DEFAULT_ACCOUNT_NAME = "Atakasen Enterprise";
export const DEFAULT_ADMIN_WHATSAPP = "601136904336";

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

export async function loadPaymentConfig(): Promise<PaymentConfig | null> {
  try { const snap = await getDoc(doc(db, "settings", "payment_config")); return snap.exists() ? (snap.data() as PaymentConfig) : null; }
  catch { return null; }
}

export function paymentDetails(config: PaymentConfig | null) {
  return {
    packages: config?.packages?.length ? config.packages : DEFAULT_PACKAGES,
    qrImageUrl: config?.qrImageUrl || DEFAULT_QR,
    accountName: config?.accountName || DEFAULT_ACCOUNT_NAME,
    adminWhatsApp: (config?.adminWhatsApp || DEFAULT_ADMIN_WHATSAPP).replace(/\D/g, ""),
  };
}

/** Short code the vendor types as the transfer reference, e.g. PK-7KQ2MD. */
export function makeReference(random: () => number = Math.random): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(random() * chars.length)];
  return `PK-${s}`;
}

export function isReceiptFile(f: File): boolean {
  return f.size <= MAX_RECEIPT_BYTES && (f.type.startsWith("image/") || f.type === "application/pdf");
}

/** Vendor: record the request (and the receipt, if given). */
export async function submitTopUpRequest(args: {
  vendorId: string; vendorName: string; uid: string; pkg: CreditPackage; reference: string; receipt?: File | null;
}): Promise<{ id: string; receiptUrl: string | null }> {
  const { vendorId, vendorName, uid, pkg, reference, receipt } = args;
  let receiptUrl: string | null = null;
  let receiptPath: string | null = null;
  if (receipt) {
    const ext = receipt.type === "application/pdf" ? "pdf" : (receipt.name.split(".").pop() || "jpg").toLowerCase().slice(0, 4);
    receiptPath = `receipts/${vendorId}/${Date.now()}_${reference}.${ext}`;
    const r = storageRef(storage, receiptPath);
    await uploadBytes(r, receipt, { contentType: receipt.type });
    receiptUrl = await getDownloadURL(r);
  }
  const ref = await addDoc(collection(db, "topups"), {
    vendorId, vendorName, uid,
    credits: pkg.credits, price: pkg.price, reference,
    status: "pending", receiptUrl, receiptPath,
    createdAt: serverTimestamp(),
  });
  return { id: ref.id, receiptUrl };
}

/** WhatsApp message from the vendor to the admin. */
export function topUpWhatsAppLink(adminWhatsApp: string, r: {
  vendorName: string; credits: number; price: number; reference: string; receiptUrl?: string | null;
}): string {
  const lines = [
    "Hi Pacak Khemah, I have paid for credits.",
    "",
    `Shop: ${r.vendorName}`,
    `Package: ${r.credits} credits (RM ${r.price})`,
    `Reference: ${r.reference}`,
    r.receiptUrl ? `Receipt: ${r.receiptUrl}` : "Receipt: attached below",
    "",
    "Please approve my top-up. Thank you!",
  ];
  return `https://wa.me/${adminWhatsApp}?text=${encodeURIComponent(lines.join("\n"))}`;
}

/** Admin: approve once. Adds credits and logs the purchase. */
export async function approveTopUp(id: string): Promise<"approved" | "already"> {
  return runTransaction(db, async t => {
    const topRef = doc(db, "topups", id);
    const snap = await t.get(topRef);
    if (!snap.exists()) throw new Error("Request not found");
    const top = snap.data() as TopUpRequest;
    if (top.status !== "pending") return "already";
    t.update(topRef, { status: "approved", decidedAt: serverTimestamp() });
    t.update(doc(db, "vendors", top.vendorId), { credits: increment(top.credits) });
    t.set(doc(collection(db, "transactions")), {
      vendorId: top.vendorId, vendorName: top.vendorName || "Unknown",
      amount: top.price, credits: top.credits, type: "purchase",
      note: `QR top-up ${top.reference}`, source: "qr", topupId: id,
      createdAt: serverTimestamp(),
    });
    return "approved";
  });
}

/** Admin: reject with a reason the vendor will see. */
export async function rejectTopUp(id: string, reason: string): Promise<void> {
  await updateDoc(doc(db, "topups", id), { status: "rejected", rejectReason: reason.trim() || "Payment not found", decidedAt: serverTimestamp() });
}

/** True when the request's price matches a package (flags tampered requests). */
export function matchesPackage(r: Pick<TopUpRequest, "credits" | "price">, packages: CreditPackage[]): boolean {
  return packages.some(p => p.credits === r.credits && p.price === r.price);
}

export type CreditChangeType = "purchase" | "bonus" | "refund" | "adjustment";

/**
 * Admin: the one way to change a vendor's credits by hand. Updates the balance
 * and logs a `transactions` row together, so Money always matches.
 * `credits` is how many to add (refunds remove them); `amount` is RM.
 */
export async function adjustCredits(args: {
  vendorId: string; vendorName: string; type: CreditChangeType; credits: number; amount?: number; note?: string;
}): Promise<void> {
  const { vendorId, vendorName, type, credits, amount = 0, note = "" } = args;
  if (!vendorId || !Number.isFinite(credits) || credits === 0 && amount === 0) throw new Error("Nothing to change");
  const delta = type === "refund" ? -Math.abs(credits) : credits;
  await runTransaction(db, async t => {
    if (delta !== 0) t.update(doc(db, "vendors", vendorId), { credits: increment(delta) });
    t.set(doc(collection(db, "transactions")), {
      vendorId, vendorName: vendorName || "Unknown",
      amount: Math.max(0, amount), credits: type === "adjustment" ? credits : Math.abs(credits), type,
      note: note.trim(), source: "admin", createdAt: serverTimestamp(),
    });
  });
}

/** Money in minus refunds, for revenue figures. Bonus and adjustments are not revenue. */
export function netRevenue(txs: { type?: string; amount?: number }[]): number {
  return txs.reduce((s, t) => s + (t.type === "purchase" ? t.amount || 0 : t.type === "refund" ? -(t.amount || 0) : 0), 0);
}
