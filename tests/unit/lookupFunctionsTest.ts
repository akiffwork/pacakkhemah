/**
 * @jest-environment node
 *
 * Customer lookups (functions/lookups.ts): phone search for "my bookings" and
 * the review-link check, against a fake Firestore.
 */

import { createHash } from 'crypto';
type Data = Record<string, unknown>;
const key = (id: string) => createHash('sha256').update(id).digest('hex').slice(0, 16);
const orders = new Map<string, Data>();

class FakeTimestamp { constructor(private d: Date) {} toDate() { return this.d; } }

function query(filters: [string, string, unknown][] = []) {
  return {
    where: (f: string, op: string, v: unknown) => query([...filters, [f, op, v]]),
    limit: () => ({
      get: async () => {
        const docs = [...orders.entries()]
          .filter(([, d]) => filters.every(([f, op, v]) => op === 'in' ? (v as unknown[]).includes(d[f]) : d[f] === v))
          .map(([id, d]) => ({ id, data: () => d }));
        return { empty: docs.length === 0, docs };
      },
    }),
  };
}

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({ collection: () => query() }),
  Timestamp: FakeTimestamp,
}), { virtual: true });
jest.mock('firebase-functions/v2/https', () => {
  class HttpsError extends Error { code: string; constructor(code: string, msg: string) { super(msg); this.code = code; } }
  return { onCall: (_o: unknown, fn: unknown) => fn, HttpsError };
}, { virtual: true });

// eslint-disable-next-line @typescript-eslint/no-require-imports
const lookups = require('../../functions/lookups');
type Call = (req: { data: unknown }) => Promise<Data>;
const byPhone = lookups.lookupBookingsByPhone as Call;
const byToken = lookups.lookupOrderByReviewToken as Call;

const base = {
  vendorId: 'v1', vendorName: 'Kuantan Camp Gear', vendorSlug: 'kuantan',
  items: [{ name: 'Tent', qty: 1, price: 80, lineTotal: 80 }], totalAmount: 130, rentalAmount: 80, depositAmount: 50,
  bookingDates: { start: '2026-11-20', end: '2026-11-22' }, customerName: 'Aiman', pickupLocation: 'No 1, Jalan Rumah',
};

beforeEach(() => {
  orders.clear();
  orders.set('o1', { ...base, customerPhone: '60123456789', status: 'pending', createdAt: new FakeTimestamp(new Date('2026-11-10')) });
  orders.set('o2', { ...base, customerPhone: '0123456789', status: 'completed', reviewToken: 'o2', reviewTokenUsed: false, createdAt: new FakeTimestamp(new Date('2026-11-12')) });
  orders.set('o3', { ...base, vendorId: 'v2', customerPhone: '+60123456789', status: 'completed', reviewToken: 'o3', reviewTokenUsed: true, createdAt: '2026-11-01T00:00:00.000Z' });
  orders.set('o4', { ...base, customerPhone: '60199999999', status: 'pending', reviewToken: 'o4', createdAt: '2026-11-05T00:00:00.000Z' });
});

describe('lookupBookingsByPhone', () => {
  it('finds bookings however the number was saved, newest first', async () => {
    const { results } = await byPhone({ data: { phone: '012-345 6789' } }) as { results: Data[] };
    expect(results.map(r => r.id)).toEqual(['o2', 'o1', 'o3'].map(key));
    // The real order ID (which opens the full order) is never returned
    expect(JSON.stringify(results)).not.toMatch(/"id":"o\d"/);
    expect(results[0]).toMatchObject({ vendorSlug: 'kuantan', status: 'completed', createdAt: '2026-11-12T00:00:00.000Z' });
  });

  it('limits to one shop when the shop page asks', async () => {
    const { results } = await byPhone({ data: { phone: '60123456789', vendorId: 'v2' } }) as { results: Data[] };
    expect(results.map(r => r.id)).toEqual([key('o3')]);
  });

  it('returns only what the page shows: no address or line totals', async () => {
    const { results } = await byPhone({ data: { phone: '60123456789' } }) as { results: Data[] };
    expect(results[0]).not.toHaveProperty('pickupLocation');
    expect(results[0]).not.toHaveProperty('reviewToken');
    expect(results[0].items).toEqual([{ name: 'Tent', qty: 1, price: 80 }]);
  });

  it('rejects numbers that are too short', async () => {
    await expect(byPhone({ data: { phone: '123' } })).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});

describe('lookupOrderByReviewToken', () => {
  it('returns the order for a valid, unused link on a completed order', async () => {
    const res = await byToken({ data: { token: 'o2' } });
    expect(res).toEqual({ error: 'invalid' }); // too short to be a real token
    orders.set('order123', { ...orders.get('o2')!, reviewToken: 'order123' });
    const ok = await byToken({ data: { token: 'order123' } }) as { orderId: string; order: Data };
    expect(ok.orderId).toBe('order123');
    expect(ok.order).toMatchObject({ vendorName: 'Kuantan Camp Gear', status: 'completed', reviewTokenUsed: false });
    expect(ok.order).not.toHaveProperty('pickupLocation');
  });

  it('says when a link is used, not completed or unknown', async () => {
    orders.set('usedtok1', { ...orders.get('o3')!, reviewToken: 'usedtok1' });
    orders.set('pendtok1', { ...orders.get('o4')!, reviewToken: 'pendtok1' });
    expect(await byToken({ data: { token: 'usedtok1' } })).toEqual({ error: 'used' });
    expect(await byToken({ data: { token: 'pendtok1' } })).toEqual({ error: 'not_completed' });
    expect(await byToken({ data: { token: 'nosuchtoken' } })).toEqual({ error: 'invalid' });
  });
});
