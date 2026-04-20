"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, collection, getDocs, addDoc, deleteDoc, updateDoc, serverTimestamp } from "firebase/firestore";

type FAQItem = { question: string; answer: string };
type FAQSection = { title: string; icon: string; items: FAQItem[] };
type Testimonial = { id?: string; name: string; location: string; text: string; rating: number };
type Event = { id?: string; name: string; poster: string; link: string; organizer: string };
type Announcement = { isActive: boolean; message: string; type: "info" | "warning" | "promo" };

type AboutContent = {
  story: string;
  whatWeDo: string;
  forCampers: string;
  forVendors: string;
  whyChooseUs: { title: string; desc: string; icon: string }[];
  mission: string;
  contactEmail: string;
  contactWhatsApp: string;
};

type HomepageContent = {
  heroTitle: string;
  heroSubtitle: string;
  heroCta: string;
};

type FooterContent = {
  companyName: string;
  copyright: string;
  links: { label: string; url: string }[];
};

const DEFAULT_ABOUT: AboutContent = {
  story: "Pacak Khemah was born out of a passion for the outdoors...",
  whatWeDo: "We provide a comprehensive multi-vendor ecosystem...",
  forCampers: "We offer a seamless browse and book experience...",
  forVendors: "We provide a powerful Vendor Studio Command Center...",
  whyChooseUs: [
    { title: "Local Expertise", desc: "We empower local gear owners.", icon: "fa-map-marker-alt" },
    { title: "Simplified Logistics", desc: "Dynamic pickup hubs.", icon: "fa-truck" },
    { title: "Security & Trust", desc: "Built-in identity verification.", icon: "fa-shield-alt" },
    { title: "Transparent Pricing", desc: "Complex discounting rules.", icon: "fa-tags" },
  ],
  mission: "To become the ultimate companion for every outdoor enthusiast in Malaysia.",
  contactEmail: "hello@pacakkhemah.com",
  contactWhatsApp: "60123456789",
};

const DEFAULT_ANNOUNCEMENT: Announcement = { isActive: false, message: "", type: "info" };

