"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import {
  collection, getDocs, query, where, orderBy, limit, doc, getDoc,
} from "firebase/firestore";
import BottomNav from "@/components/BottomNav";

// --- TYPES ---
type Vendor = {
  id: string; name: string; logo?: string; image?: string;
  city?: string; areas?: string[]; pickup?: string[];
  tagline?: string; slug?: string; credits?: number;
  createdAt?: any; is_vacation?: boolean; status?: string;
};
type GearItem = {
  id: string; name: string; price: number; img?: string;
  vendorId: string; category?: string; type?: string; deleted?: boolean;
};
type Event = { id: string; name: string; poster: string; link: string; organizer?: string };
type Announcement = { isActive: boolean; message: string; type: "info" | "warning" | "promo" };

const LOAD_STEP = 12;
const announcementThemes = {
  info: { bg: "bg-blue-600", icon: "fa-info-circle" },
  warning: { bg: "bg-amber-500", icon: "fa-exclamation-triangle" },
  promo: { bg: "bg-emerald-600", icon: "fa-tag" },
};

// --- VENDOR CARD ---
function VendorCard({ vendor, index }: { vendor: Vendor; index: number }) {
  const logo = vendor.logo || vendor.image || "/pacak-khemah.png";
  const city = vendor.city || "Malaysia";
  const pickups = vendor.pickup?.length ? vendor.pickup.slice(0, 2).join(", ") + (vendor.pickup.length > 2 ? "..." : "") : city;
  const shopPath = vendor.slug ? `/shop/${vendor.slug}` : `/shop?v=${vendor.id}`;
  const isNew = vendor.createdAt && Date.now() - vendor.createdAt.toDate().getTime() < 30 * 24 * 60 * 60 * 1000;

  return (
    <Link href={shopPath}
      className="group bg-white p-5 rounded-2xl border border-slate-100 hover:border-emerald-300 shadow-sm hover:shadow-xl transition-all flex flex-col h-full cursor-pointer stagger-in"
      style={{ animationDelay: `${index * 60}ms` }}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex gap-1">
          {isNew && <span className="bg-blue-100 text-blue-600 text-[8px] font-black px-2 py-1 rounded-lg uppercase">New</span>}
        </div>
        <span className="bg-slate-50 text-slate-500 border border-slate-100 text-[8px] font-black px-2 py-1 rounded-lg uppercase flex items-center gap-1">
          <i className="fas fa-map-marker-alt text-emerald-500"></i> {city}
        </span>
      </div>
      <div className="w-full h-28 flex items-center justify-center mb-3 bg-slate-50/50 rounded-xl p-3 group-hover:bg-slate-50 transition-colors">
        <img src={logo} className="w-full h-full object-contain drop-shadow-sm group-hover:scale-105 transition-transform duration-500" alt={vendor.name} />
      </div>
      <div className="text-center mt-auto">
        <h3 className="text-base font-black uppercase text-[#062c24] leading-tight mb-1 group-hover:text-emerald-700 transition-colors">{vendor.name}</h3>
        <p className="text-[10px] font-medium text-slate-400 italic line-clamp-1 mb-3">&ldquo;{vendor.tagline || "Ready for adventure"}&rdquo;</p>
        <div className="flex items-center justify-center gap-2 text-[9px] font-bold text-slate-500 bg-slate-50 py-2 rounded-lg border border-slate-100 group-hover:border-emerald-100 transition-colors">
          <i className="fas fa-box text-emerald-500"></i>
          <span className="truncate max-w-[150px]">{pickups}</span>
        </div>
      </div>
    </Link>
  );
}

