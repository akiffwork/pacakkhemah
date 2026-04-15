import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tapak Perkhemahan Popular di Malaysia | Pacak Khemah",
  description: "Senarai tapak perkhemahan popular di seluruh Malaysia. Cari campsite dan sewa peralatan camping dari vendor berdekatan.",
  openGraph: {
    title: "Tapak Perkhemahan Popular — Pacak Khemah",
    description: "Senarai tapak perkhemahan popular di Malaysia. Sewa gear camping dari vendor berdekatan.",
    images: [{ url: "https://pacakkhemah.com/pacak-khemah.png", width: 512, height: 512, alt: "Pacak Khemah" }],
    type: "website",
    siteName: "Pacak Khemah",
  },
  twitter: {
    card: "summary",
    title: "Campsites Malaysia — Pacak Khemah",
    description: "Cari tapak perkhemahan dan sewa gear camping.",
    images: ["https://pacakkhemah.com/pacak-khemah.png"],
  },
};

export default function CampsitesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}