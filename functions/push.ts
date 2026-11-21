// functions/push.ts
// One place that sends vendor alerts. Data-only messages: the service worker
// (public/firebase-messaging-sw.js) shows them when the app is closed, and the
// dashboard shows an in-app toast when it is open.

import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

export type PushType = "new_order" | "agreement_signed" | "new_review" | "stock_conflict";

export type PushInput = {
  type: PushType;
  title: string;
  body: string;
  url: string;
  /** Doc the alert is about. Alerts with the same tag replace each other on the phone. */
  refId?: string;
};

// FCM errors that mean the token will never work again.
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

/** One notification per booking (lead, signature, stock), one per review. */
export function pushTag(type: PushType, refId?: string): string {
  if (!refId) return type;
  return type === "new_review" ? `review-${refId}` : `${type}-${refId}`;
}

/** Send an alert to the vendor's device. Returns false when nothing was sent. */
export async function notifyVendor(vendorId: string, input: PushInput): Promise<boolean> {
  const db = getFirestore();
  const vendorRef = db.doc(`vendors/${vendorId}`);
  const token = (await vendorRef.get()).data()?.fcmToken;
  if (!token) return false;

  try {
    await getMessaging().send({
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
  } catch (e) {
    const code = (e as { code?: string }).code || "";
    if (DEAD_TOKEN_CODES.has(code)) {
      // App removed or alerts revoked: forget the token so Settings shows "off".
      await vendorRef.update({ fcmToken: FieldValue.delete(), fcmUpdatedAt: new Date().toISOString() });
      console.warn(`Removed dead FCM token for vendor ${vendorId} (${code})`);
      return false;
    }
    throw e;
  }
}
