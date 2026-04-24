/**
 * Unit tests for src/lib/agreementPDF.ts
 * Tests PDF HTML generation and reference number formatting.
 */

import { generateAgreementPDF, buildAgreementMeta } from '@/lib/agreementPDF';

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeWindowOpenMock() {
  const docMock = { write: jest.fn(), close: jest.fn() };
  const windowMock = { document: docMock };
  global.open = jest.fn().mockReturnValue(windowMock);
  return docMock;
}

const vendor = { name: 'Pacak Gear', phone: '0123456789', city: 'Kuantan' };
const agreement = {
  customerName: 'Ali Bin Ahmad',
  customerPhone: '0111234567',
  refNo: 'PK-20240101-ABC123',
  signedDate: '01/01/2024',
  signedFull: '1 January 2024, 10:00 AM',
};
const booking = {
  items: [{ name: 'Tent', qty: 2, price: 50 }],
  dates: { start: '01/01/2024', end: '03/01/2024' },
  total: 100,
};

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

// ─── generateAgreementPDF ─────────────────────────────────────────────────────

describe('generateAgreementPDF', () => {
  test('opens a new blank window', () => {
    makeWindowOpenMock();
    generateAgreementPDF(vendor, agreement, booking);
    expect(global.open).toHaveBeenCalledWith('', '_blank');
  });

  test('writes HTML to the new window', () => {
    const docMock = makeWindowOpenMock();
    generateAgreementPDF(vendor, agreement, booking);
    expect(docMock.write).toHaveBeenCalledTimes(1);
    const html: string = docMock.write.mock.calls[0][0];
    expect(html).toContain('<!DOCTYPE html>');
  });

  test('closes the document after writing', () => {
    const docMock = makeWindowOpenMock();
    generateAgreementPDF(vendor, agreement, booking);
    expect(docMock.close).toHaveBeenCalledTimes(1);
  });

  test('HTML includes the vendor name', () => {
    const docMock = makeWindowOpenMock();
    generateAgreementPDF(vendor, agreement, booking);
    expect(docMock.write.mock.calls[0][0]).toContain('PACAK GEAR');
  });

  test('HTML includes the customer name', () => {
    const docMock = makeWindowOpenMock();
    generateAgreementPDF(vendor, agreement, booking);
    expect(docMock.write.mock.calls[0][0]).toContain('Ali Bin Ahmad');
  });

  test('HTML includes the reference number', () => {
    const docMock = makeWindowOpenMock();
    generateAgreementPDF(vendor, agreement, booking);
    expect(docMock.write.mock.calls[0][0]).toContain('PK-20240101-ABC123');
  });

  test('HTML shows the booking total', () => {
    const docMock = makeWindowOpenMock();
    generateAgreementPDF(vendor, agreement, booking);
    expect(docMock.write.mock.calls[0][0]).toContain('RM100');
  });

  test('uses WhatsApp fallback text when booking has no items', () => {
    const docMock = makeWindowOpenMock();
    generateAgreementPDF(vendor, agreement, null);
    expect(docMock.write.mock.calls[0][0]).toContain('WhatsApp');
  });

  test('uses default rules when no custom rules are provided', () => {
    const docMock = makeWindowOpenMock();
    generateAgreementPDF(vendor, agreement, booking);
    expect(docMock.write.mock.calls[0][0]).toContain('Equipment must be returned');
  });

  test('uses custom rules when provided', () => {
    const docMock = makeWindowOpenMock();
    generateAgreementPDF(vendor, agreement, booking, ['Custom rule only']);
    const html: string = docMock.write.mock.calls[0][0];
    expect(html).toContain('Custom rule only');
    expect(html).not.toContain('Equipment must be returned');
  });

  test('does not include IC page when images are not provided', () => {
    const docMock = makeWindowOpenMock();
    generateAgreementPDF(vendor, agreement, booking);
    expect(docMock.write.mock.calls[0][0]).not.toContain('IDENTITY VERIFICATION');
  });

  test('includes IC page when both front and back image URLs are provided', () => {
    const docMock = makeWindowOpenMock();
    generateAgreementPDF(vendor, agreement, booking, undefined, {
      frontUrl: 'https://example.com/front.jpg',
      backUrl: 'https://example.com/back.jpg',
    });
    expect(docMock.write.mock.calls[0][0]).toContain('IDENTITY VERIFICATION');
  });

  test('does not include IC page when only frontUrl is provided', () => {
    const docMock = makeWindowOpenMock();
    generateAgreementPDF(vendor, agreement, booking, undefined, {
      frontUrl: 'https://example.com/front.jpg',
    });
    expect(docMock.write.mock.calls[0][0]).not.toContain('IDENTITY VERIFICATION');
  });

  test('does nothing when window.open returns null', () => {
    global.open = jest.fn().mockReturnValue(null);
    expect(() => generateAgreementPDF(vendor, agreement, booking)).not.toThrow();
  });
});
