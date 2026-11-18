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
jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('v=v1') }));

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
