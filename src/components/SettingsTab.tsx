"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { type VendorSettings, type SetupGroup, setupChecklist } from "@/lib/vendorSettings";
import { useVendorAutosave } from "@/hooks/useVendorAutosave";
import StorefrontGroup from "@/components/settings/StorefrontGroup";
import RulesGroup from "@/components/settings/RulesGroup";
import AccountGroup from "@/components/settings/AccountGroup";
import { SaveStatus } from "@/components/settings/ui";

type SettingsTabProps = {
  vendorId: string;
  vendorData: VendorSettings & { [key: string]: unknown };
  initialGroup?: SetupGroup;
  onRestartTour?: () => void;
  onNavigate?: (tab: string) => void;
};

const GROUPS: { key: SetupGroup; label: string }[] = [
  { key: "storefront", label: "Storefront" },
  { key: "rules", label: "Booking rules" },
  { key: "account", label: "Account" },
];

export default function SettingsTab({ vendorId, vendorData, initialGroup, onRestartTour, onNavigate }: SettingsTabProps) {
  const [group, setGroup] = useState<SetupGroup>(initialGroup || "storefront");
  const [openSection, setOpenSection] = useState<string | null>(null);
  // Local copy of the vendor document: edited instantly, written by autosave,
  // and kept in sync with Firestore so other devices' changes show up.
  const [v, setV] = useState<VendorSettings>(vendorData);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const { state, save, retry } = useVendorAutosave(vendorId);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "vendors", vendorId), snap => {
      if (!snap.exists() || snap.metadata.hasPendingWrites) return;
      // Server data wins only for fields we are not in the middle of editing
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

  const checklist = useMemo(() => setupChecklist(v), [v]);
  const todo = checklist.filter(i => !i.done);
  const done = checklist.length - todo.length;

  function goTo(item: { group: SetupGroup; section: string }) {
    if (item.section === "inventory") { onNavigate?.("inventory"); return; }
    setGroup(item.group);
    setOpenSection(item.section);
    setTimeout(() => document.getElementById(`section-${item.section}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  const groupProps = { vendorId, v, set, openSection, setOpenSection, toast: showToast };

  return (
    <div className="flex flex-col gap-4 pb-16">
      <div>
        <h2 className="text-3xl font-black text-[#062c24] uppercase">Settings</h2>
        <p className="text-xs font-semibold text-slate-600">Your shop, booking rules and account</p>
      </div>

      <div role="tablist" aria-label="Settings groups" className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {GROUPS.map(g => (
          <button key={g.key} type="button" role="tab" aria-selected={group === g.key} onClick={() => { setGroup(g.key); setOpenSection(null); }}
            className={`min-h-11 px-3.5 rounded-xl text-[13px] font-semibold whitespace-nowrap ${group === g.key ? "bg-[#062c24] text-white" : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"}`}>
            {g.label}
          </button>
        ))}
      </div>

      {todo.length > 0 && (
        <div className="bg-[#062c24] rounded-2xl px-4 py-3.5 flex flex-col gap-2.5 text-white">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[15px] font-bold">Shop setup · {done} of {checklist.length} done</span>
            <span className="text-xs text-emerald-100">Shown until complete</span>
          </div>
          <div className="h-1.5 rounded-full bg-[#1f4d42] overflow-hidden"><div className="h-full bg-emerald-400" style={{ width: `${Math.round((done / checklist.length) * 100)}%` }} /></div>
          <ul className="flex flex-col">
            {todo.map(item => (
              <li key={item.key}>
                <button type="button" onClick={() => goTo(item)} className="min-h-9 flex items-center gap-2.5 text-[13px] text-left w-full">
                  <span className="w-[18px] h-[18px] rounded-full border-2 border-emerald-200 shrink-0" aria-hidden="true"></span>
                  <span>{item.label}{item.group !== group && item.section !== "inventory" ? ` (in ${GROUPS.find(g => g.key === item.group)?.label})` : ""}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {group === "storefront" && <StorefrontGroup {...groupProps} />}
      {group === "rules" && <RulesGroup {...groupProps} />}
      {group === "account" && <AccountGroup {...groupProps} onRestartTour={onRestartTour} onOpenCredits={onNavigate ? () => onNavigate("analytics") : undefined} />}

      {/* Save status */}
      <div className="fixed left-0 right-0 bottom-[68px] z-40 pointer-events-none" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="max-w-xl mx-auto px-4">
          <div className="pointer-events-auto bg-white/95 backdrop-blur border border-slate-200 rounded-xl px-3.5 py-2 flex items-center justify-between gap-3 shadow-sm">
            <span className="text-[13px] text-slate-600">Changes save as you go</span>
            {state === "error" ? (
              <button type="button" onClick={() => retry()} className="text-[13px] font-bold text-red-800 underline">Could not save, tap to retry</button>
            ) : <SaveStatus state={state === "idle" ? "saved" : state} />}
          </div>
        </div>
      </div>

      {toast && (
        <div role="status" className={`fixed bottom-28 left-1/2 -translate-x-1/2 z-[700] max-w-[90vw] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-white text-[13px] font-semibold ${toast.type === "success" ? "bg-emerald-700" : "bg-red-700"}`}>
          <i className={`fas ${toast.type === "success" ? "fa-check-circle" : "fa-exclamation-circle"}`} aria-hidden="true"></i>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
