/**
 * Renders each dashboard screen with sample data and checks the key content:
 * Home, More, Orders › Agreements, Promotions (codes, loyalty), Performance,
 * Shop page and Settings › Account. Firestore is mocked by collection path.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { writeFileSync } from 'fs';

const day = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ago = (h: number) => new Date(Date.now() - h * 3_600_000);
const ts = (d: Date) => ({ toDate: () => d, toMillis: () => d.getTime() });

const orders = [
  { id: 'o1', vendorId: 'v1', customerName: 'Aiman Rahim', customerPhone: '601', status: 'confirmed', totalAmount: 380, depositAmount: 100, rentalAmount: 280, paymentStatus: 'full_paid', agreementSigned: true, pickedUpAt: 1, bookingDates: { start: day(-3), end: day(-1) }, items: [{ name: 'Auto Tent 4P', qty: 1, price: 60 }], createdAt: ts(ago(120)) },
  { id: 'o2', vendorId: 'v1', customerName: 'Siti Aminah', customerPhone: '602', status: 'confirmed', totalAmount: 290, depositAmount: 100, rentalAmount: 190, paymentV2: true, depositReceivedAt: 1, agreementSigned: true, bookingDates: { start: day(0), end: day(2) }, items: [{ name: 'Air Tent 6P', qty: 1, price: 80 }], createdAt: ts(ago(50)) },
  { id: 'o3', vendorId: 'v1', customerName: 'Farid Hakim', customerPhone: '603', status: 'pending', totalAmount: 450, depositAmount: 150, rentalAmount: 300, bookingDates: { start: day(5), end: day(7) }, items: [{ name: 'Modular Tent', qty: 1, price: 90 }], createdAt: ts(ago(2)) },
  { id: 'o4', vendorId: 'v1', customerName: 'Daniel Lim', customerPhone: '604', status: 'completed', totalAmount: 320, depositAmount: 100, rentalAmount: 220, paymentV2: true, depositReceivedAt: 1, rentalReceivedAt: ts(ago(30)), depositOutcome: 'refunded', bookingDates: { start: day(-6), end: day(-4) }, items: [{ name: 'Manual Tent 2P', qty: 1, price: 40, lineTotal: 80 }], createdAt: ts(ago(200)), completedAt: ts(ago(30)) },
  { id: 'o5', vendorId: 'v1', customerName: 'Mei Ling', customerPhone: '605', status: 'cancelled', cancelReason: 'Customer did not reply', totalAmount: 200, bookingDates: { start: day(-10), end: day(-9) }, items: [{ name: 'Chair', qty: 4, price: 5 }], createdAt: ts(ago(300)) },
];
const agreements = [
  { id: 'a1', vendorId: 'v1', customerName: 'Aiman Rahim', customerPhone: '601', timestamp: ts(ago(100)), orderId: 'o1', icFrontPath: 'x', icBackPath: 'y' },
  { id: 'a2', vendorId: 'v1', customerName: 'Walk-in Hafiz', customerPhone: '609', timestamp: ts(ago(20)), orderId: null },
];
const referrals = [{ id: 'r1', code: 'AIMAN10', assignedTo: { name: 'Aiman Rahim', phone: '601' }, discountType: 'percent', discountValue: 10, maxUses: 5, usedCount: 2, isActive: true }];
const vendor = { name: 'Kuantan Camp Gear', credits: 3, phone: '60123', pickup: ['Hub Kuantan'], security_deposit: 50, gear_count: 4, myReferralCode: 'VEN-ABC123', referral_total_referred: 2, referral_total_credits: 20, loyalty: { enabled: true, tiers: [{ id: 'b', minBookings: 3, discount: 5, label: 'Bronze' }], appliesTo: { type: 'all' } } };

const byPath: Record<string, unknown[]> = {
  orders, agreements, reviews: [{ id: 'rv1', vendorId: 'v1', rating: 5, customerName: 'Daniel', vendorReply: '' }],
  'vendors/v1/discounts': [], 'vendors/v1/referrals': referrals, gear: [], analytics: [], campsites: [],
  'vendors/v1/foodPartners': [], 'vendors/v1/posts': [], articles: [],
  topups: [{ id: 't1', vendorId: 'v1', credits: 10, price: 10, reference: 'PK-OLD111', status: 'pending', createdAt: ts(ago(1)) }],
};
const snapFor = (path: string) => {
  if (path === 'vendors/v1') return { exists: () => true, data: () => vendor, metadata: { hasPendingWrites: false }, id: 'v1' };
  const docs = (byPath[path] || []).map((d) => ({ id: (d as { id: string }).id, data: () => d, exists: () => true }));
  return { docs, empty: docs.length === 0, size: docs.length, forEach: (f: (x: unknown) => void) => docs.forEach(f) };
};

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, ...p: string[]) => ({ path: p.join('/') })),
  doc: jest.fn((_db, ...p: string[]) => ({ path: p.join('/') })),
  query: jest.fn((c) => c), where: jest.fn(), orderBy: jest.fn(), limit: jest.fn(),
  onSnapshot: jest.fn((t: { path: string }, cb: (s: unknown) => void) => { cb(snapFor(t.path)); return jest.fn(); }),
  getDoc: jest.fn((t: { path: string }) => Promise.resolve(snapFor(t.path))),
  getDocs: jest.fn((t: { path: string }) => Promise.resolve(snapFor(t.path))),
  updateDoc: jest.fn(() => Promise.resolve()), addDoc: jest.fn(() => Promise.resolve()), setDoc: jest.fn(() => Promise.resolve()),
  deleteDoc: jest.fn(() => Promise.resolve()), serverTimestamp: jest.fn(), arrayUnion: jest.fn(), increment: jest.fn(),
  writeBatch: jest.fn(() => ({ update: jest.fn(), commit: jest.fn(() => Promise.resolve()) })),
  runTransaction: jest.fn(),
}));
jest.mock('firebase/storage', () => ({ getStorage: jest.fn(), ref: jest.fn((_s, p: string) => ({ path: p })), uploadBytes: jest.fn(() => Promise.resolve()), getDownloadURL: jest.fn(() => Promise.resolve('https://files.example/receipt.jpg')) }));
jest.mock('firebase/auth', () => ({ sendPasswordResetEmail: jest.fn(), getAuth: () => ({ currentUser: null }) }));
jest.mock('@/lib/pushRegistration', () => ({ enablePush: jest.fn(), disablePush: jest.fn(), pushPermission: () => 'default', pushSupported: () => Promise.resolve(true) }));
jest.mock('@/hooks/useVendorAutosave', () => ({ useVendorAutosave: () => ({ state: 'idle', save: jest.fn(), flush: jest.fn(), retry: jest.fn() }) }));

import HomeTab from '@/components/HomeTab';
import MoreTab from '@/components/MoreTab';
import OrdersTab from '@/components/OrdersTab';
import PromotionsTab from '@/components/PromotionsTab';
import PerformanceTab from '@/components/PerformanceTab';
import SettingsTab from '@/components/SettingsTab';
import ReviewsTab from '@/components/ReviewsTab';
import ShopPageTab from '@/components/ShopPageTab';
import CalendarView from '@/components/calendar/CalendarView';
import { act } from 'react';

function dump(name: string, c: HTMLElement) {
  if (process.env.DUMP_HTML) writeFileSync(`${process.env.DUMP_HTML}/${name}.html`, c.innerHTML);
}

describe('dashboard screens', () => {
  test('Home shows money, next actions, movements, credits and setup', () => {
    const nav = jest.fn();
    const { container } = render(<HomeTab vendorId="v1" vendorData={vendor} onNavigate={nav} />);
    dump('home', container);
    expect(screen.getByText('Kuantan Camp Gear')).toBeInTheDocument();
    expect(screen.getByText('Need action')).toBeInTheDocument();
    expect(screen.getByText('3 credits left')).toBeInTheDocument();
    expect(screen.getByText('Next actions')).toBeInTheDocument();
    expect(screen.getByText(/Pickup · Siti Aminah/)).toBeInTheDocument();
    expect(screen.getByText('Finish setting up your shop')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Farid Hakim'));
    expect(nav).toHaveBeenCalledWith('orders', { order: 'o3' });
  });

  test('More groups the remaining tools', () => {
    const nav = jest.fn();
    const { container } = render(<MoreTab shopUrl="/shop/x" credits={3} unrepliedReviews={1} onNavigate={nav} onLogout={jest.fn()} onRestartTour={jest.fn()} />);
    dump('more', container);
    for (const t of ['Promotions', 'Performance', 'Reviews', 'Shop page', 'Settings', 'Credits', 'Log out']) expect(screen.getByText(t)).toBeInTheDocument();
    expect(screen.getByText('1 to reply')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Promotions'));
    expect(nav).toHaveBeenCalledWith('promotions');
  });

  test('Orders › Agreements lists signed agreements and flags unlinked ones', () => {
    const { container } = render(<OrdersTab vendorId="v1" vendorName="Kuantan Camp Gear" initialView="agreements" />);
    dump('agreements', container);
    expect(screen.getByRole('tab', { name: 'Agreements · 1 to link' })).toBeInTheDocument();
    expect(screen.getByText('Walk-in Hafiz')).toBeInTheDocument();
    expect(screen.getByText('Not linked')).toBeInTheDocument();
    expect(screen.getAllByText('Download PDF')).toHaveLength(2);
  });

  test('Orders opens a deep-linked order', () => {
    render(<OrdersTab vendorId="v1" vendorName="Kuantan Camp Gear" initialOrderId="o3" />);
    expect(screen.getByRole('dialog', { name: 'Order for Farid Hakim' })).toBeInTheDocument();
  });

  test('Promotions: referral codes and loyalty', () => {
    const { container } = render(<PromotionsTab vendorId="v1" vendorName="Kuantan Camp Gear" initialSection="referrals" />);
    dump('referrals', container);
    expect(screen.getByText('AIMAN10')).toBeInTheDocument();
    expect(screen.getByText('Used 2 of 5 times')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Loyalty' }));
    dump('loyalty', container);
    expect(screen.getByText('Reward repeat customers')).toBeInTheDocument();
  });

  test('Performance › Sales: money, funnel and cancel reasons', () => {
    const { container } = render(<PerformanceTab vendorId="v1" />);
    dump('performance', container);
    expect(screen.getByText('Where bookings drop off, last 90 days')).toBeInTheDocument();
    expect(screen.getByText('Customer did not reply')).toBeInTheDocument();
    expect(screen.getByText(/past order.* never updated/)).toBeInTheDocument();
  });

  test('Settings › Account: credits packages and vendor invite', () => {
    const { container } = render(<SettingsTab vendorId="v1" vendorData={vendor} initialGroup="account" />);
    dump('account', container);
    expect(screen.getByText('Invite another vendor')).toBeInTheDocument();
    expect(screen.getByText('VEN-ABC123')).toBeInTheDocument();
    expect(screen.getByText('RM 45')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Storefront' })).not.toBeInTheDocument();
    // Earlier request shows its status
    expect(screen.getByText('Waiting for approval')).toBeInTheDocument();
    expect(screen.getByText(/Reference PK-OLD111/)).toBeInTheDocument();
  });

  test('Settings › Account: pay by QR, upload receipt, send to admin on WhatsApp', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/lib/firebase').auth.currentUser = { uid: 'u1' };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('firebase/firestore');
    fs.addDoc.mockClear();
    fs.addDoc.mockImplementationOnce(() => Promise.resolve({ id: 'new1' }));
    render(<SettingsTab vendorId="v1" vendorData={vendor} initialGroup="account" />);
    fireEvent.click(screen.getByText('RM 45'));
    expect(screen.getByRole('dialog', { name: 'Buy 50 credits' })).toBeInTheDocument();
    expect(screen.getByAltText(/DuitNow QR for Atakasen Enterprise/)).toHaveAttribute('src', '/payment/maybank-qr.png');
    const ref = screen.getByText(/^PK-[A-Z2-9]{6}$/).textContent!;
    const send = screen.getByRole('button', { name: 'I have paid, send for approval' });
    expect(send).toBeDisabled();

    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'.repeat(10)], 'big.exe', { type: 'application/x-msdownload' })] } });
    expect(screen.getByText(/photo, screenshot or PDF/)).toBeInTheDocument();
    fireEvent.change(input, { target: { files: [new File(['img'], 'receipt.jpg', { type: 'image/jpeg' })] } });
    expect(send).toBeEnabled();
    dump('topup-sheet', screen.getByRole('dialog'));
    fireEvent.click(send);

    const wa = await screen.findByRole('link', { name: /Send on WhatsApp/ });
    dump('topup-sent', screen.getByRole('dialog'));
    const text = decodeURIComponent(wa.getAttribute('href')!.split('?text=')[1]);
    expect(wa.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/601136904336\?text=/);
    expect(text).toContain('Package: 50 credits (RM 45)');
    expect(text).toContain(`Reference: ${ref}`);
    expect(text).toContain('Receipt: https://files.example/receipt.jpg');
    expect(fs.addDoc).toHaveBeenCalledWith({ path: 'topups' }, expect.objectContaining({
      vendorId: 'v1', uid: 'u1', credits: 50, price: 45, reference: ref, status: 'pending', receiptUrl: 'https://files.example/receipt.jpg',
    }));
    // Never touches the vendor's credits
    expect(fs.updateDoc).not.toHaveBeenCalledWith({ path: 'vendors/v1' }, expect.objectContaining({ credits: expect.anything() }));
  });

  test('older screens render inside the new shell (Reviews, Shop page, Customers, Calendar)', async () => {
    const r1 = render(<ReviewsTab vendorId="v1" />);
    dump('reviews', r1.container);
    expect(screen.getByRole('heading', { name: 'Reviews' })).toBeInTheDocument();
    r1.unmount();
    const r2 = render(<ShopPageTab vendorId="v1" vendorData={vendor} />);
    dump('shop', r2.container);
    expect(screen.getByRole('tab', { name: 'Logo and About' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Food partners' }));
    dump('food', r2.container);
    fireEvent.click(screen.getByRole('tab', { name: 'Posts' }));
    dump('posts', r2.container);
    r2.unmount();
    const r3 = render(<PerformanceTab vendorId="v1" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Customers' }));
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    dump('customers', r3.container);
    r3.unmount();
    let r4!: ReturnType<typeof render>;
    await act(async () => { r4 = render(<CalendarView vendorId="v1" />); await new Promise(r => setTimeout(r, 0)); });
    dump('calendar', r4.container);
  });
});
