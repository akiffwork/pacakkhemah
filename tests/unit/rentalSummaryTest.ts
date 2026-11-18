import { summaryFromOrder, summaryFromLegacy, nightsBetween, durationLabel, formatLongDate } from '@/lib/rentalSummary';
import type { Order } from '@/lib/orderFlow';

const order = {
  id: 'o1', customerPhone: '601', pickupLocation: 'Balok', status: 'confirmed',
  bookingDates: { start: '2026-05-16', end: '2026-05-17' },
  items: [{ name: 'Vidalido Cabin XL Package', qty: 1, price: 160, lineTotal: 160 }],
  subtotal: 160, promoCode: 'PACKAGEISGOOD', promoDiscount: 16,
  totalAmount: 194, depositAmount: 50, rentalAmount: 144,
} as Order;

describe('rentalSummary', () => {
  test('from an order: same rows as the order details', () => {
    const s = summaryFromOrder(order);
    expect(s.nights).toBe(1);
    expect(s.lines[0]).toMatchObject({ qty: 1, amount: 160, calc: 'RM 160/night × 1 × 1N' });
    expect(s.rows.map(r => r.label)).toEqual(['Subtotal', 'Promo code', 'Rental', 'Security deposit (refundable)', 'Total']);
    expect(s.rows.at(-1)!.amount).toBe(194);
    expect(s.note).toBeUndefined();
  });

  test('older orders without a cart snapshot get a note', () => {
    const { subtotal: _s, ...old } = order;
    expect(summaryFromOrder(old as Order).note).toMatch(/before full cart details/);
  });

  test('old links: nightly price shown as a hint, no made-up line total', () => {
    const s = summaryFromLegacy({ items: [{ name: 'Tent', qty: 2, price: 30 }], dates: { start: '2026-05-16', end: '2026-05-18' }, discounts: [{ label: 'Promo', amount: 10 }], depositAmount: 50, total: 160 });
    expect(s.lines[0]).toMatchObject({ amount: null, calc: 'RM 30/night × 2' });
    expect(s.rows.map(r => [r.label, r.amount])).toEqual([['Promo', -10], ['Rental', 110], ['Security deposit (refundable)', 50], ['Total', 160]]);
  });

  test('date helpers', () => {
    expect(nightsBetween({ start: '2026-05-16', end: '2026-05-16' })).toBe(0);
    expect(nightsBetween({ start: 'TBD', end: 'TBD' })).toBeUndefined();
    expect(durationLabel(0)).toBe('Day trip');
    expect(durationLabel(3)).toBe('3 nights');
    expect(formatLongDate('2026-05-16')).toBe('16 May 2026');
    expect(formatLongDate('TBD')).toBe('TBD');
  });
});
