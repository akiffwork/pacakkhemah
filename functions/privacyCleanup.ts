// functions/privacyCleanup.ts
// One-off admin clean-up (Admin › Settings › Privacy clean-up):
// 1. Moves each shop's login email and tax details from the public vendor
//    record to vendors/{id}/privateInfo/details.
// 2. Removes customer names and phone numbers from discount and referral
//    usage lists (those documents are public); keeps orderId and date.
// Safe to run more than once.

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue, type Firestore } from "firebase-admin/firestore";

const OWNER = "akiff.work@gmail.com";

async function isAdmin(db: Firestore, email?: string, verified?: boolean): Promise<boolean> {
  if (!email) return false;
  if (email === OWNER) return true;
  if (!verified) return false;
  const admins = (await db.doc("private/admins").get()).data()?.emails;
  return Array.isArray(admins) && admins.map((e: string) => String(e).toLowerCase()).includes(email.toLowerCase());
}

type Usage = { orderId?: string; date?: unknown; phone?: string; name?: string };

export function scrubUsage(list: unknown): { list: Usage[]; changed: boolean } {
  if (!Array.isArray(list)) return { list: [], changed: false };
  let changed = false;
  const out = list.map((u: Usage) => {
    if (u && typeof u === "object" && ("phone" in u || "name" in u)) {
      changed = true;
      const { orderId, date } = u;
      return { ...(orderId ? { orderId } : {}), ...(date !== undefined ? { date } : {}) };
    }
    return u;
  });
  return { list: out, changed };
}

export async function runPrivacyCleanup(db: Firestore) {
  let moved = 0, scrubbed = 0;
  const vendors = await db.collection("vendors").get();
  for (const v of vendors.docs) {
    const d = v.data();
    if (d.email !== undefined || d.taxProfile !== undefined) {
      const privRef = db.doc(`vendors/${v.id}/privateInfo/details`);
      const existing = (await privRef.get()).data() || {};
      const fields: Record<string, unknown> = {};
      if (d.email !== undefined && existing.email === undefined) fields.email = d.email;
      if (d.taxProfile !== undefined && existing.taxProfile === undefined) fields.taxProfile = d.taxProfile;
      const batch = db.batch();
      if (Object.keys(fields).length) batch.set(privRef, fields, { merge: true });
      batch.update(v.ref, { email: FieldValue.delete(), taxProfile: FieldValue.delete() });
      await batch.commit();
      moved++;
    }
    for (const sub of ["discounts", "referrals"]) {
      const snap = await db.collection(`vendors/${v.id}/${sub}`).get();
      for (const doc of snap.docs) {
        const { list, changed } = scrubUsage(doc.data().usedBy);
        if (changed) { await doc.ref.update({ usedBy: list }); scrubbed++; }
      }
    }
  }
  return { vendors: vendors.size, moved, scrubbed };
}

export const adminPrivacyCleanup = onCall({ region: "us-central1", timeoutSeconds: 540 }, async (req) => {
  const db = getFirestore();
  const token = req.auth?.token;
  if (!(await isAdmin(db, token?.email, token?.email_verified))) {
    throw new HttpsError("permission-denied", "Admins only.");
  }
  return runPrivacyCleanup(db);
});
