"use client";

import { useState, type ReactNode, type KeyboardEvent } from "react";

export const inputCls = "w-full min-h-11 bg-white border border-slate-400 rounded-xl px-3 text-base text-slate-900 placeholder:text-slate-500 outline-none focus:border-[#062c24] focus:ring-2 focus:ring-emerald-100";
export const labelCls = "text-[13px] font-semibold text-slate-700";
export const hintCls = "text-xs text-slate-600";
export const smallBtn = "min-h-10 px-3.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-[13px] font-semibold hover:bg-slate-50 disabled:opacity-60";
export const primarySmallBtn = "min-h-10 px-3.5 rounded-xl bg-[#062c24] text-white text-[13px] font-bold hover:bg-[#0a4135] disabled:opacity-60";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-slate-200 p-4 flex flex-col gap-3.5 ${className}`}>{children}</div>;
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 style={{ textTransform: "none" }} className="text-[17px] font-extrabold text-[#062c24]">{children}</h2>;
}

export function Field({ id, label, hint, children }: { id?: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelCls}>{label}</label>
      {children}
      {hint && <span className={hintCls}>{hint}</span>}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={`relative w-[52px] h-8 rounded-full shrink-0 transition-colors disabled:opacity-50 ${checked ? "bg-emerald-700" : "bg-slate-400"}`}>
      <span className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${checked ? "left-[24px]" : "left-1"}`} />
    </button>
  );
}

export function SwitchRow({ title, hint, checked, onChange, disabled }: { title: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold">{title}</span>
        {hint && <span className={hintCls}>{hint}</span>}
      </span>
      <Switch checked={checked} onChange={onChange} label={title} disabled={disabled} />
    </div>
  );
}

/** Folded section with a one-line summary of its current setting. */
export function Section({ id, title, summary, warn, open, onToggle, children }: {
  id?: string; title: string; summary: string; warn?: boolean; open: boolean; onToggle: () => void; children: ReactNode;
}) {
  return (
    <div id={id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden scroll-mt-4">
      <button type="button" onClick={onToggle} aria-expanded={open}
        className="w-full min-h-[60px] px-4 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50">
        <span className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-bold text-slate-900">{title}</span>
          <span className={`text-xs ${warn ? "text-amber-800 font-semibold" : "text-slate-600"}`}>{summary}</span>
        </span>
        <i className={`fas ${open ? "fa-chevron-up" : "fa-chevron-down"} text-slate-600 shrink-0`} aria-hidden="true"></i>
      </button>
      {open && <div className="px-4 pb-4 pt-1 border-t border-slate-200 flex flex-col gap-3.5">{children}</div>}
    </div>
  );
}

export function Choice<T extends string>({ options, value, onChange, label, columns = 2 }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string; columns?: number;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`grid gap-2 ${columns === 3 ? "grid-cols-3" : columns === 4 ? "grid-cols-4" : "grid-cols-2"}`}>
      {options.map(o => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={`min-h-11 px-2 rounded-xl text-[13px] ${value === o.value ? "border-2 border-[#062c24] bg-emerald-50 text-[#062c24] font-bold" : "border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-50"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Type a value, press Enter (or tap Add) and it becomes a removable chip. */
export function ChipsInput({ id, values, onChange, placeholder }: { id: string; values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  function commit() {
    const parts = draft.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...values];
    for (const p of parts) if (!next.some(x => x.toLowerCase() === p.toLowerCase())) next.push(p);
    onChange(next);
    setDraft("");
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    if (e.key === "Backspace" && !draft && values.length) onChange(values.slice(0, -1));
  }
  return (
    <div className="flex flex-col gap-2">
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map(v => (
            <span key={v} className="flex items-center gap-1 h-9 pl-3 pr-1 rounded-[10px] bg-emerald-50 border border-emerald-200 text-[13px] font-semibold text-emerald-900">
              {v}
              <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter(x => x !== v))}
                className="w-7 h-7 rounded-full text-emerald-900 hover:bg-emerald-100 flex items-center justify-center">
                <i className="fas fa-times text-xs" aria-hidden="true"></i>
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input id={id} type="text" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={onKey} onBlur={commit} placeholder={placeholder}
          className={`${inputCls} border-dashed`} />
        <button type="button" onClick={commit} disabled={!draft.trim()} className={smallBtn}>Add</button>
      </div>
    </div>
  );
}

/** Numeric text input that keeps the value as a number. */
export function NumberInput({ id, value, onChange, min = 0, suffix }: { id: string; value: number; onChange: (n: number) => void; min?: number; suffix?: string }) {
  const [text, setText] = useState(String(value));
  return (
    <div className="relative">
      <input id={id} type="text" inputMode="decimal" value={text}
        onChange={e => { const t = e.target.value.replace(/[^0-9.]/g, ""); setText(t); const n = Number(t); if (t !== "" && !Number.isNaN(n)) onChange(Math.max(min, n)); }}
        onBlur={() => { const n = Number(text); const v = text === "" || Number.isNaN(n) ? Math.max(min, value) : Math.max(min, n); setText(String(v)); onChange(v); }}
        className={`${inputCls} ${suffix ? "pr-12" : ""}`} />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-600">{suffix}</span>}
    </div>
  );
}

export function SaveStatus({ state }: { state: "saved" | "saving" | "error" | "idle" }) {
  if (state === "error") return <span className="flex items-center gap-1.5 text-[13px] font-bold text-red-800"><i className="fas fa-exclamation-circle" aria-hidden="true"></i>Could not save, check your connection</span>;
  if (state === "saving") return <span className="flex items-center gap-1.5 text-[13px] font-bold text-amber-800"><i className="fas fa-clock" aria-hidden="true"></i>Saving</span>;
  return <span className="flex items-center gap-1.5 text-[13px] font-bold text-emerald-800"><i className="fas fa-check" aria-hidden="true"></i>All changes saved</span>;
}
