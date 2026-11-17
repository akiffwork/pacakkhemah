// src/lib/adminOrders.ts
// Admin overrides on an order. They follow the same steps as the vendor
// dashboard (timestamps, review link, calendar release) and are recorded in
// the order history with a reason.

import { arrayUnion, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type AdminOrderAction = "confirm" | "complete" | "cancel";

type OrderRef = { id: string; vendorId: string; reviewToken?: string };

async function releaseCalendar(o: OrderRef) {
  const snap = await getDocs(query(collection(db, "vendors", o.vendorId, "availability"), where("orderId", "==", o.id)));
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
}

export async function adminOrderAction(o: OrderRef, action: AdminOrderAction, reason: string): Promise<void> {
  const note = reason.trim();
  const history = arrayUnion({ type: action === "confirm" ? "confirmed" : action === "complete" ? "completed" : "cancelled", at: new Date().toISOString(), via: "admin", ...(note ? { note } : {}) });
  if (action === "confirm") {
    await updateDoc(doc(db, "orders", o.id), { status: "confirmed", confirmedAt: serverTimestamp(), stockConflict: false, history });
    return;
  }
  if (action === "complete") {
    await updateDoc(doc(db, "orders", o.id), {
      status: "completed", completedAt: serverTimestamp(),
      reviewToken: o.reviewToken || o.id, reviewTokenUsed: false, history,
    });
  } else {
    await updateDoc(doc(db, "orders", o.id), { status: "cancelled", cancelledAt: serverTimestamp(), cancelReason: note || "Cancelled by admin", history });
  }
  // Gear is free again on those dates
  await releaseCalendar(o).catch(e => console.error("Calendar release failed", e));
}
