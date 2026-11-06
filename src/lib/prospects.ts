// Prospect vendors: camping rental businesses that are not on Pacak Khemah
// yet. Customers who search an area with no registered vendor can WhatsApp
// them with a real enquiry; each tap is logged so admin can decide who to
// recruit first.

/** Firestore Timestamp (or anything with toDate) as read from a snapshot. */
export type FirestoreTime = { toDate: () => Date } | Date | null;

export type ProspectStatus = "active" | "contacted" | "converted";

export type Prospect = {
  id: string;
  name: string;
  phone: string;          // digits only, 60XXXXXXXXX
  state: string;
  district?: string;
  areas?: string[];       // extra towns they serve, free text
  status: ProspectStatus;
  createdAt?: FirestoreTime;
  contactedAt?: FirestoreTime;
};

export type ProspectClick = {
  id: string;
  prospectId: string;
  searched: string;
  state?: string | null;
  district?: string | null;
  pickupDate?: string | null;  // YYYY-MM-DD
  returnDate?: string | null;
  pax?: number | null;
  items?: string[];
  createdAt?: FirestoreTime;
};

export type EnquiryDetails = {
  pickupDate?: string | null;
  returnDate?: string | null;
  pax?: number | null;
  items?: string[];
};

export const ENQUIRY_ITEMS = ["khemah", "flysheet", "kerusi", "meja", "dapur", "beg tidur", "lampu"] as const;

/** UI language, also used for the enquiry message the customer chooses to send. */
export type Lang = "en" | "my";
export const tr = (lang: Lang) => (en: string, my: string) => (lang === "my" ? my : en);

/** Chip labels shown to the customer; the message itself keeps the BM value. */
export const ENQUIRY_ITEM_LABELS: Record<(typeof ENQUIRY_ITEMS)[number], { en: string; my: string }> = {
  "khemah": { en: "Tent", my: "Khemah" },
  "flysheet": { en: "Flysheet", my: "Flysheet" },
  "kerusi": { en: "Chairs", my: "Kerusi" },
  "meja": { en: "Table", my: "Meja" },
  "dapur": { en: "Stove", my: "Dapur" },
  "beg tidur": { en: "Sleeping bag", my: "Beg tidur" },
  "lampu": { en: "Lamp", my: "Lampu" },
};

