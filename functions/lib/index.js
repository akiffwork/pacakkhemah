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
    var _a, _b, _c;
    const data = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!data)
        return;
    const { vendorId, customerName, customerPhone, orderId, startDate, endDate } = data;
    if (!vendorId)
        return;
    // Link agreement to order (server-side — customers can't write to orders)
    if (orderId) {
        try {
            await db.doc(`orders/${orderId}`).update({
                status: "confirmed",
                customerName: customerName || "",
                customerPhone: customerPhone || "",
                agreementSigned: true,
                agreementSignedAt: new Date(),
                agreementId: ((_b = event.data) === null || _b === void 0 ? void 0 : _b.id) || null,
            });
            console.log(`Order ${orderId} linked to agreement`);
        }
        catch (e) {
            console.error(`Failed to link order ${orderId}:`, e);
        }
        // Update calendar availability entries with customer info
        try {
            const availSnap = await db
                .collection(`vendors/${vendorId}/availability`)
                .where("orderId", "==", orderId)
                .get();
            const batch = db.batch();
            availSnap.docs.forEach((doc) => {
                batch.update(doc.ref, {
                    customer: customerName || "",
                    phone: customerPhone || "",
                });
            });
            if (!availSnap.empty) {
                await batch.commit();
                console.log(`Updated ${availSnap.size} availability entries for order ${orderId}`);
            }
        }
        catch (e) {
            console.error("Availability sync error:", e);
        }
    }
    // Increment vendor order tally
    try {
        await db.doc(`vendors/${vendorId}`).update({
            order_count: firestore_2.FieldValue.increment(1),
            total_orders: firestore_2.FieldValue.increment(1),
        });
    }
    catch (e) {
        console.error("Tally update error:", e);
    }
    // Send push notification
    const vendorSnap = await db.doc(`vendors/${vendorId}`).get();
    const fcmToken = (_c = vendorSnap.data()) === null || _c === void 0 ? void 0 : _c.fcmToken;
    if (!fcmToken)
        return;
    await (0, messaging_1.getMessaging)().send({
        token: fcmToken,
        notification: {
            title: "✅ Perjanjian Ditandatangani!",
            body: `${customerName || "Pelanggan"} telah menandatangani perjanjian sewa`,
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