/**
 * Unit tests for src/lib/orderFlow.ts
 * Pipeline stage, split payment, next action, grouping and price breakdown.
 */

import {
  type Order, getStage, getPayment, paymentPatch, legacyPaymentStatus,
  getNextAction, pickupGaps, canComplete, summarize, sortForGroup,
  priceBreakdown, daysUntil, itemLineTotal,
} from '@/lib/orderFlow';
import { buildMessage, whatsappUrl } from '@/lib/orderMessages';

const NOW = new Date(2026, 10, 17, 10, 0, 0); // Tue 17 Nov 2026, local time

function order(over: Partial<Order> = {}): Order {
  return {
    id: 'o1',
    customerPhone: '60123456789',
    customerName: 'Siti',
    items: [{ name: 'Air Tent', qty: 1, price: 95 }],
    totalAmount: 290,
    depositAmount: 100,
    rentalAmount: 190,
    pickupLocation: 'Hub A',
    bookingDates: { start: '2026-11-20', end: '2026-11-22' },
    status: 'confirmed',
    createdAt: new Date(2026, 10, 15),
    ...over,
  };
}

describe('daysUntil', () => {
  test('counts whole local days', () => {
    expect(daysUntil('2026-11-17', NOW)).toBe(0);
    expect(daysUntil('2026-11-18', NOW)).toBe(1);
    expect(daysUntil('2026-11-16', NOW)).toBe(-1);
  });
});

describe('getStage', () => {
  test('maps status and timestamps to a stage', () => {
    expect(getStage(order({ status: 'pending' }))).toBe('new');
    expect(getStage(order({ status: 'conflict' }))).toBe('new');
    expect(getStage(order())).toBe('confirmed');
    expect(getStage(order({ pickedUpAt: 1 }))).toBe('picked_up');
    expect(getStage(order({ pickedUpAt: 1, returnedAt: 2 }))).toBe('returned');
    expect(getStage(order({ status: 'completed' }))).toBe('completed');
    expect(getStage(order({ status: 'cancelled', pickedUpAt: 1 }))).toBe('cancelled');
  });
});

describe('getPayment', () => {
  test('nothing received by default', () => {
    const p = getPayment(order());
    expect(p).toMatchObject({ deposit: 100, rental: 190, total: 290, balanceDue: 290, nothingReceived: true, depositHeld: false });
  });

  test('reads the old single payment status', () => {
    expect(getPayment(order({ paymentStatus: 'deposit_paid' }))).toMatchObject({ depositReceived: true, rentalReceived: false, balanceDue: 190, depositHeld: true });
    expect(getPayment(order({ paymentStatus: 'full_paid' }))).toMatchObject({ depositReceived: true, rentalReceived: true, balanceDue: 0, fullyReceived: true });
    expect(getPayment(order({ paymentStatus: 'refunded' }))).toMatchObject({ depositOutcome: 'refunded', depositRefunded: 100, depositKept: 0, depositHeld: false });
    expect(getPayment(order({ paymentStatus: 'deposit_burnt' }))).toMatchObject({ depositOutcome: 'kept', depositKept: 100, depositRefunded: 0 });
  });

  test('new fields win once an order is migrated', () => {
    const p = getPayment(order({ paymentV2: true, paymentStatus: 'full_paid', depositReceivedAt: 1 }));
    expect(p).toMatchObject({ depositReceived: true, rentalReceived: false, balanceDue: 190 });
  });

  test('order without a deposit has no deposit steps', () => {
    const p = getPayment(order({ depositAmount: 0, rentalAmount: 290 }));
    expect(p).toMatchObject({ deposit: 0, rental: 290, balanceDue: 290, depositHeld: false });
    expect(getPayment(order({ depositAmount: 0, rentalAmount: 290, paymentStatus: 'full_paid' })).fullyReceived).toBe(true);
  });

  test('partial keep splits the deposit', () => {
    const p = getPayment(order({ paymentV2: true, depositReceivedAt: 1, rentalReceivedAt: 1, depositOutcome: 'partial', depositKeptAmount: 30 }));
    expect(p).toMatchObject({ depositKept: 30, depositRefunded: 70, depositHeld: false });
  });
});

