// functions/topup.ts
// Credit top-ups through ToyyibPay, done on the server.
//
// Flow:
//  1. createTopUpBill (callable): checks the caller owns the vendor, takes the
//     price from settings/payment_config (never from the browser), records a
//     pending topups/{id} doc and creates the ToyyibPay bill with the secret
//     key, which only lives in the TOYYIBPAY_SECRET_KEY function secret.
//  2. The vendor pays on ToyyibPay.
//  3. toyyibpayCallback (ToyyibPay server -> us) and confirmTopUp (the vendor's
//     browser on return) both call settleTopUp, which asks ToyyibPay whether
//     the bill was really paid and for how much. Credits are added once, in a
//     transaction, and a row is written to `transactions` for the admin.
//
// Nothing the browser or the callback body says about payment status is
// trusted; only ToyyibPay's getBillTransactions answer is.

import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const TOYYIBPAY_SECRET_KEY = defineSecret("TOYYIBPAY_SECRET_KEY");

const ADMIN_EMAIL = "akiff.work@gmail.com";
const REGION = "us-central1";
const DEFAULT_PACKAGES = [
  { credits: 10, price: 10 },
  { credits: 50, price: 45 },
  { credits: 100, price: 80 },
];
// Where the vendor may be sent back to after paying
const ALLOWED_ORIGIN = /^(https:\/\/(www\.)?pacakkhemah\.com|https:\/\/[a-z0-9-]+\.vercel\.app|http:\/\/localhost(:\d+)?)$/;
const DEFAULT_ORIGIN = "https://pacakkhemah.com";

type PaymentConfig = {
  packages?: { credits: number; price: number }[];
  categoryCode?: string;
  isSandbox?: boolean;
};

type TopUp = {
  vendorId: string;
  uid: string;
  credits: number;
  price: number;
  sandbox: boolean;
  status: "creating" | "pending" | "paid" | "failed";
  billCode?: string;
};

type SettleResult = { status: "paid" | "pending" | "failed"; credits: number };

const gateway = (sandbox: boolean) => (sandbox ? "https://dev.toyyibpay.com" : "https://toyyibpay.com");

function projectId(): string {
  try { return JSON.parse(process.env.FIREBASE_CONFIG || "{}").projectId || process.env.GCLOUD_PROJECT || ""; }
  catch { return process.env.GCLOUD_PROJECT || ""; }
}

async function canActFor(vendorId: string, uid: string, email?: string): Promise<boolean> {
  if (email === ADMIN_EMAIL) return true;
  const snap = await getFirestore().doc(`vendors/${vendorId}`).get();
  return snap.exists && snap.data()?.owner_uid === uid;
}

// ── 1. Create the bill ──────────────────────────────────────────────────────

export const createTopUpBill = onCall({ region: REGION, secrets: [TOYYIBPAY_SECRET_KEY] }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Please log in again.");
  const { vendorId, credits, origin } = (req.data || {}) as { vendorId?: unknown; credits?: unknown; origin?: unknown };
  if (typeof vendorId !== "string" || !vendorId || typeof credits !== "number") {
    throw new HttpsError("invalid-argument", "Missing vendor or package.");
  }
  if (!(await canActFor(vendorId, req.auth.uid, req.auth.token.email))) {
    throw new HttpsError("permission-denied", "You can only top up your own shop.");
  }

  const db = getFirestore();
  const config = ((await db.doc("settings/payment_config").get()).data() || {}) as PaymentConfig;
  const packages = config.packages?.length ? config.packages : DEFAULT_PACKAGES;
  const pkg = packages.find(p => p.credits === credits);
  if (!pkg || !(pkg.price > 0)) throw new HttpsError("invalid-argument", "That package is not available.");
  if (!config.categoryCode) throw new HttpsError("failed-precondition", "Payments are not set up yet.");

  const vendor = (await db.doc(`vendors/${vendorId}`).get()).data() || {};
  const sandbox = !!config.isSandbox;
  const returnOrigin = typeof origin === "string" && ALLOWED_ORIGIN.test(origin) ? origin : DEFAULT_ORIGIN;
  const topRef = db.collection("topups").doc();
  await topRef.set({
    vendorId, uid: req.auth.uid, credits: pkg.credits, price: pkg.price, sandbox,
    status: "creating", createdAt: FieldValue.serverTimestamp(),
  });

  const phone = String(vendor.phone || "").replace(/\D/g, "") || "0123456789";
  const form = new URLSearchParams({
    userSecretKey: TOYYIBPAY_SECRET_KEY.value(),
    categoryCode: config.categoryCode,
    billName: `TopUp ${pkg.credits} Credits`.slice(0, 30),
    billDescription: `Pacak Khemah lead credits for ${String(vendor.name || "vendor")}`.slice(0, 100),
    billPriceSetting: "1",
    billPayorInfo: "1",
    billAmount: String(Math.round(pkg.price * 100)),
    billReturnUrl: `${returnOrigin}/store?tab=settings&group=account&section=credits`,
    billCallbackUrl: `https://${REGION}-${projectId()}.cloudfunctions.net/toyyibpayCallback`,
    billExternalReferenceNo: topRef.id,
    billTo: String(vendor.name || "Vendor").slice(0, 60),
    billEmail: req.auth.token.email || String(vendor.email || "noreply@pacakkhemah.com"),
    billPhone: phone,
  });

  let billCode = "";
  try {
    const res = await fetch(`${gateway(sandbox)}/index.php/api/createBill`, { method: "POST", body: form });
    const data = await res.json() as { BillCode?: string }[];
    billCode = data?.[0]?.BillCode || "";
  } catch (e) {
    console.error("createBill failed", e);
  }
  if (!billCode) {
    await topRef.update({ status: "failed", failReason: "createBill" });
    throw new HttpsError("unavailable", "Could not open the payment page.");
  }
  await topRef.update({ status: "pending", billCode });
  return { url: `${gateway(sandbox)}/${billCode}` };
});

