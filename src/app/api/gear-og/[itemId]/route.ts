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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;

  try {
    const fsRes = await fetch(
      `${FIRESTORE_BASE}/gear/${encodeURIComponent(itemId)}?key=${FIREBASE_API_KEY}`,
      { next: { revalidate: 300 } }
    );
    if (fsRes.ok) {
      const gear = await fsRes.json();
      const imgUrl: string =
        gear?.fields?.images?.arrayValue?.values?.[0]?.stringValue ||
        gear?.fields?.img?.stringValue ||
        "";

      if (imgUrl.startsWith("http")) {
        const proxied = await proxyImage(imgUrl);
        if (proxied) return proxied;
      }
    }
  } catch {
    // fall through
  }

  // Return fallback image bytes (not a redirect — some crawlers don't follow redirects)
  const fallback = await proxyImage(FALLBACK);
  return fallback ?? new NextResponse(null, { status: 404 });
}
