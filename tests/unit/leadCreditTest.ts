/**
 * @jest-environment node
 *
 * 1 credit per booking request (functions/leadCredit.ts): once per visitor
 * per 24 h, and at most N new visitors charged per shop per hour.
 */
type Data = Record<string, unknown>;
const docs = new Map<string, Data>();
jest.mock('firebase-admin/firestore', () => ({ FieldValue: { increment: (n: number) => ({ __inc: n }) } }), { virtual: true });

const fakeDb = {
  doc: (path: string) => ({ path }),
  runTransaction: async (fn: (t: unknown) => Promise<void>) => {
    const writes: [string, Data, boolean][] = [];
    await fn({
      get: async (r: { path: string }) => ({ data: () => docs.get(r.path) }),
      update: (r: { path: string }, p: Data) => { writes.push([r.path, p, true]); },
      set: (r: { path: string }, p: Data, o?: { merge?: boolean }) => { writes.push([r.path, p, !!o?.merge]); },
    });
    for (const [path, p, merge] of writes) {
      const cur: Data = merge ? { ...(docs.get(path) || {}) } : {};
      for (const [k, v] of Object.entries(p)) cur[k] = v && typeof v === 'object' && '__inc' in v ? ((cur[k] as number) || 0) + (v as { __inc: number }).__inc : v;
      docs.set(path, cur);
    }
  },
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { chargeLeadCredit } = require('../../functions/leadCredit');
const t0 = Date.UTC(2026, 10, 21, 2, 0);
const charge = (visitor: string, now = t0, cap = 3) => chargeLeadCredit(fakeDb, 'v1', visitor, cap, now);
const credits = () => docs.get('vendors/v1')!.credits;

beforeEach(() => { docs.clear(); docs.set('vendors/v1', { credits: 20 }); });

test('charges a new visitor once per 24 hours', async () => {
  expect(await charge('a')).toEqual({ deducted: true });
  expect(await charge('a', t0 + 3_600_000)).toEqual({ deducted: false, reason: 'repeat_visitor' });
  expect(await charge('a', t0 + 86_400_001)).toEqual({ deducted: true });
  expect(credits()).toBe(18);
});

test('stops charging after the hourly cap, and starts again next hour', async () => {
  for (const v of ['a', 'b', 'c']) expect((await charge(v)).deducted).toBe(true);
  expect(await charge('d', t0 + 60_000)).toEqual({ deducted: false, reason: 'hourly_cap' });
  expect(await charge('e', t0 + 120_000)).toEqual({ deducted: false, reason: 'hourly_cap' });
  expect(credits()).toBe(17);
  expect(await charge('f', t0 + 3_600_001)).toEqual({ deducted: true });
  expect(credits()).toBe(16);
});

test('a script inventing visitor IDs can drain at most the cap per hour', async () => {
  for (let i = 0; i < 200; i++) await charge(`bot-${i}`, t0 + i * 1000, 10);
  expect(credits()).toBe(10);
});

test('no credits, no charge', async () => {
  docs.set('vendors/v1', { credits: 0 });
  expect(await charge('a')).toEqual({ deducted: false, reason: 'no_credits' });
});
