/**
 * @jest-environment node
 *
 * Server-side credit top-ups (functions/topup.ts) against a fake Firestore and
 * a fake ToyyibPay. Checks that credits are only added when ToyyibPay itself
 * says the bill is paid, only once, and only for the vendor's own shop.
 */

type Data = Record<string, unknown>;
const store = new Map<string, Data>();
let autoId = 0;

const INC = (n: number) => ({ __inc: n });
function apply(base: Data, fields: Data): Data {
  const out = { ...base };
  for (const [k, v] of Object.entries(fields)) {
    const inc = (v as { __inc?: number })?.__inc;
    out[k] = typeof inc === 'number' ? ((out[k] as number) || 0) + inc : v;
  }
  return out;
}
function ref(path: string) {
  return {
    path, id: path.split('/').pop()!,
    get: async () => ({ exists: store.has(path), data: () => store.get(path), ref: ref(path) }),
    set: async (d: Data) => { store.set(path, apply({}, d)); },
    update: async (d: Data) => { store.set(path, apply(store.get(path) || {}, d)); },
  };
}
const fakeDb = {
  doc: (p: string) => ref(p),
  collection: (name: string) => ({
    doc: (id?: string) => ref(`${name}/${id || `auto${++autoId}`}`),
    where: (field: string, _op: string, val: unknown) => ({
      limit: () => ({
        get: async () => {
          const docs = [...store.entries()]
            .filter(([p, d]) => p.startsWith(`${name}/`) && p.split('/').length === 2 && d[field] === val)
            .map(([p, d]) => ({ ref: ref(p), data: () => d }));
          return { empty: docs.length === 0, docs };
        },
      }),
    }),
  }),
  runTransaction: async <T,>(fn: (t: unknown) => Promise<T>) => fn({
    get: (r: ReturnType<typeof ref>) => r.get(),
    update: (r: ReturnType<typeof ref>, d: Data) => { store.set(r.path, apply(store.get(r.path) || {}, d)); },
    set: (r: ReturnType<typeof ref>, d: Data) => { store.set(r.path, apply({}, d)); },
  }),
};

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: () => fakeDb,
  FieldValue: { increment: (n: number) => INC(n), serverTimestamp: () => 'TS' },
}), { virtual: true });
jest.mock('firebase-functions/params', () => ({ defineSecret: () => ({ value: () => 'SECRET-KEY' }) }), { virtual: true });
jest.mock('firebase-functions/v2/https', () => {
  class HttpsError extends Error { code: string; constructor(code: string, msg: string) { super(msg); this.code = code; } }
  return { onCall: (_o: unknown, fn: unknown) => fn, onRequest: (_o: unknown, fn: unknown) => fn, HttpsError };
}, { virtual: true });

// eslint-disable-next-line @typescript-eslint/no-require-imports
const topup = require('../../functions/topup');
type Call = (req: { auth?: { uid: string; token: { email?: string } }; data: unknown }) => Promise<unknown>;
const createTopUpBill = topup.createTopUpBill as Call;
const confirmTopUp = topup.confirmTopUp as Call;
const settleTopUp = topup.settleTopUp as (billCode: string) => Promise<{ status: string; credits: number } | null>;

let billTxs: Data[] = [];
const fetchMock = jest.fn(async (url: string, init?: { body?: URLSearchParams }) => {
  if (url.endsWith('/createBill')) return { json: async () => [{ BillCode: 'abc123' }] };
  if (url.endsWith('/getBillTransactions')) return { json: async () => billTxs };
  throw new Error(`unexpected ${url} ${init}`);
});

const owner = { uid: 'u1', token: { email: 'owner@x.com' } };
const stranger = { uid: 'u2', token: { email: 'other@x.com' } };
const credits = () => store.get('vendors/v1')!.credits;

beforeEach(() => {
  store.clear(); billTxs = []; fetchMock.mockClear();
  (global as unknown as { fetch: unknown }).fetch = fetchMock;
  store.set('settings/payment_config', { categoryCode: 'cat1', packages: [{ credits: 50, price: 45 }] });
  store.set('vendors/v1', { owner_uid: 'u1', name: 'Kuantan Camp Gear', phone: '6012-345', credits: 3 });
});

async function createBill() {
  const res = await createTopUpBill({ auth: owner, data: { vendorId: 'v1', credits: 50, origin: 'https://pacakkhemah.com' } });
  const topId = [...store.keys()].find(k => k.startsWith('topups/'))!.split('/')[1];
  return { res, topId };
}

