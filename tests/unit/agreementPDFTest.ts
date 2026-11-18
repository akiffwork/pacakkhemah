/**
 * Unit tests for src/lib/agreementPDF.ts
 * Tests PDF HTML generation and reference number formatting.
 */

import { generateAgreementPDF, buildAgreementMeta, buildAgreementHTML } from '@/lib/agreementPDF';
import { summaryFromOrder } from '@/lib/rentalSummary';
import { generalTerms, type AgreementDoc } from '@/lib/agreementDocument';
import type { Order } from '@/lib/orderFlow';

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

const doc = (over: Partial<AgreementDoc> = {}): AgreementDoc => ({
  vendor: { name: 'Pacak Gear', slug: 'pacak-gear', phone: '0123456789', city: 'Kuantan', image: 'https://cdn.example/logo.png', ig: 'pacakgear', tiktok: 'https://www.tiktok.com/@pacakgear' },
  customer: { name: 'ALI BIN AHMAD', phone: '60111234567', idType: 'ic', idNumber: '900101-14-5678' },
  rental: booking,
  vendorTerms: ['Return gear clean.'],
  generalTerms: generalTerms(),
  refNo: 'PK-20240101-ABC123',
  vendorSignedAt: new Date('2026-05-08T02:00:00Z'),
  customerSignedAt: new Date('2026-05-08T14:38:00Z'),
  customerSignature: 'ALI BIN AHMAD',
  verificationCode: 'AB12-CD34-EF56-7890',
  ...over,
});

describe('buildAgreementHTML', () => {
  test('header: logo, vendor name and shop address; footer: social links', () => {
    const h = buildAgreementHTML(doc());
    expect(h).toContain('src="https://cdn.example/logo.png"');
    expect(h).toContain('Pacak Gear');
    expect(h).toContain('pacakkhemah.com/shop/pacak-gear');
    expect(h).toContain('@pacakgear');
    expect(h).toContain('+60123456789');
    expect(h).toMatch(/class="hdr"[\s\S]*class="ftr"/);
    expect(h).toContain('@page { size: A4; margin: 0; }');
  });

  test('same six sections as the page, with vendor rules and validity terms', () => {
    const h = buildAgreementHTML(doc());
    for (const t of ['Contracting Parties', 'Subject of Rental', 'Rental Terms', 'General Terms and Validity', 'Declaration', 'Digital Signatures']) expect(h).toContain(t);
    expect(h).toContain('Return gear clean.');
    expect(h).toContain('Electronic Commerce Act 2006');
  });

  test('both parties digitally signed with date and time', () => {
    const h = buildAgreementHTML(doc());
    expect(h.match(/Digitally signed/g)?.length).toBe(2);
    expect(h).toContain('8 May 2026');
    expect(h).toContain('10:38 pm (GMT+8)');
    expect(h).toContain('AB12-CD34-EF56-7890');
    expect(h).not.toContain('Awaiting signature');
    expect(h).not.toMatch(/Signature:<\/p><div style="border-bottom/); // no wet-ink lines
  });

  test('unsigned customer shows awaiting', () => {
    expect(buildAgreementHTML(doc({ customerSignedAt: undefined }))).toContain('Awaiting signature');
  });

  test('items match the cart: line totals, nightly hint, variant, package, setup, free item', () => {
    const h = buildAgreementHTML(doc());
    expect(h).toContain('RM 100');
    expect(h).toContain('RM 25/night × 2 × 2N');
    expect(h).toContain('Includes: 2 × Air mattress');
    expect(h).toContain('Add-on: setup at campsite');
    expect(h).toContain('FREE ITEM');
    for (const t of ['Promo code', 'PACKAGEISGOOD', '− RM 24', 'Security deposit (refundable)', 'RM 296']) expect(h).toContain(t);
  });

  test('shows the IC number', () => {
    expect(buildAgreementHTML(doc())).toContain('IC No. 900101-14-5678');
    expect(buildAgreementHTML(doc({ customer: { name: 'X', idType: 'passport', idNumber: 'A12345678' } }))).toContain('Passport No. A12345678');
  });

  test('older agreements keep an IC photo appendix; https only', () => {
    expect(buildAgreementHTML(doc({ photos: { frontUrl: 'https://x/f.jpg', backUrl: 'https://x/b.jpg' } }))).toContain('Appendix: Identity Documents');
    expect(buildAgreementHTML(doc({ photos: { frontUrl: 'javascript:alert(1)', backUrl: 'https://x/b.jpg' } }))).not.toContain('Appendix');
    expect(buildAgreementHTML(doc({ vendor: { name: 'V', image: 'javascript:alert(1)' } }))).not.toContain('javascript:');
  });

  test('escapes typed text so it cannot inject markup', () => {
    const h = buildAgreementHTML(doc({
      customer: { name: '<img src=x onerror=alert(1)>', idNumber: '"><script>x</script>' },
      customerSignature: '<b>sig</b>',
      rental: { ...booking, lines: [{ ...booking.lines[0], name: '<b>Tent</b>', variantColor: 'red;background:url(x)' }] },
    }));
    expect(h).not.toContain('<img src=x');
    expect(h).not.toContain('<script>x');
    expect(h).not.toContain('<b>Tent</b>');
    expect(h).not.toContain('<b>sig</b>');
    expect(h).not.toContain('url(x)');
  });
});

// ─── generateAgreementPDF ─────────────────────────────────────────────────────

describe('generateAgreementPDF', () => {
  test('opens the agreement as a blob URL in a new tab', () => {
    const createObjectURL = jest.fn().mockReturnValue('blob:agreement');
    Object.assign(URL, { createObjectURL, revokeObjectURL: jest.fn() });
    global.open = jest.fn();
    generateAgreementPDF(doc());
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(global.open).toHaveBeenCalledWith('blob:agreement', '_blank');
  });
});
