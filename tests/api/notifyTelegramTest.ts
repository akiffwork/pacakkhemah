/**
 * @jest-environment node
 */
import { POST } from '@/app/api/notify-telegram/route';
import { NextRequest } from 'next/server';

const sent: string[] = [];
let createdAt = Date.now();
beforeEach(() => {
  sent.length = 0;
  createdAt = Date.now();
  process.env.TELEGRAM_BOT_TOKEN = 'bot'; process.env.TELEGRAM_CHAT_ID = 'chat'; process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'key';
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    if (url.includes('accounts:lookup')) {
      const { idToken } = JSON.parse(String(init?.body));
      return idToken === 'good'
        ? new Response(JSON.stringify({ users: [{ localId: 'u1', email: 'real@x.com', createdAt: String(createdAt) }] }))
        : new Response('{}', { status: 400 });
    }
    sent.push(JSON.parse(String(init?.body)).text);
    return new Response('{}');
  }) as typeof fetch;
});
const req = (token: string | null, body: object) => new NextRequest('https://x/api/notify-telegram', {
  method: 'POST', body: JSON.stringify(body), headers: token ? { authorization: `Bearer ${token}` } : {},
});

test('refuses requests without a real signed-in account', async () => {
  expect((await POST(req(null, { vendorName: 'spam' }))).status).toBe(403);
  expect((await POST(req('fake', { vendorName: 'spam' }))).status).toBe(403);
  expect(sent).toHaveLength(0);
});

test('refuses accounts older than 15 minutes', async () => {
  createdAt = Date.now() - 16 * 60 * 1000;
  expect((await POST(req('good', { vendorName: 'x' }))).status).toBe(403);
});

test('sends for a new account, with its real email and plain text', async () => {
  const res = await POST(req('good', { vendorName: 'Camp *Bold* [link](https://evil)', email: 'fake@x.com', phone: '012-345 6789' }));
  expect(res.status).toBe(200);
  expect(sent[0]).toContain('real@x.com');
  expect(sent[0]).not.toContain('fake@x.com');
  expect(sent[0]).toContain('0123456789');
});
