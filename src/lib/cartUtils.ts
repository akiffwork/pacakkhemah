/**
 * Pure cart utility functions extracted from ShopClient.tsx.
 * Keeping them here makes the key logic independently testable.
 */

export type LinkedVariantSelection = {
  itemId: string;
  variantId: string;
  variantLabel: string;
  variantColor?: string;
};

export type CartItem = {
  id: string;
  name: string;
  price: number;
  qty: number;
  stock?: number;
  addSetup?: boolean;
  selectedVariant?: { id: string; price: number; stock: number };
  linkedVariants?: LinkedVariantSelection[];
  linkedItems?: { itemId: string; qty: number; variantId?: string }[];
};

/**
 * Returns a stable, unique key for a cart entry.
 * - Variant item:  `{itemId}__{variantId}`
 * - Package item:  `{itemId}__pkg_{sorted variantIds joined by _}`
 * - Simple item:   `{itemId}`
 */
export function getCartKey(item: CartItem): string {
  if (item.selectedVariant) return `${item.id}__${item.selectedVariant.id}`;
  if (item.linkedVariants?.length) {
    return `${item.id}__pkg_${item.linkedVariants.map(v => v.variantId).sort().join("_")}`;
  }
  return item.id;
}

/**
 * Count how many units of a given item (optionally a specific variant) are
 * consumed in the cart — both as direct entries and as linked children of
 * package items.
 */
export function countInCart(
  cartArr: CartItem[],
  itemId: string,
  variantId?: string,
): number {
  let count = 0;
  for (const ci of cartArr) {
    if (ci.id === itemId && (!variantId || ci.selectedVariant?.id === variantId)) {
      count += ci.qty;
    }
    if (ci.linkedItems) {
      for (const li of ci.linkedItems) {
        if (li.itemId === itemId) {
          const rv = li.variantId ?? ci.linkedVariants?.find(lv => lv.itemId === itemId)?.variantId;
          if (!variantId || rv === variantId) count += (li.qty || 1) * ci.qty;
        }
      }
    }
  }
  return count;
}
