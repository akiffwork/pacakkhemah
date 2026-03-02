import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vendor Studio — Urus Kedai Anda",
  description: "Panel pengurusan vendor Pacak Khemah. Urus inventori, analitik & tetapan kedai.",
  robots: { index: false, follow: false },
};

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return children;
}