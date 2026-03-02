"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import {
  collection, getDocs, query, where, orderBy, limit, doc, getDoc,
} from "firebase/firestore";
import BottomNav from "@/components/BottomNav"

// --- TYPES ---
type Vendor = {
  id: string;
  name: string;
  logo?: string;
  image?: string;
  city?: string;
  areas?: string[];
  pickup?: string[];
  tagline?: string;
  slug?: string;
  credits?: number;
  createdAt?: any;
  is_vacation?: boolean;
  status?: string;
};

type Event = {
  id: string;
  name: string;
  poster: string;
  link: string;
  organizer?: string;
};

type Announcement = {
  isActive: boolean;
  message: string;
  type: "info" | "warning" | "promo";
};

const LOAD_STEP = 12;

const announcementThemes = {
  info:    { bg: "bg-blue-600",    icon: "fa-info-circle" },
  warning: { bg: "bg-amber-500",   icon: "fa-exclamation-triangle" },
  promo:   { bg: "bg-emerald-600", icon: "fa-tag" },
};

// --- VENDOR CARD ---
function VendorCard({ vendor, index }: { vendor: Vendor; index: number }) {
  const logo = vendor.logo || vendor.image || "https://via.placeholder.com/150";
  const city = vendor.city || "Malaysia";
  const pickups = vendor.pickup && vendor.pickup.length > 0
    ? vendor.pickup.slice(0, 2).join(", ") + (vendor.pickup.length > 2 ? "..." : "")
    : city;
  const shopPath = vendor.slug ? `/shop/${vendor.slug}` : `/shop?v=${vendor.id}`;
  const isNew = vendor.createdAt &&
    new Date().getTime() - vendor.createdAt.toDate().getTime() < 30 * 24 * 60 * 60 * 1000;

  return (
    <Link href={shopPath}
      className="group bg-white p-5 rounded-[2rem] border border-slate-100 hover:border-emerald-300 shadow-sm hover:shadow-xl transition-all relative overflow-hidden flex flex-col h-full cursor-pointer stagger-in"
      style={{ animationDelay: `${index * 60}ms` }}>
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-1">
          {isNew && <span className="bg-blue-100 text-blue-600 text-[8px] font-black px-2 py-1 rounded-lg uppercase tracking-wider">New</span>}
        </div>
        <span className="bg-slate-50 text-slate-500 border border-slate-100 text-[8px] font-black px-2 py-1 rounded-lg uppercase flex items-center gap-1">
          <i className="fas fa-map-marker-alt text-emerald-500"></i> {city}
        </span>
      </div>
      <div className="w-full h-32 flex items-center justify-center mb-4 bg-slate-50/50 rounded-2xl p-4 group-hover:bg-slate-50 transition-colors">
        <img src={logo} className="w-full h-full object-contain drop-shadow-sm group-hover:scale-105 transition-transform duration-500" alt={vendor.name} />
      </div>
      <div className="text-center mt-auto">
        <h3 className="text-lg font-black uppercase text-[#062c24] leading-tight mb-2 group-hover:text-emerald-700 transition-colors">{vendor.name}</h3>
        <p className="text-[10px] font-medium text-slate-400 italic line-clamp-1 mb-4">"{vendor.tagline || "Ready for adventure"}"</p>
        <div className="w-12 h-0.5 bg-emerald-500/20 mx-auto mb-4 rounded-full"></div>
        <div className="flex items-center justify-center gap-2 text-[9px] font-bold text-slate-500 bg-slate-50 py-2 rounded-xl border border-slate-100 group-hover:border-emerald-100 transition-colors">
          <i className="fas fa-box text-emerald-500"></i>
          <span className="truncate max-w-[150px]">{pickups}</span>
        </div>
      </div>
    </Link>
  );
}

