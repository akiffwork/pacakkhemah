import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const hostname = request.headers.get("host") || "";
  const isVendor = hostname.startsWith("vendor.");

  const customerManifest = {
    name: "Pacak Khemah",
    short_name: "Pacak Khemah",
    description: "Sewa gear camping mudah & cepat",
    start_url: "/directory",
    display: "standalone",
    background_color: "#062c24",
    theme_color: "#062c24",
    orientation: "portrait",
    scope: "/",
    lang: "ms",
    icons: [
      { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "maskable any" },
      { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable any" },
    ],
    shortcuts: [
      {
        name: "Cari Gear",
        url: "/directory",
        icons: [{ src: "/icons/icon-96x96.png", sizes: "96x96" }],
      },
    ],
    categories: ["shopping", "lifestyle", "travel"],
  };

  const vendorManifest = {
    name: "Pacak Khemah Vendor",
    short_name: "PK Vendor",
    description: "Urus sewa gear camping anda",
    start_url: "/store",
    display: "standalone",
    background_color: "#062c24",
    theme_color: "#062c24",
    orientation: "portrait",
    scope: "/",
    lang: "ms",
    icons: [
      { src: "/icons/vendor/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "maskable any" },
      { src: "/icons/vendor/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable any" },
    ],
    shortcuts: [
      {
        name: "Dashboard",
        url: "/store",
        icons: [{ src: "/icons/vendor/icon-96x96.png", sizes: "96x96" }],
      },
      {
        name: "Kalendar",
        url: "/store/calendar",
        icons: [{ src: "/icons/vendor/icon-96x96.png", sizes: "96x96" }],
      },
      {
        name: "Inventory",
        url: "/store/inventory",
        icons: [{ src: "/icons/vendor/icon-96x96.png", sizes: "96x96" }],
      },
    ],
    categories: ["business", "productivity"],
  };

  return NextResponse.json(isVendor ? vendorManifest : customerManifest, {
    headers: { "Content-Type": "application/manifest+json" },
  });
}