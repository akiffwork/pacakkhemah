import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kedai Sewa Gear Camping",
  description:
    "Lihat & tempah peralatan camping dari vendor dipercayai. Pilih tarikh, tambah ke cart & tempah melalui WhatsApp.",
  openGraph: {
    title: "Kedai Sewa Gear Camping | Pacak Khemah",
    description: "Lihat & tempah peralatan camping dari vendor dipercayai.",
  },
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return children;
}