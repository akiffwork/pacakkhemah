"use client";

// src/lib/vendorPrivate.ts
// A shop's private details (login email, tax profile) live in
// vendors/{vendorId}/privateInfo/details, readable only by the shop's owner
// and the admin. The main vendor document is public (the shop page reads it),
// so these must not be stored there. Older shops still have them on the main
// document until the admin runs "Privacy cleanup"; they're read as a fallback.

import { useCallback, useEffect, useRef, useState } from "react";
import { deleteField, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { TaxProfile } from "@/lib/vendorSettings";

export type VendorPrivate = { email?: string; taxProfile?: TaxProfile };

export const privateDocRef = (vendorId: string) => doc(db, "vendors", vendorId, "privateInfo", "details");

/** Private details, falling back to the old copy on the vendor document. */
export async function getVendorPrivate(vendorId: string, legacy: VendorPrivate = {}): Promise<VendorPrivate> {
  try {
    const snap = await getDoc(privateDocRef(vendorId));
    const data = (snap.data() || {}) as VendorPrivate;
    return { email: data.email ?? legacy.email, taxProfile: data.taxProfile ?? legacy.taxProfile };
  } catch {
    return { ...legacy };
  }
}

/** Save to the private document; removes the old public copy of those fields. */
export async function saveVendorPrivate(vendorId: string, fields: VendorPrivate, legacy: VendorPrivate = {}) {
  await setDoc(privateDocRef(vendorId), fields, { merge: true });
  const clear: Record<string, ReturnType<typeof deleteField>> = {};
  for (const k of Object.keys(fields) as (keyof VendorPrivate)[]) if (legacy[k] !== undefined) clear[k] = deleteField();
  if (Object.keys(clear).length) await updateDoc(doc(db, "vendors", vendorId), clear);
}

/** Live-edit the private details with debounced saves (like settings autosave). */
export function useVendorPrivate(vendorId: string, legacy: VendorPrivate) {
  const [data, setData] = useState<VendorPrivate>(legacy);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const pending = useRef<VendorPrivate>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const legacyRef = useRef(legacy);

  useEffect(() => {
    if (!vendorId) return;
    let alive = true;
    getVendorPrivate(vendorId, legacyRef.current).then(d => {
      if (!alive) return;
      // Keep anything typed while it was loading.
      setData({ ...d, ...pending.current });
    });
    return () => { alive = false; };
  }, [vendorId]);

  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const fields = pending.current;
    if (!Object.keys(fields).length) return;
    pending.current = {};
    setState("saving");
    try {
      await saveVendorPrivate(vendorId, fields, legacyRef.current);
      for (const k of Object.keys(fields)) delete (legacyRef.current as Record<string, unknown>)[k];
      setState("saved");
    } catch (e) {
      console.error("Private details save error:", e);
      pending.current = { ...fields, ...pending.current };
      setState("error");
    }
  }, [vendorId]);

  const save = useCallback((fields: VendorPrivate) => {
    setData(d => ({ ...d, ...fields }));
    pending.current = { ...pending.current, ...fields };
    setState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, 800);
  }, [flush]);

  // Don't lose the last change when leaving the page or the screen.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") void flush(); };
    document.addEventListener("visibilitychange", onHide);
    return () => { document.removeEventListener("visibilitychange", onHide); void flush(); };
  }, [flush]);

  return { data, save, state, flush };
}
