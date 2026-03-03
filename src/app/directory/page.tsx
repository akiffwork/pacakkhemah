"use client";

import { useEffect, useState, useRef } from "react";
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
  rating?: number; reviewCount?: number; // NEW
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

// --- MINI FIREWOOD RATING (for cards) ---
function MiniFirewoodRating({ rating }: { rating: number }) {
  const roundedRating = Math.round(rating);
  const flameOpacity = 0.5 + (rating / 5) * 0.5;
  
  return (
    <svg width="28" height="28" viewBox="0 0 80 90" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="miniFlame" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#ff4500" />
          <stop offset="100%" stopColor="#ffa500" />
        </linearGradient>
      </defs>
      
      {/* Simplified flame */}
      {roundedRating > 0 && (
        <g transform="translate(40, 30) scale(0.6)" style={{ filter: "drop-shadow(0 0 5px rgba(255,100,0,0.6))" }}>
          <path 
            d="M0 28 C-8 18 -12 6 -6 -10 C-4 -5 -2 0 0 -5 C2 0 4 -5 6 -10 C12 6 8 18 0 28Z" 
            fill="url(#miniFlame)" 
            style={{ opacity: flameOpacity }}
          />
          <path 
            d="M0 22 C-4 14 -5 8 -3 0 C-1 5 0 3 0 -1 C0 3 1 5 3 0 C5 8 4 14 0 22Z" 
            fill="#ffd700"
          />
        </g>
      )}
      
      {/* Simplified log stack */}
      {[1, 2, 3].map((log, i) => {
        const isActive = log <= Math.min(roundedRating, 3);
        const positions = [
          { x: 15, y: 72, r: -5 },
          { x: 35, y: 75, r: 0 },
          { x: 55, y: 72, r: 5 },
        ];
        const p = positions[i];
        return (
          <g key={i} transform={`translate(${p.x}, ${p.y}) rotate(${p.r})`} style={{ opacity: isActive ? 1 : 0.3 }}>
            <ellipse cx="5" cy="2" rx="8" ry="3" fill={isActive ? "#8B4513" : "#666"} />
            <ellipse cx="-2" cy="2" rx="3" ry="3" fill={isActive ? "#D2691E" : "#888"} />
          </g>
        );
      })}
      
      {/* Top crossed logs for 4-5 */}
      {roundedRating >= 4 && (
        <g transform="translate(22, 58) rotate(15)" style={{ opacity: 1 }}>
          <ellipse cx="5" cy="2" rx="7" ry="3" fill="#8B4513" />
        </g>
      )}
      {roundedRating >= 5 && (
        <g transform="translate(42, 58) rotate(-15)" style={{ opacity: 1 }}>
          <ellipse cx="5" cy="2" rx="7" ry="3" fill="#8B4513" />
        </g>
      )}
    </svg>
  );
}

