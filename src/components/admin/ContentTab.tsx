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
  const [activeSection, setActiveSection] = useState<"about" | "faq" | "homepage" | "testimonials" | "events" | "announcement">("about");
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
  function addFaqSection() {
    setFaq([...faq, { title: "New Section", icon: "fa-question", items: [] }]);
  }
  function removeFaqSection(idx: number) {
    setFaq(faq.filter((_, i) => i !== idx));
  }
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
        <i className="fas fa-spinner fa-spin text-2xl text-slate-300"></i>
      </div>
    );
  }

  const sections = [
    { id: "announcement", label: "Announcement", icon: "fa-bullhorn" },
    { id: "about", label: "About Page", icon: "fa-info-circle" },
    { id: "faq", label: "FAQ", icon: "fa-question-circle" },
    { id: "testimonials", label: "Testimonials", icon: "fa-star" },
    { id: "events", label: "Events", icon: "fa-calendar" },
    { id: "homepage", label: "Homepage", icon: "fa-home" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Section Tabs */}
      <div className="flex flex-wrap gap-2">
        {sections.map(sec => (
          <button
            key={sec.id}
            onClick={() => setActiveSection(sec.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${
              activeSection === sec.id
                ? "bg-[#062c24] text-white"
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
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-[#062c24] uppercase">Global Announcement Banner</h3>
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
          <div className="space-y-4">
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Type</label>
              <div className="flex gap-2">
                {(["info", "warning", "promo"] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setAnnouncement({ ...announcement, type })}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all ${
                      announcement.type === type
                        ? type === "info" ? "bg-blue-500 text-white" :
                          type === "warning" ? "bg-amber-500 text-white" :
                          "bg-emerald-500 text-white"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <i className={`fas ${type === "info" ? "fa-info-circle" : type === "warning" ? "fa-exclamation-triangle" : "fa-tag"} mr-2`}></i>
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Message</label>
              <input
                value={announcement.message}
                onChange={e => setAnnouncement({ ...announcement, message: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none"
                placeholder="🎉 Special announcement here!"
              />
            </div>
            {announcement.isActive && announcement.message && (
              <div className={`p-3 rounded-xl text-white text-center text-xs font-bold ${
                announcement.type === "info" ? "bg-blue-600" :
                announcement.type === "warning" ? "bg-amber-500" :
                "bg-emerald-600"
              }`}>
                Preview: {announcement.message}
              </div>
            )}
          </div>
        </div>
      )}

      {/* About Page */}
      {activeSection === "about" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <h3 className="text-sm font-black text-[#062c24] uppercase mb-4">Our Story</h3>
            <textarea
              value={about.story}
              onChange={e => setAbout({ ...about, story: e.target.value })}
              rows={4}
              className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm outline-none resize-none"
            />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-100 p-6">
              <h3 className="text-sm font-black text-[#062c24] uppercase mb-4">For Campers</h3>
              <textarea
                value={about.forCampers}
                onChange={e => setAbout({ ...about, forCampers: e.target.value })}
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none resize-none"
              />
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-6">
              <h3 className="text-sm font-black text-[#062c24] uppercase mb-4">For Vendors</h3>
              <textarea
                value={about.forVendors}
                onChange={e => setAbout({ ...about, forVendors: e.target.value })}
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none resize-none"
              />
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <h3 className="text-sm font-black text-[#062c24] uppercase mb-4">Our Mission</h3>
            <textarea
              value={about.mission}
              onChange={e => setAbout({ ...about, mission: e.target.value })}
              rows={2}
              className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none resize-none"
            />
          </div>
        </div>
      )}

      {/* FAQ */}
      {activeSection === "faq" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">{faq.length} sections</p>
            <button onClick={addFaqSection} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold">
              <i className="fas fa-plus mr-2"></i>Add Section
            </button>
          </div>
          {faq.map((section, sIdx) => (
            <div key={sIdx} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
                <input
                  value={section.icon}
                  onChange={e => updateFaqSection(sIdx, "icon", e.target.value)}
                  className="w-24 bg-white border border-slate-200 p-2 rounded-lg text-xs outline-none"
                  placeholder="fa-icon"
                />
                <input
                  value={section.title}
                  onChange={e => updateFaqSection(sIdx, "title", e.target.value)}
                  className="flex-1 bg-white border border-slate-200 p-2 rounded-lg text-sm font-bold outline-none"
                  placeholder="Section Title"
                />
                <button onClick={() => addFaqItem(sIdx)} className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg">+ Q&A</button>
                <button onClick={() => removeFaqSection(sIdx)} className="text-slate-400 hover:text-red-500 p-2">
                  <i className="fas fa-trash"></i>
                </button>
              </div>
              <div className="p-4 space-y-3">
                {section.items.map((item, iIdx) => (
                  <div key={iIdx} className="bg-slate-50 p-4 rounded-xl flex gap-3">
                    <div className="flex-1 space-y-2">
                      <input
                        value={item.question}
                        onChange={e => updateFaqItem(sIdx, iIdx, "question", e.target.value)}
                        className="w-full bg-white border border-slate-200 p-2 rounded-lg text-sm font-bold outline-none"
                        placeholder="Question"
                      />
                      <textarea
                        value={item.answer}
                        onChange={e => updateFaqItem(sIdx, iIdx, "answer", e.target.value)}
                        rows={2}
                        className="w-full bg-white border border-slate-200 p-2 rounded-lg text-sm outline-none resize-none"
                        placeholder="Answer"
                      />
                    </div>
                    <button onClick={() => removeFaqItem(sIdx, iIdx)} className="text-slate-400 hover:text-red-500">
                      <i className="fas fa-trash"></i>
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
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">{testimonials.length} testimonials</p>
            <button onClick={() => { setEditingTestimonial({ name: "", location: "", text: "", rating: 5 }); setShowTestimonialModal(true); }}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold">
              <i className="fas fa-plus mr-2"></i>Add Testimonial
            </button>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {testimonials.map(t => (
              <div key={t.id} className="bg-white rounded-2xl border border-slate-100 p-5">
                <div className="flex gap-0.5 mb-3">
                  {[...Array(5)].map((_, j) => (
                    <i key={j} className={`fas fa-star text-xs ${j < t.rating ? "text-amber-400" : "text-slate-200"}`}></i>
                  ))}
                </div>
                <p className="text-sm text-slate-600 mb-4 line-clamp-3">"{t.text}"</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-[#062c24]">{t.name}</p>
                    <p className="text-[9px] text-slate-400">{t.location}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingTestimonial(t); setShowTestimonialModal(true); }}
                      className="text-slate-400 hover:text-blue-500"><i className="fas fa-pen text-xs"></i></button>
                    <button onClick={() => deleteTestimonial(t.id!)}
                      className="text-slate-400 hover:text-red-500"><i className="fas fa-trash text-xs"></i></button>
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
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">{events.length} events</p>
            <button onClick={() => { setEditingEvent({ name: "", poster: "", link: "", organizer: "" }); setShowEventModal(true); }}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold">
              <i className="fas fa-plus mr-2"></i>Add Event
            </button>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {events.map(e => (
              <div key={e.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <div className="h-32 bg-slate-100">
                  {e.poster && <img src={e.poster} className="w-full h-full object-cover" alt={e.name} />}
                </div>
                <div className="p-4">
                  <p className="text-xs font-bold text-[#062c24] truncate mb-1">{e.name}</p>
                  <p className="text-[9px] text-slate-400 mb-3">{e.organizer}</p>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingEvent(e); setShowEventModal(true); }}
                      className="flex-1 bg-slate-100 text-slate-500 py-1.5 rounded-lg text-[9px] font-bold hover:bg-blue-100 hover:text-blue-600">
                      <i className="fas fa-pen mr-1"></i>Edit
                    </button>
                    <button onClick={() => deleteEvent(e.id!)}
                      className="bg-slate-100 text-slate-500 px-3 py-1.5 rounded-lg text-[9px] font-bold hover:bg-red-100 hover:text-red-600">
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Homepage */}
      {activeSection === "homepage" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h3 className="text-sm font-black text-[#062c24] uppercase mb-4">Hero Section</h3>
          <div className="space-y-4">
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Title</label>
              <input
                value={homepage.heroTitle}
                onChange={e => setHomepage({ ...homepage, heroTitle: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none"
                placeholder="Sewa Gear Camping. Tanpa Hassle."
              />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Subtitle</label>
              <input
                value={homepage.heroSubtitle}
                onChange={e => setHomepage({ ...homepage, heroSubtitle: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none"
                placeholder="Rent quality camping gear..."
              />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">CTA Button Text</label>
              <input
                value={homepage.heroCta}
                onChange={e => setHomepage({ ...homepage, heroCta: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none"
                placeholder="Find Vendors"
              />
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="sticky bottom-4 flex justify-end">
        <button
          onClick={saveContent}
          disabled={saving}
          className={`px-8 py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg transition-all ${
            saved ? "bg-emerald-500 text-white" : "bg-[#062c24] text-white hover:bg-emerald-800"
          } disabled:opacity-50`}
        >
          {saving ? <><i className="fas fa-spinner fa-spin mr-2"></i>Saving...</> : saved ? "✓ Saved!" : "Save All Changes"}
        </button>
      </div>

      {/* Testimonial Modal */}
      {showTestimonialModal && editingTestimonial && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-black text-[#062c24] uppercase mb-4">{editingTestimonial.id ? "Edit" : "Add"} Testimonial</h3>
            <div className="space-y-4">
              <input value={editingTestimonial.name} onChange={e => setEditingTestimonial({ ...editingTestimonial, name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none" placeholder="Name" />
              <input value={editingTestimonial.location} onChange={e => setEditingTestimonial({ ...editingTestimonial, location: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none" placeholder="Location" />
              <textarea value={editingTestimonial.text} onChange={e => setEditingTestimonial({ ...editingTestimonial, text: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none resize-none" rows={3} placeholder="Testimonial text" />
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Rating</label>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(r => (
                    <button key={r} onClick={() => setEditingTestimonial({ ...editingTestimonial, rating: r })}
                      className={`w-10 h-10 rounded-lg ${editingTestimonial.rating >= r ? "bg-amber-400 text-white" : "bg-slate-100 text-slate-400"}`}>
                      <i className="fas fa-star"></i>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowTestimonialModal(false); setEditingTestimonial(null); }}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-slate-500 bg-slate-100">Cancel</button>
              <button onClick={() => saveTestimonial(editingTestimonial)}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-emerald-500">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Event Modal */}
      {showEventModal && editingEvent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-black text-[#062c24] uppercase mb-4">{editingEvent.id ? "Edit" : "Add"} Event</h3>
            <div className="space-y-4">
              <input value={editingEvent.name} onChange={e => setEditingEvent({ ...editingEvent, name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none" placeholder="Event Name" />
              <input value={editingEvent.organizer} onChange={e => setEditingEvent({ ...editingEvent, organizer: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none" placeholder="Organizer" />
              <input value={editingEvent.poster} onChange={e => setEditingEvent({ ...editingEvent, poster: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none" placeholder="Poster URL" />
              <input value={editingEvent.link} onChange={e => setEditingEvent({ ...editingEvent, link: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none" placeholder="Event Link" />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowEventModal(false); setEditingEvent(null); }}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-slate-500 bg-slate-100">Cancel</button>
              <button onClick={() => saveEvent(editingEvent)}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-emerald-500">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}