/**
 * InventoryTab: list grouping, status labels, filters, discounts screen.
 * Firestore is mocked so onSnapshot delivers sample gear, discounts and vendor data.
 */
import { render, screen, fireEvent, within } from '@testing-library/react';
import { writeFileSync } from 'fs';

const gear = [
  { id: 'g1', name: 'Naturehike Mongar 2P', price: 45, stock: 3, images: ['https://x/a.jpg'], category: 'Tents' },
  { id: 'g2', name: 'Vidalido Air Tent 6P', price: 120, stock: 3, category: 'Tents', hasVariants: true, variants: [{ id: 'a', price: 120, stock: 2, color: { label: 'Khaki', hex: '#a8a078' } }, { id: 'b', price: 120, stock: 1, color: { label: 'Green', hex: '#355e3b' } }] },
  { id: 'g3', name: 'Blackdog Auto Tent 4P', price: 70, stock: 0, images: ['https://x/b.jpg'], category: 'Tents' },
  { id: 'g4', name: 'Coody Manual Tent 3P', price: 40, stock: 2, images: ['https://x/c.jpg'], category: 'Tents', paused: true },
  { id: 'g5', name: 'Camping Chair', price: 5, stock: 10, images: ['https://x/d.jpg'], category: 'Furniture' },
  { id: 'g6', name: 'Family Set 6P', price: 180, stock: 1, images: ['https://x/e.jpg'], type: 'package', category: 'Packages', linkedItems: [{ itemId: 'g1', qty: 1 }, { itemId: 'g5', qty: 4 }] },
  { id: 'g7', name: 'Old lamp', price: 5, stock: 1, deleted: true },
];
const discounts = [
  { id: 'd1', type: 'promo_code', code: 'CAMP10', discount_percent: 10, usedCount: 12, maxUses: 50, is_public: true },
  { id: 'd2', type: 'nightly_discount', trigger_nights: 3, discount_percent: 15, usedCount: 8 },
  { id: 'd3', type: 'promo_code', code: 'MERDEKA', discount_percent: 20, usedCount: 40, maxUses: 40 },
];

const updateDoc = jest.fn(() => Promise.resolve());
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, ...path: string[]) => ({ path: path.join('/') })),
  doc: jest.fn((_db, ...path: string[]) => ({ path: path.join('/') })),
  query: jest.fn((c) => c),
  orderBy: jest.fn(),
  where: jest.fn(),
  onSnapshot: jest.fn((target: { path: string }, cb: (snap: unknown) => void) => {
    if (target.path === 'gear') cb({ docs: gear.map(g => ({ id: g.id, data: () => g })) });
    else if (target.path.endsWith('/discounts')) cb({ docs: discounts.map(d => ({ id: d.id, data: () => d })) });
    else cb({ data: () => ({ pickup: ['Hub Kuantan'], services: { setup: { enabled: true } }, gear_count: 2 }) });
    return jest.fn();
  }),
  addDoc: jest.fn(() => Promise.resolve()),
  updateDoc: (...args: unknown[]) => (updateDoc as unknown as (...a: unknown[]) => Promise<void>)(...args),
  getDocs: jest.fn(() => Promise.resolve({ docs: [] })),
  writeBatch: jest.fn(() => ({ update: jest.fn(), commit: jest.fn(() => Promise.resolve()) })),
}));
jest.mock('firebase/storage', () => ({ getStorage: jest.fn(), ref: jest.fn(), uploadBytes: jest.fn(), getDownloadURL: jest.fn() }));
jest.mock('@/components/GearFlyerModal', () => ({ __esModule: true, default: () => null }));
jest.mock('@/hooks/useVendorAutosave', () => ({ useVendorAutosave: () => ({ state: 'idle', save: jest.fn(), flush: jest.fn(), retry: jest.fn() }) }));

import InventoryTab from '@/components/InventoryTab';
import PromotionsTab from '@/components/PromotionsTab';

function dump(name: string, container: HTMLElement) {
  if (process.env.DUMP_HTML) writeFileSync(`${process.env.DUMP_HTML}/${name}.html`, container.innerHTML);
}

