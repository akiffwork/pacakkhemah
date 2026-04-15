import { MetadataRoute } from "next";

const SITE = "https://pacakkhemah.com";
const PROJECT_ID = "kuantan-unplugged";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function getVendorSlugs(): Promise<string[]> {
  try {
    const res = await fetch(`${FIRESTORE_BASE}:runQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "vendors" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "status" },
              op: "EQUAL",
              value: { stringValue: "approved" },
            },
          },
          select: { fields: [{ fieldPath: "slug" }] },
        },
      }),
      cache: "no-store",
    });

    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data
      .filter((d: any) => d.document?.fields?.slug?.stringValue)
      .map((d: any) => d.document.fields.slug.stringValue);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await getVendorSlugs();

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE}/directory`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE}/campsites`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/faq`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/register-vendor`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
  ];

  const vendorPages: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: `${SITE}/shop/${slug}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...vendorPages];
}