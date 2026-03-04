"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import {
  collection, getDocs, query, where, orderBy, limit, doc, getDoc,
} from "firebase/firestore";
import BottomNav from "@/components/BottomNav";
import AdBanner from "@/components/AdBanner";

// --- TYPES ---
type Vendor = {
  id: string; name: string; logo?: string; image?: string;
  city?: string; areas?: string[]; pickup?: string[];
  tagline?: string; slug?: string; credits?: number;
  createdAt?: any; is_vacation?: boolean; status?: string;
  rating?: number; reviewCount?: number;
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

// --- VENDOR CARD WITH GEAR THUMBNAILS ---
function VendorCard({ vendor, gear, index }: { vendor: Vendor; gear: GearItem[]; index: number }) {
  const logo = vendor.logo || vendor.image || "/pacak-khemah.png";
  const city = vendor.city || "Malaysia";
  const shopPath = vendor.slug ? `/shop/${vendor.slug}` : `/shop?v=${vendor.id}`;
  const isNew = vendor.createdAt && Date.now() - vendor.createdAt.toDate().getTime() < 30 * 24 * 60 * 60 * 1000;
  const topGear = gear.slice(0, 3);

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400">
            <i className="fas fa-map-marker-alt text-emerald-500 text-[8px]"></i>
            <span>{city}</span>
          </div>
          {(vendor.reviewCount || 0) > 0 && (
            <div className="flex items-center gap-1 text-[9px] font-bold text-orange-500">
              <i className="fas fa-fire text-[8px]"></i>
              <span>{(vendor.rating || 0).toFixed(1)}</span>
              <span className="text-slate-300">({vendor.reviewCount})</span>
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
  const [socialLinks, setSocialLinks] = useState<{ instagram?: string; threads?: string; whatsapp?: string }>({}); // typed location that has no vendors

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

  useEffect(() => { loadVendors(); loadEvents(); loadAnnouncement(); loadSocialLinks(); }, []);

  // Close location dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-loc-dropdown]')) setShowLocDropdown(false);
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

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

  async function loadSocialLinks() {
    try {
      const snap = await getDoc(doc(db, "settings", "social_links"));
      if (snap.exists()) setSocialLinks(snap.data());
    } catch { }
  }

  // Load gear for filtered vendors
  async function loadGearForVendors(vendors: Vendor[]) {
    const ids = vendors.map(v => v.id);
    if (!ids.length) { setVendorGear({}); return; }
    setLoadingGear(true);
    try {
      const batchIds = ids.slice(0, 30);
      const gSnap = await getDocs(query(collection(db, "gear"), where("vendorId", "in", batchIds)));
      const gear = gSnap.docs.map(d => ({ id: d.id, ...d.data() } as GearItem)).filter(g => !g.deleted);
      const grouped: Record<string, GearItem[]> = {};
      gear.forEach(g => {
        if (!grouped[g.vendorId]) grouped[g.vendorId] = [];
        grouped[g.vendorId].push(g);
      });
      // Sort: packages first, then by price
      Object.keys(grouped).forEach(k => {
        grouped[k].sort((a, b) => {
          const aP = a.type === "package" ? 0 : 1;
          const bP = b.type === "package" ? 0 : 1;
          return aP - bP || b.price - a.price;
        });
      });
      setVendorGear(grouped);
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
    // Load gear for these vendors
    loadGearForVendors(filtered);
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
  const hasGear = Object.keys(vendorGear).length > 0;

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

      {/* ═══ HEADER WITH REAL ASSETS ═══ */}
      <header className="bg-[#062c24] text-white relative overflow-hidden">
        {/* Pattern */}
        {/* Chevron pattern */}
        <div className="absolute inset-0 opacity-40"
          style={{ backgroundImage: "url('/pattern-chevron.png')", backgroundSize: "300px" }} />
        {/* Dark gradient tint — top to bottom */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#062c24] via-[#062c24]/50 to-[#062c24]/90" />

        {/* Main header row */}
        <div className="relative z-10 flex justify-between items-center px-4 py-4">
          {/* Logo + wordmark */}
          <div className="flex items-center gap-2.5 cursor-pointer select-none" onClick={handleLogoTap}>
            <img src="/pacak-khemah.png" className="h-11 w-11 object-contain rounded-full" alt="Pacak Khemah" draggable={false} />
            <div>
              <h1 className="text-[22px] font-black tracking-tight leading-none" style={{ fontFamily: "'Inter', sans-serif" }}>pacakkhemah</h1>
              <p className="text-[7px] font-bold text-emerald-400 uppercase tracking-[0.2em] mt-0.5">Pacak. Rehat. Ulang.</p>
            </div>
          </div>
          {/* Right — rent tend wild graphic */}
          <img src="/rent-camp.png" className="h-16 object-contain" alt="Rent, tend wild & heal soul" />
        </div>

        {/* Subtle vendor links */}
        <div className="relative z-10 flex justify-end items-center gap-3 px-5 pb-3">
          <Link href="/register-vendor"
            className="text-[9px] font-bold text-emerald-300/70 uppercase tracking-widest hover:text-white transition-colors">
            Join as Vendor
          </Link>
          <Link href="/store"
            className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-white/60 hover:bg-white hover:text-[#062c24] transition-all"
            title="Vendor Login">
            <i className="fas fa-store text-xs"></i>
          </Link>
        </div>
      </header>

      {/* ═══ MAIN CONTENT ═══ */}
      <main className="max-w-6xl mx-auto px-4 pt-6 space-y-6">

        {/* Where to Pacak Today? */}
        <section>
          <h2 className="text-lg font-black text-[#062c24] mb-3">Where to Pacak Today?</h2>

          {/* Searchable location input */}
          <div className="relative mb-2" data-loc-dropdown>
            <i className="fas fa-map-marker-alt absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 text-sm z-10"></i>
            <input
              type="text"
              value={locationSearch}
              onChange={e => {
                setLocationSearch(e.target.value);
                setShowLocDropdown(true);
                setCustomLocation("");
              }}
              onFocus={() => setShowLocDropdown(true)}
              placeholder="Search or pick a location..."
              className="w-full bg-white text-[#062c24] py-4 pl-11 pr-20 rounded-xl shadow-sm border border-slate-200 outline-none font-bold text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 transition-all"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {locationSearch && (
                <button onClick={() => { setLocationSearch(""); setCustomLocation(""); filterBy("all"); setShowLocDropdown(false); }}
                  className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors">
                  <i className="fas fa-times text-xs"></i>
                </button>
              )}
              <button onClick={() => setShowLocDropdown(!showLocDropdown)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-emerald-600 transition-colors">
                <i className={`fas fa-chevron-down text-xs transition-transform ${showLocDropdown ? "rotate-180" : ""}`}></i>
              </button>
            </div>

            {/* Dropdown */}
            {showLocDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-56 overflow-y-auto">
                <button onClick={() => { filterBy("all"); setLocationSearch(""); setCustomLocation(""); setShowLocDropdown(false); }}
                  className={`w-full text-left px-4 py-3 text-sm font-bold hover:bg-emerald-50 transition-colors ${activeFilter === "all" ? "text-emerald-600 bg-emerald-50/50" : "text-slate-600"}`}>
                  <i className="fas fa-globe text-emerald-500 mr-2 text-xs"></i> All Locations
                </button>
                {locations
                  .filter(loc => !locationSearch || loc.toLowerCase().includes(locationSearch.toLowerCase()))
                  .map(loc => (
                    <button key={loc} onClick={() => { filterBy(loc); setLocationSearch(loc); setCustomLocation(""); setShowLocDropdown(false); }}
                      className={`w-full text-left px-4 py-3 text-sm font-bold hover:bg-emerald-50 transition-colors ${activeFilter === loc ? "text-emerald-600 bg-emerald-50/50" : "text-slate-600"}`}>
                      <i className="fas fa-map-marker-alt text-emerald-500 mr-2 text-xs"></i> {loc}
                    </button>
                  ))
                }
                {locationSearch && !locations.some(l => l.toLowerCase().includes(locationSearch.toLowerCase())) && (
                  <button onClick={() => {
                    setCustomLocation(locationSearch);
                    setFilteredVendors([]);
                    setShowLocDropdown(false);
                  }}
                    className="w-full text-left px-4 py-3 text-sm font-bold text-slate-400 hover:bg-slate-50">
                    <i className="fas fa-search text-slate-300 mr-2 text-xs"></i> Search &ldquo;{locationSearch}&rdquo;
                  </button>
                )}
              </div>
            )}
          </div>

          <Link href="/campsites" className="inline-flex items-center gap-2 text-[10px] font-bold text-emerald-600 hover:text-emerald-800 transition-colors">
            <i className="fas fa-campground"></i> See suggestions?
          </Link>
        </section>

        {/* What to Pacak today? — vendors with gear */}
        <section>
          <div className="flex justify-between items-end mb-3">
            <h2 className="text-lg font-black text-[#062c24]">What to Pacak today?</h2>
            <span className="text-[9px] font-bold text-white bg-[#062c24] px-2 py-0.5 rounded-md">
              {loading ? "..." : `${filteredVendors.length} Hubs`}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 skeleton" style={{ animationDelay: `${i * 100}ms` }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-slate-200 rounded-xl"></div>
                    <div className="flex-1"><div className="h-4 bg-slate-200 rounded-full w-2/3 mb-2"></div><div className="h-3 bg-slate-100 rounded-full w-1/2"></div></div>
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
                {customLocation ? (
                  <>
                    <div className="text-5xl mb-4">🏕️</div>
                    <p className="text-sm font-black text-[#062c24] mb-2">Hmm, no vendors in {customLocation} yet!</p>
                    <p className="text-xs text-slate-500 font-medium max-w-xs mx-auto mb-4 leading-relaxed">
                      We&apos;re on the lookout for awesome gear rental vendors in this area. Hopefully someone answers our smoke signal soon! 🔥
                    </p>
                    <div className="flex flex-col items-center gap-2">
                      <button onClick={() => { setLocationSearch(""); setCustomLocation(""); filterBy("all"); }}
                        className="px-5 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-black uppercase hover:bg-emerald-100 transition-colors">
                        <i className="fas fa-globe mr-2"></i> Browse All Locations
                      </button>
                      <Link href="/register-vendor" className="text-[10px] font-bold text-emerald-600 hover:underline">
                        Know a vendor here? Tell them to join us!
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </div>
          ) : (
              <>
                {displayList.map((vendor, i) => (
                  <VendorCard key={vendor.id} vendor={vendor} gear={vendorGear[vendor.id] || []} index={i} />
                ))}
                {/* Ad blends with vendor cards - shows after grid loads */}
                {displayList.length >= 6 && (
                  <div className="col-span-1 row-start-4 md:col-start-3">
                    <AdBanner variant="card" />
                  </div>
                )}
              </>
            )}
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
        
        {/* Quick Links */}
        <div className="flex justify-center gap-6 mb-4">
          <Link href="/about" className="text-[10px] font-bold text-slate-500 hover:text-emerald-600 transition-colors">
            <i className="fas fa-info-circle mr-1.5"></i>About Us
          </Link>
          <Link href="/faq" className="text-[10px] font-bold text-slate-500 hover:text-emerald-600 transition-colors">
            <i className="fas fa-question-circle mr-1.5"></i>FAQ
          </Link>
          <Link href="/store" className="text-[10px] font-bold text-slate-500 hover:text-emerald-600 transition-colors">
            <i className="fas fa-store mr-1.5"></i>Vendor Login
          </Link>
        </div>
        
        {/* Social Links */}
        <div className="flex justify-center gap-3 mb-4">
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