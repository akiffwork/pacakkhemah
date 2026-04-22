import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  turbopack: {},

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: "/v0/b/kuantan-unplugged.firebasestorage.app/**",
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: "/v0/b/kuantan-unplugged.appspot.com/**",
      },
    ],
    formats: ["image/avif", "image/webp"],
  },
};

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  disable: process.env.NODE_ENV === "development",
});

// Force-merge: spread nextConfig AFTER withPWA so images can't be overwritten.
const configWithPWA = withPWA(nextConfig);

export default {
  ...configWithPWA,
  images: nextConfig.images,
} as NextConfig;