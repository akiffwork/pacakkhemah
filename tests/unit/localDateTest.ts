import { localDateStr, parseLocalDate } from '@/lib/localDate';
import { updateRate } from '@/lib/performance';
import type { Order } from '@/lib/orderFlow';

// Tests run in Asia/Kuala_Lumpur (UTC+8), like the users.
describe('localDate', () => {
  test('today is the local date, not UTC, early in the morning', () => {
    const sevenAm = new Date(2026, 10, 21, 7, 0); // 21 Nov 07:00 MYT = 20 Nov 23:00 UTC
    expect(sevenAm.toISOString().slice(0, 10)).toBe('2026-11-20');
    expect(localDateStr(sevenAm)).toBe('2026-11-21');
  });

  test('parses YYYY-MM-DD as local midnight', () => {
    const d = parseLocalDate('2026-11-21');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 10, 21, 0]);
  });

  test('stale-order check counts an order that ended yesterday, at 7 am', () => {
    const o = { id: 'o', status: 'confirmed', bookingDates: { start: '2026-11-19', end: '2026-11-20' } } as unknown as Order;
    expect(updateRate([o], new Date(2026, 10, 21, 7, 0)).stale).toBe(1);
  });
});
