// src/lib/inventory.ts
// Pure helpers for the vendor Inventory tab: item status, categories,
// folded-section summaries, and plain-language discount descriptions.

export type GearVariant = {
  id: string;
  color?: { label: string; hex: string };
  size?: string;
  price: number;
  stock: number;
};

export type LinkedItem = { itemId: string; qty: number; variantId?: string; variantLabel?: string; variantColor?: string };
export type PricingTier = { nights: number; label: string; price: number };

export type GearSpecs = {
  size?: string; maxPax?: number; puRating?: string; layers?: string; weight?: string; tentType?: string;
};

export type GearItem = {
  id: string;
  name: string;
  price: number;
  stock: number;
  img?: string;
  images?: string[];
  desc?: string;
  category?: string;
  type?: string; // "addon" | "package"
  inc?: string[];
  linkedItems?: LinkedItem[];
  deleted?: boolean;
  paused?: boolean;
  hasVariants?: boolean;
  variants?: GearVariant[];
  setup?: { available: boolean; fee: number; description: string };
  specs?: GearSpecs;
  pickupLocation?: string;
  pricingTiers?: PricingTier[];
};

export type Discount = {
  id: string;
  type: string;
  discount_percent: number;
  discount_fixed?: number | null;
  trigger_nights?: number | null;
  code?: string | null;
  appliesTo?: { type: "all" | "specific"; itemIds?: string[] };
  is_public?: boolean;
  deleted?: boolean;
  maxUses?: number | null;
  usedCount?: number;
  usedBy?: { phone: string; name?: string; date: string; orderId?: string }[];
  validFrom?: string | null;
  validUntil?: string | null;
  min_spend?: number;
  min_qty?: number;
  bundle_category?: string | null;
  freeItemId?: string;
  freeItemQty?: number;
  free_trigger?: string;
  free_trigger_nights?: number | null;
  free_trigger_spend?: number | null;
  free_trigger_qty?: number | null;
  free_trigger_category?: string | null;
};

// ── Categories ─────────────────────────────────────────────────────────────

export const SUGGESTED_CATEGORIES = ["Tents", "Sleeping", "Furniture", "Cooking", "Lighting", "Packages"];

export function categoryOf(g: Pick<GearItem, "category" | "type">): string {
  const c = g.category?.trim();
  if (c) return c;
  return g.type === "package" ? "Packages" : "Other";
}

/** Suggested categories first, then the vendor's own, without duplicates (case-insensitive). */
export function categoryOptions(items: Pick<GearItem, "category" | "type">[]): string[] {
  const out = [...SUGGESTED_CATEGORIES];
  for (const g of items) {
    const c = categoryOf(g);
    if (!out.some(x => x.toLowerCase() === c.toLowerCase())) out.push(c);
  }
  return out;
}

