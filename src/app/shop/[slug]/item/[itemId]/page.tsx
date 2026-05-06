import { Metadata } from "next";
import ShopClient from "../../ShopClient";

const PROJECT_ID = "kuantan-unplugged";
const FIREBASE_API_KEY = "AIzaSyAijpbwzFTDctk38Ktkcbt1Hd4y-1Cd1Xw";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function str(doc: any, field: string): string {
  return doc?.fields?.[field]?.stringValue || "";
}

function parseFirestoreValue(val: any): any {
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

function parseFirestoreDoc(doc: any): any {
  if (!doc?.fields) return {};
  const out: any = {};
  for (const [key, val] of Object.entries<any>(doc.fields)) out[key] = parseFirestoreValue(val);
  return out;
}

async function getVendorData(slug: string) {
  try {
    const queryRes = await fetch(`${FIRESTORE_BASE}:runQuery?key=${FIREBASE_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "vendors" }],
          where: { fieldFilter: { field: { fieldPath: "slug" }, op: "EQUAL", value: { stringValue: slug } } },
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
    const directRes = await fetch(`${FIRESTORE_BASE}/vendors/${encodeURIComponent(slug)}?key=${FIREBASE_API_KEY}`, {
      next: { revalidate: 300 },
    });
    if (directRes.ok) {
      const doc = await directRes.json();
      return { id: slug, doc };
    }
  } catch (e) {
    console.error("Vendor fetch error:", e);
  }
  return null;
}

async function getGearItem(itemId: string) {
  try {
    const res = await fetch(`${FIRESTORE_BASE}/gear/${encodeURIComponent(itemId)}?key=${FIREBASE_API_KEY}`, {
      next: { revalidate: 60 },
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error("Gear fetch error:", e);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Metadata — item-specific OG tags served from a clean path URL (no ?item=)
// ─────────────────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; itemId: string }>;
}): Promise<Metadata> {
  const { slug, itemId } = await params;

  const [vendor, gear] = await Promise.all([getVendorData(slug), getGearItem(itemId)]);

  const vendorName = vendor ? str(vendor.doc, "name") || "Vendor" : "Vendor";
  const vendorImage = vendor ? str(vendor.doc, "image") || "https://pacakkhemah.com/pacak-khemah.png" : "https://pacakkhemah.com/pacak-khemah.png";
  const vendorCity = vendor ? str(vendor.doc, "city") || "" : "";

  if (gear) {
    const itemName = str(gear, "name") || "Camping Gear";
    const itemPrice = gear?.fields?.price?.integerValue || gear?.fields?.price?.doubleValue || "";
    const itemDesc = str(gear, "desc") || str(gear, "description") || "";

    const hasImg = !!(
      gear?.fields?.images?.arrayValue?.values?.[0]?.stringValue ||
      gear?.fields?.img?.stringValue
    );
    // Path-based proxy URL — no query params so no crawler stripping risk
    const itemImg = hasImg
      ? `https://pacakkhemah.com/api/gear-og/${encodeURIComponent(itemId)}`
      : vendorImage;

    const title = `${itemName} — RM${itemPrice}/night | ${vendorName}`;
    const description =
      itemDesc ||
      `Sewa ${itemName} dari ${vendorName}${vendorCity ? ` di ${vendorCity}` : ""}. Pacak Khemah — platform sewa peralatan camping.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        images: [{ url: itemImg, width: 800, height: 800, alt: itemName }],
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

  const title = `${vendorName} — Sewa Peralatan Camping | Pacak Khemah`;
  const description = `Sewa peralatan camping dari ${vendorName}${vendorCity ? ` di ${vendorCity}` : ""}. Pacak Khemah — platform sewa peralatan camping Malaysia.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: vendorImage, width: 800, height: 800, alt: vendorName }],
      type: "website",
      siteName: "Pacak Khemah",
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Page — renders the same ShopClient but pre-opens the specific item
// ─────────────────────────────────────────────────────────────────────────────

export default async function ItemPage({
  params,
}: {
  params: Promise<{ slug: string; itemId: string }>;
}) {
  const { slug, itemId } = await params;
  const vendor = await getVendorData(slug);
  const initialVendor = vendor ? parseFirestoreDoc(vendor.doc) : null;
  const initialVendorId = vendor?.id || null;

  // Re-wrap params as a Promise<{slug}> for ShopClient (it only needs slug)
  const slugParams = Promise.resolve({ slug });

  return (
    <ShopClient
      params={slugParams}
      initialVendor={initialVendor}
      initialVendorId={initialVendorId}
      initialItemId={itemId}
    />
  );
}
