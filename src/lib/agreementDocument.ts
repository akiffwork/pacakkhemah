// src/lib/agreementDocument.ts
// The rental agreement's wording and structure, shared by the agreement page
// (what the customer reads and signs) and the PDF, so both say exactly the same.

import { DEFAULT_RULES } from "./vendorSettings";
import type { IconName } from "./agreementIcons";
import type { RentalSummary } from "./rentalSummary";

export type AgreementVendor = {
  name: string;
  slug?: string;
  /** Shop logo URL. */
  image?: string;
  phone?: string;
  city?: string;
  ig?: string; tiktok?: string; fb?: string; threads?: string;
  rules?: string[];
};

export type AgreementCustomer = { name: string; phone?: string; idType?: string; idNumber?: string };

/** Everything needed to render the agreement (page or PDF). */
export type AgreementDoc = {
  vendor: AgreementVendor;
  customer: AgreementCustomer;
  rental: RentalSummary | null;
  vendorTerms: string[];
  generalTerms: string[];
  refNo?: string;
  /** When the vendor issued (and so signed) the agreement. */
  vendorSignedAt?: Date;
  /** Set once the customer has signed. */
  customerSignedAt?: Date;
  customerSignature?: string;
  verificationCode?: string;
  /** Older agreements only. */
  photos?: { frontUrl?: string; backUrl?: string };
};

export const AGREEMENT_TITLE = "Equipment Rental Agreement";

export const SECTION_TITLES = [
  "Contracting Parties",
  "Subject of Rental",
  "Rental Terms",
  "General Terms and Validity",
  "Declaration",
  "Digital Signatures",
] as const;

/** The vendor's own rules (set in Settings › Rules), or the suggested ones. */
export function vendorTerms(rules?: string[]): string[] {
  const own = (rules || []).map(r => r.trim()).filter(Boolean);
  return own.length ? own : DEFAULT_RULES;
}

/** Clauses that make the agreement valid and binding. Same for every vendor. */
export function generalTerms(): string[] {
  return [
    "Validity. This agreement takes effect when the Customer signs it and remains in force for the rental period in Section 2, until all items are returned and the security deposit is settled.",
    "Digital signatures. The Vendor signs by issuing this agreement through their Pacak Khemah account. The Customer signs by typing their full name and confirming in Section 6. Both parties agree that these electronic signatures are as binding as handwritten signatures, as recognised by the Electronic Commerce Act 2006 (Malaysia).",
    "Whole agreement. This agreement, with the items and prices in Section 2, is the full agreement for this rental. Any change must be agreed by both parties in writing, including by WhatsApp.",
    "Identity. The Customer confirms that the name and identity number given are true and their own. The Vendor keeps them only for this rental.",
    "Platform. Pacak Khemah provides the booking technology only and is not a party to this agreement.",
    "Governing law. This agreement is governed by the laws of Malaysia.",
    "Copies. Each party may keep a copy of this agreement. The verification code in Section 6 identifies the signed version.",
  ];
}

export function declarationText(customer: AgreementCustomer, idText: string): string {
  const who = customer.name || "the Customer";
  return `I, ${who}${idText ? ` (${idText})` : ""}, confirm that I have read and agree to all the terms in this agreement. I accept full responsibility for the rented items during the rental period and will return them in the same condition as received.`;
}

export function shopAddress(slug?: string): string {
  return slug ? `pacakkhemah.com/shop/${slug}` : "pacakkhemah.com";
}

export type SocialLink = { icon: IconName; label: string; url: string };

function handleOf(raw: string): string {
  const s = raw.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(s) && !s.includes("/")) return s.replace(/^@/, "");
  const last = s.split("/").pop() || s;
  return last.replace(/^@/, "").split("?")[0];
}

/** The vendor's contact and social links, as shown in the footer. */
export function socialLinks(v: AgreementVendor): SocialLink[] {
  const out: SocialLink[] = [];
  const add = (icon: IconName, raw: string | undefined, base: string, at: boolean) => {
    if (!raw?.trim()) return;
    const h = handleOf(raw);
    if (!h) return;
    const url = /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `${base}${at ? "@" : ""}${h}`;
    out.push({ icon, label: `@${h}`, url });
  };
  if (v.phone) {
    const d = v.phone.replace(/\D/g, "");
    if (d) out.push({ icon: "whatsapp", label: `+${d.startsWith("0") ? "6" + d : d}`, url: `https://wa.me/${d.startsWith("0") ? "6" + d : d}` });
  }
  add("instagram", v.ig, "https://instagram.com/", false);
  add("tiktok", v.tiktok, "https://www.tiktok.com/", true);
  add("facebook", v.fb, "https://facebook.com/", false);
  add("threads", v.threads, "https://www.threads.net/", true);
  return out;
}

/** "18 Nov 2026, 10:27 am (GMT+8)" in Malaysia time. */
export function formatSignedAt(d?: Date): string {
  if (!d || isNaN(d.getTime())) return "";
  const s = d.toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
  return `${s} (GMT+8)`;
}

/** Stable JSON (sorted keys) so the same content always gives the same code. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as object).sort().filter(k => (v as Record<string, unknown>)[k] !== undefined)
      .map(k => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

/** SHA-256 of the signed content, shown as XXXX-XXXX-XXXX-XXXX. */
export async function verificationCode(content: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonical(content));
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const hex = Array.from(hash.slice(0, 8)).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return hex.match(/.{4}/g)!.join("-");
}

/** True when the typed signature matches the customer's name (spacing and case ignored). */
export function signatureMatches(signature: string, name: string): boolean {
  const n = (s: string) => s.toUpperCase().replace(/\s+/g, " ").trim();
  return !!n(signature) && n(signature) === n(name);
}