/** Categories that are actually used, in suggested order then alphabetical. */
export function usedCategories(items: Pick<GearItem, "category" | "type">[]): string[] {
  const used = Array.from(new Set(items.map(categoryOf)));
  const rank = (c: string) => {
    const i = SUGGESTED_CATEGORIES.findIndex(s => s.toLowerCase() === c.toLowerCase());
    return i < 0 ? 100 : i;
  };
  return used.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

export function isTentLike(g: Pick<GearItem, "category" | "specs" | "name">): boolean {
  if (g.specs && Object.values(g.specs).some(v => v !== undefined && v !== "")) return true;
  return /tent|khemah|shelter|flysheet|kanopi|canopy/i.test(`${g.category || ""} ${g.name || ""}`);
}

// ── Item status ───────────────────────────────────────────────────────────

export type ItemIssue = { key: string; label: string; blocking: boolean };

export function itemIssues(g: GearItem): ItemIssue[] {
  const issues: ItemIssue[] = [];
  const variants = g.hasVariants ? (g.variants || []) : [];
  if (variants.length) {
    if (variants.every(v => !v.price || v.price <= 0)) issues.push({ key: "price", label: "no price", blocking: true });
    else if (variants.some(v => !v.price || v.price <= 0)) issues.push({ key: "variant_price", label: "a colour or size has no price", blocking: false });
    if (variants.every(v => (v.stock || 0) <= 0)) issues.push({ key: "stock", label: "no stock", blocking: true });
  } else {
    if (!g.price || g.price <= 0) issues.push({ key: "price", label: "no price", blocking: true });
    if ((g.stock || 0) <= 0) issues.push({ key: "stock", label: "no stock", blocking: true });
  }
  if (!g.images?.length && !g.img) issues.push({ key: "photo", label: "no photo yet", blocking: false });
  if (g.type === "package" && !(g.linkedItems?.length || g.inc?.filter(Boolean).length)) {
    issues.push({ key: "contents", label: "contents not listed", blocking: false });
  }
  return issues;
}

export type ItemStatus = { kind: "live" | "warn" | "blocked" | "paused"; label: string };

export function itemStatus(g: GearItem): ItemStatus {
  if (g.paused) return { kind: "paused", label: "Paused · hidden from shop" };
  const issues = itemIssues(g);
  const blocking = issues.filter(i => i.blocking);
  if (blocking.length) return { kind: "blocked", label: `Not bookable · ${blocking.map(i => i.label).join(", ")}` };
  if (issues.length) return { kind: "warn", label: `Live · ${issues.map(i => i.label).join(", ")}` };
  return { kind: "live", label: "Live" };
}

export function needsAttention(g: GearItem): boolean {
  return !g.paused && itemIssues(g).length > 0;
}

/** Shown on the shop and bookable by customers. */
export function isShopVisible(g: Pick<GearItem, "deleted" | "paused">): boolean {
  return !g.deleted && !g.paused;
}

export function itemPriceLine(g: GearItem): string {
  const variants = g.hasVariants ? (g.variants || []) : [];
  const priced = variants.filter(v => v.price > 0).map(v => v.price);
  const price = priced.length
    ? (Math.min(...priced) === Math.max(...priced) ? `RM ${priced[0]}` : `From RM ${Math.min(...priced)}`)
    : `RM ${g.price || 0}`;
  const stock = variants.length
    ? `${variants.length} ${variants.some(v => v.color?.label) ? "colour" : "option"}${variants.length === 1 ? "" : "s"}`
    : `${g.stock || 0} in stock`;
  const inside = g.type === "package" && g.linkedItems?.length ? ` · ${g.linkedItems.length} item${g.linkedItems.length === 1 ? "" : "s"} inside` : "";
  return `${price} / night · ${stock}${inside}`;
}

export function matchesSearch(g: GearItem, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return true;
  return [g.name, g.category, g.desc, g.specs?.tentType].some(s => (s || "").toLowerCase().includes(t));
}

// ── Folded-section summaries in the item editor ────────────────────────────

export function variantsSummary(on: boolean, variants: GearVariant[]): string {
  if (!on || !variants.length) return "Off · one version only";
  return `On · ${variants.map(v => `${[v.color?.label, v.size].filter(Boolean).join(" ") || "Unnamed"} (${v.stock})`).join(", ")}`;
}

export function tiersSummary(tiers: PricingTier[]): string {
  const set = tiers.filter(t => t.price > 0);
  if (!set.length) return "Off · price per night × nights";
  return set.map(t => `${t.label} RM ${t.price}`).join(" · ");
}

export function setupItemSummary(available: boolean, fee: number): string {
  return available ? `Offered · RM ${fee}` : "Not offered for this item";
}

export function specsSummary(s: GearSpecs): string {
  const parts = [s.tentType, s.maxPax ? `sleeps ${s.maxPax}` : "", s.puRating ? `PU ${s.puRating}` : "", s.layers].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Not filled in";
}

export function contentsSummary(linked: LinkedItem[], inc: string[], allItems: GearItem[]): string {
  const names = linked.filter(l => l.itemId).map(l => `${l.qty} × ${allItems.find(a => a.id === l.itemId)?.name || "item"}`);
  const extra = inc.filter(Boolean);
  const all = [...names, ...extra];
  return all.length ? all.slice(0, 3).join(", ") + (all.length > 3 ? ` +${all.length - 3}` : "") : "Nothing listed yet";
}

/** Total stock and lowest price from variants, as saved on the item. */
export function variantTotals(variants: GearVariant[]): { stock: number; minPrice: number | null } {
  const stock = variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
  const priced = variants.filter(v => v.price > 0).map(v => v.price);
  return { stock, minPrice: priced.length ? Math.min(...priced) : null };
}

// ── Discounts ──────────────────────────────────────────────────────────────

export type DiscountKind = "promo_code" | "nightly_discount" | "min_spend" | "quantity_bundle" | "free_item";

export const DISCOUNT_KINDS: { key: DiscountKind; title: string; hint: string }[] = [
  { key: "promo_code", title: "Promo code", hint: "Customer types a code at checkout" },
  { key: "nightly_discount", title: "Longer stays", hint: "Cheaper when they book more nights, applied automatically" },
  { key: "min_spend", title: "Spend reward", hint: "Money off when the order passes an amount" },
  { key: "quantity_bundle", title: "Bundle", hint: "Money off when they take several items" },
  { key: "free_item", title: "Free gift", hint: "An item added free when a condition is met" },
];

export type DiscountState = "active" | "upcoming" | "ended";

export function discountState(d: Discount, now: Date = new Date()): { state: DiscountState; label: string } {
  const short = (s: string) => new Date(s).toLocaleDateString("en-MY", { day: "numeric", month: "short" });
  if (d.maxUses != null && (d.usedCount ?? 0) >= d.maxUses) return { state: "ended", label: "Used up" };
  if (d.validUntil && now > endOfDay(d.validUntil)) return { state: "ended", label: `Ended ${short(d.validUntil)}` };
  if (d.validFrom && now < new Date(d.validFrom)) return { state: "upcoming", label: `Starts ${short(d.validFrom)}` };
  return { state: "active", label: "Active" };
}

function endOfDay(s: string): Date {
  const d = new Date(s);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) d.setHours(23, 59, 59, 999);
  return d;
}

