// Structured Malaysian locations used to match free-text searches ("PD",
// "port dickson", "janda baik") to a state + district, so the directory can
// find nearby vendors and prospects even when vendor.city is free text.

export type ResolvedLocation = { state: string; district?: string };

type DistrictDef = { name: string; aliases?: string[] };
type StateDef = { name: string; aliases?: string[]; districts: DistrictDef[] };

export const MY_STATES: StateDef[] = [
  { name: "Johor", districts: [
    { name: "Johor Bahru", aliases: ["jb", "iskandar puteri", "skudai", "nusajaya", "pasir gudang", "gelang patah"] },
    { name: "Batu Pahat" }, { name: "Kluang" }, { name: "Kota Tinggi", aliases: ["desaru", "pengerang"] },
    { name: "Kulai" }, { name: "Mersing", aliases: ["pulau tioman", "tioman"] }, { name: "Muar" },
    { name: "Pontian" }, { name: "Segamat" }, { name: "Tangkak" },
  ] },
  { name: "Kedah", districts: [
    { name: "Alor Setar", aliases: ["alor star", "kota setar"] }, { name: "Sungai Petani", aliases: ["kuala muda"] },
    { name: "Langkawi" }, { name: "Kulim" }, { name: "Baling" }, { name: "Jitra", aliases: ["kubang pasu"] },
    { name: "Gurun" }, { name: "Yan" },
  ] },
  { name: "Kelantan", districts: [
    { name: "Kota Bharu", aliases: ["kb"] }, { name: "Gua Musang" }, { name: "Jeli" }, { name: "Kuala Krai" },
    { name: "Machang" }, { name: "Pasir Mas" }, { name: "Tanah Merah" }, { name: "Tumpat" },
  ] },
  { name: "Melaka", aliases: ["malacca"], districts: [
    { name: "Melaka Tengah", aliases: ["bandar melaka", "ayer keroh"] }, { name: "Alor Gajah", aliases: ["masjid tanah", "pantai puteri"] },
    { name: "Jasin" },
  ] },
  { name: "Negeri Sembilan", aliases: ["n9", "ns", "negri sembilan"], districts: [
    { name: "Seremban", aliases: ["nilai", "senawang", "mantin"] },
    { name: "Port Dickson", aliases: ["pd", "teluk kemang", "lukut", "pasir panjang"] },
    { name: "Jelebu", aliases: ["kuala klawang", "titi"] }, { name: "Jempol", aliases: ["bahau"] },
    { name: "Kuala Pilah" }, { name: "Rembau" }, { name: "Tampin", aliases: ["gemas"] },
  ] },
  { name: "Pahang", districts: [
    { name: "Kuantan", aliases: ["cherating", "balok", "beserah"] }, { name: "Bentong", aliases: ["janda baik", "bukit tinggi", "genting"] },
    { name: "Cameron Highlands", aliases: ["cameron", "tanah rata", "brinchang"] }, { name: "Raub" },
    { name: "Temerloh", aliases: ["mentakab"] }, { name: "Jerantut", aliases: ["taman negara", "kuala tahan"] },
    { name: "Pekan" }, { name: "Rompin" }, { name: "Maran" }, { name: "Lipis", aliases: ["kuala lipis"] },
    { name: "Bera" },
  ] },
  { name: "Perak", districts: [
    { name: "Ipoh", aliases: ["kinta"] }, { name: "Gopeng", aliases: ["kampar"] }, { name: "Taiping", aliases: ["larut", "bukit merah"] },
    { name: "Teluk Intan", aliases: ["hilir perak"] }, { name: "Lumut", aliases: ["manjung", "sitiawan", "pangkor", "teluk batik"] },
    { name: "Kuala Kangsar" }, { name: "Gerik", aliases: ["grik", "hulu perak", "belum"] },
    { name: "Tapah", aliases: ["batang padang"] }, { name: "Slim River", aliases: ["muallim", "tanjung malim"] },
  ] },
  { name: "Perlis", districts: [{ name: "Kangar" }, { name: "Arau" }, { name: "Padang Besar" }] },
  { name: "Pulau Pinang", aliases: ["penang", "pinang"], districts: [
    { name: "George Town", aliases: ["georgetown", "batu ferringhi", "balik pulau", "bayan lepas"] },
    { name: "Butterworth", aliases: ["seberang perai", "bukit mertajam", "seberang jaya"] },
    { name: "Nibong Tebal" },
  ] },
  { name: "Sabah", districts: [
    { name: "Kota Kinabalu", aliases: ["kk"] }, { name: "Kundasang", aliases: ["ranau", "kinabalu"] },
    { name: "Sandakan" }, { name: "Tawau" }, { name: "Lahad Datu" }, { name: "Keningau" },
    { name: "Kudat" }, { name: "Semporna" }, { name: "Beaufort" }, { name: "Papar" },
  ] },
  { name: "Sarawak", districts: [
    { name: "Kuching" }, { name: "Miri" }, { name: "Sibu" }, { name: "Bintulu" }, { name: "Sri Aman" },
    { name: "Kapit" }, { name: "Limbang" }, { name: "Mukah" }, { name: "Samarahan", aliases: ["kota samarahan"] },
  ] },
  { name: "Selangor", districts: [
    { name: "Shah Alam", aliases: ["setia alam", "seksyen 7"] }, { name: "Petaling Jaya", aliases: ["pj", "subang jaya", "subang", "puchong", "damansara"] },
    { name: "Klang", aliases: ["port klang", "pelabuhan klang"] }, { name: "Gombak", aliases: ["rawang", "selayang", "batu caves"] },
    { name: "Hulu Langat", aliases: ["kajang", "cheras", "semenyih", "bangi", "ampang"] },
    { name: "Hulu Selangor", aliases: ["kuala kubu bharu", "kkb", "bukit fraser", "fraser"] },
    { name: "Kuala Selangor", aliases: ["bukit melawati"] }, { name: "Sabak Bernam" },
    { name: "Sepang", aliases: ["cyberjaya", "dengkil", "bagan lalang"] }, { name: "Kuala Langat", aliases: ["banting", "morib", "jenjarom"] },
  ] },
  { name: "Terengganu", districts: [
    { name: "Kuala Terengganu", aliases: ["kt"] }, { name: "Dungun" }, { name: "Kemaman", aliases: ["chukai", "kijal"] },
    { name: "Marang" }, { name: "Besut", aliases: ["pulau perhentian", "perhentian"] }, { name: "Hulu Terengganu", aliases: ["tasik kenyir", "kenyir"] },
    { name: "Setiu" },
  ] },
  { name: "Kuala Lumpur", aliases: ["kl", "wilayah persekutuan", "wp"], districts: [
    { name: "Kuala Lumpur", aliases: ["bangsar", "setapak", "wangsa maju", "kepong", "bukit jalil", "sri petaling"] },
    { name: "Putrajaya" },
  ] },
  { name: "Labuan", districts: [{ name: "Labuan" }] },
];