describe('paymentPatch', () => {
  test('deposit first, then rental', () => {
    const a = paymentPatch(order(), { kind: 'deposit', received: true }, 'T');
    expect(a).toMatchObject({ paymentV2: true, depositReceivedAt: 'T', rentalReceivedAt: null, paymentStatus: 'deposit_paid' });
    const b = paymentPatch(order(a), { kind: 'rental', received: true }, 'T2');
    expect(b).toMatchObject({ depositReceivedAt: 'T', rentalReceivedAt: 'T2', paymentStatus: 'full_paid' });
  });

  test('full payment ticks both at once', () => {
    expect(paymentPatch(order(), { kind: 'full' }, 'T')).toMatchObject({ depositReceivedAt: 'T', rentalReceivedAt: 'T', paymentStatus: 'full_paid' });
  });

  test('migrates a legacy order without losing what was paid', () => {
    const patch = paymentPatch(order({ paymentStatus: 'deposit_paid' }), { kind: 'rental', received: true }, 'T');
    expect(patch).toMatchObject({ paymentV2: true, depositReceivedAt: 'T', rentalReceivedAt: 'T', paymentStatus: 'full_paid' });
  });

  test('undo deposit clears any settlement', () => {
    const paid = order({ paymentV2: true, depositReceivedAt: 1, rentalReceivedAt: 1, depositOutcome: 'refunded', depositSettledAt: 2 });
    expect(paymentPatch(paid, { kind: 'deposit', received: false }, 'T')).toMatchObject({ depositReceivedAt: null, depositOutcome: null, depositSettledAt: null, paymentStatus: 'deposit_paid' });
  });

  test('settling keeps the record that the customer paid in full', () => {
    const paid = order({ paymentV2: true, depositReceivedAt: 1, rentalReceivedAt: 1 });
    const refund = paymentPatch(paid, { kind: 'settle', outcome: 'refunded' }, 'T');
    expect(refund).toMatchObject({ depositOutcome: 'refunded', depositKeptAmount: 0, rentalReceivedAt: 1, depositReceivedAt: 1, paymentStatus: 'refunded' });
    const part = paymentPatch(paid, { kind: 'settle', outcome: 'partial', keptAmount: 30, reason: 'Damage' }, 'T');
    expect(part).toMatchObject({ depositOutcome: 'partial', depositKeptAmount: 30, depositKeptReason: 'Damage', paymentStatus: 'refunded' });
    expect(paymentPatch(paid, { kind: 'settle', outcome: 'kept', reason: 'Missing item' }, 'T')).toMatchObject({ depositOutcome: 'kept', paymentStatus: 'deposit_burnt' });
  });

  test('partial amounts at the limits become refund or keep', () => {
    const paid = order({ paymentV2: true, depositReceivedAt: 1, rentalReceivedAt: 1 });
    expect(paymentPatch(paid, { kind: 'settle', outcome: 'partial', keptAmount: 0 }, 'T').depositOutcome).toBe('refunded');
    expect(paymentPatch(paid, { kind: 'settle', outcome: 'partial', keptAmount: 500 }, 'T').depositOutcome).toBe('kept');
  });

  test('cannot settle a deposit that was never received', () => {
    expect(paymentPatch(order(), { kind: 'settle', outcome: 'refunded' }, 'T')).toEqual({});
  });

  test('legacy status covers each combination', () => {
    expect(legacyPaymentStatus({ deposit: 100, depositReceived: false, rentalReceived: false, depositOutcome: null })).toBe('unpaid');
    expect(legacyPaymentStatus({ deposit: 0, depositReceived: false, rentalReceived: true, depositOutcome: null })).toBe('full_paid');
    expect(legacyPaymentStatus({ deposit: 100, depositReceived: false, rentalReceived: true, depositOutcome: null })).toBe('deposit_paid');
  });
});

