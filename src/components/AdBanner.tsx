"use client";

import { useEffect, useRef } from "react";

type AdBannerProps = {
  variant?: "card" | "inline" | "minimal";
  className?: string;
};

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

export default function AdBanner({ variant = "card", className = "" }: AdBannerProps) {
  const adRef = useRef<HTMLDivElement>(null);
  const isLoaded = useRef(false);

  useEffect(() => {
    if (isLoaded.current) return;
    
    try {
      if (typeof window !== "undefined" && adRef.current) {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        isLoaded.current = true;
      }
    } catch (e) {
      console.error("AdSense error:", e);
    }
  }, []);

  // Card variant - looks like a vendor card in directory
  if (variant === "card") {
    return (
      <div className={`bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm ${className}`}>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center">
              <i className="fas fa-ad text-slate-400 text-[10px]"></i>
            </div>
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Sponsored</span>
          </div>
          <div ref={adRef} className="min-h-[200px] flex items-center justify-center bg-slate-50 rounded-xl">
            <ins
              className="adsbygoogle"
              style={{ display: "block" }}
              data-ad-client="ca-pub-2429364031062979"
              data-ad-slot="AUTO"
              data-ad-format="auto"
              data-full-width-responsive="true"
            />
          </div>
        </div>
      </div>
    );
  }

  // Inline variant - for cart/checkout flow
  if (variant === "inline") {
    return (
      <div className={`bg-slate-50 rounded-xl border border-slate-100 p-4 ${className}`}>
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Sponsored</span>
        </div>
        <div ref={adRef} className="min-h-[100px] flex items-center justify-center">
          <ins
            className="adsbygoogle"
            style={{ display: "block" }}
            data-ad-client="ca-pub-2429364031062979"
            data-ad-slot="AUTO"
            data-ad-format="horizontal"
            data-full-width-responsive="true"
          />
        </div>
      </div>
    );
  }

  // Minimal variant - very subtle
  return (
    <div className={`text-center ${className}`}>
      <span className="text-[7px] font-bold text-slate-300 uppercase tracking-widest">Ad</span>
      <div ref={adRef} className="min-h-[90px]">
        <ins
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client="ca-pub-2429364031062979"
          data-ad-slot="AUTO"
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </div>
  );
}