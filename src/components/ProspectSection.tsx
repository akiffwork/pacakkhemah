"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { addDoc, collection, getDocs, serverTimestamp } from "firebase/firestore";
import type { ResolvedLocation } from "@/lib/malaysiaLocations";
import { Lang, Prospect, normalizeMyPhone, tr, waLink } from "@/lib/prospects";
import ProspectEnquirySheet from "@/components/ProspectEnquirySheet";

const ADMIN_WHATSAPP = "601136904336";
const WAITLIST_KEY = "pk_area_waitlist";

let prospectCache: Prospect[] | null = null;

async function loadProspects(): Promise<Prospect[]> {
  if (prospectCache) return prospectCache;
  const snap = await getDocs(collection(db, "prospects"));
  prospectCache = snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Prospect))
    .filter(p => p.status !== "converted" && p.phone);
  return prospectCache;
}

function matchProspects(all: Prospect[], loc: ResolvedLocation | null, searched: string) {
  const q = searched.trim().toLowerCase();
  const byArea = (p: Prospect) => !!q && (p.areas || []).some(a => a.toLowerCase().includes(q));
  if (loc?.district) {
    const inDistrict = all.filter(p => p.district === loc.district || byArea(p));
    if (inDistrict.length) return { list: inDistrict, scope: "district" as const };
  }
  if (loc) {
    const inState = all.filter(p => p.state === loc.state);
    if (inState.length) return { list: inState, scope: "state" as const };
  }
  const textOnly = all.filter(byArea);
  return { list: textOnly, scope: "district" as const };
}

type Props = {
  searched: string;
  place: string;
  location: ResolvedLocation | null;
  lang: Lang;
  /**
   * "empty": no registered vendor here, show prospects + waitlist.
   * "more": registered vendors were found; show prospects below them as
   * extra options, or nothing if there are none.
   */
  variant?: "empty" | "more";
  /** Phones of registered vendors, so a business already on the platform isn't listed twice. */
  excludePhones?: string[];
};