describe('getNextAction', () => {
  test('new order asks to confirm', () => {
    const a = getNextAction(order({ status: 'pending', createdAt: new Date(2026, 10, 17, 8, 0) }), NOW);
    expect(a).toMatchObject({ key: 'confirm', group: 'action', tag: 'New · 2 hours ago' });
  });

  test('stock conflict comes first', () => {
    expect(getNextAction(order({ status: 'conflict', stockConflict: true }), NOW)).toMatchObject({ key: 'resolve_conflict', priority: 0 });
  });

  test('confirmed walks payment, agreement, balance, then waits for pickup', () => {
    expect(getNextAction(order(), NOW).key).toBe('request_payment');
    const dep = order({ paymentV2: true, depositReceivedAt: 1 });
    expect(getNextAction(dep, NOW).key).toBe('send_agreement');
    const signed = order({ paymentV2: true, depositReceivedAt: 1, agreementSigned: true });
    expect(getNextAction(signed, NOW)).toMatchObject({ key: 'request_balance', reason: 'Deposit received, balance RM 190 unpaid' });
    const ready = order({ paymentV2: true, depositReceivedAt: 1, rentalReceivedAt: 1, agreementSigned: true });
    expect(getNextAction(ready, NOW)).toMatchObject({ key: 'pickup_reminder', group: 'waiting' });
  });

  test('a recent request moves the order to waiting, unless pickup is close', () => {
    const sent = NOW.getTime() - 3_600_000;
    expect(getNextAction(order({ paymentRequestedAt: sent }), NOW).group).toBe('waiting');
    expect(getNextAction(order({ paymentRequestedAt: sent, bookingDates: { start: '2026-11-18', end: '2026-11-20' } }), NOW)).toMatchObject({ group: 'action', tag: 'Pickup tomorrow' });
    expect(getNextAction(order({ paymentRequestedAt: NOW.getTime() - 2 * 86_400_000 }), NOW).group).toBe('action');
  });

  test('pickup day is about handing over, with open steps as the reason', () => {
    const a = getNextAction(order({ paymentV2: true, depositReceivedAt: 1, agreementSigned: true, bookingDates: { start: '2026-11-17', end: '2026-11-19' } }), NOW);
    expect(a).toMatchObject({ key: 'mark_picked_up', tag: 'Pickup today', tone: 'danger' });
    expect(a.reason).toContain('RM 190 unpaid');
  });

  test('add-on order does not need its own agreement', () => {
    const a = getNextAction(order({ parentOrderId: 'p1', depositAmount: 0, rentalAmount: 290, paymentV2: true, rentalReceivedAt: 1 }), NOW);
    expect(a.key).toBe('pickup_reminder');
  });

  test('picked up: waits during the trip, then asks for the return', () => {
    const trip = { paymentV2: true, depositReceivedAt: 1, rentalReceivedAt: 1, agreementSigned: true, pickedUpAt: 1 };
    expect(getNextAction(order({ ...trip, bookingDates: { start: '2026-11-16', end: '2026-11-19' } }), NOW)).toMatchObject({ key: 'return_reminder', group: 'waiting' });
    expect(getNextAction(order({ ...trip, bookingDates: { start: '2026-11-15', end: '2026-11-17' } }), NOW)).toMatchObject({ key: 'mark_returned', tag: 'Return today' });
    expect(getNextAction(order({ ...trip, bookingDates: { start: '2026-11-14', end: '2026-11-16' } }), NOW)).toMatchObject({ key: 'mark_returned', tag: 'Overdue', tone: 'danger', reason: 'Return was due yesterday, not marked returned' });
  });

  test('confirmed order whose dates passed goes straight to returned', () => {
    expect(getNextAction(order({ bookingDates: { start: '2026-11-07', end: '2026-11-09' } }), NOW)).toMatchObject({ key: 'mark_returned', tag: 'Overdue' });
  });

  test('returned: collect rental, settle deposit, then complete', () => {
    const back = { pickedUpAt: 1, returnedAt: 2, paymentV2: true, depositReceivedAt: 1, bookingDates: { start: '2026-11-12', end: '2026-11-14' } };
    expect(getNextAction(order(back), NOW).key).toBe('request_balance');
    expect(getNextAction(order({ ...back, rentalReceivedAt: 1 }), NOW)).toMatchObject({ key: 'settle_deposit', reason: 'Deposit RM 100 still held' });
    const settled = order({ ...back, rentalReceivedAt: 1, depositOutcome: 'refunded' });
    expect(getNextAction(settled, NOW).key).toBe('complete');
    expect(canComplete(settled)).toBe(true);
    expect(canComplete(order({ ...back, rentalReceivedAt: 1 }))).toBe(false);
    expect(canComplete(order(back))).toBe(false);
  });

  test('completed: asks for a review once, only for recent orders', () => {
    const done = { status: 'completed' as const, reviewToken: 'o1', reviewTokenUsed: false };
    expect(getNextAction(order({ ...done, completedAt: new Date(2026, 10, 15) }), NOW)).toMatchObject({ key: 'send_review', group: 'action' });
    expect(getNextAction(order({ ...done, completedAt: new Date(2026, 10, 15), reviewTokenSentAt: 1 }), NOW).group).toBe('done');
    expect(getNextAction(order({ ...done, completedAt: new Date(2026, 8, 1) }), NOW).group).toBe('done');
    expect(getNextAction(order({ ...done, reviewTokenUsed: true }), NOW)).toMatchObject({ key: 'none', tag: 'Reviewed' });
  });

  test('cancelled is done and shows its reason', () => {
    expect(getNextAction(order({ status: 'cancelled', cancelReason: 'Customer did not reply' }), NOW)).toMatchObject({ group: 'done', reason: 'Cancelled: Customer did not reply' });
  });
});

