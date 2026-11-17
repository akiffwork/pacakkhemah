/**
 * Unit tests for src/lib/inventory.ts
 */

import {
  type GearItem, type Discount,
  categoryOf, categoryOptions, usedCategories, isTentLike, itemIssues, itemStatus, needsAttention,
  isShopVisible, itemPriceLine, matchesSearch, variantsSummary, tiersSummary, specsSummary,
  contentsSummary, variantTotals, discountState, describeDiscount, discountMeta, limitsSummary,
  discountErrors, discountTitle,
} from '@/lib/inventory';

const item = (over: Partial<GearItem> = {}): GearItem => ({ id: 'g1', name: 'Naturehike 2P', price: 45, stock: 3, images: ['a.jpg'], category: 'Tents', ...over });
const NOW = new Date(2026, 10, 17, 12);

describe('categories', () => {
  test('falls back by type', () => {
    expect(categoryOf({ type: 'package' })).toBe('Packages');
    expect(categoryOf({})).toBe('Other');
    expect(categoryOf({ category: ' Tents ' })).toBe('Tents');
  });
  test('options keep suggestions first and dedupe', () => {
    const opts = categoryOptions([{ category: 'tents' }, { category: 'Khemah' }]);
    expect(opts.slice(0, 6)).toEqual(['Tents', 'Sleeping', 'Furniture', 'Cooking', 'Lighting', 'Packages']);
    expect(opts).toContain('Khemah');
    expect(opts.filter(o => o.toLowerCase() === 'tents')).toHaveLength(1);
  });
  test('used categories in suggested order', () => {
    expect(usedCategories([{ category: 'Zebra' }, { category: 'Lighting' }, { category: 'Tents' }])).toEqual(['Tents', 'Lighting', 'Zebra']);
  });
  test('tent detection', () => {
    expect(isTentLike({ category: 'Tents', name: 'x' })).toBe(true);
    expect(isTentLike({ category: 'Furniture', name: 'Chair' })).toBe(false);
    expect(isTentLike({ category: 'Other', name: 'Flysheet 3x3' })).toBe(true);
    expect(isTentLike({ category: 'Other', name: 'x', specs: { puRating: '3000' } })).toBe(true);
  });
});

describe('item status', () => {
  test('live when complete', () => {
    expect(itemStatus(item())).toEqual({ kind: 'live', label: 'Live' });
    expect(needsAttention(item())).toBe(false);
  });
  test('warn on missing photo', () => {
    expect(itemStatus(item({ images: [], img: '' }))).toEqual({ kind: 'warn', label: 'Live · no photo yet' });
  });
  test('blocked on price or stock', () => {
    expect(itemStatus(item({ stock: 0 })).kind).toBe('blocked');
    expect(itemStatus(item({ price: 0, stock: 0 })).label).toBe('Not bookable · no price, no stock');
  });
  test('variants: blocked only when all are empty', () => {
    const v = (price: number, stock: number) => ({ id: String(price) + stock, price, stock });
    expect(itemStatus(item({ hasVariants: true, variants: [v(50, 0), v(50, 2)] })).kind).toBe('live');
    expect(itemStatus(item({ hasVariants: true, variants: [v(50, 0), v(50, 0)] })).kind).toBe('blocked');
    expect(itemIssues(item({ hasVariants: true, variants: [v(0, 1), v(50, 1)] })).map(i => i.key)).toEqual(['variant_price']);
  });
  test('paused wins and is hidden from shop', () => {
    const p = item({ paused: true, stock: 0 });
    expect(itemStatus(p).kind).toBe('paused');
    expect(needsAttention(p)).toBe(false);
    expect(isShopVisible(p)).toBe(false);
    expect(isShopVisible(item())).toBe(true);
  });
  test('package without contents', () => {
    expect(itemIssues(item({ type: 'package' })).map(i => i.key)).toContain('contents');
  });
});

describe('lines and search', () => {
  test('price line', () => {
    expect(itemPriceLine(item())).toBe('RM 45 / night · 3 in stock');
    expect(itemPriceLine(item({ hasVariants: true, variants: [{ id: 'a', price: 120, stock: 2, color: { label: 'Khaki', hex: '#000' } }, { id: 'b', price: 140, stock: 1, color: { label: 'Green', hex: '#000' } }] }))).toBe('From RM 120 / night · 2 colours');
    expect(itemPriceLine(item({ type: 'package', price: 180, stock: 1, linkedItems: [{ itemId: 'x', qty: 1 }, { itemId: 'y', qty: 2 }] }))).toBe('RM 180 / night · 1 in stock · 2 items inside');
  });
  test('search', () => {
    expect(matchesSearch(item(), 'nature')).toBe(true);
    expect(matchesSearch(item(), 'tents')).toBe(true);
    expect(matchesSearch(item(), 'chair')).toBe(false);
    expect(matchesSearch(item(), '  ')).toBe(true);
  });
});

