"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

type StorefrontTabProps = {
  vendorId: string;
  vendorData: {
    name?: string; tagline?: string; tagline_my?: string;
    image?: string; ig?: string; tiktok?: string; fb?: string;
    show_nav?: boolean;
    steps?: { title: string; my: string; desc?: string; desc_my?: string }[];
  };
};

type Step = { title: string; my: string; desc: string; desc_my: string };

const DEFAULT_STEPS: Step[] = [
  { title: "Select Dates", my: "Pilih Tarikh", desc: "Choose check-in/out", desc_my: "Pilih tarikh masuk/keluar" },
  { title: "Pick Gear", my: "Pilih Barang", desc: "Add items to cart", desc_my: "Tambah barang ke troli" },
  { title: "WhatsApp", my: "Hubungi Kami", desc: "Send order to verify", desc_my: "Hantar pesanan untuk sahkan" },
];

export default function StorefrontTab({ vendorId, vendorData }: StorefrontTabProps) {
  const [tagline, setTagline] = useState(vendorData.tagline || "");
  const [taglineMy, setTaglineMy] = useState(vendorData.tagline_my || "");
  const [ig, setIg] = useState(vendorData.ig || "");
  const [tiktok, setTiktok] = useState(vendorData.tiktok || "");
  const [fb, setFb] = useState(vendorData.fb || "");
  const [showNav, setShowNav] = useState(vendorData.show_nav !== false);
  const [logoUrl, setLogoUrl] = useState(vendorData.image || "");
  const [steps, setSteps] = useState<Step[]>(
    vendorData.steps?.length ? vendorData.steps as Step[] : DEFAULT_STEPS
  );
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savedVisuals, setSavedVisuals] = useState(false);
  const [savedSteps, setSavedSteps] = useState(false);

  async function handleLogoUpload(file: File) {
    setUploadingLogo(true);
    try {
      const storage = getStorage();
      const snap = await uploadBytes(ref(storage, `logos/${vendorId}`), file);
      const url = await getDownloadURL(snap.ref);
      setLogoUrl(url);
    } catch (e) { console.error(e); alert("Upload failed."); }
    finally { setUploadingLogo(false); }
  }

  async function saveStorefront() {
    await updateDoc(doc(db, "vendors", vendorId), {
      show_nav: showNav, image: logoUrl,
      tagline, tagline_my: taglineMy, ig, tiktok, fb,
    });
    setSavedVisuals(true);
    setTimeout(() => setSavedVisuals(false), 2000);
  }

  async function saveSteps() {
    await updateDoc(doc(db, "vendors", vendorId), { steps });
    setSavedSteps(true);
    setTimeout(() => setSavedSteps(false), 2000);
  }

  function updateStep(index: number, field: keyof Step, value: string) {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  }

  function removeStep(index: number) {
    setSteps(prev => prev.filter((_, i) => i !== index));
  }

  function addStep() {
    setSteps(prev => [...prev, { title: "", my: "", desc: "", desc_my: "" }]);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

      {/* Live Preview + Visuals Editor */}
      <div className="lg:col-span-5 bg-[#062c24] rounded-[3rem] p-8 text-center relative overflow-hidden shadow-2xl group">
        {/* Background */}
        {logoUrl && (
          <div className="absolute inset-0 bg-cover bg-center opacity-30 transition-all duration-700 group-hover:scale-105"
            style={{ backgroundImage: `url(${logoUrl})` }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#062c24] via-[#062c24]/60 to-transparent" />

        <div className="relative z-10 flex flex-col items-center">
          <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-4">Live Preview</span>

          {/* Logo Upload */}
          <label className="w-24 h-24 bg-white p-1 rounded-[2rem] shadow-xl mb-6 hover:scale-105 transition-transform relative cursor-pointer group/logo block">
            {uploadingLogo ? (
              <div className="w-full h-full rounded-[1.8rem] flex items-center justify-center bg-slate-100">
                <i className="fas fa-spinner fa-spin text-slate-400"></i>
              </div>
            ) : (
              <img src={logoUrl || "/pacak-khemah.png"} className="w-full h-full object-cover rounded-[1.8rem]" alt="logo" />
            )}
            <div className="absolute inset-0 bg-black/20 rounded-[2rem] flex items-center justify-center opacity-0 group-hover/logo:opacity-100 transition-opacity">
              <i className="fas fa-camera text-white"></i>
            </div>
            <input type="file" accept="image/*" className="hidden"
              onChange={e => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} />
          </label>

          {/* Tagline Inputs */}
          <div className="space-y-3 w-full mb-8">
            <input value={tagline} onChange={e => setTagline(e.target.value)}
              className="w-full bg-white/10 border border-white/20 p-3 rounded-xl text-center text-white text-xs font-black uppercase tracking-widest placeholder:text-white/30 focus:bg-white/20 outline-none"
              placeholder="ENGLISH TAGLINE" />
            <input value={taglineMy} onChange={e => setTaglineMy(e.target.value)}
              className="w-full bg-white/10 border border-white/20 p-3 rounded-xl text-center text-emerald-300 text-[10px] font-bold uppercase tracking-widest italic placeholder:text-emerald-500/50 focus:bg-white/20 outline-none"
              placeholder="MALAY TAGLINE" />
          </div>

          {/* Social Links */}
          <div className="grid grid-cols-3 gap-2 w-full mb-8">
            <input value={ig} onChange={e => setIg(e.target.value)}
              className="bg-black/30 border-none rounded-lg p-2 text-center text-white text-[9px] focus:ring-1 focus:ring-emerald-400 outline-none"
              placeholder="Instagram URL" />
            <input value={tiktok} onChange={e => setTiktok(e.target.value)}
              className="bg-black/30 border-none rounded-lg p-2 text-center text-white text-[9px] focus:ring-1 focus:ring-emerald-400 outline-none"
              placeholder="TikTok URL" />
            <input value={fb} onChange={e => setFb(e.target.value)}
              className="bg-black/30 border-none rounded-lg p-2 text-center text-white text-[9px] focus:ring-1 focus:ring-emerald-400 outline-none"
              placeholder="Facebook URL" />
          </div>

          {/* Show Nav Toggle */}
          <div className="flex items-center justify-between w-full bg-black/20 p-3 rounded-xl mb-6 border border-white/10">
            <span className="text-[9px] font-bold text-white uppercase text-left">
              Show Nav Buttons<br />
              <span className="text-[8px] opacity-60">Back & Login Icons</span>
            </span>
            <input type="checkbox" checked={showNav} onChange={e => setShowNav(e.target.checked)}
              className="w-5 h-5 accent-emerald-500 rounded cursor-pointer" />
          </div>

          <button onClick={saveStorefront}
            className={`w-full py-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg transition-all ${savedVisuals ? "bg-emerald-400 text-white" : "bg-white text-[#062c24] hover:bg-emerald-50"}`}>
            {savedVisuals ? "✓ Saved!" : "Save Visuals"}
          </button>
        </div>
      </div>

      {/* Steps Editor */}
      <div className="lg:col-span-7 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col h-full">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-black text-[#062c24] uppercase">"How to Rent" Steps</h3>
          <button onClick={addStep}
            className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors">
            + Add Step
          </button>
        </div>

        <div className="space-y-3 flex-1 overflow-y-auto pr-2" style={{ scrollbarWidth: "none" }}>
          {steps.map((step, i) => (
            <div key={i} className="flex gap-2 items-start bg-slate-50 p-4 rounded-xl border border-slate-100 group">
              <div className="flex-1 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input value={step.title} onChange={e => updateStep(i, "title", e.target.value)}
                    placeholder="Title (EN)"
                    className="w-full bg-white border border-slate-200 p-2 rounded-lg text-[10px] font-bold outline-none focus:border-emerald-300" />
                  <input value={step.my} onChange={e => updateStep(i, "my", e.target.value)}
                    placeholder="Title (MY)"
                    className="w-full bg-white border border-slate-200 p-2 rounded-lg text-[10px] font-medium text-emerald-600 outline-none focus:border-emerald-300" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input value={step.desc} onChange={e => updateStep(i, "desc", e.target.value)}
                    placeholder="Desc (EN)"
                    className="w-full bg-white border border-slate-200 p-2 rounded-lg text-[9px] outline-none focus:border-emerald-300" />
                  <input value={step.desc_my} onChange={e => updateStep(i, "desc_my", e.target.value)}
                    placeholder="Desc (MY)"
                    className="w-full bg-white border border-slate-200 p-2 rounded-lg text-[9px] italic outline-none focus:border-emerald-300" />
                </div>
              </div>
              <button onClick={() => removeStep(i)}
                className="text-slate-300 hover:text-red-400 p-2 transition-colors self-center">
                <i className="fas fa-trash"></i>
              </button>
            </div>
          ))}
        </div>

        <button onClick={saveSteps}
          className={`w-full mt-6 py-4 rounded-xl font-black uppercase text-[10px] transition-colors ${savedSteps ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
          {savedSteps ? "✓ Saved!" : "Save Steps Configuration"}
        </button>
      </div>
    </div>
  );
}