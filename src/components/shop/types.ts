// Shared shop types — imported by ShopClient and shop subcomponents.
// These are verbatim copies of the definitions in ShopClient.tsx.
// VendorData stays in ShopClient because it depends on Badge (imported
// from Badges.tsx) and is only read at the page level.

export type DeliveryZone = { name: string; fee: number };
export type TimeSlot = { time: string; label: string };

export type ServicesConfig = {
  delivery: {
    enabled: boolean;
    pricingType: "fixed" | "per_km" | "zones" | "quote";
    fixedFee: number;
    perKmRate: number;
    minFee: number;
    zones: DeliveryZone[];
    freeAbove: number;
    notes: string;
  };
  setup: {
    enabled: boolean;
    fee: number;
    description: string;
  };
  combo: {
    enabled: boolean;
    fee: number;
  };
  timeSlots: {
    enabled: boolean;
    slots: TimeSlot[];
  };
};

export type GearVariant = {
  id: string;
  color?: { label: string; hex: string };
  size?: string;
  price: number;
  stock: number;
};

export type GearItem = {
  id: string; name: string; price: number; img?: string;
  images?: string[];
  desc?: string; category?: string; type?: string;
  stock?: number; inc?: string[];
  linkedItems?: { itemId: string; qty: number; variantId?: string; variantLabel?: string; variantColor?: string }[];
  deleted?: boolean;
  hasVariants?: boolean;
  variants?: GearVariant[];
  setup?: {
    available: boolean;
    fee: number;
    description: string;
  };
  specs?: {
    size?: string;
    maxPax?: number;
    puRating?: string;
    layers?: string;
    weight?: string;
    tentType?: string;
  };
  pickupLocation?: string;
};

export type LinkedVariantSelection = { itemId: string; variantId: string; variantLabel: string; variantColor?: string };
export type CartItem = GearItem & { qty: number; addSetup?: boolean; selectedVariant?: GearVariant; linkedVariants?: LinkedVariantSelection[] };
export type AvailRule = { itemId?: string; variantId?: string; type?: string; start: string; end?: string; qty?: number };
export type Discount = { type: string; trigger_nights?: number; discount_percent: number; discount_fixed?: number; code?: string; deleted?: boolean; is_public?: boolean; appliesTo?: { type: "all" | "specific"; itemIds?: string[] } };
export type VendorPost = { id: string; content: string; image?: string; pinned?: boolean; createdAt: any };
export type Review = { id: string; customerName: string; rating: number; comment?: string | null; createdAt: any; isVerified?: boolean };

export type FulfillmentType = "pickup" | "delivery";

// Shape returned by getLinkedItemsData(item) — used by ItemDetailModal
export type LinkedItemData = {
  item: GearItem;
  qty: number;
  lockedVariantId?: string;
  lockedVariantLabel?: string;
  lockedVariantColor?: string;
};