export default function ContentTab() {
  const [activeSection, setActiveSection] = useState<"about" | "faq" | "homepage" | "testimonials" | "events" | "announcement">("announcement");
  const [about, setAbout] = useState<AboutContent>(DEFAULT_ABOUT);
  const [faq, setFaq] = useState<FAQSection[]>([]);
  const [homepage, setHomepage] = useState<HomepageContent>({ heroTitle: "", heroSubtitle: "", heroCta: "" });
  const [footer, setFooter] = useState<FooterContent>({ companyName: "", copyright: "", links: [] });
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [announcement, setAnnouncement] = useState<Announcement>(DEFAULT_ANNOUNCEMENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Modal states
  const [showTestimonialModal, setShowTestimonialModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState<Testimonial | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  useEffect(() => {
    loadContent();
  }, []);

  async function loadContent() {
    try {
      const [contentSnap, faqSnap, announcementSnap, testimonialsSnap, eventsSnap] = await Promise.all([
        getDoc(doc(db, "settings", "content")),
        getDoc(doc(db, "settings", "faq")),
        getDoc(doc(db, "settings", "global_announcement")),
        getDocs(collection(db, "testimonials")),
        getDocs(collection(db, "events")),
      ]);

      if (contentSnap.exists()) {
        const data = contentSnap.data();
        if (data.about) setAbout({ ...DEFAULT_ABOUT, ...data.about });
        if (data.homepage) setHomepage(data.homepage);
        if (data.footer) setFooter(data.footer);
      }
      if (faqSnap.exists() && faqSnap.data().sections) {
        setFaq(faqSnap.data().sections);
      }
      if (announcementSnap.exists()) {
        setAnnouncement({ ...DEFAULT_ANNOUNCEMENT, ...announcementSnap.data() });
      }
      setTestimonials(testimonialsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Testimonial)));
      setEvents(eventsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Event)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function saveContent() {
    setSaving(true);
    try {
      await Promise.all([
        setDoc(doc(db, "settings", "content"), { about, homepage, footer }),
        setDoc(doc(db, "settings", "faq"), { sections: faq }),
        setDoc(doc(db, "settings", "global_announcement"), announcement),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
      alert("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  // Testimonial CRUD
  async function saveTestimonial(t: Testimonial) {
    try {
      if (t.id) {
        await updateDoc(doc(db, "testimonials", t.id), { name: t.name, location: t.location, text: t.text, rating: t.rating });
      } else {
        await addDoc(collection(db, "testimonials"), { ...t, createdAt: serverTimestamp() });
      }
      loadContent();
      setShowTestimonialModal(false);
      setEditingTestimonial(null);
    } catch (e) {
      console.error(e);
      alert("Failed to save testimonial");
    }
  }

  async function deleteTestimonial(id: string) {
    if (!confirm("Delete this testimonial?")) return;
    try {
      await deleteDoc(doc(db, "testimonials", id));
      loadContent();
    } catch (e) {
      console.error(e);
    }
  }

  // Event CRUD
  async function saveEvent(e: Event) {
    try {
      if (e.id) {
        await updateDoc(doc(db, "events", e.id), { name: e.name, poster: e.poster, link: e.link, organizer: e.organizer });
      } else {
        await addDoc(collection(db, "events"), { ...e, createdAt: serverTimestamp() });
      }
      loadContent();
      setShowEventModal(false);
      setEditingEvent(null);
    } catch (e) {
      console.error(e);
      alert("Failed to save event");
    }
  }

  async function deleteEvent(id: string) {
    if (!confirm("Delete this event?")) return;
    try {
      await deleteDoc(doc(db, "events", id));
      loadContent();
    } catch (e) {
      console.error(e);
    }
  }

  // FAQ helpers
  function addFaqSection() { setFaq([...faq, { title: "New Section", icon: "fa-question", items: [] }]); }
  function removeFaqSection(idx: number) { setFaq(faq.filter((_, i) => i !== idx)); }
  function updateFaqSection(idx: number, field: string, value: string) {
    const updated = [...faq];
    updated[idx] = { ...updated[idx], [field]: value };
    setFaq(updated);
  }
  function addFaqItem(sectionIdx: number) {
    const updated = [...faq];
    updated[sectionIdx].items.push({ question: "", answer: "" });
    setFaq(updated);
  }
  function removeFaqItem(sectionIdx: number, itemIdx: number) {
    const updated = [...faq];
    updated[sectionIdx].items = updated[sectionIdx].items.filter((_, i) => i !== itemIdx);
    setFaq(updated);
  }
  function updateFaqItem(sectionIdx: number, itemIdx: number, field: string, value: string) {
    const updated = [...faq];
    updated[sectionIdx].items[itemIdx] = { ...updated[sectionIdx].items[itemIdx], [field]: value };
    setFaq(updated);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <i className="fas fa-spinner fa-spin text-2xl text-emerald-500"></i>
      </div>
    );
  }

  const sections = [
    { id: "announcement", label: "Announcement", icon: "fa-bullhorn" },
    { id: "homepage", label: "Homepage", icon: "fa-home" },
    { id: "about", label: "About Page", icon: "fa-info-circle" },
    { id: "faq", label: "FAQ", icon: "fa-question-circle" },
    { id: "testimonials", label: "Testimonials", icon: "fa-star" },
    { id: "events", label: "Events", icon: "fa-calendar" },
  ] as const;

  return (
    <div className="space-y-6 pb-20">
      
      {/* Mobile-Friendly Horizontal Scroll Tabs */}
      <div className="flex overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap gap-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {sections.map(sec => (
          <button
            key={sec.id}
            onClick={() => setActiveSection(sec.id)}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-black uppercase transition-all shrink-0 ${
              activeSection === sec.id
                ? "bg-[#062c24] text-white shadow-md"
                : "bg-white text-slate-500 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <i className={`fas ${sec.icon}`}></i>
            {sec.label}
          </button>
        ))}
      </div>

      {/* Announcement */}
      {activeSection === "announcement" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-black text-[#062c24] uppercase">Global Banner</h3>
              <p className="text-[10px] text-slate-400 font-bold mt-1">Show a site-wide message at the top of the screen.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={announcement.isActive}
                onChange={e => setAnnouncement({ ...announcement, isActive: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>
          <div className="space-y-5">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Message Style</label>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                {(["info", "warning", "promo"] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setAnnouncement({ ...announcement, type })}
                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase transition-all flex justify-center items-center gap-2 border ${
                      announcement.type === type
                        ? type === "info" ? "bg-blue-500 text-white border-blue-600" :
                          type === "warning" ? "bg-amber-500 text-white border-amber-600" :
                          "bg-purple-500 text-white border-purple-600"
                        : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <i className={`fas ${type === "info" ? "fa-info-circle" : type === "warning" ? "fa-exclamation-triangle" : "fa-gift"}`}></i>
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Announcement Text</label>
              <input
                value={announcement.message}
                onChange={e => setAnnouncement({ ...announcement, message: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm font-semibold outline-none focus:border-emerald-500 focus:bg-white transition-all"
                placeholder="e.g., 🎉 Welcome to our new multi-vendor platform!"
              />
            </div>
            {announcement.isActive && announcement.message && (
              <div className={`p-4 rounded-xl text-white text-center text-xs font-bold shadow-inner ${
                announcement.type === "info" ? "bg-blue-600" :
                announcement.type === "warning" ? "bg-amber-600" :
                "bg-purple-600"
              }`}>
                Preview: {announcement.message}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Homepage */}
      {activeSection === "homepage" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-6 shadow-sm">
          <h3 className="text-sm font-black text-[#062c24] uppercase mb-4">Hero Section Content</h3>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Main Title</label>
              <input
                value={homepage.heroTitle}
                onChange={e => setHomepage({ ...homepage, heroTitle: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm font-bold outline-none focus:border-emerald-500 focus:bg-white transition-all"
                placeholder="Sewa Gear Camping. Tanpa Hassle."
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Subtitle / Description</label>
              <textarea
                value={homepage.heroSubtitle}
                onChange={e => setHomepage({ ...homepage, heroSubtitle: e.target.value })}
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm font-medium outline-none resize-none focus:border-emerald-500 focus:bg-white transition-all"
                placeholder="Rent quality camping gear from trusted local vendors..."
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Primary CTA Button</label>
              <input
                value={homepage.heroCta}
                onChange={e => setHomepage({ ...homepage, heroCta: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm font-bold outline-none focus:border-emerald-500 focus:bg-white transition-all"
                placeholder="Explore Gear"
              />
            </div>
          </div>
        </div>
      )}

      {/* About Page */}
      {activeSection === "about" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-6 shadow-sm">
            <h3 className="text-sm font-black text-[#062c24] uppercase mb-4">Our Story</h3>
            <textarea
              value={about.story}
              onChange={e => setAbout({ ...about, story: e.target.value })}
              rows={4}
              className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm outline-none resize-none focus:border-emerald-500 focus:bg-white transition-all"
            />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-6 shadow-sm">
              <h3 className="text-sm font-black text-[#062c24] uppercase mb-4">Value for Campers</h3>
              <textarea
                value={about.forCampers}
                onChange={e => setAbout({ ...about, forCampers: e.target.value })}
                rows={4}
                className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm outline-none resize-none focus:border-emerald-500 focus:bg-white transition-all"
              />
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-6 shadow-sm">
              <h3 className="text-sm font-black text-[#062c24] uppercase mb-4">Value for Vendors</h3>
              <textarea
                value={about.forVendors}
                onChange={e => setAbout({ ...about, forVendors: e.target.value })}
                rows={4}
                className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm outline-none resize-none focus:border-emerald-500 focus:bg-white transition-all"
              />
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-6 shadow-sm">
            <h3 className="text-sm font-black text-[#062c24] uppercase mb-4">Our Mission</h3>
            <textarea
              value={about.mission}
              onChange={e => setAbout({ ...about, mission: e.target.value })}
              rows={2}
              className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm font-bold text-center outline-none resize-none focus:border-emerald-500 focus:bg-white transition-all"
            />
          </div>
        </div>
      )}

      {/* FAQ */}
      {activeSection === "faq" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div>
              <h3 className="text-sm font-black text-[#062c24] uppercase">Frequently Asked Questions</h3>
              <p className="text-[10px] text-slate-400 font-bold mt-1">{faq.length} categories active</p>
            </div>
            <button onClick={addFaqSection} className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm transition-all flex items-center justify-center gap-2">
              <i className="fas fa-plus"></i> Add Category
            </button>
          </div>

          {faq.map((section, sIdx) => (
            <div key={sIdx} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {/* FAQ Section Header - Made Mobile Responsive */}
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    value={section.icon}
                    onChange={e => updateFaqSection(sIdx, "icon", e.target.value)}
                    className="w-16 bg-white border border-slate-200 p-3 rounded-xl text-xs text-center outline-none focus:border-emerald-500"
                    placeholder="fa-icon"
                  />
                  <input
                    value={section.title}
                    onChange={e => updateFaqSection(sIdx, "title", e.target.value)}
                    className="flex-1 bg-white border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none focus:border-emerald-500"
                    placeholder="Category Title"
                  />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button onClick={() => addFaqItem(sIdx)} className="flex-1 sm:flex-none text-xs font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-4 py-3 rounded-xl transition-all">
                    + Q&A
                  </button>
                  <button onClick={() => removeFaqSection(sIdx)} className="w-12 sm:w-10 h-12 sm:h-10 text-red-400 bg-red-50 hover:bg-red-500 hover:text-white rounded-xl flex items-center justify-center transition-all">
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </div>

              {/* FAQ Items */}
              <div className="p-4 space-y-4">
                {section.items.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 font-medium py-4">No questions added yet.</p>
                ) : section.items.map((item, iIdx) => (
                  <div key={iIdx} className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex flex-col sm:flex-row gap-3 relative">
                    <div className="flex-1 space-y-3">
                      <input
                        value={item.question}
                        onChange={e => updateFaqItem(sIdx, iIdx, "question", e.target.value)}
                        className="w-full bg-white border border-slate-200 p-3.5 rounded-xl text-sm font-bold outline-none focus:border-emerald-500"
                        placeholder="Question"
                      />
                      <textarea
                        value={item.answer}
                        onChange={e => updateFaqItem(sIdx, iIdx, "answer", e.target.value)}
                        rows={2}
                        className="w-full bg-white border border-slate-200 p-3.5 rounded-xl text-sm outline-none resize-none focus:border-emerald-500"
                        placeholder="Answer"
                      />
                    </div>
                    <button onClick={() => removeFaqItem(sIdx, iIdx)} className="absolute top-2 right-2 sm:static sm:w-10 sm:h-auto text-slate-400 hover:text-red-500 flex items-center justify-center p-2 rounded-lg">
                      <i className="fas fa-times sm:fa-trash"></i>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Testimonials */}
      {activeSection === "testimonials" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div>
              <h3 className="text-sm font-black text-[#062c24] uppercase">Customer Testimonials</h3>
              <p className="text-[10px] text-slate-400 font-bold mt-1">{testimonials.length} reviews added</p>
            </div>
            <button onClick={() => { setEditingTestimonial({ name: "", location: "", text: "", rating: 5 }); setShowTestimonialModal(true); }}
              className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm transition-all flex items-center justify-center gap-2">
              <i className="fas fa-plus"></i> Add Review
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {testimonials.map(t => (
              <div key={t.id} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex flex-col">
                <div className="flex gap-1 mb-4 text-sm">
                  {[...Array(5)].map((_, j) => (
                    <i key={j} className={`fas fa-star ${j < t.rating ? "text-amber-400" : "text-slate-200"}`}></i>
                  ))}
                </div>
                <p className="text-sm text-slate-600 mb-6 flex-1 italic">"{t.text}"</p>
                <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                  <div>
                    <p className="text-xs font-black text-[#062c24] uppercase">{t.name}</p>
                    <p className="text-[10px] font-bold text-slate-400">{t.location}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingTestimonial(t); setShowTestimonialModal(true); }}
                      className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center hover:bg-blue-500 hover:text-white transition-all"><i className="fas fa-pen text-[10px]"></i></button>
                    <button onClick={() => deleteTestimonial(t.id!)}
                      className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"><i className="fas fa-trash text-[10px]"></i></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Events */}
      {activeSection === "events" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div>
              <h3 className="text-sm font-black text-[#062c24] uppercase">Community Events</h3>
              <p className="text-[10px] text-slate-400 font-bold mt-1">{events.length} upcoming events</p>
            </div>
            <button onClick={() => { setEditingEvent({ name: "", poster: "", link: "", organizer: "" }); setShowEventModal(true); }}
              className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm transition-all flex items-center justify-center gap-2">
              <i className="fas fa-plus"></i> Add Event
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {events.map(e => (
              <div key={e.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm flex flex-col">
                <div className="h-40 sm:h-32 bg-slate-100 relative group">
                  {e.poster ? (
                    <img src={e.poster} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={e.name} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300"><i className="fas fa-image text-2xl"></i></div>
                  )}
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <p className="text-xs font-black text-[#062c24] uppercase truncate mb-1">{e.name}</p>
                  <p className="text-[10px] font-bold text-slate-400 mb-4 truncate">{e.organizer}</p>
                  <div className="flex gap-2 mt-auto">
                    <button onClick={() => { setEditingEvent(e); setShowEventModal(true); }}
                      className="flex-1 bg-slate-50 text-slate-600 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-50 hover:text-blue-600 transition-all">
                      Edit
                    </button>
                    <button onClick={() => deleteEvent(e.id!)}
                      className="w-10 bg-red-50 text-red-500 rounded-xl text-[10px] flex items-center justify-center hover:bg-red-500 hover:text-white transition-all">
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floating Save Button */}
      <div className="fixed bottom-0 right-0 left-0 sm:left-64 p-4 lg:p-8 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent pointer-events-none flex justify-end">
        <button
          onClick={saveContent}
          disabled={saving}
          className={`pointer-events-auto px-6 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl transition-all flex items-center gap-3 ${
            saved ? "bg-emerald-500 text-white translate-y-0" : "bg-[#062c24] text-white hover:bg-emerald-800 hover:-translate-y-1"
          } disabled:opacity-50 disabled:hover:translate-y-0`}
        >
          {saving ? <><i className="fas fa-spinner fa-spin"></i> Saving...</> : saved ? <><i className="fas fa-check"></i> Published</> : <><i className="fas fa-save"></i> Save Changes</>}
        </button>
      </div>

      {/* Testimonial Modal */}
      {showTestimonialModal && editingTestimonial && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[600] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
            <h3 className="text-lg font-black text-[#062c24] uppercase mb-6 shrink-0">{editingTestimonial.id ? "Edit" : "Add"} Testimonial</h3>
            <div className="space-y-4 overflow-y-auto pr-2 pb-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Customer Name</label>
                <input value={editingTestimonial.name} onChange={e => setEditingTestimonial({ ...editingTestimonial, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm font-bold outline-none focus:border-emerald-500" placeholder="e.g. Ahmad Abu" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Location</label>
                <input value={editingTestimonial.location} onChange={e => setEditingTestimonial({ ...editingTestimonial, location: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm font-bold outline-none focus:border-emerald-500" placeholder="e.g. Kuala Lumpur" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Review Text</label>
                <textarea value={editingTestimonial.text} onChange={e => setEditingTestimonial({ ...editingTestimonial, text: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm outline-none resize-none focus:border-emerald-500" rows={4} placeholder="What did they say?" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Star Rating</label>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(r => (
                    <button key={r} onClick={() => setEditingTestimonial({ ...editingTestimonial, rating: r })}
                      className={`w-12 h-12 rounded-xl text-lg transition-all ${editingTestimonial.rating >= r ? "bg-amber-100 text-amber-500 scale-105" : "bg-slate-50 text-slate-300 hover:bg-slate-100"}`}>
                      <i className="fas fa-star"></i>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-4 border-t border-slate-100 shrink-0">
              <button onClick={() => { setShowTestimonialModal(false); setEditingTestimonial(null); }}
                className="flex-1 py-4 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all">Cancel</button>
              <button onClick={() => saveTestimonial(editingTestimonial)}
                className="flex-1 py-4 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-emerald-500 hover:bg-emerald-600 transition-all">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Event Modal */}
      {showEventModal && editingEvent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[600] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
            <h3 className="text-lg font-black text-[#062c24] uppercase mb-6 shrink-0">{editingEvent.id ? "Edit" : "Add"} Event</h3>
            <div className="space-y-4 overflow-y-auto pr-2 pb-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Event Name</label>
                <input value={editingEvent.name} onChange={e => setEditingEvent({ ...editingEvent, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm font-bold outline-none focus:border-emerald-500" placeholder="e.g. Mega Campout 2024" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Organizer</label>
                <input value={editingEvent.organizer} onChange={e => setEditingEvent({ ...editingEvent, organizer: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm font-bold outline-none focus:border-emerald-500" placeholder="e.g. Pacak Khemah HQ" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Poster Image URL</label>
                <input value={editingEvent.poster} onChange={e => setEditingEvent({ ...editingEvent, poster: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm outline-none focus:border-emerald-500" placeholder="https://..." />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Link / URL</label>
                <input value={editingEvent.link} onChange={e => setEditingEvent({ ...editingEvent, link: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm outline-none focus:border-emerald-500" placeholder="https://..." />
              </div>
            </div>
            <div className="flex gap-3 pt-4 border-t border-slate-100 shrink-0">
              <button onClick={() => { setShowEventModal(false); setEditingEvent(null); }}
                className="flex-1 py-4 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all">Cancel</button>
              <button onClick={() => saveEvent(editingEvent)}
                className="flex-1 py-4 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-emerald-500 hover:bg-emerald-600 transition-all">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}