function amountText(d: Pick<Discount, "discount_percent" | "discount_fixed">): string {
  return d.discount_fixed ? `RM ${d.discount_fixed} off` : `${d.discount_percent || 0}% off`;
}

function scopeText(d: Discount, items: Pick<GearItem, "id" | "name">[]): string {
  if (d.appliesTo?.type === "specific") {
    const ids = d.appliesTo.itemIds || [];
    if (ids.length === 1) return items.find(i => i.id === ids[0])?.name || "1 item";
    return `${ids.length} items`;
  }
  return "all items";
}

export function discountTitle(d: Discount): string {
  switch (d.type) {
    case "promo_code": return `Promo code ${d.code || ""}`.trim();
    case "nightly_discount": return "Longer stays";
    case "min_spend": return "Spend reward";
    case "quantity_bundle": return "Bundle";
    case "free_item": return "Free gift";
    default: return "Discount";
  }
}

/** One sentence in the customer's terms, e.g. "Book 3 or more nights, get 15% off all items". */
export function describeDiscount(d: Discount, items: Pick<GearItem, "id" | "name">[]): string {
  switch (d.type) {
    case "promo_code":
      return `${amountText(d)} ${scopeText(d, items)} with code ${d.code || "…"}`;
    case "nightly_discount":
      return `Book ${d.trigger_nights || "…"} or more nights, get ${amountText(d)} ${scopeText(d, items)}`;
    case "min_spend":
      return `Spend RM ${d.min_spend || "…"} or more, get ${amountText(d)}`;
    case "quantity_bundle":
      return `Take ${d.min_qty || "…"} or more ${d.bundle_category ? `${d.bundle_category.toLowerCase()} items` : "items"}, get ${amountText(d)} ${scopeText(d, items)}`;
    case "free_item": {
      const what = `${d.freeItemQty || 1} × ${items.find(i => i.id === d.freeItemId)?.name || "an item"} free`;
      switch (d.free_trigger) {
        case "min_nights": return `Book ${d.free_trigger_nights || "…"} or more nights, get ${what}`;
        case "min_spend": return `Spend RM ${d.free_trigger_spend || "…"} or more, get ${what}`;
        case "min_qty": return `Take ${d.free_trigger_qty || "…"} or more ${d.free_trigger_category ? `${d.free_trigger_category.toLowerCase()} items` : "items"}, get ${what}`;
        default: return `Every booking gets ${what}`;
      }
    }
    default: return "";
  }
}