// --- MAIN PAGE ---
export default function DirectoryPage() {
  const [allVendors, setAllVendors] = useState<Vendor[]>([]);
  const [filteredVendors, setFilteredVendors] = useState<Vendor[]>([]);
  const [visibleCount, setVisibleCount] = useState(LOAD_STEP);
  const [locations, setLocations] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [locating, setLocating] = useState(false);

  // Hidden admin access — tap logo 5 times
  const [logoTaps, setLogoTaps] = useState(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleLogoTap() {
    const next = logoTaps + 1;
    setLogoTaps(next);
    // Reset after 3s of inactivity
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => setLogoTaps(0), 3000);
    if (next >= 5) {
      setLogoTaps(0);
      window.location.href = "/admin";
    }
  }

  // Load all data on mount
  useEffect(() => {
    loadVendors();
    loadEvents();
    loadAnnouncement();
  }, []);

  async function loadVendors() {
    try {
      const q = query(collection(db, "vendors"), where("status", "==", "approved"));
      const snap = await getDocs(q);
      const vendors = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Vendor))
        .filter((v) => v.credits && v.credits > 0 && v.is_vacation !== true)
        .sort((a, b) => (b.credits || 0) - (a.credits || 0));

      setAllVendors(vendors);
      setFilteredVendors(vendors);

      // Build location filters
      const locs = new Set<string>();
      vendors.forEach((v) => {
        if (v.city) locs.add(v.city.trim());
        if (v.areas) v.areas.forEach((a) => locs.add(a.trim()));
      });
      setLocations(Array.from(locs).sort());
    } catch (e) {
      console.error(e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  async function loadEvents() {
    try {
      const q = query(collection(db, "events"), orderBy("createdAt", "desc"), limit(4));
      const snap = await getDocs(q);
      setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Event)));
    } catch (e) {
      console.log("No events");
    }
  }

  async function loadAnnouncement() {
    try {
      const snap = await getDoc(doc(db, "settings", "global_announcement"));
      if (snap.exists()) {
        const data = snap.data() as Announcement;
        if (data.isActive && data.message) setAnnouncement(data);
      }
    } catch (e) {
      console.log("No announcement");
    }
  }

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  // Debounced filter — runs 150ms after user stops typing
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const t = searchTerm.toLowerCase();
      setFilteredVendors(
        t
          ? allVendors.filter((v) =>
              v.name.toLowerCase().includes(t) ||
              (v.city && v.city.toLowerCase().includes(t)) ||
              (v.areas && v.areas.some((a) => a.toLowerCase().includes(t))) ||
              (v.tagline && v.tagline.toLowerCase().includes(t))
            )
          : allVendors
      );
      setVisibleCount(LOAD_STEP);
      if (!searchTerm) return;
      setActiveFilter("all");
    }, 150);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchTerm, allVendors]);

  function filterBy(loc: string) {
    setActiveFilter(loc);
    setSearchTerm("");
    setFilteredVendors(
      loc === "all"
        ? allVendors
        : allVendors.filter(
            (v) =>
              (v.city && v.city.includes(loc)) ||
              (v.areas && v.areas.some((a) => a.includes(loc)))
          )
    );
    setVisibleCount(LOAD_STEP);
  }

  async function locateMe() {
    if (!navigator.geolocation) return alert("Geolocation not supported");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await res.json();
          const city = data.address.city || data.address.town || data.address.village || data.address.state;
          if (city) handleSearch(city);
          else alert("Could not determine city.");
        } catch {
          alert("Location error.");
        } finally {
          setLocating(false);
        }
      },
      () => { alert("Permission denied."); setLocating(false); }
    );
  }

  const displayList = filteredVendors.slice(0, visibleCount);
  const annTheme = announcement ? announcementThemes[announcement.type] || announcementThemes.info : null;

  return (
    <div className="pb-24" style={{ fontFamily: "'Inter', sans-serif", color: "#062c24", backgroundColor: "#f8fafc" }}>

      {/* Announcement Banner */}
      {announcement && showAnnouncement && annTheme && (
        <div className={`relative z-50 px-4 py-3 text-white text-center shadow-md ${annTheme.bg}`}>
          <div className="max-w-4xl mx-auto flex items-center justify-center gap-3">
            <span className="bg-white/20 p-1.5 rounded-lg text-xs"><i className={`fas ${annTheme.icon}`}></i></span>
            <p className="text-[10px] font-bold uppercase tracking-widest">{announcement.message}</p>
            <button onClick={() => setShowAnnouncement(false)} className="absolute right-4 text-white/60 hover:text-white">
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-[#062c24] text-white pt-8 pb-16 rounded-b-[2.5rem] relative overflow-hidden shadow-xl">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="relative z-20 px-6 flex justify-between items-center mb-10">
          <div className="w-12 h-12 rounded-full overflow-hidden shadow-sm cursor-pointer select-none" onClick={handleLogoTap}>
            <img src="/pacak-khemah.png" className="w-full h-full object-contain" alt="Logo" draggable={false} />
          </div>
          <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-[#062c24] transition-all flex items-center gap-2">
            <i className="fas fa-plus-circle text-emerald-400"></i> List Your Gear
          </button>
        </div>
        <div className="relative z-10 max-w-xl mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-6xl tracking-tighter mb-4 leading-none text-white font-black uppercase">
            PACAK <span className="text-emerald-400">KHEMAH</span>
          </h1>
          <div className="flex flex-col gap-1 mb-8">
            <p className="text-sm font-bold uppercase tracking-wide text-emerald-100">Rent the Gear, Camp the Wild, Heal the Soul</p>
            <p className="text-xs font-medium text-emerald-200/80">Outdoor Gear Rental Platform</p>
          </div>
          <div className="relative max-w-sm mx-auto">
            <input type="text" value={searchTerm} onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search location or gear..."
              className="w-full bg-white text-[#062c24] py-4 pl-12 pr-12 rounded-xl shadow-xl border-none outline-none font-bold text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 transition-all" />
            <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-300"></i>
            <button onClick={locateMe} className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-slate-100 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all" title="Find near me">
              <i className={`fas ${locating ? "fa-spinner fa-spin text-emerald-500" : "fa-location-crosshairs"}`}></i>
            </button>
          </div>
          <div className="mt-8">
            <Link href="/campsites" className="inline-flex items-center gap-2 text-[10px] font-bold uppercase text-emerald-400 hover:text-white transition-colors border-b border-emerald-400/30 pb-0.5 hover:border-white">
              <i className="fas fa-map-marked-alt"></i> Don't know where to "Pacak" yet?
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 -mt-6 relative z-30 space-y-8">

        {/* Filters */}
        <div className="sticky top-0 z-40 bg-[#f8fafc]/95 backdrop-blur-xl py-4 -mx-4 px-4 border-b border-slate-100/50 shadow-sm">
          <div className="flex justify-between items-end px-1 mb-3">
            <h2 className="text-lg font-black text-[#062c24] uppercase tracking-tight">Explore Hubs</h2>
            <span className="text-[9px] font-bold text-white bg-[#062c24] px-2 py-0.5 rounded-md">
              {loading ? "Loading..." : `${allVendors.length} Active Hubs`}
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {loading ? (
              <button className="px-6 py-2.5 bg-slate-100 rounded-xl text-[10px] font-black uppercase text-slate-300 animate-pulse">Loading Filters...</button>
            ) : (
              <>
                <button onClick={() => filterBy("all")}
                  className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase shrink-0 transition-all border min-h-[44px] ${activeFilter === "all" ? "bg-[#062c24] text-white border-[#062c24] shadow-lg" : "bg-white text-slate-500 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"}`}>
                  All Locations
                </button>
                {locations.map((loc) => (
                  <button key={loc} onClick={() => filterBy(loc)}
                    className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase shrink-0 whitespace-nowrap transition-all border min-h-[44px] ${activeFilter === loc ? "bg-[#062c24] text-white border-[#062c24] shadow-lg" : "bg-white text-slate-500 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"}`}>
                    {loc}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Vendor Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <>
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-[2rem] border border-slate-100 h-64 skeleton"></div>
              ))}
            </>
          ) : loadError ? (
            <div className="col-span-full text-center py-20">
              <div className="w-20 h-20 bg-red-50 rounded-[2rem] flex items-center justify-center mx-auto mb-4 text-red-300 text-3xl">
                <i className="fas fa-wifi"></i>
              </div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Failed to load hubs</p>
              <button onClick={() => { setLoadError(false); setLoading(true); loadVendors(); }}
                className="px-6 py-3 bg-[#062c24] text-white rounded-xl text-[10px] font-black uppercase hover:bg-emerald-900 transition-all shadow-sm">
                <i className="fas fa-rotate-right mr-2"></i> Try Again
              </button>
            </div>
          ) : displayList.length === 0 ? (
            <div className="col-span-full text-center py-20">
              <div className="w-20 h-20 bg-slate-100 rounded-[2rem] flex items-center justify-center mx-auto mb-4 text-slate-300 text-3xl shadow-inner">
                <i className={searchTerm ? "fas fa-search" : activeFilter !== "all" ? "fas fa-map-marker-alt" : "fas fa-store"}></i>
              </div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                {searchTerm
                  ? `No results for "${searchTerm}"`
                  : activeFilter !== "all"
                  ? `No hubs in ${activeFilter} yet`
                  : "No active hubs yet"}
              </p>
              {(searchTerm || activeFilter !== "all") && (
                <button onClick={() => { setSearchTerm(""); filterBy("all"); }}
                  className="mt-4 px-6 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all">
                  <i className="fas fa-times mr-2"></i> Clear Filters
                </button>
              )}
            </div>
          ) : (
            displayList.map((vendor, i) => (
              <VendorCard key={vendor.id} vendor={vendor} index={i} />
            ))
          )}
        </div>

        {/* Load More */}
        {visibleCount < filteredVendors.length && (
          <div className="text-center pb-12">
            <button onClick={() => setVisibleCount((c) => c + LOAD_STEP)}
              className="bg-white border border-slate-200 text-slate-500 font-bold uppercase text-[10px] px-8 py-3 rounded-xl hover:bg-slate-50 hover:text-[#062c24] transition-all shadow-sm">
              Load More Hubs <i className="fas fa-chevron-down ml-2"></i>
            </button>
          </div>
        )}

        {/* Events */}
        {events.length > 0 && (
          <div className="pb-20">
            <div className="flex items-center gap-3 mb-6 px-2">
              <div className="h-px flex-1 bg-slate-200"></div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Whats Up? Malaysia</h3>
              <div className="h-px flex-1 bg-slate-200"></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {events.map((e) => (
                <a key={e.id} href={e.link} target="_blank" rel="noreferrer"
                  className="group bg-white rounded-[1.5rem] border border-slate-100 overflow-hidden hover:shadow-lg transition-all">
                  <div className="h-28 overflow-hidden relative">
                    <img src={e.poster} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={e.name} />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
                  </div>
                  <div className="p-4">
                    <h4 className="text-[10px] font-black text-[#062c24] uppercase leading-tight line-clamp-2">{e.name}</h4>
                    <p className="text-[8px] font-bold text-slate-400 mt-1">{e.organizer || "Event"}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-10 border-t border-slate-200 bg-white">
        <h4 className="font-black text-[#062c24] text-lg mb-1">PACAK KHEMAH</h4>
        <p className="text-[9px] font-bold text-slate-400 uppercase mb-6">Rent the Gear, Camp the Wild, Heal the Soul</p>
        <div className="flex justify-center gap-4 mb-8">
          <button onClick={() => setShowModal(true)} className="px-5 py-2 bg-[#062c24] text-white rounded-full text-[9px] font-black uppercase hover:bg-emerald-900 shadow-lg transition-all">Become a Vendor</button>
        </div>
        <p className="text-[9px] text-slate-400 font-medium mb-4">
          Already a vendor? <Link href="/store" className="text-emerald-600 font-bold hover:underline">Log in here</Link>
        </p>
        <p className="text-[8px] text-slate-300 uppercase">© 2026 Pacak Khemah. All rights reserved.</p>
      </footer>

      {/* Join Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-[#062c24]/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl relative text-center">
            <button onClick={() => setShowModal(false)} className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">
              <i className="fas fa-times text-lg"></i>
            </button>
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6 text-emerald-600 text-2xl">
              <i className="fas fa-store"></i>
            </div>
            <h3 className="text-2xl font-black text-[#062c24] uppercase mb-2">Want to Rent Out Gear?</h3>
            <p className="text-xs text-slate-500 mb-8 font-medium">Join Malaysia&apos;s fastest growing camping gear rental network. We&apos;ll walk you through how it works.</p>
            <Link href="/register-vendor" className="block w-full bg-[#062c24] text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-900 shadow-lg transition-all">
              <i className="fas fa-rocket mr-2"></i> Get Started as Vendor
            </Link>
            <p className="text-[9px] text-slate-400 font-medium mt-4">
              Already a vendor?{" "}
              <Link href="/store" className="text-emerald-600 font-bold hover:underline">Log In</Link>
            </p>
          </div>
        </div>
      )}

      {/* Skeleton CSS */}
      <style jsx>{`
        .skeleton {
          background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes staggerIn {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .stagger-in {
          opacity: 0;
          animation: staggerIn 0.4s ease-out forwards;
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      <BottomNav />
    </div>
  );
}