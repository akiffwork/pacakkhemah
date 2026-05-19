import { Metadata } from "next";
import GuideClient from "./GuideClient";

export const revalidate = 300;

const PROJECT_ID = "kuantan-unplugged";
const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!;
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const SITE = "https://pacakkhemah.com";

async function getArticleBySlug(slug: string) {
  try {
    const res = await fetch(
      `${FIRESTORE_BASE}:runQuery?key=${FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: "articles" }],
            where: {
              compositeFilter: {
                op: "AND",
                filters: [
                  { fieldFilter: { field: { fieldPath: "slug" }, op: "EQUAL", value: { stringValue: slug } } },
                  { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "published" } } },
                ],
              },
            },
            limit: 1,
          },
        }),
        next: { revalidate: 300 },
      }
    );
    const data = await res.json();
    return data?.[0]?.document || null;
  } catch {
    return null;
  }
}

function fsStr(doc: any, field: string): string {
  return doc?.fields?.[field]?.stringValue || "";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = await getArticleBySlug(slug);

  if (!doc) {
    return { title: "Article Not Found | Pacak Khemah" };
  }

  const title = fsStr(doc, "title");
  const excerpt = fsStr(doc, "excerpt");
  const coverImage = fsStr(doc, "coverImage");
  const videoUrl = fsStr(doc, "videoUrl");

  let ogImage = coverImage;
  if (!ogImage && videoUrl) {
    const match = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (match) ogImage = `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
  }
  if (!ogImage) ogImage = `${SITE}/pacak-khemah.png`;

  const fullTitle = `${title} | Camping Guide | Pacak Khemah`;

  return {
    title: fullTitle,
    description: excerpt,
    openGraph: {
      title: fullTitle,
      description: excerpt,
      images: [{ url: ogImage, width: 1280, height: 720, alt: title }],
      type: "article",
      siteName: "Pacak Khemah",
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: excerpt,
      images: [ogImage],
    },
  };
}

export default async function GuideArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <GuideClient slug={slug} />;
}
