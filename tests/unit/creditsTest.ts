/**
 * QR credit top-ups (src/lib/credits.ts): references, the WhatsApp message,
 * package checks and the admin approval, which must add credits only once.
 */

const store = new Map<string, Record<string, unknown>>();
const writes: { op: string; path: string; data: Record<string, unknown> }[] = [];

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, ...p: string[]) => ({ path: p.join('/') })),
  doc: jest.fn((a: { path?: string }, ...p: string[]) => ({ path: p.length ? p.join('/') : `${a.path}/auto1` })),
  increment: jest.fn((n: number) => ({ __inc: n })),
  serverTimestamp: jest.fn(() => 'TS'),
  addDoc: jest.fn(), getDoc: jest.fn(), updateDoc: jest.fn(),
  runTransaction: jest.fn(async (_db, fn: (t: unknown) => unknown) => fn({
    get: async (r: { path: string }) => ({ exists: () => store.has(r.path), data: () => store.get(r.path) }),
    update: (r: { path: string }, data: Record<string, unknown>) => { writes.push({ op: 'update', path: r.path, data }); },
    set: (r: { path: string }, data: Record<string, unknown>) => { writes.push({ op: 'set', path: r.path, data }); },
  })),
}));
jest.mock('firebase/storage', () => ({ ref: jest.fn(), uploadBytes: jest.fn(), getDownloadURL: jest.fn() }));

import { approveTopUp, makeReference, matchesPackage, paymentDetails, topUpWhatsAppLink, DEFAULT_PACKAGES } from '@/lib/credits';

beforeEach(() => { store.clear(); writes.length = 0; });

test('references are short, readable and avoid look-alike characters', () => {
  for (let i = 0; i < 200; i++) expect(makeReference()).toMatch(/^PK-[A-HJ-NP-Z2-9]{6}$/);
  expect(makeReference(() => 0)).toBe('PK-AAAAAA');
});

test('WhatsApp message carries shop, package, reference and receipt link', () => {
  const url = topUpWhatsAppLink('601136904336', { vendorName: 'Kuantan Camp Gear', credits: 50, price: 45, reference: 'PK-7KQ2MD', receiptUrl: 'https://r/x.jpg' });
  expect(url.startsWith('https://wa.me/601136904336?text=')).toBe(true);
  const text = decodeURIComponent(url.split('?text=')[1]);
  expect(text).toContain('Shop: Kuantan Camp Gear');
  expect(text).toContain('Package: 50 credits (RM 45)');
  expect(text).toContain('Reference: PK-7KQ2MD');
  expect(text).toContain('Receipt: https://r/x.jpg');
  expect(text).not.toMatch(/salam/i);
});

test('payment details fall back to the bundled QR and admin number', () => {
  expect(paymentDetails(null)).toMatchObject({ qrImageUrl: '/payment/maybank-qr.png', accountName: 'Atakasen Enterprise', adminWhatsApp: '601136904336' });
  expect(paymentDetails({ adminWhatsApp: '+60 12-345 6789', packages: [{ credits: 5, price: 6 }] })).toMatchObject({ adminWhatsApp: '60123456789', packages: [{ credits: 5, price: 6 }] });
});

test('flags requests whose price does not match a package', () => {
  expect(matchesPackage({ credits: 50, price: 45 }, DEFAULT_PACKAGES)).toBe(true);
  expect(matchesPackage({ credits: 100, price: 1 }, DEFAULT_PACKAGES)).toBe(false);
});

test('approving adds credits and logs the purchase once', async () => {
  store.set('topups/t1', { vendorId: 'v1', vendorName: 'Kuantan Camp Gear', credits: 50, price: 45, reference: 'PK-7KQ2MD', status: 'pending' });
  expect(await approveTopUp('t1')).toBe('approved');
  expect(writes).toEqual([
    { op: 'update', path: 'topups/t1', data: { status: 'approved', decidedAt: 'TS' } },
    { op: 'update', path: 'vendors/v1', data: { credits: { __inc: 50 } } },
    { op: 'set', path: 'transactions/auto1', data: expect.objectContaining({ vendorId: 'v1', amount: 45, credits: 50, type: 'purchase', topupId: 't1' }) },
  ]);

  writes.length = 0;
  store.set('topups/t1', { ...store.get('topups/t1'), status: 'approved' });
  expect(await approveTopUp('t1')).toBe('already');
  expect(writes).toEqual([]);
});

test('a rejected request cannot be approved later by a stale screen', async () => {
  store.set('topups/t2', { vendorId: 'v1', credits: 10, price: 10, status: 'rejected' });
  expect(await approveTopUp('t2')).toBe('already');
  expect(writes).toEqual([]);
});
