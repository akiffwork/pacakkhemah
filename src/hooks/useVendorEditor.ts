"use client";

import { useCallback, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { VendorSettings } from "@/lib/vendorSettings";
import { useVendorAutosave } from "@/hooks/useVendorAutosave";

/**
 * A live, locally editable copy of vendors/{id}. Edits show at once and are
 * autosaved; changes from other devices flow in when nothing is pending.
 */
export function useVendorEditor(vendorId: string, initial: VendorSettings) {
  const [v, setV] = useState<VendorSettings>(initial);
  const { state, save, retry } = useVendorAutosave(vendorId);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "vendors", vendorId), snap => {
      if (!snap.exists() || snap.metadata.hasPendingWrites) return;
      setV(cur => ({ ...cur, ...(snap.data() as VendorSettings) }));
    });
    return () => unsub();
  }, [vendorId]);

  const set = useCallback((fields: Partial<VendorSettings>) => {
    setV(cur => ({ ...cur, ...fields }));
    const clean: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(fields)) clean[k] = val === undefined ? null : val;
    save(clean);
  }, [save]);

  return { v, set, state, retry };
}
