"use client";

import { useEffect } from "react";

// The calendar now lives inside the vendor dashboard. Old links and
// bookmarks to /calendar are forwarded there, keeping ?order= and ?v=.
export default function CalendarRedirect() {
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const next = new URLSearchParams({ tab: "calendar" });
    const order = p.get("order");
    const v = p.get("v");
    if (order) next.set("order", order);
    if (v) next.set("admin_override", v);
    window.location.replace(`/store?${next.toString()}`);
  }, []);
  return <p className="p-8 text-center text-sm text-slate-600">Opening your calendar…</p>;
}
