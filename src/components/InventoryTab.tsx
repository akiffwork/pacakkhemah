"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { auth } from "@/lib/firebase";
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, doc,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

type InventoryTabProps = { vendorId: string };

type GearItem = {
  id: string; name: string; price: number; stock: number;
  img?: string; desc?: string; category?: string;
  type?: string; inc?: string[]; deleted?: boolean;
};

type Discount = {
  id: string; type: string; discount_percent: number;
  trigger_nights?: number; code?: string; target?: string;
  is_public?: boolean; deleted?: boolean;
};

const inputCls = "w-full bg-slate-50 border border-slate-200 p-3.5 rounded-[0.85rem] text-sm font-semibold outline-none focus:border-emerald-500 focus:bg-white transition-all";

export default function InventoryTab({ vendorId }: InventoryTabProps) {
  const [allGear, setAllGear] = useState<GearItem[]>([]);
  const [allDiscounts, setAllDiscounts] = useState<Discount[]>([]);
  const [showGearModal, setShowGearModal] = useState(false);
  const [showDiscModal, setShowDiscModal] = useState(false);
  const [editingGear, setEditingGear] = useState<GearItem | null>(null);
  const [editingDisc, setEditingDisc] = useState<Discount | null>(null);
  const [uploading, setUploading] = useState(false);

  // Gear form state
  const [gearName, setGearName] = useState("");
  const [gearDesc, setGearDesc] = useState("");
  const [gearPrice, setGearPrice] = useState("");
  const [gearStock, setGearStock] = useState("");
  const [gearCat, setGearCat] = useState("");
  const [gearType, setGearType] = useState("addon");
  const [gearImgUrl, setGearImgUrl] = useState("");
  const [gearInc, setGearInc] = useState<string[]>([]);
  const [gearFile, setGearFile] = useState<File | null>(null);

  // Discount form state
  const [discType, setDiscType] = useState("nightly_discount");
  const [discPercent, setDiscPercent] = useState("");
  const [discTrigger, setDiscTrigger] = useState("");
  const [discCode, setDiscCode] = useState("");
  const [discPublic, setDiscPublic] = useState(true);

  // Real-time listeners
  useEffect(() => {
    const gearUnsub = onSnapshot(
      query(collection(db, "gear"), where("vendorId", "==", vendorId)),
      snap => setAllGear(snap.docs.map(d => ({ id: d.id, ...d.data() } as GearItem)).filter(g => !g.deleted))
    );
    const discUnsub = onSnapshot(
      collection(db, "vendors", vendorId, "discounts"),
      snap => setAllDiscounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Discount)).filter(d => !d.deleted))
    );
    return () => { gearUnsub(); discUnsub(); };
  }, [vendorId]);

  const categories = Array.from(new Set(allGear.map(g => g.category || (g.type === "package" ? "Packages" : "Add-ons")))).sort();

  // --- GEAR ACTIONS ---
  function openAddGear() {
    setEditingGear(null);
    setGearName(""); setGearDesc(""); setGearPrice("");
    setGearStock(""); setGearCat(""); setGearType("addon");
    setGearImgUrl(""); setGearInc([]); setGearFile(null);
    setShowGearModal(true);
  }

  function openEditGear(g: GearItem) {
    setEditingGear(g);
    setGearName(g.name); setGearDesc(g.desc || "");
    setGearPrice(String(g.price)); setGearStock(String(g.stock));
    setGearCat(g.category || (g.type === "package" ? "Packages" : "Add-ons"));
    setGearType(g.type || "addon"); setGearImgUrl(g.img || "");
    setGearInc(g.inc || []); setGearFile(null);
    setShowGearModal(true);
  }

  async function saveGear() {
    setUploading(true);
    try {
      let url = gearImgUrl;
      if (gearFile) {
        const storage = getStorage();
        const snap = await uploadBytes(ref(storage, `gear/${vendorId}/${Date.now()}`), gearFile);
        url = await getDownloadURL(snap.ref);
      }
      const data = {
        vendorId, owner_uid: auth.currentUser?.uid,
        category: gearCat || "General", type: gearType,
        name: gearName, desc: gearDesc,
        price: Number(gearPrice), stock: Number(gearStock),
        img: url, inc: gearInc.filter(Boolean), deleted: false,
      };
      if (editingGear) await updateDoc(doc(db, "gear", editingGear.id), data);
      else await addDoc(collection(db, "gear"), data);
      setShowGearModal(false);
    } catch (e) { console.error(e); alert("Error saving item."); }
    finally { setUploading(false); }
  }

  async function deleteGear(id: string) {
    if (confirm("Remove this item?"))
      await updateDoc(doc(db, "gear", id), { deleted: true });
  }

  // --- DISCOUNT ACTIONS ---
  function openAddDisc() {
    setEditingDisc(null);
    setDiscType("nightly_discount"); setDiscPercent("");
    setDiscTrigger(""); setDiscCode(""); setDiscPublic(true);
    setShowDiscModal(true);
  }

  function openEditDisc(d: Discount) {
    setEditingDisc(d);
    setDiscType(d.type); setDiscPercent(String(d.discount_percent));
    setDiscTrigger(String(d.trigger_nights || ""));
    setDiscCode(d.code || ""); setDiscPublic(d.is_public !== false);
    setShowDiscModal(true);
  }

  async function saveDisc() {
    const data = {
      type: discType, discount_percent: Number(discPercent),
      trigger_nights: Number(discTrigger),
      code: discCode.toUpperCase(), is_public: discPublic, deleted: false,
    };
    if (editingDisc) await updateDoc(doc(db, "vendors", vendorId, "discounts", editingDisc.id), data);
    else await addDoc(collection(db, "vendors", vendorId, "discounts"), data);
    setShowDiscModal(false);
  }

  async function deleteDisc() {
    if (editingDisc && confirm("Delete rule?")) {
      await updateDoc(doc(db, "vendors", vendorId, "discounts", editingDisc.id), { deleted: true });
      setShowDiscModal(false);
    }
  }

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-[#062c24] uppercase">Gear & Pricing</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Manage your rental fleet</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button onClick={openAddDisc}
            className="flex-1 md:flex-none bg-indigo-50 text-indigo-600 px-6 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-100 transition-all border border-indigo-100">
            <i className="fas fa-tags mr-2"></i> Discounts
          </button>
          <button onClick={openAddGear}
            className="flex-1 md:flex-none bg-[#062c24] text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-900 transition-all shadow-lg">
            <i className="fas fa-plus mr-2"></i> Add Item
          </button>
        </div>
      </div>

      {/* Discounts Strip */}
      <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
        {allDiscounts.map(d => (
          <div key={d.id} onClick={() => openEditDisc(d)}
            className="flex-shrink-0 bg-indigo-50 border border-indigo-100 px-4 py-3 rounded-xl cursor-pointer min-w-[100px] text-center hover:border-indigo-400 transition-all">
            <p className="text-[10px] font-black text-indigo-600 uppercase">{d.discount_percent}% OFF</p>
            <p className="text-[8px] text-indigo-400 font-medium truncate">
              {d.type === "promo_code" ? d.code : `> ${d.trigger_nights} nights`}
            </p>
          </div>
        ))}
        <button onClick={openAddDisc}
          className="flex-shrink-0 bg-slate-50 border-2 border-dashed border-slate-200 px-4 py-2 rounded-xl text-[9px] font-black text-slate-400 hover:border-emerald-400 transition-all">
          + Rule
        </button>
      </div>

      {/* Inventory Grid */}
      <div className="space-y-8 pb-10">
        {categories.map(cat => {
          const items = allGear.filter(g => (g.category || (g.type === "package" ? "Packages" : "Add-ons")) === cat);
          if (!items.length) return null;
          return (
            <div key={cat} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-50 pb-2">{cat}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map(g => (
                  <div key={g.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100 relative group">
                    <div className="w-12 h-12 rounded-xl bg-white p-0.5 shadow-sm overflow-hidden flex-shrink-0">
                      <img src={g.img} className="w-full h-full object-cover rounded-lg" alt={g.name} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[10px] font-black uppercase text-[#062c24] truncate">{g.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">RM {g.price}</span>
                        <span className="text-[8px] font-bold text-slate-400">Stock: {g.stock}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEditGear(g)}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-slate-300 hover:text-emerald-600 shadow-sm transition-all">
                        <i className="fas fa-pen text-xs"></i>
                      </button>
                      <button onClick={() => deleteGear(g.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-red-50 text-red-300 hover:text-red-500 shadow-sm transition-all">
                        <i className="fas fa-trash text-xs"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {allGear.length === 0 && (
          <div className="text-center py-20 text-slate-400">
            <i className="fas fa-box-open text-4xl mb-4 block opacity-30"></i>
            <p className="text-xs font-black uppercase">No items yet. Add your first gear!</p>
          </div>
        )}
      </div>

      {/* Gear Modal */}
      {showGearModal && (
        <div className="fixed inset-0 bg-[#062c24]/95 backdrop-blur-md z-[600] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] p-8 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-[#062c24] uppercase">{editingGear ? "Edit Item" : "New Item"}</h3>
              <button onClick={() => setShowGearModal(false)} className="w-8 h-8 bg-slate-100 rounded-full text-slate-400 hover:text-red-500">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase">Type</label>
                <select value={gearType} onChange={e => setGearType(e.target.value)} className={inputCls}>
                  <option value="addon">Add-on / Single Item</option>
                  <option value="package">Package</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase">Category</label>
                <input value={gearCat} onChange={e => setGearCat(e.target.value)} list="cat-list" className={inputCls} placeholder="e.g. Tents" />
                <datalist id="cat-list">
                  {categories.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Item Name</label>
                  <input value={gearName} onChange={e => setGearName(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Total Stock</label>
                  <input type="number" value={gearStock} onChange={e => setGearStock(e.target.value)} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase">Description</label>
                <textarea value={gearDesc} onChange={e => setGearDesc(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Price (RM/night)</label>
                  <input type="number" value={gearPrice} onChange={e => setGearPrice(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Photo</label>
                  <input type="file" accept="image/*" onChange={e => setGearFile(e.target.files?.[0] || null)} className="text-[9px] mt-2" />
                  {gearImgUrl && <img src={gearImgUrl} className="mt-2 h-12 rounded-lg object-cover" alt="preview" />}
                </div>
              </div>

              {gearType === "package" && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[9px] font-black uppercase text-slate-400">Included Items</label>
                    <button onClick={() => setGearInc(prev => [...prev, ""])} className="text-[8px] font-bold text-emerald-600">+ Add</button>
                  </div>
                  <div className="space-y-2">
                    {gearInc.map((inc, i) => (
                      <div key={i} className="flex gap-2">
                        <input value={inc} onChange={e => setGearInc(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                          className="w-full p-3 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none" />
                        <button onClick={() => setGearInc(prev => prev.filter((_, j) => j !== i))}
                          className="text-red-400 w-8 flex items-center justify-center hover:bg-red-50 rounded-lg">
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={saveGear} disabled={uploading}
                className="w-full bg-[#062c24] text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg disabled:opacity-50">
                {uploading ? <i className="fas fa-spinner fa-spin"></i> : "Save Item"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discount Modal */}
      {showDiscModal && (
        <div className="fixed inset-0 bg-[#062c24]/95 backdrop-blur-md z-[600] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] p-8 max-w-sm w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-[#062c24] uppercase">Discount Rule</h3>
              <div className="flex gap-2">
                {editingDisc && (
                  <button onClick={deleteDisc} className="w-8 h-8 bg-red-50 rounded-full text-red-400 hover:bg-red-500 hover:text-white">
                    <i className="fas fa-trash text-xs"></i>
                  </button>
                )}
                <button onClick={() => setShowDiscModal(false)} className="w-8 h-8 bg-slate-100 rounded-full text-slate-400 hover:text-red-500">
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase">Type</label>
                <select value={discType} onChange={e => setDiscType(e.target.value)} className={inputCls}>
                  <option value="nightly_discount">Nightly Bulk Discount</option>
                  <option value="promo_code">Promo Code</option>
                </select>
              </div>
              {discType === "nightly_discount" && (
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Minimum Nights</label>
                  <input type="number" value={discTrigger} onChange={e => setDiscTrigger(e.target.value)} placeholder="e.g. 2" className={inputCls} />
                </div>
              )}
              {discType === "promo_code" && (
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Code</label>
                  <input value={discCode} onChange={e => setDiscCode(e.target.value.toUpperCase())} placeholder="e.g. SALE20" className={inputCls} />
                </div>
              )}
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase">Discount Percent (%)</label>
                <input type="number" value={discPercent} onChange={e => setDiscPercent(e.target.value)} placeholder="e.g. 10" className={inputCls} />
              </div>
              <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <input type="checkbox" checked={discPublic} onChange={e => setDiscPublic(e.target.checked)} className="w-5 h-5 accent-emerald-500" />
                <label className="text-[9px] font-bold text-slate-500">Show Public Banner?</label>
              </div>
              <button onClick={saveDisc} className="w-full bg-[#062c24] text-white py-4 rounded-2xl font-black uppercase text-xs shadow-lg">
                Save Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}