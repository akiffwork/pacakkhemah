/**
 * Agreement page: the customer gives an IC or passport NUMBER (no photo upload).
 */
import { render, screen, fireEvent, act } from '@testing-library/react';

const addDoc = jest.fn((..._a: unknown[]) => Promise.resolve({ id: 'ag1' }));
jest.mock('@/lib/firebase', () => ({ db: {} }));
const vendorDoc = () => Promise.resolve({ exists: () => true, data: () => ({ name: 'Camping Dengan Kita', slug: 'camping-dengan-kita', rules: ['Return gear clean.'] }) });
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, ...p: string[]) => ({ path: p.join('/') })),
  getDoc: jest.fn(() => vendorDoc()),
  collection: jest.fn((_db, p: string) => ({ path: p })),
  addDoc: (...a: unknown[]) => addDoc(...a),
  serverTimestamp: () => 'now',
}));
let mockQuery = 'v=v1';
jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(mockQuery) }));

import AgreementPage from '@/app/agreement/page';

beforeEach(() => { addDoc.mockClear(); (jest.requireMock('firebase/firestore') as { getDoc: jest.Mock }).getDoc.mockImplementation(() => vendorDoc()); window.alert = jest.fn(); localStorage.clear(); });

async function renderPage() {
  await act(async () => { render(<AgreementPage />); });
  await screen.findByText('Equipment Rental Agreement');
}

function fillParties() {
  fireEvent.change(screen.getByLabelText('Full name (as per IC / passport)'), { target: { value: 'ali bin ahmad' } });
  fireEvent.change(screen.getByPlaceholderText('012-345 6789'), { target: { value: '0123456789' } });
  fireEvent.click(screen.getByRole('checkbox'));
}
function sign(name = 'ali bin ahmad') {
  fireEvent.change(screen.getByLabelText('Type your full name to sign'), { target: { value: name } });
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
  sign();
  await act(async () => { fireEvent.click(screen.getByText('Sign agreement')); });
  expect(addDoc).toHaveBeenCalledTimes(1);
  const data = addDoc.mock.calls[0][1] as Record<string, unknown>;
  expect(data).toMatchObject({ idType: 'ic', idNumber: '900101-14-5678', customerName: 'ALI BIN AHMAD', customerPhone: '60123456789' });
  expect(data).not.toHaveProperty('icFrontPath');
  await screen.findByText('Agreement signed');
});

test('blocks submit with an incomplete IC and shows why', async () => {
  await renderPage();
  fillParties();
  fireEvent.change(screen.getByLabelText('IC number'), { target: { value: '900101' } });
  sign();
  await act(async () => { fireEvent.click(screen.getByText('Sign agreement')); });
  expect(addDoc).not.toHaveBeenCalled();
  expect(screen.getByLabelText('IC number')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getAllByText(/12 digits/).length).toBeGreaterThan(0);
});

test('passport option saves a passport number', async () => {
  await renderPage();
  fillParties();
  fireEvent.click(screen.getByRole('radio', { name: 'Passport' }));
  fireEvent.change(screen.getByLabelText('Passport number'), { target: { value: 'k12 345 678' } });
  sign();
  await act(async () => { fireEvent.click(screen.getByText('Sign agreement')); });
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
    expect(screen.getAllByText(/16 May 2026 – 18 May 2026 · 2 nights/).length).toBeGreaterThan(0);
    fillParties();
    fireEvent.change(screen.getByLabelText('IC number'), { target: { value: '900101145678' } });
    sign();
    await act(async () => { fireEvent.click(screen.getByText('Sign agreement')); });
    const saved = addDoc.mock.calls[0][1] as { orderId: string; rentalSummary: { rows: { label: string }[] } };
    expect(saved.orderId).toBe('o1');
    expect(saved.rentalSummary.rows.at(-1)).toMatchObject({ label: 'Total', amount: 240 });
  } finally { mockQuery = 'v=v1'; }
});

test('the typed signature must match the full name', async () => {
  await renderPage();
  fillParties();
  fireEvent.change(screen.getByLabelText('IC number'), { target: { value: '900101145678' } });
  sign('ali');
  await act(async () => { fireEvent.click(screen.getByText('Sign agreement')); });
  expect(addDoc).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('Your signature must match your full name exactly.');
});

test('signing records both digital signatures, the terms and a verification code', async () => {
  await renderPage();
  expect(screen.getByText('Return gear clean.')).toBeInTheDocument();          // vendor rule
  expect(screen.getByText(/Electronic Commerce Act 2006/)).toBeInTheDocument(); // validity clause
  fillParties();
  fireEvent.change(screen.getByLabelText('IC number'), { target: { value: '900101145678' } });
  sign('  Ali   bin ahmad ');
  await act(async () => { fireEvent.click(screen.getByText('Sign agreement')); });
  const data = addDoc.mock.calls[0][1] as Record<string, unknown>;
  expect(data.vendorTerms).toEqual(['Return gear clean.']);
  expect((data.generalTerms as string[]).length).toBeGreaterThan(3);
  expect(data.customerSignature).toBe('ALI   BIN AHMAD');
  expect(data.verificationCode).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/);
  expect(typeof data.customerSignedAt).toBe('string');
  expect(typeof data.vendorSignedAt).toBe('string');
  await screen.findByText('Agreement signed');
  expect(screen.getAllByText('Digitally signed')).toHaveLength(2);
  expect(screen.getByText(data.verificationCode as string)).toBeInTheDocument();
  expect(screen.queryByText('Sign agreement')).toBeNull();
});
