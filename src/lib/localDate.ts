// src/lib/localDate.ts
// Booking dates are plain local dates ("2026-11-21"). Build and read them in
// the device's local time, never via toISOString(), which is UTC: before 8 am
// in Malaysia the UTC date is still yesterday.

/** "YYYY-MM-DD" for a date in local time (today by default). */
export function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Local midnight of a "YYYY-MM-DD" string (new Date("YYYY-MM-DD") is UTC). */
export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : new Date(s);
}
