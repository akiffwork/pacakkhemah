"use strict";
// functions/lookups.ts
// Read-only lookups for customers, who are not logged in. Firestore rules stop
// the browser from listing `orders`, so these run with the Admin SDK and
// return only the fields each page shows.
Object.defineProperty(exports, "__esModule", { value: true });
exports.lookupOrderByReviewToken = exports.lookupBookingsByPhone = void 0;
exports.phoneVariants = phoneVariants;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const REGION = "us-central1";
const MAX_RESULTS = 50;
function iso(v) {
    if (v instanceof firestore_1.Timestamp)
        return v.toDate().toISOString();
    if (v && typeof v.toDate === "function")
        return v.toDate().toISOString();
    return typeof v === "string" ? v : "";
}
/** Malaysian numbers are stored as 60…, 0… or +60…; return all three. */
function phoneVariants(raw) {
    const digits = String(raw || "").replace(/\D/g, "");
    const local = digits.startsWith("60") ? digits.slice(2) : digits.startsWith("0") ? digits.slice(1) : digits;
    if (local.length < 8 || local.length > 11)
        return [];
    return [`60${local}`, `0${local}`, `+60${local}`];
}
function items(v) {
    return (Array.isArray(v) ? v : []).map((i) => (Object.assign({ name: String(i.name || ""), qty: Number(i.qty) || 0, price: Number(i.price) || 0 }, (i.variantLabel ? { variantLabel: String(i.variantLabel) } : {}))));
}
// My bookings page and the shop's "my booking" search
exports.lookupBookingsByPhone = (0, https_1.onCall)({ region: REGION }, async (req) => {
    const { phone, vendorId } = (req.data || {});
    const variants = phoneVariants(String(phone || ""));
    if (!variants.length)
        throw new https_1.HttpsError("invalid-argument", "Enter a valid phone number.");
    let q = (0, firestore_1.getFirestore)().collection("orders").where("customerPhone", "in", variants);
    if (typeof vendorId === "string" && vendorId)
        q = q.where("vendorId", "==", vendorId);
    const snap = await q.limit(MAX_RESULTS).get();
    const results = snap.docs.map(d => {
        var _a, _b;
        const o = d.data();
        return Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ id: d.id, vendorId: String(o.vendorId || ""), vendorName: String(o.vendorName || ""), vendorSlug: String(o.vendorSlug || ""), items: items(o.items), totalAmount: Number(o.totalAmount) || 0 }, (o.rentalAmount != null ? { rentalAmount: Number(o.rentalAmount) } : {})), (o.depositAmount != null ? { depositAmount: Number(o.depositAmount) } : {})), { bookingDates: { start: String(((_a = o.bookingDates) === null || _a === void 0 ? void 0 : _a.start) || ""), end: String(((_b = o.bookingDates) === null || _b === void 0 ? void 0 : _b.end) || "") }, status: String(o.status || "pending") }), (o.paymentStatus ? { paymentStatus: String(o.paymentStatus) } : {})), { createdAt: iso(o.createdAt) });
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { results };
});
// Review page: /review/{token}
exports.lookupOrderByReviewToken = (0, https_1.onCall)({ region: REGION }, async (req) => {
    var _a, _b, _c;
    const token = String(((_a = req.data) === null || _a === void 0 ? void 0 : _a.token) || "").trim();
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(token))
        return { error: "invalid" };
    const snap = await (0, firestore_1.getFirestore)().collection("orders").where("reviewToken", "==", token).limit(1).get();
    if (snap.empty)
        return { error: "invalid" };
    const d = snap.docs[0];
    const o = d.data();
    if (o.reviewTokenUsed === true)
        return { error: "used" };
    if (o.status !== "completed")
        return { error: "not_completed" };
    return {
        orderId: d.id,
        order: {
            vendorId: String(o.vendorId || ""),
            vendorName: String(o.vendorName || ""),
            customerPhone: String(o.customerPhone || ""),
            customerName: String(o.customerName || ""),
            items: items(o.items).map(({ name, qty }) => ({ name, qty })),
            totalAmount: Number(o.totalAmount) || 0,
            bookingDates: { start: String(((_b = o.bookingDates) === null || _b === void 0 ? void 0 : _b.start) || ""), end: String(((_c = o.bookingDates) === null || _c === void 0 ? void 0 : _c.end) || "") },
            reviewToken: token,
            reviewTokenUsed: false,
            status: "completed",
        },
    };
});
//# sourceMappingURL=lookups.js.map