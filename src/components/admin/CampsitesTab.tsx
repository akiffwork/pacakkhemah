"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, getDocs, doc, addDoc, updateDoc, deleteDoc, 
  query, orderBy, serverTimestamp 
} from "firebase/firestore";

type Campsite = {
  id: string;
  name: string;
  location?: string;
  category?: string;
  direction?: string;
  whatsapp?: string;
  carousel?: string[];
  createdAt?: any;
};

const CATEGORIES = [
  "river", "beach", "mountain", "lake", "forest", "waterfall", "island", "other"
];

export default function CampsitesTab() {
  const [campsites, setCampsites] = useState<Campsite[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editingCampsite, setEditingCampsite] = useState<Campsite | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: "",
    location: "",
    category: "river",
    direction: "",
    whatsapp: "",
    carousel: [""],
  });

  // Load campsites
  useEffect(() => {
    loadCampsites();
  }, []);

  async function loadCampsites() {
    setLoading(true);
    try {
      const q = query(collection(db, "campsites"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setCampsites(snap.docs.map(d => ({ id: d.id, ...d.data() } as Campsite)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setEditingCampsite(null);
    setForm({
      name: "",
      location: "",
      category: "river",
      direction: "",
      whatsapp: "",
      carousel: [""],
    });
    setShowModal(true);
  }

  function openEditModal(campsite: Campsite) {
    setEditingCampsite(campsite);
    setForm({
      name: campsite.name || "",
      location: campsite.location || "",
      category: campsite.category || "river",
      direction: campsite.direction || "",
      whatsapp: campsite.whatsapp || "",
      carousel: campsite.carousel?.length ? campsite.carousel : [""],
    });
    setShowModal(true);
  }

  async function saveCampsite() {
    if (!form.name.trim()) {
      alert("Campsite name is required");
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        location: form.location.trim(),
        category: form.category,
        direction: form.direction.trim(),
        whatsapp: form.whatsapp.trim(),
        carousel: form.carousel.filter(url => url.trim() !== ""),
      };

      if (editingCampsite) {
        await updateDoc(doc(db, "campsites", editingCampsite.id), data);
      } else {
        await addDoc(collection(db, "campsites"), {
          ...data,
          createdAt: serverTimestamp(),
        });
      }

      setShowModal(false);
      loadCampsites();
    } catch (e) {
      console.error(e);
      alert("Error saving campsite");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCampsite(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, "campsites", id));
      loadCampsites();
    } catch (e) {
      console.error(e);
      alert("Error deleting campsite");
    }
  }

  function addCarouselSlot() {
    setForm(prev => ({ ...prev, carousel: [...prev.carousel, ""] }));
  }

  function updateCarouselSlot(index: number, value: string) {
    setForm(prev => ({
      ...prev,
      carousel: prev.carousel.map((url, i) => i === index ? value : url),
    }));
  }

  function removeCarouselSlot(index: number) {
    setForm(prev => ({
      ...prev,
      carousel: prev.carousel.filter((_, i) => i !== index),
    }));
  }

  // Filter campsites
  const filtered = campsites.filter(c => {
    const matchSearch = !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.location?.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === "all" || c.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  const categoryColors: Record<string, string> = {
    river: "bg-blue-50 text-blue-600 border-blue-200",
    beach: "bg-amber-50 text-amber-600 border-amber-200",
    mountain: "bg-emerald-50 text-emerald-600 border-emerald-200",
    lake: "bg-cyan-50 text-cyan-600 border-cyan-200",
    forest: "bg-green-50 text-green-600 border-green-200",
    waterfall: "bg-indigo-50 text-indigo-600 border-indigo-200",
    island: "bg-teal-50 text-teal-600 border-teal-200",
    other: "bg-slate-50 text-slate-600 border-slate-200",
  };

  const categoryIcons: Record<string, string> = {
    river: "fa-water",
    beach: "fa-umbrella-beach",
    mountain: "fa-mountain",
    lake: "fa-water",
    forest: "fa-tree",
    waterfall: "fa-water",
    island: "fa-island-tropical",
    other: "fa-campground",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm gap-4">
        <div className="flex items-center gap-4 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-80">
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search campsites..."
              className="w-full bg-slate-50 border border-slate-100 pl-10 pr-4 py-3 rounded-xl text-xs font-bold outline-none focus:border-emerald-500 transition-all"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="bg-slate-50 border border-slate-100 px-4 py-3 rounded-xl text-xs font-bold outline-none focus:border-emerald-500"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {filtered.length} Campsites
          </span>
          <button
            onClick={openAddModal}
            className="bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-sm flex items-center gap-2"
          >
            <i className="fas fa-plus"></i> Add Campsite
          </button>
        </div>
      </div>

      {/* Campsites Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 h-48 animate-pulse">
              <div className="h-24 bg-slate-100 rounded-xl mb-3"></div>
              <div className="h-4 bg-slate-100 rounded w-2/3 mb-2"></div>
              <div className="h-3 bg-slate-50 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-300 text-2xl">
            <i className="fas fa-campground"></i>
          </div>
          <h3 className="text-sm font-black text-slate-400 uppercase mb-2">No Campsites Found</h3>
          <p className="text-xs text-slate-400 mb-4">
            {search || categoryFilter !== "all" ? "Try a different search or filter" : "Add your first campsite to get started"}
          </p>
          {!search && categoryFilter === "all" && (
            <button onClick={openAddModal} className="text-emerald-600 font-bold text-xs hover:underline">
              + Add Campsite
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(campsite => (
            <div
              key={campsite.id}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden group"
            >
              {/* Image */}
              <div className="h-32 bg-slate-100 relative overflow-hidden">
                {campsite.carousel?.[0] ? (
                  <img
                    src={campsite.carousel[0]}
                    alt={campsite.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <i className="fas fa-image text-3xl"></i>
                  </div>
                )}
                {/* Category badge */}
                <span className={`absolute top-3 left-3 px-2 py-1 rounded-lg text-[8px] font-black uppercase border ${categoryColors[campsite.category || "other"]}`}>
                  <i className={`fas ${categoryIcons[campsite.category || "other"]} mr-1`}></i>
                  {campsite.category || "other"}
                </span>
                {/* Image count */}
                {(campsite.carousel?.length || 0) > 1 && (
                  <span className="absolute top-3 right-3 bg-black/60 text-white px-2 py-1 rounded-lg text-[8px] font-bold">
                    <i className="fas fa-images mr-1"></i> {campsite.carousel?.length}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="font-black text-[#062c24] text-sm uppercase mb-1 truncate">{campsite.name}</h3>
                <p className="text-[10px] text-slate-400 font-medium truncate flex items-center gap-1">
                  <i className="fas fa-map-marker-alt text-emerald-500"></i>
                  {campsite.location || "No location set"}
                </p>

                {/* Links */}
                <div className="flex items-center gap-2 mt-3">
                  {campsite.direction && (
                    <a
                      href={campsite.direction}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-[9px] font-bold text-blue-500 hover:underline"
                    >
                      <i className="fas fa-directions"></i> Maps
                    </a>
                  )}
                  {campsite.whatsapp && (
                    <a
                      href={campsite.whatsapp}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-[9px] font-bold text-green-500 hover:underline"
                    >
                      <i className="fab fa-whatsapp"></i> WhatsApp
                    </a>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => openEditModal(campsite)}
                    className="flex-1 bg-slate-50 text-slate-600 py-2 rounded-lg text-[10px] font-bold uppercase hover:bg-emerald-50 hover:text-emerald-600 transition-all"
                  >
                    <i className="fas fa-edit mr-1"></i> Edit
                  </button>
                  <button
                    onClick={() => deleteCampsite(campsite.id, campsite.name)}
                    className="w-9 h-9 bg-red-50 text-red-400 rounded-lg flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
                  >
                    <i className="fas fa-trash text-[10px]"></i>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-6 text-white shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <i className="fas fa-campground text-xl"></i>
                  </div>
                  <div>
                    <h3 className="font-black uppercase text-lg">
                      {editingCampsite ? "Edit Campsite" : "Add Campsite"}
                    </h3>
                    <p className="text-white/70 text-[10px] font-medium">
                      {editingCampsite ? "Update campsite details" : "Add a new camping location"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Name */}
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                  Campsite Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Campstay Sungai Lembing"
                  className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-sm font-semibold outline-none focus:border-emerald-500 transition-all"
                />
              </div>

              {/* Location */}
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                  Address / Location
                </label>
                <input
                  type="text"
                  value={form.location}
                  onChange={e => setForm(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="e.g. Lot 975, Kampung Bayas, 26200 Sungai Lembing, Pahang"
                  className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-sm font-semibold outline-none focus:border-emerald-500 transition-all"
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                  Category
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, category: cat }))}
                      className={`p-2.5 rounded-xl text-[9px] font-bold uppercase transition-all border ${
                        form.category === cat
                          ? "bg-emerald-500 text-white border-emerald-500"
                          : "bg-slate-50 text-slate-500 border-slate-200 hover:border-emerald-300"
                      }`}
                    >
                      <i className={`fas ${categoryIcons[cat]} block text-sm mb-1`}></i>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Google Maps Link */}
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                  Google Maps Link
                </label>
                <input
                  type="url"
                  value={form.direction}
                  onChange={e => setForm(prev => ({ ...prev, direction: e.target.value }))}
                  placeholder="https://maps.app.goo.gl/..."
                  className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-sm font-semibold outline-none focus:border-emerald-500 transition-all"
                />
              </div>

              {/* WhatsApp Link */}
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                  WhatsApp Link
                </label>
                <input
                  type="url"
                  value={form.whatsapp}
                  onChange={e => setForm(prev => ({ ...prev, whatsapp: e.target.value }))}
                  placeholder="https://wa.me/60123456789"
                  className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-sm font-semibold outline-none focus:border-emerald-500 transition-all"
                />
              </div>

              {/* Carousel Images */}
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                  Images (URL)
                </label>
                <div className="space-y-2">
                  {form.carousel.map((url, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="url"
                        value={url}
                        onChange={e => updateCarouselSlot(index, e.target.value)}
                        placeholder="https://example.com/image.jpg"
                        className="flex-1 bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-semibold outline-none focus:border-emerald-500 transition-all"
                      />
                      {form.carousel.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCarouselSlot(index)}
                          className="w-10 h-10 bg-red-50 text-red-400 rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
                        >
                          <i className="fas fa-times text-xs"></i>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addCarouselSlot}
                  className="mt-2 text-[10px] font-bold text-emerald-600 hover:underline"
                >
                  + Add Another Image
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 p-4 bg-slate-50 shrink-0">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-slate-200 text-slate-600 py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-slate-300 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={saveCampsite}
                  disabled={saving}
                  className="flex-1 bg-emerald-500 text-white py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <><i className="fas fa-spinner fa-spin mr-2"></i> Saving...</>
                  ) : editingCampsite ? (
                    "Update Campsite"
                  ) : (
                    "Add Campsite"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}