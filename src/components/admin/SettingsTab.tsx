"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  doc, onSnapshot, setDoc, collection, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp,
} from "firebase/firestore";

type Campsite = {
  id: string; name: string; location?: string; category?: string;
  carousel?: string[]; direction?: string; whatsapp?: string;
  description?: string; facilities?: string[]; fee?: string | number;
};

const CATEGORIES = [
  { id: "seaside", label: "Beach 🌊" },
  { id: "river", label: "River 🛶" },
  { id: "hilltop", label: "Hilltop ⛰️" },
  { id: "waterfall", label: "Waterfall 💧" },
  { id: "forest", label: "Forest 🌲" },
];

const emptyForm: Omit<Campsite, "id"> = {
  name: "", location: "", category: "seaside", carousel: [],
  direction: "", whatsapp: "", description: "", facilities: [], fee: "",
};

export default function AdminSettingsTab() {
  // --- Announcement ---
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [status, setStatus] = useState("active");
  const [saved, setSaved] = useState(false);

  // --- Social Links ---
  const [instagram, setInstagram] = useState("");
  const [threads, setThreads] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [socialSaved, setSocialSaved] = useState(false);

  // --- Campsites ---
  const [campsites, setCampsites] = useState<Campsite[]>([]);
  const [campLoading, setCampLoading] = useState(true);
  const [editingCamp, setEditingCamp] = useState<Campsite | null>(null);
  const [campForm, setCampForm] = useState(emptyForm);
  const [showCampForm, setShowCampForm] = useState(false);
  const [campSaving, setCampSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [newImageUrl, setNewImageUrl] = useState("");

  // --- Active section ---
  const [activeSection, setActiveSection] = useState<"announcement" | "social" | "campsites">("announcement");

  // Load announcement
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "global_announcement"), snap => {
      if (snap.exists()) {
        const d = snap.data();
        setMessage(d.message || "");
        setType(d.type || "info");
        setStatus(d.isActive ? "active" : "inactive");
      }
    });
    return () => unsub();
  }, []);

  // Load social links
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "social_links"), snap => {
      if (snap.exists()) {
        const d = snap.data();
        setInstagram(d.instagram || "");
        setThreads(d.threads || "");
        setWhatsapp(d.whatsapp || "");
      }
    });
    return () => unsub();
  }, []);

  // Load campsites
  useEffect(() => {
    loadCampsites();
  }, []);

  async function loadCampsites() {
    setCampLoading(true);
    try {
      const snap = await getDocs(collection(db, "campsites"));
      setCampsites(snap.docs.map(d => ({ id: d.id, ...d.data() } as Campsite)));
    } catch (e) { console.error(e); }
    finally { setCampLoading(false); }
  }

  // --- Handlers ---
  async function saveAnnouncement() {
    await setDoc(doc(db, "settings", "global_announcement"), {
      message, type, isActive: status === "active",
    }, { merge: true });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function saveSocial() {
    await setDoc(doc(db, "settings", "social_links"), {
      instagram, threads, whatsapp,
    }, { merge: true });
    setSocialSaved(true);
    setTimeout(() => setSocialSaved(false), 2000);
  }

  function startEditCamp(camp: Campsite) {
    setEditingCamp(camp);
    setCampForm({
      name: camp.name, location: camp.location || "", category: camp.category || "seaside",
      carousel: camp.carousel || [], direction: camp.direction || "",
      whatsapp: camp.whatsapp || "", description: camp.description || "",
      facilities: camp.facilities || [], fee: camp.fee || "",
    });
    setShowCampForm(true);
  }

  function startNewCamp() {
    setEditingCamp(null);
    setCampForm({ ...emptyForm });
    setShowCampForm(true);
  }

  async function saveCampsite() {
    if (!campForm.name.trim()) return alert("Name is required");
    setCampSaving(true);
    try {
      const data = {
        ...campForm,
        fee: campForm.fee ? String(campForm.fee) : "",
        updatedAt: serverTimestamp(),
      };
      if (editingCamp) {
        await updateDoc(doc(db, "campsites", editingCamp.id), data);
      } else {
        await addDoc(collection(db, "campsites"), { ...data, createdAt: serverTimestamp() });
      }
      setShowCampForm(false);
      setEditingCamp(null);
      loadCampsites();
    } catch (e) { console.error(e); alert("Failed to save"); }
    finally { setCampSaving(false); }
  }

  async function deleteCampsite(id: string) {
    try {
      await deleteDoc(doc(db, "campsites", id));
      setDeleteConfirm(null);
      loadCampsites();
    } catch (e) { console.error(e); alert("Failed to delete"); }
  }

  function addImageUrl() {
    if (!newImageUrl.trim()) return;
    setCampForm(prev => ({ ...prev, carousel: [...(prev.carousel || []), newImageUrl.trim()] }));
    setNewImageUrl("");
  }

  function removeImage(idx: number) {
    setCampForm(prev => ({ ...prev, carousel: (prev.carousel || []).filter((_, i) => i !== idx) }));
  }

  function updateFacility(idx: number, val: string) {
    setCampForm(prev => {
      const f = [...(prev.facilities || [])];
      f[idx] = val;
      return { ...prev, facilities: f };
    });
  }

  function addFacility() {
    setCampForm(prev => ({ ...prev, facilities: [...(prev.facilities || []), ""] }));
  }

  function removeFacility(idx: number) {
    setCampForm(prev => ({ ...prev, facilities: (prev.facilities || []).filter((_, i) => i !== idx) }));
  }

  const typeConfig: Record<string, { label: string; preview: string }> = {
    info: { label: "Info", preview: "bg-blue-50 border-blue-200 text-blue-800" },
    warning: { label: "Alert", preview: "bg-amber-50 border-amber-200 text-amber-800" },
    promo: { label: "Promo", preview: "bg-emerald-50 border-emerald-200 text-emerald-800" },
  };

  const sections = [
    { id: "announcement" as const, label: "Announcement", icon: "fa-bullhorn" },
    { id: "social" as const, label: "Social & Contact", icon: "fa-share-alt" },
    { id: "campsites" as const, label: "Campsites", icon: "fa-campground" },
  ];

  return (
    <div className="max-w-3xl space-y-6">

      {/* Section Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={`shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${
              activeSection === s.id
                ? "bg-[#062c24] text-white shadow-lg"
                : "bg-white text-slate-500 border border-slate-200 hover:bg-emerald-50"
            }`}>
            <i className={`fas ${s.icon}`}></i> {s.label}
          </button>
        ))}
      </div>

      {/* ═══ ANNOUNCEMENT ═══ */}
      {activeSection === "announcement" && (
        <div className="bg-gradient-to-br from-[#062c24] to-emerald-900 p-8 rounded-[2rem] shadow-xl text-white">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-white/10 text-emerald-300 flex items-center justify-center">
              <i className="fas fa-bullhorn"></i>
            </div>
            <div>
              <h3 className="text-sm font-black uppercase">Global Announcement</h3>
              <p className="text-[9px] text-emerald-300/70 font-medium">Shows as banner on directory page</p>
            </div>
          </div>

          <div className="space-y-4">
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
              placeholder="Write your announcement here..."
              className="w-full bg-black/20 border border-white/10 rounded-2xl p-4 text-sm font-medium text-white placeholder:text-white/30 outline-none resize-none focus:border-emerald-400" />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[8px] font-bold text-emerald-300 uppercase block mb-1.5">Type</label>
                <select value={type} onChange={e => setType(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 text-white text-xs font-bold uppercase rounded-xl px-4 py-3 outline-none">
                  <option value="info">Info (Blue)</option>
                  <option value="warning">Alert (Amber)</option>
                  <option value="promo">Promo (Green)</option>
                </select>
              </div>
              <div>
                <label className="text-[8px] font-bold text-emerald-300 uppercase block mb-1.5">Visibility</label>
                <select value={status} onChange={e => setStatus(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 text-white text-xs font-bold uppercase rounded-xl px-4 py-3 outline-none">
                  <option value="active">Active</option>
                  <option value="inactive">Hidden</option>
                </select>
              </div>
            </div>

            <button onClick={saveAnnouncement}
              className={`w-full py-4 rounded-xl font-black uppercase text-xs transition-all shadow-lg ${saved ? "bg-emerald-400 text-white" : "bg-white text-[#062c24] hover:bg-emerald-50"}`}>
              {saved ? "✓ Published!" : "Publish Update"}
            </button>
          </div>

          {message && (
            <div className="mt-6">
              <p className="text-[9px] font-bold text-emerald-300/50 uppercase mb-2">Preview</p>
              <div className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${typeConfig[type]?.preview}`}>
                <i className={`fas ${type === "info" ? "fa-info-circle" : type === "warning" ? "fa-exclamation-triangle" : "fa-tag"}`}></i>
                <span>{message}</span>
                {status === "inactive" && <span className="ml-auto text-[8px] font-black opacity-50">(Hidden)</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ SOCIAL & CONTACT ═══ */}
      {activeSection === "social" && (
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <i className="fas fa-share-alt"></i>
            </div>
            <div>
              <h3 className="text-sm font-black uppercase text-[#062c24]">Social & Contact Links</h3>
              <p className="text-[9px] text-slate-400 font-medium">Shown in directory footer</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase block mb-1.5">
                <i className="fab fa-instagram text-pink-500 mr-1"></i> Instagram URL
              </label>
              <input value={instagram} onChange={e => setInstagram(e.target.value)}
                placeholder="https://instagram.com/yourhandle"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase block mb-1.5">
                <i className="fab fa-threads text-black mr-1"></i> Threads URL
              </label>
              <input value={threads} onChange={e => setThreads(e.target.value)}
                placeholder="https://threads.net/@yourhandle"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase block mb-1.5">
                <i className="fab fa-whatsapp text-emerald-500 mr-1"></i> WhatsApp Link
              </label>
              <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
                placeholder="https://wa.me/60123456789"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>

            <button onClick={saveSocial}
              className={`w-full py-4 rounded-xl font-black uppercase text-xs transition-all shadow-sm ${socialSaved ? "bg-emerald-500 text-white" : "bg-[#062c24] text-white hover:bg-emerald-900"}`}>
              {socialSaved ? "✓ Saved!" : "Save Links"}
            </button>
          </div>
        </div>
      )}

      {/* ═══ CAMPSITES ═══ */}
      {activeSection === "campsites" && (
        <div className="space-y-4">
          {/* Header + Add button */}
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-black uppercase text-[#062c24]">Campsites</h3>
              <p className="text-[9px] text-slate-400 font-medium">{campsites.length} sites listed</p>
            </div>
            <button onClick={startNewCamp}
              className="px-4 py-2.5 bg-[#062c24] text-white rounded-xl text-[10px] font-black uppercase hover:bg-emerald-900 shadow-sm flex items-center gap-2">
              <i className="fas fa-plus text-[9px]"></i> Add Campsite
            </button>
          </div>

          {/* Campsite list */}
          {campLoading ? (
            <div className="text-center py-12 text-slate-300"><i className="fas fa-spinner fa-spin text-2xl"></i></div>
          ) : campsites.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
              <i className="fas fa-campground text-4xl text-slate-200 mb-3 block"></i>
              <p className="text-xs font-bold text-slate-400">No campsites yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {campsites.map(camp => (
                <div key={camp.id} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-4 hover:shadow-sm transition-all">
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                    {camp.carousel?.[0] ? (
                      <img src={camp.carousel[0]} className="w-full h-full object-cover" alt={camp.name} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300"><i className="fas fa-image"></i></div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-black uppercase text-[#062c24] truncate">{camp.name}</h4>
                    <p className="text-[9px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                      <i className="fas fa-map-pin text-emerald-500 text-[7px]"></i>
                      {camp.location || "No location"}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[8px] font-bold text-slate-300 bg-slate-50 px-2 py-0.5 rounded uppercase">{camp.category || "—"}</span>
                      {camp.fee && <span className="text-[8px] font-bold text-emerald-600">RM {camp.fee}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => startEditCamp(camp)}
                      className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center hover:bg-emerald-100 transition-colors">
                      <i className="fas fa-pen text-[10px]"></i>
                    </button>
                    {deleteConfirm === camp.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => deleteCampsite(camp.id)}
                          className="w-9 h-9 bg-red-500 text-white rounded-lg flex items-center justify-center hover:bg-red-600 text-[10px]">
                          <i className="fas fa-check"></i>
                        </button>
                        <button onClick={() => setDeleteConfirm(null)}
                          className="w-9 h-9 bg-slate-100 text-slate-400 rounded-lg flex items-center justify-center hover:bg-slate-200 text-[10px]">
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirm(camp.id)}
                        className="w-9 h-9 bg-red-50 text-red-400 rounded-lg flex items-center justify-center hover:bg-red-100 transition-colors">
                        <i className="fas fa-trash text-[10px]"></i>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add/Edit Form Modal */}
          {showCampForm && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-[2rem] w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" style={{ scrollbarWidth: "thin" }}>
                <div className="sticky top-0 bg-white px-6 pt-6 pb-4 border-b border-slate-100 flex justify-between items-center z-10">
                  <h3 className="text-sm font-black uppercase text-[#062c24]">
                    {editingCamp ? "Edit Campsite" : "New Campsite"}
                  </h3>
                  <button onClick={() => { setShowCampForm(false); setEditingCamp(null); }}
                    className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500">
                    <i className="fas fa-times"></i>
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  {/* Name */}
                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1.5">Name *</label>
                    <input value={campForm.name} onChange={e => setCampForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Pantai Balok Campsite"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>

                  {/* Location + Category */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-black text-slate-500 uppercase block mb-1.5">Location</label>
                      <input value={campForm.location} onChange={e => setCampForm(p => ({ ...p, location: e.target.value }))}
                        placeholder="e.g. Kuantan, Pahang"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-500 uppercase block mb-1.5">Category</label>
                      <select value={campForm.category} onChange={e => setCampForm(p => ({ ...p, category: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500">
                        {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Fee + WhatsApp */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-black text-slate-500 uppercase block mb-1.5">Fee (RM per person)</label>
                      <input value={campForm.fee} onChange={e => setCampForm(p => ({ ...p, fee: e.target.value }))}
                        placeholder="e.g. 10"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-500 uppercase block mb-1.5">WhatsApp</label>
                      <input value={campForm.whatsapp} onChange={e => setCampForm(p => ({ ...p, whatsapp: e.target.value }))}
                        placeholder="https://wa.me/60..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  </div>

                  {/* Direction */}
                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1.5">Google Maps / Direction Link</label>
                    <input value={campForm.direction} onChange={e => setCampForm(p => ({ ...p, direction: e.target.value }))}
                      placeholder="https://maps.google.com/..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1.5">Description</label>
                    <textarea value={campForm.description} onChange={e => setCampForm(p => ({ ...p, description: e.target.value }))}
                      rows={3} placeholder="Tell people about this campsite..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none resize-none focus:ring-2 focus:ring-emerald-500" />
                  </div>

                  {/* Images */}
                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1.5">Images (paste URLs)</label>
                    <div className="flex gap-2 mb-2">
                      <input value={newImageUrl} onChange={e => setNewImageUrl(e.target.value)}
                        placeholder="https://image-url.com/photo.jpg"
                        onKeyDown={e => e.key === "Enter" && addImageUrl()}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-500" />
                      <button onClick={addImageUrl}
                        className="px-4 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-100">
                        Add
                      </button>
                    </div>
                    {(campForm.carousel || []).length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {(campForm.carousel || []).map((url, i) => (
                          <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden bg-slate-100 group">
                            <img src={url} className="w-full h-full object-cover" alt="" />
                            <button onClick={() => removeImage(i)}
                              className="absolute inset-0 bg-red-500/80 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <i className="fas fa-times text-xs"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Facilities */}
                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1.5">Facilities</label>
                    <div className="space-y-2">
                      {(campForm.facilities || []).map((f, i) => (
                        <div key={i} className="flex gap-2">
                          <input value={f} onChange={e => updateFacility(i, e.target.value)}
                            placeholder="e.g. Toilet, Parking"
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-500" />
                          <button onClick={() => removeFacility(i)}
                            className="w-8 h-8 text-red-400 hover:text-red-600 flex items-center justify-center">
                            <i className="fas fa-times text-xs"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                    <button onClick={addFacility}
                      className="mt-2 text-[10px] font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-1">
                      <i className="fas fa-plus text-[8px]"></i> Add facility
                    </button>
                  </div>

                  {/* Save */}
                  <button onClick={saveCampsite} disabled={campSaving}
                    className="w-full py-4 bg-[#062c24] text-white rounded-xl font-black uppercase text-xs hover:bg-emerald-900 shadow-lg disabled:opacity-50 transition-all">
                    {campSaving ? <><i className="fas fa-spinner fa-spin mr-2"></i>Saving...</> : editingCamp ? "Update Campsite" : "Add Campsite"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}