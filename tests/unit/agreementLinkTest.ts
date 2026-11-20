/**
 * @jest-environment node
 *
 * Linking a signed agreement to its order (functions/agreementLink.ts).
 * Anyone with the link can sign, so only a real, open order of the same
 * vendor without an agreement is updated.
 */
type Data = Record<string, unknown>;
const docs = new Map<string, Data>();
const fakeDb = {
  doc: (path: string) => ({
    get: async () => ({ exists: docs.has(path), data: () => docs.get(path) }),
    update: async (patch: Data) => { if (!docs.has(path)) throw new Error('not found'); docs.set(path, { ...docs.get(path), ...patch }); },
  }),
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { linkAgreementToOrder } = require('../../functions/agreementLink');
const link = (id: string, data: Data) => linkAgreementToOrder(fakeDb, id, data);
const sign = { vendorId: 'v1', orderId: 'o1', customerName: 'ALI', customerPhone: '60111' };

beforeEach(() => {
  docs.clear();
  docs.set('orders/o1', { vendorId: 'v1', status: 'confirmed', customerName: 'Ali', customerPhone: '601' });
  docs.set('agreements/a1', { ...sign });
  docs.set('agreements/a2', { ...sign });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

test('links a confirmed order of the same vendor', async () => {
  expect(await link('a1', sign)).toEqual({ linked: true });
  expect(docs.get('orders/o1')).toMatchObject({ status: 'confirmed', agreementSigned: true, agreementId: 'a1', customerName: 'ALI' });
});

test('a new order becomes confirmed when signed (as before)', async () => {
  docs.set('orders/o1', { vendorId: 'v1', status: 'pending' });
  await link('a1', sign);
  expect(docs.get('orders/o1')).toMatchObject({ status: 'confirmed', agreementSigned: true });
});

test('never touches another vendor\'s order', async () => {
  docs.set('orders/o1', { vendorId: 'v2', status: 'confirmed' });
  expect(await link('a1', sign)).toEqual({ linked: false, reason: 'other_vendor' });
  expect(docs.get('orders/o1')).not.toHaveProperty('agreementSigned');
  expect(docs.get('agreements/a1')).toMatchObject({ orderId: null, requestedOrderId: 'o1', linkSkipped: 'other_vendor' });
});

test('does not reopen a cancelled or completed order', async () => {
  for (const status of ['cancelled', 'completed']) {
    docs.set('orders/o1', { vendorId: 'v1', status });
    expect(await link('a1', sign)).toEqual({ linked: false, reason: 'order_closed' });
    expect(docs.get('orders/o1')).toMatchObject({ status });
  }
});

test('a second signature keeps the first one linked', async () => {
  await link('a1', sign);
  expect(await link('a2', sign)).toEqual({ linked: false, reason: 'already_signed' });
  expect(docs.get('orders/o1')).toMatchObject({ agreementId: 'a1' });
  expect(docs.get('agreements/a2')).toMatchObject({ orderId: null, linkSkipped: 'already_signed' });
});

test('missing or deleted order, and walk-in agreements', async () => {
  expect(await link('a1', { ...sign, orderId: 'nope' })).toEqual({ linked: false, reason: 'order_not_found' });
  docs.set('orders/o1', { vendorId: 'v1', status: 'confirmed', deleted: true });
  expect(await link('a2', sign)).toEqual({ linked: false, reason: 'order_not_found' });
  expect(await link('a2', { ...sign, orderId: null })).toEqual({ linked: false, reason: 'no_order' });
});
