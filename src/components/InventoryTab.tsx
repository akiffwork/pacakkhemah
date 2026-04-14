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

type GearVariant = {
  id: string;
  color?: { label: string; hex: string };
  size?: string;
  price: number;
  stock: number;
};

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
  linkedItems?: { itemId: string; qty: number; variantId?: string; variantLabel?: string; variantColor?: string }[]; // Linked add-on items for packages
  deleted?: boolean;
  hasVariants?: boolean;
  variants?: GearVariant[];
  setup?: {
    available: boolean;
    fee: number;
    description: string;
  };
  specs?: {
    size?: string;
    maxPax?: number;
    puRating?: string;
    layers?: string;
    weight?: string;
    tentType?: string;
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
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  function showToast(msg: string, type: "success" | "error" = "success") { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); }

  // Gear form state
  const [gearName, setGearName] = useState("");
  const [gearDesc, setGearDesc] = useState("");
  const [gearPrice, setGearPrice] = useState("");
  const [gearStock, setGearStock] = useState("");
  const [gearCat, setGearCat] = useState("");
  const [gearType, setGearType] = useState("addon");
  const [gearImages, setGearImages] = useState<string[]>([]); // Multiple images
  const [gearInc, setGearInc] = useState<string[]>([]); // Text includes
  const [linkedItems, setLinkedItems] = useState<{ itemId: string; qty: number; variantId?: string; variantLabel?: string; variantColor?: string }[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]); // Files to upload
  
  // NEW: Setup service form state
  const [setupAvailable, setSetupAvailable] = useState(false);
  const [setupFee, setSetupFee] = useState("");
  const [setupDesc, setSetupDesc] = useState("");

  // Specs form state
  const [specSize, setSpecSize] = useState("");
  const [specMaxPax, setSpecMaxPax] = useState("");
  const [specPuRating, setSpecPuRating] = useState("");
  const [specLayers, setSpecLayers] = useState("");
  const [specWeight, setSpecWeight] = useState("");
  const [specTentType, setSpecTentType] = useState("");

  // Variant form state
  const [hasVariants, setHasVariants] = useState(false);
  const [variants, setVariants] = useState<GearVariant[]>([]);

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
  const [showIssuesFor, setShowIssuesFor] = useState<string | null>(null);

  function getItemIssues(g: GearItem): { issue: string; icon: string; critical: boolean }[] {
    const issues: { issue: string; icon: string; critical: boolean }[] = [];
    if (!g.images?.length && !g.img) issues.push({ issue: "No photos", icon: "fa-camera", critical: false });
    if (!g.price || g.price <= 0) issues.push({ issue: "No price", icon: "fa-tag", critical: true });
    if ((g.stock || 0) <= 0 && !g.hasVariants) issues.push({ issue: "Zero stock", icon: "fa-box-open", critical: true });
    if (g.hasVariants && g.variants?.some(v => !v.price || v.price <= 0)) issues.push({ issue: "Variant missing price", icon: "fa-palette", critical: false });
    if (g.hasVariants && g.variants?.some(v => v.stock <= 0)) issues.push({ issue: "Variant zero stock", icon: "fa-palette", critical: true });
    return issues;
  }

  // --- GEAR ACTIONS ---
  function openAddGear() {
    setEditingGear(null);
    setGearName(""); setGearDesc(""); setGearPrice("");
    setGearStock(""); setGearCat(""); setGearType("addon");
    setGearImages([]); setGearInc([]); setLinkedItems([]);
    setPendingFiles([]);
    setSetupAvailable(false); setSetupFee(""); setSetupDesc("");
    setSpecSize(""); setSpecMaxPax(""); setSpecPuRating(""); setSpecLayers(""); setSpecWeight(""); setSpecTentType("");
    setHasVariants(false); setVariants([]);
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
    // Specs fields
    setSpecSize(g.specs?.size || "");
    setSpecMaxPax(g.specs?.maxPax ? String(g.specs.maxPax) : "");
    setSpecPuRating(g.specs?.puRating || "");
    setSpecLayers(g.specs?.layers || "");
    setSpecWeight(g.specs?.weight || "");
    setSpecTentType(g.specs?.tentType || "");
    setHasVariants(g.hasVariants || false);
    setVariants(g.variants || []);
    setShowGearModal(true);
  }

  async function saveGear() {
    if (!gearName.trim()) return showToast("Please enter item name", "error");
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

      // Calculate stock and price from variants if enabled
      const cleanVariants = hasVariants ? variants.filter(v => v.stock > 0 || v.color?.label || v.size) : [];
      const variantStock = cleanVariants.length > 0 ? cleanVariants.reduce((s, v) => s + v.stock, 0) : null;
      const pricedVariants = cleanVariants.filter(v => v.price > 0);
      const variantMinPrice = pricedVariants.length > 0 ? Math.min(...pricedVariants.map(v => v.price)) : null;
      
      const data: any = {
        vendorId, 
        owner_uid: auth.currentUser?.uid,
        category: gearCat || (gearType === "package" ? "Packages" : "Add-ons"), 
        type: gearType,
        name: gearName, 
        desc: gearDesc,
        price: variantMinPrice ?? (Number(gearPrice) || 0), 
        stock: variantStock ?? (Number(gearStock) || 0),
        img: allImages[0] || "",
        images: allImages,
        inc: gearInc.filter(Boolean), 
        deleted: false,
        hasVariants: hasVariants && cleanVariants.length > 0,
        variants: hasVariants && cleanVariants.length > 0 ? cleanVariants : [],
      };
      
      // Add linked items for packages
      if (gearType === "package" && linkedItems.length > 0) {
        data.linkedItems = linkedItems
          .filter(li => li.itemId && li.qty > 0)
          .map(li => ({
            itemId: li.itemId,
            qty: li.qty,
            ...(li.variantId ? { variantId: li.variantId, variantLabel: li.variantLabel, variantColor: li.variantColor } : {}),
          }));
      }
      
      // Add setup service data
      data.setup = {
        available: setupAvailable,
        fee: Number(setupFee) || 0,
        description: setupDesc,
      };

      // Add specs data (only non-empty values)
      const specs: any = {};
      if (specSize.trim()) specs.size = specSize.trim();
      if (specMaxPax && Number(specMaxPax) > 0) specs.maxPax = Number(specMaxPax);
      if (specPuRating.trim()) specs.puRating = specPuRating.trim();
      if (specLayers.trim()) specs.layers = specLayers.trim();
      if (specWeight.trim()) specs.weight = specWeight.trim();
      if (specTentType.trim()) specs.tentType = specTentType.trim();
      data.specs = specs;
      
      if (editingGear) {
        await updateDoc(doc(db, "gear", editingGear.id), data);
      } else {
        await addDoc(collection(db, "gear"), data);
      }
      setShowGearModal(false);
      showToast(editingGear ? "Item updated!" : "Item added!");
    } catch (e) { 
      console.error(e); 
      showToast("Error saving item", "error"); 
    } finally { 
      setUploading(false); 
    }
  }

  async function deleteGear(id: string) {
    if (!confirm("Remove this item?")) return;
    try {
      await updateDoc(doc(db, "gear", id), { deleted: true });
      showToast("Item removed!");
    } catch { showToast("Failed to remove item", "error"); }
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

  function updateLinkedItem(index: number, field: string, value: string | number) {
    setLinkedItems(prev => prev.map((li, i) => {
      if (i !== index) return li;
      if (field === "qty") return { ...li, qty: Number(value) };
      if (field === "itemId") return { itemId: String(value), qty: li.qty }; // reset variant when item changes
      if (field === "variantId") {
        const item = addons.find(a => a.id === li.itemId);
        const variant = item?.variants?.find(v => v.id === value);
        return {
          ...li,
          variantId: String(value) || undefined,
          variantLabel: variant ? [variant.color?.label, variant.size].filter(Boolean).join(", ") : undefined,
          variantColor: variant?.color?.hex || undefined,
        };
      }
      return { ...li, [field]: value };
    }));
  }

  function removeLinkedItem(index: number) {
    setLinkedItems(prev => prev.filter((_, i) => i !== index));
  }

  function addVariant() {
    setVariants(prev => [...prev, {
      id: `v${Date.now()}`,
      color: { label: "", hex: "#062c24" },
      size: "",
      price: Number(gearPrice) || 0,
      stock: 1,
    }]);
  }

  function updateVariant(index: number, updates: Partial<GearVariant>) {
    setVariants(prev => prev.map((v, i) => i === index ? { ...v, ...updates } : v));
  }

  function updateVariantColor(index: number, field: "label" | "hex", value: string) {
    setVariants(prev => prev.map((v, i) =>
      i === index ? { ...v, color: { ...v.color!, [field]: value } } : v
    ));
  }

  function removeVariant(index: number) {
    setVariants(prev => prev.filter((_, i) => i !== index));
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
    try {
      if (editingDisc) {
        await updateDoc(doc(db, "vendors", vendorId, "discounts", editingDisc.id), data);
      } else {
        await addDoc(collection(db, "vendors", vendorId, "discounts"), data);
      }
      setShowDiscModal(false);
      showToast(editingDisc ? "Discount updated!" : "Discount added!");
    } catch { showToast("Failed to save discount", "error"); }
  }

  async function deleteDisc() {
    if (!editingDisc || !confirm("Delete rule?")) return;
    try {
      await updateDoc(doc(db, "vendors", vendorId, "discounts", editingDisc.id), { deleted: true });
      setShowDiscModal(false);
      showToast("Discount deleted!");
    } catch { showToast("Failed to delete discount", "error"); }
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
                {items.map(g => {
                  const issues = getItemIssues(g);
                  const hasCritical = issues.some(i => i.critical);
                  return (
                  <div key={g.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-all group relative">
                    <div className="w-14 h-14 rounded-xl bg-white p-0.5 shadow-sm overflow-hidden flex-shrink-0 relative">
                      <img src={g.images?.[0] || g.img || "/pacak-khemah.png"} className="w-full h-full object-cover rounded-lg" alt={g.name} />
                      {g.setup?.available && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                          <i className="fas fa-tools text-white text-[6px]"></i>
                        </span>
                      )}
                      {/* Issue indicator on thumbnail */}
                      {issues.length > 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowIssuesFor(showIssuesFor === g.id ? null : g.id); }}
                          className={`absolute -bottom-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black shadow-sm ${
                            hasCritical ? "bg-red-500 text-white animate-pulse" : "bg-amber-400 text-white"
                          }`}
                          title={`${issues.length} issue${issues.length > 1 ? "s" : ""}`}
                        >
                          {issues.length}
                        </button>
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
                      {/* Issue details dropdown */}
                      {showIssuesFor === g.id && issues.length > 0 && (
                        <div className="mt-2 bg-white border border-slate-200 rounded-lg p-2 space-y-1 shadow-md">
                          {issues.map((issue, i) => (
                            <div key={i} className={`flex items-center gap-1.5 text-[9px] font-bold ${issue.critical ? "text-red-600" : "text-amber-600"}`}>
                              <i className={`fas ${issue.icon} w-3 text-center`}></i>
                              {issue.issue}
                            </div>
                          ))}
                        </div>
                      )}
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
                  );
                })}
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

              {/* Name */}
              <div>
                <label className={labelCls}>Item Name *</label>
                <input value={gearName} onChange={e => setGearName(e.target.value)} className={inputCls} placeholder="e.g. Naturehike 2P Tent" />
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

              {/* Stock & Price — hidden when variants enabled */}
              {!hasVariants && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Total Stock *</label>
                    <input type="number" value={gearStock} onChange={e => setGearStock(e.target.value)} className={inputCls} placeholder="e.g. 5" />
                    <p className={helperCls}>How many you own</p>
                  </div>
                  <div>
                    <label className={labelCls}>Price (RM/night) *</label>
                    <input type="number" value={gearPrice} onChange={e => setGearPrice(e.target.value)} className={inputCls} placeholder="e.g. 50" />
                  </div>
                </div>
              )}

              {/* Variants Toggle */}
              <div className={`p-4 rounded-xl border transition-all ${hasVariants ? "bg-teal-50 border-teal-200" : "bg-slate-50 border-slate-100"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="text-[10px] font-black text-teal-700 uppercase flex items-center gap-2">
                      <i className="fas fa-palette"></i> Colour / Size Variants
                    </label>
                    <p className="text-[9px] text-teal-600">Different colours or sizes with individual stock and pricing</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={hasVariants}
                    onChange={e => setHasVariants(e.target.checked)}
                    className="w-5 h-5 accent-teal-500"
                  />
                </div>

                {hasVariants && (
                  <div className="space-y-3 pt-3 border-t border-teal-100">
                    {variants.length === 0 ? (
                      <p className="text-[10px] text-teal-400 text-center py-2">No variants yet. Add your first one below.</p>
                    ) : (
                      variants.map((v, i) => (
                        <div key={v.id} className="bg-white rounded-xl p-3 border border-teal-100 space-y-2.5">
                          {/* Colour row */}
                          <div className="flex gap-2 items-center">
                            <input
                              type="color"
                              value={v.color?.hex || "#062c24"}
                              onChange={e => updateVariantColor(i, "hex", e.target.value)}
                              className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                            />
                            <input
                              value={v.color?.label || ""}
                              onChange={e => updateVariantColor(i, "label", e.target.value)}
                              className="flex-1 bg-slate-50 border border-slate-200 p-2 rounded-lg text-xs font-semibold outline-none focus:border-teal-400"
                              placeholder="Colour name (e.g. Army Green)"
                            />
                            <button onClick={() => removeVariant(i)} className="text-red-400 hover:text-red-600 p-1">
                              <i className="fas fa-times"></i>
                            </button>
                          </div>
                          {/* Size + Price + Stock row */}
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-[8px] font-bold text-slate-400 uppercase mb-0.5 block">Size</label>
                              <input
                                value={v.size || ""}
                                onChange={e => updateVariant(i, { size: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-xs font-semibold outline-none focus:border-teal-400"
                                placeholder="S / M / L"
                              />
                            </div>
                            <div>
                              <label className="text-[8px] font-bold text-slate-400 uppercase mb-0.5 block">Price (RM)</label>
                              <input
                                type="number"
                                value={v.price || ""}
                                onChange={e => updateVariant(i, { price: Number(e.target.value) || 0 })}
                                className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-xs font-semibold outline-none focus:border-teal-400"
                                placeholder="170"
                              />
                            </div>
                            <div>
                              <label className="text-[8px] font-bold text-slate-400 uppercase mb-0.5 block">Stock</label>
                              <input
                                type="number"
                                value={v.stock || ""}
                                onChange={e => updateVariant(i, { stock: Number(e.target.value) || 0 })}
                                className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-xs font-semibold outline-none focus:border-teal-400"
                                placeholder="2"
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                    <button onClick={addVariant}
                      className="w-full py-2.5 rounded-xl text-[10px] font-black uppercase border-2 border-dashed border-teal-300 text-teal-600 hover:bg-teal-50 transition-all">
                      <i className="fas fa-plus mr-1"></i> Add Variant
                    </button>

                    {/* Auto-calculated summary */}
                    {variants.length > 0 && (
                      <div className="bg-teal-100/50 rounded-lg p-2.5 flex justify-between text-[10px] font-bold text-teal-700">
                        <span>Total Stock: {variants.reduce((s, v) => s + v.stock, 0)}</span>
                        {variants.some(v => v.price > 0) && (
                          <span>
                            Price: RM{Math.min(...variants.filter(v => v.price > 0).map(v => v.price))}
                            {Math.min(...variants.filter(v => v.price > 0).map(v => v.price)) !== Math.max(...variants.filter(v => v.price > 0).map(v => v.price))
                              ? ` – RM${Math.max(...variants.filter(v => v.price > 0).map(v => v.price))}`
                              : ""}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
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

              {/* Specifications */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2 mb-3">
                  <i className="fas fa-ruler-combined"></i> Specifications <span className="text-[8px] font-normal text-slate-400 normal-case">(optional)</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Size / Dimensions</label>
                    <input value={specSize} onChange={e => setSpecSize(e.target.value)}
                      className="w-full bg-white border border-slate-200 p-2.5 rounded-lg text-xs font-semibold outline-none focus:border-emerald-400"
                      placeholder="e.g. 300×250cm" />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Max Pax</label>
                    <input type="number" value={specMaxPax} onChange={e => setSpecMaxPax(e.target.value)} min="0"
                      className="w-full bg-white border border-slate-200 p-2.5 rounded-lg text-xs font-semibold outline-none focus:border-emerald-400"
                      placeholder="e.g. 4" />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">PU Rating</label>
                    <input value={specPuRating} onChange={e => setSpecPuRating(e.target.value)}
                      className="w-full bg-white border border-slate-200 p-2.5 rounded-lg text-xs font-semibold outline-none focus:border-emerald-400"
                      placeholder="e.g. PU3000" />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Layer Type</label>
                    <select value={specLayers} onChange={e => setSpecLayers(e.target.value)}
                      className="w-full bg-white border border-slate-200 p-2.5 rounded-lg text-xs font-semibold outline-none focus:border-emerald-400">
                      <option value="">Not specified</option>
                      <option value="Single Layer">Single Layer</option>
                      <option value="Double Layer">Double Layer</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Tent Type</label>
                    <select value={specTentType} onChange={e => setSpecTentType(e.target.value)}
                      className="w-full bg-white border border-slate-200 p-2.5 rounded-lg text-xs font-semibold outline-none focus:border-emerald-400">
                      <option value="">Not specified</option>
                      <option value="Auto Tent">Auto Tent</option>
                      <option value="Manual Tent">Manual Tent</option>
                      <option value="Air Tent">Air Tent</option>
                      <option value="Shelter">Shelter</option>
                      <option value="Dome Tent">Dome Tent</option>
                      <option value="Cabin Tent">Cabin Tent</option>
                      <option value="Teepee">Teepee</option>
                      <option value="Hammock Tent">Hammock Tent</option>
                      <option value="Flysheet">Flysheet</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Weight</label>
                    <input value={specWeight} onChange={e => setSpecWeight(e.target.value)}
                      className="w-full bg-white border border-slate-200 p-2.5 rounded-lg text-xs font-semibold outline-none focus:border-emerald-400"
                      placeholder="e.g. 8.5kg" />
                  </div>
                </div>
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
                      {linkedItems.map((li, i) => {
                        const selectedAddon = addons.find(a => a.id === li.itemId);
                        const hasVars = selectedAddon?.hasVariants && selectedAddon.variants && selectedAddon.variants.length > 0;
                        return (
                          <div key={i} className="bg-white p-2.5 rounded-lg border border-purple-100 space-y-2">
                            <div className="flex gap-2 items-center">
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
                            {/* Variant picker - shown when linked item has variants */}
                            {hasVars && (
                              <div className="flex items-center gap-2 pl-1">
                                <span className="text-[8px] font-bold text-purple-500 uppercase shrink-0">Variant:</span>
                                <div className="flex gap-1.5 flex-wrap flex-1">
                                  {selectedAddon!.variants!.map(v => {
                                    const label = [v.color?.label, v.size].filter(Boolean).join(", ");
                                    const isActive = li.variantId === v.id;
                                    return (
                                      <button
                                        key={v.id}
                                        onClick={() => updateLinkedItem(i, "variantId", isActive ? "" : v.id)}
                                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-bold border transition-all ${
                                          isActive ? "border-purple-600 bg-purple-600 text-white" : "border-slate-200 text-slate-600 hover:border-purple-300"
                                        }`}
                                      >
                                        {v.color?.hex && <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/30" style={{ backgroundColor: v.color.hex }}></span>}
                                        {label || `RM${v.price}`} ({v.stock})
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            {/* Show locked variant label */}
                            {li.variantLabel && (
                              <p className="text-[8px] font-bold text-teal-600 pl-1">
                                <i className="fas fa-lock text-[7px] mr-1"></i>Locked: {li.variantLabel}
                              </p>
                            )}
                          </div>
                        );
                      })}
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

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[500] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-white text-[10px] font-black uppercase tracking-widest ${
          toast.type === "success" ? "bg-emerald-600" : "bg-red-500"
        }`} style={{ animation: "toastIn 0.3s ease-out" }}>
          <i className={`fas ${toast.type === "success" ? "fa-check-circle" : "fa-exclamation-circle"}`}></i>
          {toast.msg}
        </div>
      )}
      <style>{`@keyframes toastIn { from { opacity: 0; transform: translate(-50%, 20px); } to { opacity: 1; transform: translate(-50%, 0); } }`}</style>
    </div>
  );
}