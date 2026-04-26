"use client";

import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, addDoc, updateDoc, doc } from "firebase/firestore";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

const MAX_ITEMS = 5;
const MAX_FILE_MB = 5;
const MAX_FILE_SIZE = MAX_FILE_MB * 1024 * 1024;

type FoodItem = { image: string; menuName: string };

type FoodPartner = {
  id: string;
  name: string;
  items: FoodItem[];
  whatsapp: string;
  description?: string;
  deleted?: boolean;
};

type PendingItem = { file: File; preview: string; menuName: string };

const inputCls = "w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-semibold outline-none focus:border-emerald-500 focus:bg-white transition-all";

export default function FoodPartnersTab({ vendorId }: { vendorId: string }) {
  const [partners, setPartners] = useState<FoodPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FoodPartner | null>(null);

  const [fpName, setFpName] = useState("");
  const [fpDescription, setFpDescription] = useState("");
  const [fpWhatsapp, setFpWhatsapp] = useState("");
  const [existingItems, setExistingItems] = useState<FoodItem[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "vendors", vendorId, "foodPartners"), snap => {
      setPartners(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() } as FoodPartner))
          .filter(p => !p.deleted)
      );
      setLoading(false);
    });
    return () => unsub();
  }, [vendorId]);

  function openNew() {
    setEditing(null);
    setFpName(""); setFpDescription(""); setFpWhatsapp("");
    setExistingItems([]); setPendingItems([]);
    setShowForm(true);
  }

  function openEdit(p: FoodPartner) {
    setEditing(p);
    setFpName(p.name);
    setFpDescription(p.description || "");
    setFpWhatsapp(p.whatsapp);
    setExistingItems(p.items || []);
    setPendingItems([]);
    setShowForm(true);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const totalSlots = existingItems.length + pendingItems.length;
    const canAdd = MAX_ITEMS - totalSlots;
    if (canAdd <= 0) { showToast(`Max ${MAX_ITEMS} images`, false); return; }
    const toAdd = files.slice(0, canAdd);
    const oversized = toAdd.filter(f => f.size > MAX_FILE_SIZE);
    if (oversized.length) { showToast(`Files must be under ${MAX_FILE_MB}MB`, false); return; }
    const newPending: PendingItem[] = toAdd.map(f => ({ file: f, preview: URL.createObjectURL(f), menuName: "" }));
    setPendingItems(prev => [...prev, ...newPending]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeExisting(idx: number) {
    setExistingItems(prev => prev.filter((_, i) => i !== idx));
  }

  function removePending(idx: number) {
    setPendingItems(prev => {
      const next = [...prev];
      URL.revokeObjectURL(next[idx].preview);
      next.splice(idx, 1);
      return next;
    });
  }

  function updatePendingName(idx: number, name: string) {
    setPendingItems(prev => prev.map((p, i) => i === idx ? { ...p, menuName: name } : p));
  }

  function updateExistingName(idx: number, name: string) {
    setExistingItems(prev => prev.map((p, i) => i === idx ? { ...p, menuName: name } : p));
  }

  async function save() {
    if (!fpName.trim()) return showToast("Name is required", false);
    if (!fpWhatsapp.trim()) return showToast("WhatsApp number is required", false);
    if (existingItems.length + pendingItems.length === 0) return showToast("Add at least one food image", false);
    setSaving(true);
    try {
      const storage = getStorage();
      const uploadedItems: FoodItem[] = [];
      for (const p of pendingItems) {
        const snap = await uploadBytes(
          storageRef(storage, `foodPartners/${vendorId}/${Date.now()}_${p.file.name}`),
          p.file
        );
        const url = await getDownloadURL(snap.ref);
        uploadedItems.push({ image: url, menuName: p.menuName.trim() });
      }
      const allItems = [...existingItems, ...uploadedItems];
      const payload = {
        name: fpName.trim(),
        description: fpDescription.trim() || null,
        whatsapp: fpWhatsapp.trim().replace(/\D/g, ""),
        items: allItems,
      };
      if (editing) {
        await updateDoc(doc(db, "vendors", vendorId, "foodPartners", editing.id), payload);
        showToast("Food partner updated!");
      } else {
        await addDoc(collection(db, "vendors", vendorId, "foodPartners"), payload);
        showToast("Food partner added!");
      }
      setShowForm(false);
    } catch { showToast("Save failed", false); }
    finally { setSaving(false); }
  }

  async function remove(p: FoodPartner) {
    if (!confirm(`Remove ${p.name}?`)) return;
    await updateDoc(doc(db, "vendors", vendorId, "foodPartners", p.id), { deleted: true });
  }

  const totalItems = existingItems.length + pendingItems.length;

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-28">
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[600] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-white text-[11px] font-black uppercase ${toast.ok ? "bg-emerald-600" : "bg-red-500"}`}>
          <i className={`fas ${toast.ok ? "fa-check-circle" : "fa-exclamation-circle"}`}></i>{toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-black text-[#062c24] uppercase">Food Partners</h2>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Featured food vendors shown on your shop page</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 bg-[#062c24] text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-800 transition-colors shadow-sm">
          <i className="fas fa-plus text-[9px]"></i> Add
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-5 flex gap-3">
        <i className="fas fa-info-circle text-amber-500 mt-0.5 flex-shrink-0"></i>
        <p className="text-[10px] text-amber-700 font-medium leading-relaxed">
          Food partners appear as a suggestion section on your shop page. Customers order directly via WhatsApp — you are not involved in the transaction.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-20 bg-slate-100 rounded-2xl animate-pulse" />)}</div>
      ) : partners.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <i className="fas fa-utensils text-orange-300 text-2xl"></i>
          </div>
          <p className="text-sm font-black text-slate-400 uppercase mb-1">No food partners yet</p>
          <p className="text-[10px] text-slate-300 font-medium">Add one to show food delivery options on your shop</p>
        </div>
      ) : (
        <div className="space-y-3">
          {partners.map(p => (
            <div key={p.id} className="bg-white border border-slate-100 rounded-2xl p-4 flex gap-3 shadow-sm">
              <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-orange-50">
                {p.items?.[0]?.image
                  ? <img src={p.items[0].image} alt={p.items[0].menuName || p.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-2xl">🍱</div>
                }
                {p.items?.length > 1 && (
                  <span className="absolute bottom-0 right-0 bg-black/60 text-white text-[7px] font-black px-1">+{p.items.length - 1}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-[#062c24] uppercase truncate">{p.name}</p>
                {p.description && <p className="text-[10px] text-slate-400 truncate mt-0.5">{p.description}</p>}
                <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                  <i className="fab fa-whatsapp text-emerald-500"></i> {p.whatsapp}
                </p>
              </div>
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                <button onClick={() => openEdit(p)}
                  className="w-8 h-8 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 transition-colors">
                  <i className="fas fa-pen text-[10px]"></i>
                </button>
                <button onClick={() => remove(p)}
                  className="w-8 h-8 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-500 hover:bg-red-50 hover:text-red-500 transition-colors">
                  <i className="fas fa-trash text-[10px]"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-[400] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-t-[2rem] max-h-[92vh] flex flex-col shadow-2xl z-10">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 flex-shrink-0">
              <p className="text-sm font-black text-[#062c24] uppercase">{editing ? "Edit Food Partner" : "Add Food Partner"}</p>
              <button onClick={() => setShowForm(false)}
                className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-red-50 hover:text-red-500 transition-colors">
                <i className="fas fa-times text-[11px]"></i>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4" style={{ scrollbarWidth: "none" }}>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Food Vendor Name *</label>
                <input value={fpName} onChange={e => setFpName(e.target.value)} placeholder="e.g. Nasi Lemak Pak Teh" className={inputCls} />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">WhatsApp Number *</label>
                <input value={fpWhatsapp} onChange={e => setFpWhatsapp(e.target.value)} placeholder="e.g. 60123456789" inputMode="numeric" className={inputCls} />
                <p className="text-[9px] text-slate-400 mt-1">Digits only, include country code (60 for Malaysia)</p>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Delivery Schedule / Description</label>
                <input value={fpDescription} onChange={e => setFpDescription(e.target.value)} placeholder="e.g. Delivery on Friday & Saturday, 8am–12pm" className={inputCls} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Food Photos & Menu Names *</label>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${totalItems >= MAX_ITEMS ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                    {totalItems}/{MAX_ITEMS}
                  </span>
                </div>
                <div className="space-y-2">
                  {existingItems.map((item, i) => (
                    <div key={i} className="flex gap-2 items-center bg-slate-50 rounded-xl p-2">
                      <img src={item.image} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                      <input value={item.menuName} onChange={e => updateExistingName(i, e.target.value)}
                        placeholder="Menu name (e.g. Nasi Lemak)" className="flex-1 bg-white border border-slate-200 px-2.5 py-2 rounded-lg text-[11px] font-semibold outline-none focus:border-emerald-400" />
                      <button onClick={() => removeExisting(i)}
                        className="w-7 h-7 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors flex-shrink-0">
                        <i className="fas fa-times text-[9px]"></i>
                      </button>
                    </div>
                  ))}
                  {pendingItems.map((item, i) => (
                    <div key={i} className="flex gap-2 items-center bg-emerald-50 rounded-xl p-2 border border-emerald-100">
                      <img src={item.preview} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                      <input value={item.menuName} onChange={e => updatePendingName(i, e.target.value)}
                        placeholder="Menu name (e.g. Mee Goreng)" className="flex-1 bg-white border border-slate-200 px-2.5 py-2 rounded-lg text-[11px] font-semibold outline-none focus:border-emerald-400" />
                      <button onClick={() => removePending(i)}
                        className="w-7 h-7 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors flex-shrink-0">
                        <i className="fas fa-times text-[9px]"></i>
                      </button>
                    </div>
                  ))}
                  {totalItems < MAX_ITEMS && (
                    <button onClick={() => fileInputRef.current?.click()}
                      className="w-full h-12 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black text-slate-400 uppercase hover:border-emerald-300 hover:text-emerald-500 transition-colors">
                      <i className="fas fa-camera text-sm"></i> Add Photo
                    </button>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
                  <p className="text-[9px] text-slate-400">Each image max {MAX_FILE_MB}MB · {MAX_ITEMS} photos max</p>
                </div>
              </div>
            </div>

            <div className="px-6 pb-8 pt-3 border-t border-slate-100 flex-shrink-0">
              <button onClick={save} disabled={saving}
                className={`w-full py-4 rounded-2xl font-black uppercase text-sm tracking-widest transition-all shadow-lg ${saving ? "bg-slate-200 text-slate-400" : "bg-[#062c24] text-white hover:bg-emerald-800"}`}>
                {saving ? <><i className="fas fa-spinner fa-spin mr-2"></i>Saving…</> : editing ? "Save Changes" : "Add Food Partner"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
