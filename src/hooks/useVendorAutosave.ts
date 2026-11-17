"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Debounced writes to vendors/{vendorId}. Call save(fields) on every change;
 * writes are merged and sent 800 ms after the last change, or at once with
 * flush(). Pending changes are also flushed when the page is hidden.
 */
export function useVendorAutosave(vendorId: string) {
  const [state, setState] = useState<SaveState>("idle");
  const pending = useRef<Record<string, unknown>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);

  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const data = pending.current;
    if (!Object.keys(data).length) return;
    pending.current = {};
    setState("saving");
    const p = updateDoc(doc(db, "vendors", vendorId), data)
      .then(() => { if (!Object.keys(pending.current).length) setState("saved"); })
      .catch((e) => { console.error("Autosave error:", e); pending.current = { ...data, ...pending.current }; setState("error"); });
    inFlight.current = p;
    await p;
  }, [vendorId]);

  const save = useCallback((fields: Record<string, unknown>, delay = 800) => {
    pending.current = { ...pending.current, ...fields };
    setState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, delay);
  }, [flush]);

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") void flush(); };
    const onUnload = (e: BeforeUnloadEvent) => { if (Object.keys(pending.current).length) { void flush(); e.preventDefault(); } };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onUnload);
      void flush();
    };
  }, [flush]);

  return { state, save, flush, retry: flush };
}
