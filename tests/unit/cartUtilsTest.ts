/**
 * Unit tests for src/lib/cartUtils.ts
 * Tests cart key generation and item count logic extracted from ShopClient.tsx.
 */

import { getCartKey, countInCart, CartItem } from '@/lib/cartUtils';

// ─── getCartKey ───────────────────────────────────────────────────────────────

describe('getCartKey', () => {
  test('returns item id for a simple item', () => {
    const item: CartItem = { id: 'tent-01', name: 'Tent', price: 50, qty: 1 };
    expect(getCartKey(item)).toBe('tent-01');
  });

  test('returns id__variantId for a variant item', () => {
    const item: CartItem = {
      id: 'tent-01', name: 'Tent', price: 50, qty: 1,
      selectedVariant: { id: 'red', price: 50, stock: 5 },
    };
    expect(getCartKey(item)).toBe('tent-01__red');
  });

  test('returns id__pkg_<sorted variantIds> for a package item', () => {
    const item: CartItem = {
      id: 'pkg-01', name: 'Package', price: 120, qty: 1,
      linkedVariants: [
        { itemId: 'a', variantId: 'z-variant', variantLabel: 'Z' },
        { itemId: 'b', variantId: 'a-variant', variantLabel: 'A' },
      ],
    };
    expect(getCartKey(item)).toBe('pkg-01__pkg_a-variant_z-variant');
  });

  test('variant key takes precedence over package key', () => {
    const item: CartItem = {
      id: 'item-x', name: 'X', price: 10, qty: 1,
      selectedVariant: { id: 'v1', price: 10, stock: 3 },
      linkedVariants: [{ itemId: 'y', variantId: 'vy', variantLabel: 'Y' }],
    };
    expect(getCartKey(item)).toBe('item-x__v1');
  });

  test('single-item linkedVariants generates a valid pkg key', () => {
    const item: CartItem = {
      id: 'pkg-02', name: 'P', price: 80, qty: 1,
      linkedVariants: [{ itemId: 'tent', variantId: 'blue', variantLabel: 'Blue' }],
    };
    expect(getCartKey(item)).toBe('pkg-02__pkg_blue');
  });
});

// ─── countInCart ──────────────────────────────────────────────────────────────

const simpleItem: CartItem = { id: 'tent', name: 'Tent', price: 50, qty: 2 };
const variantItem: CartItem = {
  id: 'tent', name: 'Tent', price: 50, qty: 3,
  selectedVariant: { id: 'blue', price: 50, stock: 5 },
};
const differentVariant: CartItem = {
  id: 'tent', name: 'Tent', price: 50, qty: 1,
  selectedVariant: { id: 'red', price: 50, stock: 5 },
};

describe('countInCart – direct items', () => {
  test('counts qty of a simple item', () => {
    expect(countInCart([simpleItem], 'tent')).toBe(2);
  });

  test('returns 0 for an item not in the cart', () => {
    expect(countInCart([simpleItem], 'sleeping-bag')).toBe(0);
  });

  test('counts variant item when variantId matches', () => {
    expect(countInCart([variantItem], 'tent', 'blue')).toBe(3);
  });

  test('returns 0 for a variant that is not in the cart', () => {
    expect(countInCart([variantItem], 'tent', 'green')).toBe(0);
  });

  test('counts all variants of the same item when no variantId filter', () => {
    expect(countInCart([variantItem, differentVariant], 'tent')).toBe(4);
  });

  test('counts only the requested variant when filter is provided', () => {
    expect(countInCart([variantItem, differentVariant], 'tent', 'blue')).toBe(3);
    expect(countInCart([variantItem, differentVariant], 'tent', 'red')).toBe(1);
  });

  test('sums multiple entries of the same item', () => {
    const cart: CartItem[] = [
      { id: 'mat', name: 'Mat', price: 10, qty: 2 },
      { id: 'mat', name: 'Mat', price: 10, qty: 3 },
    ];
    expect(countInCart(cart, 'mat')).toBe(5);
  });

  test('returns 0 for an empty cart', () => {
    expect(countInCart([], 'tent')).toBe(0);
  });
});

describe('countInCart – linked items inside packages', () => {
  const packageItem: CartItem = {
    id: 'pkg', name: 'Package', price: 100, qty: 2,
    linkedItems: [
      { itemId: 'tent', qty: 1 },
      { itemId: 'mat', qty: 2 },
    ],
  };

  test('counts child items consumed by a package', () => {
    // 1 tent per package × 2 packages = 2
    expect(countInCart([packageItem], 'tent')).toBe(2);
    // 2 mats per package × 2 packages = 4
    expect(countInCart([packageItem], 'mat')).toBe(4);
  });

  test('counts both direct entries and package children', () => {
    const directMat: CartItem = { id: 'mat', name: 'Mat', price: 10, qty: 1 };
    expect(countInCart([packageItem, directMat], 'mat')).toBe(5); // 4 + 1
  });

  test('counts locked variant in linked item', () => {
    const pkgWithLockedVariant: CartItem = {
      id: 'pkg2', name: 'Pkg2', price: 90, qty: 1,
      linkedItems: [{ itemId: 'tent', qty: 1, variantId: 'blue' }],
    };
    expect(countInCart([pkgWithLockedVariant], 'tent', 'blue')).toBe(1);
    expect(countInCart([pkgWithLockedVariant], 'tent', 'red')).toBe(0);
  });

  test('counts customer-picked variant via linkedVariants when no locked variantId', () => {
    const pkgWithPickedVariant: CartItem = {
      id: 'pkg3', name: 'Pkg3', price: 90, qty: 1,
      linkedItems: [{ itemId: 'tent', qty: 1 }],
      linkedVariants: [{ itemId: 'tent', variantId: 'green', variantLabel: 'Green' }],
    };
    expect(countInCart([pkgWithPickedVariant], 'tent', 'green')).toBe(1);
    expect(countInCart([pkgWithPickedVariant], 'tent', 'blue')).toBe(0);
  });
});
