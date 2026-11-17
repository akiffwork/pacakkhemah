// src/lib/vendorSettings.ts
// Pure helpers for the vendor Settings tab: the vendor document shape the
// tab edits, defaults, the shop-setup checklist and the one-line summaries
// shown on folded sections.

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
  setup: { enabled: boolean; fee: number; description: string };
  combo: { enabled: boolean; fee: number };
  timeSlots: { enabled: boolean; slots: TimeSlot[] };
};

export type LoyaltyTier = { id: string; minBookings: number; discount: number; label: string };
export type LoyaltyConfig = {
  enabled: boolean;
  tiers: LoyaltyTier[];
  appliesTo?: { type: "all" | "specific"; itemIds?: string[] };
};

export type TaxProfile = {
  tin?: string; legalName?: string; brn?: string; address?: string;
  msicCode?: string; msicActivity?: string; sstNo?: string;
};

export type RentStep = { title: string; my: string; desc?: string; desc_my?: string };

export type VendorSettings = {
  name?: string; phone?: string; slug?: string; image?: string;
  tagline?: string; tagline_my?: string;
  ig?: string; tiktok?: string; fb?: string; threads?: string;
  show_nav?: boolean;
  steps?: RentStep[];
  city?: string; areas?: string[]; pickup?: string[];
  locationUrl?: string | null;
  security_deposit?: number; security_deposit_type?: string;
  is_vacation?: boolean; allow_stacking?: boolean; rules?: string[];
  services?: ServicesConfig;
  loyalty?: LoyaltyConfig;
  taxProfile?: TaxProfile;
  fcmToken?: string;
  nearbyCampsites?: { id: string; km: number }[];
  nearbyCampsiteIds?: string[];
  locationLat?: number | null;
  locationLng?: number | null;
  gear_count?: number;
  credits?: number;
};

export const DEFAULT_SERVICES: ServicesConfig = {
  delivery: { enabled: false, pricingType: "fixed", fixedFee: 50, perKmRate: 2, minFee: 20, zones: [], freeAbove: 0, notes: "" },
  setup: { enabled: false, fee: 80, description: "Full tent setup at your campsite" },
  combo: { enabled: false, fee: 100 },
  timeSlots: {
    enabled: false,
    slots: [
      { time: "9:00 AM - 12:00 PM", label: "Morning" },
      { time: "2:00 PM - 5:00 PM", label: "Afternoon" },
      { time: "5:00 PM - 8:00 PM", label: "Evening" },
    ],
  },
};

export const DEFAULT_LOYALTY_TIERS: LoyaltyTier[] = [
  { id: "bronze", minBookings: 2, discount: 5, label: "Bronze" },
  { id: "silver", minBookings: 5, discount: 10, label: "Silver" },
  { id: "gold", minBookings: 10, discount: 15, label: "Gold" },
];

export const DEFAULT_STEPS: Required<RentStep>[] = [
  { title: "Select Dates", my: "Pilih Tarikh", desc: "Choose pickup and return dates", desc_my: "Pilih tarikh ambil dan pulang" },
  { title: "Pick Gear", my: "Pilih Barang", desc: "Add items to your cart", desc_my: "Tambah barang ke troli" },
  { title: "WhatsApp Us", my: "Hubungi Kami", desc: "Send order to confirm", desc_my: "Hantar pesanan untuk sahkan" },
];

export const DEFAULT_RULES = [
  "Deposit is refunded after gear is returned in good condition",
  "Late returns are charged one extra day per day late",
  "Damaged or missing items are deducted from the deposit",
  "Please return all gear clean and dry",
];

/** Merge saved services with defaults so every field exists. */
export function withServiceDefaults(s?: Partial<ServicesConfig> | null): ServicesConfig {
  return {
    delivery: { ...DEFAULT_SERVICES.delivery, ...(s?.delivery || {}) },
    setup: { ...DEFAULT_SERVICES.setup, ...(s?.setup || {}) },
    combo: { ...DEFAULT_SERVICES.combo, ...(s?.combo || {}) },
    timeSlots: { ...DEFAULT_SERVICES.timeSlots, ...(s?.timeSlots || {}) },
  };
}

