"use client";

import { SaveStatus } from "@/components/ui/kit";
import type { SaveState } from "@/hooks/useVendorAutosave";

/** Floating "All changes saved" bar used by every autosaving screen. */
export default function SaveBar({ state, retry }: { state: SaveState; retry: () => void }) {
  return (
    <div className="fixed left-0 right-0 bottom-[72px] z-40 pointer-events-none" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="max-w-xl mx-auto px-4">
        <div className="pointer-events-auto bg-white/95 backdrop-blur border border-slate-200 rounded-xl px-3.5 py-2 flex items-center justify-between gap-3 shadow-sm">
          <span className="text-[13px] text-slate-600">Changes save as you go</span>
          {state === "error"
            ? <button type="button" onClick={() => retry()} className="text-[13px] font-bold text-red-800 underline">Could not save, tap to retry</button>
            : <SaveStatus state={state === "idle" ? "saved" : state} />}
        </div>
      </div>
    </div>
  );
}