// --- VENDOR CARD WITH GEAR THUMBNAILS ---
function VendorCard({ vendor, gear, index }: { vendor: Vendor; gear: GearItem[]; index: number }) {
  const logo = vendor.logo || vendor.image || "/pacak-khemah.png";
  const city = vendor.city || "Malaysia";
  const shopPath = vendor.slug ? `/shop/${vendor.slug}` : `/shop?v=${vendor.id}`;
  const isNew = vendor.createdAt && Date.now() - vendor.createdAt.toDate().getTime() < 30 * 24 * 60 * 60 * 1000;
  const topGear = gear.slice(0, 3);
  
  const rating = vendor.rating || 0;
  const reviewCount = vendor.reviewCount || 0;

  return (
    <Link href={shopPath}
      className="group bg-white rounded-2xl border border-slate-100 hover:border-emerald-300 shadow-sm hover:shadow-xl transition-all flex flex-col h-full cursor-pointer stagger-in overflow-hidden"
      style={{ animationDelay: `${index * 60}ms` }}>

      {/* Vendor info */}
      <div className="p-4 pb-3">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-slate-50 rounded-xl p-1 shrink-0 group-hover:bg-emerald-50 transition-colors">
            <img src={logo} className="w-full h-full object-contain" alt={vendor.name} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black uppercase text-[#062c24] leading-tight truncate group-hover:text-emerald-700 transition-colors">{vendor.name}</h3>
              {isNew && <span className="bg-blue-100 text-blue-600 text-[7px] font-black px-1.5 py-0.5 rounded uppercase shrink-0">New</span>}
            </div>
            <p className="text-[9px] font-medium text-slate-400 italic truncate">{vendor.tagline || "Ready for adventure"}</p>
          </div>
        </div>
        
        {/* Location & Rating Row - NEW */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400">
            <i className="fas fa-map-marker-alt text-emerald-500 text-[8px]"></i>
            <span>{city}</span>
          </div>
          
          {/* Rating Badge */}
          {reviewCount > 0 && (
            <div className="flex items-center gap-1">
              <MiniFirewoodRating rating={rating} />
              <div className="text-right">
                <span className="text-xs font-black text-orange-600">{rating}</span>
                <span className="text-[8px] text-slate-400 ml-0.5">({reviewCount})</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Gear thumbnails */}
      {topGear.length > 0 && (
        <div className="px-3 pb-3">
          <div className="flex gap-2">
            {topGear.map(item => (
              <div key={item.id} className="flex-1 min-w-0">
                <div className="aspect-square rounded-lg overflow-hidden bg-slate-100 mb-1.5">
                  <img src={item.img || "/pacak-khemah.png"} className="w-full h-full object-cover" alt={item.name} />
                </div>
                <p className="text-[8px] font-black text-[#062c24] uppercase truncate leading-tight">{item.name}</p>
                <p className="text-[8px] font-bold text-emerald-600">RM {item.price}</p>
              </div>
            ))}
            {/* Fill empty slots if less than 3 */}
            {topGear.length < 3 && [...Array(3 - topGear.length)].map((_, i) => (
              <div key={`empty-${i}`} className="flex-1 min-w-0">
                <div className="aspect-square rounded-lg bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center">
                  <i className="fas fa-plus text-slate-200 text-xs"></i>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <div className="mt-auto border-t border-slate-50 px-4 py-2.5 bg-slate-50/50 group-hover:bg-emerald-50/50 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold text-emerald-600 uppercase">View Shop →</span>
          {gear.length > 3 && (
            <span className="text-[8px] font-bold text-slate-400">+{gear.length - 3} more items</span>
          )}
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
  const [vendorGear, setVendorGear] = useState<Record<string, GearItem[]>>({});
  const [loadingGear, setLoadingGear] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [showLocDropdown, setShowLocDropdown] = useState(false);
  const [customLocation, setCustomLocation] = useState("");
  const [socialLinks, setSocialLinks] = useState<{ instagram?: string; threads?: string; whatsapp?: string }>({});
  const [sortBy, setSortBy] = useState<"default" | "rating">("default"); // NEW: Sort option

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
    debounceRef.current = setTimeout(() => applyFilters(allVendors, activeFilter, val), 300);
  }

  // Load vendors
  async function loadVendors() {
    setLoading(true);
    setLoadError(false);
    try {
      const vSnap = await getDocs(query(
        collection(db, "vendors"),
        where("status", "==", "approved"),
        where("credits", ">", 0)
      ));
      const vendors = vSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as Vendor))
        .filter(v => !v.is_vacation);

      setAllVendors(vendors);
      setFilteredVendors(vendors);

      // Extract locations
      const locs = new Set<string>();
      vendors.forEach(v => {
        if (v.city) locs.add(v.city);
        v.areas?.forEach(a => locs.add(a));
        v.pickup?.forEach(p => locs.add(p));
      });
      setLocations(Array.from(locs).sort());

      // Fetch gear for each vendor
      setLoadingGear(true);
      const gearSnap = await getDocs(query(collection(db, "gear"), where("deleted", "!=", true)));
      const gearByVendor: Record<string, GearItem[]> = {};
      gearSnap.docs.forEach(d => {
        const g = { id: d.id, ...d.data() } as GearItem;
        if (!gearByVendor[g.vendorId]) gearByVendor[g.vendorId] = [];
        gearByVendor[g.vendorId].push(g);
      });
      setVendorGear(gearByVendor);
      setLoadingGear(false);

      // Load announcements
      const annSnap = await getDoc(doc(db, "config", "announcement"));
      if (annSnap.exists()) {
        const ann = annSnap.data() as Announcement;
        if (ann.isActive) setAnnouncement(ann);
      }

      // Load events
      const evSnap = await getDocs(query(collection(db, "events"), limit(4)));
      setEvents(evSnap.docs.map(d => ({ id: d.id, ...d.data() } as Event)));

      // Load social links
      const socialSnap = await getDoc(doc(db, "config", "social"));
      if (socialSnap.exists()) setSocialLinks(socialSnap.data());

    } catch (e) {
      console.error(e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadVendors(); }, []);

  // Filter logic
  function applyFilters(vendors: Vendor[], filter: string, search: string) {
    let result = vendors;

    if (filter !== "all") {
      result = result.filter(v =>
        v.city?.toLowerCase() === filter.toLowerCase() ||
        v.areas?.some(a => a.toLowerCase() === filter.toLowerCase()) ||
        v.pickup?.some(p => p.toLowerCase() === filter.toLowerCase())
      );
    }

    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(v =>
        v.name.toLowerCase().includes(s) ||
        v.tagline?.toLowerCase().includes(s) ||
        v.city?.toLowerCase().includes(s)
      );
    }

    // Apply sorting - NEW
    if (sortBy === "rating") {
      result = [...result].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    setFilteredVendors(result);
    setVisibleCount(LOAD_STEP);
  }

  function filterBy(loc: string) {
    setActiveFilter(loc);
    applyFilters(allVendors, loc, searchTerm);
  }

  // Sort change handler - NEW
  function handleSortChange(sort: "default" | "rating") {
    setSortBy(sort);
    applyFilters(allVendors, activeFilter, searchTerm);
  }

  useEffect(() => {
    applyFilters(allVendors, activeFilter, searchTerm);
  }, [sortBy]);

  const displayList = filteredVendors.slice(0, visibleCount);
  const theme = announcement ? announcementThemes[announcement.type] : null;

  return (
    <div className="min-h-screen pb-20" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: "#f0f2f1", color: "#0f172a" }}>

      {/* Hero Header */}
      <header className="bg-[#062c24] text-white pt-6 pb-8 px-5 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 0 L40 20 L20 40 L0 20 Z' fill='none' stroke='%23ffffff' stroke-width='1'/%3E%3C/svg%3E")`, backgroundSize: "25px 25px" }} />

        <div className="relative z-10">
          <div className="inline-block cursor-pointer" onClick={handleLogoTap}>
            <img src="/pacak-khemah.png" className="w-20 h-20 mx-auto mb-3 drop-shadow-xl" alt="Pacak Khemah" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight">Pacak Khemah</h1>
          <p className="text-emerald-300 text-[10px] font-bold uppercase tracking-[0.3em] mt-1">Pacak. Rehat. Ulang.</p>
        </div>
      </header>

      {/* Announcement Banner */}
      {announcement && showAnnouncement && theme && (
        <div className={`${theme.bg} text-white px-4 py-3 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <i className={`fas ${theme.icon}`}></i>
            <p className="text-xs font-bold">{announcement.message}</p>
          </div>
          <button onClick={() => setShowAnnouncement(false)} className="opacity-60 hover:opacity-100">
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Search & Filter Bar */}
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
            <input
              type="text"
              value={searchTerm}
              onChange={e => handleSearchInput(e.target.value)}
              placeholder="Search vendors, gear..."
              className="w-full bg-white border border-slate-200 pl-11 pr-4 py-3.5 rounded-xl text-sm font-medium outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Location Filter */}
          <div className="relative">
            <button
              onClick={() => setShowLocDropdown(!showLocDropdown)}
              className="w-full md:w-auto bg-white border border-slate-200 px-4 py-3.5 rounded-xl text-sm font-bold flex items-center justify-between gap-3 min-w-[160px]"
            >
              <span className="flex items-center gap-2">
                <i className="fas fa-map-marker-alt text-emerald-500"></i>
                <span className="truncate">{activeFilter === "all" ? "All Locations" : activeFilter}</span>
              </span>
              <i className={`fas fa-chevron-down text-xs text-slate-400 transition-transform ${showLocDropdown ? "rotate-180" : ""}`}></i>
            </button>

            {showLocDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto">
                <button
                  onClick={() => { filterBy("all"); setShowLocDropdown(false); }}
                  className={`w-full text-left px-4 py-3 text-sm font-medium hover:bg-slate-50 ${activeFilter === "all" ? "text-emerald-600 bg-emerald-50" : ""}`}
                >
                  All Locations
                </button>
                {locations.map(loc => (
                  <button
                    key={loc}
                    onClick={() => { filterBy(loc); setShowLocDropdown(false); }}
                    className={`w-full text-left px-4 py-3 text-sm font-medium hover:bg-slate-50 ${activeFilter === loc ? "text-emerald-600 bg-emerald-50" : ""}`}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sort by Rating - NEW */}
          <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={() => handleSortChange("default")}
              className={`px-4 py-3 text-[10px] font-black uppercase transition-colors ${sortBy === "default" ? "bg-[#062c24] text-white" : "text-slate-500 hover:bg-slate-50"}`}
            >
              Default
            </button>
            <button
              onClick={() => handleSortChange("rating")}
              className={`px-4 py-3 text-[10px] font-black uppercase transition-colors flex items-center gap-1.5 ${sortBy === "rating" ? "bg-[#062c24] text-white" : "text-slate-500 hover:bg-slate-50"}`}
            >
              <i className="fas fa-fire text-orange-400"></i> Top Rated
            </button>
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-bold text-slate-400 uppercase">
            {filteredVendors.length} vendor{filteredVendors.length !== 1 ? "s" : ""} found
          </p>
          <button onClick={() => setShowModal(true)} className="text-[10px] font-black text-emerald-600 uppercase hover:underline">
            <i className="fas fa-plus mr-1"></i> Join as Vendor
          </button>
        </div>

        {/* Vendor Grid */}
        <section className="mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              [...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl p-4 border border-slate-100 animate-pulse">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-slate-100 rounded-xl"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-slate-100 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-slate-50 rounded w-1/2"></div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 aspect-square bg-slate-100 rounded-lg"></div>
                    <div className="flex-1 aspect-square bg-slate-100 rounded-lg"></div>
                    <div className="flex-1 aspect-square bg-slate-100 rounded-lg"></div>
                  </div>
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
                  <button onClick={() => { setSearchTerm(""); setLocationSearch(""); setCustomLocation(""); filterBy("all"); }}
                    className="mt-3 px-5 py-2 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black uppercase hover:bg-slate-200">
                    <i className="fas fa-times mr-2"></i> Clear
                  </button>
                )}
              </div>
            ) : displayList.map((vendor, i) => (
              <VendorCard key={vendor.id} vendor={vendor} gear={vendorGear[vendor.id] || []} index={i} />
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
        <div className="flex justify-center gap-4 mb-4">
          {socialLinks.instagram && (
            <a href={socialLinks.instagram} target="_blank" rel="noreferrer" className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 hover:text-pink-500 hover:bg-pink-50 transition-colors"><i className="fab fa-instagram text-sm"></i></a>
          )}
          {socialLinks.threads && (
            <a href={socialLinks.threads} target="_blank" rel="noreferrer" className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 hover:text-black hover:bg-slate-200 transition-colors"><i className="fab fa-threads text-sm"></i></a>
          )}
          {socialLinks.whatsapp && (
            <a href={socialLinks.whatsapp} target="_blank" rel="noreferrer" className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 transition-colors"><i className="fab fa-whatsapp text-sm"></i></a>
          )}
        </div>
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