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
type Badge = "verified" | "id_verified" | "top_rated" | "fast_responder" | "premium";
type Vendor = {
  id: string; name: string; logo?: string; image?: string;
  city?: string; areas?: string[]; pickup?: string[];
  tagline?: string; slug?: string; credits?: number;
  createdAt?: any; is_vacation?: boolean; status?: string;
  rating?: number; reviewCount?: number;
  // NEW: Badge & Mockup fields
  badges?: Badge[];
  is_mockup?: boolean;
  total_orders?: number;
  avg_response_time?: number;
};
type GearItem = {
  id: string; name: string; price: number; img?: string;
  vendorId: string; category?: string; type?: string; deleted?: boolean;
};
type Event = { id: string; name: string; poster: string; link: string; organizer?: string };
type Announcement = { isActive: boolean; message: string; type: "info" | "warning" | "promo" };
type Testimonial = { id: string; name: string; location: string; text: string; rating: number };

const LOAD_STEP = 12;
const announcementThemes = {
  info: { bg: "bg-blue-600", icon: "fa-info-circle" },
  warning: { bg: "bg-amber-500", icon: "fa-exclamation-triangle" },
  promo: { bg: "bg-emerald-600", icon: "fa-tag" },
};

const DEFAULT_TESTIMONIALS: Testimonial[] = [
  { id: "1", name: "Ahmad", location: "Shah Alam", text: "First time camping and the vendor was super helpful! Gear was clean and ready.", rating: 5 },
  { id: "2", name: "Siti", location: "Kuantan", text: "So convenient! Found everything I needed in one place. Will use again.", rating: 5 },
  { id: "3", name: "Farid", location: "Johor Bahru", text: "Great prices and booking via WhatsApp was easy. Highly recommend!", rating: 5 },
];

