import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Soalan Lazim (FAQ) — Pacak Khemah",
  description: "Jawapan kepada soalan lazim tentang platform sewa peralatan camping Pacak Khemah.",
  openGraph: {
    title: "Soalan Lazim — Pacak Khemah",
    description: "Jawapan kepada soalan lazim tentang sewa camping gear di Malaysia.",
    images: [{ url: "https://pacakkhemah.com/pacak-khemah.png" }],
  },
};

export default function FAQLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}