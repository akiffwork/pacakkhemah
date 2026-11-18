/**
 * Customer identity number for the rental agreement.
 * Customers type their MyKad (IC) number or, for non-Malaysians, a passport
 * number. No ID photos are collected.
 */

export type IdType = "ic" | "passport";

export const ID_LABEL: Record<IdType, string> = { ic: "IC No.", passport: "Passport No." };

/** Format MyKad digits as 000000-00-0000 while typing. */
export function formatIc(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 12);
  if (d.length <= 6) return d;
  if (d.length <= 8) return `${d.slice(0, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 6)}-${d.slice(6, 8)}-${d.slice(8)}`;
}

/** Passport numbers: letters and digits only, uppercase, max 15. */
export function formatPassport(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15);
}

export function formatIdNumber(type: IdType, raw: string): string {
  return type === "ic" ? formatIc(raw) : formatPassport(raw);
}

/** Returns an error message, or "" when the number looks valid. */
export function idNumberError(type: IdType, value: string): string {
  if (type === "ic") {
    const d = value.replace(/\D/g, "");
    if (!d) return "Please enter your IC number.";
    if (d.length !== 12) return "IC number must have 12 digits (e.g. 900101-14-5678).";
    const month = Number(d.slice(2, 4)), day = Number(d.slice(4, 6));
    if (month < 1 || month > 12 || day < 1 || day > 31) return "Please check your IC number. The first 6 digits are your birth date (YYMMDD).";
    return "";
  }
  const p = value.trim();
  if (!p) return "Please enter your passport number.";
  if (p.length < 6) return "Passport number looks too short. Please check it.";
  if (!/[0-9]/.test(p)) return "Please check your passport number.";
  return "";
}

/** "IC No. 900101-14-5678" style line, or "" when no number was given. */
export function idLine(type?: string | null, number?: string | null): string {
  if (!number) return "";
  const t: IdType = type === "passport" ? "passport" : "ic";
  return `${ID_LABEL[t]} ${number}`;
}
