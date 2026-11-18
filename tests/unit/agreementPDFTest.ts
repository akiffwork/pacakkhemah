/**
 * Unit tests for src/lib/agreementPDF.ts
 * Tests PDF HTML generation and reference number formatting.
 */

import { generateAgreementPDF, buildAgreementMeta, buildAgreementHTML } from '@/lib/agreementPDF';
import { summaryFromOrder } from '@/lib/rentalSummary';
import type { Order } from '@/lib/orderFlow';

const vendor = { name: 'Pacak Gear', phone: '0123456789', city: 'Kuantan' };
const agreement = {
  customerName: 'Ali Bin Ahmad',
  customerPhone: '0111234567',
  refNo: 'PK-20240101-ABC123',
  signedDate: '01/01/2024',
  signedFull: '1 January 2024, 10:00 AM',
};
const booking = summaryFromOrder({
  id: 'o1', customerPhone: '601', pickupLocation: 'Balok', status: 'confirmed',
  bookingDates: { start: '2026-05-16', end: '2026-05-18' }, nights: 2,
  items: [
    { name: 'Tent', qty: 2, price: 25, lineTotal: 100 },
    { name: 'Cabin XL Package', qty: 1, price: 80, lineTotal: 140, variantLabel: 'Green', addSetup: true, setupFee: 30,
      linkedItems: [{ itemId: 'x', name: 'Air mattress', qty: 2 }] },
  ],
  freeItems: [{ name: 'Lantern', qty: 1 }],
  subtotal: 240, promoCode: 'PACKAGEISGOOD', promoDiscount: 24, setupFeeTotal: 30,
  totalAmount: 296, depositAmount: 50, rentalAmount: 246,
} as Order);

// ─── buildAgreementMeta ───────────────────────────────────────────────────────