// --- FEATURED GEAR CARD ---
function FeaturedGearCard({ item, vendorName, vendorSlug }: { item: GearItem; vendorName: string; vendorSlug: string }) {
  const shopPath = vendorSlug ? `/shop/${vendorSlug}` : `/shop?v=${item.vendorId}`;
  return (
    <Link href={shopPath}
      className="shrink-0 w-[280px] bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all group">
      <div className="h-48 bg-slate-100 overflow-hidden">
        <img src={item.img || "/pacak-khemah.png"} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={item.name} />
      </div>
      <div className="p-4">
        <h4 className="text-xs font-black uppercase text-[#062c24] truncate mb-1">{item.name}</h4>
        <div className="flex justify-between items-center">
          <p className="text-sm font-black text-emerald-600">RM {item.price}</p>
          <span className="text-[8px] font-bold text-slate-400 uppercase">{vendorName}</span>
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
  const [featuredGear, setFeaturedGear] = useState<{ item: GearItem; vendorName: string; vendorSlug: string }[]>([]);
  const [loadingGear, setLoadingGear] = useState(false);

  // Hidden admin access
  const [logoTaps, setLogoTaps] = useState(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleLogoTap() {
    const next = logoTaps + 1;
    setLogoTaps(next);
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => setLogoTaps(0), 3000);
    if (next >= 5) { setLogoTaps(0); window.location.href = "/admin"; }
  }

  // Debounced search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleSearchInput(val: string) {
    setSearchTerm(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => applySearch(val), 150);
  }

  useEffect(() => { loadVendors(); loadEvents(); loadAnnouncement(); }, []);

  async function loadVendors() {
    try {
      const q = query(collection(db, "vendors"), where("status", "==", "approved"));
      const snap = await getDocs(q);
      const vendors = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Vendor))
        .filter(v => v.credits && v.credits > 0 && v.is_vacation !== true)
        .sort((a, b) => (b.credits || 0) - (a.credits || 0));
      setAllVendors(vendors);
      setFilteredVendors(vendors);
      const locs = new Set<string>();
      vendors.forEach(v => {
        if (v.city) locs.add(v.city.trim());
        if (v.areas) v.areas.forEach(a => locs.add(a.trim()));
      });
      setLocations(Array.from(locs).sort());
    } catch (e) { console.error(e); setLoadError(true); }
    finally { setLoading(false); }
  }

  async function loadEvents() {
    try {
      const q = query(collection(db, "events"), orderBy("createdAt", "desc"), limit(4));
      const snap = await getDocs(q);
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Event)));
    } catch { }
  }

  async function loadAnnouncement() {
    try {
      const snap = await getDoc(doc(db, "settings", "global_announcement"));
      if (snap.exists()) {
        const data = snap.data() as Announcement;
        if (data.isActive && data.message) setAnnouncement(data);
      }
    } catch { }
  }

  // Load featured gear for vendors matching a filter
  async function loadFeaturedGear(vendorIds: string[], vendors: Vendor[]) {
    if (!vendorIds.length) { setFeaturedGear([]); return; }
    setLoadingGear(true);
    try {
      // Query gear from these vendors (Firestore 'in' limit: 30)
      const batchIds = vendorIds.slice(0, 30);
      const gSnap = await getDocs(query(collection(db, "gear"), where("vendorId", "in", batchIds)));
      const gear = gSnap.docs.map(d => ({ id: d.id, ...d.data() } as GearItem)).filter(g => !g.deleted && g.img);
      // Pick up to 8 random items, prioritizing packages
      const packages = gear.filter(g => g.type === "package" || g.category?.toLowerCase().includes("package"));
      const others = gear.filter(g => !packages.includes(g));
      const selected = [...packages.slice(0, 4), ...others.slice(0, 4)].slice(0, 8);
      const mapped = selected.map(item => {
        const v = vendors.find(vv => vv.id === item.vendorId);
        return { item, vendorName: v?.name || "Vendor", vendorSlug: v?.slug || "" };
      });
      setFeaturedGear(mapped);
    } catch (e) { console.error(e); }
    finally { setLoadingGear(false); }
  }

  function applySearch(term: string) {
    const t = term.toLowerCase();
    const filtered = t
      ? allVendors.filter(v =>
          v.name.toLowerCase().includes(t) ||
          (v.city && v.city.toLowerCase().includes(t)) ||
          (v.areas && v.areas.some(a => a.toLowerCase().includes(t))) ||
          (v.tagline && v.tagline.toLowerCase().includes(t))
        )
      : allVendors;
    setFilteredVendors(filtered);
    setVisibleCount(LOAD_STEP);
    setActiveFilter("all");
  }

  function filterBy(loc: string) {
    setActiveFilter(loc);
    setSearchTerm("");
    const filtered = loc === "all" ? allVendors
      : allVendors.filter(v => (v.city && v.city.includes(loc)) || (v.areas && v.areas.some(a => a.includes(loc))));
    setFilteredVendors(filtered);
    setVisibleCount(LOAD_STEP);
    // Load featured gear for this location's vendors
    loadFeaturedGear(filtered.map(v => v.id), filtered);
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
          if (city) handleSearchInput(city);
          else alert("Could not determine city.");
        } catch { alert("Location error."); }
        finally { setLocating(false); }
      },
      () => { alert("Permission denied."); setLocating(false); }
    );
  }

  const displayList = filteredVendors.slice(0, visibleCount);
  const annTheme = announcement ? announcementThemes[announcement.type] || announcementThemes.info : null;

  return (
    <div className="pb-24" style={{ fontFamily: "'Inter', sans-serif", color: "#062c24", backgroundColor: "#f8fafc" }}>

      {/* Announcement */}
      {announcement && showAnnouncement && annTheme && (
        <div className={`relative z-50 px-4 py-3 text-white text-center shadow-md ${annTheme.bg}`}>
          <div className="max-w-4xl mx-auto flex items-center justify-center gap-3">
            <span className="bg-white/20 p-1.5 rounded-lg text-xs"><i className={`fas ${annTheme.icon}`}></i></span>
            <p className="text-[10px] font-bold uppercase tracking-widest">{announcement.message}</p>
            <button onClick={() => setShowAnnouncement(false)} className="absolute right-4 text-white/60 hover:text-white"><i className="fas fa-times"></i></button>
          </div>
        </div>
      )}

      {/* ═══ HEADER ═══ */}
      <header className="bg-[#062c24] text-white relative overflow-hidden">
        {/* Chevron pattern */}
        <div className="absolute inset-0 opacity-[0.08]"
          style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/dark-wood.png')" }} />

        {/* Top bar — logo + vendor buttons */}
        <div className="relative z-10 flex justify-between items-center px-5 pt-5 pb-3">
          <div className="flex items-center gap-3 cursor-pointer select-none" onClick={handleLogoTap}>
            <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
              <img src="/pacak-khemah.png" className="w-7 h-7 object-contain" alt="Logo" draggable={false} />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight leading-none">pacakkhemah</h1>
              <p className="text-[8px] font-bold text-emerald-400 uppercase tracking-[0.2em]">Pacak. Rehat. Ulang.</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-white/80 leading-tight">rent, tend</p>
            <p className="text-[10px] font-black text-white/80 leading-tight">wild, <span className="text-emerald-400">&</span></p>
            <p className="text-[10px] font-black text-white/80 leading-tight">heal soul</p>
          </div>
        </div>

        {/* Vendor buttons */}
        <div className="relative z-10 flex justify-end items-center gap-2 px-5 pb-4">
          <Link href="/register-vendor"
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-md">
            Join as Vendor
          </Link>
          <Link href="/store"
            className="px-4 py-2 bg-white/10 border border-white/20 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-white hover:text-[#062c24] transition-all">
            Vendor Login
          </Link>
        </div>
      </header>

      {/* ═══ MAIN CONTENT ═══ */}
      <main className="max-w-6xl mx-auto px-4 pt-6 space-y-6">

        {/* Where to Pacak Today? — search */}
        <section>
          <div className="flex items-end justify-between mb-3">
            <h2 className="text-lg font-black text-[#062c24]">Where to Pacak Today?</h2>
          </div>
          <div className="relative">
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
            <input type="text" value={searchTerm} onChange={e => handleSearchInput(e.target.value)}
              placeholder="Search location or gear..."
              className="w-full bg-white text-[#062c24] py-4 pl-12 pr-24 rounded-xl shadow-sm border border-slate-200 outline-none font-bold text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 transition-all" />
            <button onClick={locateMe}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center bg-slate-100 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all">
              <i className={`fas ${locating ? "fa-spinner fa-spin text-emerald-500" : "fa-location-crosshairs"}`}></i>
            </button>
          </div>
          {/* Location filter pills */}
          {!loading && locations.length > 0 && (
            <div className="flex gap-2 overflow-x-auto mt-3 pb-1 no-scrollbar">
              <button onClick={() => filterBy("all")}
                className={`shrink-0 px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all min-h-[36px] ${activeFilter === "all" ? "bg-[#062c24] text-white shadow-md" : "bg-white text-slate-500 border border-slate-200 hover:bg-emerald-50"}`}>
                All
              </button>
              {locations.map(loc => (
                <button key={loc} onClick={() => filterBy(loc)}
                  className={`shrink-0 px-4 py-2 rounded-lg text-[10px] font-black uppercase whitespace-nowrap transition-all min-h-[36px] ${activeFilter === loc ? "bg-[#062c24] text-white shadow-md" : "bg-white text-slate-500 border border-slate-200 hover:bg-emerald-50"}`}>
                  {loc}
                </button>
              ))}
            </div>
          )}
          <Link href="/campsites" className="inline-flex items-center gap-2 mt-3 text-[10px] font-bold text-emerald-600 hover:text-emerald-800 transition-colors">
            <i className="fas fa-campground"></i> See suggestions?
          </Link>
        </section>

        {/* Featured Gear Carousel — appears after selecting a location */}
        {featuredGear.length > 0 && (
          <section>
            <h2 className="text-lg font-black text-[#062c24] mb-3">Featured Gear</h2>
            <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
              {featuredGear.map(({ item, vendorName, vendorSlug }) => (
                <FeaturedGearCard key={item.id} item={item} vendorName={vendorName} vendorSlug={vendorSlug} />
              ))}
            </div>
          </section>
        )}
        {loadingGear && (
          <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
            {[1,2,3].map(i => (
              <div key={i} className="shrink-0 w-[280px] h-64 bg-white rounded-2xl border border-slate-100 skeleton"></div>
            ))}
          </div>
        )}

        {/* What to Pacak today? — vendor grid */}
        <section>
          <div className="flex justify-between items-end mb-3">
            <h2 className="text-lg font-black text-[#062c24]">What to Pacak today?</h2>
            <span className="text-[9px] font-bold text-white bg-[#062c24] px-2 py-0.5 rounded-md">
              {loading ? "..." : `${filteredVendors.length} Hubs`}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {loading ? (
              [...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 skeleton" style={{ animationDelay: `${i * 100}ms` }}>
                  <div className="h-5 w-12 bg-slate-200 rounded-lg mb-3"></div>
                  <div className="w-full h-24 bg-slate-100 rounded-xl mb-3"></div>
                  <div className="h-4 w-3/4 bg-slate-200 rounded-full mx-auto mb-2"></div>
                  <div className="h-3 w-1/2 bg-slate-100 rounded-full mx-auto"></div>
                </div>
              ))
            ) : loadError ? (
              <div className="col-span-full text-center py-16">
                <i className="fas fa-wifi text-3xl text-red-300 mb-4 block"></i>
                <p className="text-xs font-black text-slate-400 uppercase mb-4">Failed to load hubs</p>
                <button onClick={() => { setLoadError(false); setLoading(true); loadVendors(); }}
                  className="px-6 py-3 bg-[#062c24] text-white rounded-xl text-[10px] font-black uppercase hover:bg-emerald-900 shadow-sm">
                  <i className="fas fa-rotate-right mr-2"></i> Try Again
                </button>
              </div>
            ) : displayList.length === 0 ? (
              <div className="col-span-full text-center py-16">
                <i className={`fas ${searchTerm ? "fa-search" : "fa-store"} text-4xl text-slate-200 mb-4 block`}></i>
                <p className="text-xs font-black text-slate-400 uppercase mb-2">
                  {searchTerm ? `No results for "${searchTerm}"` : activeFilter !== "all" ? `No hubs in ${activeFilter} yet` : "No active hubs yet"}
                </p>
                {(searchTerm || activeFilter !== "all") && (
                  <button onClick={() => { setSearchTerm(""); filterBy("all"); }}
                    className="mt-3 px-5 py-2 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black uppercase hover:bg-slate-200">
                    <i className="fas fa-times mr-2"></i> Clear Filters
                  </button>
                )}
              </div>
            ) : displayList.map((vendor, i) => (
              <VendorCard key={vendor.id} vendor={vendor} index={i} />
            ))}
          </div>

          {visibleCount < filteredVendors.length && (
            <div className="text-center pt-6">
              <button onClick={() => setVisibleCount(c => c + LOAD_STEP)}
                className="bg-white border border-slate-200 text-slate-500 font-bold uppercase text-[10px] px-8 py-3 rounded-xl hover:bg-slate-50 hover:text-[#062c24] shadow-sm">
                Load More <i className="fas fa-chevron-down ml-2"></i>
              </button>
            </div>
          )}
        </section>

        {/* Events */}
        {events.length > 0 && (
          <section className="pb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-slate-200"></div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">What&apos;s Up? Malaysia</h3>
              <div className="h-px flex-1 bg-slate-200"></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {events.map(e => (
                <a key={e.id} href={e.link} target="_blank" rel="noreferrer"
                  className="group bg-white rounded-xl border border-slate-100 overflow-hidden hover:shadow-lg transition-all">
                  <div className="h-24 overflow-hidden relative">
                    <img src={e.poster} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={e.name} />
                  </div>
                  <div className="p-3">
                    <h4 className="text-[10px] font-black text-[#062c24] uppercase leading-tight line-clamp-2">{e.name}</h4>
                    <p className="text-[8px] font-bold text-slate-400 mt-1">{e.organizer || "Event"}</p>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-8 border-t border-slate-200 bg-white">
        <h4 className="font-black text-[#062c24] text-lg mb-1">PACAK KHEMAH</h4>
        <p className="text-[9px] font-bold text-slate-400 uppercase mb-4">Pacak. Rehat. Ulang.</p>
        <p className="text-[9px] text-slate-400 font-medium mb-2">
          Already a vendor? <Link href="/store" className="text-emerald-600 font-bold hover:underline">Log in here</Link>
        </p>
        <p className="text-[8px] text-slate-300 uppercase">© 2026 Pacak Khemah. All rights reserved.</p>
      </footer>

      {/* Join Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-[#062c24]/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl relative text-center">
            <button onClick={() => setShowModal(false)} className="absolute top-5 right-5 w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:text-red-500"><i className="fas fa-times"></i></button>
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6 text-emerald-600 text-2xl"><i className="fas fa-store"></i></div>
            <h3 className="text-2xl font-black text-[#062c24] uppercase mb-2">Want to Rent Out Gear?</h3>
            <p className="text-xs text-slate-500 mb-6 font-medium">Join Malaysia&apos;s fastest growing camping gear rental network.</p>
            <Link href="/register-vendor" className="block w-full bg-[#062c24] text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-900 shadow-lg">
              <i className="fas fa-rocket mr-2"></i> Get Started
            </Link>
          </div>
        </div>
      )}

      <style jsx>{`
        .skeleton { background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes staggerIn { from { opacity: 0; transform: translateY(16px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .stagger-in { opacity: 0; animation: staggerIn 0.4s ease-out forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      <BottomNav />
    </div>
  );
}