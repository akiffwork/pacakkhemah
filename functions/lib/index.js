"use strict";
// functions/index.ts
// Deploy with: firebase deploy --only functions
Object.defineProperty(exports, "__esModule", { value: true });
exports.onAgreementSigned = exports.onNewOrder = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const app_1 = require("firebase-admin/app");
const firestore_2 = require("firebase-admin/firestore");
const messaging_1 = require("firebase-admin/messaging");
(0, app_1.initializeApp)();
const db = (0, firestore_2.getFirestore)();
// Trigger on every new analytics doc (new order/inquiry)
exports.onNewOrder = (0, firestore_1.onDocumentCreated)("analytics/{docId}", async (event) => {
    var _a;
    const data = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!data)
        return;
    // Only notify for whatsapp_lead type
    if (data.type !== "whatsapp_lead")
        return;
    const { vendorId, vendorName, totalAmount, items } = data;
    if (!vendorId)
        return;
    // Get vendor's FCM token
    const vendorSnap = await db.doc(`vendors/${vendorId}`).get();
    const vendorData = vendorSnap.data();
    const fcmToken = vendorData === null || vendorData === void 0 ? void 0 : vendorData.fcmToken;
    if (!fcmToken) {
        console.log(`No FCM token for vendor ${vendorId}`);
        return;
    }
    // Build item summary
    const itemSummary = Array.isArray(items)
        ? items.map((i) => `${i.name} x${i.qty}`).join(", ")
        : "Gear rental";
    // Send push notification
    await (0, messaging_1.getMessaging)().send({
        token: fcmToken,
        notification: {
            title: "🛒 Pesanan Baru!",
            body: `${itemSummary} — RM ${totalAmount}`,
        },
        data: {
            url: "/store",
            vendorId,
            type: "new_order",
        },
        android: {
            notification: {
                channelId: "orders",
                priority: "high",
                sound: "default",
            },
        },
        apns: {
            payload: {
                aps: {
                    sound: "default",
                    badge: 1,
                },
            },
        },
    });
    console.log(`Notification sent to vendor ${vendorName || vendorId}`);
});
// Trigger on agreement signed
exports.onAgreementSigned = (0, firestore_1.onDocumentCreated)("agreements/{docId}", async (event) => {
    var _a, _b;
    const data = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!data)
        return;
    const { vendorId, customerName, startDate, endDate } = data;
    if (!vendorId)
        return;
    const vendorSnap = await db.doc(`vendors/${vendorId}`).get();
    const fcmToken = (_b = vendorSnap.data()) === null || _b === void 0 ? void 0 : _b.fcmToken;
    if (!fcmToken)
        return;
    await (0, messaging_1.getMessaging)().send({
        token: fcmToken,
        notification: {
            title: "✅ Perjanjian Ditandatangani!",
            body: `${customerName || "Pelanggan"} telah menandatangani perjanjian sewa (${startDate} – ${endDate})`,
        },
        data: {
            url: "/store",
            vendorId,
            type: "agreement_signed",
        },
        android: {
            notification: {
                channelId: "orders",
                priority: "high",
                sound: "default",
            },
        },
        apns: {
            payload: {
                aps: { sound: "default", badge: 1 },
            },
        },
    });
    console.log(`Agreement notification sent to vendor ${vendorId}`);
});
//# sourceMappingURL=index.js.map