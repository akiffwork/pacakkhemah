import { Metadata } from "next";

const PROJECT_ID = "kuantan-unplugged";
const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!;
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const SITE = "https://pacakkhemah.com";
const DEFAULT_IMG = `${SITE}/pacak-khemah.png`;

// ─────────────────────────────────────────────────────────────────────────────
// Firestore REST helpers
// ─────────────────────────────────────────────────────────────────────────────

export function fsStr(doc: any, field: string): string {
  return doc?.fields?.[field]?.stringValue || "";
}

function fsNum(field: any): number {
  if (!field) return 0;
  return Number(field.integerValue ?? field.doubleValue ?? 0);
}

export function parseFirestoreValue(val: any): any {
  if (val == null) return null;
  if (val.stringValue !== undefined) return val.stringValue;
  if (val.integerValue !== undefined) return Number(val.integerValue);
  if (val.doubleValue !== undefined) return val.doubleValue;
  if (val.booleanValue !== undefined) return val.booleanValue;
  if (val.nullValue !== undefined) return null;
  if (val.timestampValue !== undefined) return val.timestampValue;
  if (val.arrayValue !== undefined) return (val.arrayValue.values || []).map(parseFirestoreValue);
  if (val.mapValue !== undefined) {
    const obj: any = {};
    for (const [k, v] of Object.entries<any>(val.mapValue.fields || {})) obj[k] = parseFirestoreValue(v);
    return obj;
  }
  return null;
}

