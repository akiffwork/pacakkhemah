"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import type { ResolvedLocation } from "@/lib/malaysiaLocations";
import {
  ENQUIRY_ITEMS, ENQUIRY_ITEM_LABELS, EnquiryDetails, Lang, Prospect, buildEnquiryMessage, tr, waLink,
} from "@/lib/prospects";

const PREFS_KEY = "pk_enquiry_prefs";
const CLICKS_KEY = "pk_prospect_clicks";
const DEDUPE_MS = 24 * 60 * 60 * 1000;

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}
function writeJSON(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { }
}

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** Log one enquiry per prospect per 24h per device. Never blocks the WhatsApp link. */
function logClick(prospect: Prospect, searched: string, loc: ResolvedLocation | null, d: EnquiryDetails) {
  const seen = readJSON<Record<string, number>>(CLICKS_KEY, {});
  const now = Date.now();
  if (seen[prospect.id] && now - seen[prospect.id] < DEDUPE_MS) return;
  seen[prospect.id] = now;
  writeJSON(CLICKS_KEY, seen);
  addDoc(collection(db, "prospect_clicks"), {
    prospectId: prospect.id,
    searched: searched.slice(0, 80),
    state: loc?.state ?? null,
    district: loc?.district ?? null,
    pickupDate: d.pickupDate || null,
    returnDate: d.returnDate || null,
    pax: d.pax && d.pax > 0 ? d.pax : null,
    items: d.items || [],
    createdAt: serverTimestamp(),
  }).catch(e => console.error("prospect click log failed", e));
}

type Props = {
  prospect: Prospect;
  place: string;               // what goes after "camping di"
  searched: string;            // raw search text, for analytics
  location: ResolvedLocation | null;
  lang: Lang;
  onClose: () => void;
};

export default function ProspectEnquirySheet({ prospect, place, searched, location, lang, onClose }: Props) {
  const t = tr(lang);
  // Prefill from the last enquiry, since customers usually message 2–3 vendors.
  // The sheet only mounts after a tap, so reading localStorage here is client-only.
  const [prev] = useState(() => {
    const p = readJSON<EnquiryDetails>(PREFS_KEY, {});
    const today = todayYmd();
    const pickup = p.pickupDate && p.pickupDate >= today ? p.pickupDate : "";
    return {
      pickupDate: pickup,
      returnDate: pickup && p.returnDate && p.returnDate >= pickup ? p.returnDate : "",
      pax: p.pax || null,
      items: (p.items || []).filter(i => (ENQUIRY_ITEMS as readonly string[]).includes(i)),
    };
  });
  const [pickupDate, setPickupDate] = useState(prev.pickupDate);
  const [returnDate, setReturnDate] = useState(prev.returnDate);
  const [pax, setPax] = useState<number | null>(prev.pax);
  const [items, setItems] = useState<string[]>(prev.items);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  const details: EnquiryDetails = { pickupDate, returnDate, pax, items };
  const message = useMemo(() => buildEnquiryMessage(prospect.name, place, details),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prospect.name, place, pickupDate, returnDate, pax, items]);
  const plainMessage = useMemo(() => buildEnquiryMessage(prospect.name, place), [prospect.name, place]);

  function onPickup(v: string) {
    setPickupDate(v);
    if (v && (!returnDate || returnDate < v)) setReturnDate(addDaysYmd(v, 1));
  }
  function toggleItem(i: string) {
    setItems(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  }

  function sendWithDetails() {
    writeJSON(PREFS_KEY, details);
    logClick(prospect, searched, location, details);
    onClose();
  }
  function sendPlain() {
    logClick(prospect, searched, location, {});
    onClose();
  }

  const today = todayYmd();

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={t("Send enquiry", "Hantar pertanyaan")}>
      <div className="absolute inset-0 bg-[#062c24]/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="sm:hidden w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3" />
        <div className="p-5 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{t("Ask", "Tanya")} {prospect.name}</p>
              <h3 className="text-base font-black text-[#062c24] leading-tight">{t("When are you camping?", "Bila nak camping?")}</h3>
              <p className="text-[11px] text-slate-500 mt-1">{t("Vendors reply faster when they know your dates and group size.", "Vendor lebih cepat balas kalau tahu tarikh dan bilangan orang.")}</p>
            </div>
            <button onClick={onClose} aria-label={t("Close", "Tutup")}
              className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200">
              <i className="fas fa-times text-xs"></i>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t("Pickup", "Ambil")}</span>
              <input type="date" value={pickupDate} min={today} onChange={e => onPickup(e.target.value)}
                className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-xs font-bold text-[#062c24] outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
            <label className="block">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t("Return", "Pulang")}</span>
              <input type="date" value={returnDate} min={pickupDate || today} onChange={e => setReturnDate(e.target.value)}
                className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-xs font-bold text-[#062c24] outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t("Group size", "Bilangan orang")}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPax(p => (p && p > 1 ? p - 1 : null))} aria-label={t("Decrease", "Kurang")}
                className="w-10 h-10 rounded-xl bg-slate-100 text-[#062c24] font-black hover:bg-slate-200 disabled:opacity-40" disabled={!pax}>−</button>
              <span className="w-14 text-center text-sm font-black text-[#062c24]">{pax ?? "–"}</span>
              <button onClick={() => setPax(p => Math.min((p ?? 0) + 1, 100))} aria-label={t("Increase", "Tambah")}
                className="w-10 h-10 rounded-xl bg-emerald-500 text-white font-black hover:bg-emerald-600">+</button>
            </div>
          </div>

          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t("Need (optional)", "Perlukan (pilihan)")}</span>
            <div className="flex flex-wrap gap-2 mt-2">
              {ENQUIRY_ITEMS.map(i => {
                const on = items.includes(i);
                return (
                  <button key={i} onClick={() => toggleItem(i)} aria-pressed={on}
                    className={`px-3 py-2 rounded-full text-[11px] font-bold border transition-colors ${
                      on ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-emerald-300"
                    }`}>
                    {ENQUIRY_ITEM_LABELS[i][lang]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{t("Message to vendor", "Mesej")}</p>
            <p className="text-[11px] text-slate-600 leading-relaxed">{message}</p>
          </div>

          <div className="space-y-2">
            <a href={waLink(prospect.phone, message)} target="_blank" rel="noreferrer" onClick={sendWithDetails}
              className="flex items-center justify-center gap-2 w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-lg">
              <i className="fab fa-whatsapp text-base"></i> {t("Send via WhatsApp", "Hantar melalui WhatsApp")}
            </a>
            <a href={waLink(prospect.phone, plainMessage)} target="_blank" rel="noreferrer" onClick={sendPlain}
              className="block text-center w-full py-2 text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest">
              {t("Skip, just send", "Langkau, hantar terus")}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
