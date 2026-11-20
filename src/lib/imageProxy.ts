// src/lib/imageProxy.ts
// The gear preview image routes fetch an image URL saved on a gear item and
// serve its bytes. Only fetch from our own image storage, never an arbitrary
// address someone typed in (that would turn the route into an open proxy).

const ALLOWED_HOSTS = new Set(["firebasestorage.googleapis.com", "storage.googleapis.com"]);

export function isAllowedImageUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && ALLOWED_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}
