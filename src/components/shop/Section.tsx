"use client";

import { useState } from "react";

type SectionProps = {
  title: string;
  icon: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

export default function Section({ title, icon, defaultOpen = true, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center text-sm">
            <i className={`fas ${icon}`}></i>
          </div>
          <span className="text-sm font-black text-[#062c24] uppercase tracking-wide">{title}</span>
        </div>
        <i className={`fas fa-chevron-down text-slate-300 text-xs transition-transform duration-200 ${open ? "rotate-180" : ""}`}></i>
      </button>
      {open && (
        <div className="px-4 pb-4">{children}</div>
      )}
    </div>
  );
}