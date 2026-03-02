"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import BottomNav from "@/components/BottomNav";


type Campsite = {
  id: string;
  name: string;
  location?: string;
  category?: string;
  carousel?: string[];
  direction?: string;
  whatsapp?: string;
  description?: string;
  facilities?: string[];
  fee?: string | number;
};

const CATEGORIES = [
  { id: "all", label: "All Spots", emoji: "🏕️" },
  { id: "seaside", label: "Beach", emoji: "🌊" },
  { id: "river", label: "River", emoji: "🛶" },
  { id: "hilltop", label: "Hilltop", emoji: "⛰️" },
  { id: "waterfall", label: "Waterfall", emoji: "💧" },
];

function SkeletonCard() {
  return (
    <div className="rounded-[2rem] overflow-hidden bg-white border border-slate-100 shadow-sm animate-pulse">
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

function CampsiteCard({ site, onClick }: { site: Campsite; onClick: () => void }) {
  return (
    <div onClick={onClick}
      className="group bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer">
      <div className="relative">
        <CarouselImage images={site.carousel || []} name={site.name} />
        {/* Category badge */}
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-[9px] font-black uppercase text-[#062c24] shadow-sm">
          {CATEGORIES.find(c => c.id === site.category)?.emoji || "🏕️"} {site.category || "Campsite"}
        </div>
        {/* Name overlay on image */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="text-lg font-black text-white uppercase leading-tight drop-shadow-lg">{site.name}</h3>
          {site.location && (
            <p className="text-[10px] text-white/80 font-medium flex items-center gap-1 mt-0.5">
              <i className="fas fa-map-pin text-emerald-400"></i> {site.location}
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
        <div className="grid grid-cols-2 gap-2">
          <a href={site.direction || "#"} target="_blank" rel="noreferrer"
            onClick={e => e.stopPropagation()}
            className="flex items-center justify-center gap-2 bg-slate-50 text-slate-600 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-50 hover:text-emerald-700 transition-colors border border-slate-100">
            <i className="fas fa-location-arrow"></i> Directions
          </a>
          <a href={site.whatsapp || "#"} target="_blank" rel="noreferrer"
            onClick={e => e.stopPropagation()}
            className="flex items-center justify-center gap-2 bg-[#062c24] text-white py-3 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-800 transition-colors">
            <i className="fab fa-whatsapp"></i> Contact
          </a>
        </div>
      </div>
    </div>
  );
}

function DetailSheet({ site, onClose }: { site: Campsite; onClose: () => void }) {
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
        </div>
      </div>
    </div>
  );
}

export default function CampsitesPage() {
  const [allCampsites, setAllCampsites] = useState<Campsite[]>([]);
  const [filtered, setFiltered] = useState<Campsite[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Campsite | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getDocs(collection(db, "campsites"))
      .then(snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Campsite));
        setAllCampsites(data);
        setFiltered(data);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let result = allCampsites;
    if (activeCategory !== "all") result = result.filter(c => c.category === activeCategory);
    if (search.trim()) result = result.filter(c =>
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.location?.toLowerCase().includes(search.toLowerCase())
    );
    setFiltered(result);
  }, [activeCategory, search, allCampsites]);

  // Category counts
  const counts: Record<string, number> = { all: allCampsites.length };
  allCampsites.forEach(c => {
    if (c.category) counts[c.category] = (counts[c.category] || 0) + 1;
  });

  return (
    <div className="pb-28 min-h-screen" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: "#f8fafc" }}>

      {/* Hero */}
      <header className="relative bg-[#062c24] text-white overflow-hidden rounded-b-[3rem] shadow-2xl mb-0">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/cubes.png')" }} />
        <div className="relative z-10 max-w-2xl mx-auto px-6 pt-14 pb-20 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/10 px-4 py-1.5 rounded-full text-emerald-300 text-[10px] font-black uppercase tracking-widest mb-4">
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
      <div className="sticky top-0 z-40 bg-slate-50/95 backdrop-blur-md border-b border-slate-200 py-3 px-4">
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
                <CampsiteCard site={site} onClick={() => setSelected(site)} />
              </div>
            ))}
          </div>
        )}
      </main>

      

      {/* Detail Sheet */}
      {selected && <DetailSheet site={selected} onClose={() => setSelected(null)} />}

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
      `}</style>
    </div>
  );
}