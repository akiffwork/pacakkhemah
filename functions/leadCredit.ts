// functions/leadCredit.ts
// 1 credit per booking request, once per visitor per 24 hours. Booking
// requests come from the public shop, so a script could invent visitor IDs
// and drain a shop's credits. As a safety net, a shop is charged for at most
// `hourlyCap` new visitors per hour; requests above that still go through,
// they just don't cost a credit.

import { FieldValue, type Firestore } from "firebase-admin/firestore";

export const DEFAULT_HOURLY_CAP = 10;
const HOUR = 3_600_000;
const DAY = 86_400_000;

export type ChargeResult = { deducted: boolean; reason?: "repeat_visitor" | "no_credits" | "hourly_cap" };

type Millis = { toMillis?: () => number } | number | undefined;
const ms = (v: Millis): number => (typeof v === "number" ? v : typeof v?.toMillis === "function" ? v.toMillis() : 0);

export async function chargeLeadCredit(db: Firestore, vendorId: string, visitorId: string, hourlyCap = DEFAULT_HOURLY_CAP, now = Date.now()): Promise<ChargeResult> {
  const dedupRef = db.doc(`vendors/${vendorId}/leadCredits/${visitorId}`);
  const rateRef = db.doc(`vendors/${vendorId}/leadRate/current`);
  const vRef = db.doc(`vendors/${vendorId}`);
  let result: ChargeResult = { deducted: false };

  await db.runTransaction(async (t) => {
    const dedup = (await t.get(dedupRef)).data();
    const rate = (await t.get(rateRef)).data();
    const vendor = (await t.get(vRef)).data();

    const last = ms(dedup?.lastDeductedAt);
    if (last && now - last < DAY) { result = { deducted: false, reason: "repeat_visitor" }; return; }

    const windowStart = ms(rate?.windowStart);
    const inWindow = windowStart && now - windowStart < HOUR;
    const count = inWindow ? Number(rate?.count) || 0 : 0;
    if (count >= hourlyCap) { result = { deducted: false, reason: "hourly_cap" }; return; }

    if (((vendor?.credits ?? 0) as number) <= 0) { result = { deducted: false, reason: "no_credits" }; return; }

    t.update(vRef, { credits: FieldValue.increment(-1) });
    t.set(dedupRef, { lastDeductedAt: now }, { merge: true });
    t.set(rateRef, inWindow ? { windowStart, count: count + 1 } : { windowStart: now, count: 1 });
    result = { deducted: true };
  });
  return result;
}
