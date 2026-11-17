"use client";

import { useState } from "react";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  type VendorSettings, type RentStep, DEFAULT_STEPS, cleanSlug, socialSummary, stepsSummary,
} from "@/lib/vendorSettings";
import { Card, H2, Field, Section, SwitchRow, inputCls, hintCls, smallBtn, labelCls } from "./ui";

type Props = {
  vendorId: string;
  v: VendorSettings;
  set: (fields: Partial<VendorSettings>) => void;
  openSection: string | null;
  setOpenSection: (s: string | null) => void;
  toast: (msg: string, type?: "success" | "error") => void;
};

const MAX_LOGO_MB = 5;

export default function StorefrontGroup({ vendorId, v, set, openSection, setOpenSection, toast }: Props) {
  const [uploading, setUploading] = useState(false);
  const [slugDraft, setSlugDraft] = useState(v.slug || "");
  const toggle = (s: string) => setOpenSection(openSection === s ? null : s);
  const steps: RentStep[] = v.steps?.length ? v.steps : DEFAULT_STEPS;
  const shopUrl = v.slug ? `/shop/${v.slug}` : `/shop?v=${vendorId}`;

  async function uploadLogo(file: File) {
    if (file.size > MAX_LOGO_MB * 1024 * 1024) { toast(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_LOGO_MB} MB.`, "error"); return; }
    setUploading(true);
    try {
      const snap = await uploadBytes(ref(getStorage(), "logos/" + vendorId), file);
      const url = await getDownloadURL(snap.ref);
      set({ image: url });
    } catch (e) { console.error(e); toast("Upload failed", "error"); }
    finally { setUploading(false); }
  }

  function updateStep(i: number, field: keyof RentStep, value: string) {
    set({ steps: steps.map((s, idx) => idx === i ? { ...s, [field]: value } : s) });
  }

  return (
    <>
      {/* Identity */}
      <Card>
        <H2>Shop identity</H2>
        <div className="flex items-center gap-3.5">
          {v.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.image} alt="Shop logo" className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0" aria-hidden="true">
              <i className="fas fa-campground text-2xl"></i>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Shop logo</span>
            <label className={`${smallBtn} inline-flex items-center cursor-pointer self-start ${uploading ? "opacity-60" : ""}`}>
              {uploading ? "Uploading" : v.image ? "Change logo" : "Upload logo"}
              <input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
            </label>
            <span className={hintCls}>Square image, up to {MAX_LOGO_MB} MB</span>
          </div>
        </div>
        <Field id="shop-name" label="Shop name">
          <input id="shop-name" value={v.name || ""} onChange={e => set({ name: e.target.value })} className={inputCls} />
        </Field>
        <Field id="shop-slug" label="Shop link" hint={v.slug ? `pacakkhemah.com/shop/${v.slug}` : "Letters, numbers and dashes only"}>
          <div className="flex items-stretch min-h-11 rounded-xl border border-slate-400 overflow-hidden focus-within:border-[#062c24]">
            <span className="px-2.5 flex items-center text-[13px] text-slate-600 bg-slate-100 whitespace-nowrap">pacakkhemah.com/shop/</span>
            <input id="shop-slug" value={slugDraft}
              onChange={e => setSlugDraft(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
              onBlur={() => { const c = cleanSlug(slugDraft); setSlugDraft(c); if (c && c !== v.slug) set({ slug: c }); }}
              className="flex-1 min-w-0 px-2.5 text-base text-slate-900 outline-none" />
          </div>
        </Field>
      </Card>

      {/* About */}
      <Card className="scroll-mt-4">
        <div className="flex items-center justify-between" id="section-about">
          <H2>About your shop</H2>
          {!(v.tagline?.trim() || v.tagline_my?.trim()) && <span className="text-xs font-semibold text-amber-800">Not set</span>}
        </div>
        <Field id="about-en" label="English">
          <textarea id="about-en" rows={3} value={v.tagline || ""} onChange={e => set({ tagline: e.target.value })} placeholder="Two or three sentences customers see first" className={`${inputCls} py-2.5 resize-none`} />
        </Field>
        <Field id="about-bm" label="Bahasa Malaysia">
          <textarea id="about-bm" rows={3} value={v.tagline_my || ""} onChange={e => set({ tagline_my: e.target.value })} placeholder="Dua atau tiga ayat yang pelanggan baca dahulu" className={`${inputCls} py-2.5 resize-none`} />
        </Field>
      </Card>

      {/* Socials */}
      <Section id="section-socials" title="Social links" summary={socialSummary(v)} open={openSection === "socials"} onToggle={() => toggle("socials")}>
        {([
          ["ig", "Instagram", "fab fa-instagram"],
          ["tiktok", "TikTok", "fab fa-tiktok"],
          ["fb", "Facebook", "fab fa-facebook"],
          ["threads", "Threads", "fab fa-threads"],
        ] as [keyof VendorSettings, string, string][]).map(([key, label, icon]) => (
          <Field key={key} id={`social-${key}`} label={label}>
            <div className="relative">
              <i className={`${icon} absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500`} aria-hidden="true"></i>
              <input id={`social-${key}`} type="url" inputMode="url" value={(v[key] as string) || ""} onChange={e => set({ [key]: e.target.value.trim() })} placeholder={`${label} link`} className={`${inputCls} pl-10`} />
            </div>
          </Field>
        ))}
        <SwitchRow title="Show links on your shop page" checked={v.show_nav !== false} onChange={on => set({ show_nav: on })} />
      </Section>

      {/* How to rent steps */}
      <Section id="section-steps" title="How to rent steps" summary={stepsSummary(v)} open={openSection === "steps"} onToggle={() => toggle("steps")}>
        <p className={hintCls}>Shown on your shop page to explain how booking works. English and Bahasa Malaysia for each step.</p>
        {steps.map((s, i) => (
          <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="w-7 h-7 rounded-lg bg-[#062c24] text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
              {steps.length > 1 && (
                <button type="button" onClick={() => set({ steps: steps.filter((_, idx) => idx !== i) })} className="min-h-9 px-2 text-[13px] font-semibold text-red-800">Remove</button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1"><span className={labelCls}>Title (EN)</span><input value={s.title} onChange={e => updateStep(i, "title", e.target.value)} className={inputCls} /></label>
              <label className="flex flex-col gap-1"><span className={labelCls}>Tajuk (BM)</span><input value={s.my} onChange={e => updateStep(i, "my", e.target.value)} className={inputCls} /></label>
              <label className="flex flex-col gap-1"><span className={labelCls}>Detail (EN)</span><input value={s.desc || ""} onChange={e => updateStep(i, "desc", e.target.value)} className={inputCls} /></label>
              <label className="flex flex-col gap-1"><span className={labelCls}>Butiran (BM)</span><input value={s.desc_my || ""} onChange={e => updateStep(i, "desc_my", e.target.value)} className={inputCls} /></label>
            </div>
          </div>
        ))}
        <div className="flex gap-2">
          <button type="button" onClick={() => set({ steps: [...steps, { title: "", my: "", desc: "", desc_my: "" }] })} className={smallBtn}>Add step</button>
          <button type="button" onClick={() => set({ steps: DEFAULT_STEPS })} className={smallBtn}>Reset to default</button>
        </div>
      </Section>

      {/* Preview */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <H2>Preview</H2>
          <a href={shopUrl} target="_blank" rel="noreferrer" className="text-[13px] font-semibold text-emerald-800 underline">Open shop page</a>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="bg-[#062c24] px-4 py-4 flex items-center gap-3 text-white">
            {v.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.image} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0" />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0" aria-hidden="true"><i className="fas fa-campground"></i></div>
            )}
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-base font-bold truncate">{v.name || "Your shop name"}</span>
              <span className="text-xs text-emerald-100 truncate">{[v.city, v.services?.delivery?.enabled ? "Pickup and delivery" : "Pickup"].filter(Boolean).join(" · ")}</span>
            </div>
          </div>
          <div className="px-4 py-3.5 flex flex-col gap-1.5">
            {v.tagline?.trim() ? <p className="text-[13px] text-slate-800">{v.tagline}</p> : <p className="text-[13px] text-slate-500 italic">Your About text appears here</p>}
            {v.tagline_my?.trim() && <p className="text-[13px] text-slate-600">{v.tagline_my}</p>}
          </div>
        </div>
      </div>
    </>
  );
}

