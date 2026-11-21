import {
  contentDisposition, contentTypeFor, coverError, fileError, fileLabel, formatBytes,
  safeFileName, sortDownloads, isHttps, type DownloadItem,
} from '@/lib/downloads';

describe('downloads helpers', () => {
  it('maps extensions to allowed content types', () => {
    expect(contentTypeFor('Checklist.PDF')).toBe('application/pdf');
    expect(contentTypeFor('pack.zip')).toBe('application/zip');
    expect(contentTypeFor('notes.docx')).toMatch(/wordprocessingml/);
    expect(contentTypeFor('virus.exe')).toBeNull();
    expect(contentTypeFor('noext')).toBeNull();
  });

  it('rejects unsupported or oversized files', () => {
    expect(fileError({ name: 'a.pdf', size: 1000 })).toBeNull();
    expect(fileError({ name: 'a.exe', size: 1000 })).toMatch(/Use a PDF/);
    expect(fileError({ name: 'a.pdf', size: 26 * 1024 * 1024 })).toMatch(/25 MB/);
    expect(coverError({ name: 'c.jpg', size: 1000, type: 'image/jpeg' })).toBeNull();
    expect(coverError({ name: 'c.pdf', size: 1000, type: 'application/pdf' })).toMatch(/image/);
    expect(coverError({ name: 'c.png', size: 6 * 1024 * 1024, type: 'image/png' })).toMatch(/5 MB/);
  });

  it('formats labels and sizes', () => {
    expect(fileLabel('guide.pdf')).toBe('PDF');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3 MB');
  });

  it('makes storage-safe names and a download header', () => {
    expect(safeFileName('Senarai Semak (v2).PDF')).toBe('senarai-semak-v2.pdf');
    expect(safeFileName('???.pdf')).toBe('file.pdf');
    const cd = contentDisposition('Senarai "Semak".pdf');
    expect(cd).toContain('attachment; filename="Senarai _Semak_.pdf"');
    expect(cd).toContain("filename*=UTF-8''Senarai%20%22Semak%22.pdf");
  });

  it('sorts newest first with unsaved items on top', () => {
    const at = (n?: number) => (n === undefined ? null : { toMillis: () => n });
    const items = [
      { id: 'old', createdAt: at(1) }, { id: 'new', createdAt: at(5) }, { id: 'pending', createdAt: at() },
    ] as unknown as DownloadItem[];
    expect(sortDownloads(items).map(d => d.id)).toEqual(['pending', 'new', 'old']);
  });

  it('only trusts https links', () => {
    expect(isHttps('https://firebasestorage.googleapis.com/x')).toBe(true);
    expect(isHttps('javascript:alert(1)')).toBe(false);
    expect(isHttps(undefined)).toBe(false);
  });
});
