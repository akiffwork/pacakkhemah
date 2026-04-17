import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tempahan Saya — Pacak Khemah",
  description: "Lihat sejarah tempahan sewa peralatan camping anda di Pacak Khemah.",
  openGraph: {
    title: "Tempahan Saya — Pacak Khemah",
    description: "Semak tempahan dan sejarah sewaan anda.",
    images: [{ url: "https://pacakkhemah.com/pacak-khemah.png" }],
  },
};

export default function MyBookingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}