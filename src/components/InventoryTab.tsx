"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { auth } from "@/lib/firebase";
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, doc,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import GearFlyerModal from "@/components/GearFlyerModal";

type InventoryTabProps = { vendorId: string };

type GearItem = {
  id: string; 
  name: string; 
  price: number; 
  stock: number;
  img?: string; 
  images?: string[]; // Multiple images support
  desc?: string; 
  category?: string;
  type?: string; 
  inc?: string[]; // Text-based includes (legacy)
  linkedItems?: { itemId: string; qty: number }[]; // Linked add-on items for packages
  deleted?: boolean;
  // NEW: Setup service per item
  setup?: {
    available: boolean;
    fee: number;
    description: string;
  };
};

type Discount = {
  id: string; 
  type: string; 
  discount_percent: number;
  trigger_nights?: number; 
  code?: string; 
  appliesTo?: { type: "all" | "specific"; itemIds?: string[] }; // Discount targeting
  is_public?: boolean; 
  deleted?: boolean;
};

const inputCls = "w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-semibold outline-none focus:border-emerald-500 focus:bg-white transition-all";
const labelCls = "text-[9px] font-black text-slate-400 uppercase mb-1.5 block";
const helperCls = "text-[10px] text-slate-400 mt-1";

export default function InventoryTab({ vendorId }: InventoryTabProps) {
  const [allGear, setAllGear] = useState<GearItem[]>([]);
  const [allDiscounts, setAllDiscounts] = useState<Discount[]>([]);
  const [showGearModal, setShowGearModal] = useState(false);
  const [showDiscModal, setShowDiscModal] = useState(false);
  const [editingGear, setEditingGear] = useState<GearItem | null>(null);
  const [editingDisc, setEditingDisc] = useState<Discount | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showFlyer, setShowFlyer] = useState(false);

  // Gear form state
  const [gearName, setGearName] = useState("");
  const [gearDesc, setGearDesc] = useState("");
  const [gearPrice, setGearPrice] = useState("");
  const [gearStock, setGearStock] = useState("");
  const [gearCat, setGearCat] = useState("");
  const [gearType, setGearType] = useState("addon");
  const [gearImages, setGearImages] = useState<string[]>([]); // Multiple images
  const [gearInc, setGearInc] = useState<string[]>([]); // Text includes
  const [linkedItems, setLinkedItems] = useState<{ itemId: string; qty: number }[]>([]); // Linked add-ons
  const [pendingFiles, setPendingFiles] = useState<File[]>([]); // Files to upload
  
  // NEW: Setup service form state
  const [setupAvailable, setSetupAvailable] = useState(false);
  const [setupFee, setSetupFee] = useState("");
  const [setupDesc, setSetupDesc] = useState("");

  // Discount form state
  const [discType, setDiscType] = useState("nightly_discount");
  const [discPercent, setDiscPercent] = useState("");
  const [discTrigger, setDiscTrigger] = useState("");
  const [discCode, setDiscCode] = useState("");
  const [discPublic, setDiscPublic] = useState(true);
  const [discAppliesTo, setDiscAppliesTo] = useState<"all" | "specific">("all");
  const [discSelectedItems, setDiscSelectedItems] = useState<string[]>([]);

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
  const addons = allGear.filter(g => g.type !== "package");

  // --- GEAR ACTIONS ---
  function openAddGear() {
    setEditingGear(null);
    setGearName(""); setGearDesc(""); setGearPrice("");
    setGearStock(""); setGearCat(""); setGearType("addon");
    setGearImages([]); setGearInc([]); setLinkedItems([]);
    setPendingFiles([]);
    setSetupAvailable(false); setSetupFee(""); setSetupDesc("");
    setShowGearModal(true);
  }

  function openEditGear(g: GearItem) {
    setEditingGear(g);
    setGearName(g.name); setGearDesc(g.desc || "");
    setGearPrice(String(g.price)); setGearStock(String(g.stock));
    setGearCat(g.category || (g.type === "package" ? "Packages" : "Add-ons"));
    setGearType(g.type || "addon");
    setGearImages(g.images || (g.img ? [g.img] : [])); // Support legacy single img
    setGearInc(g.inc || []);
    setLinkedItems(g.linkedItems || []);
    setPendingFiles([]);
    // Setup fields
    setSetupAvailable(g.setup?.available || false);
    setSetupFee(String(g.setup?.fee || ""));
    setSetupDesc(g.setup?.description || "");
    setShowGearModal(true);
  }

  async function saveGear() {
    if (!gearName.trim()) return alert("Please enter item name");
    setUploading(true);
    try {
      const storage = getStorage();
      
      // Upload new files
      const newUrls: string[] = [];
      for (const file of pendingFiles) {
        const snap = await uploadBytes(ref(storage, `gear/${vendorId}/${Date.now()}_${file.name}`), file);
        newUrls.push(await getDownloadURL(snap.ref));
      }
      
      const allImages = [...gearImages, ...newUrls];
      
      const data: any = {
        vendorId, 
        owner_uid: auth.currentUser?.uid,
        category: gearCat || (gearType === "package" ? "Packages" : "Add-ons"), 
        type: gearType,
        name: gearName, 
        desc: gearDesc,
        price: Number(gearPrice) || 0, 
        stock: Number(gearStock) || 0,
        img: allImages[0] || "", // First image as main (legacy support)
        images: allImages,
        inc: gearInc.filter(Boolean), 
        deleted: false,
      };
      
      // Add linked items for packages
      if (gearType === "package" && linkedItems.length > 0) {
        data.linkedItems = linkedItems.filter(li => li.itemId && li.qty > 0);
      }
      
      // Add setup service data
      data.setup = {
        available: setupAvailable,
        fee: Number(setupFee) || 0,
        description: setupDesc,
      };
      
      if (editingGear) {
        await updateDoc(doc(db, "gear", editingGear.id), data);
      } else {
        await addDoc(collection(db, "gear"), data);
      }
      setShowGearModal(false);
    } catch (e) { 
      console.error(e); 
      alert("Error saving item."); 
    } finally { 
      setUploading(false); 
    }
  }

  async function deleteGear(id: string) {
    if (confirm("Remove this item?"))
      await updateDoc(doc(db, "gear", id), { deleted: true });
  }

  function handleFileSelect(files: FileList | null) {
    if (!files) return;
    const newFiles = Array.from(files).slice(0, 5 - gearImages.length - pendingFiles.length);
    setPendingFiles(prev => [...prev, ...newFiles]);
  }

  function removeImage(index: number) {
    setGearImages(prev => prev.filter((_, i) => i !== index));
  }

  function removePendingFile(index: number) {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  }

  function addLinkedItem() {
    setLinkedItems(prev => [...prev, { itemId: "", qty: 1 }]);
  }

  function updateLinkedItem(index: number, field: "itemId" | "qty", value: string | number) {
    setLinkedItems(prev => prev.map((li, i) => 
      i === index ? { ...li, [field]: field === "qty" ? Number(value) : value } : li
    ));
  }

  function removeLinkedItem(index: number) {
    setLinkedItems(prev => prev.filter((_, i) => i !== index));
  }

  // --- DISCOUNT ACTIONS ---
  function openAddDisc() {
    setEditingDisc(null);
    setDiscType("nightly_discount"); setDiscPercent("");
    setDiscTrigger(""); setDiscCode(""); setDiscPublic(true);
    setDiscAppliesTo("all"); setDiscSelectedItems([]);
    setShowDiscModal(true);
  }

  function openEditDisc(d: Discount) {
    setEditingDisc(d);
    setDiscType(d.type); setDiscPercent(String(d.discount_percent));
    setDiscTrigger(String(d.trigger_nights || ""));
    setDiscCode(d.code || ""); setDiscPublic(d.is_public !== false);
    setDiscAppliesTo(d.appliesTo?.type || "all");
    setDiscSelectedItems(d.appliesTo?.itemIds || []);
    setShowDiscModal(true);
  }

  async function saveDisc() {
    const data: any = {
      type: discType, 
      discount_percent: Number(discPercent),
      trigger_nights: discType === "nightly_discount" ? Number(discTrigger) : null,
      code: discType === "promo_code" ? discCode.toUpperCase() : null, 
      is_public: discPublic, 
      deleted: false,
      appliesTo: {
        type: discAppliesTo,
        itemIds: discAppliesTo === "specific" ? discSelectedItems : [],
      },
    };
    if (editingDisc) {
      await updateDoc(doc(db, "vendors", vendorId, "discounts", editingDisc.id), data);
    } else {
      await addDoc(collection(db, "vendors", vendorId, "discounts"), data);
    }
    setShowDiscModal(false);
  }

  async function deleteDisc() {
    if (editingDisc && confirm("Delete rule?")) {
      await updateDoc(doc(db, "vendors", vendorId, "discounts", editingDisc.id), { deleted: true });
      setShowDiscModal(false);
    }
  }

  function toggleDiscountItem(itemId: string) {
    setDiscSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId) 
        : [...prev, itemId]
    );
  }

  // Get item name by ID
  function getItemName(itemId: string): string {
    return allGear.find(g => g.id === itemId)?.name || "Unknown";
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-lg font-black text-[#062c24] uppercase">Inventory</h2>
            <p className="text-xs text-slate-400 mt-1">Manage your gear, packages, and pricing</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button onClick={() => setShowFlyer(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-red-50 text-red-500 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-red-100 transition-all border border-red-100">
              <i className="fas fa-file-pdf"></i> Flyer
            </button>
            <button onClick={openAddDisc}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-100 transition-all border border-indigo-100">
              <i className="fas fa-tags"></i> Discounts
            </button>
            <button onClick={openAddGear}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#062c24] text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-800 transition-all">
              <i className="fas fa-plus"></i> Add Item
            </button>
          </div>
        </div>
      </div>

      {/* Active Discounts */}
      {allDiscounts.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
          {allDiscounts.map(d => (
            <div key={d.id} onClick={() => openEditDisc(d)}
              className="flex-shrink-0 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 px-4 py-3 rounded-xl cursor-pointer min-w-[120px] hover:border-indigo-300 transition-all">
              <p className="text-sm font-black text-indigo-600">{d.discount_percent}% OFF</p>
              <p className="text-[9px] text-indigo-400 font-medium mt-0.5">
                {d.type === "promo_code" ? `Code: ${d.code}` : `${d.trigger_nights}+ nights`}
              </p>
              {d.appliesTo?.type === "specific" && (
                <p className="text-[8px] text-purple-400 mt-1">
                  {d.appliesTo.itemIds?.length || 0} items
                </p>
              )}
            </div>
          ))}
          <button onClick={openAddDisc}
            className="flex-shrink-0 bg-white border-2 border-dashed border-slate-200 px-4 py-3 rounded-xl text-[10px] font-black text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-all flex items-center gap-2">
            <i className="fas fa-plus"></i> Add Discount
          </button>
        </div>
      )}

      {/* Inventory Grid */}
      <div className="space-y-6">
        {categories.map(cat => {
          const items = allGear.filter(g => (g.category || (g.type === "package" ? "Packages" : "Add-ons")) === cat);
          if (!items.length) return null;
          return (
            <div key={cat} className="bg-white p-6 rounded-2xl border border-slate-100">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 pb-2 border-b border-slate-100">
                {cat} <span className="text-slate-300 ml-2">({items.length})</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map(g => (
                  <div key={g.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-all group">
                    <div className="w-14 h-14 rounded-xl bg-white p-0.5 shadow-sm overflow-hidden flex-shrink-0 relative">
                      <img src={g.images?.[0] || g.img || "/pacak-khemah.png"} className="w-full h-full object-cover rounded-lg" alt={g.name} />
                      {g.setup?.available && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                          <i className="fas fa-tools text-white text-[6px]"></i>
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-black text-[#062c24] truncate">{g.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">RM{g.price}</span>
                        <span className="text-[9px] font-bold text-slate-400">Stock: {g.stock}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {g.linkedItems && g.linkedItems.length > 0 && (
                          <p className="text-[8px] text-purple-500">
                            <i className="fas fa-link mr-1"></i>{g.linkedItems.length} linked
                          </p>
                        )}
                        {g.setup?.available && (
                          <p className="text-[8px] text-blue-500">
                            <i className="fas fa-tools mr-1"></i>Setup +RM{g.setup.fee}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditGear(g)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-slate-400 hover:text-emerald-600 shadow-sm transition-all">
                        <i className="fas fa-pen text-[10px]"></i>
                      </button>
                      <button onClick={() => deleteGear(g.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-slate-400 hover:text-red-500 shadow-sm transition-all">
                        <i className="fas fa-trash text-[10px]"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        
        {allGear.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-box-open text-slate-300 text-2xl"></i>
            </div>
            <p className="text-sm font-bold text-slate-400">No items yet</p>
            <p className="text-xs text-slate-300 mt-1 mb-4">Add your first gear or package</p>
            <button onClick={openAddGear} className="text-xs font-bold text-emerald-600 hover:text-emerald-700">
              <i className="fas fa-plus mr-1"></i> Add First Item
            </button>
          </div>
        )}
      </div>

      {/* Gear Modal - Enhanced with Setup Service */}
      {showGearModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[600] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-slate-100 p-5 flex justify-between items-center z-10">
              <h3 className="text-lg font-black text-[#062c24] uppercase">
                {editingGear ? "Edit Item" : "New Item"}
              </h3>
              <button onClick={() => setShowGearModal(false)} className="w-9 h-9 bg-slate-100 rounded-full text-slate-400 hover:text-red-500 flex items-center justify-center">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Type Selection */}
              <div>
                <label className={labelCls}>Item Type *</label>
                <select value={gearType} onChange={e => setGearType(e.target.value)} className={inputCls}>
                  <option value="addon">Add-on / Single Item</option>
                  <option value="package">Package (Bundle)</option>
                </select>
                <p className={helperCls}>
                  {gearType === "package" 
                    ? "Packages can include multiple add-ons with linked stock" 
                    : "Single items like tents, chairs, tables, etc."}
                </p>
              </div>

              {/* Category */}
              <div>
                <label className={labelCls}>Category</label>
                <input 
                  value={gearCat} 
                  onChange={e => setGearCat(e.target.value)} 
                  list="cat-list" 
                  className={inputCls} 
                  placeholder="e.g. Tents, Furniture, Lighting" 
                />
                <datalist id="cat-list">
                  {categories.map(c => <option key={c} value={c} />)}
                </datalist>
                <p className={helperCls}>Group similar items together</p>
              </div>

              {/* Name & Stock */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Item Name *</label>
                  <input value={gearName} onChange={e => setGearName(e.target.value)} className={inputCls} placeholder="e.g. Naturehike 2P Tent" />
                </div>
                <div>
                  <label className={labelCls}>Total Stock *</label>
                  <input type="number" value={gearStock} onChange={e => setGearStock(e.target.value)} className={inputCls} placeholder="e.g. 5" />
                  <p className={helperCls}>How many you own</p>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className={labelCls}>Description</label>
                <textarea 
                  value={gearDesc} 
                  onChange={e => setGearDesc(e.target.value)} 
                  rows={2} 
                  className={`${inputCls} resize-none`} 
                  placeholder="Brief description for customers..."
                />
              </div>

              {/* Price */}
              <div>
                <label className={labelCls}>Price (RM per night) *</label>
                <input type="number" value={gearPrice} onChange={e => setGearPrice(e.target.value)} className={inputCls} placeholder="e.g. 50" />
              </div>

              {/* Photos - Multiple */}
              <div>
                <label className={labelCls}>Photos (Max 5)</label>
                <div className="grid grid-cols-5 gap-2 mb-3">
                  {gearImages.map((url, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100">
                      <img src={url} className="w-full h-full object-cover" alt="" />
                      <button 
                        onClick={() => removeImage(i)}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-[8px] flex items-center justify-center hover:bg-red-600"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                      {i === 0 && (
                        <span className="absolute bottom-1 left-1 bg-black/50 text-white text-[7px] px-1 rounded">Main</span>
                      )}
                    </div>
                  ))}
                  {pendingFiles.map((file, i) => (
                    <div key={`pending-${i}`} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100">
                      <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt="" />
                      <button 
                        onClick={() => removePendingFile(i)}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-[8px] flex items-center justify-center"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                      <span className="absolute bottom-1 left-1 bg-blue-500 text-white text-[7px] px-1 rounded">New</span>
                    </div>
                  ))}
                  {gearImages.length + pendingFiles.length < 5 && (
                    <label className="aspect-square rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-all">
                      <i className="fas fa-plus text-slate-300"></i>
                      <input 
                        type="file" 
                        accept="image/*" 
                        multiple
                        className="hidden" 
                        onChange={e => handleFileSelect(e.target.files)}
                      />
                    </label>
                  )}
                </div>
                <p className={helperCls}>First photo will be the main thumbnail</p>
              </div>

              {/* NEW: Setup Service */}
              <div className={`p-4 rounded-xl border transition-all ${setupAvailable ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-100"}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <label className="text-[10px] font-black text-blue-700 uppercase flex items-center gap-2">
                      <i className="fas fa-tools"></i> Setup Service
                    </label>
                    <p className="text-[9px] text-blue-500">Offer setup for this item (delivery only)</p>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={setupAvailable} 
                    onChange={e => setSetupAvailable(e.target.checked)} 
                    className="w-5 h-5 accent-blue-500"
                  />
                </div>
                
                {setupAvailable && (
                  <div className="space-y-3 pt-2 border-t border-blue-100">
                    <div>
                      <label className="text-[9px] font-bold text-blue-600 uppercase mb-1 block">Setup Fee (RM)</label>
                      <input 
                        type="number" 
                        value={setupFee} 
                        onChange={e => setSetupFee(e.target.value)} 
                        className="w-full bg-white border border-blue-200 p-2.5 rounded-lg text-sm font-semibold outline-none focus:border-blue-400"
                        placeholder="e.g. 50"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-blue-600 uppercase mb-1 block">Setup Description</label>
                      <input 
                        value={setupDesc} 
                        onChange={e => setSetupDesc(e.target.value)} 
                        className="w-full bg-white border border-blue-200 p-2.5 rounded-lg text-sm font-semibold outline-none focus:border-blue-400"
                        placeholder="e.g. Full tent pitching with groundsheet"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Package: Linked Items */}
              {gearType === "package" && (
                <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <label className="text-[10px] font-black text-purple-700 uppercase">Linked Add-ons</label>
                      <p className="text-[9px] text-purple-500">When booked, these items' stock will reduce automatically</p>
                    </div>
                    <button onClick={addLinkedItem} className="text-[9px] font-bold text-purple-600 bg-white px-2 py-1 rounded-lg hover:bg-purple-100">
                      + Link Item
                    </button>
                  </div>
                  
                  {linkedItems.length === 0 ? (
                    <p className="text-[10px] text-purple-400 text-center py-3">No linked items. Add to sync inventory.</p>
                  ) : (
                    <div className="space-y-2">
                      {linkedItems.map((li, i) => (
                        <div key={i} className="flex gap-2 items-center bg-white p-2 rounded-lg">
                          <select 
                            value={li.itemId} 
                            onChange={e => updateLinkedItem(i, "itemId", e.target.value)}
                            className="flex-1 bg-slate-50 border border-slate-200 p-2 rounded-lg text-xs outline-none"
                          >
                            <option value="">Select item...</option>
                            {addons.map(addon => (
                              <option key={addon.id} value={addon.id}>{addon.name} (Stock: {addon.stock})</option>
                            ))}
                          </select>
                          <input 
                            type="number" 
                            value={li.qty} 
                            onChange={e => updateLinkedItem(i, "qty", e.target.value)}
                            min="1"
                            className="w-16 bg-slate-50 border border-slate-200 p-2 rounded-lg text-xs text-center outline-none"
                            placeholder="Qty"
                          />
                          <button onClick={() => removeLinkedItem(i)} className="text-red-400 hover:text-red-600 p-1">
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Package: Text Includes (Legacy/Additional) */}
              {gearType === "package" && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase">What's Included (Text)</label>
                      <p className="text-[9px] text-slate-400">Additional items shown to customers</p>
                    </div>
                    <button onClick={() => setGearInc(prev => [...prev, ""])} className="text-[9px] font-bold text-emerald-600 bg-white px-2 py-1 rounded-lg hover:bg-emerald-50">
                      + Add
                    </button>
                  </div>
                  <div className="space-y-2">
                    {gearInc.map((inc, i) => (
                      <div key={i} className="flex gap-2">
                        <input 
                          value={inc} 
                          onChange={e => setGearInc(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                          className="flex-1 bg-white border border-slate-200 p-2 rounded-lg text-xs outline-none"
                          placeholder="e.g. Ground sheet, 2x Lamps"
                        />
                        <button onClick={() => setGearInc(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 px-2">
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t border-slate-100 p-5">
              <button onClick={saveGear} disabled={uploading || !gearName.trim()}
                className="w-full bg-[#062c24] text-white py-3.5 rounded-xl font-black uppercase text-xs tracking-widest disabled:opacity-50 hover:bg-emerald-800 transition-colors">
                {uploading ? <><i className="fas fa-spinner fa-spin mr-2"></i>Saving...</> : "Save Item"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discount Modal - Enhanced */}
      {showDiscModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[600] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            {/* Header */}
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h3 className="text-lg font-black text-[#062c24] uppercase">Discount Rule</h3>
              <div className="flex gap-2">
                {editingDisc && (
                  <button onClick={deleteDisc} className="w-9 h-9 bg-red-50 rounded-full text-red-400 hover:bg-red-500 hover:text-white flex items-center justify-center">
                    <i className="fas fa-trash text-sm"></i>
                  </button>
                )}
                <button onClick={() => setShowDiscModal(false)} className="w-9 h-9 bg-slate-100 rounded-full text-slate-400 hover:text-red-500 flex items-center justify-center">
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Type */}
              <div>
                <label className={labelCls}>Discount Type</label>
                <select value={discType} onChange={e => setDiscType(e.target.value)} className={inputCls}>
                  <option value="nightly_discount">Nightly Bulk Discount</option>
                  <option value="promo_code">Promo Code</option>
                </select>
                <p className={helperCls}>
                  {discType === "nightly_discount" 
                    ? "Auto-applied when customer books X+ nights" 
                    : "Customer enters code at checkout"}
                </p>
              </div>

              {/* Trigger or Code */}
              {discType === "nightly_discount" && (
                <div>
                  <label className={labelCls}>Minimum Nights</label>
                  <input type="number" value={discTrigger} onChange={e => setDiscTrigger(e.target.value)} placeholder="e.g. 3" className={inputCls} />
                </div>
              )}
              {discType === "promo_code" && (
                <div>
                  <label className={labelCls}>Promo Code</label>
                  <input value={discCode} onChange={e => setDiscCode(e.target.value.toUpperCase())} placeholder="e.g. CAMPING20" className={inputCls} />
                </div>
              )}

              {/* Percentage */}
              <div>
                <label className={labelCls}>Discount Percentage (%)</label>
                <input type="number" value={discPercent} onChange={e => setDiscPercent(e.target.value)} placeholder="e.g. 10" className={inputCls} />
              </div>

              {/* Applies To - NEW */}
              <div>
                <label className={labelCls}>Applies To</label>
                <select value={discAppliesTo} onChange={e => setDiscAppliesTo(e.target.value as "all" | "specific")} className={inputCls}>
                  <option value="all">All Items</option>
                  <option value="specific">Specific Items Only</option>
                </select>
              </div>

              {/* Item Selection */}
              {discAppliesTo === "specific" && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 max-h-48 overflow-y-auto">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-3">Select Items</p>
                  <div className="space-y-2">
                    {allGear.map(g => (
                      <label key={g.id} className="flex items-center gap-3 p-2 bg-white rounded-lg cursor-pointer hover:bg-emerald-50 transition-colors">
                        <input 
                          type="checkbox" 
                          checked={discSelectedItems.includes(g.id)}
                          onChange={() => toggleDiscountItem(g.id)}
                          className="w-4 h-4 accent-emerald-500"
                        />
                        <span className="text-xs font-medium text-slate-700 flex-1">{g.name}</span>
                        <span className="text-[9px] text-slate-400">RM{g.price}</span>
                      </label>
                    ))}
                  </div>
                  {discSelectedItems.length > 0 && (
                    <p className="text-[9px] text-emerald-600 mt-2 font-medium">
                      {discSelectedItems.length} item(s) selected
                    </p>
                  )}
                </div>
              )}

              {/* Public Banner */}
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <p className="text-xs font-bold text-slate-700">Show Public Banner</p>
                  <p className="text-[9px] text-slate-400">Display on your shop page</p>
                </div>
                <input type="checkbox" checked={discPublic} onChange={e => setDiscPublic(e.target.checked)} className="w-5 h-5 accent-emerald-500" />
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-slate-100">
              <button onClick={saveDisc} disabled={!discPercent}
                className="w-full bg-[#062c24] text-white py-3.5 rounded-xl font-black uppercase text-xs disabled:opacity-50 hover:bg-emerald-800 transition-colors">
                Save Discount
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gear Flyer Modal */}
      {showFlyer && <GearFlyerModal vendorId={vendorId} onClose={() => setShowFlyer(false)} />}
    </div>
  );
}