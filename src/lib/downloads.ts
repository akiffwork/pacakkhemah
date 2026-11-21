// Free downloads shown on the directory page (Admin › Site › Downloads).

export type DownloadItem = {
  id: string;
  title: string;
  description: string;
  fileUrl: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  coverUrl?: string;
  coverPath?: string;
  published: boolean;
  downloadCount?: number;
  createdAt?: { toMillis?: () => number } | null;
};

export const TITLE_MAX = 120;
export const DESCRIPTION_MAX = 600;
export const FILE_MAX_MB = 25;
export const COVER_MAX_MB = 5;

// Extension → content type. Storage rules accept only these types.
const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  zip: "application/zip",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  epub: "application/epub+zip",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const FILE_ACCEPT = Object.keys(TYPES).map(e => `.${e}`).join(",");

export function extOf(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name.trim());
  return m ? m[1].toLowerCase() : "";
}

/** Content type from the extension; browsers often leave file.type empty for zip and Office files. */
export function contentTypeFor(name: string): string | null {
  return TYPES[extOf(name)] || null;
}

/** Short label for the file chip: "PDF", "ZIP", "DOCX". */
export function fileLabel(name: string): string {
  return (extOf(name) || "file").toUpperCase();
}

export function formatBytes(n: number): string {
  if (!n || n < 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`;
}

/** Problem with a picked file, or null when it can be uploaded. */
export function fileError(file: { name: string; size: number }): string | null {
  if (!contentTypeFor(file.name)) return "Use a PDF, ZIP, Word, Excel, PowerPoint, EPUB or image file";
  if (file.size > FILE_MAX_MB * 1024 * 1024) return `The file is over ${FILE_MAX_MB} MB`;
  return null;
}

export function coverError(file: { name: string; size: number; type?: string }): string | null {
  const t = file.type || contentTypeFor(file.name) || "";
  if (!t.startsWith("image/")) return "The cover must be an image (JPG, PNG or WebP)";
  if (file.size > COVER_MAX_MB * 1024 * 1024) return `The cover is over ${COVER_MAX_MB} MB`;
  return null;
}

/** Storage-safe name that keeps the extension: "Senarai Semak (v2).pdf" → "senarai-semak-v2.pdf". */
export function safeFileName(name: string): string {
  const ext = extOf(name);
  const base = (ext ? name.slice(0, -(ext.length + 1)) : name)
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "file";
  return ext ? `${base}.${ext}` : base;
}

/** Makes the browser save the file with a readable name instead of opening it. */
export function contentDisposition(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/** Newest first; items without a timestamp (just added) go to the top. */
export function sortDownloads(items: DownloadItem[]): DownloadItem[] {
  const t = (d: DownloadItem) => d.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
  return [...items].sort((a, b) => t(b) - t(a));
}

export function isHttps(url?: string): boolean {
  return !!url && /^https:\/\//i.test(url);
}
