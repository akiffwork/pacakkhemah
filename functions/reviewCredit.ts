// functions/reviewCredit.ts
// A vendor gets 1 credit back when a completed order receives a customer
// review. Only a credit that was actually charged for that booking (its lead
// in `analytics`) is given back, once, so credits can't be farmed with
// orders that never cost one.

import { FieldValue, type Firestore } from "firebase-admin/firestore";

// Orders placed from this time carry the ID of their lead (analytics doc).
// Older orders keep the old rule: one credit back per reviewed order.
export const LEAD_LINK_SINCE = Date.UTC(2026, 10, 22, 0, 0, 0); // 22 Nov 2026, 08:00 MYT

export async function refundCreditForReview(db: Firestore, vendorId: string, orderId: string): Promise<boolean> {
  const orderRef = db.doc(`orders/${orderId}`);
  const vendorRef = db.doc(`vendors/${vendorId}`);
  let refunded = false;
  await db.runTransaction(async (t) => {
    const order = (await t.get(orderRef)).data();
    if (!order || order.vendorId !== vendorId || order.status !== "completed" || order.creditRefunded) return;

    const leadRef = order.leadId ? db.doc(`analytics/${order.leadId}`) : null;
    if (leadRef) {
      const lead = (await t.get(leadRef)).data();
      if (!lead || lead.vendorId !== vendorId || lead.creditDeducted !== true || lead.creditRefunded) return;
    } else {
      const created = order.createdAt?.toMillis?.() ?? 0;
      if (!created || created >= LEAD_LINK_SINCE) return;
    }

    if (leadRef) t.update(leadRef, { creditRefunded: true });
    t.update(orderRef, {
      creditRefunded: true,
      creditRefundedAt: FieldValue.serverTimestamp(),
      history: FieldValue.arrayUnion({ type: "credit_refunded", at: new Date().toISOString(), via: "review" }),
    });
    t.update(vendorRef, { credits: FieldValue.increment(1) });
    refunded = true;
  });
  return refunded;
}
