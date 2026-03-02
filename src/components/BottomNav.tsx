"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/directory", label: "Explore", icon: "fa-compass" },
  { href: "/campsites", label: "Campsites", icon: "fa-campground" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Spacer so content doesn't hide behind nav */}
      <div className="h-24" />

      {/* Nav bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[90]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-3 mb-3">
          <div className="bg-white/95 backdrop-blur-xl border border-slate-100 shadow-2xl rounded-[2rem] px-2 py-2 flex items-center justify-around">
            {NAV_ITEMS.map((item) => {
              // Active if exact match or starts with (for dynamic routes like /shop/[slug])
              const isActive =
                pathname === item.href ||
                (item.href !== "/directory" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center gap-1 px-5 py-2.5 rounded-2xl transition-all duration-200 min-w-[64px] ${
                    isActive
                      ? "bg-[#062c24] text-white shadow-lg scale-105"
                      : "text-slate-400 hover:text-[#062c24] hover:bg-slate-50"
                  }`}
                >
                  <i className={`fas ${item.icon} text-base`} />
                  <span className="text-[9px] font-black uppercase tracking-widest leading-none">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}