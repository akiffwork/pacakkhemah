import { Metadata } from "next";
import ShopClient from "./ShopClient";

const PROJECT_ID = "kuantan-unplugged";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Helper: extract string field from Firestore REST response
function str(doc: any, field: string): string {
  return doc?.fields?.[field]?.stringValue || "";
}

// Fetch vendor by slug (query) or by ID (direct get)
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
    console.error("Metadata vendor fetch error:", e);
  }
  return null;
}

// Fetch gear item by ID
async function getGearItem(itemId: string) {
  try {
    const res = await fetch(`${FIRESTORE_BASE}/gear/${itemId}`, {
      next: { revalidate: 300 },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.error("Metadata gear fetch error:", e);
  }
  return null;
}

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

  // Item-specific metadata
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
      const description = itemDesc || `Sewa ${itemName} dari ${vendorName}${vendorCity ? ` di ${vendorCity}` : ""}. Pacak Khemah — platform sewa peralatan camping.`;

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

  // Vendor-level metadata (no specific item)
  const title = `${vendorName} — Sewa Peralatan Camping | Pacak Khemah`;
  const description = vendorTagline || `Sewa peralatan camping dari ${vendorName}${vendorCity ? ` di ${vendorCity}` : ""}. Pacak Khemah — platform sewa peralatan camping Malaysia.`;

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

export default function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  return <ShopClient params={params} />;
}