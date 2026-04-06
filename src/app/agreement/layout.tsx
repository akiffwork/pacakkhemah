import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rental Agreement",
  description:
    "Sahkan tempahan sewa peralatan camping anda. Baca terma, muat naik IC & tandatangan secara digital.",
  robots: { index: false, follow: false },
};

export default function AgreementLayout({ children }: { children: React.ReactNode }) {
  return children;
}