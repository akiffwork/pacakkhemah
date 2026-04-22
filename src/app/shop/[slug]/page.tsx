import { Metadata } from "next";
import ShopClient from "./ShopClient";

const PROJECT_ID = "kuantan-unplugged";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ─────────────────────────────────────────────────────────────────────────────
// Firestore REST helpers
// ─────────────────────────────────────────────────────────────────────────────

function str(doc: any, field: string): string {
  return doc?.fields?.[field]?.stringValue || "";
}

// Convert a Firestore REST document into a plain JS object.
// Handles the common types we use in vendor docs.
function parseFirestoreDoc(doc: any): any {
  if (!doc?.fields) return {};
  const out: any = {};
  for (const [key, val] of Object.entries<any>(doc.fields)) {
    out[key] = parseFirestoreValue(val);
  }
  return out;
}

function parseFirestoreValue(val: any): any {
  if (val == null) return null;
  if (val.stringValue !== undefined) return val.stringValue;
  if (val.integerValue !== undefined) return Number(val.integerValue);
  if (val.doubleValue !== undefined) return val.doubleValue;
  if (val.booleanValue !== undefined) return val.booleanValue;
  if (val.nullValue !== undefined) return null;
  if (val.timestampValue !== undefined) return val.timestampValue;
  if (val.arrayValue !== undefined) {
    return (val.arrayValue.values || []).map(parseFirestoreValue);
  }
  if (val.mapValue !== undefined) {
    const obj: any = {};
    for (const [k, v] of Object.entries<any>(val.mapValue.fields || {})) {
      obj[k] = parseFirestoreValue(v);
    }
    return obj;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Vendor + gear fetchers (shared between metadata and initial render)
// ─────────────────────────────────────────────────────────────────────────────

async function getVendorData(slugOrId: string) {
  try {
    // 1. Try slug query
    const queryRes = await fetch(`${FIRESTORE_BASE}:runQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "vendors" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "slug" },
              op: "EQUAL",
              value: { stringValue: slugOrId },
            },
          },
          limit: 1,
        },
      }),
      next: { revalidate: 300 }, // Cache 5 min
    });

    const queryData = await queryRes.json();
    if (queryData?.[0]?.document) {
      const doc = queryData[0].document;
      const id = doc.name.split("/").pop();
      return { id, doc };
    }

    // 2. Fallback: try as direct vendor ID
    const directRes = await fetch(`${FIRESTORE_BASE}/vendors/${slugOrId}`, {
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

async function getGearItem(itemId: string) {
  try {
    const res = await fetch(`${FIRESTORE_BASE}/gear/${itemId}`, {
      next: { revalidate: 300 },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.error("Gear fetch error:", e);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Metadata (unchanged behavior)
// ─────────────────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { item: itemId } = await searchParams;

  const vendor = await getVendorData(slug);
  if (!vendor) {
    return {
      title: "Shop — Pacak Khemah",
      description: "Sewa peralatan camping di Malaysia",
    };
  }

  const vendorName = str(vendor.doc, "name") || "Vendor";
  const vendorImage = str(vendor.doc, "image") || "https://pacakkhemah.com/pacak-khemah.png";
  const vendorCity = str(vendor.doc, "city") || "";
  const vendorTagline = str(vendor.doc, "tagline") || "";

  if (itemId) {
    const gear = await getGearItem(itemId);
    if (gear) {
      const itemName = str(gear, "name") || "Camping Gear";
      const itemPrice = gear?.fields?.price?.integerValue || gear?.fields?.price?.doubleValue || "";
      const itemDesc = str(gear, "desc") || "";
      const itemImg =
        gear?.fields?.images?.arrayValue?.values?.[0]?.stringValue ||
        str(gear, "img") ||
        vendorImage;

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
  }

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
      images: [{ url: vendorImage, width: 800, height: 800, alt: vendorName }],
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

// ─────────────────────────────────────────────────────────────────────────────
// Page — fetches vendor on the server and seeds ShopClient
// ─────────────────────────────────────────────────────────────────────────────

export default async function ShopPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const vendor = await getVendorData(slug);

  // If we can't find a vendor server-side, let ShopClient handle the redirect
  // to /directory (its existing behavior). We just don't pass initial data.
  const initialVendor = vendor ? parseFirestoreDoc(vendor.doc) : null;
  const initialVendorId = vendor?.id || null;

  return (
    <ShopClient
      params={params}
      initialVendor={initialVendor}
      initialVendorId={initialVendorId}
    />
  );
}