export function discountMeta(d: Discount): string {
  const parts: string[] = [];
  const used = d.usedCount ?? 0;
  parts.push(d.maxUses != null ? `Used ${used} of ${d.maxUses}` : `Used ${used} time${used === 1 ? "" : "s"}`);
  if (d.validUntil) parts.push(`until ${new Date(d.validUntil).toLocaleDateString("en-MY", { day: "numeric", month: "short" })}`);
  else parts.push("no end date");
  if (d.type === "promo_code") parts.push(d.is_public === false ? "code kept private" : "shown on shop");
  else if (d.type !== "free_item") parts.push("applied automatically");
  return parts.join(" · ");
}

export function limitsSummary(d: Pick<Discount, "validFrom" | "validUntil" | "maxUses" | "is_public" | "type">): string {
  const short = (s: string) => new Date(s).toLocaleDateString("en-MY", { day: "numeric", month: "short" });
  const when = d.validFrom && d.validUntil ? `${short(d.validFrom)} to ${short(d.validUntil)}`
    : d.validUntil ? `until ${short(d.validUntil)}`
    : d.validFrom ? `from ${short(d.validFrom)}`
    : "No end date";
  const uses = d.maxUses ? `${d.maxUses} uses` : "unlimited uses";
  const shown = d.type === "free_item" ? "" : d.is_public === false ? " · not shown on shop" : " · shown on shop";
  return `${when} · ${uses}${shown}`;
}

/** Field problems that block saving a discount. Empty when valid. */
export function discountErrors(d: Partial<Discount> & { type: string }, existingCodes: string[] = []): string[] {
  const errs: string[] = [];
  const hasAmount = (d.discount_percent || 0) > 0 || (d.discount_fixed || 0) > 0;
  if ((d.discount_percent || 0) > 100) errs.push("Percent cannot be more than 100");
  switch (d.type) {
    case "promo_code":
      if (!d.code?.trim()) errs.push("Enter a code");
      else if (!/^[A-Z0-9_-]{3,20}$/.test(d.code)) errs.push("Code must be 3 to 20 letters or numbers");
      else if (existingCodes.includes(d.code)) errs.push("You already have this code");
      if (!hasAmount) errs.push("Enter the discount amount");
      break;
    case "nightly_discount":
      if (!d.trigger_nights || d.trigger_nights < 2) errs.push("Nights must be 2 or more");
      if (!hasAmount) errs.push("Enter the discount amount");
      break;
    case "min_spend":
      if (!d.min_spend || d.min_spend <= 0) errs.push("Enter the minimum spend");
      if (!hasAmount) errs.push("Enter the discount amount");
      break;
    case "quantity_bundle":
      if (!d.min_qty || d.min_qty < 2) errs.push("Items must be 2 or more");
      if (!hasAmount) errs.push("Enter the discount amount");
      break;
    case "free_item":
      if (!d.freeItemId) errs.push("Choose the free item");
      if (d.free_trigger === "min_nights" && !d.free_trigger_nights) errs.push("Enter the number of nights");
      if (d.free_trigger === "min_spend" && !d.free_trigger_spend) errs.push("Enter the minimum spend");
      if (d.free_trigger === "min_qty" && !d.free_trigger_qty) errs.push("Enter the number of items");
      break;
  }
  if (d.appliesTo?.type === "specific" && !(d.appliesTo.itemIds?.length)) errs.push("Choose at least one item");
  if (d.validFrom && d.validUntil && d.validFrom > d.validUntil) errs.push("End date is before the start date");
  return errs;
}