describe('buildAgreementMeta', () => {
  test('produces a ref number in PK-YYYYMMDD-XXXXXX format', () => {
    const date = new Date('2024-03-15T10:00:00');
    const { refNo } = buildAgreementMeta(date, 'abcdef123456');
    expect(refNo).toMatch(/^PK-\d{8}-[A-Z0-9]{6}$/);
    expect(refNo).toContain('20240315');
  });

  test('uppercases the first 6 chars of uniqueId', () => {
    const date = new Date('2024-01-01');
    const { refNo } = buildAgreementMeta(date, 'xyzabc');
    expect(refNo).toContain('XYZABC');
  });

  test('truncates uniqueId to 6 chars', () => {
    const date = new Date('2024-01-01');
    const { refNo } = buildAgreementMeta(date, 'abcdefghij');
    const suffix = refNo.split('-')[2];
    expect(suffix).toHaveLength(6);
  });

  test('handles uniqueId shorter than 6 chars without crashing', () => {
    const date = new Date('2024-01-01');
    const { refNo } = buildAgreementMeta(date, 'ab');
    expect(refNo).toMatch(/^PK-\d{8}-/);
  });

  test('zero-pads single-digit month and day', () => {
    const date = new Date('2024-01-05T08:00:00');
    const { refNo } = buildAgreementMeta(date, 'aabbcc');
    expect(refNo).toContain('20240105');
  });

  test('signedDate is formatted as DD/MM/YYYY', () => {
    const date = new Date('2024-06-20');
    const { signedDate } = buildAgreementMeta(date, 'test01');
    expect(signedDate).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  test('signedFull is a non-empty descriptive date string', () => {
    const date = new Date('2024-06-20T14:30:00');
    const { signedFull } = buildAgreementMeta(date, 'test01');
    expect(signedFull.length).toBeGreaterThan(5);
    expect(typeof signedFull).toBe('string');
  });
});

// ─── buildAgreementHTML ───────────────────────────────────────────────────────

describe('buildAgreementHTML', () => {
  const html = (...args: Partial<Parameters<typeof buildAgreementHTML>>) =>
    buildAgreementHTML(args[0] ?? vendor, args[1] ?? agreement, args[2] === undefined ? booking : args[2], args[3], args[4]);

  test('is a full HTML document with vendor, customer, ref and total', () => {
    const h = html();
    expect(h).toContain('<!DOCTYPE html>');
    expect(h).toContain('PACAK GEAR');
    expect(h).toContain('Ali Bin Ahmad');
    expect(h).toContain('PK-20240101-ABC123');
    expect(h).toContain('RM 296');
  });

  test('items match the cart: line totals, nightly hint, variant, package, setup, free item', () => {
    const h = html();
    expect(h).toContain('RM 100');                       // stay total, not the nightly price
    expect(h).toContain('RM 25/night × 2 × 2N');
    expect(h).toContain('Green');
    expect(h).toContain('Includes: 2 × Air mattress');
    expect(h).toContain('Add-on: setup at campsite');
    expect(h).toContain('Lantern');
    expect(h).toContain('FREE ITEM');
    expect(h).not.toContain('RM 80/night');              // tiered line: no misleading hint
  });

  test('price rows match the order details', () => {
    const h = html();
    for (const t of ['Subtotal', 'RM 240', 'Promo code', 'PACKAGEISGOOD', '− RM 24', 'Setup fee', 'Rental', 'RM 246', 'Security deposit (refundable)', 'RM 50']) expect(h).toContain(t);
    expect(h).toContain('16 May 2026');
    expect(h).toContain('2 nights');
  });

  test('uses WhatsApp fallback text when there is no booking', () => {
    expect(html(vendor, agreement, null)).toContain('WhatsApp');
  });

  test('uses default rules unless custom rules are given', () => {
    expect(html()).toContain('Equipment must be returned');
    const h = html(vendor, agreement, booking, ['Custom rule only']);
    expect(h).toContain('Custom rule only');
    expect(h).not.toContain('Equipment must be returned');
  });

  test('shows the IC number in parties, declaration and signature block', () => {
    const h = html(vendor, { ...agreement, idType: 'ic', idNumber: '900101-14-5678' });
    expect(h.match(/IC No\./g)?.length).toBeGreaterThanOrEqual(3);
    expect(h).toContain('900101-14-5678');
    expect(h).not.toContain('identification documents');
  });

  test('labels a passport number as Passport No.', () => {
    const h = html(vendor, { ...agreement, idType: 'passport', idNumber: 'A12345678' });
    expect(h).toContain('Passport No. A12345678');
    expect(h).not.toContain('IC No.');
  });

  test('has no ID line or photo page when neither was given', () => {
    const h = html();
    expect(h).not.toContain('IC No.');
    expect(h).not.toContain('IDENTITY DOCUMENTS');
  });

  test('older agreements keep their IC photo page', () => {
    const h = html(vendor, agreement, booking, undefined, {
      frontUrl: 'https://example.com/front.jpg', backUrl: 'https://example.com/back.jpg',
    });
    expect(h).toContain('IDENTITY DOCUMENTS');
    expect(h).toContain('identification documents provided are genuine');
  });

  test('needs both photos, and only https URLs', () => {
    expect(html(vendor, agreement, booking, undefined, { frontUrl: 'https://example.com/f.jpg' })).not.toContain('IDENTITY DOCUMENTS');
    expect(html(vendor, agreement, booking, undefined, { frontUrl: 'javascript:alert(1)', backUrl: 'https://x/b.jpg' })).not.toContain('IDENTITY DOCUMENTS');
  });

  test('escapes customer-typed text so it cannot inject markup', () => {
    const h = html(vendor,
      { ...agreement, customerName: '<img src=x onerror=alert(1)>', idNumber: '"><script>x</script>' },
      { ...booking, lines: [{ ...booking.lines[0], name: '<b>Tent</b>' }] });
    expect(h).not.toContain('<img src=x');
    expect(h).not.toContain('<script>x');
    expect(h).not.toContain('<b>Tent</b>');
    expect(h).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});

// ─── generateAgreementPDF ─────────────────────────────────────────────────────

describe('generateAgreementPDF', () => {
  test('opens the agreement as a blob URL in a new tab', () => {
    const createObjectURL = jest.fn().mockReturnValue('blob:agreement');
    Object.assign(URL, { createObjectURL, revokeObjectURL: jest.fn() });
    global.open = jest.fn();
    generateAgreementPDF(vendor, agreement, booking);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(global.open).toHaveBeenCalledWith('blob:agreement', '_blank');
  });
});
