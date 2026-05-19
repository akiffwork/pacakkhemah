import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Camping Guide | Pacak Khemah",
  description: "Tips, tricks & tent setup guides from the camping community. Learn how to set up tents, pack smart, and camp like a pro.",
  openGraph: {
    title: "Camping Guide | Pacak Khemah",
    description: "Tips, tricks & tent setup guides from the camping community.",
    images: [{ url: "https://pacakkhemah.com/rent-camp.png", width: 1200, height: 630, alt: "Camping Guide" }],
    type: "website",
    siteName: "Pacak Khemah",
  },
  twitter: {
    card: "summary_large_image",
    title: "Camping Guide | Pacak Khemah",
    description: "Tips, tricks & tent setup guides from the camping community.",
    images: ["https://pacakkhemah.com/rent-camp.png"],
  },
};

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return children;
}
