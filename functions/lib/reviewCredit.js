"use strict";
// functions/reviewCredit.ts
// A vendor gets 1 credit back when a completed order receives a customer
// review. Only a credit that was actually charged for that booking (its lead
// in `analytics`) is given back, once, so credits can't be farmed with
// orders that never cost one.
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEAD_LINK_SINCE = void 0;
exports.refundCreditForReview = refundCreditForReview;
const firestore_1 = require("firebase-admin/firestore");
// Orders placed from this time carry the ID of their lead (analytics doc).
// Older orders keep the old rule: one credit back per reviewed order.
exports.LEAD_LINK_SINCE = Date.UTC(2026, 10, 22, 0, 0, 0); // 22 Nov 2026, 08:00 MYT
async function refundCreditForReview(db, vendorId, orderId) {
    const orderRef = db.doc(`orders/${orderId}`);
    const vendorRef = db.doc(`vendors/${vendorId}`);
    let refunded = false;
    await db.runTransaction(async (t) => {
        var _a, _b, _c;
        const order = (await t.get(orderRef)).data();
        if (!order || order.vendorId !== vendorId || order.status !== "completed" || order.creditRefunded)
            return;
        const leadRef = order.leadId ? db.doc(`analytics/${order.leadId}`) : null;
        if (leadRef) {
            const lead = (await t.get(leadRef)).data();
            if (!lead || lead.vendorId !== vendorId || lead.creditDeducted !== true || lead.creditRefunded)
                return;
        }
        else {
            const created = (_c = (_b = (_a = order.createdAt) === null || _a === void 0 ? void 0 : _a.toMillis) === null || _b === void 0 ? void 0 : _b.call(_a)) !== null && _c !== void 0 ? _c : 0;
            if (!created || created >= exports.LEAD_LINK_SINCE)
                return;
        }
        if (leadRef)
            t.update(leadRef, { creditRefunded: true });
        t.update(orderRef, {
            creditRefunded: true,
            creditRefundedAt: firestore_1.FieldValue.serverTimestamp(),
            history: firestore_1.FieldValue.arrayUnion({ type: "credit_refunded", at: new Date().toISOString(), via: "review" }),
        });
        t.update(vendorRef, { credits: firestore_1.FieldValue.increment(1) });
        refunded = true;
    });
    return refunded;
}
//# sourceMappingURL=reviewCredit.js.map