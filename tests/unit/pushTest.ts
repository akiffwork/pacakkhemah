/**
 * @jest-environment node
 *
 * Vendor alerts (functions/push.ts): tags that keep one alert per booking or
 * review, and clearing tokens that FCM says are dead.
 */

type Data = Record<string, unknown>;
const vendors = new Map<string, Data>();
const sent: Data[] = [];
let sendError: { code: string } | null = null;
const DELETE = Symbol('delete');

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    doc: (path: string) => {
      const id = path.split('/')[1];
      return {
        get: async () => ({ data: () => vendors.get(id) }),
        update: async (fields: Data) => {
          const next = { ...vendors.get(id) };
          for (const [k, v] of Object.entries(fields)) { if (v === DELETE) delete next[k]; else next[k] = v; }
          vendors.set(id, next);
        },
      };
    },
  }),
  FieldValue: { delete: () => DELETE },
}), { virtual: true });
jest.mock('firebase-admin/messaging', () => ({
  getMessaging: () => ({
    send: async (msg: Data) => { if (sendError) throw sendError; sent.push(msg); return 'id'; },
  }),
}), { virtual: true });

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { notifyVendor, pushTag } = require('../../functions/push');

const order = { type: 'new_order', title: 'Pesanan Baru', body: 'Khemah x1', url: '/store?tab=orders', refId: 'lead1' };

beforeEach(() => { vendors.clear(); sent.length = 0; sendError = null; });

describe('pushTag', () => {
  it('gives each booking and each review its own tag', () => {
    expect(pushTag('new_order', 'a1')).toBe('new_order-a1');
    expect(pushTag('agreement_signed', 'o1')).toBe('agreement_signed-o1');
    expect(pushTag('new_review', 'r1')).toBe('review-r1');
  });
  it('falls back to the type when there is no doc id', () => {
    expect(pushTag('stock_conflict')).toBe('stock_conflict');
  });
});

describe('notifyVendor', () => {
  it('sends a data-only message with the tag and url', async () => {
    vendors.set('v1', { fcmToken: 'tok' });
    expect(await notifyVendor('v1', order)).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]).not.toHaveProperty('notification');
    expect(sent[0].token).toBe('tok');
    expect(sent[0].data).toMatchObject({ title: 'Pesanan Baru', url: '/store?tab=orders', tag: 'new_order-lead1', vendorId: 'v1' });
  });

  it('does nothing when the vendor has not turned alerts on', async () => {
    vendors.set('v1', {});
    expect(await notifyVendor('v1', order)).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it('removes a dead token so Settings shows alerts as off', async () => {
    vendors.set('v1', { fcmToken: 'old' });
    sendError = { code: 'messaging/registration-token-not-registered' };
    expect(await notifyVendor('v1', order)).toBe(false);
    expect(vendors.get('v1')).not.toHaveProperty('fcmToken');
  });

  it('keeps the token and rethrows on other errors', async () => {
    vendors.set('v1', { fcmToken: 'tok' });
    sendError = { code: 'messaging/internal-error' };
    await expect(notifyVendor('v1', order)).rejects.toEqual(sendError);
    expect(vendors.get('v1')?.fcmToken).toBe('tok');
  });
});
