"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import BottomNav from "@/components/BottomNav";


type Campsite = {
  id: string;
  name: string;
  location?: string;
  state?: string;
  category?: string;
  carousel?: string[];
  direction?: string;
  whatsapp?: string;
  description?: string;
  facilities?: string[];
  fee?: string | number;
  lat?: number;
  lng?: number;
};

type Vendor = {
  id: string; name: string; logo?: string; image?: string;
  city?: string; areas?: string[]; slug?: string;
  rating?: number; reviewCount?: number;
  locationLat?: number; locationLng?: number;
  is_vacation?: boolean;
};

const CATEGORIES = [
  { id: "all", label: "All Spots", emoji: "🏕️" },
  { id: "seaside", label: "Beach", emoji: "🌊" },
  { id: "river", label: "River", emoji: "🛶" },
  { id: "hilltop", label: "Hilltop", emoji: "⛰️" },
  { id: "waterfall", label: "Waterfall", emoji: "💧" },
];

const STATES = [
  "All States", "Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan",
  "Pahang", "Perak", "Perlis", "Pulau Pinang", "Sabah", "Sarawak",
  "Selangor", "Terengganu", "Kuala Lumpur", "Putrajaya", "Labuan",
];

function SkeletonCard() {
  return (
    <div className="rounded-[2rem] overflow-hidden bg-white border border-slate-100 shadow-sm skeleton">
      <div className="h-64 bg-slate-200" />
      <div className="p-5 space-y-3">
        <div className="h-5 bg-slate-200 rounded-full w-3/4" />
        <div className="h-3 bg-slate-100 rounded-full w-1/2" />
        <div className="grid grid-cols-2 gap-2 pt-2">
          <div className="h-10 bg-slate-100 rounded-xl" />
          <div className="h-10 bg-slate-200 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function CarouselImage({ images, name }: { images: string[]; name: string }) {
  const [idx, setIdx] = useState(0);
  const imgs = images.length > 0 ? images : ["/pacak-khemah.png"];

  useEffect(() => {
    if (imgs.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % imgs.length), 3500);
    return () => clearInterval(t);
  }, [imgs.length]);

  return (
    <div className="relative h-64 overflow-hidden bg-slate-200">
      {imgs.map((src, i) => (
        <img key={i} src={src} alt={name}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${i === idx ? "opacity-100" : "opacity-0"}`} />
      ))}
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      {/* Dot indicators */}
      {imgs.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
          {imgs.map((_, i) => (
            <button key={i} onClick={e => { e.stopPropagation(); setIdx(i); }}
              className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? "bg-white w-4" : "bg-white/50"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function CampsiteCard({ site, onClick, vendorCount, isSaved, onToggleSave }: { 
  site: Campsite; onClick: () => void; vendorCount?: number; isSaved: boolean; onToggleSave: () => void;
}) {
  function handleShare(e: React.MouseEvent) {
    e.stopPropagation();
    const url = `${window.location.origin}/campsites?spot=${site.id}`;
    const text = `🏕️ ${site.name}${site.location ? ` — ${site.location}` : ""}\n\nCheck out this campsite on Pacak Khemah!`;
    if (navigator.share) {
      navigator.share({ title: site.name, text, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      alert("Link copied!");
    }
  }

  return (
    <div onClick={onClick}
      className="group bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer">
      <div className="relative">
        <CarouselImage images={site.carousel || []} name={site.name} />
        {/* Category badge */}
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-[9px] font-black uppercase text-[#062c24] shadow-sm">
          {CATEGORIES.find(c => c.id === site.category)?.emoji || "🏕️"} {site.category || "Campsite"}
        </div>
        {/* Top right actions */}
        <div className="absolute top-4 right-4 flex gap-1.5">
          <button onClick={(e) => { e.stopPropagation(); onToggleSave(); }}
            className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm transition-all ${
              isSaved ? "bg-red-500 text-white" : "bg-black/30 text-white/80 hover:bg-red-500 hover:text-white"
            }`}>
            <i className={`fas fa-heart text-[10px]`}></i>
          </button>
          <button onClick={handleShare}
            className="w-8 h-8 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white/80 hover:bg-white hover:text-[#062c24] transition-all">
            <i className="fas fa-share-alt text-[10px]"></i>
          </button>
        </div>
        {/* Vendor count badge */}
        {vendorCount !== undefined && vendorCount > 0 && (
          <div className="absolute top-4 left-4 mt-8 bg-emerald-500 text-white px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase shadow-sm">
            <i className="fas fa-store mr-1"></i>{vendorCount} vendor{vendorCount > 1 ? "s" : ""} nearby
          </div>
        )}
        {/* Name overlay on image */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="text-lg font-black text-white uppercase leading-tight drop-shadow-lg">{site.name}</h3>
          {site.location && (
            <p className="text-[10px] text-white/80 font-medium flex items-center gap-1 mt-0.5">
              <i className="fas fa-map-pin text-emerald-400"></i> {site.location}
              {site.state && <span className="ml-1 opacity-60">• {site.state}</span>}
            </p>
          )}
        </div>
      </div>

      <div className="p-4">
        {site.fee && (
          <div className="mb-3 inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase border border-emerald-100">
            <i className="fas fa-ticket-alt text-[8px]"></i> RM {site.fee} / person
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <a href={site.direction || "#"} target="_blank" rel="noreferrer"
            onClick={e => e.stopPropagation()}
            className="flex items-center justify-center gap-1.5 bg-slate-50 text-slate-600 py-3 rounded-xl text-[9px] font-black uppercase hover:bg-emerald-50 hover:text-emerald-700 transition-colors border border-slate-100">
            <i className="fas fa-location-arrow"></i> Directions
          </a>
          <Link href={`/directory?search=${encodeURIComponent(site.state || site.location || site.name)}`}
            onClick={e => e.stopPropagation()}
            className="flex items-center justify-center gap-1.5 bg-emerald-50 text-emerald-700 py-3 rounded-xl text-[9px] font-black uppercase hover:bg-emerald-100 transition-colors border border-emerald-100">
            <i className="fas fa-campground"></i> Rent Gear
          </Link>
          <a href={site.whatsapp || "#"} target="_blank" rel="noreferrer"
            onClick={e => e.stopPropagation()}
            className="flex items-center justify-center gap-1.5 bg-[#062c24] text-white py-3 rounded-xl text-[9px] font-black uppercase hover:bg-emerald-800 transition-colors">
            <i className="fab fa-whatsapp"></i> Contact
          </a>
        </div>
      </div>
    </div>
  );
}

function DetailSheet({ site, onClose, vendors }: { site: Campsite; onClose: () => void; vendors: (Vendor & { km?: number })[] }) {
  const [imgIdx, setImgIdx] = useState(0);
  const imgs = site.carousel?.length ? site.carousel : ["/pacak-khemah.png"];

  return (
    <div className="fixed inset-0 z-[200] flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative bg-white rounded-t-[2.5rem] max-h-[90vh] flex flex-col shadow-2xl z-10 overflow-hidden">
        {/* Image */}
        <div className="relative h-64 flex-shrink-0">
          {imgs.map((src, i) => (
            <img key={i} src={src} alt={site.name}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${i === imgIdx ? "opacity-100" : "opacity-0"}`} />
          ))}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* Close */}
          <button onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-red-500 transition-colors">
            <i className="fas fa-times"></i>
          </button>

          {/* Thumbnails */}
          {imgs.length > 1 && (
            <div className="absolute bottom-4 left-4 flex gap-2">
              {imgs.map((src, i) => (
                <button key={i} onClick={() => setImgIdx(i)}
                  className={`w-10 h-10 rounded-xl overflow-hidden border-2 transition-all ${i === imgIdx ? "border-white scale-110" : "border-white/30 opacity-60"}`}>
                  <img src={src} className="w-full h-full object-cover" alt="" />
                </button>
              ))}
            </div>
          )}

          {/* Name on image */}
          <div className="absolute bottom-4 right-4 text-right">
            <h2 className="text-2xl font-black text-white uppercase drop-shadow-lg leading-tight">{site.name}</h2>
            {site.location && (
              <p className="text-[10px] text-white/80 flex items-center justify-end gap-1 mt-1">
                <i className="fas fa-map-pin text-emerald-400"></i> {site.location}
              </p>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5" style={{ scrollbarWidth: "none" }}>

          {/* Tags row */}
          <div className="flex flex-wrap gap-2">
            {site.category && (
              <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-[9px] font-black uppercase border border-emerald-100">
                {CATEGORIES.find(c => c.id === site.category)?.emoji} {site.category}
              </span>
            )}
            {site.fee && (
              <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-[9px] font-black uppercase border border-amber-100">
                <i className="fas fa-ticket-alt mr-1"></i> RM {site.fee} / pax
              </span>
            )}
          </div>

          {/* Description */}
          {site.description && (
            <p className="text-sm text-slate-600 leading-relaxed font-medium">{site.description}</p>
          )}

          {/* Facilities */}
          {site.facilities && site.facilities.length > 0 && (
            <div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Facilities</h4>
              <div className="flex flex-wrap gap-2">
                {site.facilities.map((f, i) => (
                  <span key={i} className="bg-slate-50 text-slate-600 px-3 py-1.5 rounded-xl text-[10px] font-bold border border-slate-100">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <a href={site.direction || "#"} target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-2 bg-slate-50 text-slate-700 py-4 rounded-2xl text-[10px] font-black uppercase hover:bg-emerald-50 hover:text-emerald-700 transition-colors border border-slate-100">
              <i className="fas fa-location-arrow text-emerald-500"></i> Waze / Maps
            </a>
            <a href={site.whatsapp || "#"} target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-2 bg-[#062c24] text-white py-4 rounded-2xl text-[10px] font-black uppercase hover:bg-emerald-800 transition-colors shadow-lg">
              <i className="fab fa-whatsapp"></i> Contact Site
            </a>
          </div>

          {/* Nearby Gear Rental */}
          {vendors.length > 0 ? (
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Nearby Gear Rental</p>
              <div className="space-y-2">
                {vendors.slice(0, 3).map(v => (
                  <Link key={v.id} href={v.slug ? `/shop/${v.slug}` : `/shop?v=${v.id}`}
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-emerald-50 transition-colors">
                    <img src={v.logo || v.image || "/pacak-khemah.png"} alt={v.name}
                      className="w-10 h-10 rounded-xl object-cover flex-shrink-0 bg-slate-200" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-[#062c24] truncate">{v.name}</p>
                      <div className="flex items-center gap-2">
                        {(v.rating ?? 0) > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold text-slate-500">
                            <i className="fas fa-star text-amber-400 text-[9px]"></i>
                            {v.rating!.toFixed(1)}{v.reviewCount ? ` (${v.reviewCount})` : ""}
                          </span>
                        )}
                        {v.km != null && (
                          <span className="text-[9px] text-slate-400">~{Math.round(v.km)} km</span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 flex-shrink-0">View →</span>
                  </Link>
                ))}
                {vendors.length > 3 && (
                  <Link href={`/directory?search=${encodeURIComponent(site.location || site.state || "")}`}
                    className="block text-center text-[10px] font-bold text-emerald-600 py-1">
                    +{vendors.length - 3} more vendors →
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <Link href={`/directory?search=${encodeURIComponent(site.state || site.location || site.name)}`}
              className="block w-full bg-emerald-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase text-center hover:bg-emerald-700 transition-colors shadow-lg">
              <i className="fas fa-campground mr-2"></i>Rent Camping Gear Nearby
            </Link>
          )}

          {/* Share */}
          <button onClick={() => {
            const url = `${window.location.origin}/campsites?spot=${site.id}`;
            const text = `🏕️ ${site.name}${site.location ? ` — ${site.location}` : ""}\n\nCheck out this campsite!`;
            if (navigator.share) { navigator.share({ title: site.name, text, url }).catch(() => {}); }
            else { navigator.clipboard.writeText(url); }
          }}
            className="w-full bg-slate-50 text-slate-600 py-3 rounded-2xl text-[10px] font-black uppercase text-center hover:bg-slate-100 transition-colors border border-slate-100">
            <i className="fas fa-share-alt mr-2"></i>Share This Campsite
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CampsitesPage() {
  const [allCampsites, setAllCampsites] = useState<Campsite[]>([]);
  const [filtered, setFiltered] = useState<Campsite[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeState, setActiveState] = useState("All States");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Campsite | null>(null);
  const [error, setError] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [allVendors, setAllVendors] = useState<Vendor[]>([]);
  const [showSavedOnly, setShowSavedOnly] = useState(false);

  // Load saved spots from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("pk_saved_campsites") || "[]");
      setSavedIds(saved);
    } catch { /* ignore */ }
  }, []);

  function toggleSave(id: string) {
    setSavedIds(prev => {
      const next = prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id];
      localStorage.setItem("pk_saved_campsites", JSON.stringify(next));
      return next;
    });
  }

  // Load campsites
  useEffect(() => {
    getDocs(collection(db, "campsites"))
      .then(snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Campsite));
        setAllCampsites(data);
        setFiltered(data);

        // Deep link: ?spot=id
        const params = new URLSearchParams(window.location.search);
        const spotId = params.get("spot");
        if (spotId) {
          const found = data.find(c => c.id === spotId);
          if (found) setSelected(found);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  // Fetch full vendor docs for matching
  useEffect(() => {
    getDocs(query(collection(db, "vendors"), where("status", "==", "approved")))
      .then(snap => setAllVendors(snap.docs.map(d => ({ id: d.id, ...d.data() } as Vendor))))
      .catch(() => {});
  }, []);

  function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function extractCoords(url: string): { lat: number; lng: number } | null {
    if (!url) return null;
    const q = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (q) return { lat: +q[1], lng: +q[2] };
    const at = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (at) return { lat: +at[1], lng: +at[2] };
    const ll = url.match(/ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (ll) return { lat: +ll[1], lng: +ll[2] };
    return null;
  }

  function getMatchingVendors(site: Campsite): (Vendor & { km?: number })[] {
    // Exclude vendors in vacation mode
    const activeVendors = allVendors.filter(v => !v.is_vacation);

    // Resolve campsite coordinates: stored fields first, then parse from direction URL
    const siteCoords = (site.lat != null && site.lng != null)
      ? { lat: site.lat, lng: site.lng }
      : extractCoords(site.direction || "");

    if (siteCoords) {
      // Primary: vendors with pinned location within 50 km
      const coordMatches = activeVendors
        .filter(v => v.locationLat != null && v.locationLng != null)
        .map(v => ({ ...v, km: haversineKm(siteCoords.lat, siteCoords.lng, v.locationLat!, v.locationLng!) }))
        .filter(v => v.km <= 50)
        .sort((a, b) => a.km - b.km);

      // Fallback: vendors without a pinned location but with text-matching city/area
      const coordMatchIds = new Set(coordMatches.map(v => v.id));
      const loc = (site.location || "").toLowerCase();
      const state = (site.state || "").toLowerCase();
      const textMatches = activeVendors
        .filter(v => !coordMatchIds.has(v.id) && v.locationLat == null)
        .filter(v => {
          const keys = [(v.city || "").toLowerCase(), ...(v.areas || []).map(a => a.toLowerCase().trim())].filter(Boolean);
          return keys.some(k => loc.includes(k) || k.includes(loc) || state.includes(k) || k.includes(state));
        });

      return [...coordMatches, ...textMatches];
    }

    // No campsite coordinates at all — text match only
    const loc = (site.location || "").toLowerCase();
    const state = (site.state || "").toLowerCase();
    return activeVendors.filter(v => {
      const keys = [(v.city || "").toLowerCase(), ...(v.areas || []).map(a => a.toLowerCase().trim())].filter(Boolean);
      return keys.some(k => loc.includes(k) || k.includes(loc) || state.includes(k) || k.includes(state));
    });
  }

  function getVendorCount(site: Campsite): number {
    return getMatchingVendors(site).length;
  }

  // Filter logic
  useEffect(() => {
    let result = allCampsites;
    if (showSavedOnly) result = result.filter(c => savedIds.includes(c.id));
    if (activeCategory !== "all") result = result.filter(c => c.category === activeCategory);
    if (activeState !== "All States") result = result.filter(c =>
      c.state === activeState ||
      c.location?.toLowerCase().includes(activeState.toLowerCase())
    );
    if (search.trim()) result = result.filter(c =>
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.location?.toLowerCase().includes(search.toLowerCase()) ||
      c.state?.toLowerCase().includes(search.toLowerCase())
    );
    setFiltered(result);
  }, [activeCategory, activeState, search, allCampsites, showSavedOnly, savedIds]);

  // Category counts
  const counts: Record<string, number> = { all: allCampsites.length };
  allCampsites.forEach(c => {
    if (c.category) counts[c.category] = (counts[c.category] || 0) + 1;
  });

  // Derive available states from actual campsite data (state field OR location address)
  const availableStates: string[] = ["All States"];
  const stateCountMap: Record<string, number> = {};
  allCampsites.forEach(c => {
    // Prefer explicit state field; fall back to matching state name in location address
    const matched = c.state || STATES.slice(1).find(s =>
      c.location?.toLowerCase().includes(s.toLowerCase())
    );
    if (matched) stateCountMap[matched] = (stateCountMap[matched] || 0) + 1;
  });
  // Keep original STATES order, only include states with at least 1 campsite
  STATES.slice(1).forEach(s => { if (stateCountMap[s]) availableStates.push(s); });

  return (
    <div className="pb-28 min-h-screen" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: "#f8fafc" }}>

      {/* Hero */}
      <header className="relative text-white overflow-hidden rounded-b-[3rem] shadow-2xl mb-0"
        style={{ background: "linear-gradient(135deg, #1a3c34 0%, #0f4c3a 40%, #1b6b4f 100%)" }}>
        {/* Nature-inspired dot pattern instead of cubes */}
        <div className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
        {/* Decorative glow */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-teal-300/10 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-2xl mx-auto px-6 pt-14 pb-20 text-center">
          {/* Back to directory */}
          <div className="flex justify-start mb-6">
            <Link href="/directory"
              className="w-10 h-10 bg-white/10 backdrop-blur-md border border-white/10 rounded-xl flex items-center justify-center text-white/70 hover:bg-white hover:text-[#062c24] transition-all">
              <i className="fas fa-arrow-left text-sm"></i>
            </Link>
          </div>

          <div className="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-400/20 px-4 py-1.5 rounded-full text-amber-200 text-[10px] font-black uppercase tracking-widest mb-4">
            <i className="fas fa-campground"></i> Campsite Directory
          </div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight mb-3">Find Your Spot</h1>
          <p className="text-sm font-medium text-emerald-200/80">Curated campsites & hidden gems across Malaysia</p>
          <p className="text-[9px] font-medium text-white/40 mt-2">Community suggestions only — we do not operate or manage these sites</p>

          {/* Search */}
          <div className="mt-8 relative max-w-sm mx-auto">
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or location..."
              className="w-full bg-white text-slate-700 pl-11 pr-4 py-4 rounded-2xl text-sm font-semibold outline-none shadow-xl placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-400" />
            {search && (
              <button onClick={() => setSearch("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500">
                <i className="fas fa-times"></i>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Category Filter */}
      <div className="sticky top-0 z-40 bg-slate-50/95 backdrop-blur-md border-b border-slate-200 py-3 px-4 space-y-2">
        <div className="flex gap-2 overflow-x-auto justify-center" style={{ scrollbarWidth: "none" }}>
          {CATEGORIES.map(cat => {
            const count = counts[cat.id] || 0;
            const isActive = activeCategory === cat.id;
            return (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                className={`flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-black uppercase transition-all ${isActive ? "bg-[#062c24] text-white shadow-lg scale-105" : "bg-white border border-slate-200 text-slate-600 hover:bg-emerald-50 hover:border-emerald-200"}`}>
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
                {!loading && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black ${isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {/* State filter + Saved toggle */}
        <div className="flex gap-2 items-center justify-center">
          <select value={activeState} onChange={e => setActiveState(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-bold text-slate-600 outline-none focus:border-emerald-400 appearance-none">
            {availableStates.map(s => (
              <option key={s} value={s}>{s}{stateCountMap[s] ? ` (${stateCountMap[s]})` : ""}</option>
            ))}
          </select>
          {savedIds.length > 0 && (
            <button onClick={() => setShowSavedOnly(!showSavedOnly)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                showSavedOnly ? "bg-red-500 text-white" : "bg-white border border-slate-200 text-slate-500 hover:border-red-300"
              }`}>
              <i className="fas fa-heart text-[8px]"></i> Saved ({savedIds.length})
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <main className="max-w-6xl mx-auto px-4 pt-6">

        {/* Results count */}
        {!loading && !error && (
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
            {filtered.length} spot{filtered.length !== 1 ? "s" : ""} found
            {search && ` for "${search}"`}
          </p>
        )}

        {error ? (
          <div className="text-center py-20">
            <i className="fas fa-exclamation-circle text-4xl text-red-300 mb-4 block"></i>
            <p className="text-sm font-black text-slate-400 uppercase">Unable to load campsites</p>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <i className="fas fa-map-marked-alt text-5xl text-slate-200 mb-4 block"></i>
            <p className="text-sm font-black text-slate-400 uppercase mb-2">No spots found</p>
            <button onClick={() => { setSearch(""); setActiveCategory("all"); }}
              className="text-[10px] font-black text-emerald-600 underline uppercase">Clear filters</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((site, i) => (
              <div key={site.id} className="stagger-in" style={{ animationDelay: `${i * 60}ms` }}>
                <CampsiteCard 
                  site={site} 
                  onClick={() => setSelected(site)} 
                  vendorCount={getVendorCount(site)}
                  isSaved={savedIds.includes(site.id)}
                  onToggleSave={() => toggleSave(site.id)}
                />
              </div>
            ))}
          </div>
        )}
      </main>

      

      {/* Detail Sheet */}
      {selected && <DetailSheet site={selected} onClose={() => setSelected(null)} vendors={getMatchingVendors(selected)} />}

      {/* Suggest a Campsite */}
      {!loading && !error && (
        <div className="max-w-2xl mx-auto px-6 pt-8">
          <div className="bg-gradient-to-br from-[#062c24] to-emerald-800 rounded-2xl p-6 text-white text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "20px 20px" }}></div>
            <div className="relative z-10">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="fas fa-plus text-lg"></i>
              </div>
              <h3 className="text-sm font-black uppercase mb-1">Know a Great Spot?</h3>
              <p className="text-xs text-white/60 mb-4">Suggest a campsite and help fellow campers discover it!</p>
              <a href={`https://wa.me/601136904336?text=${encodeURIComponent("Hi Pacak Khemah! 🏕️\n\nI'd like to suggest a campsite:\n\nName: \nLocation: \nState: \nCategory (Beach/River/Hilltop/Waterfall): \nFee (if any): \nGoogle Maps Link: \nDescription: ")}`}
                target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 bg-white text-[#062c24] px-6 py-3 rounded-xl font-black uppercase text-xs hover:bg-emerald-50 transition-colors">
                <i className="fab fa-whatsapp text-emerald-600"></i> Suggest via WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <footer className="max-w-2xl mx-auto px-6 pt-10 pb-6">
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <i className="fas fa-info-circle text-amber-500 text-sm"></i>
            <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Disclaimer</span>
          </div>
          <p className="text-[10px] text-amber-700/80 font-medium leading-relaxed">
            All campsites listed here are community suggestions for informational purposes only.
            Pacak Khemah does not own, operate, manage, or handle bookings for any of these locations.
            Please verify details, conditions, and availability directly with the campsite operators before visiting.
            Visit at your own risk.
          </p>
        </div>
        <p className="text-[8px] text-slate-300 uppercase text-center mt-6">© 2026 Pacak Khemah. All rights reserved.</p>
      </footer>

    <BottomNav />

      <style jsx>{`
        @keyframes staggerIn {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .stagger-in {
          opacity: 0;
          animation: staggerIn 0.4s ease-out forwards;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .skeleton {
          background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
      `}</style>
    </div>
  );
}