export default function ProspectSection({ searched, place, location, lang, variant = "empty", excludePhones = [] }: Props) {
  const t = tr(lang);
  const [prospects, setProspects] = useState<Prospect[] | null>(null);
  const [active, setActive] = useState<Prospect | null>(null);
  const [waitPhone, setWaitPhone] = useState("");
  // Parent keys this component by the search text, so this reruns per search.
  const [waitState, setWaitState] = useState<"idle" | "saving" | "done" | "error">(() => {
    try {
      const done: string[] = JSON.parse(localStorage.getItem(WAITLIST_KEY) || "[]");
      return done.includes(searched.toLowerCase()) ? "done" : "idle";
    } catch { return "idle"; }
  });

  useEffect(() => {
    let cancelled = false;
    loadProspects()
      .then(all => { if (!cancelled) setProspects(all); })
      .catch(() => { if (!cancelled) setProspects([]); });
    return () => { cancelled = true; };
  }, []);

  async function joinWaitlist() {
    const phone = normalizeMyPhone(waitPhone);
    if (!/^60[0-9]{8,11}$/.test(phone)) { setWaitState("error"); return; }
    setWaitState("saving");
    try {
      await addDoc(collection(db, "area_waitlist"), {
        phone,
        searched: searched.slice(0, 80),
        state: location?.state ?? null,
        district: location?.district ?? null,
        createdAt: serverTimestamp(),
      });
      try {
        const done: string[] = JSON.parse(localStorage.getItem(WAITLIST_KEY) || "[]");
        localStorage.setItem(WAITLIST_KEY, JSON.stringify([...done, searched.toLowerCase()]));
      } catch { }
      setWaitState("done");
    } catch (e) {
      console.error(e);
      setWaitState("error");
    }
  }

  const registered = new Set(excludePhones.map(normalizeMyPhone).filter(Boolean));
  const { list, scope } = prospects
    ? matchProspects(prospects.filter(p => !registered.has(normalizeMyPhone(p.phone))), location, searched)
    : { list: [], scope: "district" as const };
  const isMore = variant === "more";
  if (isMore && list.length === 0) return null;

  return (
    <div className="space-y-3 text-left">
      {prospects === null ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-4 skeleton h-24" />
      ) : list.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-slate-100">
            {isMore ? (
              <>
                <p className="text-sm font-black text-[#062c24]">
                  {t("Not what you're looking for?", "Tak jumpa apa yang dicari?")}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  {t(`Here are some other vendors in ${scope === "state" && location ? location.state : place} that might help.`,
                     `Ini beberapa vendor lain di ${scope === "state" && location ? location.state : place} yang mungkin boleh bantu.`)}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-black text-[#062c24]">
                  {t("Possible vendors in", "Vendor yang mungkin ada di")} {scope === "state" && location ? location.state : place}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  {t("Not registered on Pacak Khemah yet. Contact them on WhatsApp to ask about availability.",
                     "Belum berdaftar dengan Pacak Khemah. Hubungi terus melalui WhatsApp untuk tanya ketersediaan.")}
                </p>
              </>
            )}
            <div className="mt-3 flex gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
              <i className="fas fa-info-circle text-amber-500 text-xs mt-0.5"></i>
              <p className="text-[10px] text-amber-800 leading-relaxed">
                {t("Pacak Khemah does not verify these businesses. We list them only as options we found. Any booking, payment or agreement is your own choice and is made directly with the vendor.",
                   "Pacak Khemah tidak mengesahkan bisnes ini. Kami senaraikan sebagai pilihan yang kami jumpa sahaja. Sebarang tempahan, bayaran atau perjanjian adalah pilihan anda sendiri dan dibuat terus dengan vendor.")}
              </p>
            </div>
          </div>
          <ul className="divide-y divide-slate-100">
            {list.slice(0, 8).map(p => (
              <li key={p.id} className="px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center shrink-0">
                  <i className="fas fa-campground text-sm"></i>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-[#062c24] uppercase truncate">{p.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">
                    <i className="fas fa-map-marker-alt text-slate-300 mr-1"></i>{p.district || p.state}
                    <span className="ml-2 text-amber-600 font-bold">{t("Not verified", "Belum disahkan")}</span>
                  </p>
                </div>
                <button onClick={() => setActive(p)}
                  className="shrink-0 flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2.5 rounded-xl text-[10px] font-black uppercase">
                  <i className="fab fa-whatsapp text-sm"></i> {t("Ask", "Tanya")}
                </button>
              </li>
            ))}
          </ul>
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 leading-relaxed">
            {t("Own one of these businesses?", "Pemilik bisnes di atas?")}{" "}
            <Link href="/register-vendor" className="font-bold text-emerald-700 underline">{t("Register free", "Daftar kedai percuma")}</Link>
            {" "}{t("or", "atau")}{" "}
            <a className="font-bold text-slate-600 underline" target="_blank" rel="noreferrer"
              href={waLink(ADMIN_WHATSAPP, "Salam admin Pacak Khemah, saya pemilik bisnes yang disenaraikan dan nak minta listing dibuang.")}>
              {t("ask to be removed", "minta buang listing")}
            </a>.
          </div>
        </div>
      )}

      {/* Waitlist (only when there's no registered vendor here) */}
      {!isMore && <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4">
        {waitState === "done" ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
              <i className="fas fa-check"></i>
            </div>
            <p className="text-xs font-bold text-emerald-800">{t(`Thanks! We'll WhatsApp you when a vendor is available in ${place}.`, `Terima kasih. Kami akan WhatsApp bila ada vendor di ${place}.`)}</p>
          </div>
        ) : (
          <>
            <p className="text-sm font-black text-emerald-800 mb-1">{t(`Notify me when there's a vendor in ${place}`, `Beritahu saya bila ada vendor di ${place}`)}</p>
            <p className="text-[11px] text-emerald-700 mb-3">{t("We'll WhatsApp you once, when the first vendor registers.", "Kami akan WhatsApp anda sekali sahaja bila vendor pertama berdaftar.")}</p>
            <div className="flex gap-2">
              <input type="tel" inputMode="tel" value={waitPhone} onChange={e => { setWaitPhone(e.target.value); if (waitState === "error") setWaitState("idle"); }}
                placeholder={t("e.g. 0123456789", "cth. 0123456789")}
                className="flex-1 min-w-0 bg-white border border-emerald-200 rounded-xl px-3 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500" />
              <button onClick={joinWaitlist} disabled={waitState === "saving" || !waitPhone.trim()}
                className="shrink-0 bg-[#062c24] text-white px-4 rounded-xl text-[10px] font-black uppercase disabled:opacity-50">
                {waitState === "saving" ? <i className="fas fa-spinner fa-spin"></i> : t("Notify me", "Beritahu")}
              </button>
            </div>
            {waitState === "error" && <p className="text-[10px] text-red-500 font-bold mt-2">{t("Please enter a valid Malaysian phone number.", "Sila masukkan nombor telefon Malaysia yang sah.")}</p>}
          </>
        )}
      </div>}

      {active && (
        <ProspectEnquirySheet prospect={active} place={place} searched={searched} location={location} lang={lang}
          onClose={() => setActive(null)} />
      )}
    </div>
  );
}