describe('editor summaries', () => {
  test('variants, tiers, specs, contents', () => {
    expect(variantsSummary(false, [])).toBe('Off · one version only');
    expect(variantsSummary(true, [{ id: 'a', price: 1, stock: 2, color: { label: 'Khaki', hex: '' } }])).toBe('On · Khaki (2)');
    expect(tiersSummary([{ nights: 1, label: '2D1N', price: 0 }])).toBe('Off · price per night × nights');
    expect(tiersSummary([{ nights: 1, label: '2D1N', price: 80 }, { nights: 2, label: '3D2N', price: 150 }])).toBe('2D1N RM 80 · 3D2N RM 150');
    expect(specsSummary({ tentType: 'Air Tent', maxPax: 6, puRating: '3000' })).toBe('Air Tent · sleeps 6 · PU 3000');
    expect(specsSummary({})).toBe('Not filled in');
    expect(contentsSummary([{ itemId: 'g1', qty: 2 }], ['Pegs'], [item()])).toBe('2 × Naturehike 2P, Pegs');
    expect(variantTotals([{ id: 'a', price: 0, stock: 2 }, { id: 'b', price: 90, stock: 1 }])).toEqual({ stock: 3, minPrice: 90 });
  });
});

describe('discounts', () => {
  const items = [item({ id: 'gas', name: 'Gas Canister' }), item()];
  const d = (over: Partial<Discount>): Discount => ({ id: 'd', type: 'promo_code', discount_percent: 10, ...over });

  test('state', () => {
    expect(discountState(d({}), NOW).state).toBe('active');
    expect(discountState(d({ validFrom: '2027-03-01' }), NOW)).toMatchObject({ state: 'upcoming' });
    expect(discountState(d({ validUntil: '2026-08-31' }), NOW)).toMatchObject({ state: 'ended' });
    expect(discountState(d({ validUntil: '2026-11-17' }), NOW).state).toBe('active');
    expect(discountState(d({ maxUses: 5, usedCount: 5 }), NOW)).toEqual({ state: 'ended', label: 'Used up' });
  });

  test('descriptions', () => {
    expect(describeDiscount(d({ code: 'CAMP10' }), items)).toBe('10% off all items with code CAMP10');
    expect(describeDiscount(d({ code: 'RAYA', discount_fixed: 25 }), items)).toBe('RM 25 off all items with code RAYA');
    expect(describeDiscount(d({ type: 'nightly_discount', trigger_nights: 3, discount_percent: 15, appliesTo: { type: 'specific', itemIds: ['a', 'b'] } }), items)).toBe('Book 3 or more nights, get 15% off 2 items');
    expect(describeDiscount(d({ type: 'min_spend', min_spend: 300, discount_fixed: 30 }), items)).toBe('Spend RM 300 or more, get RM 30 off');
    expect(describeDiscount(d({ type: 'quantity_bundle', min_qty: 4, bundle_category: 'Furniture' }), items)).toBe('Take 4 or more furniture items, get 10% off all items');
    expect(describeDiscount(d({ type: 'free_item', freeItemId: 'gas', freeItemQty: 1, free_trigger: 'min_spend', free_trigger_spend: 300 }), items)).toBe('Spend RM 300 or more, get 1 × Gas Canister free');
    expect(describeDiscount(d({ type: 'free_item', freeItemId: 'gas', free_trigger: 'always' }), items)).toBe('Every booking gets 1 × Gas Canister free');
    expect(discountTitle(d({ code: 'CAMP10' }))).toBe('Promo code CAMP10');
  });

  test('meta and limits', () => {
    expect(discountMeta(d({ usedCount: 12, maxUses: 50, is_public: true }))).toBe('Used 12 of 50 · no end date · shown on shop');
    expect(discountMeta(d({ type: 'nightly_discount', usedCount: 1 }))).toBe('Used 1 time · no end date · applied automatically');
    expect(limitsSummary({ type: 'promo_code', is_public: false })).toBe('No end date · unlimited uses · not shown on shop');
  });

  test('validation', () => {
    expect(discountErrors({ type: 'promo_code', code: 'CAMP10', discount_percent: 10 })).toEqual([]);
    expect(discountErrors({ type: 'promo_code', code: 'CAMP10', discount_percent: 10 }, ['CAMP10'])).toEqual(['You already have this code']);
    expect(discountErrors({ type: 'promo_code', code: '', discount_percent: 0 })).toEqual(['Enter a code', 'Enter the discount amount']);
    expect(discountErrors({ type: 'nightly_discount', trigger_nights: 1, discount_percent: 120 })).toEqual(['Percent cannot be more than 100', 'Nights must be 2 or more']);
    expect(discountErrors({ type: 'free_item', free_trigger: 'min_spend' })).toEqual(['Choose the free item', 'Enter the minimum spend']);
    expect(discountErrors({ type: 'min_spend', min_spend: 100, discount_fixed: 10, validFrom: '2026-12-01', validUntil: '2026-11-01' })).toEqual(['End date is before the start date']);
    expect(discountErrors({ type: 'quantity_bundle', min_qty: 3, discount_percent: 5, appliesTo: { type: 'specific', itemIds: [] } })).toEqual(['Choose at least one item']);
  });
});