export const STATE_NAMES = MY_STATES.map(s => s.name);

export function districtsOf(state: string): string[] {
  return MY_STATES.find(s => s.name === state)?.districts.map(d => d.name) ?? [];
}

export function normalizeLocation(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

type Entry = { key: string; state: string; district?: string };

// Longest keys first so "port klang" wins over "klang" and "kuala lumpur"
// wins over "kl"-style shorthands.
const ENTRIES: Entry[] = MY_STATES.flatMap<Entry>(s => [
  { key: normalizeLocation(s.name), state: s.name },
  ...(s.aliases ?? []).map(a => ({ key: normalizeLocation(a), state: s.name })),
  ...s.districts.flatMap(d => [
    { key: normalizeLocation(d.name), state: s.name, district: d.name },
    ...(d.aliases ?? []).map(a => ({ key: normalizeLocation(a), state: s.name, district: d.name })),
  ]),
]).sort((a, b) => b.key.length - a.key.length || Number(!!b.district) - Number(!!a.district));

function containsWord(haystack: string, needle: string): boolean {
  return ` ${haystack} `.includes(` ${needle} `);
}

// Regions that span more than one state. A vendor listed as "Klang Valley"
// covers all of Selangor and KL, so it resolves to both, state-wide.
const REGIONS: { keys: string[]; states: string[] }[] = [
  { keys: ["klang valley", "lembah klang", "greater kl"], states: ["Selangor", "Kuala Lumpur"] },
];

function regionStates(q: string): string[] | null {
  for (const r of REGIONS) {
    if (r.keys.some(k => q === k || containsWord(q, k))) return r.states;
  }
  return null;
}

/**
 * Map free text to a state and (if possible) district.
 * Exact match first, then whole-word containment ("camping port dickson"),
 * then prefix match for partial typing ("port dic"). Short shorthands
 * (2 letters like "pd", "kl") only match exactly or as a whole word.
 */
export function resolveLocation(text: string | undefined | null): ResolvedLocation | null {
  if (!text) return null;
  const q = normalizeLocation(text);
  if (!q) return null;

  const region = regionStates(q);
  if (region) return { state: region[0] };

  const exact = ENTRIES.find(e => e.key === q);
  if (exact) return { state: exact.state, district: exact.district };

  const contained = ENTRIES.find(e => containsWord(q, e.key));
  if (contained) return { state: contained.state, district: contained.district };

  if (q.length >= 4) {
    const prefix = ENTRIES.find(e => e.key.startsWith(q));
    if (prefix) return { state: prefix.state, district: prefix.district };
  }
  return null;
}

/** All places a free-text field covers (a region like "Klang Valley" gives several states). */
export function resolvePlaces(text: string | undefined | null): ResolvedLocation[] {
  if (!text) return [];
  const region = regionStates(normalizeLocation(text));
  if (region) return region.map(state => ({ state }));
  const r = resolveLocation(text);
  return r ? [r] : [];
}

/** Every known place covered by several free-text fields, de-duplicated. */
export function resolveAny(texts: (string | undefined | null)[]): ResolvedLocation[] {
  const out: ResolvedLocation[] = [];
  for (const t of texts) {
    for (const r of resolvePlaces(t)) {
      if (!out.some(o => o.state === r.state && o.district === r.district)) out.push(r);
    }
  }
  return out;
}

/**
 * Does a vendor place cover the searched place? A state-wide vendor place
 * covers every district in that state; a district place covers that
 * district and a state-level search.
 */
export function covers(vendorPlace: ResolvedLocation, searched: ResolvedLocation): boolean {
  if (vendorPlace.state !== searched.state) return false;
  return !searched.district || !vendorPlace.district || vendorPlace.district === searched.district;
}
