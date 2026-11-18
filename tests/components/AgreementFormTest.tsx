/**
 * Agreement page: the customer gives an IC or passport NUMBER (no photo upload).
 */
import { render, screen, fireEvent, act } from '@testing-library/react';

const addDoc = jest.fn((..._a: unknown[]) => Promise.resolve({ id: 'ag1' }));
jest.mock('@/lib/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, ...p: string[]) => ({ path: p.join('/') })),
  getDoc: jest.fn(() => Promise.resolve({ exists: () => true, data: () => ({ name: 'Camping Dengan Kita', rules: ['Return gear clean.'] }) })),
  collection: jest.fn((_db, p: string) => ({ path: p })),
  addDoc: (...a: unknown[]) => addDoc(...a),
  serverTimestamp: () => 'now',
}));
let mockQuery = 'v=v1';
jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(mockQuery) }));

import AgreementPage from '@/app/agreement/page';

beforeEach(() => { addDoc.mockClear(); window.alert = jest.fn(); localStorage.clear(); });

async function renderPage() {
  await act(async () => { render(<AgreementPage />); });
  await screen.findByText('Camping Dengan Kita');
}

function fillParties() {
  fireEvent.change(screen.getByPlaceholderText('FULL NAME AS PER IC / PASSPORT'), { target: { value: 'ali bin ahmad' } });
  fireEvent.change(screen.getByPlaceholderText('012-345 6789'), { target: { value: '0123456789' } });
  fireEvent.click(screen.getByRole('checkbox'));
}

test('there is no photo upload, only an ID number field', async () => {
  await renderPage();
  expect(document.querySelector('input[type=file]')).toBeNull();
  expect(screen.getByRole('radio', { name: 'MyKad (IC)' })).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByLabelText('IC number')).toBeInTheDocument();
});

test('formats the IC number and saves it with the agreement', async () => {
  await renderPage();
  fillParties();
  const input = screen.getByLabelText('IC number') as HTMLInputElement;
  fireEvent.change(input, { target: { value: '900101145678' } });
  expect(input.value).toBe('900101-14-5678');
  await act(async () => { fireEvent.click(screen.getByText('Sign & Confirm Booking')); });
  expect(addDoc).toHaveBeenCalledTimes(1);
  const data = addDoc.mock.calls[0][1] as Record<string, unknown>;
  expect(data).toMatchObject({ idType: 'ic', idNumber: '900101-14-5678', customerName: 'ALI BIN AHMAD', customerPhone: '60123456789' });
  expect(data).not.toHaveProperty('icFrontPath');
  await screen.findByText('Agreement Signed');
});

test('blocks submit with an incomplete IC and shows why', async () => {
  await renderPage();
  fillParties();
  fireEvent.change(screen.getByLabelText('IC number'), { target: { value: '900101' } });
  await act(async () => { fireEvent.click(screen.getByText('Sign & Confirm Booking')); });
  expect(addDoc).not.toHaveBeenCalled();
  expect(screen.getByLabelText('IC number')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByText(/12 digits/)).toBeInTheDocument();
});

test('passport option saves a passport number', async () => {
  await renderPage();
  fillParties();
  fireEvent.click(screen.getByRole('radio', { name: 'Passport' }));
  fireEvent.change(screen.getByLabelText('Passport number'), { target: { value: 'k12 345 678' } });
  await act(async () => { fireEvent.click(screen.getByText('Sign & Confirm Booking')); });
  expect(addDoc.mock.calls[0][1]).toMatchObject({ idType: 'passport', idNumber: 'K12345678' });
});

test('shows the order exactly as the order details do', async () => {
  const { getDoc } = jest.requireMock('firebase/firestore') as { getDoc: jest.Mock };
  getDoc.mockImplementation((ref: { path: string }) => Promise.resolve(ref.path.startsWith('orders/')
    ? { exists: () => true, id: 'o1', data: () => ({
        vendorId: 'v1', customerPhone: '601', pickupLocation: 'Balok', status: 'pending',
        bookingDates: { start: '2026-05-16', end: '2026-05-18' }, nights: 2,
        items: [{ name: 'Air Tent 6P', qty: 1, price: 80, lineTotal: 160, addSetup: true, setupFee: 30 }],
        freeItems: [{ name: 'Lantern', qty: 1 }],
        subtotal: 160, setupFeeTotal: 30, totalAmount: 240, depositAmount: 50, rentalAmount: 190,
      }) }
    : { exists: () => true, data: () => ({ name: 'Camping Dengan Kita' }) }));
  mockQuery = 'v=v1&o=o1';
  try {
    await renderPage();
    await screen.findByText('1 × Air Tent 6P');
    expect(screen.getAllByText('RM 160')).toHaveLength(2); // line total + subtotal
    expect(screen.getByText('RM 80/night × 1 × 2N')).toBeInTheDocument();
    expect(screen.getByText('Add-on: setup at campsite')).toBeInTheDocument();
    expect(screen.getByText('Free item')).toBeInTheDocument();
    expect(screen.getByText('Security deposit (refundable)')).toBeInTheDocument();
    expect(screen.getByText('RM 240')).toBeInTheDocument();
    expect(screen.getByText('2 nights')).toBeInTheDocument();
    fillParties();
    fireEvent.change(screen.getByLabelText('IC number'), { target: { value: '900101145678' } });
    await act(async () => { fireEvent.click(screen.getByText('Sign & Confirm Booking')); });
    const saved = addDoc.mock.calls[0][1] as { orderId: string; rentalSummary: { rows: { label: string }[] } };
    expect(saved.orderId).toBe('o1');
    expect(saved.rentalSummary.rows.at(-1)).toMatchObject({ label: 'Total', amount: 240 });
  } finally { mockQuery = 'v=v1'; }
});
