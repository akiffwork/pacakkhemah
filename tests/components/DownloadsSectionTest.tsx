import { render, screen, fireEvent, act } from '@testing-library/react';

const updateDoc = jest.fn(() => Promise.resolve());
const docs = [
  { id: 'a', data: () => ({ title: 'Beginner checklist', description: 'What to pack', fileUrl: 'https://firebasestorage.googleapis.com/a.pdf', fileName: 'checklist.pdf', fileSize: 2048, published: true, createdAt: { toMillis: () => 2 } }) },
  { id: 'b', data: () => ({ title: 'Bad link', fileUrl: 'javascript:alert(1)', fileName: 'x.pdf', fileSize: 1, published: true }) },
];
jest.mock('@/lib/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({})),
  query: jest.fn(() => ({})),
  where: jest.fn(),
  doc: jest.fn((_db, ...p: string[]) => ({ path: p.join('/') })),
  getDocs: jest.fn(() => Promise.resolve({ docs })),
  increment: (n: number) => ({ inc: n }),
  updateDoc: (...a: unknown[]) => (updateDoc as jest.Mock)(...a),
}));

import DownloadsSection from '@/components/DownloadsSection';

it('lists shown downloads, skips unsafe links and counts a download', async () => {
  await act(async () => { render(<DownloadsSection />); });
  expect(screen.getByText('Free Downloads')).toBeInTheDocument();
  const link = screen.getByRole('link', { name: /Download Beginner checklist \(PDF, 2 KB\)/ });
  expect(link).toHaveAttribute('href', 'https://firebasestorage.googleapis.com/a.pdf');
  expect(screen.queryByText('Bad link')).not.toBeInTheDocument();
  fireEvent.click(link);
  expect(updateDoc).toHaveBeenCalledWith({ path: 'downloads/a' }, { downloadCount: { inc: 1 } });
});

it('renders nothing when there are no downloads', async () => {
  const fs = jest.requireMock('firebase/firestore') as { getDocs: jest.Mock };
  fs.getDocs.mockImplementationOnce(() => Promise.resolve({ docs: [] }));
  let container: HTMLElement;
  await act(async () => { ({ container } = render(<DownloadsSection />)); });
  expect(container!.innerHTML).toBe('');
});
