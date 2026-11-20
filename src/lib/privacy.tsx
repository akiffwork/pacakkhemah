"use client";

// src/lib/privacy.tsx
// Privacy mode for the vendor dashboard: hides money, customer details and
// tax IDs (shown as ••••) so the dashboard can be demoed with a real account.
// Tap a hidden value to show it for a few seconds. On/off is remembered per
// device. Display only: the data still loads, it is just not shown.

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ConfirmSheet } from "@/components/ui/kit";

const KEY = "pk_privacy";
const REVEAL_MS = 5000;

export type PrivateKind = "money" | "name" | "phone" | "id" | "number" | "text";

type Ctx = {
  on: boolean;
  setOn: (v: boolean) => void;
  /** Run an action that would show real details (PDF, WhatsApp); asks first when privacy mode is on. */
  guard: (action: () => void, what: string) => void;
  /** Text with every "RM 1,234" hidden while privacy mode is on. */
  money: (text: string) => string;
  /** A customer name as initials while privacy mode is on. */
  name: (text: string) => string;
};

/** Hide every "RM 1,234.50" (and "-RM 5") inside a sentence. */
export function maskMoneyIn(text: string): string {
  return text.replace(/RM\s?-?[\d,]+(?:\.\d+)?/g, "RM ••••");
}

const PrivacyContext = createContext<Ctx>({ on: false, setOn: () => {}, guard: a => a(), money: t => t, name: t => t });

// The on/off flag lives in localStorage; components subscribe to it.
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) cb(); };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(cb); window.removeEventListener("storage", onStorage); };
}
function readOn(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const on = useSyncExternalStore(subscribe, readOn, () => false);
  const [pending, setPending] = useState<{ action: () => void; what: string } | null>(null);

  const setOn = useCallback((v: boolean) => {
    try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* ignore */ }
    listeners.forEach(l => l());
  }, []);

  const guard = useCallback((action: () => void, what: string) => {
    if (!on) { action(); return; }
    setPending({ action, what });
  }, [on]);

  return (
    <PrivacyContext.Provider value={{
      on, setOn, guard,
      money: (t: string) => (on ? maskMoneyIn(t) : t),
      name: (t: string) => (on ? maskName(t) : t),
    }}>
      {children}
      {pending && (
        <ConfirmSheet
          title="Show real details?"
          body={<p>Privacy mode is on. {pending.what}</p>}
          confirmLabel="Show real details"
          onConfirm={() => { const a = pending.action; setPending(null); a(); }}
          onClose={() => setPending(null)}
        />
      )}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  return useContext(PrivacyContext);
}

// ── Masks ────────────────────────────────────────────────────────────────────

/** "ILI SHAFIQAH" → "I•• S••". */
export function maskName(name?: string | null): string {
  const words = (name || "").trim().split(/\s+/).filter(Boolean).slice(0, 3);
  return words.length ? words.map(w => `${w[0].toUpperCase()}••`).join(" ") : "•••";
}

export function maskText(kind: PrivateKind, text?: string | number | null): string {
  switch (kind) {
    case "money": return "RM ••••";
    case "name": return maskName(text == null ? "" : String(text));
    case "phone": return "••• •••• ••••";
    case "id": return "••••••-••-••••";
    case "number": return "••";
    default: return "••••••";
  }
}

/**
 * A value hidden in privacy mode. Tap to show it for 5 seconds.
 * Use `reveal={false}` inside another button or link (no nested buttons).
 * `text` is the plain value, used for name initials.
 */
export function Private({ children, kind = "text", text, reveal = true, className = "" }: {
  children: ReactNode;
  kind?: PrivateKind;
  text?: string | number | null;
  reveal?: boolean;
  className?: string;
}) {
  const { on } = usePrivacy();
  const [shown, setShown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (!on || shown) return <>{children}</>;
  const masked = maskText(kind, text ?? (typeof children === "string" || typeof children === "number" ? children : ""));
  if (!reveal) return <span className={className} aria-label="Hidden">{masked}</span>;
  return (
    <button type="button"
      onClick={e => {
        e.stopPropagation();
        e.preventDefault();
        setShown(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setShown(false), REVEAL_MS);
      }}
      className={`inline cursor-pointer rounded px-0.5 -mx-0.5 hover:bg-slate-200/70 focus-visible:outline-2 focus-visible:outline-emerald-600 ${className}`}
      aria-label="Hidden. Tap to show for 5 seconds" title="Tap to show">
      {masked}
    </button>
  );
}

/** Header switch: eye icon, highlighted while privacy mode is on. */
export function PrivacyToggle() {
  const { on, setOn } = usePrivacy();
  return (
    <button type="button" onClick={() => setOn(!on)} aria-pressed={on}
      aria-label={on ? "Privacy mode on. Tap to show all details" : "Privacy mode off. Tap to hide money and customer details"}
      title={on ? "Privacy mode on" : "Privacy mode"}
      className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 transition-colors ${on ? "bg-[#062c24] border-[#062c24] text-white" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"}`}>
      <i className={`fas ${on ? "fa-eye-slash" : "fa-eye"} text-sm`} aria-hidden="true"></i>
    </button>
  );
}
