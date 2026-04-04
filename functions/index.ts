// functions/index.ts
// Deploy with: firebase deploy --only functions

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

initializeApp();

const db = getFirestore();

// Trigger on every new analytics doc (new order/inquiry)
export const onNewOrder = onDocumentCreated(
  "analytics/{docId}",
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    // Only notify for whatsapp_lead type
    if (data.type !== "whatsapp_lead") return;

    const { vendorId, vendorName, totalAmount, items } = data;
    if (!vendorId) return;

    // Get vendor's FCM token
    const vendorSnap = await db.doc(`vendors/${vendorId}`).get();
    const vendorData = vendorSnap.data();
    const fcmToken = vendorData?.fcmToken;

    if (!fcmToken) {
      console.log(`No FCM token for vendor ${vendorId}`);
      return;
    }

    // Build item summary
    const itemSummary = Array.isArray(items)
      ? items.map((i: { name: string; qty: number }) => `${i.name} x${i.qty}`).join(", ")
      : "Gear rental";

    // Send push notification
    await getMessaging().send({
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
  }
);

// Trigger on agreement signed
export const onAgreementSigned = onDocumentCreated(
  "agreements/{docId}",
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const { vendorId, customerName, customerPhone, orderId, startDate, endDate } = data;
    if (!vendorId) return;

    // Link agreement to order (server-side — customers can't write to orders)
    if (orderId) {
      try {
        await db.doc(`orders/${orderId}`).update({
          status: "confirmed",
          customerName: customerName || "",
          customerPhone: customerPhone || "",
          agreementSigned: true,
          agreementSignedAt: new Date(),
          agreementId: event.data?.id || null,
        });
        console.log(`Order ${orderId} linked to agreement`);
      } catch (e) {
        console.error(`Failed to link order ${orderId}:`, e);
      }
    }

    // Increment vendor order tally
    try {
      await db.doc(`vendors/${vendorId}`).update({
        order_count: FieldValue.increment(1),
        total_orders: FieldValue.increment(1),
      });
    } catch (e) {
      console.error("Tally update error:", e);
    }

    // Send push notification
    const vendorSnap = await db.doc(`vendors/${vendorId}`).get();
    const fcmToken = vendorSnap.data()?.fcmToken;
    if (!fcmToken) return;

    await getMessaging().send({
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
  }
);