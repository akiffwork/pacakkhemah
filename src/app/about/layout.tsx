import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tentang Kami — Pacak Khemah",
  description: "Platform sewa peralatan camping di Malaysia. Menghubungkan campers dengan vendor dipercayai.",
  openGraph: {
    title: "Tentang Kami — Pacak Khemah",
    description: "Platform sewa peralatan camping di Malaysia.",
    images: [{ url: "https://pacakkhemah.com/pacak-khemah.png" }],
    siteName: "Pacak Khemah",
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}