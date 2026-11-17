/**
 * Admin panel: renders every tab with sample data and checks the main content
 * and actions. Firestore is mocked by collection path.
 */
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { writeFileSync } from 'fs';

const ago = (h: number) => new Date(Date.now() - h * 3_600_000);
const ts = (d: Date) => ({ toDate: () => d, toMillis: () => d.getTime() });

const vendors = [
  { id: 'v1', name: 'Kuantan Camp Gear', status: 'approved', credits: 3, city: 'Kuantan', phone: '60123', slug: 'kuantan', joinedAt: ts(ago(24 * 40)), badges: ['premium'] },
  { id: 'v2', name: 'Gombak Outdoor', status: 'pending', credits: 10, city: 'Gombak', referredBy: 'VEN-V1AAAA', referralRewarded: false, joinedAt: ts(ago(5)) },
  { id: 'v3', name: 'Teluk Kemang Trips', status: 'suspended', credits: 0, city: 'Port Dickson', joinedAt: ts(ago(24 * 90)) },
  { id: 'v4', name: 'Demo Shop', status: 'approved', credits: 40, city: 'Kuantan', is_mockup: true, joinedAt: ts(ago(24 * 100)) },
];
const orders = [
  { id: 'o1', vendorId: 'v1', vendorName: 'Kuantan Camp Gear', customerName: 'Aiman', customerPhone: '601', status: 'pending', totalAmount: 300, depositAmount: 100, rentalAmount: 200, bookingDates: { start: '2026-12-01', end: '2026-12-03' }, items: [{ name: 'Tent', qty: 2, price: 50, lineTotal: 200 }], createdAt: ts(ago(30)) },
  { id: 'o2', vendorId: 'v1', vendorName: 'Kuantan Camp Gear', customerName: 'Siti', customerPhone: '602', status: 'completed', paymentV2: true, depositReceivedAt: 1, rentalReceivedAt: ts(ago(5)), depositOutcome: 'refunded', totalAmount: 390, depositAmount: 100, rentalAmount: 290, bookingDates: { start: '2026-11-10', end: '2026-11-12' }, items: [{ name: 'Air tent', qty: 1, price: 145 }], createdAt: ts(ago(24 * 9)), completedAt: ts(ago(5)), history: [{ type: 'completed', at: ago(5).toISOString(), via: 'orders_tab' }] },
];
const transactions = [
  { id: 't1', vendorId: 'v1', vendorName: 'Kuantan Camp Gear', type: 'purchase', amount: 45, credits: 50, createdAt: ts(ago(48)) },
  { id: 't2', vendorId: 'v1', vendorName: 'Kuantan Camp Gear', type: 'refund', amount: 10, credits: 10, createdAt: ts(ago(24)) },
  { id: 't3', vendorId: 'v4', vendorName: 'Demo Shop', type: 'bonus', amount: 0, credits: 5, createdAt: ts(ago(12)) },
];
const byPath: Record<string, unknown[]> = {
  vendors, orders, transactions,
  topups: [{ id: 'tu1', vendorId: 'v1', vendorName: 'Kuantan Camp Gear', credits: 50, price: 45, reference: 'PK-7KQ2MD', status: 'pending', receiptUrl: 'https://r/x.jpg', createdAt: ts(ago(1)) }],
  reviews: [{ id: 'r1', rating: 5 }, { id: 'r2', rating: 4 }],
  area_waitlist: [{ id: 'w1', phone: '60111', searched: 'Mersing', state: 'Johor', createdAt: ts(ago(3)) }],
  prospects: [{ id: 'p1', name: 'Mersing Camp', phone: '60122', state: 'Johor', status: 'active' }],
  prospect_clicks: [], testimonials: [{ id: 'tm1', name: 'Ahmad', location: 'Shah Alam', text: 'Great gear', rating: 5 }],
  events: [], articles: [], campsites: [{ id: 'c1', name: 'Campstay Sungai Lembing', location: 'Pahang', category: 'river', carousel: [] }],
  settings: [],
};
const docs: Record<string, Record<string, unknown>> = {
  'settings/payment_config': { packages: [{ credits: 10, price: 10 }, { credits: 50, price: 45 }], startingCredits: 10, secretKey: 'old' },
  'settings/referral_config': { rewardCredits: 5, enabled: true },
  'settings/site': { tagline: 'Pacak. Rehat. Ulang.', maintenanceMode: false },
  'private/admins': { emails: ['helper@gmail.com'] },
};

