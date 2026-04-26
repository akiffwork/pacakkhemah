"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, addDoc, updateDoc, doc } from "firebase/firestore";

type FoodPartner = {
  id: string;
  name: string;
  description?: string;
  images: string[];
  whatsapp: string;
  deleted?: boolean;
};

const inputCls = "w-full bg-slate-50 border border-slate-200 p-3 rounded-[0.85rem] text-sm font-semibold outline-none focus:border-emerald-500 focus:bg-white transition-all";

export default function FoodPartnersTab({ vendorId }: { vendorId: string }) {
  const [partners, setPartners] = useState<FoodPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FoodPartner | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form fields
  const [fpName, setFpName] = useState("");
  const [fpDesc, setFpDesc] = useState("");
  const [fpImages, setFpImages] = useState(["", "", "", "", ""]);
  const [fpWhatsapp, setFpWhatsapp] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "vendors", vendorId, "foodPartners"), snap => {
      setPartners(snap.docs.map(d => ({ id: d.id, ...d.data() } as FoodPartner)).filter(p => !p.deleted));
      setLoading(false);
    });
    return () => unsub();
  }, [vendorId]);

  function openNew() {
    setEditing(null);
    setFpName(""); setFpDesc(""); setFpImages(["", "", "", "", ""]); setFpWhatsapp("");
    setShowForm(true);
  }

  function openEdit(p: FoodPartner) {
    setEditing(p);
    setFpName(p.name);
    setFpDesc(p.description || "");
    const imgs = [...(p.images || []), "", "", "", "", ""].slice(0, 5);
    setFpImages(imgs);
    setFpWhatsapp(p.whatsapp || "");
    setShowForm(true);
  }

  function closeForm() { setShowForm(false); setEditing(null); }

  async function save() {
    if (!fpName.trim()) return;
    const cleanImages = fpImages.map(s => s.trim()).filter(Boolean);
    const cleanWa = fpWhatsapp.trim().replace(/\D/g, "");
    if (!cleanWa) return;
    setSaving(true);
    try {
      const payload = {
        name: fpName.trim(),
        description: fpDesc.trim() || null,
        images: cleanImages,
        whatsapp: cleanWa,
      };
      if (editing) {
        await updateDoc(doc(db, "vendors", vendorId, "foodPartners", editing.id), payload);
      } else {
        await addDoc(collection(db, "vendors", vendorId, "foodPartners"), payload);
      }
      closeForm();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setDeleting(id);
    await updateDoc(doc(db, "vendors", vendorId, "foodPartners", id), { deleted: true });
    setDeleting(null);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-black text-[#062c24] uppercase tracking-tight">Food Partners</h2>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Featured on your shop page as a food delivery section</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1.5 bg-[#062c24] text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-800 transition-colors shadow-sm">
          <i className="fas fa-plus text-[9px]"></i> Add Partner
        </button>
      </div>

      {/* Info note */}
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-5 flex gap-3">
        <i className="fas fa-info-circle text-amber-500 mt-0.5 flex-shrink-0"></i>
        <p className="text-[10px] text-amber-800 font-medium leading-relaxed">
          Customers order food directly via WhatsApp with the food vendor. You are not involved in these transactions — this is purely a referral section for your customers' convenience.
        </p>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-20 bg-slate-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : partners.length === 0 ? (
        <div className="text-center py-14 bg-white rounded-2xl border border-slate-100">
          <div className="text-4xl mb-3">🍱</div>
          <p className="text-sm font-black text-slate-300 uppercase tracking-widest mb-1">No food partners yet</p>
          <p className="text-[10px] text-slate-400">Add a food vendor to display on your shop page</p>
        </div>
      ) : (
        <div className="space-y-3">
          {partners.map(p => (
            <div key={p.id} className="bg-white border border-slate-100 rounded-2xl p-4 flex gap-3 shadow-sm">
              {p.images?.[0]
                ? <img src={p.images[0]} alt={p.name} className="w-16 h-16 rounded-xl object-cover flex-shrink-0 bg-slate-100" />
                : <div className="w-16 h-16 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0 text-2xl">🍱</div>
              }
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-[#062c24] truncate uppercase">{p.name}</p>
                {p.description && <p className="text-[10px] text-slate-500 truncate mt-0.5">{p.description}</p>}
                <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                  <i className="fab fa-whatsapp text-emerald-500"></i> +{p.whatsapp}
                </p>
                <p className="text-[9px] text-slate-300 mt-1">{p.images?.filter(Boolean).length || 0} image{p.images?.filter(Boolean).length !== 1 ? "s" : ""}</p>
              </div>
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                <button onClick={() => openEdit(p)}
                  className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center hover:bg-emerald-50 hover:border-emerald-200 transition-colors">
                  <i className="fas fa-pen text-[10px] text-slate-400"></i>
                </button>
                <button onClick={() => remove(p.id)} disabled={deleting === p.id}
                  className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center hover:bg-red-50 hover:border-red-200 transition-colors">
                  {deleting === p.id
                    ? <i className="fas fa-spinner fa-spin text-[10px] text-slate-300"></i>
                    : <i className="fas fa-trash text-[10px] text-slate-400"></i>
                  }
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit form modal */}
      {showForm && (
        <div className="fixed inset-0 z-[300] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeForm} />
          <div className="relative bg-white rounded-t-[2rem] w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-black text-[#062c24] uppercase">{editing ? "Edit Partner" : "Add Food Partner"}</h3>
              <button onClick={closeForm} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Food Vendor Name *</label>
                <input value={fpName} onChange={e => setFpName(e.target.value)} placeholder="e.g. Nasi Lemak Pak Ali" className={inputCls} />
              </div>

              {/* Description */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Delivery Schedule / Description</label>
                <input value={fpDesc} onChange={e => setFpDesc(e.target.value)} placeholder="e.g. Delivery on Friday & Sunday, 8am–12pm" className={inputCls} />
                <p className="text-[9px] text-slate-400 mt-1">Shown under the vendor name on your shop page</p>
              </div>

              {/* WhatsApp */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">WhatsApp Number *</label>
                <input value={fpWhatsapp} onChange={e => setFpWhatsapp(e.target.value)} placeholder="60123456789 (digits only, include country code)" className={inputCls} />
              </div>

              {/* Images */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Food Images (up to 5 URLs)</label>
                <div className="space-y-2">
                  {fpImages.map((url, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <span className="text-[9px] font-black text-slate-300 w-4">{i + 1}</span>
                      <input value={url} onChange={e => { const imgs = [...fpImages]; imgs[i] = e.target.value; setFpImages(imgs); }}
                        placeholder={i === 0 ? "Image URL (required for display)" : "Image URL (optional)"}
                        className={`${inputCls} text-[12px]`} />
                      {url && (
                        <img src={url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-slate-100" onError={e => (e.currentTarget.style.display = "none")} />
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-slate-400 mt-1.5">Paste direct image URLs. First image shown on shop page card.</p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button onClick={closeForm} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-500 text-[10px] font-black uppercase hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button onClick={save} disabled={saving || !fpName.trim() || !fpWhatsapp.trim()}
                  className="flex-1 py-3 rounded-xl bg-[#062c24] text-white text-[10px] font-black uppercase hover:bg-emerald-800 transition-colors disabled:opacity-40 shadow-sm">
                  {saving ? "Saving…" : editing ? "Save Changes" : "Add Partner"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
