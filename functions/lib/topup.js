"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirmTopUp = exports.toyyibpayCallback = exports.createTopUpBill = void 0;
exports.settleTopUp = settleTopUp;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const firestore_1 = require("firebase-admin/firestore");
const TOYYIBPAY_SECRET_KEY = (0, params_1.defineSecret)("TOYYIBPAY_SECRET_KEY");
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
const gateway = (sandbox) => (sandbox ? "https://dev.toyyibpay.com" : "https://toyyibpay.com");
function projectId() {
    try {
        return JSON.parse(process.env.FIREBASE_CONFIG || "{}").projectId || process.env.GCLOUD_PROJECT || "";
    }
    catch (_a) {
        return process.env.GCLOUD_PROJECT || "";
    }
}
async function canActFor(vendorId, uid, email) {
    var _a;
    if (email === ADMIN_EMAIL)
        return true;
    const snap = await (0, firestore_1.getFirestore)().doc(`vendors/${vendorId}`).get();
    return snap.exists && ((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.owner_uid) === uid;
}
// ── 1. Create the bill ──────────────────────────────────────────────────────
exports.createTopUpBill = (0, https_1.onCall)({ region: REGION, secrets: [TOYYIBPAY_SECRET_KEY] }, async (req) => {
    var _a, _b;
    if (!req.auth)
        throw new https_1.HttpsError("unauthenticated", "Please log in again.");
    const { vendorId, credits, origin } = (req.data || {});
    if (typeof vendorId !== "string" || !vendorId || typeof credits !== "number") {
        throw new https_1.HttpsError("invalid-argument", "Missing vendor or package.");
    }
    if (!(await canActFor(vendorId, req.auth.uid, req.auth.token.email))) {
        throw new https_1.HttpsError("permission-denied", "You can only top up your own shop.");
    }
    const db = (0, firestore_1.getFirestore)();
    const config = ((await db.doc("settings/payment_config").get()).data() || {});
    const packages = ((_a = config.packages) === null || _a === void 0 ? void 0 : _a.length) ? config.packages : DEFAULT_PACKAGES;
    const pkg = packages.find(p => p.credits === credits);
    if (!pkg || !(pkg.price > 0))
        throw new https_1.HttpsError("invalid-argument", "That package is not available.");
    if (!config.categoryCode)
        throw new https_1.HttpsError("failed-precondition", "Payments are not set up yet.");
    const vendor = (await db.doc(`vendors/${vendorId}`).get()).data() || {};
    const sandbox = !!config.isSandbox;
    const returnOrigin = typeof origin === "string" && ALLOWED_ORIGIN.test(origin) ? origin : DEFAULT_ORIGIN;
    const topRef = db.collection("topups").doc();
    await topRef.set({
        vendorId, uid: req.auth.uid, credits: pkg.credits, price: pkg.price, sandbox,
        status: "creating", createdAt: firestore_1.FieldValue.serverTimestamp(),
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
        const data = await res.json();
        billCode = ((_b = data === null || data === void 0 ? void 0 : data[0]) === null || _b === void 0 ? void 0 : _b.BillCode) || "";
    }
    catch (e) {
        console.error("createBill failed", e);
    }
    if (!billCode) {
        await topRef.update({ status: "failed", failReason: "createBill" });
        throw new https_1.HttpsError("unavailable", "Could not open the payment page.");
    }
    await topRef.update({ status: "pending", billCode });
    return { url: `${gateway(sandbox)}/${billCode}` };
});
async function settleTopUp(billCode) {
    const db = (0, firestore_1.getFirestore)();
    const found = await db.collection("topups").where("billCode", "==", billCode).limit(1).get();
    if (found.empty)
        return null;
    const topRef = found.docs[0].ref;
    const first = found.docs[0].data();
    if (first.status === "paid")
        return { status: "paid", credits: first.credits };
    let txs = [];
    try {
        const res = await fetch(`${gateway(first.sandbox)}/index.php/api/getBillTransactions`, {
            method: "POST", body: new URLSearchParams({ billCode }),
        });
        const data = await res.json();
        txs = Array.isArray(data) ? data : [];
    }
    catch (e) {
        console.error("getBillTransactions failed", billCode, e);
        return { status: "pending", credits: first.credits };
    }
    const paid = txs.find(t => t.billpaymentStatus === "1" &&
        (!t.billExternalReferenceNo || t.billExternalReferenceNo === topRef.id) &&
        parseFloat(t.billpaymentAmount || "0") + 0.001 >= first.price);
    if (!paid) {
        const failed = txs.length > 0 && txs.every(t => t.billpaymentStatus === "3");
        if (failed && first.status === "pending")
            await topRef.update({ status: "failed", failReason: "payment" });
        return { status: failed ? "failed" : "pending", credits: first.credits };
    }
    return db.runTransaction(async (t) => {
        const top = (await t.get(topRef)).data();
        if (top.status === "paid")
            return { status: "paid", credits: top.credits };
        const vendorRef = db.doc(`vendors/${top.vendorId}`);
        const vendor = (await t.get(vendorRef)).data() || {};
        t.update(topRef, {
            status: "paid", paidAt: firestore_1.FieldValue.serverTimestamp(),
            paidAmount: parseFloat(paid.billpaymentAmount || "0"), invoiceNo: paid.billpaymentInvoiceNo || "",
        });
        t.update(vendorRef, { credits: firestore_1.FieldValue.increment(top.credits) });
        t.set(db.collection("transactions").doc(), {
            vendorId: top.vendorId, vendorName: vendor.name || "Unknown",
            amount: top.price, credits: top.credits, type: "purchase",
            note: `ToyyibPay ${billCode}${top.sandbox ? " (sandbox)" : ""}`, source: "toyyibpay",
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
        return { status: "paid", credits: top.credits };
    });
}
// Called by ToyyibPay's servers. The body is only used to find the bill.
exports.toyyibpayCallback = (0, https_1.onRequest)({ region: REGION }, async (req, res) => {
    var _a;
    const billCode = String(((_a = req.body) === null || _a === void 0 ? void 0 : _a.billcode) || req.query.billcode || "").trim();
    if (!/^[A-Za-z0-9]{4,20}$/.test(billCode)) {
        res.status(400).send("Bad bill code");
        return;
    }
    try {
        const result = await settleTopUp(billCode);
        console.log("toyyibpayCallback", billCode, result);
        res.status(200).send("OK");
    }
    catch (e) {
        console.error("toyyibpayCallback error", billCode, e);
        res.status(500).send("Error");
    }
});
// Called by the vendor's browser when ToyyibPay sends them back.
exports.confirmTopUp = (0, https_1.onCall)({ region: REGION }, async (req) => {
    var _a;
    if (!req.auth)
        throw new https_1.HttpsError("unauthenticated", "Please log in again.");
    const billCode = String(((_a = req.data) === null || _a === void 0 ? void 0 : _a.billCode) || "").trim();
    if (!/^[A-Za-z0-9]{4,20}$/.test(billCode))
        throw new https_1.HttpsError("invalid-argument", "Bad bill code.");
    const found = await (0, firestore_1.getFirestore)().collection("topups").where("billCode", "==", billCode).limit(1).get();
    if (found.empty)
        throw new https_1.HttpsError("not-found", "Payment not found.");
    const top = found.docs[0].data();
    if (!(await canActFor(top.vendorId, req.auth.uid, req.auth.token.email))) {
        throw new https_1.HttpsError("permission-denied", "Not your payment.");
    }
    return (await settleTopUp(billCode)) || { status: "pending", credits: top.credits };
});
//# sourceMappingURL=topup.js.map