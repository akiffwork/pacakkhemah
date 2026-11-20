/**
 * Privacy mode: money, customer details and tax IDs are hidden (••••) for
 * demos; tap to show for 5 seconds; PDFs and WhatsApp ask first.
 */
import { render, screen, fireEvent, act, within } from '@testing-library/react';

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
import OrdersTab from '@/components/OrdersTab';
import AgreementsView from '@/components/orders/AgreementsView';
import SalesView from '@/components/performance/SalesView';
import { PrivacyProvider, PrivacyToggle, Private, usePrivacy, maskName, maskMoneyIn } from '@/lib/privacy';
import type { Order } from '@/lib/orderFlow';

beforeEach(() => { localStorage.clear(); });
const withPrivacy = (ui: React.ReactElement, on = true) => {
  if (on) localStorage.setItem('pk_privacy', '1');
  return render(<PrivacyProvider>{ui}</PrivacyProvider>);
};

describe('masks', () => {
  test('names become initials, money in sentences is hidden', () => {
    expect(maskName('ILI SHAFIQAH BINTI EMBONG')).toBe('I•• S•• B••');
    expect(maskMoneyIn('Balance RM 1,250.50 unpaid, deposit RM50 held')).toBe('Balance RM •••• unpaid, deposit RM •••• held');
  });
});

describe('Private', () => {
  test('shows the value when privacy mode is off', () => {
    render(<PrivacyProvider><Private kind="money">RM 380</Private></PrivacyProvider>);
    expect(screen.getByText('RM 380')).toBeInTheDocument();
  });

  test('hidden when on; tap shows it for 5 seconds', () => {
    jest.useFakeTimers();
    withPrivacy(<Private kind="money">RM 380</Private>);
    expect(screen.queryByText('RM 380')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Hidden. Tap to show/ }));
    expect(screen.getByText('RM 380')).toBeInTheDocument();
    act(() => { jest.advanceTimersByTime(5000); });
    expect(screen.queryByText('RM 380')).toBeNull();
    expect(screen.getByText('RM ••••')).toBeInTheDocument();
    jest.useRealTimers();
  });

  test('toggle switches mode and is remembered', () => {
    render(<PrivacyProvider><PrivacyToggle /><Private kind="name" text="Aiman Rahim">Aiman Rahim</Private></PrivacyProvider>);
    expect(screen.getByText('Aiman Rahim')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Privacy mode off/ }));
    expect(screen.getByText('A•• R••')).toBeInTheDocument();
    expect(localStorage.getItem('pk_privacy')).toBe('1');
    expect(screen.getByRole('button', { name: /Privacy mode on/ })).toHaveAttribute('aria-pressed', 'true');
  });

  test('guard asks before showing real details', () => {
    const action = jest.fn();
    function Btn() { const p = usePrivacy(); return <button onClick={() => p.guard(action, 'This opens WhatsApp.')}>Send</button>; }
    withPrivacy(<Btn />);
    fireEvent.click(screen.getByText('Send'));
    expect(action).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Show real details?' })).toHaveTextContent('This opens WhatsApp.');
    fireEvent.click(screen.getByText('Show real details'));
    expect(action).toHaveBeenCalledTimes(1);
  });
});

describe('dashboard screens in privacy mode', () => {
  const names = ['Aiman Rahim', 'Siti Aminah', 'Farid Hakim', 'Daniel Lim'];

  test('Home: no amounts or customer names', async () => {
    const { container } = withPrivacy(<HomeTab vendorId="v1" vendorData={vendor} onNavigate={jest.fn()} />);
    await screen.findAllByText(/Need action/);
    const text = container.textContent || '';
    expect(text).not.toMatch(/RM\s?\d/);
    for (const n of names) expect(text).not.toContain(n);
    expect(text).toContain('RM ••••');
    expect(text).not.toContain('3 credits left');
  });

  test('Orders list and detail: names, amounts and phone hidden; WhatsApp asks first', async () => {
    const open = jest.spyOn(window, 'open').mockImplementation(() => null);
    const { container } = withPrivacy(<OrdersTab vendorId="v1" vendorName="Kuantan Camp Gear" />);
    await screen.findAllByText(/Need action/);
    let text = container.textContent || '';
    expect(text).not.toMatch(/RM\s?\d/);
    for (const n of names) expect(text).not.toContain(n);

    fireEvent.click(screen.getByText('F•• H••'));
    const detail = await screen.findByRole('dialog', { name: /Order for F•• H••/ });
    text = detail.textContent || '';
    expect(text).not.toMatch(/RM\s?\d/);
    expect(text).not.toContain('Farid');
    fireEvent.click(within(detail).getAllByRole('button', { name: /Hidden. Tap to show/ })[0]);
    expect(within(detail).getByText('Farid Hakim')).toBeInTheDocument();

    fireEvent.click(within(detail).getByRole('button', { name: /Confirm and request payment/ }));
    expect(open).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Show real details?' })).toBeInTheDocument();
    open.mockRestore();
  });

  test('Agreements: name, phone and ID hidden; PDF asks first', async () => {
    const { container } = withPrivacy(<AgreementsView vendorId="v1" onOpenOrder={jest.fn()} toast={jest.fn()} />);
    await screen.findAllByText(/Signed agreements/);
    const text = container.textContent || '';
    expect(text).not.toContain('Aiman Rahim');
    expect(text).not.toContain('Walk-in Hafiz');
    fireEvent.click(screen.getAllByText('Download PDF')[0]);
    expect(screen.getByRole('dialog', { name: 'Show real details?' })).toBeInTheDocument();
  });

  test('Sales: every figure hidden', () => {
    const { container } = withPrivacy(<SalesView vendorId="v1" orders={orders as unknown as Order[]} />);
    expect(container.textContent).not.toMatch(/RM\s?\d/);
    expect(container.textContent).toContain('RM ••••');
  });

  test('privacy off: everything shows as before', async () => {
    const { container } = withPrivacy(<HomeTab vendorId="v1" vendorData={vendor} onNavigate={jest.fn()} />, false);
    await screen.findAllByText(/Need action/);
    expect(container.textContent).toMatch(/RM\s?\d/);
  });
});
