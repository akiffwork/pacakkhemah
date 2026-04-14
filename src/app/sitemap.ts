import { MetadataRoute } from "next";

const SITE = "https://pacakkhemah.com";
const PROJECT_ID = "kuantan-unplugged";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function getVendorSlugs(): Promise<{ slug: string; updatedAt?: string }[]> {
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
          select: {
            fields: [
              { fieldPath: "slug" },
              { fieldPath: "name" },
            ],
          },
        },
      }),
      next: { revalidate: 3600 }, // Rebuild every hour
    });

    const data = await res.json();
    return (data || [])
      .filter((d: any) => d.document)
      .map((d: any) => {
        const slug = d.document.fields?.slug?.stringValue;
        const id = d.document.name.split("/").pop();
        return { slug: slug || id };
      })
      .filter((v: any) => v.slug);
  } catch (e) {
    console.error("Sitemap vendor fetch error:", e);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const vendors = await getVendorSlugs();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE}/directory`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE}/store`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE}/register-vendor`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  // Dynamic vendor shop pages
  const vendorPages: MetadataRoute.Sitemap = vendors.map((v) => ({
    url: `${SITE}/shop/${v.slug}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...vendorPages];
}