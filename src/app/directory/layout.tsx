import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sewa Gear Camping — Cari Vendor Berdekatan",
  description:
    "Layari vendor sewa peralatan camping dipercayai di seluruh Malaysia. Bandingkan harga, lihat inventori & tempah terus melalui WhatsApp.",
  openGraph: {
    title: "Sewa Gear Camping — Cari Vendor Berdekatan | Pacak Khemah",
    description:
      "Layari vendor sewa peralatan camping dipercayai di seluruh Malaysia. Tempah melalui WhatsApp.",
  },
};

export default function DirectoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}