describe('pickupGaps', () => {
  test('lists unpaid balance and missing agreement', () => {
    expect(pickupGaps(order()).map(g => g.step)).toEqual(['payment', 'agreement']);
    expect(pickupGaps(order({ paymentStatus: 'full_paid', agreementSigned: true }))).toEqual([]);
  });
});

describe('summarize and sortForGroup', () => {
  const orders: Order[] = [
    order({ id: 'new', status: 'pending', createdAt: new Date(2026, 10, 17, 9, 0) }),
    order({ id: 'overdue', pickedUpAt: 1, paymentStatus: 'full_paid', agreementSigned: true, bookingDates: { start: '2026-11-14', end: '2026-11-16' } }),
    order({ id: 'balance', paymentV2: true, depositReceivedAt: 1, agreementSigned: true, bookingDates: { start: '2026-11-18', end: '2026-11-20' } }),
    order({ id: 'ready', paymentStatus: 'full_paid', agreementSigned: true }),
    order({ id: 'gone', status: 'cancelled' }),
    order({ id: 'deleted', deleted: true }),
  ];

  test('counts groups and money to collect', () => {
    expect(summarize(orders, NOW)).toEqual({ action: 3, waiting: 1, done: 1, toCollect: 190, depositsHeld: 300 });
  });

  test('most urgent first', () => {
    expect(sortForGroup(orders, 'action', NOW).map(o => o.id)).toEqual(['overdue', 'balance', 'new']);
    expect(sortForGroup(orders, 'waiting', NOW).map(o => o.id)).toEqual(['ready']);
  });
});

describe('priceBreakdown', () => {
  test('shows every saved cart figure, discounts and promo code included', () => {
    const rows = priceBreakdown(order({
      totalAmount: 450, depositAmount: 150, rentalAmount: 300,
      subtotal: 300, promoCode: 'CAMP10', promoDiscount: 30, bundleDiscount: 20, minSpendDiscount: 5, autoDiscount: 10,
      setupFeeTotal: 30, deliveryFee: 20, deliveryZone: 'Kuantan town',
    }));
    expect(rows.map(r => r.label)).toEqual([
      'Subtotal', 'Extended stay discount', 'Spend reward', 'Bundle deal', 'Promo code',
      'Setup fee', 'Delivery fee · Kuantan town', 'Rental', 'Security deposit (refundable)', 'Total',
    ]);
    expect(rows.find(r => r.label === 'Promo code')).toMatchObject({ code: 'CAMP10', amount: -30 });
    expect(rows[rows.length - 1]).toMatchObject({ amount: 450, kind: 'total' });
  });

  test('old orders show only what was saved', () => {
    expect(priceBreakdown(order()).map(r => r.label)).toEqual(['Rental', 'Security deposit (refundable)', 'Total']);
  });

  test('quoted delivery and combo', () => {
    expect(priceBreakdown(order({ deliveryQuotePending: true })).some(r => r.text === 'To be quoted')).toBe(true);
    expect(priceBreakdown(order({ comboApplied: true, comboFee: 40, comboSavings: 10, setupFeeTotal: 30, deliveryFee: 20 })).map(r => r.label)).toContain('Delivery + setup combo (saved RM 10)');
  });

  test('line total prefers the cart figure', () => {
    expect(itemLineTotal({ name: 'Tent', qty: 1, price: 90, lineTotal: 180 })).toBe(180);
    expect(itemLineTotal({ name: 'Chair', qty: 4, price: 5 })).toBe(20);
  });
});

describe('order messages', () => {
  const ctx = { vendorName: 'Kuantan Camp Gear', agreementLink: 'https://x/agreement', reviewLink: 'https://x/review/o1' };

  test('English and BM, neutral greeting, correct balance', () => {
    const o = order({ paymentV2: true, depositReceivedAt: 1 });
    const en = buildMessage('request_balance', 'en', o, ctx);
    const bm = buildMessage('request_balance', 'bm', o, ctx);
    expect(en).toContain('Hi Siti,');
    expect(en).toContain('RM190');
    expect(bm).toContain('Baki bayaran');
    expect(en + bm).not.toMatch(/salam/i);
  });

  test('links are included', () => {
    expect(buildMessage('agreement', 'en', order(), ctx)).toContain('https://x/agreement');
    expect(buildMessage('review', 'bm', order(), ctx)).toContain('https://x/review/o1');
  });

  test('whatsapp link works with or without a phone number', () => {
    expect(whatsappUrl('+60 12-345 6789', 'hi there')).toBe('https://wa.me/60123456789?text=hi%20there');
    expect(whatsappUrl('', 'hi')).toBe('https://wa.me/?text=hi');
  });
});
