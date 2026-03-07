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
  badges?: Badge[];
  is_mockup?: boolean;
  total_orders?: number;
  avg_response_time?: number;
};
type GearItem = {
  id: string; name: string; price: number; img?: string; images?: string[];
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

// --- BADGE CONFIG ---
const BADGE_CONFIG: Record<Badge, { icon: string; color: string; bg: string; border: string; label: string }> = {
  verified: { icon: "fa-check-circle", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", label: "Verified" },
  id_verified: { icon: "fa-id-card", color: "text-teal-600", bg: "bg-teal-50", border: "border-teal-200", label: "ID Verified" },
  top_rated: { icon: "fa-star", color: "text-amber-500", bg: "bg-amber-50", border: "border-amber-200", label: "Top Rated" },
  fast_responder: { icon: "fa-bolt", color: "text-blue-500", bg: "bg-blue-50", border: "border-blue-200", label: "Fast Responder" },
  premium: { icon: "fa-trophy", color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200", label: "Premium" },
};

function getAutoBadges(vendor: Vendor): Badge[] {
  const badges: Badge[] = [];
  if (vendor.status === "approved") badges.push("verified");
  if ((vendor.total_orders || 0) >= 30 && (vendor.rating || 0) >= 4.7) badges.push("top_rated");
  if ((vendor.avg_response_time || 999) <= 120) badges.push("fast_responder");
  return badges;
}

function getAllBadges(vendor: Vendor): Badge[] {
  return [...new Set([...getAutoBadges(vendor), ...(vendor.badges || [])])];
}

// --- VENDOR CARD ---
function VendorCard({ vendor, gear, index }: { vendor: Vendor; gear: GearItem[]; index: number }) {
  const logo = vendor.logo || vendor.image || "/pacak-khemah.png";
  const city = vendor.city || "Malaysia";
  const shopPath = vendor.slug ? `/shop/${vendor.slug}` : `/shop?v=${vendor.id}`;
  const isNew = vendor.createdAt && Date.now() - vendor.createdAt.toDate().getTime() < 30 * 24 * 60 * 60 * 1000;
  const topGear = gear.slice(0, 3);
  const allBadges = getAllBadges(vendor);
  const isMockup = vendor.is_mockup === true;

  return (
    <Link href={shopPath}
      className={`group bg-white rounded-2xl border shadow-sm hover:shadow-xl transition-all flex flex-col h-full cursor-pointer stagger-in overflow-hidden ${
        isMockup ? "border-purple-200 ring-2 ring-purple-100" : "border-slate-100 hover:border-emerald-300"
      }`}
      style={{ animationDelay: `${index * 60}ms` }}>
      
      {isMockup && (
        <div className="bg-gradient-to-r from-purple-500 to-indigo-500 px-3 py-1.5 text-center">
          <span className="text-[8px] font-black text-white uppercase tracking-widest">
            <i className="fas fa-flask mr-1"></i> Demo Shop - See What's Possible!
          </span>
        </div>
      )}
      
      <div className="p-4 pb-3">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-12 h-12 rounded-xl p-1 shrink-0 transition-colors relative ${isMockup ? "bg-purple-50 group-hover:bg-purple-100" : "bg-slate-50 group-hover:bg-emerald-50"}`}>
            <img src={logo} className="w-full h-full object-contain" alt={vendor.name} />
            {isMockup && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                <i className="fas fa-flask text-white text-[7px]"></i>
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`text-sm font-black uppercase leading-tight truncate transition-colors ${isMockup ? "text-purple-700 group-hover:text-purple-800" : "text-[#062c24] group-hover:text-emerald-700"}`}>
                {vendor.name}
              </h3>
              {isNew && !isMockup && <span className="bg-blue-100 text-blue-600 text-[7px] font-black px-1.5 py-0.5 rounded uppercase shrink-0">New</span>}
            </div>
            <p className="text-[9px] font-medium text-slate-400 italic truncate">{vendor.tagline || "Ready for adventure"}</p>
          </div>
        </div>
        
        {allBadges.length > 0 && (
          <div className="flex items-center gap-1 mb-2 flex-wrap">
            {allBadges.slice(0, 4).map(badge => {
              const config = BADGE_CONFIG[badge];
              return (
                <span key={badge} className={`inline-flex items-center gap-0.5 ${config.bg} ${config.color} border ${config.border} px-1.5 py-0.5 rounded-full`} title={config.label}>
                  <i className={`fas ${config.icon} text-[7px]`}></i>
                  <span className="text-[7px] font-bold uppercase">{config.label}</span>
                </span>
              );
            })}
            {allBadges.length > 4 && (
              <span className="text-[8px] font-bold text-slate-400">+{allBadges.length - 4}</span>
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
                  <img src={item.images?.[0] || item.img || "/pacak-khemah.png"} className="w-full h-full object-cover" alt={item.name} />
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
        isMockup ? "border-purple-100 bg-purple-50/50 group-hover:bg-purple-100/50" : "border-slate-50 bg-slate-50/50 group-hover:bg-emerald-50/50"
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
  const [socialLinks, setSocialLinks] = useState<{ instagram?: string; threads?: string; whatsapp?: string }>({});
  const [testimonials, setTestimonials] = useState<Testimonial[]>(DEFAULT_TESTIMONIALS);

  const [logoTaps, setLogoTaps] = useState(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vendorSectionRef = useRef<HTMLElement>(null);
  
  function handleLogoTap() {
    const next = logoTaps + 1;
    setLogoTaps(next);
    if (tapTimer.current) clearTimeout(tapTimer.current);
    if (next === 5) { window.location.href = "/admin"; return; }
    tapTimer.current = setTimeout(() => setLogoTaps(0), 1500);
  }

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, "vendors"), where("status", "==", "approved")));
        const list: Vendor[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Vendor));
        const sorted = list.sort((a, b) => {
          if (a.is_mockup && !b.is_mockup) return -1;
          if (!a.is_mockup && b.is_mockup) return 1;
          return (b.credits || 0) - (a.credits || 0);
        });
        setAllVendors(sorted);
        setFilteredVendors(sorted);
        const locs = new Set<string>();
        list.forEach(v => { if (v.city) locs.add(v.city); v.areas?.forEach(a => locs.add(a)); });
        setLocations(Array.from(locs).sort());
      } catch (e) { console.error(e); setLoadError(true); }
      finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const settingsSnap = await getDoc(doc(db, "settings", "siteConfig"));
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          if (data.announcement?.isActive) setAnnouncement(data.announcement);
          if (data.socialLinks) setSocialLinks(data.socialLinks);
        }
        const eventsSnap = await getDocs(query(collection(db, "events"), where("isActive", "==", true), orderBy("createdAt", "desc"), limit(4)));
        setEvents(eventsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Event)));
        const testimonialSnap = await getDocs(query(collection(db, "testimonials"), where("isApproved", "==", true), orderBy("createdAt", "desc"), limit(3)));
        if (!testimonialSnap.empty) setTestimonials(testimonialSnap.docs.map(d => ({ id: d.id, ...d.data() } as Testimonial)));
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const visibleIds = filteredVendors.slice(0, visibleCount).map(v => v.id);
    const missing = visibleIds.filter(id => !vendorGear[id]);
    if (missing.length === 0) return;
    setLoadingGear(true);
    (async () => {
      const batches: string[][] = [];
      for (let i = 0; i < missing.length; i += 10) batches.push(missing.slice(i, i + 10));
      const newGear: Record<string, GearItem[]> = {};
      for (const batch of batches) {
        const snap = await getDocs(query(collection(db, "gear"), where("vendorId", "in", batch)));
        snap.docs.forEach(d => {
          const g = { id: d.id, ...d.data() } as GearItem;
          if (g.deleted) return;
          if (!newGear[g.vendorId]) newGear[g.vendorId] = [];
          newGear[g.vendorId].push(g);
        });
      }
      setVendorGear(prev => ({ ...prev, ...newGear }));
      setLoadingGear(false);
    })();
  }, [filteredVendors, visibleCount]);

  useEffect(() => {
    let result = allVendors;
    if (activeFilter !== "all") result = result.filter(v => v.city === activeFilter || v.areas?.includes(activeFilter));
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(v => v.name.toLowerCase().includes(q) || v.tagline?.toLowerCase().includes(q) || v.city?.toLowerCase().includes(q) || v.areas?.some(a => a.toLowerCase().includes(q)));
    }
    setFilteredVendors(result);
    setVisibleCount(LOAD_STEP);
  }, [activeFilter, searchTerm, allVendors]);

  const filteredLocations = locations.filter(l => l.toLowerCase().includes(locationSearch.toLowerCase()));
  const visibleVendors = filteredVendors.slice(0, visibleCount);
  const hasMore = visibleCount < filteredVendors.length;
  const annTheme = announcement ? announcementThemes[announcement.type] || announcementThemes.info : null;

  if (loadError) {
    return (
      <div className="fixed inset-0 bg-[#062c24] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-100 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl"><i className="fas fa-exclamation-triangle"></i></div>
        <h2 className="text-white text-xl font-black uppercase mb-2">Connection Error</h2>
        <p className="text-white/60 text-sm mb-6">Unable to load vendors. Please try again.</p>
        <button onClick={() => window.location.reload()} className="bg-white text-[#062c24] px-8 py-3 rounded-xl font-black uppercase text-xs">Retry</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: "#f0f2f1" }}>
      <header className="bg-[#062c24] text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "url('/pattern-chevron.png')", backgroundSize: "300px" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-[#062c24] via-[#062c24]/50 to-[#062c24]/90" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 pt-8 pb-10 text-center">
          <div onClick={handleLogoTap} className="w-20 h-20 bg-white rounded-2xl mx-auto mb-4 p-2 cursor-pointer shadow-lg">
            <img src="/pacak-khemah.png" className="w-full h-full object-contain" alt="Pacak Khemah" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight mb-1">Pacak Khemah</h1>
          <p className="text-emerald-300 font-bold text-xs uppercase tracking-widest">Pacak · Rehat · Ulang</p>
          <p className="text-sm text-emerald-100/60 mt-3 max-w-md mx-auto">Malaysia&apos;s camping gear rental marketplace. Find verified vendors, rent quality gear, and go adventure!</p>
        </div>
      </header>

      {announcement && showAnnouncement && annTheme && (
        <div className={`${annTheme.bg} text-white py-2.5 px-4 text-center relative`}>
          <p className="text-xs font-bold pr-6"><i className={`fas ${annTheme.icon} mr-2`}></i>{announcement.message}</p>
          <button onClick={() => setShowAnnouncement(false)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white"><i className="fas fa-times text-xs"></i></button>
        </div>
      )}

      <AdBanner slot="top" />

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-6 space-y-3">
          <div className="relative">
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-sm"></i>
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search vendors, gear, or locations..."
              className="w-full bg-slate-50 border border-slate-100 pl-11 pr-4 py-3.5 rounded-xl text-sm font-bold text-[#062c24] outline-none focus:border-emerald-300 focus:bg-white transition-all" />
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <button onClick={() => setShowLocDropdown(!showLocDropdown)}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${activeFilter !== "all" ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                <span className="flex items-center gap-2"><i className="fas fa-map-marker-alt"></i>{activeFilter === "all" ? "All Locations" : activeFilter}</span>
                <i className={`fas fa-chevron-down transition-transform ${showLocDropdown ? "rotate-180" : ""}`}></i>
              </button>
              {showLocDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-100 z-50 max-h-64 overflow-hidden">
                  <div className="p-2 border-b border-slate-100">
                    <input type="text" value={locationSearch} onChange={e => setLocationSearch(e.target.value)} placeholder="Search location..." className="w-full bg-slate-50 px-3 py-2 rounded-lg text-xs outline-none" />
                  </div>
                  <div className="overflow-y-auto max-h-48">
                    <button onClick={() => { setActiveFilter("all"); setShowLocDropdown(false); setLocationSearch(""); }}
                      className={`w-full px-4 py-2.5 text-left text-[10px] font-bold uppercase hover:bg-slate-50 ${activeFilter === "all" ? "text-emerald-600 bg-emerald-50" : "text-slate-600"}`}>All Locations</button>
                    {filteredLocations.map(loc => (
                      <button key={loc} onClick={() => { setActiveFilter(loc); setShowLocDropdown(false); setLocationSearch(""); }}
                        className={`w-full px-4 py-2.5 text-left text-[10px] font-bold uppercase hover:bg-slate-50 ${activeFilter === loc ? "text-emerald-600 bg-emerald-50" : "text-slate-600"}`}>{loc}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {activeFilter !== "all" && (
              <button onClick={() => setActiveFilter("all")} className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-all"><i className="fas fa-times text-xs"></i></button>
            )}
          </div>
        </div>

        <section ref={vendorSectionRef}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">{filteredVendors.length} Verified {filteredVendors.length === 1 ? "Vendor" : "Vendors"}</h2>
            {filteredVendors.some(v => v.is_mockup) && (
              <span className="text-[9px] font-bold text-purple-500 bg-purple-50 px-2 py-1 rounded-full"><i className="fas fa-flask mr-1"></i>Demo Available</span>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl p-4 h-64">
                  <div className="flex items-center gap-3 mb-4"><div className="w-12 h-12 rounded-xl skeleton"></div><div className="flex-1 space-y-2"><div className="h-4 w-3/4 rounded skeleton"></div><div className="h-3 w-1/2 rounded skeleton"></div></div></div>
                  <div className="flex gap-2"><div className="flex-1 aspect-square rounded-lg skeleton"></div><div className="flex-1 aspect-square rounded-lg skeleton"></div><div className="flex-1 aspect-square rounded-lg skeleton"></div></div>
                </div>
              ))}
            </div>
          ) : filteredVendors.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-300 text-2xl"><i className="fas fa-store-slash"></i></div>
              <h3 className="text-lg font-black text-slate-400 uppercase mb-2">No Vendors Found</h3>
              <p className="text-sm text-slate-400 mb-4">Try a different search or location.</p>
              <button onClick={() => { setSearchTerm(""); setActiveFilter("all"); }} className="text-emerald-600 font-bold text-xs hover:underline">Clear filters</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleVendors.map((v, i) => (<VendorCard key={v.id} vendor={v} gear={vendorGear[v.id] || []} index={i} />))}
            </div>
          )}

          {hasMore && (
            <div className="text-center mt-6">
              <button onClick={() => setVisibleCount(prev => prev + LOAD_STEP)} className="bg-white border border-slate-200 text-slate-500 font-bold uppercase text-[10px] px-8 py-3 rounded-xl hover:bg-slate-50 hover:text-[#062c24] shadow-sm">Load More <i className="fas fa-chevron-down ml-2"></i></button>
            </div>
          )}
        </section>

        {events.length > 0 && (
          <section className="pb-8 mt-8">
            <div className="flex items-center gap-3 mb-4"><div className="h-px flex-1 bg-slate-200"></div><h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">What&apos;s Up? Malaysia</h3><div className="h-px flex-1 bg-slate-200"></div></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {events.map(e => (
                <a key={e.id} href={e.link} target="_blank" rel="noreferrer" className="group bg-white rounded-xl border border-slate-100 overflow-hidden hover:shadow-lg transition-all">
                  <div className="h-24 overflow-hidden relative"><img src={e.poster} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={e.name} /></div>
                  <div className="p-3"><h4 className="text-[10px] font-black text-[#062c24] uppercase leading-tight line-clamp-2">{e.name}</h4><p className="text-[8px] font-bold text-slate-400 mt-1">{e.organizer || "Event"}</p></div>
                </a>
              ))}
            </div>
          </section>
        )}
      </main>

      <section className="bg-white border-y border-slate-100 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <h3 className="text-center text-xs font-black text-slate-400 uppercase tracking-widest mb-6">What Campers Say</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {testimonials.map((t) => (
              <div key={t.id} className="bg-slate-50 rounded-2xl p-5">
                <div className="flex gap-0.5 mb-3">{[...Array(5)].map((_, j) => (<i key={j} className={`fas fa-star text-xs ${j < t.rating ? "text-amber-400" : "text-slate-200"}`}></i>))}</div>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xs font-black">{t.name.charAt(0)}</div>
                  <div><p className="text-[10px] font-black text-[#062c24]">{t.name}</p><p className="text-[9px] text-slate-400">{t.location}</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 py-10">
        <div className="bg-gradient-to-br from-[#062c24] to-emerald-800 rounded-3xl p-8 text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url('/pattern-chevron.png')", backgroundSize: "200px" }} />
          <div className="relative z-10">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4"><i className="fas fa-store text-2xl"></i></div>
            <h3 className="text-xl font-black uppercase mb-2">Got Camping Gear?</h3>
            <p className="text-sm text-emerald-200 max-w-md mx-auto mb-6">Turn your equipment into income. Join {allVendors.length > 0 ? `${allVendors.length}+` : "our"} verified vendors on Pacak Khemah.</p>
            <Link href="/register-vendor" className="inline-block bg-white text-[#062c24] px-8 py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-emerald-50 transition-colors shadow-lg"><i className="fas fa-rocket mr-2"></i> Start Earning</Link>
          </div>
        </div>
      </section>

      <footer className="text-center py-8 border-t border-slate-200 bg-white">
        <h4 className="font-black text-[#062c24] text-lg mb-1">PACAK KHEMAH</h4>
        <p className="text-[9px] font-bold text-slate-400 uppercase mb-4">Pacak. Rehat. Ulang.</p>
        <div className="flex justify-center gap-6 mb-4">
          <Link href="/about" className="text-[10px] font-bold text-slate-500 hover:text-emerald-600 transition-colors"><i className="fas fa-info-circle mr-1.5"></i>About</Link>
          <Link href="/faq" className="text-[10px] font-bold text-slate-500 hover:text-emerald-600 transition-colors"><i className="fas fa-question-circle mr-1.5"></i>FAQ</Link>
          <Link href="/store" className="text-[10px] font-bold text-slate-500 hover:text-emerald-600 transition-colors"><i className="fas fa-store mr-1.5"></i>Vendor Login</Link>
        </div>
        <div className="flex justify-center gap-3 mb-4">
          {socialLinks.instagram && (<a href={socialLinks.instagram} target="_blank" rel="noreferrer" className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 hover:text-pink-500 hover:bg-pink-50 transition-colors"><i className="fab fa-instagram text-sm"></i></a>)}
          {socialLinks.threads && (<a href={socialLinks.threads} target="_blank" rel="noreferrer" className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 hover:text-black hover:bg-slate-200 transition-colors"><i className="fab fa-threads text-sm"></i></a>)}
          {socialLinks.whatsapp && (<a href={socialLinks.whatsapp} target="_blank" rel="noreferrer" className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 transition-colors"><i className="fab fa-whatsapp text-sm"></i></a>)}
        </div>
        <p className="text-[8px] text-slate-300 uppercase">© 2026 Pacak Khemah. All rights reserved.</p>
      </footer>

      {showModal && (
        <div className="fixed inset-0 bg-[#062c24]/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl relative text-center">
            <button onClick={() => setShowModal(false)} className="absolute top-5 right-5 w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:text-red-500"><i className="fas fa-times"></i></button>
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6 text-emerald-600 text-2xl"><i className="fas fa-store"></i></div>
            <h3 className="text-2xl font-black text-[#062c24] uppercase mb-2">Want to Rent Out Gear?</h3>
            <p className="text-xs text-slate-500 mb-6 font-medium">Join Malaysia&apos;s fastest growing camping gear rental network.</p>
            <Link href="/register" className="block w-full bg-[#062c24] text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-900 shadow-lg"><i className="fas fa-rocket mr-2"></i> Get Started</Link>
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