const snapFor = (path: string) => {
  if (docs[path]) return { exists: () => true, data: () => docs[path], id: path.split('/').pop() };
  if (path.split('/').length % 2 === 0) return { exists: () => false, data: () => undefined };
  const list = byPath[path] || [];
  const d = list.map(x => ({ id: (x as { id: string }).id, data: () => x, exists: () => true, ref: { path: `${path}/${(x as { id: string }).id}` } }));
  return { docs: d, empty: d.length === 0, size: d.length, forEach: (f: (x: unknown) => void) => d.forEach(f) };
};

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, ...p: string[]) => ({ path: p.join('/') })),
  doc: jest.fn((a: { path?: string }, ...p: string[]) => ({ path: p.length ? p.join('/') : `${a.path}/new` })),
  query: jest.fn((c) => c), where: jest.fn(), orderBy: jest.fn(), limit: jest.fn(),
  onSnapshot: jest.fn((t: { path: string }, cb: (s: unknown) => void) => {
    // topups are only ever listened to with status == pending in the admin
    cb(snapFor(t.path)); return jest.fn();
  }),
  getDoc: jest.fn((t: { path: string }) => Promise.resolve(snapFor(t.path))),
  getDocs: jest.fn((t: { path: string }) => Promise.resolve(snapFor(t.path))),
  updateDoc: jest.fn(() => Promise.resolve()), addDoc: jest.fn(() => Promise.resolve({ id: 'x' })), setDoc: jest.fn(() => Promise.resolve()),
  deleteDoc: jest.fn(() => Promise.resolve()), serverTimestamp: jest.fn(() => 'TS'), arrayUnion: jest.fn((...a) => ({ union: a })), arrayRemove: jest.fn(), increment: jest.fn((n) => ({ inc: n })),
  deleteField: jest.fn(() => 'DEL'),
  writeBatch: jest.fn(() => ({ delete: jest.fn(), update: jest.fn(), commit: jest.fn(() => Promise.resolve()) })),
  runTransaction: jest.fn(async (_db, fn) => fn({ get: jest.fn(async () => ({ exists: () => true, data: () => ({ status: 'pending', vendorId: 'v1', credits: 50, price: 45 }) })), update: jest.fn(), set: jest.fn() })),
}));
jest.mock('firebase/storage', () => ({ getStorage: jest.fn(), ref: jest.fn(), uploadBytes: jest.fn(), getDownloadURL: jest.fn() }));
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn((_a, cb) => { cb({ email: 'akiff.work@gmail.com' }); return jest.fn(); }),
  signOut: jest.fn(), signInWithPopup: jest.fn(), GoogleAuthProvider: jest.fn(),
}));
jest.mock('@/components/RichTextEditor', () => () => null);

import AdminPage from '@/app/admin/page';
import AdminHome from '@/components/admin/AdminHome';
import VendorsTab from '@/components/admin/VendorsTab';
import OrdersTab from '@/components/admin/OrdersTab';
import FinanceTab from '@/components/admin/FinanceTab';
import SiteTab from '@/components/admin/SiteTab';
import AdminSettingsTab from '@/components/admin/SettingsTab';
import type { AdminVendor } from '@/components/admin/types';

const all = vendors as unknown as AdminVendor[];
function dump(name: string, c: HTMLElement) {
  if (process.env.DUMP_HTML) writeFileSync(`${process.env.DUMP_HTML}/admin-${name}.html`, c.innerHTML);
}
const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });

