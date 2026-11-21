"use strict";
// functions/push.ts
// One place that sends vendor alerts. Data-only messages: the service worker
// (public/firebase-messaging-sw.js) shows them when the app is closed, and the
// dashboard shows an in-app toast when it is open.
Object.defineProperty(exports, "__esModule", { value: true });
exports.pushTag = pushTag;
exports.notifyVendor = notifyVendor;
const firestore_1 = require("firebase-admin/firestore");
const messaging_1 = require("firebase-admin/messaging");
// FCM errors that mean the token will never work again.
const DEAD_TOKEN_CODES = new Set([
    "messaging/registration-token-not-registered",
    "messaging/invalid-registration-token",
]);
/** One notification per booking (lead, signature, stock), one per review. */
function pushTag(type, refId) {
    if (!refId)
        return type;
    return type === "new_review" ? `review-${refId}` : `${type}-${refId}`;
}
/** Send an alert to the vendor's device. Returns false when nothing was sent. */
async function notifyVendor(vendorId, input) {
    var _a;
    const db = (0, firestore_1.getFirestore)();
    const vendorRef = db.doc(`vendors/${vendorId}`);
    const token = (_a = (await vendorRef.get()).data()) === null || _a === void 0 ? void 0 : _a.fcmToken;
    if (!token)
        return false;
    try {
        await (0, messaging_1.getMessaging)().send({
            token,
            data: {
                title: input.title,
                body: input.body,
                url: input.url,
                type: input.type,
                tag: pushTag(input.type, input.refId),
                vendorId,
            },
            android: { priority: "high" },
            webpush: { headers: { Urgency: "high", TTL: "86400" } },
        });
        return true;
    }
    catch (e) {
        const code = e.code || "";
        if (DEAD_TOKEN_CODES.has(code)) {
            // App removed or alerts revoked: forget the token so Settings shows "off".
            await vendorRef.update({ fcmToken: firestore_1.FieldValue.delete(), fcmUpdatedAt: new Date().toISOString() });
            console.warn(`Removed dead FCM token for vendor ${vendorId} (${code})`);
            return false;
        }
        throw e;
    }
}
//# sourceMappingURL=push.js.map