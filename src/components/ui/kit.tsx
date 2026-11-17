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

// ── Page structure ─────────────────────────────────────────────────────────
// Every dashboard screen uses these so headings, spacing, chips and empty
// states look and behave the same everywhere.

/** Top of a dashboard tab: sentence-case title, one-line description, optional action. */
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 style={{ textTransform: "none" }} className="text-[28px] leading-tight font-extrabold text-[#062c24]">{title}</h1>
        {subtitle && <p className="text-[13px] text-slate-600 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Header of a full-screen sub-page (order, item, discount): back button, title, optional right slot. */
export function ScreenHeader({ title, subtitle, onBack, backLabel = "Back", right }: { title: string; subtitle?: string; onBack: () => void; backLabel?: string; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={onBack} aria-label={backLabel}
        className="w-11 h-11 rounded-xl border border-slate-200 bg-white text-slate-700 flex items-center justify-center hover:bg-slate-100 shrink-0">
        <i className="fas fa-chevron-left" aria-hidden="true"></i>
      </button>
      <div className="flex-1 min-w-0">
        <h1 style={{ textTransform: "none" }} className="text-[22px] font-extrabold text-[#062c24] leading-tight truncate">{title}</h1>
        {subtitle && <p className="text-[13px] text-slate-600 truncate">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

/** Full-screen sub-page shell with an optional pinned footer. */
export function FullScreen({ label, children, footer, z = 500 }: { label: string; children: ReactNode; footer?: ReactNode; z?: number }) {
  return (
    <div className="fixed inset-0 bg-slate-50 flex flex-col" style={{ zIndex: z }} role="dialog" aria-modal="true" aria-label={label}>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto p-4 flex flex-col gap-3.5">{children}</div>
      </div>
      {footer && (
        <div className="bg-white border-t border-slate-200" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="max-w-xl mx-auto px-4 pt-3 pb-4 flex flex-col gap-2">{footer}</div>
        </div>
      )}
    </div>
  );
}

export const primaryBtn = "min-h-13 w-full rounded-2xl bg-[#062c24] text-white text-[15px] font-bold hover:bg-[#0a4135] disabled:opacity-50";
export const secondaryBtn = "min-h-13 w-full rounded-2xl border border-slate-300 bg-white text-slate-700 text-[15px] font-semibold hover:bg-slate-50 disabled:opacity-50";

/** Horizontal set of filter or group chips. `tone: "warn"` highlights an attention chip. */
export function Segments<T extends string>({ items, value, onChange, label, role = "tablist" }: {
  items: { key: T; label: string; tone?: "warn" }[]; value: T; onChange: (v: T) => void; label: string; role?: "tablist" | "group";
}) {
  return (
    <div role={role} aria-label={label} className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
      {items.map(it => {
        const on = value === it.key;
        return (
          <button key={it.key} type="button" onClick={() => onChange(it.key)}
            {...(role === "tablist" ? { role: "tab", "aria-selected": on } : { "aria-pressed": on })}
            className={`min-h-11 px-3.5 rounded-xl text-[13px] whitespace-nowrap ${on ? "bg-[#062c24] text-white font-bold"
              : it.tone === "warn" ? "bg-amber-100 border border-amber-300 text-amber-900 font-bold" : "bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"}`}>
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

/** Dark summary strip with 2–4 figures. */
export function SummaryStrip({ items }: { items: { value: string | number; label: string }[] }) {
  const cols = items.length === 2 ? "grid-cols-2" : items.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3";
  return (
    <div className={`bg-[#062c24] rounded-2xl px-4 py-3.5 grid ${cols} gap-x-2 gap-y-3 text-white`}>
      {items.map(it => (
        <div key={it.label} className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[22px] font-bold leading-tight truncate">{it.value}</span>
          <span className="text-xs text-emerald-100">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Light stat tile for grids of figures. */
export function StatCard({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: "good" | "warn" | "bad" }) {
  const color = tone === "good" ? "text-emerald-800" : tone === "warn" ? "text-amber-800" : tone === "bad" ? "text-red-800" : "text-[#062c24]";
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3.5 flex flex-col gap-0.5 min-w-0">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <span className={`text-[22px] font-bold leading-tight truncate ${color}`}>{value}</span>
      {hint && <span className="text-xs text-slate-600">{hint}</span>}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 style={{ textTransform: "none" }} className="text-[15px] font-extrabold text-slate-700">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ icon = "fa-inbox", title, body, action }: { icon?: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center flex flex-col items-center gap-2">
      <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-slate-500" aria-hidden="true"><i className={`fas ${icon} text-xl`}></i></div>
      <p className="text-sm font-bold text-slate-800">{title}</p>
      {body && <p className="text-[13px] text-slate-600 max-w-sm">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** A tappable row: icon, title, one-line description, chevron. */
export function NavRow({ icon, title, hint, onClick, href, badge, tone }: { icon: string; title: string; hint?: string; onClick?: () => void; href?: string; badge?: string | number; tone?: "danger" }) {
  const inner = (
    <>
      <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${tone === "danger" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`} aria-hidden="true"><i className={`fas ${icon}`}></i></span>
      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className={`text-[15px] font-bold ${tone === "danger" ? "text-red-800" : "text-slate-900"}`}>{title}</span>
        {hint && <span className="text-xs text-slate-600">{hint}</span>}
      </span>
      {badge !== undefined && badge !== "" && <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900">{badge}</span>}
      {tone !== "danger" && <i className="fas fa-chevron-right text-slate-400" aria-hidden="true"></i>}
    </>
  );
  const cls = "w-full min-h-[64px] bg-white border border-slate-200 rounded-2xl px-3.5 py-2.5 flex items-center gap-3 text-left hover:border-slate-400";
  return href
    ? <a href={href} target="_blank" rel="noreferrer" className={cls}>{inner}</a>
    : <button type="button" onClick={onClick} className={cls}>{inner}</button>;
}

export function BottomSheet({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[600] bg-slate-900/60 flex items-end md:items-center justify-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title}
        onClick={e => e.stopPropagation()}
        className="bg-white w-full max-w-md rounded-t-3xl md:rounded-3xl px-5 pt-3 pb-7 max-h-[92vh] overflow-y-auto flex flex-col gap-4 shadow-2xl">
        <div className="w-10 h-1 rounded-full bg-slate-300 self-center md:hidden" aria-hidden="true"></div>
        <div className="flex items-start justify-between gap-3">
          <h2 style={{ textTransform: "none" }} className="text-2xl font-extrabold text-[#062c24] leading-tight">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="w-11 h-11 -mr-2 -mt-1 shrink-0 rounded-full text-slate-600 hover:bg-slate-100 flex items-center justify-center">
            <i className="fas fa-times" aria-hidden="true"></i>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Toast ──────────────────────────────────────────────────────────────────

export type ToastState = { msg: string; type: "success" | "error" } | null;

export function useToast() {
  const [toast, setToast] = useState<ToastState>(null);
  const show = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(t => (t && t.msg === msg ? null : t)), 3500);
  };
  return { toast, show };
}

export function Toast({ toast }: { toast: ToastState }) {
  if (!toast) return null;
  return (
    <div role="status" className={`fixed bottom-28 left-1/2 -translate-x-1/2 z-[700] max-w-[90vw] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-white text-[13px] font-semibold ${toast.type === "success" ? "bg-emerald-700" : "bg-red-700"}`}>
      <i className={`fas ${toast.type === "success" ? "fa-check-circle" : "fa-exclamation-circle"}`} aria-hidden="true"></i>
      {toast.msg}
    </div>
  );
}

/** Small coloured label: status chips on cards and rows. */
export function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: "good" | "warn" | "danger" | "info" | "neutral" | "violet" }) {
  const cls = { good: "bg-emerald-100 text-emerald-800", warn: "bg-amber-100 text-amber-800", danger: "bg-red-100 text-red-800", info: "bg-blue-100 text-blue-800", neutral: "bg-slate-200 text-slate-700", violet: "bg-violet-100 text-violet-800" }[tone];
  return <span className={`text-xs font-bold px-2.5 py-1 rounded-lg whitespace-nowrap ${cls}`}>{children}</span>;
}

// ── Confirm sheet (replaces window.confirm / prompt) ───────────────────────

/**
 * Asks before something important. Optional reason box, and optional typed
 * confirmation for things that cannot be undone.
 */
export function ConfirmSheet({ title, body, confirmLabel, tone = "primary", reason, typeToConfirm, busy, onConfirm, onClose }: {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  reason?: { label: string; placeholder?: string; required?: boolean; initial?: string };
  typeToConfirm?: string;
  busy?: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(reason?.initial || "");
  const [typed, setTyped] = useState("");
  const blocked = !!busy || (!!reason?.required && !text.trim()) || (!!typeToConfirm && typed.trim() !== typeToConfirm);
  return (
    <BottomSheet title={title} onClose={onClose}>
      {body && <div className="text-sm leading-relaxed text-slate-700 -mt-1 flex flex-col gap-2">{body}</div>}
      {reason && (
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{reason.label}{reason.required ? "" : " (optional)"}</span>
          <textarea rows={2} value={text} onChange={e => setText(e.target.value)} placeholder={reason.placeholder}
            className={`${inputCls} py-2.5 resize-none`} />
        </label>
      )}
      {typeToConfirm && (
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Type <b className="text-slate-900">{typeToConfirm}</b> to confirm</span>
          <input value={typed} onChange={e => setTyped(e.target.value)} className={inputCls} autoComplete="off" />
        </label>
      )}
      <button type="button" disabled={blocked} onClick={() => onConfirm(text.trim())}
        className={tone === "danger" ? "min-h-13 w-full rounded-2xl bg-red-700 text-white text-[15px] font-bold hover:bg-red-800 disabled:opacity-50" : primaryBtn}>
        {busy ? "Working" : confirmLabel}
      </button>
      <button type="button" onClick={onClose} className={secondaryBtn}>Cancel</button>
    </BottomSheet>
  );
}

/** Search box with the icon and label the dashboards use. */
export function SearchInput({ id, value, onChange, placeholder }: { id: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">{placeholder}</label>
      <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm" aria-hidden="true"></i>
      <input id={id} type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full min-h-11 bg-white border border-slate-300 rounded-xl pl-10 pr-3 text-base text-slate-900 placeholder:text-slate-500" />
    </div>
  );
}
