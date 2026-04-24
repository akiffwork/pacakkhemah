/**
 * Unit tests for src/app/api/notify-telegram/route.ts
 * Tests the vendor registration notification handler.
 */

// next/server uses the Web Fetch API's Request class which is unavailable in
// jsdom. We mock the module so the route can be imported and tested without a
// full Next.js server runtime.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

import { POST } from '@/app/api/notify-telegram/route';

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>) {
  return { json: jest.fn().mockResolvedValue(body) } as any;
}

function mockTelegramOk() {
  global.fetch = jest.fn().mockResolvedValueOnce({ ok: true }) as any;
}

function mockTelegramFail(status = 400) {
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok: false,
    status,
    text: jest.fn().mockResolvedValueOnce('Bad Request'),
  }) as any;
}

function mockTelegramThrow() {
  global.fetch = jest.fn().mockRejectedValueOnce(new Error('network error')) as any;
}

// ─── missing env vars ─────────────────────────────────────────────────────────

describe('notify-telegram: missing configuration', () => {
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalChat = process.env.TELEGRAM_CHAT_ID;

  afterEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = originalToken;
    process.env.TELEGRAM_CHAT_ID = originalChat;
  });

  test('returns 500 when TELEGRAM_BOT_TOKEN is not set', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_CHAT_ID = 'chat123';

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Telegram not configured');
  });

  test('returns 500 when TELEGRAM_CHAT_ID is not set', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'token123';
    delete process.env.TELEGRAM_CHAT_ID;

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Telegram not configured');
  });
});

// ─── valid requests ───────────────────────────────────────────────────────────

describe('notify-telegram: valid requests', () => {
  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = 'fake-token';
    process.env.TELEGRAM_CHAT_ID = 'fake-chat';
  });

  afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    jest.resetAllMocks();
  });

  test('returns 200 on success', async () => {
    mockTelegramOk();
    const res = await POST(makeRequest({ vendorName: 'Test Vendor' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('sends to the correct Telegram chat_id', async () => {
    mockTelegramOk();
    await POST(makeRequest({ vendorName: 'Test' }));
    const sentBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(sentBody.chat_id).toBe('fake-chat');
  });

  test('message includes vendor name, email, phone, and method', async () => {
    mockTelegramOk();
    await POST(makeRequest({ vendorName: 'Ali', email: 'ali@test.com', phone: '0123456789', method: 'google' }));
    const sentBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(sentBody.text).toContain('Ali');
    expect(sentBody.text).toContain('ali@test.com');
    expect(sentBody.text).toContain('0123456789');
    expect(sentBody.text).toContain('google');
  });

  test('message includes referral section when referralCode is provided', async () => {
    mockTelegramOk();
    await POST(makeRequest({ vendorName: 'Budi', referralCode: 'REF001' }));
    const sentBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(sentBody.text).toContain('REF001');
    expect(sentBody.text).toContain('Referred by');
  });

  test('message does not include referral section when no referralCode', async () => {
    mockTelegramOk();
    await POST(makeRequest({ vendorName: 'Chong' }));
    const sentBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(sentBody.text).not.toContain('Referred by');
  });

  test('uses "New Vendor" fallback when vendorName is missing', async () => {
    mockTelegramOk();
    await POST(makeRequest({}));
    const sentBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(sentBody.text).toContain('New Vendor');
  });

  test('uses "N/A" fallback for missing email and phone', async () => {
    mockTelegramOk();
    await POST(makeRequest({ vendorName: 'Test' }));
    const sentBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    const count = (sentBody.text.match(/N\/A/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('uses Markdown parse mode', async () => {
    mockTelegramOk();
    await POST(makeRequest({ vendorName: 'Test' }));
    const sentBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(sentBody.parse_mode).toBe('Markdown');
  });
});

// ─── Telegram API errors ──────────────────────────────────────────────────────

describe('notify-telegram: Telegram API errors', () => {
  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = 'fake-token';
    process.env.TELEGRAM_CHAT_ID = 'fake-chat';
  });

  afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    jest.resetAllMocks();
  });

  test('returns 500 when Telegram API responds with non-OK status', async () => {
    mockTelegramFail(400);
    const res = await POST(makeRequest({ vendorName: 'Test' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Telegram send failed');
  });

  test('returns 500 when fetch throws a network error', async () => {
    mockTelegramThrow();
    const res = await POST(makeRequest({ vendorName: 'Test' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal error');
  });
});