// ── 2. Settle: ask ToyyibPay, then add credits once ─────────────────────────

type BillTx = { billpaymentStatus?: string; billpaymentAmount?: string; billExternalReferenceNo?: string; billpaymentInvoiceNo?: string };

export async function settleTopUp(billCode: string): Promise<SettleResult | null> {
  const db = getFirestore();
  const found = await db.collection("topups").where("billCode", "==", billCode).limit(1).get();
  if (found.empty) return null;
  const topRef = found.docs[0].ref;
  const first = found.docs[0].data() as TopUp;
  if (first.status === "paid") return { status: "paid", credits: first.credits };

  let txs: BillTx[] = [];
  try {
    const res = await fetch(`${gateway(first.sandbox)}/index.php/api/getBillTransactions`, {
      method: "POST", body: new URLSearchParams({ billCode }),
    });
    const data = await res.json();
    txs = Array.isArray(data) ? data as BillTx[] : [];
  } catch (e) {
    console.error("getBillTransactions failed", billCode, e);
    return { status: "pending", credits: first.credits };
  }

  const paid = txs.find(t =>
    t.billpaymentStatus === "1" &&
    (!t.billExternalReferenceNo || t.billExternalReferenceNo === topRef.id) &&
    parseFloat(t.billpaymentAmount || "0") + 0.001 >= first.price);

  if (!paid) {
    const failed = txs.length > 0 && txs.every(t => t.billpaymentStatus === "3");
    if (failed && first.status === "pending") await topRef.update({ status: "failed", failReason: "payment" });
    return { status: failed ? "failed" : "pending", credits: first.credits };
  }

  return db.runTransaction(async t => {
    const top = (await t.get(topRef)).data() as TopUp;
    if (top.status === "paid") return { status: "paid" as const, credits: top.credits };
    const vendorRef = db.doc(`vendors/${top.vendorId}`);
    const vendor = (await t.get(vendorRef)).data() || {};
    t.update(topRef, {
      status: "paid", paidAt: FieldValue.serverTimestamp(),
      paidAmount: parseFloat(paid.billpaymentAmount || "0"), invoiceNo: paid.billpaymentInvoiceNo || "",
    });
    t.update(vendorRef, { credits: FieldValue.increment(top.credits) });
    t.set(db.collection("transactions").doc(), {
      vendorId: top.vendorId, vendorName: vendor.name || "Unknown",
      amount: top.price, credits: top.credits, type: "purchase",
      note: `ToyyibPay ${billCode}${top.sandbox ? " (sandbox)" : ""}`, source: "toyyibpay",
      createdAt: FieldValue.serverTimestamp(),
    });
    return { status: "paid" as const, credits: top.credits };
  });
}

// Called by ToyyibPay's servers. The body is only used to find the bill.
export const toyyibpayCallback = onRequest({ region: REGION }, async (req, res) => {
  const billCode = String(req.body?.billcode || req.query.billcode || "").trim();
  if (!/^[A-Za-z0-9]{4,20}$/.test(billCode)) { res.status(400).send("Bad bill code"); return; }
  try {
    const result = await settleTopUp(billCode);
    console.log("toyyibpayCallback", billCode, result);
    res.status(200).send("OK");
  } catch (e) {
    console.error("toyyibpayCallback error", billCode, e);
    res.status(500).send("Error");
  }
});

// Called by the vendor's browser when ToyyibPay sends them back.
export const confirmTopUp = onCall({ region: REGION }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Please log in again.");
  const billCode = String((req.data as { billCode?: unknown })?.billCode || "").trim();
  if (!/^[A-Za-z0-9]{4,20}$/.test(billCode)) throw new HttpsError("invalid-argument", "Bad bill code.");

  const found = await getFirestore().collection("topups").where("billCode", "==", billCode).limit(1).get();
  if (found.empty) throw new HttpsError("not-found", "Payment not found.");
  const top = found.docs[0].data() as TopUp;
  if (!(await canActFor(top.vendorId, req.auth.uid, req.auth.token.email))) {
    throw new HttpsError("permission-denied", "Not your payment.");
  }
  return (await settleTopUp(billCode)) || { status: "pending", credits: top.credits };
});
