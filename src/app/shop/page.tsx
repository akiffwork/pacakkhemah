"use client";

import { Suspense } from "react";
import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

// This page handles /shop?v=vendorId
// Redirects to /shop/[slug] or /shop/[vendorId] based on whether vendor has a slug

function ShopRedirectContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const vendorId = searchParams.get("v");

  useEffect(() => {
    if (!vendorId) {
      router.replace("/directory");
      return;
    }

    async function checkVendor(vid: string) {
      try {
        const vSnap = await getDoc(doc(db, "vendors", vid));
        if (!vSnap.exists()) {
          router.replace("/directory");
          return;
        }

        const vData = vSnap.data();
        if (vData.slug) {
          // Vendor has slug, use pretty URL
          router.replace(`/shop/${vData.slug}`);
        } else {
          // No slug, use vendor ID directly
          router.replace(`/shop/${vid}`);
        }
      } catch (error) {
        console.error("Error checking vendor:", error);
        router.replace("/directory");
      }
    }

    checkVendor(vendorId);
  }, [vendorId, router]);

  return (
    <div className="fixed inset-0 bg-[#062c24] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-white/60 text-xs font-bold uppercase tracking-widest">Loading Shop...</p>
      </div>
    </div>
  );
}

export default function ShopRedirectPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-[#062c24] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
      </div>
    }>
      <ShopRedirectContent />
    </Suspense>
  );
}