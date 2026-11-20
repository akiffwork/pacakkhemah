// functions/agreementLink.ts
// Links a newly signed agreement to its order. Anyone with the agreement link
// can sign, so the order is only updated when it really belongs to the same
// vendor, is still open, and has no agreement linked yet.

import type { Firestore } from "firebase-admin/firestore";

export type LinkResult =
  | { linked: true }
  | { linked: false; reason: "no_order" | "order_not_found" | "other_vendor" | "order_closed" | "already_signed" | "error" };

type AgreementData = { vendorId?: string; orderId?: string | null; customerName?: string; customerPhone?: string };

export async function linkAgreementToOrder(db: Firestore, agreementId: string, data: AgreementData): Promise<LinkResult> {
  const { vendorId, orderId, customerName, customerPhone } = data;
  if (!orderId) return { linked: false, reason: "no_order" };

  let result: LinkResult;
  try {
    const orderRef = db.doc(`orders/${orderId}`);
    const snap = await orderRef.get();
    const o = snap.data() as { vendorId?: string; status?: string; deleted?: boolean; agreementId?: string; customerName?: string; customerPhone?: string } | undefined;

    if (!snap.exists || !o || o.deleted) result = { linked: false, reason: "order_not_found" };
    else if (o.vendorId !== vendorId) result = { linked: false, reason: "other_vendor" };
    else if (o.status === "cancelled" || o.status === "completed") result = { linked: false, reason: "order_closed" };
    else if (o.agreementId && o.agreementId !== agreementId) result = { linked: false, reason: "already_signed" };
    else {
      await orderRef.update({
        // A new order is confirmed by the signature (as before); other
        // statuses are left alone.
        ...(o.status === "pending" ? { status: "confirmed" } : {}),
        customerName: customerName || o.customerName || "",
        customerPhone: customerPhone || o.customerPhone || "",
        agreementSigned: true,
        agreementSignedAt: new Date(),
        agreementId,
      });
      result = { linked: true };
    }
  } catch (e) {
    console.error(`Failed to link order ${orderId}:`, e);
    result = { linked: false, reason: "error" };
  }

  if (!result.linked) {
    // Keep the agreement, but show it as "Not linked" so the vendor can link
    // it by hand from the right order.
    console.warn(`Agreement ${agreementId} not linked to order ${orderId}: ${result.reason}`);
    try {
      await db.doc(`agreements/${agreementId}`).update({ orderId: null, requestedOrderId: orderId, linkSkipped: result.reason });
    } catch (e) {
      console.error("Could not mark agreement as unlinked:", e);
    }
  }
  return result;
}
