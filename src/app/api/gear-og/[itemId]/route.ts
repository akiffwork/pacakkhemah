import { NextRequest, NextResponse } from "next/server";

const PROJECT_ID = "kuantan-unplugged";
const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!;
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const FALLBACK = "https://pacakkhemah.com/pacak-khemah.png";

async function proxyImage(imgUrl: string): Promise<NextResponse | null> {
  try {
    const imgRes = await fetch(imgUrl);
    if (!imgRes.ok) return null;
    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    const buffer = await imgRes.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch {
    return null;
  }
}

function extractImgUrl(gearDoc: any): string {
  return (
    gearDoc?.fields?.images?.arrayValue?.values?.[0]?.stringValue ||
    gearDoc?.fields?.img?.stringValue ||
    ""
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;

  // Attempt 1: Direct doc fetch by Firestore document ID
  try {
    const fsRes = await fetch(
      `${FIRESTORE_BASE}/gear/${encodeURIComponent(itemId)}?key=${FIREBASE_API_KEY}`,
      { next: { revalidate: 300 } }
    );
    if (fsRes.ok) {
      const gear = await fsRes.json();
      if (gear?.fields) {
        const imgUrl = extractImgUrl(gear);
        if (imgUrl.startsWith("http")) {
          const proxied = await proxyImage(imgUrl);
          if (proxied) return proxied;
        }
      }
    }
  } catch {
    // fall through to query
  }

  // Attempt 2: Query by name (handles items whose doc ID changed after recreate)
  try {
    const queryRes = await fetch(`${FIRESTORE_BASE}:runQuery?key=${FIREBASE_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "gear" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "name" },
              op: "EQUAL",
              value: { stringValue: itemId },
            },
          },
          limit: 1,
        },
      }),
      next: { revalidate: 300 },
    });
    if (queryRes.ok) {
      const qData = await queryRes.json();
      const firstDoc = qData?.[0]?.document;
      if (firstDoc?.fields) {
        const imgUrl = extractImgUrl(firstDoc);
        if (imgUrl.startsWith("http")) {
          const proxied = await proxyImage(imgUrl);
          if (proxied) return proxied;
        }
      }
    }
  } catch {
    // fall through to fallback
  }

  // Return fallback image bytes (not a redirect — some crawlers don't follow redirects)
  const fallback = await proxyImage(FALLBACK);
  return fallback ?? new NextResponse(null, { status: 404 });
}