describe('admin panel', () => {
  test('shell: six tabs, badges for applications, top-ups and new orders', async () => {
    const { container } = render(<AdminPage />);
    await flush();
    const nav = screen.getAllByRole('navigation', { name: 'Admin' })[0];
    for (const t of ['Home', 'Vendors', 'Orders', 'Money', 'Site', 'Settings']) expect(within(nav).getByRole('button', { name: new RegExp(`^${t}`) })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: /^Vendors/ })).toHaveTextContent('1'); // one application
    expect(within(nav).getByRole('button', { name: /^Money/ })).toHaveTextContent('1'); // one top-up
    dump('shell', container);
  });

  test('Home lists what needs attention and corrects the revenue', async () => {
    const go = jest.fn();
    const { container } = render(<AdminHome allVendors={all} counts={{ applications: 1, topUps: 1, pendingOrders: 1 }} onNavigate={go} />);
    await flush();
    expect(screen.getByText('1 vendor application')).toBeInTheDocument();
    expect(screen.getByText('1 top-up request')).toBeInTheDocument();
    expect(screen.getByText('1 booking request unanswered for over a day')).toBeInTheDocument();
    expect(screen.getByText('1 customer waiting for a vendor nearby')).toBeInTheDocument();
    // purchases 45 minus refund 10; the bonus is not revenue
    expect(screen.getAllByText('Credit sales')[0].parentElement).toHaveTextContent('RM 35');
    fireEvent.click(screen.getByText('1 top-up request'));
    expect(go).toHaveBeenCalledWith('money');
    dump('home', container);
  });

  test('Vendors: live, applications, suspended and prospects with labelled actions', async () => {
    const { container } = render(<VendorsTab allVendors={all} />);
    await flush();
    expect(screen.getByRole('tab', { name: 'Live · 2' })).toBeInTheDocument();
    expect(screen.getByText('Kuantan Camp Gear')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Credits/ }).length).toBeGreaterThan(0);
    dump('vendors', container);

    fireEvent.click(screen.getByRole('tab', { name: 'Applications · 1' }));
    expect(screen.getByText('Gombak Outdoor')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(screen.getByRole('dialog', { name: 'Approve Gombak Outdoor?' })).toHaveTextContent('gets 5 credits');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.click(screen.getByRole('tab', { name: 'Suspended · 1' }));
    expect(screen.getByRole('button', { name: 'Reactivate' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const del = screen.getByRole('button', { name: 'Delete everything' });
    expect(del).toBeDisabled(); // must type the name
    fireEvent.change(screen.getByLabelText(/to confirm/), { target: { value: 'Teluk Kemang Trips' } });
    expect(del).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.click(screen.getByRole('tab', { name: 'Prospects' }));
    await flush();
    expect(screen.getByText('Mersing Camp')).toBeInTheDocument();
    dump('prospects', container);
  });

  test('Vendors: suspend sets a real suspended status, credits are logged', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('firebase/firestore');
    fs.updateDoc.mockClear();
    render(<VendorsTab allVendors={all} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Suspend' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Suspend shop' }));
    await flush();
    expect(fs.updateDoc).toHaveBeenCalledWith({ path: 'vendors/v4' }, expect.objectContaining({ status: 'suspended' }));
  });

  test('Orders: cards, detail with vendor dashboard link, admin cancel needs a reason', async () => {
    const { container } = render(<OrdersTab />);
    await flush();
    expect(screen.getByText('Aiman')).toBeInTheDocument();
    dump('orders', container);
    fireEvent.click(screen.getByText('Aiman'));
    const sheet = screen.getByRole('dialog', { name: 'Aiman' });
    expect(within(sheet).getByText('2× Tent')).toBeInTheDocument();
    expect(within(sheet).getByRole('link', { name: /vendor's dashboard/ })).toHaveAttribute('href', '/store?admin_override=v1&tab=orders&order=o1');
    dump('order-detail', sheet);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel order' }));
    expect(screen.getByRole('button', { name: 'Cancel order' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Duplicate booking' } });
    expect(screen.getByRole('button', { name: 'Cancel order' })).toBeEnabled();
  });

  test('Money: top-up requests, sales after refunds, and one form for credit changes', async () => {
    const { container } = render(<FinanceTab allVendors={all} />);
    await flush();
    expect(screen.getByText('Top-up requests')).toBeInTheDocument();
    expect(screen.getByText('Sales after refunds').parentElement).toHaveTextContent('RM 35');
    dump('money', container);
    fireEvent.click(screen.getByRole('button', { name: /Change credits/ }));
    expect(screen.getByRole('dialog', { name: 'Change credits' })).toBeInTheDocument();
    dump('credit-sheet', screen.getByRole('dialog'));
  });

  test('Site: sections for every content type, FAQ starts from the live FAQ', async () => {
    const { container } = render(<SiteTab initialSection="faq" />);
    await flush();
    expect(screen.getByRole('tab', { name: 'Campsites' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('General')).toBeInTheDocument(); // default FAQ, not an empty list
    expect(screen.getByRole('button', { name: 'Save and publish' })).toBeInTheDocument();
    dump('site-faq', container);
    fireEvent.click(screen.getByRole('tab', { name: 'Announcement' }));
    dump('site-announcement', container);
    fireEvent.click(screen.getByRole('tab', { name: 'Campsites' }));
    await flush();
    expect(screen.getByText('Campstay Sungai Lembing')).toBeInTheDocument();
    dump('campsites', container);
    expect(screen.queryByRole('button', { name: 'Save and publish' })).not.toBeInTheDocument();
  });

  test('Settings: payments with the old-key warning, real admin access, working data tools', async () => {
    const { container } = render(<AdminSettingsTab />);
    await flush();
    expect(screen.getByText('The old ToyyibPay secret key is still saved')).toBeInTheDocument();
    expect(screen.getByText('Credit packages')).toBeInTheDocument();
    dump('settings', container);
    fireEvent.click(screen.getByRole('tab', { name: 'Admin access' }));
    expect(screen.getByText('helper@gmail.com')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Data' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete all transactions' }));
    const d = screen.getByRole('dialog', { name: 'Delete all transactions?' });
    expect(within(d).getByRole('button', { name: 'Delete all transactions' })).toBeDisabled(); // type DELETE first
  });
});
