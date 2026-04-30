import { NextRequest, NextResponse } from "next/server";

const PROJECT_ID = "kuantan-unplugged";
const FIREBASE_API_KEY = "AIzaSyAijpbwzFTDctk38Ktkcbt1Hd4y-1Cd1Xw";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const FALLBACK = "https://pacakkhemah.com/pacak-khemah.png";

export async function GET(req: NextRequest) {
  const itemId = req.nextUrl.searchParams.get("id");
  if (!itemId) return NextResponse.redirect(FALLBACK, { status: 302 });

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
        // Proxy the image bytes so it comes from pacakkhemah.com
        const imgRes = await fetch(imgUrl);
        if (imgRes.ok) {
          const contentType = imgRes.headers.get("content-type") || "image/jpeg";
          const buffer = await imgRes.arrayBuffer();
          return new NextResponse(buffer, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "public, max-age=86400, s-maxage=86400",
            },
          });
        }
      }
    }
  } catch {
    // fall through to redirect
  }

  return NextResponse.redirect(FALLBACK, { status: 302 });
}
