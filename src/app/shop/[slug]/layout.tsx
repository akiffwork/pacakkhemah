import type { Metadata } from "next";
import { queryCollection, getDocument } from "@/lib/firestore-rest";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  // Default metadata (fallback if vendor not found)
  const fallback: Metadata = {
    title: "Kedai Sewa Gear Camping",
    description:
      "Lihat & tempah peralatan camping dari vendor dipercayai. Pilih tarikh, tambah ke cart & tempah melalui WhatsApp.",
    openGraph: {
      title: "Kedai Sewa Gear Camping | Pacak Khemah",
      description:
        "Lihat & tempah peralatan camping dari vendor dipercayai.",
      images: [{ url: "/pacak-khemah.png", width: 512, height: 512, alt: "Pacak Khemah" }],
    },
  };

  if (!slug || slug === "_") return fallback;

  try {
    // 1. Try lookup by slug first
    let vendorData: Record<string, unknown> | null = null;

    const bySlug = await queryCollection("vendors", "slug", slug);
    if (bySlug) {
      vendorData = bySlug.data;
    } else {
      // 2. Fallback: treat slug as vendor ID
      vendorData = await getDocument(`vendors/${slug}`);
    }

    if (!vendorData) return fallback;

    const name = (vendorData.name as string) || "Vendor";
    const tagline = (vendorData.tagline as string) || "";
    const image = (vendorData.image as string) || "";
    const city = (vendorData.city as string) || "";

    // Build dynamic title & description
    const title = `${name} — Pacak Khemah Partner for Camping Gear Rental`;
    const description = tagline
      ? `${tagline}. Tempah peralatan camping dari ${name}${city ? ` di ${city}` : ""} melalui Pacak Khemah.`
      : `Tempah peralatan camping dari ${name}${city ? ` di ${city}` : ""}. Khemah, kerusi, dapur & lagi — tempah melalui WhatsApp.`;

    // Use vendor image if available, otherwise default logo
    const ogImage = image || "/pacak-khemah.png";

    return {
      title,
      description,
      openGraph: {
        type: "website",
        locale: "ms_MY",
        siteName: "Pacak Khemah",
        title: `${name} | Pacak Khemah`,
        description,
        images: [
          {
            url: ogImage,
            width: 512,
            height: 512,
            alt: `${name} — Pacak Khemah`,
          },
        ],
      },
      twitter: {
        card: "summary",
        title: `${name} | Pacak Khemah`,
        description,
        images: [ogImage],
      },
    };
  } catch {
    return fallback;
  }
}

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return children;
}