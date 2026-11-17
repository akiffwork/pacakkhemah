"use client";

// Maintenance notice from Admin › Settings › Site info. Shown on customer
// pages only; the vendor dashboard and admin panel are left alone.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { loadSiteSettings } from "@/lib/siteSettings";

const HIDDEN_ON = ["/admin", "/store"];

export default function SiteNotice() {
  const path = usePathname() || "";
  const [message, setMessage] = useState<string | null>(null);
  const hidden = HIDDEN_ON.some(p => path.startsWith(p));

  useEffect(() => {
    if (hidden) return;
    loadSiteSettings().then(s => setMessage(s.maintenanceMode ? s.maintenanceMessage : null));
  }, [hidden]);

  if (hidden || !message) return null;
  return (
    <div role="status" className="sticky top-0 z-[900] bg-amber-100 border-b border-amber-300 text-amber-900 px-4 py-2.5 text-center text-[13px] font-semibold">
      <i className="fas fa-screwdriver-wrench mr-2" aria-hidden="true"></i>{message}
    </div>
  );
}