export function parseFirestoreDoc(doc: any): any {
  if (!doc?.fields) return {};
  const out: any = {};
  for (const [key, val] of Object.entries<any>(doc.fields)) out[key] = parseFirestoreValue(val);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Vendor + gear fetchers
// ─────────────────────────────────────────────────────────────────────────────

export async function getVendorData(slugOrId: string) {
  try {
    const queryRes = await fetch(`${FIRESTORE_BASE}:runQuery?key=${FIREBASE_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "vendors" }],
          where: { fieldFilter: { field: { fieldPath: "slug" }, op: "EQUAL", value: { stringValue: slugOrId } } },
          limit: 1,
        },
      }),
      next: { revalidate: 300 },
    });
    const queryData = await queryRes.json();
    if (queryData?.[0]?.document) {
      const doc = queryData[0].document;
      return { id: doc.name.split("/").pop(), doc };
    }
    const directRes = await fetch(`${FIRESTORE_BASE}/vendors/${encodeURIComponent(slugOrId)}?key=${FIREBASE_API_KEY}`, {
      next: { revalidate: 300 },
    });
    if (directRes.ok) {
      const doc = await directRes.json();
      return { id: slugOrId, doc };
    }
  } catch (e) {
    console.error("Vendor fetch error:", e);
  }
  return null;
}

export async function getGearItem(itemId: string, vendorId?: string) {
  // Attempt 1: Direct doc fetch (works when itemId is the Firestore document ID)
  try {
    const res = await fetch(`${FIRESTORE_BASE}/gear/${encodeURIComponent(itemId)}?key=${FIREBASE_API_KEY}`, {
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const doc = await res.json();
      if (doc?.fields) return doc;
    }
  } catch (e) {
    console.error("Gear fetch error:", e);
  }

  // Attempt 2: Query by name + vendorId (handles items whose doc ID changed after recreate)
  if (vendorId) {
    try {
      const queryRes = await fetch(`${FIRESTORE_BASE}:runQuery?key=${FIREBASE_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: "gear" }],
            where: {
              compositeFilter: {
                op: "AND",
                filters: [
                  { fieldFilter: { field: { fieldPath: "vendorId" }, op: "EQUAL", value: { stringValue: vendorId } } },
                  { fieldFilter: { field: { fieldPath: "name" }, op: "EQUAL", value: { stringValue: itemId } } },
                ],
              },
            },
            limit: 1,
          },
        }),
        next: { revalidate: 60 },
      });
      if (queryRes.ok) {
        const qData = await queryRes.json();
        if (qData?.[0]?.document?.fields) return qData[0].document;
      }
    } catch (e) {
      console.error("Gear query error:", e);
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Price label — handles pricing tiers
// ─────────────────────────────────────────────────────────────────────────────

function getMinTierPrice(gear: any): number | null {
  const tiers = gear?.fields?.pricingTiers?.arrayValue?.values;
  if (!Array.isArray(tiers) || !tiers.length) return null;
  const prices = tiers
    .map((t: any) => fsNum(t?.mapValue?.fields?.price))
    .filter((p: number) => p > 0);
  return prices.length ? Math.min(...prices) : null;
}

function getPriceLabel(gear: any): { label: string; minPrice: number } {
  const minTier = getMinTierPrice(gear);
  const base = fsNum(gear?.fields?.price);
  if (minTier != null && (base === 0 || minTier < base)) {
    return { label: `From RM${minTier}`, minPrice: minTier };
  }
  return { label: `RM${base}/night`, minPrice: base };
}

// ─────────────────────────────────────────────────────────────────────────────
// Metadata builders
// ─────────────────────────────────────────────────────────────────────────────

export function buildItemMetadata({
  itemId,
  vendor,
  gear,
}: {
  itemId: string;
  vendor: { id: string; doc: any } | null;
  gear: any | null;
}): Metadata {
  const vendorName = vendor ? fsStr(vendor.doc, "name") || "Vendor" : "Vendor";
  const vendorImage = vendor ? fsStr(vendor.doc, "image") || DEFAULT_IMG : DEFAULT_IMG;
  const vendorCity = vendor ? fsStr(vendor.doc, "city") || "" : "";

  if (!gear) {
    return buildVendorMetadata(vendor);
  }

  const itemName = fsStr(gear, "name") || "Camping Gear";
  const itemDesc = (fsStr(gear, "desc") || fsStr(gear, "description") || "").trim();
  const { label: priceLabel } = getPriceLabel(gear);

  const hasImg = !!(
    gear?.fields?.images?.arrayValue?.values?.[0]?.stringValue ||
    gear?.fields?.img?.stringValue
  );
  // Path-based proxy URL — no query params so no crawler stripping risk
  const itemImg = hasImg
    ? `${SITE}/api/gear-og/${encodeURIComponent(itemId)}`
    : vendorImage;

  const title = `${itemName} — ${priceLabel} | ${vendorName}`;
  const briefDesc = itemDesc.length > 100 ? itemDesc.slice(0, 97) + "..." : itemDesc;
  const locationPart = vendorCity ? ` di ${vendorCity}` : "";
  const description = briefDesc
    ? `${briefDesc} · Sewa dari ${vendorName}${locationPart}. Tempah sekarang di Pacak Khemah.`
    : `Sewa ${itemName} dari ${vendorName}${locationPart} mulai ${priceLabel}. Tempah sekarang di Pacak Khemah — platform sewa peralatan camping Malaysia.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: itemImg, width: 1200, height: 1200, alt: itemName, type: "image/jpeg" }],
      type: "website",
      siteName: "Pacak Khemah",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [itemImg],
    },
  };
}

export function buildVendorMetadata(vendor: { id: string; doc: any } | null): Metadata {
  if (!vendor) {
    return {
      title: "Shop — Pacak Khemah",
      description: "Sewa peralatan camping di Malaysia",
    };
  }
  const vendorName = fsStr(vendor.doc, "name") || "Vendor";
  const vendorImage = fsStr(vendor.doc, "image") || DEFAULT_IMG;
  const vendorCity = fsStr(vendor.doc, "city") || "";
  const vendorTagline = fsStr(vendor.doc, "tagline") || "";

  const title = `${vendorName} — Sewa Peralatan Camping | Pacak Khemah`;
  const description =
    vendorTagline ||
    `Sewa peralatan camping dari ${vendorName}${vendorCity ? ` di ${vendorCity}` : ""}. Pacak Khemah — platform sewa peralatan camping Malaysia.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: vendorImage, width: 1200, height: 1200, alt: vendorName, type: "image/jpeg" }],
      type: "website",
      siteName: "Pacak Khemah",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [vendorImage],
    },
  };
}
