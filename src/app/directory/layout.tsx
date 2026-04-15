import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Malaysia's Camping Gear Rental Platform | Pacak Khemah",
  description: "Layari vendor sewa peralatan camping dipercayai di seluruh Malaysia. Bandingkan harga, lihat inventori & tempah terus melalui WhatsApp.",
  openGraph: {
    title: "Malaysia's Camping Gear Rental Platform — Cari Vendor Berdekatan | Pacak Khemah",
    description: "Layari vendor sewa peralatan camping dipercayai di seluruh Malaysia. Tempah melalui WhatsApp.",
    images: [{ url: "https://pacakkhemah.com/pacak-khemah.png", width: 512, height: 512, alt: "Pacak Khemah" }],
    type: "website",
    siteName: "Pacak Khemah",
  },
  twitter: {
    card: "summary",
    title: "Pacak Khemah — Sewa Gear Camping Malaysia",
    description: "Sewa peralatan camping dari vendor dipercayai. Tempah melalui WhatsApp.",
    images: ["https://pacakkhemah.com/pacak-khemah.png"],
  },
};

export default function DirectoryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}