describe('InventoryTab', () => {
  test('groups items by category with clear statuses', () => {
    const { container } = render(<InventoryTab vendorId="v1" />);
    dump('list', container);
    expect(screen.getByRole('heading', { name: 'Tents · 4' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Furniture · 1' })).toBeInTheDocument();
    expect(screen.queryByText('Old lamp')).not.toBeInTheDocument();
    expect(screen.getByText('Live · no photo yet')).toBeInTheDocument();
    expect(screen.getByText('Not bookable · no stock')).toBeInTheDocument();
    expect(screen.getByText('Paused · hidden from shop')).toBeInTheDocument();
    expect(screen.getByText('RM 120 / night · 2 colours')).toBeInTheDocument();
    expect(screen.getByText('RM 180 / night · 1 in stock · 2 items inside')).toBeInTheDocument();
  });

  test('needs-attention filter shows only items with problems', () => {
    render(<InventoryTab vendorId="v1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Needs attention · 2' }));
    expect(screen.getByText('Vidalido Air Tent 6P')).toBeInTheDocument();
    expect(screen.getByText('Blackdog Auto Tent 4P')).toBeInTheDocument();
    expect(screen.queryByText('Camping Chair')).not.toBeInTheDocument();
    expect(screen.queryByText('Coody Manual Tent 3P')).not.toBeInTheDocument();
  });

  test('search', () => {
    render(<InventoryTab vendorId="v1" />);
    fireEvent.change(screen.getByLabelText('Search items'), { target: { value: 'chair' } });
    expect(screen.getByText('Camping Chair')).toBeInTheDocument();
    expect(screen.queryByText('Naturehike Mongar 2P')).not.toBeInTheDocument();
  });

  test('keeps gear_count in step with live items', () => {
    updateDoc.mockClear();
    render(<InventoryTab vendorId="v1" />);
    // 6 items not deleted, 1 paused
    expect(updateDoc).toHaveBeenCalledWith({ path: 'vendors/v1' }, { gear_count: 5 });
  });

  test('Promotions shortcut opens Promotions', () => {
    const open = jest.fn();
    render(<InventoryTab vendorId="v1" onOpenPromotions={open} />);
    fireEvent.click(screen.getByRole('button', { name: /Promotions · 2 active discounts/ }));
    expect(open).toHaveBeenCalled();
  });

  test('Promotions groups and describes discounts', () => {
    const { container } = render(<PromotionsTab vendorId="v1" vendorName="Kuantan Camp Gear" />);
    dump('promotions', container);
    expect(screen.getByRole('tab', { name: 'Discounts · 2 active' })).toBeInTheDocument();
    expect(screen.getByText('Active · 2')).toBeInTheDocument();
    expect(screen.getByText('Ended · 1')).toBeInTheDocument();
    expect(screen.getByText('10% off all items with code CAMP10')).toBeInTheDocument();
    expect(screen.getByText('Book 3 or more nights, get 15% off all items')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /New discount/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Longer stays/ }));
    dump('newdiscount', container);
    expect(screen.getByText('Customers will see')).toBeInTheDocument();
  });

  test('item editor opens short, with optional sections folded', () => {
    const { container } = render(<InventoryTab vendorId="v1" />);
    fireEvent.click(screen.getByText('Vidalido Air Tent 6P'));
    dump('item', container);
    const dlg = screen.getByRole('dialog', { name: 'Edit Vidalido Air Tent 6P' });
    expect(within(dlg).getByRole('button', { name: /Colours and sizes On · Khaki \(2\), Green \(1\)/ })).toBeInTheDocument();
    expect(within(dlg).getByRole('button', { name: /Tent details/ })).toBeInTheDocument();
    expect(within(dlg).getByRole('button', { name: /Setup at campsite/ })).toBeInTheDocument();
    // One pickup point: the section is not shown
    expect(within(dlg).queryByRole('button', { name: /Pickup point/ })).not.toBeInTheDocument();
    expect(within(dlg).getByRole('button', { name: 'No changes' })).toBeDisabled();
  });
});
