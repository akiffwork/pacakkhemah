/**
 * @jest-environment node
 *
 * Credit back for a reviewed order (functions/reviewCredit.ts): only a credit
 * that was charged for that booking, once.
 */
type Data = Record<string, unknown>;
const docs = new Map<string, Data>();
const ref = (path: string) => ({ path });

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    increment: (n: number) => ({ __inc: n }),
    serverTimestamp: () => 'now',
    arrayUnion: (...v: unknown[]) => ({ __union: v }),
  },
}), { virtual: true });

const fakeDb = {
  doc: ref,
  runTransaction: async (fn: (t: unknown) => Promise<void>) => {
    const writes: [string, Data][] = [];
    await fn({
      get: async (r: { path: string }) => ({ data: () => docs.get(r.path) }),
      update: (r: { path: string }, patch: Data) => { writes.push([r.path, patch]); },
    });
    for (const [path, patch] of writes) {
      const cur = { ...(docs.get(path) || {}) };
      for (const [k, v] of Object.entries(patch)) {
        cur[k] = v && typeof v === 'object' && '__inc' in v ? ((cur[k] as number) || 0) + (v as { __inc: number }).__inc : v;
      }
      docs.set(path, cur);
    }
  },
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { refundCreditForReview, LEAD_LINK_SINCE } = require('../../functions/reviewCredit');
const refund = () => refundCreditForReview(fakeDb, 'v1', 'o1');
const at = (ms: number) => ({ toMillis: () => ms });
const credits = () => docs.get('vendors/v1')!.credits;

beforeEach(() => {
  docs.clear();
  docs.set('vendors/v1', { credits: 5 });
  docs.set('analytics/L1', { vendorId: 'v1', creditDeducted: true });
  docs.set('orders/o1', { vendorId: 'v1', status: 'completed', leadId: 'L1', createdAt: at(LEAD_LINK_SINCE + 1000) });
});

test('gives back the credit charged for the booking, once', async () => {
  expect(await refund()).toBe(true);
  expect(credits()).toBe(6);
  expect(docs.get('analytics/L1')).toMatchObject({ creditRefunded: true });
  expect(await refund()).toBe(false);
  expect(credits()).toBe(6);
});

test('nothing back when no credit was charged for the lead', async () => {
  docs.set('analytics/L1', { vendorId: 'v1', creditDeducted: false });
  expect(await refund()).toBe(false);
  expect(credits()).toBe(5);
});

test('a lead can only be refunded once, even from another order', async () => {
  await refund();
  docs.set('orders/o1', { vendorId: 'v1', status: 'completed', leadId: 'L1', createdAt: at(LEAD_LINK_SINCE + 2000) });
  expect(await refund()).toBe(false);
  expect(credits()).toBe(6);
});

test("another shop's lead does not count", async () => {
  docs.set('analytics/L1', { vendorId: 'v2', creditDeducted: true });
  expect(await refund()).toBe(false);
});

test('new orders without a lead get nothing; older orders keep the old rule', async () => {
  docs.set('orders/o1', { vendorId: 'v1', status: 'completed', createdAt: at(LEAD_LINK_SINCE + 1000) });
  expect(await refund()).toBe(false);
  docs.set('orders/o1', { vendorId: 'v1', status: 'completed', createdAt: at(LEAD_LINK_SINCE - 1000) });
  expect(await refund()).toBe(true);
  expect(credits()).toBe(6);
});

test('only completed orders of the same vendor', async () => {
  docs.set('orders/o1', { vendorId: 'v1', status: 'confirmed', leadId: 'L1' });
  expect(await refund()).toBe(false);
  docs.set('orders/o1', { vendorId: 'v2', status: 'completed', leadId: 'L1' });
  expect(await refund()).toBe(false);
});
