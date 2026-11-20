import { NextRequest, NextResponse } from "next/server";

// Telegram alert to the admin when a vendor registers.
// Only for a real account created in the last 15 minutes: the caller sends
// its Firebase ID token, which is checked with Google, and the email comes
// from that account (not from the request). Messages are plain text,
// so nothing in them can add formatting or links.

const NEW_ACCOUNT_MS = 15 * 60 * 1000;

type LookupUser = { localId: string; email?: string; createdAt?: string };

async function verifiedNewUser(idToken: string, apiKey: string): Promise<LookupUser | null> {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) return null;
  const user = ((await res.json()) as { users?: LookupUser[] }).users?.[0];
  if (!user?.localId) return null;
  const created = Number(user.createdAt) || 0;
  if (!created || Date.now() - created > NEW_ACCOUNT_MS) return null;
  return user;
}

const clip = (v: unknown, n: number) => String(v ?? "").replace(/[\r\n]+/g, " ").slice(0, n);

export async function POST(req: NextRequest) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  try {
    if (!BOT_TOKEN || !CHAT_ID || !API_KEY) {
      return NextResponse.json({ error: "Telegram not configured" }, { status: 500 });
    }

    const idToken = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const user = idToken ? await verifiedNewUser(idToken, API_KEY) : null;
    if (!user) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { vendorName, phone, method, referralCode } = body as Record<string, unknown>;

    let message =
      `🏕️ New Vendor Registration!\n\n` +
      `👤 Name: ${clip(vendorName, 80) || "New Vendor"}\n` +
      `📧 Email: ${clip(user.email, 120) || "N/A"}\n` +
      `📱 WhatsApp: ${clip(String(phone ?? "").replace(/[^0-9+]/g, ""), 20) || "N/A"}\n` +
      `🔑 Method: ${clip(method, 20) || "Unknown"}\n` +
      `📅 Time: ${new Date().toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" })}`;

    if (referralCode) message += `\n\n🎁 Referred by: ${clip(referralCode, 30)}`;
    message += `\n\n➡️ Open Admin Panel: https://pacakkhemah.com/admin`;

    const telegramRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text: message, disable_web_page_preview: true }),
    });

    if (!telegramRes.ok) {
      console.error("Telegram API error:", await telegramRes.text());
      return NextResponse.json({ error: "Telegram send failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Notify error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
