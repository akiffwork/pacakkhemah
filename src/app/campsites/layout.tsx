import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tempat Camping Malaysia — Pantai, Sungai, Bukit & Air Terjun",
  description:
    "Cari lokasi camping terbaik di Malaysia. Pantai, sungai, bukit, air terjun — cadangan komuniti dengan arah & maklumat hubungan.",
  openGraph: {
    title: "Tempat Camping Malaysia | Pacak Khemah",
    description:
      "Cari lokasi camping terbaik di Malaysia. Cadangan komuniti dengan arah & maklumat hubungan.",
  },
};

export default function CampsitesLayout({ children }: { children: React.ReactNode }) {
  return children;
}