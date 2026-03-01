"use client";

import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-[100] p-4 flex justify-between items-center pointer-events-none transition-all duration-300">
      <Link
        href="/directory"
        className="pointer-events-auto w-10 h-10 bg-white/20 backdrop-blur-md border border-white/10 rounded-xl flex items-center justify-center text-white hover:bg-white hover:text-[#062c24] transition-all shadow-xl"
      >
        <i className="fas fa-arrow-left"></i>
      </Link>
      <Link
        href="/store"
        className="pointer-events-auto px-4 py-2 bg-white/20 backdrop-blur-md border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-white hover:text-[#062c24] transition-all shadow-xl flex items-center gap-2"
      >
        <i className="fas fa-store text-emerald-400"></i> Vendor Login
      </Link>
    </nav>
  );
}