const BM_MONTHS = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"];
const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseYmd(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

/** "14 Dis", "14–15 Dis", "30 Dis – 2 Jan" (or English month names) */
export function formatDateRange(pickup?: string | null, ret?: string | null, lang: Lang = "my"): string {
  const M = lang === "en" ? EN_MONTHS : BM_MONTHS;
  const a = pickup ? parseYmd(pickup) : null;
  const b = ret ? parseYmd(ret) : null;
  if (!a && !b) return "";
  if (a && !b) return `${a.getDate()} ${M[a.getMonth()]}`;
  if (!a && b) return `${b.getDate()} ${M[b.getMonth()]}`;
  const x = a!, y = b!;
  if (x.getTime() === y.getTime()) return `${x.getDate()} ${M[x.getMonth()]}`;
  if (x.getMonth() === y.getMonth() && x.getFullYear() === y.getFullYear()) {
    return `${x.getDate()}–${y.getDate()} ${M[x.getMonth()]}`;
  }
  return `${x.getDate()} ${M[x.getMonth()]} – ${y.getDate()} ${M[y.getMonth()]}`;
}
export const formatDateRangeBM = (pickup?: string | null, ret?: string | null) => formatDateRange(pickup, ret, "my");

/** ["a","b","c"] → "a, b dan c" (BM) or "a, b and c" (EN) */
export function joinList(items: string[], lang: Lang = "my"): string {
  const list = items.filter(Boolean);
  if (list.length <= 1) return list[0] ?? "";
  return `${list.slice(0, -1).join(", ")} ${lang === "en" ? "and" : "dan"} ${list[list.length - 1]}`;
}
export const joinBM = (items: string[]) => joinList(items, "my");

/**
 * Customer → prospect enquiry, in BM or English. Opens with a neutral "Hi"
 * so it suits any vendor. Skipped fields drop out cleanly.
 */
export function buildEnquiryMessage(vendorName: string, place: string, d: EnquiryDetails = {}, lang: Lang = "my"): string {
  const name = vendorName.trim();
  const dates = formatDateRange(d.pickupDate, d.returnDate, lang);
  const items = (d.items || []).filter(Boolean);
  if (lang === "en") {
    let plan = `I'm planning to camp in ${place.trim()}`;
    if (dates) plan += ` on ${dates}`;
    if (d.pax && d.pax > 0) plan += `, ${d.pax} pax`;
    let msg = `Hi ${name}, I found your business on Pacak Khemah (pacakkhemah.com). ` +
      `Do you still rent out camping gear? ${plan}.`;
    if (items.length) {
      const labels = items.map(i => (ENQUIRY_ITEM_LABELS as Record<string, { en: string }>)[i]?.en.toLowerCase() ?? i);
      msg += ` If possible, I'd need ${joinList(labels, "en")}.`;
    }
    return msg;
  }
  const parts = [`Saya plan nak camping di ${place.trim()}`];
  if (dates) parts.push(dates);
  if (d.pax && d.pax > 0) parts.push(`${d.pax} orang`);
  let msg = `Hi ${name}, saya jumpa bisnes anda di Pacak Khemah (pacakkhemah.com). ` +
    `Masih buat sewaan barang camping? ${parts.join(", ")}.`;
  if (items.length) msg += ` Kalau boleh nak ${joinList(items, "my")}.`;
  return msg;
}

/** Normalise Malaysian numbers to wa.me format: 012-345 6789 → 60123456789 */
export function normalizeMyPhone(raw: string): string {
  let p = (raw || "").replace(/[^0-9]/g, "");
  if (p.startsWith("0")) p = "6" + p;
  else if (p.startsWith("1") && p.length >= 9 && p.length <= 10) p = "60" + p;
  return p;
}

export function waLink(phone: string, text: string): string {
  return `https://wa.me/${normalizeMyPhone(phone)}?text=${encodeURIComponent(text)}`;
}

export type ProspectStats = {
  clicks: number;
  pax: number;
  lastClick: Date | null;
  topMonths: string[];   // e.g. ["Dis", "Jan"]
  topItems: string[];
};

function toDate(v: FirestoreTime | undefined): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v.toDate === "function") return v.toDate();
  return null;
}

export function statsFor(clicks: ProspectClick[]): ProspectStats {
  const monthCount: Record<string, number> = {};
  const itemCount: Record<string, number> = {};
  let pax = 0;
  let last: Date | null = null;
  for (const c of clicks) {
    if (c.pax && c.pax > 0) pax += c.pax;
    const d = c.pickupDate ? parseYmd(c.pickupDate) : null;
    if (d) monthCount[BM_MONTHS[d.getMonth()]] = (monthCount[BM_MONTHS[d.getMonth()]] || 0) + 1;
    (c.items || []).forEach(i => { itemCount[i] = (itemCount[i] || 0) + 1; });
    const t = toDate(c.createdAt);
    if (t && (!last || t > last)) last = t;
  }
  const top = (rec: Record<string, number>, n: number) =>
    Object.entries(rec).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
  return { clicks: clicks.length, pax, lastClick: last, topMonths: top(monthCount, 2), topItems: top(itemCount, 3) };
}

/** Admin → prospect recruitment pitch, using real demand numbers. */
export function buildOutreachMessage(p: Pick<Prospect, "name" | "district" | "state">, s: ProspectStats, signupUrl: string): string {
  const area = p.district || p.state;
  let demand = "";
  if (s.clicks > 0) {
    demand = `Setakat ni ada ${s.clicks} customer hubungi anda melalui Pacak Khemah`;
    if (s.pax > 0) demand += `, total ${s.pax} orang`;
    demand += `, nak camping di kawasan ${area}`;
    if (s.topMonths.length) demand += ` (kebanyakan ${joinBM(s.topMonths)})`;
    demand += ". ";
  }
  return `Hi ${p.name.trim()}, saya dari Pacak Khemah (pacakkhemah.com), platform sewaan barang camping. ` +
    demand +
    `Customer di ${area} sekarang tak boleh tempah terus sebab bisnes anda belum ada kedai di platform. ` +
    `Daftar percuma di sini: ${signupUrl}`;
}

export const PROSPECT_SIGNUP_BASE = "https://pacakkhemah.com/register-vendor?prospect=";