// --- BADGE CONFIG (NEW) ---
const BADGE_CONFIG: Record<Badge, { icon: string; color: string; bg: string; border: string; label: string }> = {
  verified: { icon: "fa-check-circle", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", label: "Verified" },
  id_verified: { icon: "fa-id-card", color: "text-teal-600", bg: "bg-teal-50", border: "border-teal-200", label: "ID Verified" },
  top_rated: { icon: "fa-star", color: "text-amber-500", bg: "bg-amber-50", border: "border-amber-200", label: "Top Rated" },
  fast_responder: { icon: "fa-bolt", color: "text-blue-500", bg: "bg-blue-50", border: "border-blue-200", label: "Fast Responder" },
  premium: { icon: "fa-trophy", color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200", label: "Premium" },
};

function getAllBadges(vendor: Vendor): Badge[] {
  const auto: Badge[] = [];
  if (vendor.status === "approved") auto.push("verified");
  if ((vendor.total_orders || 0) >= 30 && (vendor.rating || 0) >= 4.7) auto.push("top_rated");
  if ((vendor.avg_response_time || 999) <= 120) auto.push("fast_responder");
  return [...new Set([...auto, ...(vendor.badges || [])])];
}

// --- VENDOR CARD ---
function VendorCard({ vendor, gear, index }: { vendor: Vendor; gear: GearItem[]; index: number }) {
  const logo = vendor.logo || vendor.image || "/pacak-khemah.png";
  const city = vendor.city || "Malaysia";
  const shopPath = vendor.slug ? `/shop/${vendor.slug}` : `/shop?v=${vendor.id}`;
  const isNew = vendor.createdAt && Date.now() - vendor.createdAt.toDate().getTime() < 30 * 24 * 60 * 60 * 1000;
  const topGear = gear.slice(0, 3);
  
  // NEW: Badge & Mockup
  const allBadges = getAllBadges(vendor);
  const isMockup = vendor.is_mockup === true;

  return (
    <Link href={shopPath}
      className={`group bg-white rounded-2xl border shadow-sm hover:shadow-xl transition-all flex flex-col h-full cursor-pointer stagger-in overflow-hidden ${
        isMockup ? "border-purple-200 ring-2 ring-purple-100" : "border-slate-100 hover:border-emerald-300"
      }`}
      style={{ animationDelay: `${index * 60}ms` }}>
      
      {/* NEW: Mockup Banner */}
      {isMockup && (
        <div className="bg-gradient-to-r from-purple-500 to-indigo-500 px-3 py-1.5 text-center">
          <span className="text-[8px] font-black text-white uppercase tracking-widest">
            <i className="fas fa-flask mr-1"></i> Demo Shop - See What's Possible!
          </span>
        </div>
      )}
      
      <div className="p-4 pb-3">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-12 h-12 rounded-xl p-1 shrink-0 transition-colors relative ${
            isMockup ? "bg-purple-50 group-hover:bg-purple-100" : "bg-slate-50 group-hover:bg-emerald-50"
          }`}>
            <img src={logo} className="w-full h-full object-contain" alt={vendor.name} />
            {/* NEW: Mockup flask icon */}
            {isMockup && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                <i className="fas fa-flask text-white text-[7px]"></i>
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className={`text-sm font-black uppercase leading-tight truncate transition-colors ${
                isMockup ? "text-purple-700 group-hover:text-purple-800" : "text-[#062c24] group-hover:text-emerald-700"
              }`}>{vendor.name}</h3>
              {isNew && !isMockup && <span className="bg-blue-100 text-blue-600 text-[7px] font-black px-1.5 py-0.5 rounded uppercase shrink-0">New</span>}
            </div>
            <p className="text-[9px] font-medium text-slate-400 italic truncate">{vendor.tagline || "Ready for adventure"}</p>
          </div>
        </div>
        
        {/* NEW: Badges Row */}
        {allBadges.length > 0 && (
          <div className="flex items-center gap-1 mb-2 flex-wrap">
            {allBadges.slice(0, 3).map(badge => {
              const config = BADGE_CONFIG[badge];
              return (
                <span key={badge} className={`inline-flex items-center gap-0.5 ${config.bg} ${config.color} border ${config.border} px-1.5 py-0.5 rounded-full`} title={config.label}>
                  <i className={`fas ${config.icon} text-[6px]`}></i>
                  <span className="text-[6px] font-bold uppercase">{config.label}</span>
                </span>
              );
            })}
            {allBadges.length > 3 && (
              <span className="text-[7px] font-bold text-slate-400">+{allBadges.length - 3}</span>
            )}
          </div>
        )}
        
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
      <div className={`mt-auto border-t px-4 py-2.5 transition-colors ${
        isMockup 
          ? "border-purple-100 bg-purple-50/50 group-hover:bg-purple-100/50" 
          : "border-slate-50 bg-slate-50/50 group-hover:bg-emerald-50/50"
      }`}>
        <div className="flex items-center justify-between">
          <span className={`text-[9px] font-bold uppercase ${isMockup ? "text-purple-600" : "text-emerald-600"}`}>
            {isMockup ? "Explore Demo →" : "View Shop →"}
          </span>
          {gear.length > 3 && <span className="text-[8px] font-bold text-slate-400">+{gear.length - 3} more</span>}
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
  const [vendorGear, setVendorGear] = useState<Record<string, GearItem[]>>({});
  const [loadingGear, setLoadingGear] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [showLocDropdown, setShowLocDropdown] = useState(false);
  const [customLocation, setCustomLocation] = useState("");
  const [socialLinks, setSocialLinks] = useState<{ instagram?: string; threads?: string; whatsapp?: string }>({});
  const [testimonials, setTestimonials] = useState<Testimonial[]>(DEFAULT_TESTIMONIALS);

  const [logoTaps, setLogoTaps] = useState(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vendorSectionRef = useRef<HTMLElement>(null);
  
  function handleLogoTap() {
    const next = logoTaps + 1;
    setLogoTaps(next);
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => setLogoTaps(0), 3000);
    if (next >= 5) { setLogoTaps(0); window.location.href = "/admin"; }
  }

  function scrollToVendors() {
    vendorSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleSearchInput(val: string) {
    setSearchTerm(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => applySearch(val), 150);
  }

  useEffect(() => { loadVendors(); loadEvents(); loadAnnouncement(); loadSocialLinks(); loadTestimonials(); }, []);

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
        .sort((a, b) => {
          // NEW: Mockup shops first
          if (a.is_mockup && !b.is_mockup) return -1;
          if (!a.is_mockup && b.is_mockup) return 1;
          return (b.credits || 0) - (a.credits || 0);
        });
      setAllVendors(vendors);
      setFilteredVendors(vendors);
      const locs = new Set<string>();
      vendors.forEach(v => {
        if (v.city) locs.add(v.city.trim());
        if (v.areas) v.areas.forEach(a => locs.add(a.trim()));
      });
      setLocations(Array.from(locs).sort());
      loadGearForVendors(vendors);
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

  async function loadTestimonials() {
    try {
      const snap = await getDocs(query(collection(db, "testimonials"), limit(3)));
      if (!snap.empty) {
        setTestimonials(snap.docs.map(d => ({ id: d.id, ...d.data() } as Testimonial)));
      }
    } catch { }
  }

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
    loadGearForVendors(filtered);
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

      {/* ═══ HERO SECTION ═══ */}
      <header className="bg-[#062c24] text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "url('/pattern-chevron.png')", backgroundSize: "300px" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-[#062c24] via-[#062c24]/50 to-[#062c24]/90" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 pt-6 pb-10">
          {/* Logo row */}
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-2.5 cursor-pointer select-none" onClick={handleLogoTap}>
              <img src="/pacak-khemah.png" className="h-10 w-10 object-contain rounded-xl" alt="Pacak Khemah" draggable={false} />
              <div>
                <h1 className="text-lg font-black tracking-tight leading-none">pacakkhemah</h1>
                <p className="text-[7px] font-bold text-emerald-400 uppercase tracking-[0.15em]">Pacak. Rehat. Ulang.</p>
              </div>
            </div>
            <Link href="/store" className="text-[9px] font-bold text-white/60 hover:text-white transition-colors flex items-center gap-2">
              <i className="fas fa-store"></i> <span className="hidden sm:inline">Vendor Login</span>
            </Link>
          </div>

          {/* Hero content */}
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight mb-3 leading-tight">
              Rent Camping Gear.<br/>
              <span className="text-emerald-400">Without Hassle.</span>
            </h2>
            <p className="text-sm text-white/70 max-w-md mx-auto mb-6 leading-relaxed">
              Rent quality camping gear from verified local vendors across Malaysia. Tents, sleeping bags, cooking equipment & more.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={scrollToVendors} className="bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-3.5 rounded-xl font-black uppercase text-xs tracking-widest transition-all shadow-lg">
                <i className="fas fa-search mr-2"></i> Find Vendors
              </button>
              <Link href="/register-vendor" className="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-6 py-3.5 rounded-xl font-black uppercase text-xs tracking-widest transition-all">
                <i className="fas fa-store mr-2"></i> Become a Vendor
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ═══ TRUST BADGES ═══ */}
      <section className="bg-white border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {[
              { icon: "fa-check-circle", text: "Verified Vendors" },
              { icon: "fa-shield-alt", text: "Secure Booking" },
              { icon: "fa-whatsapp", text: "Direct WhatsApp", fab: true },
              { icon: "fa-tag", text: "No Hidden Fees" },
            ].map((badge, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                <i className={`${badge.fab ? "fab" : "fas"} ${badge.icon} text-emerald-500`}></i>
                <span>{badge.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="max-w-4xl mx-auto px-4 py-8">
        <h3 className="text-center text-xs font-black text-slate-400 uppercase tracking-widest mb-6">How It Works</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { step: "1", icon: "fa-search", title: "Find", desc: "Browse vendors near you" },
            { step: "2", icon: "fa-calendar-check", title: "Select", desc: "Pick dates & gear" },
            { step: "3", icon: "fa-comments", title: "Book", desc: "Confirm via WhatsApp" },
          ].map((item, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 text-center border border-slate-100 shadow-sm">
              <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 text-sm font-black">
                {item.step}
              </div>
              <p className="text-xs font-black text-[#062c24] uppercase mb-1">{item.title}</p>
              <p className="text-[10px] text-slate-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ VENDOR SEARCH & GRID ═══ */}
      <main className="max-w-6xl mx-auto px-4 space-y-6" ref={vendorSectionRef}>
        <section>
          <h2 className="text-base font-black text-[#062c24] mb-1">Where to Pacak Khemah Today?</h2>
          <p className="text-xs text-slate-400 mb-3">or your preferred pick up location</p>

          <div className="relative mb-2" data-loc-dropdown>
            <i className="fas fa-map-marker-alt absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 text-sm z-10"></i>
            <input
              type="text"
              value={locationSearch}
              onChange={e => { setLocationSearch(e.target.value); setShowLocDropdown(true); setCustomLocation(""); }}
              onFocus={() => setShowLocDropdown(true)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const exactMatch = locations.find(l => l.toLowerCase() === locationSearch.toLowerCase());
                  if (exactMatch) {
                    filterBy(exactMatch);
                    setLocationSearch(exactMatch);
                  } else if (locationSearch) {
                    const partialMatch = locations.find(l => l.toLowerCase().includes(locationSearch.toLowerCase()));
                    if (partialMatch) {
                      filterBy(partialMatch);
                      setLocationSearch(partialMatch);
                    } else {
                      setCustomLocation(locationSearch);
                      setFilteredVendors([]);
                    }
                  }
                  setShowLocDropdown(false);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="Search or pick a location..."
              className="w-full bg-white text-[#062c24] py-4 pl-11 pr-24 rounded-xl shadow-sm border border-slate-200 outline-none font-bold text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 transition-all"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {locationSearch && (
                <button onClick={() => { setLocationSearch(""); setCustomLocation(""); filterBy("all"); setShowLocDropdown(false); }}
                  className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors">
                  <i className="fas fa-times text-xs"></i>
                </button>
              )}
              {locationSearch ? (
                <button 
                  onClick={() => {
                    const exactMatch = locations.find(l => l.toLowerCase() === locationSearch.toLowerCase());
                    if (exactMatch) {
                      filterBy(exactMatch);
                      setLocationSearch(exactMatch);
                    } else {
                      const partialMatch = locations.find(l => l.toLowerCase().includes(locationSearch.toLowerCase()));
                      if (partialMatch) {
                        filterBy(partialMatch);
                        setLocationSearch(partialMatch);
                      } else {
                        setCustomLocation(locationSearch);
                        setFilteredVendors([]);
                      }
                    }
                    setShowLocDropdown(false);
                  }}
                  className="w-8 h-8 flex items-center justify-center bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors shadow-sm">
                  <i className="fas fa-search text-xs"></i>
                </button>
              ) : (
                <button onClick={() => setShowLocDropdown(!showLocDropdown)}
                  className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-emerald-600 transition-colors">
                  <i className={`fas fa-chevron-down text-xs transition-transform ${showLocDropdown ? "rotate-180" : ""}`}></i>
                </button>
              )}
            </div>

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
                  <button onClick={() => { setCustomLocation(locationSearch); setFilteredVendors([]); setShowLocDropdown(false); }}
                    className="w-full text-left px-4 py-3 text-sm font-bold text-slate-400 hover:bg-slate-50">
                    <i className="fas fa-search text-slate-300 mr-2 text-xs"></i> Search "{locationSearch}"
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="flex justify-between items-end mb-3">
            <div>
              <h2 className="text-base font-black text-[#062c24]">What to Pacak Khemah Today?</h2>
              <p className="text-xs text-slate-400">select vendor near you</p>
            </div>
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
              <div className="col-span-full text-center py-12">
                {customLocation ? (
                  <div className="max-w-md mx-auto">
                    {/* Fun illustration */}
                    <div className="relative inline-block mb-6">
                      <div className="text-6xl animate-bounce">🏕️</div>
                      <div className="absolute -right-2 -top-2 text-2xl animate-pulse">🔍</div>
                    </div>
                    
                    <h3 className="text-lg font-black text-[#062c24] mb-2">
                      Oops! No vendors in {customLocation}... yet! 😅
                    </h3>
                    
                    <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                      We&apos;re on a mission to bring camping gear rentals everywhere! 
                      Our scouts are actively searching this area. 🕵️‍♂️
                    </p>

                    {/* CTA Cards */}
                    <div className="space-y-3 text-left">
                      {/* Know a vendor? */}
                      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                            <span className="text-lg">🤝</span>
                          </div>
                          <div>
                            <p className="text-sm font-black text-amber-800 mb-1">Know a camping gear vendor?</p>
                            <p className="text-xs text-amber-600 mb-2">Help us connect! Ask them to join Pacak Khemah and serve campers in your area.</p>
                            <a href="https://wa.me/6011136904336?text=Hi!%20I%20know%20a%20camping%20gear%20vendor%20who%20might%20want%20to%20join%20Pacak%20Khemah!" 
                              target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-2 text-[10px] font-black text-amber-700 hover:text-amber-900 uppercase">
                              <i className="fab fa-whatsapp"></i> Tell Us About Them
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* Got extra gear? */}
                      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                            <span className="text-lg">⛺</span>
                          </div>
                          <div>
                            <p className="text-sm font-black text-emerald-800 mb-1">Got camping gear collecting dust?</p>
                            <p className="text-xs text-emerald-600 mb-2">Turn your extra tents and gear into extra income! Join as a vendor and start earning. 💰</p>
                            <Link href="/register"
                              className="inline-flex items-center gap-2 text-[10px] font-black text-emerald-700 hover:text-emerald-900 uppercase">
                              <i className="fas fa-rocket"></i> Become a Vendor
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Browse all button */}
                    <button onClick={() => { setLocationSearch(""); setCustomLocation(""); filterBy("all"); }}
                      className="mt-6 px-6 py-3 bg-[#062c24] text-white rounded-xl text-[10px] font-black uppercase hover:bg-emerald-800 transition-all shadow-lg">
                      <i className="fas fa-globe mr-2"></i> Browse All Locations
                    </button>
                  </div>
                ) : (
                  <div className="max-w-sm mx-auto">
                    <div className="text-5xl mb-4">🏕️</div>
                    <p className="text-sm font-black text-slate-500 mb-2">No active hubs yet</p>
                    <p className="text-xs text-slate-400 mb-4">Be the first vendor in your area!</p>
                    <Link href="/register"
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase hover:bg-emerald-600 shadow-lg">
                      <i className="fas fa-plus"></i> Join as Vendor
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <>
                {displayList.slice(0, 6).map((vendor, i) => (
                  <VendorCard key={vendor.id} vendor={vendor} gear={vendorGear[vendor.id] || []} index={i} />
                ))}
                {displayList.length >= 6 && <AdBanner variant="card" />}
                {displayList.slice(6).map((vendor, i) => (
                  <VendorCard key={vendor.id} vendor={vendor} gear={vendorGear[vendor.id] || []} index={i + 6} />
                ))}
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

      {/* ═══ TESTIMONIALS ═══ */}
      <section className="bg-white border-y border-slate-100 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <h3 className="text-center text-xs font-black text-slate-400 uppercase tracking-widest mb-6">What Campers Say</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {testimonials.map((t) => (
              <div key={t.id} className="bg-slate-50 rounded-2xl p-5">
                <div className="flex gap-0.5 mb-3">
                  {[...Array(5)].map((_, j) => (
                    <i key={j} className={`fas fa-star text-xs ${j < t.rating ? "text-amber-400" : "text-slate-200"}`}></i>
                  ))}
                </div>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xs font-black">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-[#062c24]">{t.name}</p>
                    <p className="text-[9px] text-slate-400">{t.location}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ VENDOR CTA ═══ */}
      <section className="max-w-4xl mx-auto px-4 py-10">
        <div className="bg-gradient-to-br from-[#062c24] to-emerald-800 rounded-3xl p-8 text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url('/pattern-chevron.png')", backgroundSize: "200px" }} />
          <div className="relative z-10">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-store text-2xl"></i>
            </div>
            <h3 className="text-xl font-black uppercase mb-2">Got Camping Gear?</h3>
            <p className="text-sm text-emerald-200 max-w-md mx-auto mb-6">
              Turn your equipment into income. Join {allVendors.length > 0 ? `${allVendors.length}+` : "our"} verified vendors on Pacak Khemah.
            </p>
            <Link href="/register-vendor" className="inline-block bg-white text-[#062c24] px-8 py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-emerald-50 transition-colors shadow-lg">
              <i className="fas fa-rocket mr-2"></i> Start Earning
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="text-center py-8 border-t border-slate-200 bg-white">
        <h4 className="font-black text-[#062c24] text-lg mb-1">PACAK KHEMAH</h4>
        <p className="text-[9px] font-bold text-slate-400 uppercase mb-4">Pacak. Rehat. Ulang.</p>
        
        <div className="flex justify-center gap-6 mb-4">
          <Link href="/about" className="text-[10px] font-bold text-slate-500 hover:text-emerald-600 transition-colors">
            <i className="fas fa-info-circle mr-1.5"></i>About
          </Link>
          <Link href="/faq" className="text-[10px] font-bold text-slate-500 hover:text-emerald-600 transition-colors">
            <i className="fas fa-question-circle mr-1.5"></i>FAQ
          </Link>
          <Link href="/store" className="text-[10px] font-bold text-slate-500 hover:text-emerald-600 transition-colors">
            <i className="fas fa-store mr-1.5"></i>Vendor Login
          </Link>
        </div>
        
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
            <Link href="/register" className="block w-full bg-[#062c24] text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-900 shadow-lg">
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