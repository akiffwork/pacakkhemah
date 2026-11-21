/**
 * @jest-environment node
 */
jest.mock('firebase-admin/firestore', () => ({ getFirestore: jest.fn(), FieldValue: { delete: () => '__delete__' } }), { virtual: true });
jest.mock('firebase-functions/v2/https', () => ({ onCall: (_o: unknown, fn: unknown) => fn, HttpsError: class extends Error {} }), { virtual: true });
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { scrubUsage, runPrivacyCleanup } = require('../../functions/privacyCleanup');

test('usage lists keep only orderId and date', () => {
  expect(scrubUsage([{ phone: '601', name: 'Ali', orderId: 'o1', date: 'd1' }, { orderId: 'o2', date: 'd2' }]))
    .toEqual({ list: [{ orderId: 'o1', date: 'd1' }, { orderId: 'o2', date: 'd2' }], changed: true });
  expect(scrubUsage([{ orderId: 'o2', date: 'd2' }]).changed).toBe(false);
  expect(scrubUsage(undefined)).toEqual({ list: [], changed: false });
});

test('moves email and tax details to the private record, without overwriting newer ones', async () => {
  type Data = Record<string, unknown>;
  const docs = new Map<string, Data>([
    ['vendors/v1', { name: 'A', email: 'a@x.com', taxProfile: { tin: 'T1' } }],
    ['vendors/v2', { name: 'B', email: 'b@x.com' }],
    ['vendors/v2/privateInfo/details', { email: 'new@x.com' }],
    ['vendors/v3', { name: 'C' }],
    ['vendors/v1/discounts/d1', { usedBy: [{ phone: '601', name: 'Ali', orderId: 'o1', date: 'd' }] }],
  ]);
  const ref = (path: string) => ({
    path,
    get: async () => ({ data: () => docs.get(path) }),
    update: async (p: Data) => { const cur = { ...docs.get(path) }; for (const [k, v] of Object.entries(p)) { if (v === '__delete__') delete cur[k]; else cur[k] = v; } docs.set(path, cur); },
  });
  const db = {
    doc: ref,
    collection: (col: string) => ({
      get: async () => {
        const depth = col.split('/').length;
        const ds = [...docs.keys()].filter(k => k.startsWith(col + '/') && k.split('/').length === depth + 1)
          .map(k => ({ id: k.split('/').pop(), ref: ref(k), data: () => docs.get(k) }));
        return { docs: ds, size: ds.length };
      },
    }),
    batch: () => {
      const ops: (() => Promise<void>)[] = [];
      return {
        set: (r: { path: string }, p: Data) => ops.push(async () => { docs.set(r.path, { ...(docs.get(r.path) || {}), ...p }); }),
        update: (r: { update: (p: Data) => Promise<void> }, p: Data) => ops.push(() => r.update(p)),
        commit: async () => { for (const o of ops) await o(); },
      };
    },
  };
  expect(await runPrivacyCleanup(db)).toEqual({ vendors: 3, moved: 2, scrubbed: 1 });
  expect(docs.get('vendors/v1')).toEqual({ name: 'A' });
  expect(docs.get('vendors/v1/privateInfo/details')).toEqual({ email: 'a@x.com', taxProfile: { tin: 'T1' } });
  expect(docs.get('vendors/v2/privateInfo/details')).toEqual({ email: 'new@x.com' });
  expect(docs.get('vendors/v2')).toEqual({ name: 'B' });
  expect(docs.get('vendors/v1/discounts/d1')).toEqual({ usedBy: [{ orderId: 'o1', date: 'd' }] });
});
