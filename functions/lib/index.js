"use strict";
// functions/index.ts
// Deploy with: firebase deploy --only functions
Object.defineProperty(exports, "__esModule", { value: true });
exports.onOrderCreated = exports.onReviewCreated = exports.onAgreementSigned = exports.onNewOrder = exports.adminPrivacyCleanup = exports.lookupOrderByReviewToken = exports.lookupBookingsByPhone = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const app_1 = require("firebase-admin/app");
const firestore_2 = require("firebase-admin/firestore");
const push_1 = require("./push");
(0, app_1.initializeApp)();
const db = (0, firestore_2.getFirestore)();
// Customer lookups (my bookings, review links); orders can't be listed from the browser
var lookups_1 = require("./lookups");
Object.defineProperty(exports, "lookupBookingsByPhone", { enumerable: true, get: function () { return lookups_1.lookupBookingsByPhone; } });
Object.defineProperty(exports, "lookupOrderByReviewToken", { enumerable: true, get: function () { return lookups_1.lookupOrderByReviewToken; } });
var privacyCleanup_1 = require("./privacyCleanup");
Object.defineProperty(exports, "adminPrivacyCleanup", { enumerable: true, get: function () { return privacyCleanup_1.adminPrivacyCleanup; } });
const agreementLink_1 = require("./agreementLink");
const reviewCredit_1 = require("./reviewCredit");
const leadCredit_1 = require("./leadCredit");
// Trigger on every new analytics doc (new order/inquiry)
exports.onNewOrder = (0, firestore_1.onDocumentCreated)("analytics/{docId}", async (event) => {
    var _a, _b;
    const data = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!data)
        return;
    if (data.type !== "whatsapp_lead")
        return;
    const { vendorId, vendorName, totalAmount, items, cartItems, visitorId } = data;
    if (!vendorId)
        return;
    // ── Credit deduction (Admin SDK bypasses Firestore security rules) ──────
    // Deduct 1 credit per unique visitorId per vendor per 24 hours.
    // Dedup is done atomically inside a transaction by reading a per-visitor
    // doc at vendors/{vendorId}/leadCredits/{visitorId}.
    console.log(`onNewOrder fired: vendorId=${vendorId} visitorId=${visitorId || "MISSING"}`);
    if (visitorId) {
        try {
            const cfg = (await db.doc("settings/payment_config").get()).data();
            const cap = Number(cfg === null || cfg === void 0 ? void 0 : cfg.leadCreditHourlyCap) > 0 ? Number(cfg === null || cfg === void 0 ? void 0 : cfg.leadCreditHourlyCap) : leadCredit_1.DEFAULT_HOURLY_CAP;
            const res = await (0, leadCredit_1.chargeLeadCredit)(db, vendorId, String(visitorId), cap);
            if (res.deducted) {
                await event.data.ref.update({ creditDeducted: true });
                console.log(`Credit deducted for vendor=${vendorId} visitor=${visitorId}`);
            }
            else {
                if (res.reason === "hourly_cap")
                    await event.data.ref.update({ creditSkipped: "hourly_cap" });
                console.log(`Credit NOT deducted for vendor=${vendorId} visitor=${visitorId}: ${res.reason}`);
            }
        }
        catch (e) {
            console.error("Credit deduction error:", e);
        }
    }
    else {
        console.warn(`Skipping credit deduction — no visitorId on analytics doc ${(_b = event.data) === null || _b === void 0 ? void 0 : _b.id}`);
    }
    // ────────────────────────────────────────────────────────────────────────
    // The shop cart sends cartItems; older leads used items
    const lineItems = Array.isArray(items) ? items : Array.isArray(cartItems) ? cartItems : null;
    const itemSummary = lineItems
        ? lineItems.map((i) => `${i.name} x${i.qty}`).join(", ")
        : "Gear rental";
    const sent = await (0, push_1.notifyVendor)(vendorId, {
        type: "new_order",
        title: "🛒 Pesanan Baru!",
        body: `${itemSummary} — RM ${totalAmount}`,
        url: "/store?tab=orders",
        refId: event.params.docId,
    });
    console.log(sent ? `Notification sent to vendor ${vendorName || vendorId}` : `No FCM token for vendor ${vendorId}`);
});
// Trigger on agreement signed
exports.onAgreementSigned = (0, firestore_1.onDocumentCreated)("agreements/{docId}", async (event) => {
    var _a, _b;
    const data = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!data)
        return;
    const { vendorId, customerName, customerPhone, orderId } = data;
    if (!vendorId)
        return;
    // Link agreement to order (only a real, open order of this vendor)
    const link = await (0, agreementLink_1.linkAgreementToOrder)(db, ((_b = event.data) === null || _b === void 0 ? void 0 : _b.id) || "", data);
    if (orderId && !link.linked && (link.reason === "order_not_found" || link.reason === "other_vendor")) {
        // Not a real order of this vendor: nothing to count or notify.
        return;
    }
    if (link.linked) {
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
    await (0, push_1.notifyVendor)(vendorId, {
        type: "agreement_signed",
        title: "✅ Perjanjian Ditandatangani!",
        body: `${customerName || "Pelanggan"} telah menandatangani perjanjian sewa`,
        url: "/store?tab=orders",
        refId: orderId || event.params.docId,
    });
    console.log(`Agreement notification sent to vendor ${vendorId}`);
});
// Trigger on review submitted
exports.onReviewCreated = (0, firestore_1.onDocumentCreated)("reviews/{docId}", async (event) => {
    var _a;
    const data = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!data)
        return;
    const { vendorId, orderId, rating, ratings } = data;
    if (!vendorId || !rating)
        return;
    // 1. Mark review token as used on order
    if (orderId) {
        try {
            await db.doc(`orders/${orderId}`).update({
                reviewTokenUsed: true,
            });
            console.log(`Order ${orderId} review token marked as used`);
        }
        catch (e) {
            console.error(`Failed to update order ${orderId}:`, e);
        }
    }
    // 1b. Reward: 1 credit back for a reviewed, completed order (only a
    // credit that was charged for it, once). See reviewCredit.ts.
    if (orderId) {
        try {
            if (await (0, reviewCredit_1.refundCreditForReview)(db, vendorId, orderId)) {
                console.log(`Credit refunded to vendor ${vendorId} for reviewed order ${orderId}`);
            }
        }
        catch (e) {
            console.error("Credit refund error:", e);
        }
    }
    // 2. Update vendor rating aggregates (overall + per-category)
    try {
        const vendorRef = db.doc(`vendors/${vendorId}`);
        const vendorSnap = await vendorRef.get();
        const vendorData = vendorSnap.data();
        const currentCount = (vendorData === null || vendorData === void 0 ? void 0 : vendorData.reviewCount) || 0;
        const currentRating = (vendorData === null || vendorData === void 0 ? void 0 : vendorData.rating) || 0;
        const currentBreakdown = (vendorData === null || vendorData === void 0 ? void 0 : vendorData.ratingBreakdown) || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        const newCount = currentCount + 1;
        const newRating = ((currentRating * currentCount) + rating) / newCount;
        const roundedRating = Math.round(rating);
        const newBreakdown = Object.assign(Object.assign({}, currentBreakdown), { [roundedRating]: (currentBreakdown[roundedRating] || 0) + 1 });
        const currentCategoryAvg = (vendorData === null || vendorData === void 0 ? void 0 : vendorData.categoryRatings) || {};
        const newCategoryAvg = {};
        if (ratings && typeof ratings === "object") {
            for (const [key, val] of Object.entries(ratings)) {
                const prev = currentCategoryAvg[key] || 0;
                newCategoryAvg[key] = Math.round(((prev * currentCount + val) / newCount) * 10) / 10;
            }
        }
        await vendorRef.update(Object.assign({ reviewCount: newCount, rating: Math.round(newRating * 10) / 10, ratingBreakdown: newBreakdown }, (Object.keys(newCategoryAvg).length > 0 ? { categoryRatings: newCategoryAvg } : {})));
        console.log(`Vendor ${vendorId} rating updated: ${newRating.toFixed(1)} (${newCount} reviews)`);
    }
    catch (e) {
        console.error("Vendor rating update error:", e);
    }
    // 3. Send notification to vendor
    try {
        await (0, push_1.notifyVendor)(vendorId, {
            type: "new_review",
            title: `⭐ Review Baru! ${rating}/5`,
            body: `${data.customerName || "Pelanggan"} telah memberi ulasan`,
            url: "/store?tab=reviews",
            refId: event.params.docId,
        });
    }
    catch (e) {
        console.error("Review notification error:", e);
    }
});
// Trigger on new order — validate stock server-side to prevent overbooking
exports.onOrderCreated = (0, firestore_1.onDocumentCreated)("orders/{orderId}", async (event) => {
    var _a, _b, _c, _d;
    const data = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!data)
        return;
    const { vendorId, items, bookingDates } = data;
    if (!vendorId || !items || !(bookingDates === null || bookingDates === void 0 ? void 0 : bookingDates.start) || !(bookingDates === null || bookingDates === void 0 ? void 0 : bookingDates.end))
        return;
    // Skip if already marked (e.g. re-trigger)
    if (data.stockValidated)
        return;
    try {
        const conflicts = [];
        const startDate = new Date(bookingDates.start);
        const endDate = new Date(bookingDates.end);
        for (const item of items) {
            if (!item.id)
                continue;
            // Get gear doc for total stock
            const gearSnap = await db.doc(`gear/${item.id}`).get();
            const gearData = gearSnap.data();
            if (!gearData)
                continue;
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
                    if (entry.orderId !== ((_b = event.data) === null || _b === void 0 ? void 0 : _b.id)) {
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
        const updateData = {
            stockValidated: true,
            stockValidatedAt: new Date(),
        };
        if (conflicts.length > 0) {
            updateData.stockConflict = true;
            updateData.stockConflictDetails = conflicts;
            updateData.status = "conflict";
            // Notify vendor about conflict
            try {
                await (0, push_1.notifyVendor)(vendorId, {
                    type: "stock_conflict",
                    title: "⚠️ Konflik Stok!",
                    body: `${conflicts.length} item melebihi stok: ${conflicts[0]}`,
                    url: "/store?tab=orders",
                    refId: event.params.orderId,
                });
            }
            catch (e) {
                console.error("Stock conflict notification error:", e);
            }
            console.log(`Order ${(_c = event.data) === null || _c === void 0 ? void 0 : _c.id} has stock conflicts: ${conflicts.join(", ")}`);
        }
        else {
            updateData.stockConflict = false;
        }
        await db.doc(`orders/${(_d = event.data) === null || _d === void 0 ? void 0 : _d.id}`).update(updateData);
    }
    catch (e) {
        console.error("Stock validation error:", e);
    }
});
//# sourceMappingURL=index.js.map