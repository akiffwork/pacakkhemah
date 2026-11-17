/**
 * Unit tests for src/lib/vendorSettings.ts
 * Setup checklist, section summaries and small helpers.
 */

import {
  setupChecklist, locationSummary, depositSummary, deliverySummary, comboSummary,
  timeSlotsSummary, loyaltySummary, invoiceSummary, socialSummary, withServiceDefaults,
  extractCoords, cleanSlug, splitList, taxProfileComplete,
} from '@/lib/vendorSettings';

describe('setupChecklist', () => {
  test('empty vendor has everything to do', () => {
    const items = setupChecklist({});
    expect(items.every(i => !i.done)).toBe(true);
    expect(items.map(i => i.key)).toEqual(['phone', 'logo', 'about', 'pickup', 'pin', 'deposit', 'gear']);
  });

  test('ticks what is set', () => {
    const items = setupChecklist({ phone: '601', image: 'x.png', tagline_my: 'Hai', pickup: ['Hub'], locationUrl: 'https://maps', security_deposit: 0, gear_count: 3 });
    expect(items.every(i => i.done)).toBe(true);
  });
});

describe('summaries', () => {
  test('location', () => {
    expect(locationSummary({ city: 'Kuantan', pickup: ['A', 'B'], areas: ['Pahang'], locationUrl: 'x' })).toBe('Kuantan · 2 pickup points · covers Pahang');
    expect(locationSummary({})).toBe('no pickup point · map pin not set');
    expect(locationSummary({ areas: ['A', 'B', 'C'], locationUrl: 'x' })).toContain('covers A, B +1');
  });

  test('deposit', () => {
    expect(depositSummary({ security_deposit: 50 })).toBe('RM 50 per booking');
    expect(depositSummary({ security_deposit: 20, security_deposit_type: 'percent' })).toBe('20% of the rental');
    expect(depositSummary({ security_deposit: 0 })).toBe('No deposit');
  });

  test('delivery and services', () => {
    const s = withServiceDefaults({ delivery: { enabled: true, pricingType: 'fixed', fixedFee: 20, freeAbove: 300 } as never });
    expect(deliverySummary(s)).toBe('On · RM 20 fixed · free above RM 300');
    expect(deliverySummary(withServiceDefaults(null))).toBe('Off · pickup only');
    expect(deliverySummary(withServiceDefaults({ delivery: { enabled: true, pricingType: 'quote' } as never }))).toBe('On · quoted on WhatsApp');
    expect(comboSummary(s)).toBe('Needs delivery and setup on');
    expect(timeSlotsSummary(withServiceDefaults(null))).toBe('Needs delivery on');
    expect(timeSlotsSummary(s)).toBe('Off · customers pick any time');
  });

  test('loyalty, invoice, socials', () => {
    expect(loyaltySummary({ enabled: true, tiers: [{ id: 'g', minBookings: 10, discount: 15, label: 'Gold' }, { id: 'b', minBookings: 2, discount: 5, label: 'Bronze' }] })).toBe('On · 5% off from booking 2');
    expect(loyaltySummary(undefined)).toBe('Off');
    expect(invoiceSummary({ tin: 'D1', legalName: 'KEMAH ENT', address: 'Jalan 1' })).toBe('KEMAH ENT · TIN D1');
    expect(invoiceSummary({ tin: 'D1' })).toContain('Not set up');
    expect(socialSummary({ ig: 'x', tiktok: 'y' })).toBe('Instagram, TikTok · 2 of 4 set');
    expect(socialSummary({})).toBe('None added yet');
  });
});

describe('helpers', () => {
  test('coords from map links', () => {
    expect(extractCoords('https://maps.google.com/?q=3.1234,101.5678')).toEqual({ lat: 3.1234, lng: 101.5678 });
    expect(extractCoords('https://www.google.com/maps/@3.8,103.3,15z')).toEqual({ lat: 3.8, lng: 103.3 });
    expect(extractCoords('https://maps.app.goo.gl/abc')).toBeNull();
  });

  test('slug and lists', () => {
    expect(cleanSlug('  Kuantan Camp  Gear! ')).toBe('kuantan-camp-gear');
    expect(splitList(' Kuantan, Kemaman ,, \n Pekan ')).toEqual(['Kuantan', 'Kemaman', 'Pekan']);
    expect(taxProfileComplete({ tin: 'a', legalName: 'b', address: 'c' })).toBe(true);
    expect(taxProfileComplete({ tin: 'a' })).toBe(false);
  });
});