/** Lat/lng from a Google Maps link, or null. */
export function extractCoords(url: string): { lat: number; lng: number } | null {
  const q = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (q) return { lat: +q[1], lng: +q[2] };
  const at = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (at) return { lat: +at[1], lng: +at[2] };
  const ll = url.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (ll) return { lat: +ll[1], lng: +ll[2] };
  return null;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function cleanSlug(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

/** Split "a, b ,c" style text into a clean list. */
export function splitList(text: string): string[] {
  return text.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
}

export function taxProfileComplete(tp?: TaxProfile | null): boolean {
  return !!(tp?.tin?.trim() && tp?.legalName?.trim() && tp?.address?.trim());
}

// ── Shop-setup checklist ──────────────────────────────────────────────────

export type SetupGroup = "storefront" | "rules" | "account";
export type SetupItem = { key: string; label: string; done: boolean; group: SetupGroup; section: string };

export function setupChecklist(v: VendorSettings): SetupItem[] {
  return [
    { key: "phone", label: "Add your WhatsApp number", done: !!v.phone?.trim(), group: "account", section: "contact" },
    { key: "logo", label: "Upload your shop logo", done: !!v.image, group: "storefront", section: "identity" },
    { key: "about", label: "Write your About text", done: !!(v.tagline?.trim() || v.tagline_my?.trim()), group: "storefront", section: "about" },
    { key: "pickup", label: "Add a pickup point", done: (v.pickup?.length || 0) > 0, group: "rules", section: "location" },
    { key: "pin", label: "Add your pickup map pin", done: !!v.locationUrl, group: "rules", section: "location" },
    { key: "deposit", label: "Set your security deposit", done: typeof v.security_deposit === "number", group: "rules", section: "deposit" },
    { key: "gear", label: "Add your first item in Inventory", done: (v.gear_count || 0) > 0, group: "storefront", section: "inventory" },
  ];
}

// ── Folded-section summaries ──────────────────────────────────────────────

export function socialSummary(v: VendorSettings): string {
  const set = [v.ig && "Instagram", v.tiktok && "TikTok", v.fb && "Facebook", v.threads && "Threads"].filter(Boolean) as string[];
  return set.length ? `${set.join(", ")} · ${set.length} of 4 set` : "None added yet";
}

export function stepsSummary(v: VendorSettings): string {
  const n = v.steps?.length || 0;
  return n ? `${n} step${n === 1 ? "" : "s"}` : `Using the default ${DEFAULT_STEPS.length} steps`;
}

export function locationSummary(v: VendorSettings): string {
  const parts: string[] = [];
  if (v.city) parts.push(v.city);
  const p = v.pickup?.length || 0;
  parts.push(p ? `${p} pickup point${p === 1 ? "" : "s"}` : "no pickup point");
  if (v.areas?.length) parts.push(`covers ${v.areas.slice(0, 2).join(", ")}${v.areas.length > 2 ? ` +${v.areas.length - 2}` : ""}`);
  if (!v.locationUrl) parts.push("map pin not set");
  return parts.join(" · ");
}

export function depositSummary(v: VendorSettings): string {
  const amt = v.security_deposit ?? 50;
  if (amt === 0) return "No deposit";
  return v.security_deposit_type === "percent" ? `${amt}% of the rental` : `RM ${amt} per booking`;
}

export function rulesSummary(v: VendorSettings): string {
  const n = v.rules?.filter(Boolean).length || 0;
  return n ? `${n} rule${n === 1 ? "" : "s"} shown to customers` : "None yet";
}

export function deliverySummary(s: ServicesConfig): string {
  const d = s.delivery;
  if (!d.enabled) return "Off · pickup only";
  const how = d.pricingType === "fixed" ? `RM ${d.fixedFee} fixed`
    : d.pricingType === "per_km" ? `RM ${d.perKmRate} per km, min RM ${d.minFee}`
    : d.pricingType === "zones" ? `${d.zones.length} zone${d.zones.length === 1 ? "" : "s"}`
    : "quoted on WhatsApp";
  return `On · ${how}${d.freeAbove > 0 ? ` · free above RM ${d.freeAbove}` : ""}`;
}

export function setupSummary(s: ServicesConfig): string {
  return s.setup.enabled ? `On · RM ${s.setup.fee} per tent` : "Off";
}

export function comboSummary(s: ServicesConfig): string {
  if (!s.delivery.enabled || !s.setup.enabled) return "Needs delivery and setup on";
  return s.combo.enabled ? `On · RM ${s.combo.fee} for both` : "Off";
}

export function timeSlotsSummary(s: ServicesConfig): string {
  if (!s.delivery.enabled) return "Needs delivery on";
  return s.timeSlots.enabled ? `On · ${s.timeSlots.slots.map(x => x.label).filter(Boolean).join(", ")}` : "Off · customers pick any time";
}

export function stackingSummary(v: VendorSettings): string {
  return v.allow_stacking ? "On · offers combine" : "Off · customers get the best single offer";
}

export function loyaltySummary(l?: LoyaltyConfig | null): string {
  if (!l?.enabled) return "Off";
  const first = [...(l.tiers || [])].sort((a, b) => a.minBookings - b.minBookings)[0];
  const scope = l.appliesTo?.type === "specific" ? ` on ${l.appliesTo.itemIds?.length || 0} item${(l.appliesTo.itemIds?.length || 0) === 1 ? "" : "s"}` : "";
  return first ? `On · ${first.discount}% off from booking ${first.minBookings}${scope}` : "On";
}

export function invoiceSummary(tp?: TaxProfile | null): string {
  return taxProfileComplete(tp) ? `${tp!.legalName} · TIN ${tp!.tin}` : "Not set up · needed before you can issue invoices";
}
