// functions/index.ts
// Deploy with: firebase deploy --only functions

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

initializeApp();

const db = getFirestore();

// Helper: send data-only push (no "notification" key = no browser auto-display = no duplicates)
async function sendPush(token: string, title: string, body: string, extraData: Record<string, string> = {}) {
  await getMessaging().send({
    token,
    data: {
      title,
      body,
      ...extraData,
    },
    android: {
      priority: "high",
    },
    apns: {
      payload: {
        aps: { sound: "default", badge: 1, "content-available": 1 },
      },
    },
    webpush: {
      headers: { Urgency: "high" },
    },
  });
}

// Trigger on every new analytics doc (new order/inquiry)
export const onNewOrder = onDocumentCreated(
  "analytics/{docId}",
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    if (data.type !== "whatsapp_lead") return;

    const { vendorId, vendorName, totalAmount, items } = data;
    if (!vendorId) return;

    const vendorSnap = await db.doc(`vendors/${vendorId}`).get();
    const fcmToken = vendorSnap.data()?.fcmToken;

    if (!fcmToken) {
      console.log(`No FCM token for vendor ${vendorId}`);
      return;
    }

    const itemSummary = Array.isArray(items)
      ? items.map((i: { name: string; qty: number }) => `${i.name} x${i.qty}`).join(", ")
      : "Gear rental";

    await sendPush(fcmToken, "🛒 Pesanan Baru!", `${itemSummary} — RM ${totalAmount}`, {
      url: "/store",
      vendorId,
      type: "new_order",
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

    const { vendorId, customerName, customerPhone, orderId } = data;
    if (!vendorId) return;

    // Link agreement to order
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
      } catch (e) {
        console.error("Availability sync error:", e);
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

    await sendPush(fcmToken, "✅ Perjanjian Ditandatangani!", `${customerName || "Pelanggan"} telah menandatangani perjanjian sewa`, {
      url: "/store",
      vendorId,
      type: "agreement_signed",
    });

    console.log(`Agreement notification sent to vendor ${vendorId}`);
  }
);

// Trigger on review submitted
export const onReviewCreated = onDocumentCreated(
  "reviews/{docId}",
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const { vendorId, orderId, rating, ratings } = data;
    if (!vendorId || !rating) return;

    // 1. Mark review token as used on order
    if (orderId) {
      try {
        await db.doc(`orders/${orderId}`).update({
          reviewTokenUsed: true,
        });
        console.log(`Order ${orderId} review token marked as used`);
      } catch (e) {
        console.error(`Failed to update order ${orderId}:`, e);
      }
    }

    // 2. Update vendor rating aggregates (overall + per-category)
    try {
      const vendorRef = db.doc(`vendors/${vendorId}`);
      const vendorSnap = await vendorRef.get();
      const vendorData = vendorSnap.data();

      const currentCount = vendorData?.reviewCount || 0;
      const currentRating = vendorData?.rating || 0;
      const currentBreakdown = vendorData?.ratingBreakdown || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

      const newCount = currentCount + 1;
      const newRating = ((currentRating * currentCount) + rating) / newCount;
      const roundedRating = Math.round(rating);
      const newBreakdown = { ...currentBreakdown, [roundedRating]: (currentBreakdown[roundedRating] || 0) + 1 };

      const currentCategoryAvg = vendorData?.categoryRatings || {};
      const newCategoryAvg: Record<string, number> = {};
      if (ratings && typeof ratings === "object") {
        for (const [key, val] of Object.entries(ratings)) {
          const prev = currentCategoryAvg[key] || 0;
          newCategoryAvg[key] = Math.round(((prev * currentCount + (val as number)) / newCount) * 10) / 10;
        }
      }

      await vendorRef.update({
        reviewCount: newCount,
        rating: Math.round(newRating * 10) / 10,
        ratingBreakdown: newBreakdown,
        ...(Object.keys(newCategoryAvg).length > 0 ? { categoryRatings: newCategoryAvg } : {}),
      });

      console.log(`Vendor ${vendorId} rating updated: ${newRating.toFixed(1)} (${newCount} reviews)`);
    } catch (e) {
      console.error("Vendor rating update error:", e);
    }

    // 3. Send notification to vendor
    try {
      const vendorSnap = await db.doc(`vendors/${vendorId}`).get();
      const fcmToken = vendorSnap.data()?.fcmToken;
      if (!fcmToken) return;

      await sendPush(fcmToken, `⭐ Review Baru! ${rating}/5`, `${data.customerName || "Pelanggan"} telah memberi ulasan`, {
        url: "/store",
        vendorId,
        type: "new_review",
      });
    } catch (e) {
      console.error("Review notification error:", e);
    }
  }
);

// Trigger on new order — validate stock server-side to prevent overbooking
export const onOrderCreated = onDocumentCreated(
  "orders/{orderId}",
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const { vendorId, items, bookingDates } = data;
    if (!vendorId || !items || !bookingDates?.start || !bookingDates?.end) return;

    // Skip if already marked (e.g. re-trigger)
    if (data.stockValidated) return;

    try {
      const conflicts: string[] = [];
      const startDate = new Date(bookingDates.start);
      const endDate = new Date(bookingDates.end);

      for (const item of items) {
        if (!item.id) continue;

        // Get gear doc for total stock
        const gearSnap = await db.doc(`gear/${item.id}`).get();
        const gearData = gearSnap.data();
        if (!gearData) continue;

        const totalStock = gearData.stock || 0;

        // Count already booked qty for overlapping dates
        const availSnap = await db
          .collection(`vendors/${vendorId}/availability`)
          .where("itemId", "==", item.id)
          .where("type", "==", "booking")
          .get();

        let bookedQty = 0;
        for (const doc of availSnap.docs) {
          const entry = doc.data();
          const eStart = new Date(entry.start);
          const eEnd = new Date(entry.end || entry.start);
          // Check date overlap
          if (eStart <= endDate && eEnd >= startDate) {
            // Exclude entries from this same order (in case of re-validation)
            if (entry.orderId !== event.data?.id) {
              bookedQty += entry.qty || 0;
            }
          }
        }

        const remaining = totalStock - bookedQty;
        const requested = item.qty || 1;

        if (requested > remaining) {
          conflicts.push(`${item.name}: requested ${requested}, only ${Math.max(0, remaining)} available`);
        }
      }

      // Update order with validation result
      const updateData: Record<string, any> = {
        stockValidated: true,
        stockValidatedAt: new Date(),
      };

      if (conflicts.length > 0) {
        updateData.stockConflict = true;
        updateData.stockConflictDetails = conflicts;
        updateData.status = "conflict";

        // Notify vendor about conflict
        const vendorSnap = await db.doc(`vendors/${vendorId}`).get();
        const fcmToken = vendorSnap.data()?.fcmToken;
        if (fcmToken) {
          await sendPush(fcmToken, "⚠️ Konflik Stok!", `${conflicts.length} item melebihi stok: ${conflicts[0]}`, {
            url: "/store?tab=orders",
            vendorId,
            type: "stock_conflict",
          });
        }

        console.log(`Order ${event.data?.id} has stock conflicts: ${conflicts.join(", ")}`);
      } else {
        updateData.stockConflict = false;
      }

      await db.doc(`orders/${event.data?.id}`).update(updateData);
    } catch (e) {
      console.error("Stock validation error:", e);
    }
  }
);