describe('createTopUpBill', () => {
  it('creates the bill with the server price and secret, and records a pending top-up', async () => {
    const { res, topId } = await createBill();
    expect(res).toEqual({ url: 'https://toyyibpay.com/abc123' });
    const body = fetchMock.mock.calls[0][1]!.body as URLSearchParams;
    expect(body.get('userSecretKey')).toBe('SECRET-KEY');
    expect(body.get('billAmount')).toBe('4500');
    expect(body.get('billExternalReferenceNo')).toBe(topId);
    expect(body.get('billReturnUrl')).toBe('https://pacakkhemah.com/store?tab=settings&group=account&section=credits');
    expect(body.get('billReturnUrl')).not.toContain('add_credits');
    expect(store.get(`topups/${topId}`)).toMatchObject({ vendorId: 'v1', credits: 50, price: 45, status: 'pending', billCode: 'abc123' });
    expect(credits()).toBe(3);
  });

  it('refuses someone else’s shop, unknown packages and logged-out callers', async () => {
    await expect(createTopUpBill({ auth: stranger, data: { vendorId: 'v1', credits: 50 } })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(createTopUpBill({ auth: owner, data: { vendorId: 'v1', credits: 1000 } })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(createTopUpBill({ data: { vendorId: 'v1', credits: 50 } })).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never sends the vendor back to a foreign site', async () => {
    await createTopUpBill({ auth: owner, data: { vendorId: 'v1', credits: 50, origin: 'https://evil.example' } });
    const body = fetchMock.mock.calls[0][1]!.body as URLSearchParams;
    expect(body.get('billReturnUrl')!.startsWith('https://pacakkhemah.com/')).toBe(true);
  });
});

describe('settling a payment', () => {
  it('adds credits once when ToyyibPay confirms the full amount', async () => {
    const { topId } = await createBill();
    billTxs = [{ billpaymentStatus: '1', billpaymentAmount: '45.00', billExternalReferenceNo: topId, billpaymentInvoiceNo: 'INV1' }];
    expect(await settleTopUp('abc123')).toEqual({ status: 'paid', credits: 50 });
    expect(await settleTopUp('abc123')).toEqual({ status: 'paid', credits: 50 }); // callback + return both arrive
    expect(await confirmTopUp({ auth: owner, data: { billCode: 'abc123' } })).toEqual({ status: 'paid', credits: 50 });
    expect(credits()).toBe(53);
    const txs = [...store.entries()].filter(([k]) => k.startsWith('transactions/'));
    expect(txs).toHaveLength(1);
    expect(txs[0][1]).toMatchObject({ vendorId: 'v1', amount: 45, credits: 50, type: 'purchase' });
  });

  it('adds nothing while unpaid, when underpaid, or when the bill belongs to another top-up', async () => {
    const { topId } = await createBill();
    billTxs = [{ billpaymentStatus: '2', billpaymentAmount: '45.00', billExternalReferenceNo: topId }];
    expect((await settleTopUp('abc123'))!.status).toBe('pending');
    billTxs = [{ billpaymentStatus: '1', billpaymentAmount: '1.00', billExternalReferenceNo: topId }];
    expect((await settleTopUp('abc123'))!.status).toBe('pending');
    billTxs = [{ billpaymentStatus: '1', billpaymentAmount: '45.00', billExternalReferenceNo: 'someone-else' }];
    expect((await settleTopUp('abc123'))!.status).toBe('pending');
    billTxs = [{ billpaymentStatus: '3', billpaymentAmount: '45.00', billExternalReferenceNo: topId }];
    expect((await settleTopUp('abc123'))!.status).toBe('failed');
    expect(credits()).toBe(3);
  });

  it('ignores unknown bills and stops strangers from confirming', async () => {
    expect(await settleTopUp('nope99')).toBeNull();
    await createBill();
    await expect(confirmTopUp({ auth: stranger, data: { billCode: 'abc123' } })).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('the callback trusts ToyyibPay, not the status in the request', async () => {
    await createBill();
    billTxs = []; // ToyyibPay has no payment on record
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
    await (topup.toyyibpayCallback as (req: unknown, res: unknown) => Promise<void>)(
      { body: { billcode: 'abc123', status_id: '1', status: '1', amount: '45.00' }, query: {} }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(credits()).toBe(3);
  });
});
