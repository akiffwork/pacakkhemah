import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  try {
    if (!BOT_TOKEN || !CHAT_ID) {
      return NextResponse.json({ error: "Telegram not configured" }, { status: 500 });
    }

    const body = await req.json();
    const { vendorName, email, phone, method, referralCode } = body;

    let message =
      `🏕️ *New Vendor Registration!*\n\n` +
      `👤 *Name:* ${vendorName || "New Vendor"}\n` +
      `📧 *Email:* ${email || "N/A"}\n` +
      `📱 *WhatsApp:* ${phone || "N/A"}\n` +
      `🔑 *Method:* ${method || "Unknown"}\n` +
      `📅 *Time:* ${new Date().toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" })}`;

    if (referralCode) {
      message += `\n\n🎁 *Referred by:* ${referralCode}`;
    }

    message += `\n\n➡️ [Open Admin Panel](https://pacakkhemah.com/admin)`;

    const telegramRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: message,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        }),
      }
    );

    if (!telegramRes.ok) {
      const err = await telegramRes.text();
      console.error("Telegram API error:", err);
      return NextResponse.json({ error: "Telegram send failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Notify error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}