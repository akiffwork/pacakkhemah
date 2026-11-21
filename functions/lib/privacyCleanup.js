"use strict";
// functions/privacyCleanup.ts
// One-off admin clean-up (Admin › Settings › Privacy clean-up):
// 1. Moves each shop's login email and tax details from the public vendor
//    record to vendors/{id}/privateInfo/details.
// 2. Removes customer names and phone numbers from discount and referral
//    usage lists (those documents are public); keeps orderId and date.
// Safe to run more than once.
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminPrivacyCleanup = void 0;
exports.scrubUsage = scrubUsage;
exports.runPrivacyCleanup = runPrivacyCleanup;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const OWNER = "akiff.work@gmail.com";
async function isAdmin(db, email, verified) {
    var _a;
    if (!email)
        return false;
    if (email === OWNER)
        return true;
    if (!verified)
        return false;
    const admins = (_a = (await db.doc("private/admins").get()).data()) === null || _a === void 0 ? void 0 : _a.emails;
    return Array.isArray(admins) && admins.map((e) => String(e).toLowerCase()).includes(email.toLowerCase());
}
function scrubUsage(list) {
    if (!Array.isArray(list))
        return { list: [], changed: false };
    let changed = false;
    const out = list.map((u) => {
        if (u && typeof u === "object" && ("phone" in u || "name" in u)) {
            changed = true;
            const { orderId, date } = u;
            return Object.assign(Object.assign({}, (orderId ? { orderId } : {})), (date !== undefined ? { date } : {}));
        }
        return u;
    });
    return { list: out, changed };
}
async function runPrivacyCleanup(db) {
    let moved = 0, scrubbed = 0;
    const vendors = await db.collection("vendors").get();
    for (const v of vendors.docs) {
        const d = v.data();
        if (d.email !== undefined || d.taxProfile !== undefined) {
            const privRef = db.doc(`vendors/${v.id}/privateInfo/details`);
            const existing = (await privRef.get()).data() || {};
            const fields = {};
            if (d.email !== undefined && existing.email === undefined)
                fields.email = d.email;
            if (d.taxProfile !== undefined && existing.taxProfile === undefined)
                fields.taxProfile = d.taxProfile;
            const batch = db.batch();
            if (Object.keys(fields).length)
                batch.set(privRef, fields, { merge: true });
            batch.update(v.ref, { email: firestore_1.FieldValue.delete(), taxProfile: firestore_1.FieldValue.delete() });
            await batch.commit();
            moved++;
        }
        for (const sub of ["discounts", "referrals"]) {
            const snap = await db.collection(`vendors/${v.id}/${sub}`).get();
            for (const doc of snap.docs) {
                const { list, changed } = scrubUsage(doc.data().usedBy);
                if (changed) {
                    await doc.ref.update({ usedBy: list });
                    scrubbed++;
                }
            }
        }
    }
    return { vendors: vendors.size, moved, scrubbed };
}
exports.adminPrivacyCleanup = (0, https_1.onCall)({ region: "us-central1", timeoutSeconds: 540 }, async (req) => {
    var _a;
    const db = (0, firestore_1.getFirestore)();
    const token = (_a = req.auth) === null || _a === void 0 ? void 0 : _a.token;
    if (!(await isAdmin(db, token === null || token === void 0 ? void 0 : token.email, token === null || token === void 0 ? void 0 : token.email_verified))) {
        throw new https_1.HttpsError("permission-denied", "Admins only.");
    }
    return runPrivacyCleanup(db);
});
//# sourceMappingURL=privacyCleanup.js.map