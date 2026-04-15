"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

type StorefrontTabProps = {
  vendorId: string;
  vendorData: {
    name?: string; tagline?: string; tagline_my?: string;
    image?: string; ig?: string; tiktok?: string; fb?: string; threads?: string; phone?: string;
    show_nav?: boolean; city?: string; pickup?: string[]; areas?: string[];
    steps?: { title: string; my: string; desc?: string; desc_my?: string }[];
    rating?: number; reviewCount?: number;
  };
};

type Step = { title: string; my: string; desc: string; desc_my: string };

const DEFAULT_STEPS: Step[] = [
  { title: "Select Dates", my: "Pilih Tarikh", desc: "Choose pickup and return dates", desc_my: "Pilih tarikh ambil dan pulang" },
  { title: "Pick Gear", my: "Pilih Barang", desc: "Add items to your cart", desc_my: "Tambah barang ke troli" },
  { title: "WhatsApp Us", my: "Hubungi Kami", desc: "Send order to confirm", desc_my: "Hantar pesanan untuk sahkan" },
];

export default function StorefrontTab({ vendorId, vendorData }: StorefrontTabProps) {
  const [tagline, setTagline] = useState(vendorData.tagline || "");
  const [taglineMy, setTaglineMy] = useState(vendorData.tagline_my || "");
  const [ig, setIg] = useState(vendorData.ig || "");
  const [tiktok, setTiktok] = useState(vendorData.tiktok || "");
  const [fb, setFb] = useState(vendorData.fb || "");
  const [threads, setThreads] = useState(vendorData.threads || "");
  const [phone, setPhone] = useState(vendorData.phone || "");
  const [showNav, setShowNav] = useState(vendorData.show_nav !== false);
  const [logoUrl, setLogoUrl] = useState(vendorData.image || "");
  const [city, setCity] = useState(vendorData.city || "");
  const [pickup, setPickup] = useState(vendorData.pickup?.join(", ") || "");
  const [areas, setAreas] = useState(vendorData.areas?.join(", ") || "");
  const [steps, setSteps] = useState<Step[]>(vendorData.steps?.length ? vendorData.steps as Step[] : DEFAULT_STEPS);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  function showToast(msg: string, type: "success" | "error" = "success") { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); }
  const [activeTab, setActiveTab] = useState<"visuals" | "location" | "steps">("visuals");
  const [previewAboutOpen, setPreviewAboutOpen] = useState(false);
  const [previewHowToOpen, setPreviewHowToOpen] = useState(false);
  const [gearCount, setGearCount] = useState(0);

  useEffect(() => {
    async function loadGearCount() {
      try {
        const q = query(collection(db, "gear"), where("vendorId", "==", vendorId));
        const snap = await getDocs(q);
        setGearCount(snap.docs.filter(d => !d.data().deleted).length);
      } catch (e) { console.log(e); }
    }
    loadGearCount();
  }, [vendorId]);

  const MAX_FILE_MB = 5;
  const MAX_FILE_SIZE = MAX_FILE_MB * 1024 * 1024;

  async function handleLogoUpload(file: File) {
    if (file.size > MAX_FILE_SIZE) {
      showToast(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max ${MAX_FILE_MB}MB.`, "error");
      return;
    }
    setUploadingLogo(true);
    try {
      const storage = getStorage();
      const snap = await uploadBytes(ref(storage, "logos/" + vendorId), file);
      const url = await getDownloadURL(snap.ref);
      setLogoUrl(url);
      showToast("Logo uploaded!");
    } catch (e) { console.error(e); showToast("Upload failed", "error"); }
    finally { setUploadingLogo(false); }
  }

  async function saveAll() {
    setSaving(true);
    try {
      await updateDoc(doc(db, "vendors", vendorId), {
        show_nav: showNav, image: logoUrl, tagline, tagline_my: taglineMy,
        ig, tiktok, fb, threads, phone, city,
        pickup: pickup.split(",").map(p => p.trim()).filter(Boolean),
        areas: areas.split(",").map(a => a.trim()).filter(Boolean),
        steps,
      });
      setSaved(true);
      showToast("Storefront saved!");
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error(e); showToast("Failed to save", "error"); }
    finally { setSaving(false); }
  }

  function updateStep(index: number, field: keyof Step, value: string) {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  }
  function removeStep(index: number) { setSteps(prev => prev.filter((_, i) => i !== index)); }
  function addStep() { setSteps(prev => [...prev, { title: "", my: "", desc: "", desc_my: "" }]); }

  const rating = vendorData.rating || 0;
  const reviewCount = vendorData.reviewCount || 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* LIVE PREVIEW */}
      <div className="order-1 lg:order-2">
        <div className="sticky top-24">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 text-center">
            <i className="fas fa-mobile-alt mr-1"></i> Live Preview
          </p>
          <div className="mx-auto w-full max-w-[320px] bg-slate-900 rounded-[2.5rem] p-2 shadow-2xl">
            <div className="bg-[#f0f2f1] rounded-[2rem] overflow-hidden" style={{ minHeight: "580px" }}>
              {/* Preview Header */}
              <div className="bg-[#062c24] text-white relative overflow-hidden">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "url('/pattern-chevron.png')", backgroundSize: "200px" }} />
                <div className="absolute inset-0 bg-gradient-to-b from-[#062c24] via-[#062c24]/50 to-[#062c24]/90" />
                {showNav && (
                  <div className="relative z-10 flex justify-between items-center px-3 pt-3">
                    <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center"><i className="fas fa-arrow-left text-[8px]"></i></div>
                    <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center"><i className="fas fa-share-alt text-[8px]"></i></div>
                  </div>
                )}
                <div className="relative z-10 flex flex-col items-center text-center px-4 pt-4 pb-4">
                  <div className="w-14 h-14 bg-white rounded-xl p-0.5 shadow-lg mb-2">
                    <img src={logoUrl || "/pacak-khemah.png"} className="w-full h-full object-cover rounded-[0.6rem]" alt="logo" />
                  </div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <h1 className="text-sm font-black uppercase tracking-tight">{vendorData.name || "Your Shop"}</h1>
                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded text-[6px] font-black uppercase">
                      <i className="fas fa-check-circle mr-0.5"></i>Verified
                    </span>
                  </div>
                  {reviewCount > 0 && (
                    <div className="bg-orange-500/20 text-orange-300 border border-orange-500/30 px-2 py-1 rounded-lg text-[7px] font-black uppercase flex items-center gap-1 mb-2">
                      <i className="fas fa-fire"></i><span>{rating.toFixed(1)}</span><span className="text-orange-200/60">({reviewCount})</span>
                    </div>
                  )}
                  <div className="flex flex-wrap justify-center gap-1.5 text-[7px] font-bold uppercase mb-2">
                    {(pickup || city) && <span className="bg-white/10 px-2 py-1 rounded-full border border-white/10"><i className="fas fa-truck text-emerald-400 mr-1"></i>{pickup || city || "Location"}</span>}
                    {areas && <span className="bg-white/10 px-2 py-1 rounded-full border border-white/10"><i className="fas fa-map text-emerald-400 mr-1"></i>{areas}</span>}
                  </div>
                  <div className="flex gap-1.5">
                    {phone && <div className="w-6 h-6 bg-white/10 rounded-lg flex items-center justify-center border border-white/10"><i className="fab fa-whatsapp text-[8px]"></i></div>}
                    {tiktok && <div className="w-6 h-6 bg-white/10 rounded-lg flex items-center justify-center border border-white/10"><i className="fab fa-tiktok text-[8px]"></i></div>}
                    {ig && <div className="w-6 h-6 bg-white/10 rounded-lg flex items-center justify-center border border-white/10"><i className="fab fa-instagram text-[8px]"></i></div>}
                    {threads && <div className="w-6 h-6 bg-white/10 rounded-lg flex items-center justify-center border border-white/10"><i className="fab fa-threads text-[8px]"></i></div>}
                    {fb && <div className="w-6 h-6 bg-white/10 rounded-lg flex items-center justify-center border border-white/10"><i className="fab fa-facebook text-[8px]"></i></div>}
                  </div>
                </div>
              </div>
              {/* Preview Content */}
              <div className="p-3 space-y-2">
                <div className="flex bg-white rounded-xl p-1 border border-slate-100 shadow-sm">
                  <div className="flex-1 py-2 rounded-lg bg-[#062c24] text-white text-center"><p className="text-[7px] font-black uppercase">Gear</p></div>
                  <div className="flex-1 py-2 text-center text-slate-400"><p className="text-[7px] font-black uppercase">Updates</p></div>
                  <div className="flex-1 py-2 text-center text-slate-400"><p className="text-[7px] font-black uppercase">Reviews</p></div>
                </div>
                {(tagline || taglineMy) && (
                  <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                    <button onClick={() => setPreviewAboutOpen(!previewAboutOpen)} className="w-full flex items-center justify-between p-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 bg-emerald-50 text-emerald-600 rounded flex items-center justify-center"><i className="fas fa-info-circle text-[8px]"></i></div>
                        <span className="text-[8px] font-black text-[#062c24] uppercase">About Us</span>
                      </div>
                      <i className={`fas fa-chevron-down text-slate-300 text-[8px] transition-transform ${previewAboutOpen ? "rotate-180" : ""}`}></i>
                    </button>
                    {previewAboutOpen && (
                      <div className="px-2.5 pb-2.5 space-y-1">
                        {tagline && <p className="text-[8px] text-slate-600 leading-relaxed">{tagline}</p>}
                        {taglineMy && <p className="text-[8px] text-emerald-600 italic leading-relaxed">{taglineMy}</p>}
                      </div>
                    )}
                  </div>
                )}
                {steps.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                    <button onClick={() => setPreviewHowToOpen(!previewHowToOpen)} className="w-full flex items-center justify-between p-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 bg-emerald-50 text-emerald-600 rounded flex items-center justify-center"><i className="fas fa-list-ol text-[8px]"></i></div>
                        <span className="text-[8px] font-black text-[#062c24] uppercase">How to Rent?</span>
                      </div>
                      <i className={`fas fa-chevron-down text-slate-300 text-[8px] transition-transform ${previewHowToOpen ? "rotate-180" : ""}`}></i>
                    </button>
                    {previewHowToOpen && (
                      <div className="px-2.5 pb-2.5 space-y-1.5">
                        {steps.slice(0, 3).map((step, i) => (
                          <div key={i} className="flex gap-2 items-start p-1.5 bg-slate-50 rounded-lg">
                            <div className="w-4 h-4 bg-emerald-100 text-emerald-600 rounded flex items-center justify-center text-[7px] font-black shrink-0">{i + 1}</div>
                            <div>
                              <p className="text-[7px] font-black text-[#062c24] uppercase leading-tight">{step.title || "Step"} {step.my && <span className="text-emerald-600 font-bold ml-1">{step.my}</span>}</p>
                              {step.desc && <p className="text-[6px] text-slate-400 mt-0.5">{step.desc}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-2.5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 bg-emerald-50 text-emerald-600 rounded flex items-center justify-center"><i className="fas fa-campground text-[8px]"></i></div>
                    <span className="text-[8px] font-black text-[#062c24] uppercase">Pick Your Gear</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[1, 2, 3].map(i => (<div key={i} className="aspect-square bg-slate-100 rounded-lg flex items-center justify-center"><i className="fas fa-image text-slate-300 text-sm"></i></div>))}
                  </div>
                  {gearCount > 0 && <p className="text-[7px] text-slate-400 text-center mt-2">{gearCount} items in inventory</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* EDITOR PANEL */}
      <div className="order-2 lg:order-1 space-y-4">
        <div className="flex bg-white rounded-xl p-1 border border-slate-100">
          {([{ id: "visuals" as const, label: "Branding", icon: "fa-palette" }, { id: "location" as const, label: "Location", icon: "fa-map-marker-alt" }, { id: "steps" as const, label: "How to Rent", icon: "fa-list-ol" }]).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-black uppercase transition-all ${activeTab === tab.id ? "bg-[#062c24] text-white" : "text-slate-400 hover:text-slate-600"}`}>
              <i className={`fas ${tab.icon} text-[10px]`}></i><span>{tab.label}</span>
            </button>
          ))}
        </div>

        {activeTab === "visuals" && (
          <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-5">
            <h3 className="text-sm font-black text-[#062c24] uppercase">Branding & Socials</h3>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Shop Logo</label>
              <label className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                <div className="w-16 h-16 bg-white rounded-xl p-1 shadow-sm shrink-0">
                  {uploadingLogo ? <div className="w-full h-full flex items-center justify-center"><i className="fas fa-spinner fa-spin text-slate-400"></i></div> : <img src={logoUrl || "/pacak-khemah.png"} className="w-full h-full object-cover rounded-lg" alt="logo" />}
                </div>
                <div><p className="text-xs font-bold text-slate-600">Click to upload new logo</p><p className="text-[10px] text-slate-400">Square image recommended</p></div>
                <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} />
              </label>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block">About Us (English)</label>
                <textarea value={tagline} onChange={e => setTagline(e.target.value)} rows={2} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-emerald-300 resize-none" placeholder="Describe your shop in English..." />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block">About Us (Malay)</label>
                <textarea value={taglineMy} onChange={e => setTaglineMy(e.target.value)} rows={2} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-emerald-300 resize-none text-emerald-700 italic" placeholder="Terangkan kedai anda dalam Bahasa Melayu..." />
              </div>
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Social Media Links</label>
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center gap-2"><div className="w-9 h-9 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center shrink-0"><i className="fab fa-whatsapp"></i></div><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="WhatsApp number (e.g. 60123456789)" className="flex-1 bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs outline-none focus:border-emerald-300" /></div>
                <div className="flex items-center gap-2"><div className="w-9 h-9 bg-pink-100 text-pink-600 rounded-lg flex items-center justify-center shrink-0"><i className="fab fa-instagram"></i></div><input value={ig} onChange={e => setIg(e.target.value)} placeholder="Instagram URL" className="flex-1 bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs outline-none focus:border-emerald-300" /></div>
                <div className="flex items-center gap-2"><div className="w-9 h-9 bg-slate-800 text-white rounded-lg flex items-center justify-center shrink-0"><i className="fab fa-tiktok"></i></div><input value={tiktok} onChange={e => setTiktok(e.target.value)} placeholder="TikTok URL" className="flex-1 bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs outline-none focus:border-emerald-300" /></div>
                <div className="flex items-center gap-2"><div className="w-9 h-9 bg-slate-200 text-slate-600 rounded-lg flex items-center justify-center shrink-0"><i className="fab fa-threads"></i></div><input value={threads} onChange={e => setThreads(e.target.value)} placeholder="Threads URL" className="flex-1 bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs outline-none focus:border-emerald-300" /></div>
                <div className="flex items-center gap-2"><div className="w-9 h-9 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center shrink-0"><i className="fab fa-facebook"></i></div><input value={fb} onChange={e => setFb(e.target.value)} placeholder="Facebook URL" className="flex-1 bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs outline-none focus:border-emerald-300" /></div>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div><p className="text-xs font-bold text-slate-700">Show Navigation</p><p className="text-[10px] text-slate-400">Back & share buttons on shop page</p></div>
              <input type="checkbox" checked={showNav} onChange={e => setShowNav(e.target.checked)} className="w-5 h-5 accent-emerald-500" />
            </div>
          </div>
        )}

        {activeTab === "location" && (
          <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-5">
            <h3 className="text-sm font-black text-[#062c24] uppercase">Location & Coverage</h3>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block">City</label>
              <input value={city} onChange={e => setCity(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-emerald-300" placeholder="e.g. Shah Alam" />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block">Pickup Points</label>
              <input value={pickup} onChange={e => setPickup(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-emerald-300" placeholder="e.g. Shah Alam, Subang Jaya (comma separated)" />
              <p className="text-[10px] text-slate-400 mt-1">Where customers can pickup gear</p>
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block">Areas Covered</label>
              <input value={areas} onChange={e => setAreas(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-emerald-300" placeholder="e.g. Selangor, KL, Negeri Sembilan (comma separated)" />
              <p className="text-[10px] text-slate-400 mt-1">Regions you can deliver to or serve</p>
            </div>
          </div>
        )}

        {activeTab === "steps" && (
          <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-black text-[#062c24] uppercase">How to Rent Steps</h3>
              <button onClick={addStep} className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100">+ Add Step</button>
            </div>
            <div className="space-y-3">
              {steps.map((step, i) => (
                <div key={i} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <span className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center text-xs font-black">{i + 1}</span>
                    <button onClick={() => removeStep(i)} className="text-slate-300 hover:text-red-400 transition-colors"><i className="fas fa-trash text-sm"></i></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input value={step.title} onChange={e => updateStep(i, "title", e.target.value)} placeholder="Title (EN)" className="w-full bg-white border border-slate-200 p-2 rounded-lg text-xs font-bold outline-none focus:border-emerald-300" />
                    <input value={step.my} onChange={e => updateStep(i, "my", e.target.value)} placeholder="Title (MY)" className="w-full bg-white border border-slate-200 p-2 rounded-lg text-xs text-emerald-600 outline-none focus:border-emerald-300" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={step.desc} onChange={e => updateStep(i, "desc", e.target.value)} placeholder="Description (EN)" className="w-full bg-white border border-slate-200 p-2 rounded-lg text-[10px] outline-none focus:border-emerald-300" />
                    <input value={step.desc_my} onChange={e => updateStep(i, "desc_my", e.target.value)} placeholder="Description (MY)" className="w-full bg-white border border-slate-200 p-2 rounded-lg text-[10px] italic outline-none focus:border-emerald-300" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={saveAll} disabled={saving} className={`w-full py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg transition-all ${saved ? "bg-emerald-500 text-white" : "bg-[#062c24] text-white hover:bg-emerald-800"} disabled:opacity-50`}>
          {saving ? <><i className="fas fa-spinner fa-spin mr-2"></i>Saving...</> : saved ? "Saved!" : "Save All Changes"}
        </button>
      </div>

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