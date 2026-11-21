"use strict";
// functions/leadCredit.ts
// 1 credit per booking request, once per visitor per 24 hours. Booking
// requests come from the public shop, so a script could invent visitor IDs
// and drain a shop's credits. As a safety net, a shop is charged for at most
// `hourlyCap` new visitors per hour; requests above that still go through,
// they just don't cost a credit.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_HOURLY_CAP = void 0;
exports.chargeLeadCredit = chargeLeadCredit;
const firestore_1 = require("firebase-admin/firestore");
exports.DEFAULT_HOURLY_CAP = 10;
const HOUR = 3600000;
const DAY = 86400000;
const ms = (v) => (typeof v === "number" ? v : typeof (v === null || v === void 0 ? void 0 : v.toMillis) === "function" ? v.toMillis() : 0);
async function chargeLeadCredit(db, vendorId, visitorId, hourlyCap = exports.DEFAULT_HOURLY_CAP, now = Date.now()) {
    const dedupRef = db.doc(`vendors/${vendorId}/leadCredits/${visitorId}`);
    const rateRef = db.doc(`vendors/${vendorId}/leadRate/current`);
    const vRef = db.doc(`vendors/${vendorId}`);
    let result = { deducted: false };
    await db.runTransaction(async (t) => {
        var _a;
        const dedup = (await t.get(dedupRef)).data();
        const rate = (await t.get(rateRef)).data();
        const vendor = (await t.get(vRef)).data();
        const last = ms(dedup === null || dedup === void 0 ? void 0 : dedup.lastDeductedAt);
        if (last && now - last < DAY) {
            result = { deducted: false, reason: "repeat_visitor" };
            return;
        }
        const windowStart = ms(rate === null || rate === void 0 ? void 0 : rate.windowStart);
        const inWindow = windowStart && now - windowStart < HOUR;
        const count = inWindow ? Number(rate === null || rate === void 0 ? void 0 : rate.count) || 0 : 0;
        if (count >= hourlyCap) {
            result = { deducted: false, reason: "hourly_cap" };
            return;
        }
        if (((_a = vendor === null || vendor === void 0 ? void 0 : vendor.credits) !== null && _a !== void 0 ? _a : 0) <= 0) {
            result = { deducted: false, reason: "no_credits" };
            return;
        }
        t.update(vRef, { credits: firestore_1.FieldValue.increment(-1) });
        t.set(dedupRef, { lastDeductedAt: now }, { merge: true });
        t.set(rateRef, inWindow ? { windowStart, count: count + 1 } : { windowStart: now, count: 1 });
        result = { deducted: true };
    });
    return result;
}
//# sourceMappingURL=leadCredit.js.map