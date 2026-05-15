import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: ["facebookexternalhit", "Facebot", "Twitterbot", "LinkedInBot"],
        allow: "/",
      },
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/store", "/calendar", "/agreement", "/review/"],
      },
    ],
    sitemap: "https://pacakkhemah.com/sitemap.xml",
  };
}